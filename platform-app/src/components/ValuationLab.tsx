import {useEffect,useMemo,useState} from "react";
import {NavLink} from "react-router-dom";
import {ArrowRight,Calculator,ChartColumnIncreasing,ShieldCheck,SlidersHorizontal} from "lucide-react";
import type {Security} from "../core/contracts";
import "./valuation.css";
const dollar=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n):"N/A";
const pct=(n:number)=>(n*100).toFixed(1)+"%";
type Assumptions={growth:number;discount:number;terminal:number;mos:number;horizon:number};
const initial:Assumptions={growth:5,discount:10,terminal:15,mos:25,horizon:5};
function dcf(fcf:number,a:Assumptions){
 const r=a.discount/100,g=a.growth/100,t=a.terminal/100,n=a.horizon;
 if(r<=t||fcf<=0)return null;
 let pv=0;const cashflows:number[]=[];
 for(let year=1;year<=n;year++){const cash=fcf*Math.pow(1+g,year);cashflows.push(cash);pv+=cash/Math.pow(1+r,year)}
 const terminalValue=cashflows[n-1]*(1+t)/(r-t);
 return {value:pv+terminalValue/Math.pow(1+r,n),pvCashflows:pv,terminalPV:terminalValue/Math.pow(1+r,n),cashflows};
}
export function ValuationLab({company}:{company:Security}){
 const [a,setA]=useState<Assumptions>(initial);
 useEffect(()=>setA(initial),[company.ticker]);
 const base=useMemo(()=>dcf(company.fcfPerShare,a),[company.fcfPerShare,a]);
 const bear=useMemo(()=>dcf(company.fcfPerShare,{...a,growth:a.growth-3,discount:a.discount+2,terminal:Math.max(0,a.terminal-1)}),[company.fcfPerShare,a]);
 const bull=useMemo(()=>dcf(company.fcfPerShare,{...a,growth:a.growth+3,discount:Math.max(1,a.discount-1),terminal:Math.min(a.discount-0.5,a.terminal+0.5)}),[company.fcfPerShare,a]);
 const buyBelow=base?base.value*(1-a.mos/100):null;
 const upside=base?base.value/company.price-1:null;
 const inputs:[keyof Assumptions,string,number,number,number,string][]=[
 ["growth","FCF growth", -10,20,1,"% per year"],["discount","Required return",5,25,0.5,"%"],["terminal","Perpetual growth",0,6,.25,"%"],["mos","Margin of safety",0,60,5,"%"],["horizon","Forecast years",3,10,1,"years"]
 ];
 return <div className="vl">
 <header className="vl-heading"><div><div className="vl-overline">VALUATION LAB / SCENARIO ENGINE</div><h2>{company.name} <span>{company.ticker}</span></h2><p>Five-year-style discounted cash-flow modeling, scenario sensitivity and disciplined entry thresholds.</p></div><span className="vl-chip">ILLUSTRATIVE INPUTS</span></header>
 <div className="vl-cards">
  <div><small>Reference price</small><strong>{dollar(company.price)}</strong><span>Demo price</span></div>
  <div><small>DCF base value / share</small><strong>{base?dollar(base.value):"N/A"}</strong><span>Calculated from editable assumptions</span></div>
  <div><small>Price vs. intrinsic value</small><strong className={upside!==null&&upside>=0?"vl-positive":"vl-negative"}>{upside===null?"N/A":(upside>=0?"+":"")+pct(upside)}</strong><span>Value ÷ price − 1</span></div>
  <div><small>Buy-under price</small><strong>{buyBelow===null?"N/A":dollar(buyBelow)}</strong><span>{a.mos}% discount to base value</span></div>
 </div>
 <div className="vl-main">
  <section className="vl-panel"><div className="vl-panel-title"><h3><SlidersHorizontal size={18}/> Valuation assumptions</h3><button type="button" onClick={()=>setA(initial)}>Reset</button></div><p>Adjust assumptions to recalculate the DCF instantly. No API calls or historical market data.</p><div className="vl-inputs">{inputs.map(([key,label,min,max,step,unit])=><label key={key}><span>{label}<b>{a[key]} {unit}</b></span><input type="range" min={min} max={max} step={step} value={a[key]} onChange={e=>setA(prev=>({...prev,[key]:Number(e.target.value)}))}/></label>)}</div><div className="vl-base">Starting FCF per share <strong>{dollar(company.fcfPerShare)}</strong></div>{!base&&<p className="vl-error">Required return must exceed terminal growth, and starting FCF must be positive.</p>}</section>
  <section className="vl-panel"><div className="vl-panel-title"><h3><ChartColumnIncreasing size={18}/> Scenario analysis</h3><span>DCF / share</span></div><div className="vl-scenarios">{[{label:"Bear",result:bear,sub:"Lower growth, higher discount"},{label:"Base",result:base,sub:"Selected assumptions"},{label:"Bull",result:bull,sub:"Higher growth, lower discount"}].map(s=><div key={s.label}><span>{s.label}</span><strong>{s.result?dollar(s.result.value):"N/A"}</strong><small>{s.sub}</small><div className="vl-meter"><i style={{width:`${s.result&&base?Math.min(100,Math.max(2,s.result.value/(Math.max(bear?.value||0,base.value,bull?.value||0)*1.05)*100)):0}%`}}/></div></div>)}</div><p>Scenarios adjust the growth rate, required return and terminal rate. These are modeled sensitivities, not probability-weighted forecasts.</p></section>
 </div>
 <div className="vl-main">
  <section className="vl-panel"><div className="vl-panel-title"><h3><Calculator size={18}/> Valuation bridge</h3><span>Per share</span></div><div className="vl-bridge"><div><span>PV of projected free cash flows</span><b>{base?dollar(base.pvCashflows):"N/A"}</b></div><div><span>PV of terminal value</span><b>{base?dollar(base.terminalPV):"N/A"}</b></div><div className="vl-total"><span>Intrinsic value estimate</span><b>{base?dollar(base.value):"N/A"}</b></div><div><span>Less required margin of safety</span><b>{a.mos}%</b></div><div className="vl-total"><span>Buy-under threshold</span><b>{buyBelow===null?"N/A":dollar(buyBelow)}</b></div></div><p className="vl-note">Terminal value can dominate DCF outcomes. All values depend heavily on assumed growth, discount rates and cash-flow quality.</p></section>
  <section className="vl-panel"><div className="vl-panel-title"><h3><ShieldCheck size={18}/> Valuation methods</h3><span>Coverage</span></div><div className="vl-methods"><div><b>Discounted cash flow</b><span className="vl-ready">Interactive demo</span></div><div><b>Trading comparables</b><NavLink to="/company">Open peer analysis <ArrowRight size={14}/></NavLink></div><div><b>Reverse DCF</b><span>Planned</span></div><div><b>Graham / earnings power</b><span>Planned</span></div><div><b>Precedent transactions</b><span>Future research layer</span></div></div><NavLink className="vl-next" to="/options">Continue to Options Lab <ArrowRight size={15}/></NavLink></section>
 </div><div className="vl-disclaimer">DEMONSTRATION ONLY · SAMPLE FINANCIAL INPUTS · NO LIVE QUOTES · NO VERIFIED FORECASTS · NOT INVESTMENT ADVICE</div>
 </div>;
}
