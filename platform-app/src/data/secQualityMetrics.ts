/* SEC FY-only company quality calculations. Never mix market snapshot EPS with annual cash flow. */
import audit from "../../reports/fdve-cluster-v2.json";
type Fact={status:string;value?:number;periodEnd?:string};
type Year={metrics:Record<string,Fact>};
type Company={ticker:string;profile:string;years:Record<string,Year>};
const companies=audit.companies as unknown as Company[];
const val=(m:Record<string,Fact>,k:string):number|null=>{const f=m[k];return f&&["AVAILABLE","DERIVED"].includes(f.status)&&Number.isFinite(f.value)?f.value!:null;};
const annual=(ticker:string,year:string)=>companies.find(c=>c.ticker===ticker)?.years[year]?.metrics;
export type QualityRatio={value:number|null;method:string;note:string;period:string};
const missing=(period:string,method:string,note:string):QualityRatio=>({value:null,method,note,period});
export function secCashConversion(ticker:string,year="2025"):QualityRatio{
 const m=annual(ticker,year);if(!m)return missing(year,"SEC FY","No matched SEC fiscal-year data");
 const cfo=val(m,"cashFromOperations"),capex=val(m,"capex"),net=val(m,"netIncome");
 if(cfo===null||capex===null||net===null||net<=0)return missing(year,"FCF / net income","Requires annual CFO, capital expenditures and positive parent net income");
 return {value:100*(cfo-capex)/net,method:"(SEC CFO - SEC capex) / SEC net income",note:"Same-fiscal-year FCF-to-net-income conversion. Equivalent to FCF/share divided by EPS only with identical diluted share denominators; this is not calculated using snapshot EPS.",period:year};
}
export function secRoicEstimate(ticker:string,year="2025",assumedTaxRate=0.21):QualityRatio{
 const m=annual(ticker,year),previous=annual(ticker,String(Number(year)-1));
 if(!m||!previous)return missing(year,"NOPAT / average invested capital","Requires two adjacent annual balance sheets");
 if(!Number.isFinite(assumedTaxRate)||assumedTaxRate<0||assumedTaxRate>=1)return missing(year,"NOPAT / average invested capital","Invalid assumed tax rate");
 const op=val(m,"operatingIncome");
 const capital=(x:Record<string,Fact>)=>{
  const equity=val(x,"equity"),long=val(x,"longTermDebt"),short=val(x,"shortTermDebt"),cash=val(x,"cash");
  return equity!==null&&long!==null&&short!==null&&cash!==null?equity+long+short-cash:null;
 };
 const current=capital(m),prior=capital(previous);
 if(op===null||current===null||prior===null||current<=0||prior<=0)return missing(year,"NOPAT / average invested capital","Operating income or consistent equity, debt and cash unavailable for both years");
 const avg=(current+prior)/2;
 return {value:100*op*(1-assumedTaxRate)/avg,method:"SEC operating income × (1 - assumed tax) / average (equity + debt - cash)",note:"Estimated ROIC, NOT a verified reported ratio. Assumes a 21% tax rate and invested capital = parent equity + long-term debt including current maturities - cash; other financing and excess-cash adjustments are not verified. Compare cautiously across issuers.",period:year};
}
