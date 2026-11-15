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
 triangulatedValue?:number|null;
};
type Series={id:string;label:string;low:number|null;mid:number|null;high:number|null;detail:string};
const valid=(n:number|null|undefined):n is number=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const prettyStep=(range:number)=>{
 const raw=Math.max(range,0.001)/4;
 const power=10**Math.floor(Math.log10(raw));
 return ([1,2,2.5,5,10].find(n=>n*power>=raw)??10)*power;
};
export function ValuationFootballField({price,currency="USD",bear,base,bull,mos=25,extra=[],graham=null,dividend=null,triangulatedValue=null}:Props){
 const [scale,setScale]=useState<"focus"|"market">("market");
 const isoCurrency=/^[A-Z]{3}$/.test(currency)?currency:"USD";
 const money=(value:number|null)=>valid(value)?new Intl.NumberFormat("en-US",{style:"currency",currency:isoCurrency,maximumFractionDigits:2}).format(value):"N/D";
 const axisValue=(value:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:1,notation:value>=10000?"compact":"standard"}).format(value);
 // One consolidated slot per valuation family. Do not count Manual/CAPM/WACC
 // as independent families. Future validated series can be supplied via extra.
 const dcfRange=[bear,base,bull].filter(valid);
 const candidates:Series[]=[
  {id:"dcf",label:"DCF",low:dcfRange.length?Math.min(...dcfRange):null,mid:valid(base)?base:null,high:dcfRange.length?Math.max(...dcfRange):null,detail:"DCF range across available scenarios"},
  {id:"earnings",label:"Earnings",low:graham,mid:graham,high:graham,detail:"Graham / earnings method"},
  {id:"dividend",label:"Dividend",low:dividend,mid:dividend,high:dividend,detail:"DDM method"},
  ...extra.filter(m=>m.kind!=="entry").map((m,i)=>({id:"extra-"+i,label:m.label,low:m.low,mid:m.mid,high:m.high,detail:m.detail}))
 ];
 const methods=candidates.filter(m=>valid(m.mid));
 const pending=candidates.filter(m=>!valid(m.mid));
 const reference=valid(price)?price:null;
 const fairValue=valid(triangulatedValue)?triangulatedValue:null;
 const observed=[...methods.flatMap(m=>[m.low,m.mid,m.high]).filter(valid),...([fairValue].filter(valid))];
 if(scale==="market"&&reference!==null)observed.push(reference);
 const maximum=Math.max(...observed,1);
 const step=prettyStep(maximum*1.1);
 const axisMax=Math.ceil(maximum*1.1/step)*step;
 const ticks=Array.from({length:Math.round(axisMax/step)+1},(_,i)=>i*step);
 const left=91,right=1010,top=35,bottom=315;
 const y=(v:number)=>bottom-v/axisMax*(bottom-top);
 const slotWidth=(right-left)/Math.max(methods.length,1);
 const center=(i:number)=>left+(i+.5)*slotWidth;
 const marketOffScale=reference!==null&&reference>axisMax;
 const toPercent=(target:number|null)=>valid(target)&&reference!==null?(target/reference-1)*100:null;
 const signedPct=(v:number|null)=>v===null?"N/D":(v>0?"+":"")+v.toFixed(1)+"%";
 const thresholds:Method[]=[
  {label:"DCF buy-under · MOS",low:valid(base)?base*(1-mos/100):null,mid:valid(base)?base*(1-mos/100):null,high:valid(base)?base*(1-mos/100):null,kind:"entry",detail:mos+"% margin of safety applied to DCF base"},
  ...extra.filter(m=>m.kind==="entry")
 ];
 // No averaging of intrinsic estimates with entry thresholds.
 return <section className="ff-panel ff-clean">
  <header className="ff-header"><h3>Valuation Football Field</h3></header>
  <div className="ff-toolbar">
   <div className="ff-legend">
    <span><i className="ff-legend-range"/>DCF range</span>
    <span><i className="ff-legend-point"/>Point estimate</span>
    <span><i className="ff-legend-triangulated"/>Fair Value</span>
    <span><i className="ff-legend-market"/>Market Price</span>
   </div>
   <div className="ff-scale-toggle" role="group" aria-label="Football Field price scale">
    <button type="button" className={scale==="focus"?"active":""} aria-pressed={scale==="focus"} onClick={()=>setScale("focus")}>Valuation focus</button>
    <button type="button" className={scale==="market"?"active":""} aria-pressed={scale==="market"} onClick={()=>setScale("market")}>Include market</button>
   </div>
  </div>
  {marketOffScale&&<p className="ff-offscale">The market price is outside this focused valuation range. Select “Include market” to compare it.</p>}
  <div className="ff-chart-scroll" tabIndex={0} aria-label="Valuation methods plotted against a price-per-share axis">
   <svg className="ff-svg" viewBox="0 0 1100 365" role="img" aria-label={"Valuation range and point estimates in "+isoCurrency+" per share"}>
    <title>Valuation Football Field</title>
    <desc>Each eligible model is plotted against a shared per-share scale. Navy bars show ranges, blue marks show estimates, and horizontal lines represent Fair Value and market price.</desc>
    <defs><linearGradient id="ff-range-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#235d94"/><stop offset="100%" stopColor="#102f50"/></linearGradient></defs>
    <text className="ff-axis-title" x="16" y="17">{isoCurrency} / SHARE</text>
    {ticks.map((v,i)=><g key={i}><line className={i===0?"ff-grid-baseline":"ff-gridline"} x1={left} x2={right} y1={y(v)} y2={y(v)}/><text className="ff-axis-tick" x={left-14} y={y(v)+5} textAnchor="end">{axisValue(v)}</text></g>)}
    {methods.map((m,i)=>{
     const x=center(i);
     const lo=valid(m.low)?m.low:m.mid!;
     const hi=valid(m.high)?m.high:m.mid!;
     const range=hi-lo>0.00001;
     return <g key={m.id}>
      <line className="ff-column-guide" x1={x} x2={x} y1={top} y2={bottom}/>
      {range?<rect className="ff-vertical-range" x={x-29} y={y(hi)} width="58" height={Math.max(3,y(lo)-y(hi))} rx="4"/>:null}
      <line className={range?"ff-base-marker":"ff-single-estimate"} x1={x-32} x2={x+32} y1={y(m.mid!)} y2={y(m.mid!)}/>
      {!range?<circle className="ff-single-center" cx={x} cy={y(m.mid!)} r="6"/>:null}
      <title>{m.label+": "+money(m.mid)+"; range "+money(lo)+" to "+money(hi)}</title>
      <text className="ff-method-name" x={x} y="350" textAnchor="middle">{m.label}</text>
     </g>
    })}
    {fairValue!==null?<line className="ff-triangulated-line" x1={left} x2={right} y1={y(fairValue)} y2={y(fairValue)}/>:null}
    {reference!==null&&reference<=axisMax?<line className="ff-market-line" x1={left} x2={right} y1={y(reference)} y2={y(reference)}/>:null}
   </svg>
  </div>
  <div className="ff-method-summary" aria-label="Method values and model availability">
   {methods.map(m=><div className="ff-method-summary-card" key={m.id}><span>{m.label}</span><strong>{money(m.mid)}</strong>{valid(m.low)&&valid(m.high)&&m.high>m.low?<small>{money(m.low)} – {money(m.high)}</small>:<small>Point estimate</small>}</div>)}
   {pending.length>0?<div className="ff-pending-note"><strong>Pending:</strong> {pending.map(m=>m.label).join(" · ")}</div>:null}
  </div>
  <div className="ff-entry-section">
   <div className="ff-entry-title"><div><span>ENTRY DISCIPLINE</span><h4>Purchase thresholds</h4></div></div>
   <div className="ff-entry-grid">{thresholds.map((m,index)=><div className="ff-entry-card" key={m.label+"-"+index}><div><span>{m.label}</span><strong>{money(m.mid)}</strong></div><div><small>{m.detail}</small><b>{valid(m.mid)&&reference!==null?"vs market "+signedPct(toPercent(m.mid)):"Awaiting model inputs"}</b></div></div>)}</div>
  </div>
 </section>;
}
