import {useMemo,useState} from "react";
import {NavLink} from "react-router-dom";
import audit from "../../reports/fdve-cluster-v2.json";
import summary from "../../reports/fdve-cluster-summary.json";
import "./fdveResearch.css";

type Fact={status:string;value?:number;unit?:string;periodEnd?:string;tag?:string;method?:string};
type Year={metrics:Record<string,Fact>;coverage:{applicable:number;available:number;rate:number}};
type Company={ticker:string;profile:string;sec:{status:string;source?:string};years:Record<string,Year>};
const companies=audit.companies as unknown as Company[];
const fact=(m:Record<string,Fact>,key:string)=>{const f=m[key];return f&&["AVAILABLE","DERIVED"].includes(f.status)&&Number.isFinite(f.value)?f.value!:null;};
const usd=(v:number|null)=>v===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(v);
const pct=(n:number)=>Number.isFinite(n)?n.toFixed(1)+"%":"N/D";
export function FDVEResearch({ticker,onSelect,compact=false}:{ticker?:string;onSelect?:(ticker:string)=>void;compact?:boolean}){
 const [year,setYear]=useState("2025");
 const [filter,setFilter]=useState("");
 const selected=companies.find(c=>c.ticker===ticker);
 const rows=useMemo(()=>companies.filter(c=>c.ticker.toLowerCase().includes(filter.trim().toLowerCase())),[filter]);
 const s=summary.statisticalBreakdown;
 const dep=summary.dependencyAudit.summary;
 const companyYear=selected?.years[year];
 const m=companyYear?.metrics;
 const cfo=m?fact(m,"cashFromOperations"):null,capex=m?fact(m,"capex"):null;
 const fcf=cfo!==null&&capex!==null?cfo-capex:null;
 const operating=m?fact(m,"operatingIncome"):null,revenue=m?fact(m,"revenue"):null;
 const operatingMargin=operating!==null&&revenue!==null&&revenue>0?100*operating/revenue:null;
 return <section className="fdve-panel" aria-label="FDVE validated SEC research">
  <div className="fdve-head"><div><span className="overline">FDVE / SEC 10-K RESEARCH DATA</span><h3>{compact?"20-company fundamentals feed":"Verified financial research universe"}</h3><p>Source: SEC companyfacts · FY2024–FY2025 · snapshot {new Date(audit.generatedAt).toLocaleDateString("en-GB")} · not live</p></div><a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noreferrer">SEC EDGAR ↗</a></div>
  <div className="fdve-stats">
   <div><small>SEC direct</small><strong>{s.direct}</strong></div>
   <div><small>Derived, labeled</small><strong>{s.derived}</strong></div>
   <div><small>Missing</small><strong>{s.missing}</strong></div>
   <div><small>Combined coverage</small><strong>{pct(s.assistedCoveragePct)}</strong></div>
   <div><small>Accounting readiness</small><strong>{pct(dep.accountingOnly.readinessPct)}</strong></div>
  </div>
  <p className="fdve-disclaimer">Coverage includes labeled accounting derivations. The SEC-only quality gate does not establish independent provider reconciliation. Historical market caps and market-dependent ratios remain unavailable until dated sources are verified.</p>
  {!compact&&<><label className="fdve-filter">Filter SEC cohort <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Ticker"/></label><div className="fdve-cohort">{rows.map(c=><button type="button" key={c.ticker} className={ticker===c.ticker?"active":""} onClick={()=>onSelect?.(c.ticker)} disabled={!onSelect} title={"View SEC fundamentals for "+c.ticker}>{c.ticker}<small>{pct((c.years["2025"]?.coverage.rate??0)*100)}</small></button>)}</div></>}
  {selected&&companyYear&&<div className="fdve-detail"><div className="fdve-detail-top"><div><b>{selected.ticker}</b> · {selected.profile==="bank"?"Banking profile":"Industrial profile"} · {companyYear.coverage.available}/{companyYear.coverage.applicable} facts</div><div>{["2025","2024"].map(y=><button type="button" key={y} onClick={()=>setYear(y)} className={year===y?"active":""}>FY {y}</button>)}</div></div><div className="fdve-financial-grid"><div><small>Revenue</small><strong>{usd(revenue)}</strong></div><div><small>Net income</small><strong>{usd(m?fact(m,"netIncome"):null)}</strong></div><div><small>Operating income</small><strong>{usd(operating)}</strong></div><div><small>Operating margin</small><strong>{operatingMargin===null?"N/D":pct(operatingMargin)}</strong></div><div><small>Operating cash flow</small><strong>{usd(cfo)}</strong></div><div><small>Capital expenditure</small><strong>{usd(capex)}</strong></div><div><small>FCF = CFO − capex</small><strong>{usd(fcf)}</strong></div><div><small>Shareholders' equity</small><strong>{usd(m?fact(m,"equity"):null)}</strong></div></div><p className="fdve-disclaimer">FCF is a same-fiscal-year USD total, not per share. N/D means missing or not applicable; no estimates are inserted. Source classifications and individual SEC tags are available in Company Intelligence.</p>{selected.sec.source&&<a href={selected.sec.source} target="_blank" rel="noreferrer">Companyfacts source ↗</a>}{!compact&&<NavLink to="/company"> Open detailed statements →</NavLink>}</div>}
  {!selected&&compact&&<NavLink to="/company">Explore validated company fundamentals →</NavLink>}
 </section>;
}
