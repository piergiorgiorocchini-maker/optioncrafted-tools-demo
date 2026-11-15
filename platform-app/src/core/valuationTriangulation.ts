import {dcfModel,grahamModel,modelDefaults} from "./valuationModels";
import {googleSheetsSecAnnualHistory,googleSheetsSecFinancialsMetadata,type SecAnnualFinancialYear} from "../data/googleSheetsSecFinancials";
import {verifiedFinancialProfile} from "../data/verifiedFinancials";
import {getManualTtmFinancials} from "../data/googleSheetsManualFinancials";

type AssetForValuation = {
  ticker:string;
  name:string;
  sector:string;
  category?:string;
  currency:string;
  price:number|null;
  priceDate:string|null;
  eps:number|null;
  dividendYield:number|null;
};

export type ValuationFamily = "cash_flow"|"earnings"|"dividend"|"trading_comps";
export type ValuationMethodStatus = "AVAILABLE"|"PENDING"|"NOT_APPLICABLE";
export type ValuationMethodResult = {
  id:string;
  label:string;
  family:ValuationFamily;
  status:ValuationMethodStatus;
  value:number|null;
  low:number|null;
  high:number|null;
  quality:number|null;
  reason:string;
  assumptions:string[];
  fiscalPeriod:string|null;
  filedDate:string|null;
  sourceUrl:string|null;
  estimateBasis?:"HISTORICAL"|"ASSUMPTION"|"USER_SCENARIO";
};

export type ValuationBridge = {
  ticker:string;
  currency:string;
  marketPrice:number|null;
  priceDate:string|null;
  intrinsicValue:number|null;
  /** Compatibility alias; available once at least one eligible valuation family produces an estimate. */
  fairValue:number|null;
  buyUnder:number|null;
  marginOfSafety:number;
  marketComparison:"OVERVALUED"|"UNDERVALUED"|"IN_LINE"|"PENDING";
  comparisonPercent:number|null;
  priceAgeDays:number|null;
  comparisonReason:string|null;
  status:"TRIANGULATED"|"INDICATIVE"|"PENDING";
  confidence:"PRELIMINARY"|"LOW"|"INSUFFICIENT";
  eligibleFamilies:number;
  familyCountRequired:number;
  simpleMean:number|null;
  median:number|null;
  familyRange:{low:number;high:number}|null;
  dcfHorizonRange:{low:number;high:number}|null;
  source:string;
  sourceAsOf:string|null;
  importedAt:string;
  profileBasis:string;
  profileEligible:boolean;
  qualityNotes:string[];
  methods:ValuationMethodResult[];
};

export type ValuationBuildOptions = {
  /** Optional Valuation Lab scenario; labelled as a user scenario in the result. */
  dcfScenarioValue?:number|null;
  dcfScenarioLabel?:string;
  marginOfSafety?:number;
};

const MOS=modelDefaults.mos;
const DCF_DISCOUNT=modelDefaults.discount;
const DCF_TERMINAL=modelDefaults.terminal;
const DCF_HORIZONS=[5,7,10] as const;
const requiredFamilies=2;
const validPositive=(value:number|null|undefined):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>0;

function continuousAnnualWindow<T>(rows:T[],getValue:(row:T)=>number|null,getEnd:(row:T)=>string,minCount:number):T[]{
  const positive=rows.filter(row=>validPositive(getValue(row)));
  if(positive.length<minCount)return [];
  const last=positive.slice(-minCount);
  for(let index=1;index<last.length;index++){
    const previous=Date.parse(`${getEnd(last[index-1])}T00:00:00Z`);
    const current=Date.parse(`${getEnd(last[index])}T00:00:00Z`);
    const days=(current-previous)/86_400_000;
    if(!Number.isFinite(days)||days<300||days>430)return [];
  }
  return last;
}

