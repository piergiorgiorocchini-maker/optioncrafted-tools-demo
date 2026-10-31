import {useState} from "react";
import audit from "../../reports/fdve-cluster-v2.json";
import avAudit from "../../reports/fdve-alpha-vantage-aapl.json";
import "./verifiedFundamentals.css";
type Fact={status:string;value?:number;unit?:string;periodEnd?:string;tag?:string;method?:string};
type Year={metrics:Record<string,Fact>;coverage:{applicable:number;available:number;rate:number}};
type Company={ticker:string;profile:string;sec:{status:string;source?:string};years:Record<string,Year>};
const companies=audit.companies as unknown as Company[];
const labels:Record<string,string>={
 revenue:"Revenue",netIncome:"Net income",operatingIncome:"Operating income",
 cashFromOperations:"Operating cash flow",capex:"Capital expenditure",epsDiluted:"Diluted EPS",
 cash:"Cash & equivalents",currentAssets:"Current assets",currentLiabilities:"Current liabilities",
 inventory:"Inventory",totalAssets:"Total assets",totalLiabilities:"Total liabilities",
 equity:"Shareholders' equity",longTermDebt:"Long-term debt",shortTermDebt:"Current portion of long-term debt"
};
const fmt=(f?:Fact)=>!f||!["AVAILABLE","DERIVED"].includes(f.status)||!Number.isFinite(f.value)? "N/D":f.unit==="USD/shares"?"$"+f.value!.toFixed(2):new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(f.value!/1e9);
export function VerifiedFundamentals({ticker}:{ticker:string}){
 const [year,setYear]=useState("2025");
 const item=companies.find(c=>c.ticker===ticker);
 if(!item)return null;
 const availableYears=Object.keys(item.years).sort((a,b)=>Number(b)-Number(a));
 const activeYear=availableYears.includes(year)?year:availableYears[0];
 const row=item.years[activeYear];
 if(!row)return null;
 const secLink=item.sec.source;
 const metrics=row.metrics;
 const avComparisons=ticker==="AAPL"?(avAudit.years as unknown as Record<string,{comparisons:Record<string,{status:string;deltaPct?:number}>}>)[activeYear]?.comparisons:null;
 const avCounts=avComparisons?Object.values(avComparisons).filter(c=>["MATCH","MATCH_DATE_NORMALIZED","ROUNDING","ROUNDING_DATE_NORMALIZED"].includes(c.status)).length:null;
 const isBank=item.profile==="bank";
 const display=Object.keys(labels).filter(k=>k in metrics);
 const first=metrics.revenue;
 return <section className="vf-panel" aria-label="SEC validated annual fundamentals">
  <div className="vf-top"><div><span className="vf-kicker">FDVE / FINANCIAL STATEMENTS</span><h3>Verified annual fundamentals</h3><p>SEC EDGAR · Fiscal year {activeYear} · {first?.periodEnd??"period end unavailable"} · {isBank?"Banking profile":"Industrial profile"}</p></div>
  <div className="vf-year">{availableYears.map(y=><button key={y} className={activeYear===y?"selected":""} type="button" onClick={()=>setYear(y)}>FY {y}</button>)}</div></div>
  <div className="vf-summary"><div><small>SEC coverage</small><strong>{row.coverage.available}/{row.coverage.applicable}</strong></div><div><small>Validated SEC facts</small><strong>{Math.round(row.coverage.rate*100)}%</strong></div><div><small>Cross-source verification</small><strong className="vf-muted">{avCounts===null?"Pending":avCounts+"/"+Object.keys(avComparisons||{}).length}</strong></div></div>
  <div className="vf-table-wrap"><table className="vf-table"><thead><tr><th>Metric</th><th>FY {activeYear}</th><th>Data status</th>{avComparisons&&<th>AV check</th>}</tr></thead><tbody>{display.map(k=>{const f=metrics[k];return <tr key={k}><td>{labels[k]}</td><td className="vf-number">{fmt(f)}{f?.unit==="USD/shares"?"":" "}</td><td><span className={f?.status==="AVAILABLE"?"vf-ok":f?.status==="DERIVED"?"vf-derived":"vf-missing"} title={f?.tag||f?.method||f?.status}>{f?.status==="AVAILABLE"?"SEC filed":f?.status==="DERIVED"?"Derived":"Missing / review"}</span></td>{avComparisons&&<td><span className={["MATCH","MATCH_DATE_NORMALIZED","ROUNDING","ROUNDING_DATE_NORMALIZED"].includes(avComparisons[k]?.status)?"vf-ok":"vf-missing"} title={avComparisons[k]?.status}>{avComparisons[k]?.status?.replaceAll("_"," ").toLowerCase()||"Pending"}</span></td>}</tr>})}</tbody></table></div>
  <div className="vf-foot"><span>Amounts in USD billions, except diluted EPS in USD/share. Annual 10-K; not TTM or live.</span>{secLink&&<a href={secLink} target="_blank" rel="noreferrer">SEC companyfacts ↗</a>}</div>
  <p className="vf-note">{ticker==="AAPL"?"AAPL cross-source comparison is a preliminary pilot. Month-end dates may be normalized and differences require review; SEC remains the primary record.":"Alpha Vantage reconciliation is not yet published for this ticker. Missing or derived fields are not independently verified."}</p>
 </section>;
}
