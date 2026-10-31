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
   {metric==="combined"?(history.length>=2&&combinedMetrics.some(s=>s.points.length>=2)?<svg className="fc-combined" viewBox="0 0 520 275" role="img" aria-label={"SEC annual financial history for "+symbol+" indexed to 100 for each metric; gaps are not interpolated"}>
    {[0,1,2,3,4].map(t=><g key={t}><line x1="55" y1={220-t*46} x2="480" y2={220-t*46} stroke="#e6edf5"/><text x="48" y={224-t*46} textAnchor="end" fontSize="10" fill="#7890a7">{t*50}</text></g>)}
    {combinedMetrics.map(s=>{const base=s.points.find(p=>p.value>0)?.value;const points=base?s.points.map(p=>({i:p.i,value:p.value/base*100})):[];return <g key={s.key}>{points.length>=2&&<polyline points={points.map(p=>`${80+p.i*390/Math.max(1,history.length-1)},${220-Math.min(200,p.value)/200*184}`).join(" ")} fill="none" stroke={s.color} strokeWidth="3"/>}{points.map(p=><circle key={p.i} cx={80+p.i*390/Math.max(1,history.length-1)} cy={220-Math.min(200,p.value)/200*184} r="4" fill={s.color}><title>{history[p.i].year}: {s.label} index {p.value.toFixed(1)} (raw {s.points.find(x=>x.i===p.i)?.value.toFixed(2)})</title></circle>)}</g>})}
    {history.map((y,i)=><text key={y.year} x={80+i*390/Math.max(1,history.length-1)} y="242" textAnchor="middle" fontSize="11" fill="#58728e">{y.year}</text>)}
    <text x="55" y="14" fontSize="10" fill="#7890a7">Indexed · first available year = 100</text>
    {combinedMetrics.map((s,i)=><g key={s.key}><rect x={105+i*110} y="255" width="10" height="9" fill={s.color}/><text x={119+i*110} y="264" fontSize="10" fill="#58728e">{s.label}</text></g>)}
   </svg>:<p className="ci-note">Insufficient verified annual history for a combined chart. No simulated data are displayed.</p>):available.length?<div className="fc-bars" role="img" aria-label={metric+" SEC annual "+(metric==="eps"?"USD per share":units)}>{chartValues.map((d,i)=><div className="fc-column" key={d.year}><span className="fc-number">{d.value===null?"N/D":fmt(d.value)}</span><div className="fc-bar-area">{d.value!==null&&<div style={{height:(d.value/maxValue*100)+"%"}}/>}</div><b>{d.year}</b></div>)}</div>:<p className="ci-note">No verified annual {metric.toUpperCase()} history for this ticker.</p>}
   <p className="ci-note">SEC 10-K annual fiscal years only. Revenue and FCF in USD billions; EPS in USD/share. Combined is indexed to each metric's first positive available year; no FY/TTM mixing. Missing observations are omitted, not estimated.</p>
  </section>