function cagrPercent(first:number,last:number,firstDate:string,lastDate:string):number|null{
  if(!validPositive(first)||!validPositive(last))return null;
  const start=Date.parse(`${firstDate}T00:00:00Z`);
  const end=Date.parse(`${lastDate}T00:00:00Z`);
  const years=(end-start)/(365.2425*86_400_000);
  if(!Number.isFinite(years)||years<2.5)return null;
  const growth=(Math.pow(last/first,1/years)-1)*100;
  return Number.isFinite(growth)?growth:null;
}

function boundedGrowth(raw:number,lower=-15,upper=15){
  const applied=Math.min(upper,Math.max(lower,raw));
  return {raw,applied,capped:Math.abs(raw-applied)>0.001};
}

function median(values:number[]):number|null{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

function profileGate(asset:AssetForValuation):{eligible:boolean;basis:string;quality:number;reason:string|null;profile:"operating"|"bank"|"fund"|"unknown"}{
  const known=verifiedFinancialProfile(asset.ticker)?.toLowerCase()??null;
  const identity=`${asset.ticker} ${asset.name} ${asset.category??""}`.toLowerCase();
  const sector=asset.sector.trim().toLowerCase();
  if(/\b(etf|exchange traded fund|index fund|mutual fund|commodity trust|gold trust|unit trust)\b/.test(identity)){
    return {eligible:false,basis:"Google Sheets instrument name/category",quality:0,reason:"ETF, fund or trust: issuer-level DCF and earnings valuation is not applicable to the security itself.",profile:"fund"};
  }
  if(known==="bank"){
    return {eligible:false,basis:"20-company SEC validation pilot",quality:0,reason:"Bank profile: generic operating-company DCF and Graham methods are disabled; a bank-specific residual-income/valuation model is required.",profile:"bank"};
  }
  if(/\b(bank|bancorp|insurance|insurer|broker|asset management|investment management|credit card|financial holding|jpmorgan|goldman sachs|morgan stanley|wells fargo|citigroup|bank of america|capital one|berkshire hathaway|blackrock|charles schwab)\b/.test(identity)){
    return {eligible:false,basis:"Company-name financial-profile exclusion",quality:0,reason:"Financial-company profile needs a bank/insurer-specific method and a verified balance-sheet model.",profile:"bank"};
  }
  if(/financial services|financials|real estate|reit|insurance|bank/.test(sector)){
    return {eligible:false,basis:"Google Sheets sector classification",quality:0,reason:"Financial or real-estate sector: generic industrial methods are disabled until a profile-specific model is available.",profile:"unknown"};
  }
  if(known==="industrial"){
    return {eligible:true,basis:"20-company SEC validation pilot",quality:1,reason:null,profile:"operating"};
  }
  if(/technology|healthcare|health care|consumer cyclical|consumer defensive|consumer staples|industrials|industrial|energy|basic materials|utilities|communication services/.test(sector)){
    return {eligible:true,basis:"Google Sheets sector · not yet independently validated",quality:0.78,reason:null,profile:"operating"};
  }
  return {eligible:false,basis:"Issuer profile not verified",quality:0,reason:"Operating-company profile is not verified; method eligibility remains pending rather than applying an industrial model by default.",profile:"unknown"};
}

function methodPending(id:string,label:string,family:ValuationFamily,reason:string):ValuationMethodResult{
  return {id,label,family,status:"PENDING",value:null,low:null,high:null,quality:null,reason,assumptions:[],fiscalPeriod:null,filedDate:null,sourceUrl:null};
}

function getLastMetric(year:SecAnnualFinancialYear|undefined,metric:"freeCashFlowPerShare"|"dilutedEps"){return year?.[metric]??null;}

export function buildValuationTriangulation(asset:AssetForValuation,options:ValuationBuildOptions={}):ValuationBridge{
  const currency=asset.currency||"USD";
  const marginOfSafety=Number.isFinite(options.marginOfSafety)&&options.marginOfSafety!>=0&&options.marginOfSafety!<100?options.marginOfSafety!:MOS;
  const history=googleSheetsSecAnnualHistory(asset.ticker,currency);
  const profile=profileGate(asset);
  const latest=history.at(-1);
  const manualTtm=getManualTtmFinancials(asset.ticker,currency);
  const sourceAsOf=history.map(year=>year.filedDate).filter((date):date is string=>Boolean(date)).sort().at(-1)??null;
  const qualityNotes:string[]=[];
  const methods:ValuationMethodResult[]=[];
  let dcfHorizonRange:{low:number;high:number}|null=null;
  let dcfMethod:ValuationMethodResult;
  let earningsMethod:ValuationMethodResult;

  if(!profile.eligible){
    dcfMethod=methodPending("dcf","DCF · cash flow","cash_flow",profile.reason??"Profile gate pending.");
    earningsMethod=methodPending("earnings","Normalized earnings · Graham","earnings",profile.reason??"Profile gate pending.");
  }else{
    const fcfWindow=continuousAnnualWindow(history,year=>year.freeCashFlowPerShare,year=>year.periodEnd,4);
    const latestFcfPerShare=manualTtm?.freeCashFlowPerShare??getLastMetric(latest,"freeCashFlowPerShare");
    const fcfBasePeriod=manualTtm?"TTM "+manualTtm.periodStart+" to "+manualTtm.periodEnd:latest?.fiscalYear??null;
    const fcfBaseDate=manualTtm?.periodEnd??latest?.periodEnd??null;
    const dcfGrowthRaw=fcfWindow.length>=4?cagrPercent(fcfWindow[0].freeCashFlowPerShare!,fcfWindow.at(-1)!.freeCashFlowPerShare!,fcfWindow[0].periodEnd,fcfWindow.at(-1)!.periodEnd):null;
    const dcfGrowth=dcfGrowthRaw===null?null:boundedGrowth(dcfGrowthRaw,-15,15);
    const scenarioValue=options.dcfScenarioValue;
    const scenarioAvailable=typeof scenarioValue==="number"&&Number.isFinite(scenarioValue)&&scenarioValue>0;
    const hasHistoricalDcfGrowth=fcfWindow.length>=4&&dcfGrowth!==null;
    const dcfGrowthRate=dcfGrowth?.applied??modelDefaults.growth;

    if(scenarioAvailable){
      const scenarioLabel=options.dcfScenarioLabel??"Valuation Lab user scenario";
      dcfMethod={id:"dcf",label:"DCF · cash flow",family:"cash_flow",status:"AVAILABLE",value:scenarioValue,low:scenarioValue,high:scenarioValue,quality:profile.quality*0.55,reason:`${scenarioLabel}; this is a user-edited scenario, not an automatic base estimate.`,assumptions:["User-edited Valuation Lab DCF", "Not treated as a forecast or a statistical confidence interval"],fiscalPeriod:latest?.fiscalYear??null,filedDate:latest?.filedDate??null,sourceUrl:latest?.sources.cashFromOperations?.sourceUrl??null,estimateBasis:"USER_SCENARIO"};
      qualityNotes.push("DCF is using an explicitly labelled user scenario from Valuation Lab.");
    }else if(!latestFcfPerShare||latestFcfPerShare<=0){
      const reasons:string[]=[];
      if(!latest?.cashFromOperations)reasons.push("latest annual operating cash flow missing");
      if(latest?.cashFromOperations!==null&&latest?.cashFromOperations!==undefined&&latest.capex===null)reasons.push("latest annual CapEx missing");
      if(latest?.freeCashFlow!==null&&latest?.freeCashFlow!==undefined&&latest.freeCashFlow<=0)reasons.push("latest annual free cash flow is not positive");
      if(latest?.dilutedEps===null||latest?.netIncome===null)reasons.push("reported diluted shares or same-period net income/diluted EPS for inferred shares is missing");
      dcfMethod=methodPending("dcf","DCF · cash flow","cash_flow",reasons.length?reasons.join("; "):"latest annual FCF/share is not positive or is unavailable.");
    }else{
      const estimates=DCF_HORIZONS.map(years=>{
        const result=dcfModel(latestFcfPerShare,dcfGrowthRate,DCF_DISCOUNT,DCF_TERMINAL,years);
        return result?{years,result}:null;
      }).filter((item):item is NonNullable<typeof item>=>item!==null);
      const base=estimates.find(item=>item.years===5)?.result??null;
      if(!base){
        dcfMethod=methodPending("dcf","DCF · cash flow","cash_flow","DCF calculation rejected the input combination (discount rate must exceed terminal growth and FCF must be positive).");
      }else{
        const values=estimates.map(item=>item.result.value);
        dcfHorizonRange={low:Math.min(...values),high:Math.max(...values)};
        const growthEvidence=hasHistoricalDcfGrowth
          ?`Historical annual FCF/share CAGR from ${fcfWindow[0].fiscalYear}–${fcfWindow.at(-1)!.fiscalYear}: ${dcfGrowthRaw!.toFixed(1)}%${dcfGrowth!.capped?` (bounded to ${dcfGrowth!.applied.toFixed(1)}%)`:""}`
          :`Historical FCF/share growth is incomplete; uses Valuation Lab default growth of ${modelDefaults.growth}% as an assumption, not an observed rate.`;
        const dcfReason=hasHistoricalDcfGrowth
          ?manualTtm?"Five-year base estimate using imported TTM FCF/share; 7- and 10-year values are sensitivity views inside this same family. Historical growth comes from annual SEC observations.":"Five-year base estimate; 7- and 10-year values are sensitivity views inside this same family."
          :`Indicative five-year DCF using default ${modelDefaults.growth}% growth because four consecutive annual FCF/share observations are unavailable; this is a model assumption, not observed growth.`;
        dcfMethod={id:"dcf",label:"DCF · cash flow",family:"cash_flow",status:"AVAILABLE",value:base.value,low:dcfHorizonRange.low,high:dcfHorizonRange.high,quality:profile.quality*(hasHistoricalDcfGrowth?0.68:0.42),reason:dcfReason,assumptions:[`FCF/share base: ${latestFcfPerShare.toFixed(2)} ${currency}/share from ${manualTtm?"manual TTM "+manualTtm.periodStart+" to "+manualTtm.periodEnd:"SEC FY"+(latest?.fiscalYear??"N/D")}`,growthEvidence,`Discount rate ${DCF_DISCOUNT}% · terminal growth ${DCF_TERMINAL}%`,"5Y base; 7Y/10Y sensitivity only · standard FCF = operating cash flow − CapEx; diluted shares use the same TTM period"],fiscalPeriod:fcfBasePeriod,filedDate:fcfBaseDate??latest?.filedDate??null,sourceUrl:manualTtm?.sourceUrl??latest?.sources.cashFromOperations?.sourceUrl??null,estimateBasis:hasHistoricalDcfGrowth?"HISTORICAL":"ASSUMPTION"};
        qualityNotes.push(manualTtm?"NVDA DCF base uses manual TTM FCF/share; the historical FCF/share CAGR remains annual SEC data.":"FCF/share uses SEC weighted-average diluted shares when reported, and otherwise estimates shares from same-year net income ÷ diluted EPS.");
        if(!hasHistoricalDcfGrowth)qualityNotes.push(`DCF uses the Valuation Lab default ${modelDefaults.growth}% growth assumption because the SEC FCF/share history is incomplete.`);
        if(hasHistoricalDcfGrowth&&dcfGrowth!.capped)qualityNotes.push(`Historical FCF/share CAGR was bounded from ${dcfGrowth!.raw.toFixed(1)}% to ${dcfGrowth!.applied.toFixed(1)}% to reduce extrapolation risk.`);
      }
    }

    const epsWindow=continuousAnnualWindow(history,year=>year.dilutedEps,year=>year.periodEnd,4);
    const normalizedEpsRows=history.slice(-5);
    const normalizedEps=normalizedEpsRows.length===5&&normalizedEpsRows.every(year=>validPositive(year.dilutedEps))?median(normalizedEpsRows.map(year=>year.dilutedEps!)):null;
    const epsGrowthRaw=epsWindow.length>=4?cagrPercent(epsWindow[0].dilutedEps!,epsWindow.at(-1)!.dilutedEps!,epsWindow[0].periodEnd,epsWindow.at(-1)!.periodEnd):null;
    const epsGrowth=epsGrowthRaw===null?null:boundedGrowth(epsGrowthRaw,-15,15);
    const currentEps=manualTtm?.dilutedEps??asset.eps??latest?.dilutedEps??null;
    const currentEpsSource=manualTtm?.dilutedEps!==null&&manualTtm?.dilutedEps!==undefined?"manual TTM EPS":asset.eps!==null?"market snapshot EPS":"latest SEC diluted EPS";
    const grahamEps=normalizedEps??(validPositive(currentEps)?currentEps:null);
    const hasHistoricalGrahamBasis=normalizedEps!==null&&epsGrowth!==null;
    const grahamGrowthRate=epsGrowth?.applied??modelDefaults.growth;
    if(!validPositive(currentEps)||!grahamEps){
      const noEps=history.every(year=>year.dilutedEps===null)&&!validPositive(asset.eps)&&!validPositive(manualTtm?.dilutedEps);
      earningsMethod=methodPending("earnings","Normalized earnings · Graham","earnings",noEps?"No positive diluted EPS is available in the current snapshot or SEC history.":"Latest EPS is not positive; a Graham earnings value is not published.");
    }else if(epsGrowth&&epsGrowth.applied<=-4.25){
      earningsMethod=methodPending("earnings","Normalized earnings · Graham","earnings","Historical diluted-EPS CAGR is below the Graham model's usable range; a positive earnings power estimate is not published.");
    }else{
      const graham=grahamModel(grahamEps,grahamGrowthRate,null,asset.price,asset.dividendYield===null?null:asset.dividendYield*100);
      const value=graham?.classic??null;
      const grahamReason=hasHistoricalGrahamBasis
        ?"Classic Graham earnings value using five-year median diluted EPS and observed historical growth."
        :`Indicative Graham estimate using ${normalizedEps!==null?"available positive diluted EPS":"current "+currentEpsSource} and ${epsGrowth?`observed ${epsGrowth.applied.toFixed(1)}% EPS growth`:`default ${modelDefaults.growth}% growth assumption`}; five-year normalization and/or growth history is incomplete, so confidence is low.`;
      const epsBaseAssumption=normalizedEps!==null
        ?`Normalized EPS (5 FY): median FY${normalizedEpsRows[0].fiscalYear}–FY${normalizedEpsRows.at(-1)!.fiscalYear} = ${normalizedEps.toFixed(2)} ${currency}/share`
        :`EPS base (${currentEpsSource}): ${grahamEps.toFixed(2)} ${currency}/share; five-year median normalization unavailable`;
      const epsGrowthAssumption=epsGrowth
        ?`Diluted-EPS CAGR from FY${epsWindow[0].fiscalYear}–FY${epsWindow.at(-1)!.fiscalYear}: ${epsGrowthRaw!.toFixed(1)}%${epsGrowth.capped?` (bounded to ${epsGrowth.applied.toFixed(1)}%)`:""}`
        :`Historical diluted-EPS growth unavailable; uses default ${modelDefaults.growth}% growth, an assumption and not observed history`;
      earningsMethod=value===null?methodPending("earnings","Normalized earnings · Graham","earnings","EPS and growth did not produce a valid positive estimate."):{id:"earnings",label:hasHistoricalGrahamBasis?"Normalized earnings · Graham":"Graham · indicative",family:"earnings",status:"AVAILABLE",value,low:value,high:value,quality:profile.quality*(hasHistoricalGrahamBasis?0.88:0.42),reason:grahamReason,assumptions:[epsBaseAssumption,epsGrowthAssumption,"Classic Graham formula: EPS × (8.5 + 2 × growth percentage); AAA-adjusted output is not used in the primary estimate"],fiscalPeriod:normalizedEpsRows.at(-1)?.fiscalYear??manualTtm?.periodEnd??latest?.fiscalYear??null,filedDate:normalizedEpsRows.map(year=>year.filedDate).filter((date):date is string=>Boolean(date)).sort().at(-1)??latest?.filedDate??null,sourceUrl:normalizedEpsRows.at(-1)?.sources.epsDiluted?.sourceUrl??latest?.sources.epsDiluted?.sourceUrl??null,estimateBasis:hasHistoricalGrahamBasis?"HISTORICAL":"ASSUMPTION"};
      if(epsGrowth?.capped)qualityNotes.push(`Historical diluted-EPS CAGR was bounded from ${epsGrowth.raw.toFixed(1)}% to ${epsGrowth.applied.toFixed(1)}% in the Graham family.`);
      if(!hasHistoricalGrahamBasis)qualityNotes.push("Graham uses a current/available EPS and default or partial-history growth assumptions because five-year normalization and/or continuous historical EPS growth is incomplete.");
    }
  }

  methods.push(dcfMethod!,earningsMethod!);
  const dividendMethod:ValuationMethodResult=asset.dividendYield===0
    ?{...methodPending("ddm","Dividend discount","dividend","Current snapshot reports a zero dividend yield; DDM is not applicable."),status:"NOT_APPLICABLE"}
    :methodPending("ddm","Dividend discount","dividend",asset.dividendYield!==null&&asset.dividendYield>0?"A positive snapshot yield exists, but the annual dividend-per-share history and sustainability checks are not in the imported SEC facts.":"Dividend-per-share history and sustainability are not yet mapped.");
  const peersMethod=methodPending("peers","Trading comparables","trading_comps","A dated and validated industry-mapped peer multiple dataset is not yet connected; sector labels in the current Sheets snapshot are not sufficient evidence.");
  methods.push(dividendMethod,peersMethod);

  const available=methods.filter(method=>method.status==="AVAILABLE"&&method.value!==null&&method.quality!==null);
  const uniqueByFamily=new Map<ValuationFamily,ValuationMethodResult>();
  for(const method of available){
    const prior=uniqueByFamily.get(method.family);
    if(!prior||((method.quality??0)>(prior.quality??0)))uniqueByFamily.set(method.family,method);
  }
  const eligibleMethods=[...uniqueByFamily.values()];
  const familyValues=eligibleMethods.map(method=>method.value!);
  const eligibleFamilies=eligibleMethods.length;
  const simpleMean=familyValues.length?familyValues.reduce((total,value)=>total+value,0)/familyValues.length:null;
  const sortedFamilies=familyValues.slice().sort((a,b)=>a-b);
  const familyMedian=median(familyValues);
  const familyRange=sortedFamilies.length?{low:sortedFamilies[0],high:sortedFamilies.at(-1)!}:null;
  let intrinsicValue:number|null=null;
  if(eligibleFamilies>=requiredFamilies){
    const rawWeights=eligibleMethods.map(method=>Math.max(0.01,method.quality??0.5));
    const total=rawWeights.reduce((sum,weight)=>sum+weight,0);
    const weights=rawWeights.map(weight=>Math.min(0.65,weight/total));
    const normalizer=weights.reduce((sum,weight)=>sum+weight,0);
    intrinsicValue=eligibleMethods.reduce((sum,method,index)=>sum+method.value!*weights[index]/normalizer,0);
    if(familyRange&&familyRange.high>0){
      const spread=(familyRange.high-familyRange.low)/intrinsicValue;
      qualityNotes.push(spread>0.5?"The eligible valuation families diverge by more than 50% of the composite; the result is preliminary and low confidence.":spread>0.25?"Method estimates diverge materially; treat the composite as preliminary.":"The eligible valuation families are reasonably close, but this is not a statistical confidence interval.");
    }
  }else if(eligibleFamilies===1){
    intrinsicValue=eligibleMethods[0].value!;
    qualityNotes.push(`Only one eligible valuation family (${eligibleMethods[0].label}) is available. The displayed fair value is indicative, is not triangulated, and has low confidence.`);
  }
  const methodSpread=eligibleFamilies>=requiredFamilies&&intrinsicValue!==null&&familyRange?(familyRange.high-familyRange.low)/Math.max(intrinsicValue,0.01):null;
  const hasAssumptionBasedMethod=eligibleMethods.some(method=>method.estimateBasis==="ASSUMPTION"||method.estimateBasis==="USER_SCENARIO");
  const confidence=intrinsicValue===null?"INSUFFICIENT":eligibleFamilies<requiredFamilies||hasAssumptionBasedMethod?"LOW":methodSpread!==null&&methodSpread<0.25?"PRELIMINARY":"LOW";
  const buyUnder=intrinsicValue===null?null:intrinsicValue*(1-marginOfSafety/100);
  const parsedPriceDate=asset.priceDate?Date.parse(`${asset.priceDate}T00:00:00Z`):NaN;
  const priceAgeDays=Number.isFinite(parsedPriceDate)?Math.max(0,Math.floor((Date.now()-parsedPriceDate)/86_400_000)):null;
  let comparisonReason:string|null=null;
  if(intrinsicValue===null)comparisonReason="No eligible valuation model produced an estimate; check the DCF and Graham method requirements.";
  else if(!validPositive(asset.price))comparisonReason="A positive market price is unavailable.";
  else if(priceAgeDays===null)comparisonReason="The market-price date is unavailable.";
  else if(priceAgeDays>4)comparisonReason=`The market-price snapshot is ${priceAgeDays} days old; comparison is held until the quote refreshes.`;
  else if(sourceAsOf&&asset.priceDate&&sourceAsOf>asset.priceDate)comparisonReason=`Latest SEC filing (${sourceAsOf}) is later than the market-price snapshot (${asset.priceDate}); refresh the quote before comparing.`;
  const comparison=comparisonReason!==null?"PENDING":intrinsicValue!==null&&validPositive(asset.price)?Math.abs(intrinsicValue/asset.price-1)<0.01?"IN_LINE":intrinsicValue>asset.price?"UNDERVALUED":"OVERVALUED":"PENDING";
  const comparisonPercent=comparison==="PENDING"||intrinsicValue===null||!validPositive(asset.price)?null:Math.abs(intrinsicValue/asset.price-1)*100;
  if(history.some(year=>year.freeCashFlowPerShare!==null))qualityNotes.push("SEC fundamentals and Google Sheets market price have separate dates; check the dates displayed before interpreting the comparison.");
  if(sourceAsOf&&asset.priceDate&&sourceAsOf>asset.priceDate)qualityNotes.push(`Latest included SEC filing (${sourceAsOf}) post-dates the Google Sheets market-price snapshot (${asset.priceDate}).`);

  return {
    ticker:asset.ticker,
    currency,
    marketPrice:asset.price,
    priceDate:asset.priceDate,
    intrinsicValue,
    fairValue:intrinsicValue,
    buyUnder,
    marginOfSafety,
    marketComparison:comparison,
    comparisonPercent,
    priceAgeDays,
    comparisonReason,
    status:intrinsicValue===null?"PENDING":eligibleFamilies>=requiredFamilies?"TRIANGULATED":"INDICATIVE",
    confidence,
    eligibleFamilies,
    familyCountRequired:requiredFamilies,
    simpleMean:eligibleFamilies>0?simpleMean:null,
    median:eligibleFamilies>0?familyMedian:null,
    familyRange:eligibleFamilies>0?familyRange:null,
    dcfHorizonRange,
    source:manualTtm?"Google Sheets SEC_Raw + NVDA manual TTM statement snapshot · annual SEC history for growth + shared family-balanced model":"Google Sheets SEC_Raw · verified annual SEC facts + shared family-balanced model",
    sourceAsOf,
    importedAt:manualTtm?.importedAt??googleSheetsSecFinancialsMetadata.sourceImportedAt,
    profileBasis:profile.basis,
    profileEligible:profile.eligible,
    qualityNotes:[...new Set(qualityNotes)],
    methods,
  };
}
