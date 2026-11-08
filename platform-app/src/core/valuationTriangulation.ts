import {dcfModel,grahamModel,modelDefaults} from "./valuationModels";
import {googleSheetsSecAnnualHistory,googleSheetsSecFinancialsMetadata,type SecAnnualFinancialYear} from "../data/googleSheetsSecFinancials";
import {verifiedFinancialProfile} from "../data/verifiedFinancials";

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
};

export type ValuationBridge = {
  ticker:string;
  currency:string;
  marketPrice:number|null;
  priceDate:string|null;
  intrinsicValue:number|null;
  /** Compatibility alias; non-null only when at least two valuation families qualify. */
  fairValue:number|null;
  buyUnder:number|null;
  marginOfSafety:number;
  marketComparison:"OVERVALUED"|"UNDERVALUED"|"IN_LINE"|"PENDING";
  comparisonPercent:number|null;
  priceAgeDays:number|null;
  comparisonReason:string|null;
  status:"TRIANGULATED"|"PENDING";
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
    const latestFcfPerShare=getLastMetric(latest,"freeCashFlowPerShare");
    const dcfGrowthRaw=fcfWindow.length>=4?cagrPercent(fcfWindow[0].freeCashFlowPerShare!,fcfWindow.at(-1)!.freeCashFlowPerShare!,fcfWindow[0].periodEnd,fcfWindow.at(-1)!.periodEnd):null;
    const dcfGrowth=dcfGrowthRaw===null?null:boundedGrowth(dcfGrowthRaw,-15,15);
    const scenarioValue=options.dcfScenarioValue;
    const scenarioAvailable=typeof scenarioValue==="number"&&Number.isFinite(scenarioValue)&&scenarioValue>0;

    if(scenarioAvailable){
      const scenarioLabel=options.dcfScenarioLabel??"Valuation Lab user scenario";
      dcfMethod={id:"dcf",label:"DCF · cash flow",family:"cash_flow",status:"AVAILABLE",value:scenarioValue,low:scenarioValue,high:scenarioValue,quality:profile.quality*0.55,reason:`${scenarioLabel}; this is a user-edited scenario, not an automatic base estimate.`,assumptions:["User-edited Valuation Lab DCF", "Not treated as a forecast or a statistical confidence interval"],fiscalPeriod:latest?.fiscalYear??null,filedDate:latest?.filedDate??null,sourceUrl:latest?.sources.cashFromOperations?.sourceUrl??null};
      qualityNotes.push("DCF is using an explicitly labelled user scenario from Valuation Lab.");
    }else if(!latestFcfPerShare||latestFcfPerShare<=0){
      const reasons:string[]=[];
      if(!latest?.cashFromOperations)reasons.push("latest annual operating cash flow missing");
      if(latest?.cashFromOperations!==null&&latest?.cashFromOperations!==undefined&&latest.capex===null)reasons.push("latest annual CapEx missing");
      if(latest?.freeCashFlow!==null&&latest?.freeCashFlow!==undefined&&latest.freeCashFlow<=0)reasons.push("latest annual free cash flow is not positive");
      if(latest?.dilutedEps===null||latest?.netIncome===null)reasons.push("same-period diluted EPS/net income required to infer shares is missing");
      dcfMethod=methodPending("dcf","DCF · cash flow","cash_flow",reasons.length?reasons.join("; "):"latest annual FCF/share is not positive or is unavailable.");
    }else if(fcfWindow.length<4||dcfGrowth===null){
      dcfMethod=methodPending("dcf","DCF · cash flow","cash_flow","Requires at least four consecutive positive annual FCF/share observations to derive a three-year historical CAGR; the available SEC history does not meet that gate.");
    }else{
      const estimates=DCF_HORIZONS.map(years=>{
        const result=dcfModel(latestFcfPerShare,dcfGrowth.applied,DCF_DISCOUNT,DCF_TERMINAL,years);
        return result?{years,result}:null;
      }).filter((item):item is NonNullable<typeof item>=>item!==null);
      const base=estimates.find(item=>item.years===5)?.result??null;
      if(!base){
        dcfMethod=methodPending("dcf","DCF · cash flow","cash_flow","DCF calculation rejected the input combination (discount rate must exceed terminal growth and FCF must be positive).");
      }else{
        const values=estimates.map(item=>item.result.value);
        dcfHorizonRange={low:Math.min(...values),high:Math.max(...values)};
        dcfMethod={id:"dcf",label:"DCF · cash flow",family:"cash_flow",status:"AVAILABLE",value:base.value,low:dcfHorizonRange.low,high:dcfHorizonRange.high,quality:profile.quality*0.68,reason:"Five-year base estimate; 7- and 10-year values are sensitivity views inside this same family.",assumptions:[`FCF/share CAGR from ${fcfWindow[0].fiscalYear}–${fcfWindow.at(-1)!.fiscalYear}: ${dcfGrowthRaw!.toFixed(1)}%${dcfGrowth.capped?` (bounded to ${dcfGrowth.applied.toFixed(1)}%)`:""}`,`Discount rate ${DCF_DISCOUNT}% · terminal growth ${DCF_TERMINAL}%`,`5Y base; 7Y/10Y sensitivity only · FCF/share uses implied shares from same-year net income ÷ diluted EPS`],fiscalPeriod:latest?.fiscalYear??null,filedDate:latest?.filedDate??null,sourceUrl:latest?.sources.cashFromOperations?.sourceUrl??null};
        qualityNotes.push("FCF/share uses an implied share count from same-year SEC net income ÷ diluted EPS; it is an estimate, not a reported diluted share count.");
        if(dcfGrowth.capped)qualityNotes.push(`Historical FCF/share CAGR was bounded from ${dcfGrowth.raw.toFixed(1)}% to ${dcfGrowth.applied.toFixed(1)}% to reduce extrapolation risk.`);
      }
    }

    const epsWindow=continuousAnnualWindow(history,year=>year.dilutedEps,year=>year.periodEnd,4);
    const positiveEps=history.filter(year=>validPositive(year.dilutedEps));
    const normalizedEpsRows=positiveEps.slice(-3);
    const normalizedEps=normalizedEpsRows.length===3?median(normalizedEpsRows.map(year=>year.dilutedEps!)):null;
    const epsGrowthRaw=epsWindow.length>=4?cagrPercent(epsWindow[0].dilutedEps!,epsWindow.at(-1)!.dilutedEps!,epsWindow[0].periodEnd,epsWindow.at(-1)!.periodEnd):null;
    const epsGrowth=epsGrowthRaw===null?null:boundedGrowth(epsGrowthRaw,-15,15);
    if(!normalizedEps||!epsGrowth||!validPositive(latest?.dilutedEps)){
      const noEps=history.every(year=>year.dilutedEps===null);
      earningsMethod=methodPending("earnings","Normalized earnings · Graham","earnings",noEps?"SEC_Raw has no annual diluted EPS for this ticker; normalized earnings and its historical growth cannot be computed.":"Requires four consecutive positive annual diluted-EPS observations to normalize the last three years and derive a three-year growth rate.");
    }else if(epsGrowth.applied<=-4.25){
      earningsMethod=methodPending("earnings","Normalized earnings · Graham","earnings","Historical diluted-EPS CAGR is below the Graham model's usable range; a positive earnings power estimate is not published.");
    }else{
      const graham=grahamModel(normalizedEps,epsGrowth.applied,null,asset.price,asset.dividendYield===null?null:asset.dividendYield*100);
      const value=graham?.classic??null;
      earningsMethod=value===null?methodPending("earnings","Normalized earnings · Graham","earnings","Normalized EPS and growth did not produce a valid positive estimate."):{id:"earnings",label:"Normalized earnings · Graham",family:"earnings",status:"AVAILABLE",value,low:value,high:value,quality:profile.quality*0.88,reason:"Classic Graham earnings value using reported diluted EPS; the last three positive fiscal years are normalized by their median.",assumptions:[`Normalized EPS: median FY${normalizedEpsRows[0].fiscalYear}–FY${normalizedEpsRows.at(-1)!.fiscalYear} = ${normalizedEps!.toFixed(2)} ${currency}/share`,`Diluted-EPS CAGR from FY${epsWindow[0].fiscalYear}–FY${epsWindow.at(-1)!.fiscalYear}: ${epsGrowthRaw!.toFixed(1)}%${epsGrowth.capped?` (bounded to ${epsGrowth.applied.toFixed(1)}%)`:""}`,"Classic Graham formula: normalized EPS × (8.5 + 2 × growth percentage); AAA-adjusted output is not used in the primary estimate"],fiscalPeriod:normalizedEpsRows.at(-1)!.fiscalYear,filedDate:normalizedEpsRows.map(year=>year.filedDate).filter((date):date is string=>Boolean(date)).sort().at(-1)??null,sourceUrl:normalizedEpsRows.at(-1)!.sources.epsDiluted?.sourceUrl??null};
      if(epsGrowth.capped)qualityNotes.push(`Historical diluted-EPS CAGR was bounded from ${epsGrowth.raw.toFixed(1)}% to ${epsGrowth.applied.toFixed(1)}% in the Graham family.`);
    }
  }

  methods.push(dcfMethod!,earningsMethod!);
  const dividendMethod:ValuationMethodResult=asset.dividendYield===0
    ?{...methodPending("ddm","Dividend discount","dividend","Current snapshot reports a zero dividend yield; DDM is not applicable."),status:"NOT_APPLICABLE"}
    :methodPending("ddm","Dividend discount","dividend",asset.dividendYield!==null&&asset.dividendYield>0?"A positive snapshot yield exists, but the annual dividend-per-share history and sustainability checks are not in the imported SEC facts.":"Dividend-per-share history and sustainability are not yet mapped.");
  const peersMethod=methodPending("peers","Trading comparables","trading_comps","A dated and validated industry-mapped peer multiple dataset is not yet connected; sector labels in the current Sheets snapshot are not sufficient evidence.");
  methods.push(dividendMethod,peersMethod);

  const available=methods.filter(method=>method.status==="AVAILABLE"&&method.value!==null&&method.quality!==null);
  const familyValues=available.map(method=>method.value!);
  const eligibleFamilies=new Set(available.map(method=>method.family)).size;
  const simpleMean=familyValues.length?familyValues.reduce((total,value)=>total+value,0)/familyValues.length:null;
  const sortedFamilies=familyValues.slice().sort((a,b)=>a-b);
  const familyMedian=median(familyValues);
  const familyRange=sortedFamilies.length?{low:sortedFamilies[0],high:sortedFamilies.at(-1)!}:null;
  let intrinsicValue:number|null=null;
  if(eligibleFamilies>=requiredFamilies){
    const uniqueByFamily=new Map<ValuationFamily,ValuationMethodResult>();
    for(const method of available){
      const prior=uniqueByFamily.get(method.family);
      if(!prior||((method.quality??0)>(prior.quality??0)))uniqueByFamily.set(method.family,method);
    }
    const eligible=[...uniqueByFamily.values()];
    const rawWeights=eligible.map(method=>Math.max(0.01,method.quality??0.5));
    const total=rawWeights.reduce((sum,weight)=>sum+weight,0);
    const weights=rawWeights.map(weight=>Math.min(0.65,weight/total));
    const normalizer=weights.reduce((sum,weight)=>sum+weight,0);
    intrinsicValue=eligible.reduce((sum,method,index)=>sum+method.value!*weights[index]/normalizer,0);
    if(familyRange&&familyRange.high>0){
      const spread=(familyRange.high-familyRange.low)/intrinsicValue;
      qualityNotes.push(spread>0.5?"The two valuation families diverge by more than 50% of the composite; the result is preliminary and low confidence.":spread>0.25?"Method estimates diverge materially; treat the composite as preliminary.":"The two eligible valuation families are reasonably close, but this is not a statistical confidence interval.");
    }
  }
  const methodSpread=intrinsicValue!==null&&familyRange?(familyRange.high-familyRange.low)/Math.max(intrinsicValue,0.01):null;
  const confidence=intrinsicValue===null?"INSUFFICIENT":methodSpread!==null&&methodSpread<0.25?"PRELIMINARY":"LOW";
  const buyUnder=intrinsicValue===null?null:intrinsicValue*(1-marginOfSafety/100);
  const parsedPriceDate=asset.priceDate?Date.parse(`${asset.priceDate}T00:00:00Z`):NaN;
  const priceAgeDays=Number.isFinite(parsedPriceDate)?Math.max(0,Math.floor((Date.now()-parsedPriceDate)/86_400_000)):null;
  let comparisonReason:string|null=null;
  if(intrinsicValue===null)comparisonReason=`At least ${requiredFamilies} eligible independent valuation families are required.`;
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
    status:intrinsicValue===null?"PENDING":"TRIANGULATED",
    confidence,
    eligibleFamilies,
    familyCountRequired:requiredFamilies,
    simpleMean:eligibleFamilies>=requiredFamilies?simpleMean:null,
    median:eligibleFamilies>=requiredFamilies?familyMedian:null,
    familyRange:eligibleFamilies>=requiredFamilies?familyRange:null,
    dcfHorizonRange,
    source:"Google Sheets SEC_Raw · verified annual SEC facts + shared family-balanced model",
    sourceAsOf,
    importedAt:googleSheetsSecFinancialsMetadata.sourceImportedAt,
    profileBasis:profile.basis,
    profileEligible:profile.eligible,
    qualityNotes:[...new Set(qualityNotes)],
    methods,
  };
}
