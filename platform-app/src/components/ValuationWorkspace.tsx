import {useEffect,useMemo,useState} from "react";
import {NavLink} from "react-router-dom";
import {Area,AreaChart,CartesianGrid,ComposedChart,Line,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {ArrowRight,Database,FlaskConical,RefreshCcw,ShieldCheck} from "lucide-react";
import type {RealAsset} from "./RealResearch";
import appleResearch from "../data/aaplResearch.json";
import {ValuationFootballField} from "./ValuationFootballField";
import {dcfModel,dividendModel,grahamModel,modelDefaults,money,requiredReturnModel,type Financials,type ModelInputs,type ValuationMethod,type ValuationMode} from "../core/valuationModels";
import "./native-research.css";
const tabs:{id:ValuationMethod;label:string;sub:string}[]=[
 {id:"dcf",label:"DCF Engine",sub:"Intrinsic cash flow"},
 {id:"required-return",label:"Required Return",sub:"Entry-price discipline"},
 {id:"graham",label:"Graham / Lynch",sub:"Earnings & PEG"},
 {id:"dividend",label:"Dividend Value",sub:"30-year DDM"},
 {id:"peers",label:"Peer Comparables",sub:"Verified peers only"}
];
const num=(value:string)=>value.trim()===""?null:Number.isFinite(Number(value))?Number(value):null;
const valueString=(v:number|null)=>v===null?"":String(v);
const percent=(v:number|null)=>v===null||!Number.isFinite(v)?"N/D":v.toFixed(1)+"%";
type Field=keyof Omit<Financials,"currency">;
const inputFields:{key:Field;label:string;hint:string}[]=[
 {key:"price",label:"Reference price",hint:"Per share"},
 {key:"eps",label:"Normalized EPS",hint:"Per share"},
 {key:"fcf",label:"Free cash flow",hint:"Per share"},
 {key:"dividend",label:"Annual dividend",hint:"Per share"},
 {key:"beta",label:"Equity beta",hint:"Levered"}
];
const assumptionsByTab:Record<ValuationMethod,{key:keyof ModelInputs;label:string;step:number}[]>={
 dcf:[{key:"growth",label:"FCF growth %",step:0.5},{key:"discount",label:"Equity discount %",step:0.5},{key:"terminal",label:"Terminal growth %",step:0.25},{key:"years",label:"Forecast years",step:1},{key:"mos",label:"Margin of safety %",step:1}],
 "required-return":[{key:"growth",label:"EPS growth Y1–5 %",step:0.5},{key:"growth2",label:"EPS growth Y6–10 %",step:0.5},{key:"divGrowth",label:"Dividend growth Y1–5 %",step:0.5},{key:"divGrowth2",label:"Dividend growth Y6–10 %",step:0.5},{key:"requiredReturn",label:"Target return %",step:0.5},{key:"exitPe",label:"Exit P/E",step:0.5}],
 graham:[{key:"growth",label:"Expected EPS growth %",step:0.5},{key:"aaaYield",label:"AAA corporate bond yield %",step:0.1}],
 dividend:[{key:"dividendGrowth",label:"Dividend growth Y1–10 %",step:0.5},{key:"dividendTerminal",label:"Terminal growth %",step:0.25},{key:"dividendDiscount",label:"Equity discount %",step:0.5}],
 peers:[]
};
const fmt=(value:number)=>Number.isFinite(value)?value.toFixed(2):"N/D";
export type ValuationBridge={fairValue:number|null;buyUnder:number|null;source:string};
export function ValuationWorkspace({asset,tab="dcf",onUpdate}:{asset:RealAsset;tab?:string;onUpdate?:(ticker:string,bridge:ValuationBridge)=>void}){
 const active=(tabs.find(x=>x.id===tab)?.id||"dcf") as ValuationMethod;
 const [mode,setMode]=useState<ValuationMode>("automatic");
 const [manual,setManual]=useState<Record<Field,string>>({price:"",eps:"",fcf:"",dividend:"",beta:""});
 const [overrides,setOverrides]=useState<Partial<Record<Field,string>>>({});
 const [a,setA]=useState<ModelInputs>(modelDefaults);
 const [rateMode,setRateMode]=useState<"manual"|"capm">("manual");
 const [riskFree,setRiskFree]=useState(4);
 const [erp,setErp]=useState(5.5);
 const snapshotDividend=asset.price!==null&&asset.dividendYield!==null?asset.price*asset.dividendYield/100:null;
 const source:Financials={price:asset.price,eps:asset.eps,fcf:asset.ticker==="AAPL"?appleResearch.fcfPerShare:null,dividend:snapshotDividend,beta:asset.beta,currency:asset.currency||"USD"};
 const financials:Financials={...source};
 for(const {key} of inputFields){
  if(mode==="manual")financials[key]=num(manual[key]);
  if(mode==="hybrid"&&overrides[key]!==undefined)financials[key]=num(overrides[key]||"");
 }
 const rate=rateMode==="capm"?(financials.beta===null?null:riskFree+financials.beta*erp):a.discount;
 const base=rate===null?null:dcfModel(financials.fcf,a.growth,rate,a.terminal,a.years);
 const bear=rate===null?null:dcfModel(financials.fcf,a.growth-3,rate+2,Math.max(0,a.terminal-1),a.years);
 const bull=rate===null?null:dcfModel(financials.fcf,a.growth+3,Math.max(1,rate-1),Math.min(a.terminal+0.5,Math.max(0,rate-1.5)),a.years);
 const graham=grahamModel(financials.eps,a.growth,a.aaaYield,financials.price,financials.dividend!==null&&financials.price!==null&&financials.price>0?financials.dividend/financials.price*100:null);
 const ddm=dividendModel(financials.dividend,a.dividendGrowth,a.dividendTerminal,a.dividendDiscount);
 const required=requiredReturnModel(financials.eps,financials.dividend,a);
 const currency=financials.currency;
 const publishedFairValue=mode==="manual"?null:base?.value??null;
 const publishedBuyUnder=publishedFairValue===null?null:publishedFairValue*(1-a.mos/100);
 useEffect(()=>{onUpdate?.(asset.ticker,{fairValue:publishedFairValue,buyUnder:publishedBuyUnder,source:mode==="hybrid"?"HYBRID · USER OVERRIDES":"SNAPSHOT + MODEL ASSUMPTIONS"});},[asset.ticker,publishedFairValue,publishedBuyUnder,mode,onUpdate]);
 const sourceLabel=mode==="manual"?"USER INPUT ONLY":mode==="hybrid"?"SNAPSHOT + USER OVERRIDES":"SHEET SNAPSHOT · NOT LIVE";
 const setField=(key:Field,value:string)=>{if(mode==="manual")setManual(prev=>({...prev,[key]:value}));else setOverrides(prev=>({...prev,[key]:value}))};
 const chartRows=useMemo(()=>base?.projection.map(x=>({year:"Y"+x.year,cashflow:x.cashflow,presentValue:x.pv}))||[],[base]);
 const selected=tabs.find(t=>t.id===active)!;
 const noValue=active==="dcf"&&!base||active==="graham"&&!graham||active==="dividend"&&!ddm||active==="required-return"&&!required;
 return <div className="nr-workspace">
  <header className="nr-hero"><div><span className="nr-eyebrow">OPTIONSCRAFTED / VALUATION INTELLIGENCE</span><h2>Valuation Lab <span>2.0</span></h2><p>One financial model layer, five research methods. Calculated values flow directly into the Football Field.</p></div><div className="nr-hero-meta"><Database size={17}/><strong>{asset.ticker}</strong><span>{sourceLabel}</span></div></header>
  <nav className="nr-tabbar" aria-label="Valuation methods">{tabs.map(t=><NavLink key={t.id} to={"/valuation/"+t.id} className={active===t.id?"active":""}><b>{t.label}</b><small>{t.sub}</small></NavLink>)}</nav>
  <section className="nr-control-card">
   <div className="nr-section-title"><div><span className="nr-eyebrow">DATA PROVENANCE</span><h3>Input source & financial bridge</h3></div><span className="nr-status"><ShieldCheck size={14}/> {sourceLabel}</span></div>
   <div className="nr-mode" role="group" aria-label="Valuation data mode">
    {(["automatic","hybrid","manual"] as ValuationMode[]).map(m=><button type="button" key={m} className={mode===m?"active":""} onClick={()=>setMode(m)}>{m==="automatic"?"Automatic snapshot":m==="hybrid"?"Hybrid · overrides":"Manual · free-hand"}</button>)}
   </div>
   <p className="nr-source-note">{mode==="automatic"?"Only available financial snapshot values are used. Missing FCF remains N/D, except Apple's separately sourced SEC research snapshot. Forecast assumptions remain editable.":mode==="hybrid"?"Snapshot values are prefilled; replace individual fields without modifying the underlying source. An override is labeled user input.":"All company financial inputs start blank. Enter only what you know; no fabricated defaults."}</p>
   <div className="nr-field-grid">{inputFields.map(f=><label key={f.key}><span>{f.label}<small>{mode==="hybrid"&&overrides[f.key]!==undefined?"USER OVERRIDE":mode==="manual"?"MANUAL":f.key==="fcf"&&source.fcf!==null?"SEC SNAPSHOT":"SHEET SNAPSHOT"}</small></span><input type="number" step="any" value={mode==="manual"?manual[f.key]:mode==="hybrid"?(overrides[f.key]??valueString(source[f.key])):valueString(source[f.key])} disabled={mode==="automatic"} onChange={e=>setField(f.key,e.target.value)} placeholder="N/D"/></label>)}</div>
   {mode==="hybrid"&&<button className="nr-text-button" type="button" onClick={()=>setOverrides({})}><RefreshCcw size={13}/> Clear overrides</button>}
   <p className="nr-source-note">AAPL FCF/share: SEC-based approximate TTM ending June 2026. Dividend/share is derived from price × snapshot dividend yield; confirm payment sustainability before using DDM. All quotes are historical snapshots, not live feeds.</p>
  </section>
  <div className="nr-metric-grid">
   {[["DCF intrinsic",base?.value??null,"CASH FLOW"],["Graham anchor",graham?.adjusted??graham?.classic??null,graham?.adjusted!==null&&graham?.adjusted!==undefined?"BOND-ADJUSTED":"CLASSIC"],["Dividend DDM",ddm?.value??null,"INTRINSIC"],["Required-return entry",required?.entry??null,"ENTRY PRICE · NOT FAIR VALUE"]].map(([label,v,tag])=><div className="nr-metric" key={label as string}><span>{label as string}</span><strong>{money(v as number|null,currency)}</strong><small>{tag as string}</small></div>)}
  </div>
  <ValuationFootballField price={financials.price} currency={currency} bear={bear?.value??null} base={base?.value??null} bull={bull?.value??null} graham={graham?.adjusted??graham?.classic??null} dividend={ddm?.value??null} mos={a.mos} source={sourceLabel} extra={required?[{label:"Required-return entry",low:required.entry,mid:required.entry,high:required.entry,kind:"entry" as const,detail:"10Y required-return price, not an intrinsic estimate"}]:[]}/>
  <section className="nr-model-layout">
   <div className="nr-control-card"><div className="nr-section-title"><div><span className="nr-eyebrow">MODEL CONFIGURATION</span><h3>{selected.label}</h3></div><span className="nr-status"><FlaskConical size={14}/> ASSUMPTIONS</span></div>
    {active==="peers"?<p className="nr-source-note">Peer multiples need an audited comparable-company set, normalized EBITDA/earnings and consistent fiscal periods. No fabricated peer valuations are published.</p>:<>
    <div className="nr-field-grid nr-assumptions">{assumptionsByTab[active].map(f=><label key={f.key}><span>{f.label}</span><input type="number" step={f.step} value={a[f.key]??""} onChange={e=>{const n=e.target.value===""?null:Number(e.target.value);setA(prev=>({...prev,[f.key]:n}))}} placeholder="Enter rate"/></label>)}</div>
    {active==="dcf"&&<div className="nr-capm"><span>Discount rate source</span><div className="nr-mode"><button type="button" className={rateMode==="manual"?"active":""} onClick={()=>setRateMode("manual")}>Manual</button><button type="button" className={rateMode==="capm"?"active":""} onClick={()=>setRateMode("capm")}>CAPM</button></div>{rateMode==="capm"&&<div className="nr-field-grid"><label><span>Risk-free % · assumption</span><input type="number" value={riskFree} step="0.1" onChange={e=>setRiskFree(Number(e.target.value))}/></label><label><span>Equity risk premium % · assumption</span><input type="number" value={erp} step="0.1" onChange={e=>setErp(Number(e.target.value))}/></label></div>}<small>Applied equity discount rate: {rate===null?"N/D":rate.toFixed(2)+"%"} · WACC is not used to discount equity FCF/share.</small></div>}
    <button type="button" className="nr-text-button" onClick={()=>setA(modelDefaults)}><RefreshCcw size={13}/> Reset assumptions</button>
    </>}
    {noValue&&<div className="nr-empty" role="status">Model awaiting valid financial inputs and assumptions. No value is published until the required fields are available.</div>}
   </div>
   <div className="nr-chart-card">
    <div className="nr-section-title"><div><span className="nr-eyebrow">MODEL VISUALIZATION</span><h3>{active==="dcf"?"Projected free cash flow":active==="required-return"?"Ten-year EPS & dividend path":active==="dividend"?"Dividend cash-flow projection":active==="graham"?"Graham valuation bridge":"Comparable valuation coverage"}</h3></div><span className="nr-status">RECHARTS · VECTOR</span></div>
    {active==="dcf"&&base?<ResponsiveContainer width="100%" height={290}><ComposedChart data={chartRows} margin={{top:16,right:14,left:4,bottom:5}}><CartesianGrid stroke="#203b58" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="year" stroke="#9ab3ca" tickLine={false} axisLine={false}/><YAxis stroke="#9ab3ca" tickLine={false} axisLine={false} width={48}/><Tooltip contentStyle={{background:"#132c48",border:"1px solid #365775",borderRadius:10,color:"#e8f2ff"}} formatter={(v:number)=>money(v,currency)}/><Area type="monotone" dataKey="cashflow" name="FCF / share" stroke="#4ba7ff" fill="#2279c1" fillOpacity={0.28} strokeWidth={3}/><Line type="monotone" dataKey="presentValue" name="PV / share" stroke="#e9bc69" strokeWidth={2} dot={false}/></ComposedChart></ResponsiveContainer>:null}
    {active==="required-return"&&required?<ResponsiveContainer width="100%" height={290}><AreaChart data={required.projection} margin={{top:16,right:14,left:4,bottom:5}}><CartesianGrid stroke="#203b58" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="year" stroke="#9ab3ca" tickLine={false} axisLine={false}/><YAxis stroke="#9ab3ca" tickLine={false} axisLine={false} width={48}/><Tooltip contentStyle={{background:"#132c48",border:"1px solid #365775",borderRadius:10,color:"#e8f2ff"}} formatter={(v:number)=>money(v,currency)}/><Area type="monotone" dataKey="eps" name="EPS" stroke="#53aaff" fill="#2479bd" fillOpacity={0.26} strokeWidth={3}/><Area type="monotone" dataKey="dividend" name="Dividend" stroke="#efbe69" fill="#efbe69" fillOpacity={0.12} strokeWidth={2}/></AreaChart></ResponsiveContainer>:null}
    {active==="dividend"&&ddm?<ResponsiveContainer width="100%" height={290}><AreaChart data={ddm.projection.filter(x=>x.year===1||x.year%2===0)} margin={{top:16,right:14,left:4,bottom:5}}><CartesianGrid stroke="#203b58" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="year" stroke="#9ab3ca" tickLine={false} axisLine={false}/><YAxis stroke="#9ab3ca" tickLine={false} axisLine={false} width={48}/><Tooltip contentStyle={{background:"#132c48",border:"1px solid #365775",borderRadius:10,color:"#e8f2ff"}} formatter={(v:number)=>money(v,currency)}/><Area type="monotone" dataKey="dividend" name="Dividend" stroke="#53aaff" fill="#2479bd" fillOpacity={0.26} strokeWidth={3}/><Area type="monotone" dataKey="pv" name="PV dividend" stroke="#efbe69" fill="#efbe69" fillOpacity={0.12} strokeWidth={2}/></AreaChart></ResponsiveContainer>:null}
    {active==="graham"&&graham?<div className="nr-bridge"><div><span>Classic Graham</span><b>{money(graham.classic,currency)}</b></div><div><span>Bond-adjusted Graham</span><b>{money(graham.adjusted,currency)}</b></div><div><span>PEG</span><b>{graham.peg===null?"N/D":fmt(graham.peg)}</b></div><div><span>Dividend-adjusted PEG</span><b>{graham.pegDividend===null?"N/D":fmt(graham.pegDividend)}</b></div></div>:null}
    {active==="peers"||noValue?<div className="nr-chart-empty"><Database size={27}/><strong>{active==="peers"?"Peer data not yet validated":"Waiting for valid model inputs"}</strong><span>No simulated historical series or peer estimates are displayed.</span></div>:null}
    {active==="dcf"&&base?<div className="nr-bridge"><div><span>PV explicit FCF</span><b>{money(base.pvCashflows,currency)}</b></div><div><span>PV terminal</span><b>{money(base.pvTerminal,currency)}</b></div><div><span>Buy-under at {a.mos}% MOS</span><b>{money(base.value*(1-a.mos/100),currency)}</b></div></div>:null}
    {active==="dividend"&&ddm?<div className="nr-bridge"><div><span>PV dividends</span><b>{money(ddm.pvDividends,currency)}</b></div><div><span>PV terminal</span><b>{money(ddm.pvTerminal,currency)}</b></div></div>:null}
    {active==="required-return"&&required?<div className="nr-bridge"><div><span>Year-10 exit value</span><b>{money(required.exitValue,currency)}</b></div><div><span>Future value dividends</span><b>{money(required.futureDividends,currency)}</b></div><div><span>Buy-now-below</span><b>{money(required.entry,currency)}</b></div></div>:null}
   </div>
  </section>
  <div className="nr-footnote"><strong>Research boundary.</strong> Snapshot financial inputs are not live quotes. Growth, discount, multiples and exit prices are user-editable scenarios, not verified forecasts. Required-return entry price is not averaged into intrinsic fair value. <NavLink to="/options/csp">Continue to Options Execution <ArrowRight size={13}/></NavLink></div>
 </div>;
}
