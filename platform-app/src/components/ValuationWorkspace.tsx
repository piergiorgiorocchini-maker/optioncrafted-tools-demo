import {useEffect,useMemo,useState} from "react";
import {NavLink} from "react-router-dom";
import {Bar,BarChart,CartesianGrid,LabelList,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {ArrowRight,Database,FlaskConical,RefreshCcw} from "lucide-react";
import type {RealAsset} from "./RealResearch";
import {buildValuationTriangulation,type ValuationBridge} from "../core/valuationTriangulation";
export type {ValuationBridge} from "../core/valuationTriangulation";
import {verifiedAnnualHistory,verifiedFcf} from "../data/verifiedFinancials";
import {getManualTtmFinancials} from "../data/googleSheetsManualFinancials";
import {SecurityLogo} from "./SecurityLogo";
import {DividendResearchPanel} from "./DividendResearchPanel";
import {GrahamInterpretationPanel,GrahamResearchPanel} from "./GrahamResearchPanel";
import {WaccResearchPanel} from "./WaccResearchPanel";
import aaaYieldSnapshot from "../data/aaaYieldSnapshot.json";
import {automaticGrahamGrowth} from "../core/grahamGrowth";
import {grahamSectorGrowth} from "../core/grahamSectorGrowth";
import {googleSheetsSecAnnualHistory} from "../data/googleSheetsSecFinancials";
import {dcfModel,dividendModel,grahamModel,modelDefaults,money,requiredReturnModel,type Financials,type ModelInputs,type ValuationMethod,type ValuationMode} from "../core/valuationModels";
import "./native-research.css";
type DiscountTab="manual"|"capm"|"wacc";
const tabs:{id:ValuationMethod;label:string;sub:string}[]=[
 {id:"dcf",label:"DCF Engine",sub:"Intrinsic cash flow"},
 {id:"required-return",label:"Required Return",sub:"Entry-price discipline"},
 {id:"graham",label:"Graham Valuation",sub:"Graham formula"},
 {id:"dividend",label:"Dividend Value",sub:"30-year DDM"},
 {id:"peers",label:"Peer Comparables",sub:"Verified peers only"}
];
const num=(value:string)=>value.trim()===""?null:Number.isFinite(Number(value))?Number(value):null;
const valueString=(v:number|null)=>v===null?"":String(v);
type Field=keyof Omit<Financials,"currency">;
const inputFields:{key:Field;label:string;hint:string}[]=[
 {key:"price",label:"Reference price",hint:"Per share"},
 {key:"eps",label:"EPS TTM",hint:"Per share"},
 {key:"fcf",label:"Free cash flow",hint:"Per share"},
 {key:"dividend",label:"Annual dividend",hint:"Per share"},
 {key:"beta",label:"Equity beta",hint:"Levered"}
];
const assumptionsByTab:Record<ValuationMethod,{key:keyof ModelInputs;label:string;step:number}[]>={
 dcf:[{key:"growth",label:"FCF growth %",step:0.5},{key:"discount",label:"Equity discount %",step:0.5},{key:"terminal",label:"Terminal growth %",step:0.25},{key:"years",label:"Forecast years",step:1},{key:"mos",label:"Margin of safety %",step:1}],
 "required-return":[{key:"growth",label:"EPS growth Y1–5 %",step:0.5},{key:"growth2",label:"EPS growth Y6–10 %",step:0.5},{key:"divGrowth",label:"Dividend growth Y1–5 %",step:0.5},{key:"divGrowth2",label:"Dividend growth Y6–10 %",step:0.5},{key:"requiredReturn",label:"Target return %",step:0.5},{key:"exitPe",label:"Exit P/E",step:0.5}],
 graham:[{key:"growth",label:"Expected EPS growth %",step:0.5},{key:"aaaYield",label:"AAA corporate bond yield %",step:0.1}],
 dividend:[{key:"dividendGrowth",label:"Dividend growth Y1–10 %",step:0.5},{key:"dividendTerminal",label:"Perpetual growth Y11+ %",step:0.25},{key:"dividendDiscount",label:"Target rate of return %",step:0.5}],
 peers:[]
};
export function ValuationWorkspace({asset,tab="required-return",onUpdate,premiumDcf=false,grahamManualOverride=null,onGrahamManualChange}:{asset:RealAsset;tab?:string;onUpdate?:(ticker:string,bridge:ValuationBridge)=>void;premiumDcf?:boolean;grahamManualOverride?:{eps:number|null;growth:number;aaaYield:number|null}|null;onGrahamManualChange?:(ticker:string,inputs:{eps:number|null;growth:number;aaaYield:number|null}|null)=>void}){
 const active=(premiumDcf?"dcf":(tabs.find(x=>x.id===tab&&x.id!=="dcf"&&x.id!=="peers")?.id||"required-return")) as ValuationMethod;
 const [mode,setMode]=useState<ValuationMode>(grahamManualOverride&&tab==="graham"?"manual":"automatic");
 const [manual,setManual]=useState<Record<Field,string>>({price:"",eps:grahamManualOverride?.eps===null||grahamManualOverride?.eps===undefined?"":String(grahamManualOverride.eps),fcf:"",dividend:"",beta:""});
 const [overrides,setOverrides]=useState<Partial<Record<Field,string>>>({});
 const [a,setA]=useState<ModelInputs>({...modelDefaults,aaaYield:grahamManualOverride?.aaaYield??aaaYieldSnapshot.value,growth:grahamManualOverride?.growth??modelDefaults.growth});
 const [aaaManual,setAaaManual]=useState(false);
 const [rateMode,setRateMode]=useState<DiscountTab>(()=>{try{const saved=localStorage.getItem("optionscrafted.valuation.dcf-rate-tab.v1");return saved==="capm"||saved==="wacc"?saved:"manual"}catch{return"manual"}});
 const [requiredBasis,setRequiredBasis]=useState<"eps"|"fcf">("eps");
 const [riskFree,setRiskFree]=useState(4);
 const [erp,setErp]=useState(5.5);
 const snapshotDividend=asset.price!==null&&asset.dividendYield!==null?asset.price*asset.dividendYield/100:null;
 const fcfEvidence=verifiedFcf(asset.ticker,asset.currency);
 const manualTtm=getManualTtmFinancials(asset.ticker,asset.currency);
 const secAnnual=verifiedAnnualHistory(asset.ticker,asset.currency).at(-1);
 const epsValue=manualTtm?.dilutedEps??asset.eps??secAnnual?.eps??null;
  const source:Financials={price:asset.price,eps:epsValue,fcf:fcfEvidence.perShare,dividend:snapshotDividend,beta:asset.beta,currency:asset.currency||"USD"};
 const financials:Financials={...source};
 for(const {key} of inputFields){
  if(mode==="manual")financials[key]=num(manual[key]);
  if(mode==="hybrid"&&overrides[key]!==undefined)financials[key]=num(overrides[key]||"");
 }
 const rate=rateMode==="capm"?(financials.beta===null?null:riskFree+financials.beta*erp):a.discount;
 const base=rate===null?null:dcfModel(financials.fcf,a.growth,rate,a.terminal,a.years);
 const bear=rate===null?null:dcfModel(financials.fcf,a.growth-3,rate+2,Math.max(0,a.terminal-1),a.years);
 const bull=rate===null?null:dcfModel(financials.fcf,a.growth+3,Math.max(1,rate-1),Math.min(a.terminal+0.5,Math.max(0,rate-1.5)),a.years);
 const currentDividendYield=financials.dividend!==null&&financials.price!==null&&financials.price>0?financials.dividend/financials.price*100:null;
 const grahamGrowthEvidence=automaticGrahamGrowth(googleSheetsSecAnnualHistory(asset.ticker,asset.currency));
 const grahamGrowthPolicy=grahamSectorGrowth(asset.sector);
 const grahamGrowth=active==="graham"&&mode==="automatic"?grahamGrowthPolicy.rate:a.growth;
 const grahamYield=active==="graham"&&mode==="automatic"?aaaYieldSnapshot.value:a.aaaYield;
 const graham=grahamModel(financials.eps,grahamGrowth??Number.NaN,grahamYield,financials.price,currentDividendYield);
 const ddm=dividendModel(financials.dividend,a.dividendGrowth,a.dividendTerminal,a.dividendDiscount);
 const required=requiredReturnModel(financials[requiredBasis],financials.dividend,a);
 const currency=financials.currency;
 const hybridScenario=mode==="hybrid"&&Object.keys(overrides).length>0?base?.value??null:null;
 const grahamManual=active==="graham"&&mode==="manual"?{eps:financials.eps,growth:a.growth,aaaYield:a.aaaYield}:grahamManualOverride??undefined;
 const publishedValuation=useMemo(()=>{const result=buildValuationTriangulation(asset,{dcfScenarioValue:hybridScenario,dcfScenarioLabel:"Valuation Lab DCF scenario with user overrides",marginOfSafety:a.mos,grahamManual});return hybridScenario!==null?{...result,source:"Google Sheets SEC_Raw + Valuation Lab DCF scenario + family-balanced model"}:result;},[asset,hybridScenario,a.mos,grahamManual?.eps,grahamManual?.growth,grahamManual?.aaaYield]);
 useEffect(()=>{onUpdate?.(asset.ticker,publishedValuation);},[asset.ticker,publishedValuation,onUpdate]);
 useEffect(()=>{
  if(active!=="graham"||mode!=="manual"||!onGrahamManualChange)return;
  onGrahamManualChange(asset.ticker,{eps:financials.eps,growth:a.growth,aaaYield:a.aaaYield});
 },[active,mode,asset.ticker,financials.eps,a.growth,a.aaaYield,onGrahamManualChange]);
 const setField=(key:Field,value:string)=>{if(mode==="manual")setManual(prev=>({...prev,[key]:value}));else setOverrides(prev=>({...prev,[key]:value}))};
 const chartRows=useMemo(()=>base?.projection.map(x=>({year:"Y"+x.year,cashflow:x.cashflow,presentValue:x.pv}))||[],[base]);
 const selected=tabs.find(t=>t.id===active)!;
 const lastRequiredYear=required?.projection[required.projection.length-1]??null;
 const requiredTotal=required?required.exitValue+required.futureDividends:null;
 const requiredSaleYield=lastRequiredYear&&required&&required.exitValue>0&&financials.dividend!==null?lastRequiredYear.dividend/required.exitValue*100:null;
 const requiredMetricName=requiredBasis==="eps"?"EPS":"FCF / share";
 const requiredMultipleName=requiredBasis==="eps"?"P/E":"P/FCF";
 const requiredReturnText=Number.isFinite(a.requiredReturn)?a.requiredReturn.toFixed(2)+"%":"N/D";
 const noValue=active==="dcf"&&!base||active==="graham"&&!graham||active==="dividend"&&!ddm||active==="required-return"&&!required;
 const chooseRateTab=(next:DiscountTab)=>{setRateMode(next);try{localStorage.setItem("optionscrafted.valuation.dcf-rate-tab.v1",next)}catch{}};
 const isWaccTab=active==="dcf"&&rateMode==="wacc";
 const showOtherValuationControls=active!=="graham";
 const sensitivityPanel=active==="dcf"?<section className="nr-panel nr-sensitivity"><div className="nr-section-title"><div><span className="nr-eyebrow">SENSITIVITY ANALYSIS</span></div></div>{base?<div className="nr-sensitivity-wrap"><table><thead><tr><th>FCF growth ↓ · Return →</th>{[-2,-1,0,1,2].map(d=><th key={d}>{(rate!+d).toFixed(1)}%</th>)}</tr></thead><tbody>{[-2,-1,0,1,2].map(gap=>{const growth=a.growth+gap;return <tr key={gap}><th>{growth.toFixed(1)}%</th>{[-2,-1,0,1,2].map(d=>{const r=rate!+d,result=dcfModel(financials.fcf,growth,r,a.terminal,a.years),isBase=gap===0&&d===0;return <td key={d} className={isBase?"is-base":""}>{result&&r>a.terminal?money(result.value,currency):"—"}</td>})}</tr>})}</tbody></table></div>:<p className="nr-chart-empty">Enter a positive FCF/share and valid discount assumptions to see the sensitivity table.</p>}</section>:null;
 return <div className={"nr-workspace"+(active==="required-return"||active==="dividend"?" nr-workspace--required":"")+(active==="graham"?" nr-workspace--graham":"")}>
  <header className="nr-hero"><div><span className="nr-eyebrow">{premiumDcf?"PREMIUM ANALYSIS / CASH FLOW":"OPTIONSCRAFTED / VALUATION INTELLIGENCE"}</span><h2>{premiumDcf?"DCF Engine":<>Valuation Lab <span>2.0</span></>}</h2><p>{premiumDcf?"Manual DCF, CAPM and WACC methods with explicit assumptions and sensitivity analysis.":"Standalone valuation calculators. Results depend on the data and assumptions entered for each method."}</p></div><div className="nr-hero-meta"><SecurityLogo ticker={asset.ticker}/><strong>{asset.ticker}</strong></div></header>
  {!premiumDcf&&<nav className="nr-tabbar" aria-label="Standalone valuation methods">{tabs.filter(t=>t.id!=="dcf"&&t.id!=="peers").map(t=><NavLink key={t.id} to={"/valuation/"+t.id} className={active===t.id?"active":""}><b>{t.label}</b><small>{t.sub}</small></NavLink>)}</nav>}
  {active==="required-return"&&<section className="nr-required-lead" aria-label="Required return primary result">
    <div><span className="nr-eyebrow">REQUIRED RETURN · ENTRY DISCIPLINE</span><h3>Buy Now Below</h3><strong>{money(required?.entry??null,currency)}</strong><small>Target return {requiredReturnText} per year · entry threshold, not Fair Value</small></div>
   </section>}
  {active==="required-return"&&<div className="nr-required-io" aria-label="Required return two-stage model">
   <section className="nr-required-io-panel nr-required-io-chart" aria-label="Expected ten-year growth chart">
    <h3>EXPECTED GROWTH</h3>
    <div className="nr-required-compact-chart">
     {required?<ResponsiveContainer width="100%" height={470}>
      <BarChart data={required.projection} margin={{top:12,right:3,left:0,bottom:0}} barGap={1} barCategoryGap="14%">
       <CartesianGrid stroke="#46566a" vertical={false} strokeDasharray="3 3"/>
       <XAxis dataKey="year" tick={{fontSize:11,fill:"#e6edf4"}} tickLine={false} axisLine={false}/>
       <YAxis width={43} tick={{fontSize:10,fill:"#e6edf4"}} tickLine={false} axisLine={false} tickFormatter={v=>Number(v).toFixed(0)}/>
       <Tooltip contentStyle={{background:"#fff",border:"1px solid #cad9e9",borderRadius:5}} formatter={v=>money(Number(v),currency)} labelFormatter={v=>"Year "+v}/>
       <Bar dataKey="eps" name={requiredMetricName} fill="#80ad63" maxBarSize={17}/>
       <Bar dataKey="dividend" name="Dividends / share" fill="#d7b35e" maxBarSize={17}/>
      </BarChart>
     </ResponsiveContainer>:<p className="nr-required-io-empty">Enter valid inputs to see the forecast.</p>}
     <div className="nr-required-chart-key"><span><i className="nr-required-key-eps"/>{requiredMetricName}</span><span><i className="nr-required-key-div"/>Dividends</span></div>
    </div>
   </section>
   <section className="nr-required-io-panel nr-required-io-inputs" aria-label="Two-stage required return inputs">
    <h3>INPUTS</h3>
    <div className="nr-required-io-rows">
     {assumptionsByTab["required-return"].map(f=><label key={f.key}><span>{requiredBasis==="fcf"?f.label.replace("EPS growth","FCF growth").replace("Exit P/E","Exit P/FCF"):f.label}</span><input type="number" step={f.step} value={a[f.key]??""} onChange={e=>{const n=e.target.value===""?Number.NaN:Number(e.target.value);setA(prev=>({...prev,[f.key]:n}))}}/></label>)}
    </div>
    <small>Projection basis: {requiredBasis==="eps"?"EPS / P/E":"FCF / P/FCF"} · 10 years</small>
   </section>
   <section className="nr-required-io-panel nr-required-io-outputs" aria-label="Two-stage required return outputs">
    <h3>OUTPUTS</h3>
    <div className="nr-required-io-rows">
     <div><span>Sale price in year 10</span><strong>{money(required?.exitValue??null,currency)}</strong></div>
     <div><span>Dividend yield at sale</span><strong>{requiredSaleYield===null?"N/D":requiredSaleYield.toFixed(2)+"%"}</strong></div>
     <div><span>Sum of reinvested dividends</span><strong>{money(required&&financials.dividend!==null?required.futureDividends:null,currency)}</strong></div>
     <div><span>Total terminal value</span><strong>{money(requiredTotal,currency)}</strong></div>
     <div className="nr-required-io-key-result"><span>Buy Now Below</span><strong>{money(required?.entry??null,currency)}</strong></div>
    </div>
    <div className="nr-required-annual-table-wrap">
     <table className="nr-required-annual-table" aria-label="Ten-year expected EPS and annual dividends">
      <thead><tr><th>Year</th><th>{requiredMetricName}</th><th>Dividends / Share</th></tr></thead>
      <tbody>{required?required.projection.map(year=><tr key={year.year}><td>{year.year}</td><td>{money(year.eps,currency)}</td><td>{financials.dividend===null?"N/D":money(year.dividend,currency)}</td></tr>):<tr><td colSpan={3}>Awaiting valid financial inputs</td></tr>}</tbody>
     </table>
    </div>
   </section>
  </div>}
  {active==="graham"&&<section className="nr-graham-top-summary" aria-label="Graham valuation result">
   <div><span className="nr-eyebrow">GRAHAM VALUATION · {mode==="manual"?"MANUAL":"AUTOMATIC"}</span><h3>Graham Composite</h3><strong>{money(publishedValuation.methods.find(method=>method.family==="earnings"&&method.status==="AVAILABLE")?.value??null,currency)}</strong><p>Classic {money(publishedValuation.grahamComponents.find(part=>part.id==="classic")?.value??null,currency)} + Aaa-adjusted {money(publishedValuation.grahamComponents.find(part=>part.id==="aaa")?.value??null,currency)} · equal-weight mean</p></div>
  </section>}
  {active==="dcf"&&<nav className="nr-rate-tabs" role="tablist" aria-label="DCF discount method"><button type="button" role="tab" aria-selected={rateMode==="manual"} className={rateMode==="manual"?"active":""} onClick={()=>chooseRateTab("manual")}>Manual DCF</button><button type="button" role="tab" aria-selected={rateMode==="capm"} className={rateMode==="capm"?"active":""} onClick={()=>chooseRateTab("capm")}>CAPM</button><button type="button" role="tab" aria-selected={rateMode==="wacc"} className={rateMode==="wacc"?"active":""} onClick={()=>chooseRateTab("wacc")}>WACC</button></nav>}
  {isWaccTab?<WaccResearchPanel ticker={asset.ticker}/>:<>
  {active==="dcf"&&<div className="nr-metric-grid nr-dcf-summary-first" aria-label="DCF valuation summary">
   {[["Intrinsic Value",base?.value??null,"DCF · CASH FLOW"],["Graham Anchor",graham?.adjusted??graham?.classic??null,graham?.adjusted!==null&&graham?.adjusted!==undefined?"BOND-ADJUSTED":"CLASSIC"],["Dividend Value",ddm?.value??null,"DDM · INTRINSIC"],["Entry Price",required?.entry??null,"REQUIRED RETURN · NOT FAIR VALUE"]].map(([label,v,tag])=><div className={"nr-metric"+(label==="Intrinsic Value"?" nr-dcf-primary-value":"")} key={label as string}><span>{label as string}</span><strong>{money(v as number|null,currency)}</strong><small>{tag as string}</small></div>)}
  </div>}
  {active==="dcf"&&sensitivityPanel}
  {active==="graham"&&<div className="nr-graham-io">
   <section className="nr-graham-io-panel" aria-label="Graham inputs">
    <h3>INPUTS</h3>
    <div className="nr-graham-io-mode" role="group" aria-label="Graham data mode">
     <button type="button" className={mode==="automatic"?"active":""} aria-pressed={mode==="automatic"} onClick={()=>{setMode("automatic");onGrahamManualChange?.(asset.ticker,null)}}>Automatic</button>
     <button type="button" className={mode==="manual"?"active":""} aria-pressed={mode==="manual"} onClick={()=>{
      if(mode!=="manual"){
       setManual(prev=>({...prev,eps:valueString(source.eps),price:valueString(source.price),dividend:valueString(source.dividend),beta:valueString(source.beta),fcf:valueString(source.fcf)}));
       setA(prev=>({...prev,growth:grahamGrowthPolicy.rate,aaaYield:aaaYieldSnapshot.value}));
       onGrahamManualChange?.(asset.ticker,{eps:source.eps,growth:grahamGrowthPolicy.rate,aaaYield:aaaYieldSnapshot.value});
      }
      setMode("manual");
     }}>Manual</button>
    </div>
    <div className="nr-graham-io-rows">
     <label><span>Current Annual EPS</span><input type="number" step="any" value={mode==="manual"?manual.eps:valueString(source.eps)} disabled={mode!=="manual"} onChange={e=>setField("eps",e.target.value)} placeholder="N/D"/></label>
     <label><span>Current Dividend Yield</span><div className="nr-graham-input-unit"><input type="number" step="any" min="0" value={currentDividendYield===null?"":Number(currentDividendYield.toFixed(5))} disabled={mode!=="manual"} onChange={e=>{const rate=e.target.value===""?null:Number(e.target.value);setManual(prev=>({...prev,dividend:rate===null||!Number.isFinite(rate)||financials.price===null?"":String(financials.price*rate/100)}))}} placeholder="N/D"/><span>%</span></div></label>
     <label><span>Current Stock Price</span><input type="number" step="any" value={mode==="manual"?manual.price:valueString(source.price)} disabled={mode!=="manual"} onChange={e=>setField("price",e.target.value)} placeholder="N/D"/></label>
     <label><span>Expected Long-Term Growth</span><div className="nr-graham-input-unit"><input type="number" step="0.5" value={mode==="automatic"?grahamGrowthPolicy.rate:a.growth??""} disabled={mode!=="manual"} onChange={e=>setA(prev=>({...prev,growth:e.target.value===""?Number.NaN:Number(e.target.value)}))}/><span>%</span></div></label>
     <label><span>Corporate Aaa Bond Yield</span><div className="nr-graham-input-unit"><input type="number" step="0.1" value={mode==="automatic"?aaaYieldSnapshot.value:a.aaaYield??""} disabled={mode!=="manual"} onChange={e=>{setA(prev=>({...prev,aaaYield:e.target.value===""?null:Number(e.target.value)}));setAaaManual(true)}}/><span>%</span></div></label>
    </div>
    <small>{mode==="automatic"?"Sector assumption "+grahamGrowthPolicy.rate+"% · FRED Aaa "+aaaYieldSnapshot.observationDate:"Manual inputs · Graham Composite updates automatically"}</small>
   </section>
   <section className="nr-graham-io-panel nr-graham-io-output" aria-label="Graham outputs">
    <h3>OUTPUTS</h3>
    <div className="nr-graham-io-rows">
     <div className="nr-graham-io-result"><span>Graham Fair Value (Original Formula)</span><strong>{money(graham?.classic??null,currency)}</strong></div>
     <div className="nr-graham-io-result"><span>Graham Fair Value (Interest-Adjusted)</span><strong>{money(graham?.adjusted??null,currency)}</strong></div>
     <div className="nr-graham-io-result"><span>Dividend-Adjusted P/E/G Ratio</span><strong>{graham?.pegDividend===null||graham?.pegDividend===undefined?"N/D":graham.pegDividend.toFixed(2)+"×"}</strong></div>
    </div>
   </section>
   <GrahamInterpretationPanel ticker={asset.ticker} price={financials.price} aaaYield={grahamYield} currency={currency} result={graham}/>
  </div>}
  {showOtherValuationControls&&<>
  <section className="nr-control-card">
   <div className="nr-section-title"><div><span className="nr-eyebrow">VALUATION INPUTS</span><h3>Valuation inputs</h3></div></div>
   <div className="nr-mode" role="group" aria-label="Valuation data mode">
    {(false?["automatic","manual"] as ValuationMode[]:["automatic","hybrid","manual"] as ValuationMode[]).map(m=><button type="button" key={m} className={mode===m?"active":""} onClick={()=>{if(false){if(m==="manual"){setManual(prev=>({...prev,eps:valueString(source.eps),price:valueString(source.price),dividend:valueString(source.dividend),beta:valueString(source.beta),fcf:valueString(source.fcf)}));setA(prev=>({...prev,growth:grahamGrowthPolicy.rate,aaaYield:aaaYieldSnapshot.value}));onGrahamManualChange?.(asset.ticker,{eps:source.eps,growth:grahamGrowthPolicy.rate,aaaYield:aaaYieldSnapshot.value})}else if(m==="automatic"){onGrahamManualChange?.(asset.ticker,null)}}setMode(m)}}>{m==="automatic"?"Automatic snapshot":m==="hybrid"?"Hybrid · overrides":"Manual · free-hand"}</button>)}
   </div>
   <div className="nr-field-grid">{inputFields.map(f=><label key={f.key}><span>{f.label}</span><input type="number" step="any" value={mode==="manual"?manual[f.key]:mode==="hybrid"?(overrides[f.key]??valueString(source[f.key])):valueString(source[f.key])} disabled={mode==="automatic"} onChange={e=>setField(f.key,e.target.value)} placeholder="N/D"/></label>)}</div>
   {mode==="hybrid"&&<button className="nr-text-button" type="button" onClick={()=>setOverrides({})}><RefreshCcw size={13}/> Clear overrides</button>}
  </section>
  <section className="nr-control-card nr-model-inputs"><div className="nr-section-title"><div><span className="nr-eyebrow">MODEL CONFIGURATION</span><h3>{selected.label}</h3></div><span className="nr-status"><FlaskConical size={14}/> ASSUMPTIONS</span></div>
    {active==="peers"?<p className="nr-source-note">Peer multiples need an audited comparable-company set, normalized EBITDA/earnings and consistent fiscal periods. No fabricated peer valuations are published.</p>:<>
    {active==="required-return"&&<div className="nr-basis-toggle"><span>Projection basis</span><div className="nr-mode"><button type="button" className={requiredBasis==="eps"?"active":""} onClick={()=>setRequiredBasis("eps")}>EPS / P/E</button><button type="button" className={requiredBasis==="fcf"?"active":""} onClick={()=>setRequiredBasis("fcf")}>FCF / P/FCF</button></div><small>The same ten-year model can project earnings or free cash flow per share. The exit multiple follows the selected basis.</small></div>}
    <div className="nr-field-grid nr-assumptions">{assumptionsByTab[active].filter(f=>!(active==="dcf"&&rateMode==="capm"&&f.key==="discount")).map(f=><label key={f.key}><span>{active==="required-return"&&requiredBasis==="fcf"?f.label.replace("EPS growth","FCF growth").replace("Exit P/E","Exit P/FCF"):f.label}</span><input type="number" step={f.step} value={false&&mode==="automatic"?(f.key==="growth"?grahamGrowthPolicy.rate:f.key==="aaaYield"?aaaYieldSnapshot.value:a[f.key]??""):a[f.key]??""} disabled={false&&mode==="automatic"} onChange={e=>{const n=e.target.value===""?null:Number(e.target.value);setA(prev=>({...prev,[f.key]:n}));if(f.key==="aaaYield")setAaaManual(true)}} placeholder="Enter rate"/></label>)}</div>
    {false&&mode==="automatic"&&<p className="nr-source-note" role="status"><strong>Medium-term Graham growth assumption:</strong> {grahamGrowthPolicy.rate}% · {grahamGrowthPolicy.label} · Conservative sector assumption, not an EPS forecast. <strong>Historical EPS reference:</strong> {grahamGrowthEvidence.rawPercent===null?"N/D":(grahamGrowthEvidence.rawPercent??0).toFixed(2)+"%"} ({grahamGrowthEvidence.source}; diagnostic only).</p>}
    {false&&<div className="nr-graham-rate-note"><strong>Moody’s Aaa yield (DAAA): {aaaYieldSnapshot.value.toFixed(2)}% · {aaaYieldSnapshot.observationDate}</strong><span>{aaaManual?"USER OVERRIDE · the input above is manually set":"VERIFIED FRED SNAPSHOT · NOT LIVE"}</span><a href={aaaYieldSnapshot.sourceUrl} target="_blank" rel="noopener noreferrer">Verify current yield on FRED</a><button type="button" onClick={()=>{setA(prev=>({...prev,aaaYield:aaaYieldSnapshot.value}));setAaaManual(false)}}>Use dated FRED observation</button></div>}
    {active==="dcf"&&rateMode==="capm"&&<div className="nr-capm"><span>CAPM cost of equity inputs</span><div className="nr-field-grid"><label><span>Risk-free rate %</span><input type="number" value={riskFree} step="0.1" onChange={e=>setRiskFree(Number(e.target.value))}/></label><label><span>Equity risk premium %</span><input type="number" value={erp} step="0.1" onChange={e=>setErp(Number(e.target.value))}/></label></div><small>Applied equity discount rate: {rate===null?"N/D":rate.toFixed(2)+"%"} · CAPM discounts equity cash flows; WACC is shown in its separate FCFF worksheet.</small></div>}
    <button type="button" className="nr-text-button" onClick={()=>{setA({...modelDefaults,aaaYield:aaaYieldSnapshot.value});setAaaManual(false)}}><RefreshCcw size={13}/> Reset assumptions</button>
    </>}
    {noValue&&<div className="nr-empty" role="status">Model awaiting valid financial inputs and assumptions. No value is published until the required fields are available.</div>}
   </section>
  </>}
  {active==="required-return"?<section className="nr-required-summary" aria-label="Required return valuation outputs">
    <div className="nr-section-title"><div><span className="nr-eyebrow">TEN-YEAR RETURN MODEL / OUTPUTS</span><h3>Projected exit & entry price</h3></div><span className="nr-status">SCENARIO · NOT A QUOTE</span></div>
    <div className="nr-required-metrics">
     <div className="nr-metric"><span>Sale price in year 10</span><strong>{money(required?.exitValue??null,currency)}</strong><small>Projected {requiredMetricName} × exit {requiredMultipleName}</small></div>
     <div className="nr-metric"><span>Dividend yield at sale</span><strong>{requiredSaleYield===null?"N/D":requiredSaleYield.toFixed(2)+"%"}</strong><small>Year-10 dividend / sale price</small></div>
     <div className="nr-metric"><span>FV of reinvested dividends</span><strong>{money(required&&financials.dividend!==null?required.futureDividends:null,currency)}</strong><small>Compounded at target return</small></div>
     <div className="nr-metric"><span>Total terminal value</span><strong>{money(requiredTotal,currency)}</strong><small>Sale + future-value dividends</small></div>
     <div className="nr-metric nr-required-primary"><span>Primary output · Buy now below</span><strong>{money(required?.entry??null,currency)}</strong><small>Target return {requiredReturnText} / year</small></div>
    </div>
   </section>:active==="dividend"?<DividendResearchPanel result={ddm} currentDividend={financials.dividend} currency={currency} growth={a.dividendGrowth} terminalGrowth={a.dividendTerminal} discount={a.dividendDiscount}/>:active==="graham"?<GrahamResearchPanel valuationMode={mode==="manual"?"manual":"automatic"} ticker={asset.ticker} price={financials.price} eps={financials.eps} dividendYield={currentDividendYield} growth={grahamGrowth??Number.NaN} aaaYield={grahamYield} currency={currency} result={graham} aaaObservationDate={aaaYieldSnapshot.observationDate} aaaSourceUrl={aaaYieldSnapshot.sourceUrl} aaaIsManual={aaaManual}/>:active==="dcf"?null:<div className="nr-metric-grid">
   {[["DCF intrinsic",base?.value??null,"CASH FLOW"],["Graham anchor",graham?.adjusted??graham?.classic??null,graham?.adjusted!==null&&graham?.adjusted!==undefined?"BOND-ADJUSTED":"CLASSIC"],["Dividend DDM",ddm?.value??null,"INTRINSIC"],["Required-return entry",required?.entry??null,"ENTRY PRICE · NOT FAIR VALUE"]].map(([label,v,tag])=><div className="nr-metric" key={label as string}><span>{label as string}</span><strong>{money(v as number|null,currency)}</strong><small>{tag as string}</small></div>)}
  </div>}
  {active==="required-return"&&<section className="nr-required-details" aria-label="Ten-year projection and interpretation">
   <div className="nr-control-card nr-required-schedule">
    <div className="nr-section-title"><div><span className="nr-eyebrow">FORECAST TRANSPARENCY</span><h3>10-Year {requiredMetricName} / Dividend Schedule</h3></div><span className="nr-status">YEAR BY YEAR</span></div>
    <p className="nr-source-note">Two growth stages project {requiredMetricName} and dividends independently. Each dividend is compounded to year 10 using the selected target return. These are model assumptions, not historical observations.</p>
    {required?<div className="nr-schedule-scroll"><table className="nr-schedule-table"><thead><tr><th>Year</th><th>{requiredMetricName}</th><th>Dividend / share</th><th>Future value of dividend</th></tr></thead><tbody>{required.projection.map(row=><tr key={row.year}><td>{row.year}</td><td>{money(row.eps,currency)}</td><td>{financials.dividend===null?"N/D":money(row.dividend,currency)}</td><td>{financials.dividend===null?"N/D":money(row.futureDividend,currency)}</td></tr>)}</tbody></table></div>:<div className="nr-empty">Enter a positive {requiredMetricName} and valid model assumptions to see the complete ten-year schedule.</div>}
   </div>
   <div className="nr-required-visual-column">
   <div className="nr-chart-card nr-required-chart">
    <div className="nr-section-title"><div><span className="nr-eyebrow">EXPECTED FINANCIAL GROWTH</span><h3>Expected {requiredMetricName} & Dividend Growth</h3></div><span className="nr-status">10-YEAR SCENARIO</span></div>
    <p className="nr-chart-description">Navy bars: projected {requiredMetricName}. Gold bars: annual dividends per share. All values are scenario projections.</p>
    {required?<><ResponsiveContainer width="100%" height={278}>
     <BarChart data={required.projection} margin={{top:14,right:8,left:0,bottom:0}} barGap={3} barCategoryGap="15%">
      <CartesianGrid stroke="#e3eaf2" strokeDasharray="3 4" vertical={false}/>
      <XAxis dataKey="year" tickFormatter={v=>"Y"+v} stroke="#8193a7" tickLine={false} axisLine={false} tick={{fontSize:10}} dy={6}/>
      <YAxis stroke="#8193a7" tickLine={false} axisLine={false} width={64} tick={{fontSize:10}} tickFormatter={v=>money(Number(v),currency)}/>
      <Tooltip contentStyle={{background:"#fff",border:"1px solid #d1ddea",borderRadius:9,color:"#16334e",boxShadow:"0 6px 18px #1939591a"}} itemStyle={{color:"#16334e"}} formatter={v=>money(Number(v),currency)} labelFormatter={v=>"Year "+v}/>
      <Bar dataKey="eps" name={requiredMetricName} fill="#142744" radius={[3,3,0,0]} maxBarSize={32}/>
      <Bar dataKey="dividend" name="Dividend / share" fill="#d2a126" radius={[3,3,0,0]} maxBarSize={32}/>
     </BarChart>
    </ResponsiveContainer><div className="nr-chart-legend"><span><i className="nr-legend-blue"/> {requiredMetricName}</span><span><i className="nr-legend-gold"/> Annual dividend</span></div></>:<div className="nr-chart-empty"><Database size={27}/><strong>Projection awaits financial inputs</strong><span>Enter a valid per-share starting value to display the chart.</span></div>}
   </div>
   <div className="nr-required-interpretation">
    <span className="nr-eyebrow">MODEL INTERPRETATION</span>
    {required&&lastRequiredYear?<p>Under these assumptions, year-10 {requiredMetricName} reaches <strong>{money(lastRequiredYear.eps,currency)}</strong>. Applying an exit {requiredMultipleName} of <strong>{a.exitPe.toFixed(1)}×</strong> gives a projected sale price of <strong>{money(required.exitValue,currency)}</strong>. {financials.dividend!==null?<>The final-year dividend is <strong>{money(lastRequiredYear.dividend,currency)}</strong> (a <strong>{requiredSaleYield?.toFixed(2)??"N/D"}%</strong> yield on the modeled exit price). Assuming reinvestment at the target return, dividends contribute <strong>{money(required.futureDividends,currency)}</strong> at year 10. </>:"Dividend/share is unavailable; the model assumes zero dividends. Supply a dividend input to include them. "}The combined terminal value is <strong>{money(requiredTotal,currency)}</strong>. To target <strong>{requiredReturnText} annually</strong> over ten years, the maximum buy-now price is <strong>{money(required.entry,currency)}</strong>.</p>:<p>Once financial inputs are valid, this section will explain the exit multiple, dividend contribution, total terminal value and discounted buy-now threshold.</p>}
    <small>This is a required-return purchase threshold, not an intrinsic fair value estimate. Growth, terminal multiple and reinvestment returns are assumptions.</small>
   </div>
   </div>
  </section>}
  {active!=="required-return"&&active!=="dividend"&&active!=="graham"&&<section className="nr-model-output">
   <div className={"nr-chart-card"+(active==="dcf"?" nr-dcf-chart-light":"")}>
    <div className="nr-section-title"><div><span className="nr-eyebrow">MODEL VISUALIZATION</span><h3>{active==="dcf"?"Projected free cash flow per share":"Comparable valuation coverage"}</h3>{active==="dcf"&&<small className="nr-dcf-unit-label">{currency} per share</small>}</div>{active==="dcf"&&<div className="nr-dcf-chart-legend" aria-label="DCF chart legend"><span><i className="nr-dcf-legend-navy"/>FCF / share</span><span><i className="nr-dcf-legend-gold"/>PV / share</span></div>}</div>
    {active==="dcf"&&base?<>
     <div className="nr-dcf-chart-scroll"><div className="nr-dcf-chart-canvas">
     <ResponsiveContainer width="100%" height={360}>
      <BarChart data={chartRows} margin={{top:46,right:16,left:8,bottom:18}} barGap={5} barCategoryGap="26%">
       <CartesianGrid stroke="#e4ebf2" strokeDasharray="3 5" vertical={false}/>
       <XAxis dataKey="year" stroke="#637c95" tick={{fontSize:16,fontWeight:650,fill:"#173553"}} tickLine={{stroke:"#9bafc1"}} axisLine={{stroke:"#9bafc1"}} dy={6}/>
       <YAxis stroke="#637c95" tick={{fontSize:15,fontWeight:600,fill:"#173553"}} tickLine={{stroke:"#9bafc1"}} axisLine={{stroke:"#9bafc1"}} width={52} domain={[0,"auto"]} tickFormatter={v=>Number(v).toFixed(0)}/>
       <Tooltip contentStyle={{background:"#fff",border:"1px solid #dbe6f1",borderRadius:10,color:"#173553"}} itemStyle={{color:"#173553"}} formatter={v=>money(Number(v),currency)}/>
       <Bar dataKey="cashflow" name="FCF / share" fill="#173553" radius={[4,4,0,0]}>
        <LabelList dataKey="cashflow" position="top" fill="#173553" fontSize={18} fontWeight={700} formatter={(v: number)=>Number(v).toFixed(1)}/>
       </Bar>
       <Bar dataKey="presentValue" name="PV / share" fill="#D4A94D" radius={[4,4,0,0]}>
        <LabelList dataKey="presentValue" position="top" fill="#806016" fontSize={18} fontWeight={700} formatter={(v: number)=>Number(v).toFixed(1)}/>
       </Bar>
      </BarChart>
     </ResponsiveContainer>
     </div></div>
     
    </>:null}

    {active==="peers"||noValue?<div className="nr-chart-empty"><Database size={27}/><strong>{active==="peers"?"Peer data not yet validated":"Waiting for valid model inputs"}</strong><span>No simulated historical series or peer estimates are displayed.</span></div>:null}
    {active==="dcf"&&base?<div className="nr-bridge"><div><span>PV explicit FCF</span><b>{money(base.pvCashflows,currency)}</b></div><div><span>PV terminal</span><b>{money(base.pvTerminal,currency)}</b></div><div><span>Buy-under at {a.mos}% MOS</span><b>{money(base.value*(1-a.mos/100),currency)}</b></div></div>:null}
   </div>
  </section>}

  <div className="nr-footnote"><strong>Research boundary.</strong> Snapshot financial inputs are not live quotes. Growth, discount, multiples and exit prices are user-editable scenarios, not verified forecasts. Required-return entry price is not averaged into intrinsic fair value. <NavLink to="/options/csp">Continue to Options Execution <ArrowRight size={13}/></NavLink></div>
  </>}
 </div>;
}
