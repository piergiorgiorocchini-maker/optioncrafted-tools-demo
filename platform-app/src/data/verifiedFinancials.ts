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
 // Never infer a diluted share count from a market snapshot or EPS from a different fiscal period.
 return {perShare:null,annualUsd:latest.fcf,periodEnd:latest.periodEnd,basis:"SEC annual",warning:"FCF/share requires fiscal-period-matched diluted shares; market snapshot EPS is not a substitute."};
}
