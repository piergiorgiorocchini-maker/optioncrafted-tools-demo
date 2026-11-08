/* Shared SEC annual bridge. USD amounts, fiscal years only; no simulated data. */
import audit from "../../reports/fdve-cluster-v2.json";
import appleResearch from "./aaplResearch.json";
type Fact={status:string;value?:number;periodEnd?:string};
type Year={metrics:Record<string,Fact>};
type Company={ticker:string;profile:string;years:Record<string,Year>};
const companies=audit.companies as unknown as Company[];
/** Validated business-profile classification is currently limited to the 20-company pilot. */
export function verifiedFinancialProfile(ticker:string):string|null{
 return companies.find(company=>company.ticker===ticker)?.profile??null;
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
  "2024":{value:82999000000,periodEnd:"2024-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm",note:"10-K gross cash purchases of property and equipment; the company-reported FCF measure nets sale proceeds and incentives."},
  "2025":{value:131819000000,periodEnd:"2025-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm",note:"10-K gross cash purchases of property and equipment; the company-reported FCF measure nets sale proceeds and incentives."}
 },
 CVX:{
  "2024":{value:16448000000,periodEnd:"2024-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/93410/000009341026000078/cvx-20251231.htm",note:"10-K consolidated capital expenditures reported by Chevron."},
  "2025":{value:17347000000,periodEnd:"2025-12-31",sourceUrl:"https://www.sec.gov/Archives/edgar/data/93410/000009341026000078/cvx-20251231.htm",note:"10-K consolidated capital expenditures reported by Chevron."}
 }
};
export type FinancialYear={year:string;periodEnd:string;revenue:number|null;fcf:number|null;fcfSource:"SEC companyfacts"|"issuer 10-K recovery"|null;fcfSourceUrl:string|null;fcfNote:string|null;eps:number|null;netIncome:number|null;operatingIncome:number|null};
export function verifiedAnnualHistory(ticker:string):FinancialYear[]{
 const c=companies.find(x=>x.ticker===ticker);
 if(!c)return [];
 return Object.entries(c.years).sort(([a],[b])=>a.localeCompare(b)).map(([year,record])=>{
  const m=record.metrics,cfo=value(m,"cashFromOperations");
  const reportedCapex=value(m,"capex");
  const recovery=reportedCapex===null?issuerFilingCapex[ticker]?.[year]:undefined;
  const periodEnd=m.cashFromOperations?.periodEnd||m.revenue?.periodEnd||m.totalAssets?.periodEnd||"";
  const validRecovery=recovery&&recovery.periodEnd===periodEnd?recovery:null;
  const capex=reportedCapex??validRecovery?.value??null;
  return {year,periodEnd,revenue:value(m,"revenue"),fcf:cfo!==null&&capex!==null?cfo-capex:null,
   fcfSource:cfo===null||capex===null?null:validRecovery?"issuer 10-K recovery":"SEC companyfacts",
   fcfSourceUrl:validRecovery?.sourceUrl??null,fcfNote:validRecovery?.note??null,
   eps:value(m,"epsDiluted"),netIncome:value(m,"netIncome"),operatingIncome:value(m,"operatingIncome")};
 });
}
export type VerifiedFcf={perShare:number|null;annualUsd:number|null;periodEnd:string|null;basis:string;warning:string;sourceUrl:string|null};
export function verifiedFcf(ticker:string):VerifiedFcf{
 if(ticker==="AAPL")return {perShare:appleResearch.fcfPerShare,annualUsd:null,periodEnd:appleResearch.fundamentalsAsOf,basis:"SEC reconstructed TTM",warning:"Approximate TTM FCF per outstanding share; not diluted weighted-average FCF/share.",sourceUrl:appleResearch.sourceUrls[1]??appleResearch.sourceUrls[0]??null};
 const rows=verifiedAnnualHistory(ticker),latest=rows.at(-1);
 if(!latest||latest.fcf===null)return {perShare:null,annualUsd:null,periodEnd:latest?.periodEnd??null,basis:"SEC annual",warning:"Annual FCF unavailable.",sourceUrl:latest?.fcfSourceUrl??null};
 const annualUsd=latest.fcf,periodEnd=latest.periodEnd||null;
 const capexNote=latest.fcfNote?(" CapEx source: "+latest.fcfNote):"";
 if(latest.netIncome===null||latest.netIncome<=0||latest.eps===null||latest.eps<=0){
  return {perShare:null,annualUsd,periodEnd,basis:"SEC annual FY"+latest.year,warning:"FCF/share estimate unavailable: same-year positive net income and diluted EPS are both required to infer shares."+capexNote,sourceUrl:latest.fcfSourceUrl};
 }
 const perShare=annualUsd*latest.eps/latest.netIncome;
 if(!Number.isFinite(perShare))return {perShare:null,annualUsd,periodEnd,basis:"SEC annual FY"+latest.year,warning:"FCF/share estimate unavailable: derived value is not finite."+capexNote,sourceUrl:latest.fcfSourceUrl};
 const recoveredCapex=latest.fcfSource==="issuer 10-K recovery"?" · 10-K CapEx recovery":"";
 return {perShare,annualUsd,periodEnd,basis:"SEC annual FY"+latest.year+recoveredCapex+" · derived estimate",
  warning:"Estimated FCF/share = annual SEC FCF × same-year diluted EPS ÷ net income. Shares are implied from GAAP net income/EPS, not separately reported; use as a screening input, not a precise diluted-share calculation."+capexNote,
  sourceUrl:latest.fcfSourceUrl};
}
