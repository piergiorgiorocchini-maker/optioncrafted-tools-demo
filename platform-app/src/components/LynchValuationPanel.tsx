import {useEffect,useState} from "react";
import type {RealAsset} from "./RealResearch";
import {getManualTtmFinancials} from "../data/googleSheetsManualFinancials";
import {googleSheetsSecAnnualHistory} from "../data/googleSheetsSecFinancials";
import {money} from "../core/valuationModels";
import {lynchGrowthAssumption,lynchModel} from "../core/lynchValuation";

const finitePositive=(n:number|null|undefined):n is number=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const display=(n:number|null)=>n===null?"N/D":n.toFixed(2)+"×";
const fmtRate=(n:number|null)=>n===null?"N/D":n.toFixed(2)+"%";
const parse=(s:string)=>s.trim()===""?null:Number.isFinite(Number(s))?Number(s):null;

/** Standalone PEG/PEGY heuristic. It is NOT an independent cash-flow valuation. */
export type LynchScenario={eps:number|null;growth:number;dividendYield:number|null;price:number|null;mode?:"automatic"|"manual"};
export function LynchValuationPanel({asset,scenario,onScenarioChange}:{asset:RealAsset;scenario?:LynchScenario|null;onScenarioChange?:(ticker:string,scenario:LynchScenario|null)=>void}){
 const rows=googleSheetsSecAnnualHistory(asset.ticker,asset.currency);
 const recent=rows.at(-1);
 // SEC EPS CAGR is stored as a decimal (0.20 = 20 percentage points).
 const policy=lynchGrowthAssumption(recent?.epsCagr3y);
 const historicalUsable=policy.basis==="HISTORICAL_PROXY";
 // Historical growth is a documented proxy, not a verified forward forecast.
 const baseGrowth=policy.growth;
 const ttm=getManualTtmFinancials(asset.ticker,asset.currency);
 // Match the shared triangulation EPS precedence exactly; negative EPS stays ineligible.
 const defaultEps=ttm?.dilutedEps??asset.eps??recent?.dilutedEps??null;
 const defaultPrice=finitePositive(asset.price)?asset.price:null;
 // Provider yield is a decimal FRACTION, e.g. 0.0216 = 2.16%.
 const defaultYield=typeof asset.dividendYield==="number"&&Number.isFinite(asset.dividendYield)&&asset.dividendYield>=0?asset.dividendYield*100:null;
 const [manual,setManual]=useState(scenario?.mode==="manual");
 const [touched,setTouched]=useState(Boolean(scenario));
 const [growth,setGrowth]=useState(String(scenario?.growth??baseGrowth));
 const [epsText,setEpsText]=useState(scenario?String(scenario.eps??""):defaultEps===null?"":String(defaultEps));
 const [priceText,setPriceText]=useState(scenario?String(scenario.price??""):defaultPrice===null?"":String(defaultPrice));
 const [yieldText,setYieldText]=useState(scenario?String(scenario.dividendYield??""):defaultYield===null?"":String(Number(defaultYield.toFixed(5))));
 const g=parse(growth);
 const eps=manual?parse(epsText):defaultEps;
 const price=manual?parse(priceText):defaultPrice;
 const yieldPct=manual?parse(yieldText):defaultYield;
 const result=lynchModel(eps,g??Number.NaN,yieldPct,price);
 const pe=result?.pe??null;
 const peg=result?.peg??null;
 const pegy=result?.pegy??null;
 const fair=result?.basic??null;
 const dividendFair=result?.withDividend??null;
 const composite=result?.composite??null;
 const upside=result?.upside??null;
 useEffect(()=>{
  if(!onScenarioChange)return;
  onScenarioChange(asset.ticker,touched?{eps,growth:g??Number.NaN,dividendYield:yieldPct,price,mode:manual?"manual":"automatic"}:null);
 },[asset.ticker,touched,manual,eps,g,yieldPct,price,onScenarioChange]);
 const input=(name:string,value:string,change:(v:string)=>void,disabled=false,unit?:string)=><label><span>{name}</span><div className="nr-graham-input-unit"><input type="number" step="any" value={value} disabled={disabled} onChange={e=>change(e.target.value)} placeholder="N/D"/>{unit&&<span>{unit}</span>}</div></label>;
 const setGrowthInput=(v:string)=>{setGrowth(v);setTouched(true)};
 const setEpsInput=(v:string)=>{setEpsText(v);setTouched(true)};
 const setPriceInput=(v:string)=>{setPriceText(v);setTouched(true)};
 const setYieldInput=(v:string)=>{setYieldText(v);setTouched(true)};
 const sourceLabel=historicalUsable?"Historical EPS CAGR 3Y · SEC/FMP annual data (proxy, not forecast)":"Standard 10% assumption · no reliable 3Y EPS growth in 0–30% range";
 return <>
  <section className="nr-graham-top-summary" aria-label="Lynch valuation primary result">
   <div><span className="nr-eyebrow">LYNCH VALUATION · {manual?"MANUAL INPUTS":"SNAPSHOT INPUTS"}</span><h3>{composite===null?"Lynch PEG Value":"Lynch Composite"}</h3><strong>{money(composite??fair,asset.currency)}</strong><p>{composite===null?"PEG-only estimate: dividend yield unavailable, so no two-part Composite.":"Equal-weight mean of PEG Value and dividend-adjusted PEGY Value."} Growth-relative heuristic, not DCF intrinsic value.</p></div>
  </section>
  <div className="nr-graham-io" aria-label="Lynch PEG valuation model">
   <section className="nr-graham-io-panel" aria-label="Lynch inputs">
    <h3>INPUTS</h3>
    <div className="nr-graham-io-mode" role="group" aria-label="Lynch data mode">
     <button type="button" className={!manual?"active":""} aria-pressed={!manual} onClick={()=>{setManual(false);setTouched(false);setGrowth(String(baseGrowth));onScenarioChange?.(asset.ticker,null)}}>Automatic</button>
     <button type="button" className={manual?"active":""} aria-pressed={manual} onClick={()=>{if(!manual){setEpsText(defaultEps===null?"":String(defaultEps));setPriceText(defaultPrice===null?"":String(defaultPrice));setYieldText(defaultYield===null?"":String(Number(defaultYield.toFixed(5))))}setManual(true);setTouched(true)}}>Manual</button>
    </div>
    <div className="nr-graham-io-rows">
     {input("Current Annual EPS",manual?epsText:defaultEps===null?"":String(defaultEps),setEpsInput,!manual)}
     {input("Current Stock Price",manual?priceText:defaultPrice===null?"":String(defaultPrice),setPriceInput,!manual)}
     {input("Expected EPS Growth",growth,setGrowthInput,false,"%")}
     {input("Current Dividend Yield",manual?yieldText:defaultYield===null?"":String(Number(defaultYield.toFixed(5))),setYieldInput,!manual,"%")}
    </div>
    <small>{sourceLabel}. Growth is editable in either mode. <button type="button" className="nr-lynch-reset" onClick={()=>setGrowthInput(String(baseGrowth))}>Reset growth</button></small>
   </section>
   <section className="nr-graham-io-panel nr-graham-io-output" aria-label="Lynch outputs">
    <h3>OUTPUTS</h3>
    <div className="nr-graham-io-rows">
     <div className="nr-graham-io-result"><span>Lynch Composite · PEG & PEGY mean</span><strong>{money(composite,asset.currency)}</strong></div>
     <div className="nr-graham-io-result"><span>Lynch Growth Value · PEG = 1</span><strong>{money(fair,asset.currency)}</strong></div>
     <div className="nr-graham-io-result"><span>Lynch + Dividends · PEGY = 1</span><strong>{money(dividendFair,asset.currency)}</strong></div>
     <div className="nr-graham-io-result"><span>Current P/E</span><strong>{display(pe)}</strong></div>
     <div className="nr-graham-io-result"><span>PEG Ratio</span><strong>{display(peg)}</strong></div>
     <div className="nr-graham-io-result"><span>Dividend-Adjusted PEG (PEGY)</span><strong>{display(pegy)}</strong></div>
     <div className="nr-graham-io-result"><span>Upside / Downside · Lynch</span><strong>{fmtRate(upside)}</strong></div>
    </div>
   </section>
   <section className="nr-graham-interpretation nr-graham-interpretation--top" aria-label="Lynch model interpretation">
    <h3>MODEL INTERPRETATION</h3>
    <p><strong>PEG</strong> compares the market P/E with expected annual EPS growth: <strong>PEG = (Price / EPS) ÷ Growth %</strong>. For example, a P/E of 20 and 20% growth gives PEG 1.</p>
    <p><strong>PEG near 1</strong> is Lynch's growth-price rule of thumb. Below 1 means the earnings multiple is lower than the growth assumption; above 1 means it is higher. Neither proves a stock is cheap or expensive.</p>
    <p><strong>PEGY</strong> also accounts for dividends: <strong>PEGY = P/E ÷ (Growth % + Dividend Yield %)</strong>. Both rates are percentage points, not decimal fractions.</p>
    <p>At PEG = 1, the implied <strong>Lynch Value = EPS × Growth %</strong>; with dividends the analogue is <strong>EPS × (Growth % + Yield %)</strong>. These are two versions of one growth-based heuristic, not independent fair values.</p>
    <small>{composite===null?"No two-part Lynch Composite is reported without a usable dividend yield. ":"PEG and PEGY are equal-weight components of one Lynch Composite. "}{historicalUsable?"The automatic growth starts from historical EPS CAGR over three years. It is backward-looking, not a validated forward forecast.":"The automatic growth starts at a transparent 10% default because a suitable positive three-year EPS CAGR was unavailable or outside the conservative 0–30% screening range."} The growth field is always editable; changes immediately recalculate all outputs. Negative or zero EPS/growth suppress valuation rather than fabricating a multiple.</small>
   </section>
  </div>
  <div className="nr-lynch-details">
   <section className="nr-control-card"><div className="nr-section-title"><div><span className="nr-eyebrow">CALCULATION EXPLAINED</span><h3>How the Lynch model works</h3></div></div>
    <div className="nr-lynch-formulas"><div><strong>01 · Growth-only PEG</strong><code>PEG = (P / EPS) / g</code><span>Break-even growth-relative multiple: fair P/E = g, so implied value = EPS × g.</span></div><div><strong>02 · Dividend adjusted PEGY</strong><code>PEGY = (P / EPS) / (g + DY)</code><span>At PEGY = 1: implied value = EPS × (g + DY). Growth and yield are in percentage points.</span></div></div>
    <p className="nr-source-note">These outputs are valuation heuristics associated with Peter Lynch's PEG approach. They are not DCF estimates, guaranteed entry prices, independent valuation votes or predictions of market returns.</p>
   </section>
   <section className="nr-control-card"><div className="nr-section-title"><div><span className="nr-eyebrow">INPUT GUIDE / DATA SOURCES</span><h3>Data for {asset.ticker}</h3></div></div>
    <p className="nr-source-note"><strong>EPS:</strong> {ttm?.dilutedEps!==null&&ttm?.dilutedEps!==undefined?"Manual TTM financials":asset.eps!==null?"Assets snapshot EPS":recent?.dilutedEps!==null&&recent?.dilutedEps!==undefined?"Latest SEC/FMP annual diluted EPS":"N/D; enter manually"}. <strong>Price / dividend yield:</strong> Assets snapshot. <strong>Growth:</strong> {sourceLabel}. {recent?.periodEnd?"Latest historical annual period: "+recent.periodEnd+".":""}</p>
    <p className="nr-source-note">If earnings are cyclical or an exceptional year distorts CAGR, select a defensible normalized forward growth assumption. Dividend yield is read as a decimal fraction from Assets and converted to percentage points for PEGY. A missing yield stays N/D; it is not silently assumed to be zero.</p>
   </section>
  </div>
 </>;
}
