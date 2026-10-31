import {useMemo,useState} from "react";
import snapshot from "../data/assetsSnapshot.json";import {verifiedAnnualHistory} from "../data/verifiedFinancials";
import type {RealAsset} from "./RealResearch";
import type {Security} from "../core/contracts";
import "./financial-charts.css";

type View="combined"|"revenue"|"fcf"|"eps";
const fmt=(n:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(n);
export function FinancialCharts({asset,company}:{asset?:RealAsset;company:Security}){
 const [metric,setMetric]=useState<View>("combined");
 const [showOnlySector,setShowOnlySector]=useState(true);
 const [sort,setSort]=useState<"pe"|"yield">("pe");
 const sector=asset?.sector||company.sector;const symbol=asset?.ticker??company.ticker;const history=verifiedAnnualHistory(symbol);const units="USD billions";const available=history.filter(x=>x[metric==="fcf"?"fcf":metric==="eps"?"eps":"revenue"]!==null);const chartValues=history.map(x=>({year:x.year,value:metric==="eps"?x.eps:x[metric==="fcf"?"fcf":"revenue"]===null?null:(x[metric==="fcf"?"fcf":"revenue"] as number)/1e9}));const maxValue=Math.max(1,...chartValues.map(x=>x.value??0));const combinedMetrics=(["revenue","fcf","eps"] as const).map(k=>({key:k,label:k==="revenue"?"Revenue":k==="fcf"?"FCF":"EPS",color:k==="revenue"?"#347fca":k==="fcf"?"#69b5aa":"#e39729",points:history.map((y,i)=>({i,value:k==="eps"?y.eps:y[k]===null?null:y[k]!/1e9})).filter((x):x is {i:number;value:number}=>x.value!==null)}));
 const peers=useMemo(()=>snapshot.records.filter(x=>x.ticker!==asset?.ticker&&x.price!==null&&x.pe!==null&&x.pe>0&&x.pe<150&&x.beta!==null&&x.beta>=0&&x.beta<5&&(showOnlySector?x.sector===sector:true)).sort((a,b)=>sort==="pe"?(a.pe!-b.pe!):((b.dividendYield??-1)-(a.dividendYield??-1))).slice(0,12),[asset?.ticker,sector,showOnlySector,sort]);
 const scatter=[...(asset&&asset.pe!==null&&asset.pe>0&&asset.beta!==null?[asset]:[]),...peers];
 const xMax=Math.max(2,Math.ceil(Math.max(...scatter.map(s=>s.beta||0),0)/0.5)*0.5);
 const yMax=Math.max(20,Math.ceil(Math.max(...scatter.map(s=>s.pe||0),0)/10)*10);
 return <div className="fc-grid">
  <section className="ci-panel fc-block">
   <div className="ci-panel-head"><h3>Financial Performance</h3><span>{history.length?"SEC VERIFIED ANNUAL · "+history.map(x=>x.year).join("–"):"SEC HISTORY PENDING"}</span></div>
   <div className="fc-controls" role="group" aria-label="Choose financial performance metric">{(["combined","revenue","fcf","eps"] as View[]).map(m=><button key={m} type="button" className={metric===m?"fc-active":""} onClick={()=>setMetric(m)}>{m==="combined"?"Combined":m==="revenue"?"Revenue":m==="fcf"?"Free Cash Flow":"EPS"}</button>)}</div>
   {metric==="combined"?(history.length>=2&&combinedMetrics.some(s=>s.points.length>=2)?<svg className="fc-combined" viewBox="0 0 520 275" role="img" aria-label={"Grouped annual columns for "+symbol+"; SEC fiscal years, revenue, FCF and EPS indexed to 100 at first positive observation; missing values omitted"}>
    {(()=>{const series=combinedMetrics.map(s=>{const base=s.points.find(p=>p.value>0)?.value;return {...s,indexed:base?s.points.map(p=>({i:p.i,value:p.value/base*100,raw:p.value})):[]};});const all=series.flatMap(s=>s.indexed.map(p=>p.value));const top=Math.max(100,Math.ceil(Math.max(...all,0)/25)*25);const chartLeft=58,chartRight=492,chartBottom=220,chartHeight=174;const groupWidth=(chartRight-chartLeft)/history.length;const barWidth=Math.min(22,groupWidth/4.2);return <>
     {[0,1,2,3,4].map(t=><g key={t}><line x1={chartLeft} y1={chartBottom-t*chartHeight/4} x2={chartRight} y2={chartBottom-t*chartHeight/4} stroke="#e6edf5"/><text x="49" y={chartBottom-t*chartHeight/4+4} textAnchor="end" fontSize="10" fill="#7890a7">{(top*t/4).toFixed(0)}</text></g>)}
     {history.map((y,i)=><text key={y.year} x={chartLeft+(i+.5)*groupWidth} y="241" textAnchor="middle" fontSize="11" fill="#58728e">{y.year}</text>)}
     {series.map((s,j)=><g key={s.key}>{s.indexed.map(p=>{const h=Math.max(0,Math.min(chartHeight,p.value/top*chartHeight));const x=chartLeft+(p.i+.5)*groupWidth+(j-1)*barWidth-barWidth*.44;return <rect key={p.i} x={x} y={chartBottom-h} width={barWidth*.88} height={h} rx="2" fill={s.color}><title>{history[p.i].year}: {s.label} index {p.value.toFixed(1)}; original {p.raw.toFixed(2)} {s.key==="eps"?"USD/share":"USD billions"}</title></rect>})}</g>)}
     <text x="58" y="15" fontSize="10" fill="#7890a7">Indexed · first positive fiscal year = 100</text>
     {series.map((s,i)=><g key={s.key}><rect x={115+i*110} y="255" width="10" height="9" fill={s.color}/><text x={129+i*110} y="264" fontSize="10" fill="#58728e">{s.label}</text></g>)}
    </>})()}
   </svg>:<p className="ci-note">Insufficient verified annual history for a combined chart. No simulated data are displayed.</p>):available.length?<div className="fc-bars" role="img" aria-label={metric+" SEC annual "+(metric==="eps"?"USD per share":units)} style={{gridTemplateColumns:`repeat(${Math.max(1,history.length)},minmax(0,1fr))`}}>{chartValues.map(d=><div className="fc-column" key={d.year}><span className="fc-number">{d.value===null?"N/D":fmt(d.value)}</span><div className="fc-bar-area">{d.value!==null&&<div style={{height:(d.value/maxValue*100)+"%"}}/>}</div><b>{d.year}</b></div>)}</div>:<p className="ci-note">No verified annual {metric.toUpperCase()} history for this ticker.</p>}
   <p className="ci-note">SEC 10-K annual fiscal years only. Revenue and FCF in USD billions; EPS in USD/share. Combined is indexed to each metric's first positive available year; no FY/TTM mixing. Missing observations are omitted, not estimated.</p>
  </section>

  <section className="ci-panel fc-block">
   <div className="ci-panel-head"><h3>Relative Valuation Map</h3><span>GOOGLE SHEETS SNAPSHOT · {snapshot.exportedAt}</span></div>
   <div className="fc-controls"><label><input type="checkbox" checked={showOnlySector} onChange={e=>setShowOnlySector(e.target.checked)}/> Same sector</label><label>Rank <select value={sort} onChange={e=>setSort(e.target.value as "pe"|"yield")}><option value="pe">Lowest P/E</option><option value="yield">Highest dividend yield</option></select></label></div>
   {scatter.length?<><svg viewBox="0 0 520 300" role="img" aria-label="Real asset snapshot scatter plot of beta versus P/E" className="fc-scatter"><line x1="55" y1="250" x2="500" y2="250"/><line x1="55" y1="28" x2="55" y2="250"/>{[0,.25,.5,.75,1].map(f=><g key={f}><line x1="55" y1={250-f*220} x2="500" y2={250-f*220} className="fc-gridline"/><text x="46" y={254-f*220} textAnchor="end">{fmt(f*yMax)}</text></g>)}{scatter.map(s=>{const x=55+(s.beta!/xMax)*445,y=250-(s.pe!/yMax)*220,isTarget=s.ticker===asset?.ticker;return <g key={s.ticker}><circle cx={x} cy={y} r={isTarget?7:4.5} className={isTarget?"fc-point-target":"fc-point"}><title>{s.ticker} | P/E {fmt(s.pe!)} | beta {fmt(s.beta!)}</title></circle>{isTarget&&<text x={Math.min(465,x+10)} y={y-8} className="fc-target-label">{s.ticker}</text>}</g>})}<text x="276" y="289" textAnchor="middle">Beta →</text><text transform="translate(15 150) rotate(-90)" textAnchor="middle">P/E (TTM) →</text></svg><p className="ci-note">{scatter.length} instruments shown. Real snapshot values; this is an exploratory P/E versus beta comparison, not an intrinsic valuation or a validated peer-comparable model. Different industries and negative earnings are excluded.</p></>:<p className="ci-note">Insufficient snapshot data for this sector. Turn off Same sector to inspect the broader universe.</p>}
  </section>
 </div>;
}
