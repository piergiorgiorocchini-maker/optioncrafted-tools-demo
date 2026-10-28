import {useEffect,useMemo,useState} from "react";
import {NavLink} from "react-router-dom";
import {ArrowRight,Calculator,ChartColumnIncreasing,ShieldCheck,SlidersHorizontal} from "lucide-react";
import type {Security} from "../core/contracts";
import "./valuation.css";import {ValuationFootballField} from "./ValuationFootballField";
const dollar=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n):"N/A";
const pct=(n:number)=>(n*100).toFixed(1)+"%";
type Assumptions={growth:number;discount:number;terminal:number;mos:number;horizon:number};
const initial:Assumptions={growth:5,discount:10,terminal:2.5,mos:25,horizon:5};
type Capital={riskFree:number;erp:number;beta:number;costDebt:number;tax:number;equityWeight:number};
const startingCapital:Capital={riskFree:4,erp:5.5,beta:1.15,costDebt:5.8,tax:25,equityWeight:80};
type InputMode="demo"|"manual"|"hybrid";
type FinancialInputs={name:string;currency:string;price:string;eps:string;fcf:string};
const fromSecurity=(company:Security):FinancialInputs=>({name:company.name,currency:company.currency,price:String(company.price),eps:String(company.eps),fcf:String(company.fcfPerShare)});
const parseNonNegative=(input:string)=>{const value=Number(input);return input.trim()!==""&&Number.isFinite(value)&&value>=0?value:null};
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
 const [mode,setMode]=useState<InputMode>("demo");
 const [capital,setCapital]=useState<Capital>(startingCapital);
 const [rateMode,setRateMode]=useState<"manual"|"capm">("manual");
 const costEquity=capital.riskFree+capital.beta*capital.erp;
 const costDebtAfterTax=capital.costDebt*(1-capital.tax/100);
 const wacc=costEquity*capital.equityWeight/100+costDebtAfterTax*(1-capital.equityWeight/100);
 const effectiveAssumptions=rateMode==="capm"?{...a,discount:costEquity}:a;
 const [manual,setManual]=useState<FinancialInputs>({name:"",currency:"USD",price:"",eps:"",fcf:""});
 const [hybrid,setHybrid]=useState<FinancialInputs>(fromSecurity(company));
 useEffect(()=>{setA(initial);setHybrid(fromSecurity(company))},[company.ticker]);
 const active=mode==="manual"?manual:mode==="hybrid"?hybrid:fromSecurity(company);
 const price=parseNonNegative(active.price),fcfValue=parseNonNegative(active.fcf),epsValue=parseNonNegative(active.eps);
 const valid=price!==null&&price>0&&fcfValue!==null&&fcfValue>0;
 const shown=(n:number|null)=>n===null?"—":dollar(n);
 const updateField=(key:keyof FinancialInputs,value:string)=>{if(mode==="manual")setManual(v=>({...v,[key]:value}));else if(mode==="hybrid")setHybrid(v=>({...v,[key]:value}))};
 const base=useMemo(()=>dcf(valid?fcfValue!:0,effectiveAssumptions),[fcfValue,valid,effectiveAssumptions]);
 const bear=useMemo(()=>dcf(valid?fcfValue!:0,{...effectiveAssumptions,growth:a.growth-3,discount:effectiveAssumptions.discount+2,terminal:Math.max(0,a.terminal-1)}),[fcfValue,valid,effectiveAssumptions]);
 const bull=useMemo(()=>dcf(valid?fcfValue!:0,{...effectiveAssumptions,growth:a.growth+3,discount:Math.max(1,effectiveAssumptions.discount-1),terminal:Math.min(effectiveAssumptions.discount-0.5,a.terminal+0.5)}),[fcfValue,valid,effectiveAssumptions]);
 const buyBelow=base?base.value*(1-a.mos/100):null;
 const upside=base?base.value/(price||1)-1:null;
 const inputs:[keyof Assumptions,string,number,number,number,string][]=[
 ["growth","FCF growth", -10,20,1,"% per year"],["discount","Required return (manual)",5,25,0.5,"%"],["terminal","Perpetual growth",0,6,.25,"%"],["mos","Margin of safety",0,60,5,"%"],["horizon","Forecast years",3,10,1,"years"]
 ];
 return <div className="vl">
 <header className="vl-heading"><div><div className="vl-overline">VALUATION LAB / SCENARIO ENGINE</div><h2>{mode==="manual"?(active.name.trim()||"Untitled Investment"):company.name} <span>{mode==="manual"?"FREE-HAND":company.ticker}</span></h2><p>Five-year-style discounted cash-flow modeling, scenario sensitivity and disciplined entry thresholds.</p></div><span className="vl-chip">ILLUSTRATIVE INPUTS</span></header>
 <section className="vl-panel vl-input-section"><div className="vl-panel-title"><h3>Data input mode</h3><span>{mode==="demo"?"DEMO SNAPSHOT":mode==="manual"?"USER-ENTERED":"DEMO + USER OVERRIDES"}</span></div><div className="vl-mode-tabs" role="group" aria-label="Choose input data mode"><button type="button" className={mode==="demo"?"selected":""} onClick={()=>setMode("demo")}>Automatic preview</button><button type="button" className={mode==="manual"?"selected":""} onClick={()=>setMode("manual")}>Manual / Free-Hand</button><button type="button" className={mode==="hybrid"?"selected":""} onClick={()=>setMode("hybrid")}>Hybrid</button></div><p>{mode==="demo"?"Demonstration snapshot supplied by the local demo data adapter. No live data provider is connected.":mode==="manual"?"Independent valuation without a ticker: enter the financial inputs you know. No provider or credits required.":"Begin with the demonstration snapshot, then override individual figures. Changes do not alter the underlying dataset."}</p>{mode!=="demo"&&<div className="vl-financial-inputs">{([["name","Investment name"],["currency","Currency"],["price","Reference price / share"],["eps","Normalized EPS"],["fcf","Starting FCF / share"]] as [keyof FinancialInputs,string][]).map(([key,label])=><label key={key}><span>{label}</span>{key==="currency"?<select value={active.currency} onChange={e=>updateField(key,e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option></select>:<input type={key==="name"?"text":"number"} min={key==="name"?undefined:"0"} step={key==="name"?undefined:"any"} value={active[key]} onChange={e=>updateField(key,e.target.value)} placeholder={key==="name"?"Private company / investment":"Enter a value"}/>}</label>)}</div>}{!valid&&<p className="vl-error" role="status">Provide a positive reference price and positive FCF per share to calculate this DCF.</p>}{mode==="hybrid"&&<button type="button" className="vl-reset-overrides" onClick={()=>setHybrid(fromSecurity(company))}>Restore demo inputs</button>}</section><section className="vl-panel vl-capital"><div className="vl-panel-title"><h3>Cost of Capital Engine</h3><span>CAPM / WACC · illustrative</span></div><div className="vl-mode-tabs"><button type="button" className={rateMode==="manual"?"selected":""} onClick={()=>setRateMode("manual")}>Manual required return</button><button type="button" className={rateMode==="capm"?"selected":""} onClick={()=>setRateMode("capm")}>CAPM cost of equity</button></div><div className="vl-capital-fields">{([["riskFree","Risk-free rate","%"],["erp","Equity risk premium","%"],["beta","Levered beta","x"],["costDebt","Cost of debt (pre-tax)","%"],["tax","Marginal tax rate","%"],["equityWeight","Equity weight (market value)","%"]] as [keyof Capital,string,string][]).map(([key,label,unit])=><label key={key}><span>{label}</span><div><input type="number" min={0} max={key==="equityWeight"?100:key==="tax"?100:undefined} step={key==="beta"?0.05:0.25} value={capital[key]} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&(key!=="tax"&&key!=="equityWeight"||n<=100))setCapital(old=>({...old,[key]:n}))}}/><small>{unit}</small></div></label>)}</div><div className="vl-capital-results"><div><small>Cost of Equity · CAPM</small><strong>{costEquity.toFixed(2)}%</strong></div><div><small>After-tax WACC</small><strong>{wacc.toFixed(2)}%</strong></div><div><small>Rate used in per-share DCF</small><strong>{effectiveAssumptions.discount.toFixed(2)}%</strong></div></div><p>Current cash-flow model is per share and uses a required equity return, manually specified or estimated via CAPM. WACC is displayed for research only: it must not discount FCFF-per-share without an enterprise-to-equity bridge.</p></section><div className="vl-cards">
  <div><small>Reference price</small><strong>{shown(price)}</strong><span>{mode==="manual"?"Manual input":mode==="hybrid"?"Editable demo input":"Demo price"}</span></div>
  <div><small>DCF base value / share</small><strong>{base?dollar(base.value):"N/A"}</strong><span>Calculated from editable assumptions</span></div>
  <div><small>Price vs. intrinsic value</small><strong className={upside!==null&&upside>=0?"vl-positive":"vl-negative"}>{upside===null?"N/A":(upside>=0?"+":"")+pct(upside)}</strong><span>Value ÷ price − 1</span></div>
  <div><small>Buy-under price</small><strong>{buyBelow===null?"N/A":dollar(buyBelow)}</strong><span>{a.mos}% discount to base value · {active.currency}</span></div>
 </div>
 <ValuationFootballField price={price} currency={active.currency} bear={bear?.value??null} base={base?.value??null} bull={bull?.value??null} mos={a.mos} source="DEMO / USER ASSUMPTIONS"/>
 <div className="vl-main">
  <section className="vl-panel"><div className="vl-panel-title"><h3><SlidersHorizontal size={18}/> Valuation assumptions</h3><button type="button" onClick={()=>setA(initial)}>Reset</button></div><p>Adjust assumptions to recalculate the DCF instantly. No API calls or historical market data.</p><div className="vl-inputs">{inputs.map(([key,label,min,max,step,unit])=><label key={key}><span>{label}<b>{a[key]} {unit}</b></span><input type="range" min={min} max={max} step={step} value={key==="discount"?effectiveAssumptions.discount:a[key]} disabled={key==="discount"&&rateMode==="capm"} onChange={e=>setA(prev=>({...prev,[key]:Number(e.target.value)}))}/></label>)}</div><div className="vl-base">Starting FCF per share <strong>{shown(fcfValue)}</strong></div>{!base&&<p className="vl-error">Required return must exceed terminal growth, and starting FCF and price must be positive.</p>}</section>
  <section className="vl-panel"><div className="vl-panel-title"><h3><ChartColumnIncreasing size={18}/> Scenario analysis</h3><span>DCF / share</span></div><div className="vl-scenarios">{[{label:"Bear",result:bear,sub:"Lower growth, higher discount"},{label:"Base",result:base,sub:"Selected assumptions"},{label:"Bull",result:bull,sub:"Higher growth, lower discount"}].map(s=><div key={s.label}><span>{s.label}</span><strong>{s.result?dollar(s.result.value):"N/A"}</strong><small>{s.sub}</small><div className="vl-meter"><i style={{width:`${s.result&&base?Math.min(100,Math.max(2,s.result.value/(Math.max(bear?.value||0,base.value,bull?.value||0)*1.05)*100)):0}%`}}/></div></div>)}</div><p>Scenarios adjust the growth rate, required return and terminal rate. These are modeled sensitivities, not probability-weighted forecasts.</p></section>
 </div>
 <div className="vl-main">
  <section className="vl-panel"><div className="vl-panel-title"><h3><Calculator size={18}/> Valuation bridge</h3><span>Per share</span></div><div className="vl-bridge"><div><span>PV of projected free cash flows</span><b>{base?dollar(base.pvCashflows):"N/A"}</b></div><div><span>PV of terminal value</span><b>{base?dollar(base.terminalPV):"N/A"}</b></div><div className="vl-total"><span>Intrinsic value estimate</span><b>{base?dollar(base.value):"N/A"}</b></div><div><span>Less required margin of safety</span><b>{a.mos}%</b></div><div className="vl-total"><span>Buy-under threshold</span><b>{buyBelow===null?"N/A":dollar(buyBelow)}</b></div></div><p className="vl-note">Terminal value can dominate DCF outcomes. All values depend heavily on assumed growth, discount rates and cash-flow quality.</p></section>
  <section className="vl-panel"><div className="vl-panel-title"><h3><ShieldCheck size={18}/> Valuation methods</h3><span>Coverage</span></div><div className="vl-methods"><div><b>Discounted cash flow</b><span className="vl-ready">Interactive demo</span></div><div><b>Trading comparables</b><NavLink to="/company">Open peer analysis <ArrowRight size={14}/></NavLink></div><div><b>Reverse DCF</b><span>Planned</span></div><div><b>Graham / earnings power</b><span>Planned</span></div><div><b>Precedent transactions</b><span>Future research layer</span></div></div><NavLink className="vl-next" to="/options">Continue to Options Lab <ArrowRight size={15}/></NavLink></section>
 </div><div className="vl-disclaimer">DEMONSTRATION ENGINE · DATA ORIGIN: DEMO OR USER INPUT · NO LIVE QUOTES · NO VERIFIED FORECASTS · NOT INVESTMENT ADVICE</div>
 </div>;
}
