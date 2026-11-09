/* Shared SEC annual adapter. Annual financial values retain issuer reporting currency and fiscal period. */
import audit from "../../reports/fdve-cluster-v2.json";
import appleResearch from "./aaplResearch.json";
import adminCoverage from "./adminCoverageSnapshot.json";
import {googleSheetsSecAnnualHistory,type SecAnnualFinancialYear} from "./googleSheetsSecFinancials";

type Fact={status:string;value?:number;periodEnd?:string};
type Year={metrics:Record<string,Fact>};
type Company={ticker:string;profile:string;years:Record<string,Year>};
type CoverageTicker={ticker:string;instrumentType?:string;valuationProfile?:string};
const companies=audit.companies as unknown as Company[];
const classified=(adminCoverage as unknown as {tickers:CoverageTicker[]}).tickers;
const financialProfiles=new Set(["BANK","CONSUMER_FINANCE","BROKERAGE","FINANCIAL_MARKET_INFRASTRUCTURE","INSURANCE"]);
const tickerClassification=(ticker:string)=>classified.find(company=>company.ticker.toUpperCase()===ticker.trim().toUpperCase());
const isFundOrIndex=(ticker:string)=>{
 const entry=tickerClassification(ticker),type=String(entry?.instrumentType||"").toUpperCase(),profile=String(entry?.valuationProfile||"").toUpperCase();
 return ["ETF","INDEX"].includes(type)||/ETF|INDEX/.test(profile);
};
const isFinancial=(ticker:string)=>financialProfiles.has(String(tickerClassification(ticker)?.valuationProfile||"").toUpperCase());
const isReitOrMlp=(ticker:string)=>/REIT|MLP/.test(String(tickerClassification(ticker)?.valuationProfile||"").toUpperCase());

