import {useState} from "react";
import "./football-field.css";

type Method={
 label:string;
 low:number|null;
 mid:number|null;
 high:number|null;
 kind:"intrinsic"|"entry"|"pending";
 detail:string;
};
type ChartMethod=Method&{shortLabel:string};
type Props={
 price:number|null;
 currency?:string;
 bear:number|null;
 base:number|null;
 bull:number|null;
 mos?:number;
 source?:string;
 extra?:Method[];
 graham?:number|null;
 dividend?:number|null;
};
const valid=(value:number|null):value is number=>value!==null&&Number.isFinite(value)&&value>=0;
const niceCeiling=(value:number)=>{
 const safe=Math.max(value,0.001);
 const magnitude=Math.pow(10,Math.floor(Math.log10(safe)));
 const scaled=safe/magnitude;
 return ([1,1.5,2,2.5,3,4,5,6,8,10].find(x=>x>=scaled)??10)*magnitude;
};

export function ValuationFootballField({price,currency="USD",bear,base,bull,mos=25,source="USER ASSUMPTIONS",extra=[],graham=null,dividend=null}:Props){
 const [scale,setScale]=useState<"focus"|"market">("focus");
 const isoCurrency=/^[A-Z]{3}$/.test(currency)?currency:"USD";
 const money=(value:number|null)=>valid(value)?new Intl.NumberFormat("en-US",{style:"currency",currency:isoCurrency,maximumFractionDigits:2}).format(value):"N/D";
 const tick=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:isoCurrency,maximumFractionDigits:2,notation:value>=10000?"compact":"standard"}).format(value);
 const scenarioValues=[bear,base,bull].filter(valid);
 const dcfLow=scenarioValues.length?Math.min(...scenarioValues):null;
 const dcfHigh=scenarioValues.length?Math.max(...scenarioValues):null;
 const methods:ChartMethod[]=[
  {label:"DCF scenarios",shortLabel:"DCF · scenarios",low:dcfLow,mid:valid(base)?base:null,high:dcfHigh,kind:valid(base)?"intrinsic":"pending",detail:"Bear / base / bull from editable assumptions"},
  {label:"Graham / earnings power",shortLabel:"Graham / Lynch",low:graham,mid:graham,high:graham,kind:valid(graham)?"intrinsic":"pending",detail:"Single-point earnings heuristic; not a modeled range"},
  {label:"DDM / dividend value",shortLabel:"Dividend / DDM",low:dividend,mid:dividend,high:dividend,kind:valid(dividend)?"intrinsic":"pending",detail:"Single-point 30-year dividend discount model"},
  {label:"Peer comparables",shortLabel:"Peer comparables",low:null,mid:null,high:null,kind:"pending",detail:"Requires verified sector peers and normalized multiples"},
  ...extra.filter(m=>m.kind==="intrinsic"||m.kind==="pending").map(m=>({...m,shortLabel:m.label}))
 ];
 const thresholds:Method[]=[
  {label:"DCF buy-under · MOS",low:valid(base)?base*(1-mos/100):null,mid:valid(base)?base*(1-mos/100):null,high:valid(base)?base*(1-mos/100):null,kind:"entry",detail:mos+"% margin of safety applied to DCF base"},
  ...extra.filter(m=>m.kind==="entry")
 ];
 // Average only valid intrinsic point estimates; DDM is deliberately excluded.
 const averageCandidates=methods.filter(m=>m.kind==="intrinsic"&&!/DDM|dividend/i.test(m.label)).map(m=>m.mid).filter(valid);
 const averageValuation=averageCandidates.length?averageCandidates.reduce((sum,value)=>sum+value,0)/averageCandidates.length:null;
 const intrinsicValues=methods.flatMap(m=>[m.low,m.mid,m.high]).filter(valid);
 const reference=valid(price)?price:null;
 const focusCeiling=niceCeiling((intrinsicValues.length?Math.max(...intrinsicValues):reference??1)*1.15);
 const axisMax=scale==="market"?niceCeiling(Math.max(focusCeiling,reference??0)*1.08):focusCeiling;
 const top=48,bottom=304,left=105,right=1065;
 const y=(value:number)=>bottom-(value/axisMax)*(bottom-top);
 const center=(index:number)=>left+(index+.5)*(right-left)/methods.length;
 const marketInRange=reference!==null&&reference<=axisMax;
 const marketOffScale=reference!==null&&reference>axisMax;
 const distance=(value:number|null)=>reference!==null&&reference>0&&valid(value)?((value/reference)-1)*100:null;
 const signedPct=(value:number|null)=>value===null?"N/D":(value>0?"+":"")+value.toFixed(1)+"%";

 return <section className="ff-panel">
  <header className="ff-header">
   <div><span>VALUATION TRIANGULATION</span><h3>Valuation Football Field</h3><p>Comparable valuation methods on a shared price-per-share axis.</p></div>
   <div className="ff-header-right"><span className="ff-source">{source}</span><div className="ff-market-reference"><small>REFERENCE MARKET PRICE</small><strong>{money(reference)}</strong><span>{marketOffScale?"Above valuation-focused scale":"Historical snapshot · not live"}</span></div></div>
  </header>
  <div className="ff-toolbar">
   <div className="ff-legend"><span><i className="ff-legend-range"/> Scenario range</span><span><i className="ff-legend-point"/> Point estimate</span><span><i className="ff-legend-market"/> Market reference</span><span><i className="ff-legend-average"/> Average valuation (excl. DDM)</span></div>
   <div className="ff-scale-toggle" role="group" aria-label="Football Field vertical axis scale"><button type="button" className={scale==="focus"?"active":""} aria-pressed={scale==="focus"} onClick={()=>setScale("focus")}>Valuation focus</button><button type="button" className={scale==="market"?"active":""} aria-pressed={scale==="market"} onClick={()=>setScale("market")}>Include market price</button></div>
  </div>
  {marketOffScale&&<div className="ff-offscale"><strong>Market reference {money(reference)} is above the plotted valuation range.</strong> Select “Include market price” to display the full distance without compressing the valuation methods.</div>}
  <div className="ff-chart-scroll" tabIndex={0} aria-label="Scroll to inspect the full valuation chart on smaller screens">
   <svg className="ff-svg" viewBox="0 0 1100 393" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={"Vertical valuation football field. DCF base "+money(base)+", Graham "+money(graham)+", dividend "+money(dividend)+", market price "+money(reference)}>
    <title>Valuation Football Field</title>
    <desc>Each column represents a valuation method. The DCF column shows a bear-to-bull range with a base marker; Graham and dividend methods show single-point estimates. The orange dashed line shows the market reference when within the selected scale. A separate orange dashed line shows the average of valid intrinsic point estimates excluding dividend discount models. Entry-price thresholds are shown separately.</desc>
    <defs><linearGradient id="ff-range-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#235d94"/><stop offset="100%" stopColor="#102f50"/></linearGradient></defs>
    <text className="ff-axis-title" x="14" y="22">VALUE / SHARE</text>
    {[0,.25,.5,.75,1].map((fraction)=>{
     const value=axisMax*fraction;
     const yy=y(value);
     return <g key={fraction}><line className={fraction===0?"ff-grid-baseline":"ff-gridline"} x1={left} x2={right} y1={yy} y2={yy}/><text className="ff-axis-tick" x={left-16} y={yy+4} textAnchor="end">{tick(value)}</text></g>;
    })}
    {methods.map((m,index)=>{
     const x=center(index);
     const available=valid(m.mid)&&valid(m.low)&&valid(m.high);
     const lo=available?Math.min(m.low!,m.high!):null;
     const hi=available?Math.max(m.low!,m.high!):null;
     const range=lo!==null&&hi!==null&&hi-lo>0.00001;
     return <g key={m.label}>
      <line className="ff-column-guide" x1={x} x2={x} y1={top} y2={bottom}/>
      {available&&range&&lo!==null&&hi!==null&&m.mid!==null?<g>
       <title>{m.label+": low "+money(lo)+", base "+money(m.mid)+", high "+money(hi)}</title>
       <rect className="ff-vertical-range" x={x-32} y={y(hi)} width="64" height={Math.max(4,y(lo)-y(hi))} rx="3"/>
       <line className="ff-base-halo" x1={x-44} x2={x+44} y1={y(m.mid)} y2={y(m.mid)}/>
       <line className="ff-base-marker" x1={x-44} x2={x+44} y1={y(m.mid)} y2={y(m.mid)}/>
       <text className="ff-range-high" x={x} y={y(hi)-13} textAnchor="middle">High {money(hi)}</text>
       <text className="ff-range-low" x={x} y={y(lo)+20} textAnchor="middle">Low {money(lo)}</text>
      </g>:null}
      {available&&!range&&m.mid!==null?<g>
       <title>{m.label+": "+money(m.mid)}. Single-point estimate, not a range.</title>
       <line className="ff-single-estimate" x1={x-38} x2={x+38} y1={y(m.mid)} y2={y(m.mid)}/>
       <circle className="ff-single-center" cx={x} cy={y(m.mid)} r="7"/>
       <text className="ff-point-label" x={x} y={Math.max(28,y(m.mid)-16)} textAnchor="middle">{money(m.mid)}</text>
      </g>:null}
      {!available?<g><rect className="ff-pending-box" x={x-44} y="158" width="88" height="78" rx="5"/><text className="ff-pending-title" x={x} y="194" textAnchor="middle">PENDING</text><text className="ff-pending-sub" x={x} y="212" textAnchor="middle">No verified data</text></g>:null}
      <text className="ff-method-name" x={x} y="342" textAnchor="middle">{m.shortLabel}</text>
      <text className="ff-method-value" x={x} y="366" textAnchor="middle">{available?(range?"Base ":"Value ")+money(m.mid):"N/D · pending"}</text>
     </g>;
    })}
    {averageValuation!==null?<g><line className="ff-average-line" x1={left} x2={right} y1={y(averageValuation)} y2={y(averageValuation)}/><rect className="ff-average-tag-bg" x="755" y={Math.max(27,y(averageValuation)-29)} width="310" height="22" rx="5"/><text className="ff-average-tag" x="1055" y={Math.max(43,y(averageValuation)-14)} textAnchor="end">AVERAGE VALUATION · {money(averageValuation)}</text></g>:null}
    {marketInRange&&reference!==null?<g><line className="ff-market-line" x1={left} x2={right} y1={y(reference)} y2={y(reference)}/><rect className="ff-market-tag-bg" x="826" y={Math.max(27,y(reference)-29)} width="239" height="22" rx="5"/><text className="ff-market-tag" x="1055" y={Math.max(43,y(reference)-14)} textAnchor="end">MARKET REFERENCE · {money(reference)}</text></g>:null}
   </svg>
  </div>
  <div className="ff-chart-caption"><span>DCF bar: <strong>bear → bull</strong>, horizontal marker: <strong>base case</strong>.</span><span>Graham and DDM are <strong>single estimates</strong>; no invented confidence intervals.</span></div>
  <div className="ff-entry-section">
   <div className="ff-entry-title"><div><span>ENTRY DISCIPLINE</span><h4>Purchase thresholds</h4></div><small>Separate from intrinsic value · not part of a valuation average</small></div>
   <div className="ff-entry-grid">{thresholds.map((m,index)=><div className="ff-entry-card" key={m.label+"-"+index}><div><span>{m.label}</span><strong>{money(m.mid)}</strong></div><div><small>{m.detail}</small><b>{valid(m.mid)&&reference!==null?"vs market "+signedPct(distance(m.mid)):"Awaiting model inputs"}</b></div></div>)}</div>
  </div>
  <footer className="ff-footer"><span><strong>Research boundary.</strong> Estimates depend on editable assumptions and dated financial inputs. Peer comparisons remain pending until verified.</span><span>No averaging of intrinsic estimates with entry thresholds. The market line is a reference price, not a consensus fair value. Average excludes DDM and entry thresholds.</span></footer>
 </section>;
}
