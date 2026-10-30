import audit from "../../reports/fdve-cluster-v2.json";
import type {FundamentalInputs} from "../core/fundamentalMetrics";
type Fact={status:string;value?:number;unit?:string;periodEnd?:string};
type Year={metrics:Record<string,Fact>};
type Company={ticker:string;profile:string;years:Record<string,Year>};
const companies=audit.companies as unknown as Company[];
const val=(m:Record<string,Fact>,k:string)=>["AVAILABLE","DERIVED"].includes(m[k]?.status)&&Number.isFinite(m[k]?.value)?m[k].value!:null;
export function getSecFinancialInputs(ticker:string,year="2025"):Partial<FundamentalInputs>&{periodEnd?:string;profile?:string;source?:string;fcfAnnual?:number|null}{
 const c=companies.find(c=>c.ticker===ticker),m=c?.years[year]?.metrics;
 if(!c||!m)return {};
 const revenue=m.revenue?.periodEnd||m.totalAssets?.periodEnd;
 if(c.profile==="bank")return {profile:"bank",periodEnd:revenue,source:"SEC 10-K"};
 const debtLong=val(m,"longTermDebt"),debtShort=val(m,"shortTermDebt");
 // SEC shortTermDebt is current portion of long-term debt only, not all current borrowings.
 const totalDebt=debtLong!==null&&debtShort!==null?debtLong+debtShort:null;
 const cfo=val(m,"cashFromOperations"),capex=val(m,"capex");
 const fcfAnnual=cfo!==null&&capex!==null?cfo-capex:null;
 return {profile:c.profile,periodEnd:revenue,source:"SEC 10-K",cash:val(m,"cash"),
 currentAssets:val(m,"currentAssets"),currentLiabilities:val(m,"currentLiabilities"),
 inventory:val(m,"inventory"),equity:val(m,"equity"),totalDebt,freeCashFlow:fcfAnnual,fcfAnnual};
}