export function verifiedFinancialProfile(ticker:string):string|null{
 const symbol=ticker.trim().toUpperCase();
 return classified.find(company=>company.ticker.toUpperCase()===symbol)?.valuationProfile??companies.find(company=>company.ticker===symbol)?.profile??null;
}
const value=(m:Record<string,Fact>,key:string):number|null=>{
 const f=m[key];return f&&["AVAILABLE","DERIVED"].includes(f.status)&&typeof f.value==="number"&&Number.isFinite(f.value)?f.value:null;
};
type FilingCapexRecovery={value:number;periodEnd:string;sourceUrl:string;note:string};
const issuerFilingCapex:Record<string,Record<string,FilingCapexRecovery>>={
 NVDA:{
  "2024":{value:1069000000,periodEnd:"2024-01-28",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm",note:"10-K cash purchases related to property, equipment and intangible assets."},
  "2025":{value:3236000000,periodEnd:"2025-01-26",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm",note:"10-K cash purchases related to property, equipment and intangible assets."}
 },
 AMZN:{
  "2024":{value:82999000000,periodEnd:"2024-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm",note:"10-K gross cash purchases of property and equipment; company-reported FCF also reflects sale proceeds and incentives."},
  "2025":{value:131819000000,periodEnd:"2025-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm",note:"10-K gross cash purchases of property and equipment; company-reported FCF also reflects sale proceeds and incentives."}
 },
 CVX:{
  "2024":{value:16448000000,periodEnd:"2024-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/93410/000009341026000078/cvx-20251231.htm",note:"10-K consolidated capital expenditures reported by Chevron."},
  "2025":{value:17347000000,periodEnd:"2025-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/93410/000009341026000078/cvx-20251231.htm",note:"10-K consolidated capital expenditures reported by Chevron."}
 }
};
export type FinancialYear={
 year:string;currency:string;periodStart:string;periodEnd:string;
 revenue:number|null;grossProfit:number|null;netIncome:number|null;operatingIncome:number|null;
 cashFromOperations:number|null;capex:number|null;fcf:number|null;fcfPerShare:number|null;
 eps:number|null;dilutedShares:number|null;shareCountSource:string|null;
 freeCashFlowSource:"SEC companyfacts"|"issuer 10-K recovery"|null;fcfSourceUrl:string|null;fcfNote:string|null;
 depreciationAndAmortization:number|null;ebitda:number|null;interestExpense:number|null;
 cash:number|null;currentAssets:number|null;currentLiabilities:number|null;currentRatio:number|null;inventory:number|null;
 totalAssets:number|null;totalLiabilities:number|null;equity:number|null;totalDebt:number|null;netDebt:number|null;debtEquity:number|null;
 netDebtEbitda:number|null;interestCoverage:number|null;grossMargin:number|null;operatingMargin:number|null;netMargin:number|null;
 roe:number|null;roic:number|null;revenueCagr3y:number|null;revenueCagr5y:number|null;epsCagr3y:number|null;epsCagr5y:number|null;
 fcfCagr5y:number|null;normalizedEps5y:number|null;yearEndClose:number|null;historicalPe:number|null;historicalPeSource:string|null;
};
const annualRow=(r:SecAnnualFinancialYear,ticker:string):FinancialYear=>{
 const recovery=r.currency==="USD"&&r.capex===null?issuerFilingCapex[ticker]?.[r.fiscalYear]:undefined;
 const recoveryValid=recovery&&recovery.periodEnd===r.periodEnd?recovery:null;
 const capex=r.capex??recoveryValid?.value??null;
 const fcf=r.freeCashFlow??(r.cashFromOperations!==null&&capex!==null?r.cashFromOperations-capex:null);
 const shares=r.dilutedShares&&r.dilutedShares>0?r.dilutedShares:r.impliedShares;
 const fcfPerShare=r.freeCashFlowPerShare??(fcf!==null&&shares!==null&&shares>0?fcf/shares:null);
 const capexSource=r.sources.capex?.sourceUrl??null;
 const cfoSource=r.sources.cashFromOperations?.sourceUrl??null;
 return {
  year:r.fiscalYear,currency:r.currency,periodStart:r.periodStart,periodEnd:r.periodEnd,revenue:r.revenue,grossProfit:r.grossProfit,
  netIncome:r.netIncome,operatingIncome:r.operatingIncome,cashFromOperations:r.cashFromOperations,capex,fcf,fcfPerShare,
  eps:r.dilutedEps,dilutedShares:shares,shareCountSource:r.shareCountSource,freeCashFlowSource:fcf===null?null:recoveryValid?"issuer 10-K recovery":"SEC companyfacts",
  fcfSourceUrl:recoveryValid?.sourceUrl??capexSource??cfoSource,fcfNote:recoveryValid?.note??null,
  depreciationAndAmortization:r.depreciationAndAmortization,ebitda:r.ebitda,interestExpense:r.interestExpense,
  cash:r.cash,currentAssets:r.currentAssets,currentLiabilities:r.currentLiabilities,currentRatio:r.currentRatio,inventory:r.inventory,
  totalAssets:r.totalAssets,totalLiabilities:r.totalLiabilities,equity:r.equity,totalDebt:r.totalDebt,netDebt:r.netDebt,
  debtEquity:r.debtEquity,netDebtEbitda:r.netDebtEbitda,interestCoverage:r.interestCoverage,grossMargin:r.grossMargin,
  operatingMargin:r.operatingMargin,netMargin:r.netMargin,roe:r.roe,roic:r.roic,revenueCagr3y:r.revenueCagr3y,
  revenueCagr5y:r.revenueCagr5y,epsCagr3y:r.epsCagr3y,epsCagr5y:r.epsCagr5y,fcfCagr5y:r.fcfCagr5y,
  normalizedEps5y:r.normalizedEps5y,yearEndClose:r.yearEndClose,historicalPe:r.historicalPe,historicalPeSource:r.historicalPeSource
 };
};
const legacyHistory=(ticker:string):FinancialYear[]=>{
 const c=companies.find(x=>x.ticker===ticker.trim().toUpperCase());
 if(!c)return [];
 return Object.entries(c.years).sort(([a],[b])=>a.localeCompare(b)).map(([year,record])=>{
  const m=record.metrics,cfo=value(m,"cashFromOperations"),reportedCapex=value(m,"capex");
  const recovery=reportedCapex===null?issuerFilingCapex[ticker]?.[year]:undefined;
  const periodEnd=m.cashFromOperations?.periodEnd||m.revenue?.periodEnd||m.totalAssets?.periodEnd||"";
  const validRecovery=recovery&&recovery.periodEnd===periodEnd?recovery:null;
  const capex=reportedCapex??validRecovery?.value??null;
  const fcf=cfo!==null&&capex!==null?cfo-capex:null;
  const eps=value(m,"epsDiluted"),netIncome=value(m,"netIncome");
  const fcfPerShare=fcf!==null&&eps!==null&&netIncome!==null&&netIncome>0&&eps>0?fcf*eps/netIncome:null;
  return {year,currency:"USD",periodStart:"",periodEnd,revenue:value(m,"revenue"),grossProfit:null,netIncome,
   operatingIncome:value(m,"operatingIncome"),cashFromOperations:cfo,capex,fcf,fcfPerShare,eps,dilutedShares:null,
   shareCountSource:fcfPerShare!==null?"implied from same-year net income / diluted EPS":null,
   freeCashFlowSource:fcf===null?null:validRecovery?"issuer 10-K recovery":"SEC companyfacts",fcfSourceUrl:validRecovery?.sourceUrl??null,fcfNote:validRecovery?.note??null,
   depreciationAndAmortization:null,ebitda:null,interestExpense:null,cash:value(m,"cash"),currentAssets:value(m,"currentAssets"),
   currentLiabilities:value(m,"currentLiabilities"),currentRatio:null,inventory:value(m,"inventory"),totalAssets:value(m,"totalAssets"),
   totalLiabilities:null,equity:value(m,"equity"),totalDebt:null,netDebt:null,debtEquity:null,netDebtEbitda:null,interestCoverage:null,
   grossMargin:null,operatingMargin:null,netMargin:null,roe:null,roic:null,revenueCagr3y:null,revenueCagr5y:null,epsCagr3y:null,
   epsCagr5y:null,fcfCagr5y:null,normalizedEps5y:null,yearEndClose:null,historicalPe:null,historicalPeSource:null};
 });
};
export function verifiedAnnualHistory(ticker:string,currency?:string):FinancialYear[]{
 const symbol=ticker.trim().toUpperCase();
 if(isFundOrIndex(symbol))return [];
 const rows=googleSheetsSecAnnualHistory(symbol,currency).map(row=>annualRow(row,symbol));
 if(rows.length)return rows;
 if(!currency||currency.trim().toUpperCase()==="USD")return legacyHistory(symbol);
 return [];
}
export type VerifiedFcf={perShare:number|null;annualAmount:number|null;currency:string|null;periodEnd:string|null;basis:string;warning:string;sourceUrl:string|null};
export function verifiedFcf(ticker:string,currency?:string):VerifiedFcf{
 const symbol=ticker.trim().toUpperCase(),requested=currency?.trim().toUpperCase();
 if(isFundOrIndex(symbol)||isFinancial(symbol)||isReitOrMlp(symbol))return {perShare:null,annualAmount:null,currency:null,periodEnd:null,basis:"Not applicable",warning:"Industrial FCF/share is not applicable to this instrument or financial profile.",sourceUrl:null};
 if(symbol==="AAPL"&&(!requested||requested==="USD"))return {
  perShare:appleResearch.fcfPerShare,annualAmount:null,currency:"USD",periodEnd:appleResearch.fundamentalsAsOf,
  basis:"SEC reconstructed TTM",warning:"Approximate TTM FCF per outstanding share; not diluted weighted-average FCF/share.",
  sourceUrl:appleResearch.sourceUrls[1]??appleResearch.sourceUrls[0]??null
 };
 const rows=verifiedAnnualHistory(symbol,requested),latest=rows.at(-1);
 if(!latest||latest.fcf===null)return {perShare:null,annualAmount:null,currency:latest?.currency??null,periodEnd:latest?.periodEnd??null,basis:"SEC annual",warning:"Annual FCF unavailable.",sourceUrl:latest?.fcfSourceUrl??null};
 const annualAmount=latest.fcf,periodEnd=latest.periodEnd||null;
 const capexNote=latest.fcfNote?(" CapEx source: "+latest.fcfNote):"";
 const perShare=latest.fcfPerShare;
 if(perShare===null)return {perShare:null,annualAmount,currency:latest.currency,periodEnd,basis:"SEC annual FY"+latest.year,warning:"Annual FCF is available, but a same-year diluted share count or EPS/net-income denominator is missing."+capexNote,sourceUrl:latest.fcfSourceUrl};
 const source=latest.shareCountSource||"SEC annual share data";
 const recoveredCapex=latest.freeCashFlowSource==="issuer 10-K recovery"?" · 10-K CapEx recovery":"";
 return {perShare,annualAmount,currency:latest.currency,periodEnd,basis:"SEC annual FY"+latest.year+recoveredCapex+" · "+source,
  warning:source.includes("implied")?"Estimated FCF/share uses annual FCF and an implied diluted share count from same-year net income/EPS; use as a screening input, not a precise diluted-share calculation."+capexNote:"Annual FCF/share uses SEC reported diluted shares for the fiscal year."+capexNote,
  sourceUrl:latest.fcfSourceUrl};
}
