import {useState} from "react";
import {BookOpen,ChevronDown,ExternalLink,FileText,Info,Scale,ShieldAlert,Target} from "lucide-react";
import type {Security} from "../core/contracts";
import "./intelligence.css";
type Peer={symbol:string;company:string;sector:string;ev:number;ebitda:number;revenue:number;earnings:number;marketCap:number;roic:number;growth:number;netDebt:number};
type Filing={form:string;date:string;title:string;summary:string;signals:{label:string;detail:string;kind:"neutral"|"risk"|"good"}[]};
const model:Record<string,{filings:Filing[];peers:Peer[];target:Peer}>={
 DEMO:{target:{symbol:"DEMO",company:"Illustrative Dividend Company",sector:"Industrials",ev:645,ebitda:54,revenue:310,earnings:26,marketCap:610,roic:16.2,growth:5,netDebt:35},peers:[
 {symbol:"IND-A",company:"Model Industrial Alpha",sector:"Industrials",ev:980,ebitda:83,revenue:460,earnings:44,marketCap:880,roic:18,growth:7,netDebt:100},
 {symbol:"IND-B",company:"Model Industrial Beta",sector:"Industrials",ev:1200,ebitda:92,revenue:510,earnings:40,marketCap:1060,roic:13,growth:4,netDebt:140},
 {symbol:"IND-C",company:"Model Industrial Gamma",sector:"Industrials",ev:770,ebitda:70,revenue:350,earnings:30,marketCap:700,roic:19,growth:6,netDebt:70}]},
 ALPHA:{target:{symbol:"ALPHA",company:"Illustrative Quality Business",sector:"Technology",ev:1530,ebitda:103,revenue:520,earnings:68,marketCap:1450,roic:22.3,growth:13,netDebt:80},peers:[
 {symbol:"TECH-A",company:"Model Software Alpha",sector:"Technology",ev:1800,ebitda:110,revenue:610,earnings:70,marketCap:1740,roic:25,growth:15,netDebt:60},
 {symbol:"TECH-B",company:"Model Software Beta",sector:"Technology",ev:1320,ebitda:90,revenue:490,earnings:60,marketCap:1200,roic:20,growth:11,netDebt:120},
 {symbol:"TECH-C",company:"Model Software Gamma",sector:"Technology",ev:2100,ebitda:125,revenue:720,earnings:84,marketCap:2010,roic:28,growth:17,netDebt:90}]},
 BETA:{target:{symbol:"BETA",company:"Illustrative Defensive Business",sector:"Consumer Staples",ev:850,ebitda:86,revenue:590,earnings:42,marketCap:780,roic:12.4,growth:3,netDebt:70},peers:[
 {symbol:"STPL-A",company:"Model Staples Alpha",sector:"Consumer Staples",ev:960,ebitda:94,revenue:640,earnings:46,marketCap:880,roic:14,growth:4,netDebt:80},
 {symbol:"STPL-B",company:"Model Staples Beta",sector:"Consumer Staples",ev:1150,ebitda:110,revenue:770,earnings:57,marketCap:1030,roic:11,growth:2,netDebt:120},
 {symbol:"STPL-C",company:"Model Staples Gamma",sector:"Consumer Staples",ev:790,ebitda:72,revenue:530,earnings:34,marketCap:740,roic:15,growth:5,netDebt:50}]}
};
for(const key of Object.keys(model)){
 const industry=model[key].target.sector;
 model[key].filings=[
 {form:"10-K",date:"2026-02-24",title:"Annual filing · simulated extract",summary:`Example annual discussion for a ${industry.toLowerCase()} business. This text was written for the interface and does not originate from EDGAR.`,signals:[{label:"Strategy",detail:"Management describes efficiency initiatives and product mix priorities (invented example).",kind:"neutral"},{label:"Risk factor",detail:"Operating margin exposed to input costs and demand volatility (invented example).",kind:"risk"}]},
 {form:"10-Q",date:"2026-08-06",title:"Quarterly filing · simulated extract",summary:"Synthetic quarterly narrative used to model quarter-over-quarter filing comparisons.",signals:[{label:"Cash conversion",detail:"Working-capital normalization discussed in illustrative MD&A commentary.",kind:"good"},{label:"Changed language",detail:"Supply-chain risk wording strengthened versus hypothetical prior report.",kind:"risk"}]},
 {form:"8-K",date:"2026-09-18",title:"Material event · simulated extract",summary:"Fictional operating update to demonstrate an event-driven monitoring workflow.",signals:[{label:"Event",detail:"Illustrative capital allocation announcement; no actual transaction disclosed.",kind:"neutral"}]}
 ];
}
const median=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);return v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2};
const multiple=(numerator:number,denominator:number)=>denominator>0?numerator/denominator:NaN;
const fmt=(n:number,d=1)=>Number.isFinite(n)?n.toFixed(d):"N/M";
export function FilingPeers({company}:{company:Security}){
 const data=model[company.ticker]??model.DEMO;
 const [expanded,setExpanded]=useState("10-K");
 const [excluded,setExcluded]=useState<string[]>([]);
 const selected=data.peers.filter(p=>!excluded.includes(p.symbol));
 const base=selected.length?selected:data.peers;
 const peerEvEbitda=median(base.map(p=>multiple(p.ev,p.ebitda)));
 const peerPe=median(base.map(p=>multiple(p.marketCap,p.earnings)));
 const impliedEV=peerEvEbitda*data.target.ebitda;
 const impliedEquity=impliedEV-data.target.netDebt;
 const premium=multiple(impliedEquity,data.target.marketCap)-1;
 return <div className="ip">
  <div className="ip-section-head"><div><span className="ci-overline">FILING INTELLIGENCE / DEMO</span><h3>SEC document research</h3><p>A source-aware design for future EDGAR retrieval, text comparison and management credibility tracking.</p></div><span className="ip-fake">FICTIONAL FILINGS</span></div>
  <section className="ip-layout">
   <div className="ip-panel"><div className="ip-header"><b><FileText size={17}/> Filing timeline</b><span>Sample dates · not SEC records</span></div>{data.filings.map(f=><div className="ip-filing" key={f.form}><button className="ip-filetoggle" type="button" onClick={()=>setExpanded(expanded===f.form?"":f.form)} aria-expanded={expanded===f.form}><span className="ip-form">{f.form}</span><span><strong>{f.title}</strong><small>{f.date} · invented example</small></span><ChevronDown size={17}/></button>{expanded===f.form&&<div className="ip-filebody"><p>{f.summary}</p>{f.signals.map(s=><div className="ip-signal" key={s.label}><span className={s.kind}>{s.label}</span><p>{s.detail}</p></div>)}<div className="ip-source">SOURCE STATUS: No accession number / no SEC source linked. Do not cite as a real filing.</div></div>}</div>)}</div>
   <div className="ip-panel"><div className="ip-header"><b><ShieldAlert size={17}/> Intelligence findings</b><span>Research hypotheses</span></div><div className="ip-findings"><div><b>Management credibility</b><p>Pending: needs timestamped original guidance compared with subsequent reported outcomes.</p><span>NOT SCORED</span></div><div><b>Risk language changes</b><p>Example alert: the wording of operational risk may be changing between filings.</p><span>ILLUSTRATIVE ONLY</span></div><div><b>Financial consistency</b><p>Investigate divergence between EPS, cash conversion and working capital once verified facts are available.</p><span>DATA REQUIRED</span></div></div><p className="ip-note"><Info size={14}/> Production evidence will include SEC accession ID, form, filing date, original document reference, excerpt location and model timestamp.</p></div>
  </section>
  <div className="ip-section-head ip-peer-heading"><div><span className="ci-overline">RELATIVE VALUATION / DEMO</span><h3>Trading comparables</h3><p>Sector peer group, transparent multiple calculations and an illustrative implied equity bridge.</p></div><span className="ip-fake">SYNTHETIC COMPANIES</span></div>
  <section className="ip-panel"><div className="ip-header"><b><Scale size={17}/> Peer group: {company.sector}</b><span>Toggle inclusion · {base.length} peer models</span></div><div className="ip-scroll"><table className="ip-table"><thead><tr><th>Include</th><th>Company</th><th>EV/EBITDA</th><th>P/E</th><th>ROIC</th><th>Growth</th><th>Net debt</th></tr></thead><tbody><tr className="ip-target"><td>Target</td><td><b>{data.target.symbol}</b><small>{data.target.company}</small></td><td>{fmt(multiple(data.target.ev,data.target.ebitda))}x</td><td>{fmt(multiple(data.target.marketCap,data.target.earnings))}x</td><td>{fmt(data.target.roic)}%</td><td>{fmt(data.target.growth)}%</td><td>${data.target.netDebt}m</td></tr>{data.peers.map(p=><tr key={p.symbol}><td><input type="checkbox" aria-label={`Include ${p.symbol}`} checked={!excluded.includes(p.symbol)} onChange={e=>setExcluded(old=>e.target.checked?old.filter(x=>x!==p.symbol):[...old,p.symbol])}/></td><td><b>{p.symbol}</b><small>{p.company}</small></td><td>{fmt(multiple(p.ev,p.ebitda))}x</td><td>{fmt(multiple(p.marketCap,p.earnings))}x</td><td>{fmt(p.roic)}%</td><td>{fmt(p.growth)}%</td><td>${p.netDebt}m</td></tr>)}</tbody></table></div><p className="ip-note">All peer companies and metrics are fictional. Financial amounts are synthetic USD millions. The peer group is sector-based only; business-model and accounting adjustments are not yet implemented.</p></section>
  <div className="ip-results"><article><span><Target size={16}/> PEER MEDIAN EV/EBITDA</span><strong>{fmt(peerEvEbitda)}x</strong><small>Median of selected synthetic peers</small></article><article><span>PEER MEDIAN P/E</span><strong>{fmt(peerPe)}x</strong><small>Price / net income</small></article><article><span>IMPLIED EQUITY VALUE</span><strong>${fmt(impliedEquity,0)}m</strong><small>Median EV/EBITDA × target EBITDA − net debt</small></article><article><span>VS. MODEL MARKET CAP</span><strong className={premium>=0?"ip-good":"ip-risk"}>{premium>=0?"+":""}{fmt(premium*100)}%</strong><small>Relative comparison, not fair value</small></article></div>
  <div className="ip-bridge"><div><b>Valuation bridge</b><p>Median EV/EBITDA {fmt(peerEvEbitda)}x × target EBITDA ${data.target.ebitda}m = implied EV ${fmt(impliedEV,0)}m; less target net debt ${data.target.netDebt}m = implied equity ${fmt(impliedEquity,0)}m. Illustrative only, excludes minority interests and other normalizations.</p></div><span>MODEL · NOT A PRICE TARGET</span></div>
  <div className="ip-footer"><BookOpen size={15}/> Planned: verified SEC XBRL fundamentals, source citations, year alignment, sector-aware peer selection, adjustments and data licensing. <ExternalLink size={14}/></div>
 </div>
}