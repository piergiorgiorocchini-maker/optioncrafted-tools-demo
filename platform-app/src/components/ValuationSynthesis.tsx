import {NavLink} from "react-router-dom";
import type {ValuationBridge} from "../core/valuationTriangulation";
import {ValuationFootballField} from "./ValuationFootballField";
import "./native-research.css";

/**
 * Premium synthesis is result-first. A fair value is shown only when the
 * shared valuation engine has at least two eligible valuation families.
 * An indicative single-family value must not masquerade as a fair value.
 */
export function ValuationSynthesis({valuation,companyName}:{valuation:ValuationBridge|null;companyName?:string|null}){
 const valid=(value:number|null|undefined):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>0;
 const currency=valuation?.currency||"USD";
 const formatMoney=(value:number|null|undefined)=>valid(value)?new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(value):"N/D";
 const price=valuation?.marketPrice??null;
 const fairValue=valuation?.status==="TRIANGULATED"?valuation.intrinsicValue:null;
 const comparison=valid(fairValue)&&valid(price)?(fairValue/price-1)*100:null;
 const formatComparison=comparison===null?"N/D":(comparison>0?"+":"")+comparison.toFixed(1)+"%";
 const cash=valuation?.methods.find(method=>method.family==="cash_flow"&&method.status==="AVAILABLE");
 const earnings=valuation?.methods.find(method=>method.family==="earnings"&&method.status==="AVAILABLE");
 const lynch=valuation?.methods.find(method=>method.id==="lynch"&&method.status==="AVAILABLE");
 const dividend=valuation?.methods.find(method=>method.family==="dividend"&&method.status==="AVAILABLE");
 const dcfValue=cash?.value??null;
 const dcfRange=valuation?.dcfHorizonRange;
 return <section className="nr-premium-synthesis" aria-label="Valuation Synthesis">
  <header className="nr-synthesis-title"><h2>Valuation Synthesis</h2><div className="nr-synthesis-security"><strong>{valuation?.ticker??"N/D"}</strong>{companyName&&<span>{companyName}</span>}</div></header>
  <div className="nr-synthesis-metrics" aria-label="Valuation summary">
   <article className="nr-synthesis-primary"><span>Fair Value</span><strong>{formatMoney(fairValue)}</strong><small>{valid(fairValue)?"Triangulated · eligible valuation families":"Pending · insufficient eligible methods"}</small></article>
   <article><span>Market Price</span><strong>{formatMoney(price)}</strong><small>Reference snapshot · not live</small></article>
   <article><span>Upside / Downside</span><strong className={comparison!==null?(comparison>=0?"nr-synthesis-positive":"nr-synthesis-negative"):""}>{formatComparison}</strong><small>Fair Value vs. reference price</small></article>
  </div>
  {valuation&&valuation.dcfComponents.length>0&&<div className="nr-dcf-composite-breakdown" aria-label="DCF composite components">
   <div><strong>DCF Composite</strong><span>{valuation.dcfComponents.map(component=>component.label+" "+formatMoney(component.value)).join(" + ")}</span></div>
   <strong>{formatMoney(dcfValue)}</strong>
   <small>{valuation.dcfComponents.length} valid model{valuation.dcfComponents.length===1?"":"s"} · equal-weight mean · one cash-flow family</small>
  </div>}
  {valuation?<ValuationFootballField
   price={price}
   currency={currency}
   bear={dcfRange?.low??dcfValue}
   base={dcfValue}
   bull={dcfRange?.high??dcfValue}
   graham={earnings?.value??null}
   lynch={lynch?{value:lynch.value,low:lynch.low,high:lynch.high,detail:lynch.reason}:null}
   dividend={dividend?.value??null}
   triangulatedValue={fairValue}
   mos={valuation.marginOfSafety}
  />:<p className="nr-synthesis-context">No valuation data is available for this security.</p>}
  <div className="nr-synthesis-context">
   <p>{valuation?<>Research status: <strong>{valuation.status}</strong>. {valuation.eligibleFamilies} eligible valuation families. Unverified methods remain pending. The DCF range spans available model estimates, not a confidence interval.</>:"Values remain unavailable until source data is validated."}</p>
   <NavLink to="/premium-analysis/dcf">Review DCF assumptions</NavLink>
  </div>
 </section>;
}
