import {useMemo,useState} from "react";
import snapshot from "../data/assetsSnapshot.json";import appleResearch from "../data/aaplResearch.json";
import type {RealAsset} from "./RealResearch";
import type {Security} from "../core/contracts";
import "./financial-charts.css";

type View="revenue"|"fcf"|"eps";
const sample={
 revenue:[69,75,81,88,100],
 fcf:[72,78,87,96,110],
 eps:[64,70,79,90,106]
};
const periods=["2022","2023","2024","2025","2026"];
const fmt=(n:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(n);
export function FinancialCharts({asset,company}:{asset?:RealAsset;company:Security}){
 const [metric,setMetric]=useState<View>("revenue");
 const [showOnlySector,setShowOnlySector]=useState(true);
 const [sort,setSort]=useState<"pe"|"yield">("pe");
 const sector=asset?.sector||company.sector;const apple=asset?.ticker==="AAPL";const annual=appleResearch.annualData;const values=apple?annual.map(y=>metric==="revenue"?y.revenueB:metric==="fcf"?y.fcfB:y.eps):sample[metric];const periodsShown=apple?annual.map(y=>y.year):periods;const maxValue=Math.max(1,...values);
 const peers=useMemo(()=>snapshot.records.filter(x=>x.ticker!==asset?.ticker&&x.price!==null&&x.pe!==null&&x.pe>0&&x.pe<150&&x.beta!==null&&x.beta>=0&&x.beta<5&&(showOnlySector?x.sector===sector:true)).sort((a,b)=>sort==="pe"?(a.pe!-b.pe!):((b.dividendYield??-1)-(a.dividendYield??-1))).slice(0,12),[asset?.ticker,sector,showOnlySector,sort]);
 const scatter=[...(asset&&asset.pe!==null&&asset.pe>0&&asset.beta!==null?[asset]:[]),...peers];
 const xMax=Math.max(2,Math.ceil(Math.max(...scatter.map(s=>s.beta||0),0)/0.5)*0.5);
 const yMax=Math.max(20,Math.ceil(Math.max(...scatter.map(s=>s.pe||0),0)/10)*10);
 return <div className="fc-grid">
  <section className="ci-panel fc-block">
   <div className="ci-panel-head"><h3>Financial Performance</h3><span>{apple?"REAL SEC HISTORY · FY2023–TTM JUN 2026":"INDEXED DESIGN PREVIEW"}</span></div>
   <div className="fc-controls" role="group" aria-label="Choose financial performance metric">{(["revenue","fcf","eps"] as View[]).map(m=><button key={m} type="button" className={metric===m?"fc-active":""} onClick={()=>setMetric(m)}>{m==="revenue"?"Revenue":m==="fcf"?"Free Cash Flow":"EPS"}</button>)}</div>
   <div className="fc-bars" role="img" aria-label={metric+(apple?" Apple SEC historical values":" sample design values")}>{values.map((v,i)=><div className="fc-column" key={periodsShown[i]}><span className="fc-number">{fmt(v)}</span><div className="fc-bar-area"><div style={{height:(v/maxValue*100)+"%"}}/></div><b>{periodsShown[i]}</b></div>)}</div>
   <p className="ci-note">{apple?"Apple SEC filings: revenue and FCF in USD billions; EPS in USD/share. TTM built from FY2025 + nine months FY2026 − nine months FY2025. FY2026 is not a completed fiscal year.":"Preview series only; verified histories pending for this ticker."}</p>
  </section>
  <section className="ci-panel fc-block">
   <div className="ci-panel-head"><h3>Relative Valuation Map</h3><span>GOOGLE SHEETS SNAPSHOT · {snapshot.exportedAt}</span></div>
   <div className="fc-controls"><label><input type="checkbox" checked={showOnlySector} onChange={e=>setShowOnlySector(e.target.checked)}/> Same sector</label><label>Rank <select value={sort} onChange={e=>setSort(e.target.value as "pe"|"yield")}><option value="pe">Lowest P/E</option><option value="yield">Highest dividend yield</option></select></label></div>
   {scatter.length?<><svg viewBox="0 0 520 300" role="img" aria-label="Real asset snapshot scatter plot of beta versus P/E" className="fc-scatter"><line x1="55" y1="250" x2="500" y2="250"/><line x1="55" y1="28" x2="55" y2="250"/>{[0,.25,.5,.75,1].map(f=><g key={f}><line x1="55" y1={250-f*220} x2="500" y2={250-f*220} className="fc-gridline"/><text x="46" y={254-f*220} textAnchor="end">{fmt(f*yMax)}</text></g>)}{scatter.map(s=>{const x=55+(s.beta!/xMax)*445,y=250-(s.pe!/yMax)*220,isTarget=s.ticker===asset?.ticker;return <g key={s.ticker}><circle cx={x} cy={y} r={isTarget?7:4.5} className={isTarget?"fc-point-target":"fc-point"}><title>{s.ticker} | P/E {fmt(s.pe!)} | beta {fmt(s.beta!)}</title></circle>{isTarget&&<text x={Math.min(465,x+10)} y={y-8} className="fc-target-label">{s.ticker}</text>}</g>})}<text x="276" y="289" textAnchor="middle">Beta →</text><text transform="translate(15 150) rotate(-90)" textAnchor="middle">P/E (TTM) →</text></svg><p className="ci-note">{scatter.length} instruments shown. Real snapshot values; this is an exploratory P/E versus beta comparison, not an intrinsic valuation or a validated peer-comparable model. Different industries and negative earnings are excluded.</p></>:<p className="ci-note">Insufficient snapshot data for this sector. Turn off Same sector to inspect the broader universe.</p>}
  </section>
 </div>;
}
