import {NavLink} from "react-router-dom";
import type {ValuationBridge} from "../core/valuationTriangulation";
import {ValuationFootballField} from "./ValuationFootballField";
import "./native-research.css";

/**
 * Single Premium-only synthesis view for the currently selected security.
 * The figures come from the shared source-aware valuation bridge, not
 * transient inputs on an individual modelling tab.
 */
export function ValuationSynthesis({valuation}:{valuation:ValuationBridge|null}){
 if(!valuation)return <section className="nr-synthesis-empty"><h2>Valuation Synthesis</h2><p>No validated valuation snapshot is available for this security.</p></section>;
 const cash=valuation.methods.find(method=>method.family==="cash_flow"&&method.status==="AVAILABLE");
 const earnings=valuation.methods.find(method=>method.family==="earnings"&&method.status==="AVAILABLE");
 const dividend=valuation.methods.find(method=>method.family==="dividend"&&method.status==="AVAILABLE");
 const dcfValue=cash?.value??null;
 const dcfRange=valuation.dcfHorizonRange;
 return <section className="nr-premium-synthesis" aria-label="Premium Valuation Synthesis">
  <header className="nr-synthesis-header">
   <div><span className="nr-eyebrow">OPTIONSCRAFTED / PREMIUM RESEARCH</span><h2>Valuation Synthesis</h2><p>{valuation.ticker} · Unified valuation methods and risk-aware entry thresholds</p></div>
   <span className="nr-synthesis-status">PREMIUM · RESEARCH VIEW</span>
  </header>
  <ValuationFootballField
   price={valuation.marketPrice}
   currency={valuation.currency}
   bear={dcfRange?.low??dcfValue}
   base={dcfValue}
   bull={dcfRange?.high??dcfValue}
   graham={earnings?.value??null}
   dividend={dividend?.value??null}
   triangulatedValue={valuation.status==="TRIANGULATED"?valuation.intrinsicValue:null}
   mos={valuation.marginOfSafety}
   source={valuation.sourceAsOf?"SOURCE AS OF "+valuation.sourceAsOf:"DATED RESEARCH SNAPSHOT"}
  />
  <div className="nr-synthesis-context">
   <p><strong>Research status: {valuation.status}.</strong> {valuation.eligibleFamilies} eligible valuation families. Estimates without sufficient evidence remain pending. DCF ranges use available horizon scenarios, not statistical confidence intervals.</p>
   <NavLink to="/premium-analysis/dcf">Review valuation assumptions →</NavLink>
  </div>
 </section>;
}
