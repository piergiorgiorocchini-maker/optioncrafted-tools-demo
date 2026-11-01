/* Shared SEC annual bridge. USD amounts, fiscal years only; no simulated data. */
import audit from "../../reports/fdve-cluster-v2.json";
import appleResearch from "./aaplResearch.json";
type Fact={status:string;value?:number;periodEnd?:string};
type Year={metrics:Record<string,Fact>};
type Company={ticker:string;profile:string;years:Record<string,Year>};
const companies=audit.companies as unknown as Company[];
const value=(m:Record<string,Fact>,key:string):number|null=>{
 const f=m[key];return f&&["AVAILABLE","DERIVED"].includes(f.status)&&typeof f.value==="number"&&Number.isFinite(f.value)?f.value:null;
};
export type FinancialYear={year:string;periodEnd:string;revenue:number|null;fcf:number|null;eps:number|null;netIncome:number|null;operatingIncome:number|null};
export function verifiedAnnualHistory(ticker:string):FinancialYear[]{
 const c=companies.find(x=>x.ticker===ticker);
 if(!c)return [];
 return Object.entries(c.years).sort(([a],[b])=>a.localeCompare(b)).map(([year,record])=>{
  const m=record.metrics,cfo=value(m,"cashFromOperations"),capex=value(m,"capex");
  return {year,periodEnd:m.revenue?.periodEnd||m.totalAssets?.periodEnd||"",revenue:value(m,"revenue"),fcf:cfo!==null&&capex!==null?cfo-capex:null,eps:value(m,"epsDiluted"),netIncome:value(m,"netIncome"),operatingIncome:value(m,"operatingIncome")};
 });
}
export type VerifiedFcf={perShare:number|null;annualUsd:number|null;periodEnd:string|null;basis:string;warning:string};
export function verifiedFcf(ticker:string):VerifiedFcf{
 if(ticker==="AAPL")return {perShare:appleResearch.fcfPerShare,annualUsd:null,periodEnd:appleResearch.fundamentalsAsOf,basis:"SEC reconstructed TTM",warning:"Approximate TTM FCF per outstanding share; not diluted weighted-average FCF/share."};
 const rows=verifiedAnnualHistory(ticker),latest=rows.at(-1);
 if(!latest||latest.fcf===null)return {perShare:null,annualUsd:null,periodEnd:latest?.periodEnd??null,basis:"SEC annual",warning:"Annual FCF unavailable."};
 // Use same-fiscal-year SEC net income and diluted EPS to infer a proxy share count.
 // Keep the bridge explicit: net income / diluted EPS is an implied denominator, not a separately reported share-count fact.
 const annualUsd=latest.fcf,periodEnd=latest.periodEnd||null;
 if(latest.netIncome===null||latest.netIncome<=0||latest.eps===null||latest.eps<=0){
  return {perShare:null,annualUsd,periodEnd,basis:"SEC annual FY"+latest.year,warning:"FCF/share estimate unavailable: same-year positive net income and diluted EPS are both required to infer shares."};
 }
 const perShare=annualUsd*latest.eps/latest.netIncome;
 if(!Number.isFinite(perShare))return {perShare:null,annualUsd,periodEnd,basis:"SEC annual FY"+latest.year,warning:"FCF/share estimate unavailable: derived value is not finite."};
 return {perShare,annualUsd,periodEnd,basis:"SEC annual FY"+latest.year+" · derived estimate",warning:"Estimated FCF/share = annual SEC FCF × same-year diluted EPS ÷ net income. Shares are implied from GAAP net income/EPS, not separately reported; use as a screening input, not a precise diluted-share calculation."};
}
