import {NavLink} from "react-router-dom";
import type {RealAsset} from "./RealResearch";
import type {LynchScenario} from "./LynchValuationPanel";
import type {ValuationBridge} from "../core/valuationTriangulation";
import {ValuationWorkspace} from "./ValuationWorkspace";
import {ValuationSynthesis} from "./ValuationSynthesis";
import "./native-research.css";

type PremiumTab="synthesis"|"dcf"|"multiples"|"comparables"|"precedent-transactions";
const tabs:{id:PremiumTab;label:string}[]=[
 {id:"synthesis",label:"Valuation Synthesis"},
 {id:"dcf",label:"DCF Engine"},
 {id:"multiples",label:"Multiples"},
 {id:"comparables",label:"Comparables"},
 {id:"precedent-transactions",label:"Precedent Transactions"}
];
export function PremiumAnalysisWorkspace({asset,tab,valuation,onUpdate,grahamManualOverride,onGrahamManualChange,lynchManualOverride,onLynchManualChange}:{asset:RealAsset|null;tab:string;valuation:ValuationBridge|null;onUpdate?:(ticker:string,bridge:ValuationBridge)=>void;grahamManualOverride?:{eps:number|null;growth:number;aaaYield:number|null}|null;onGrahamManualChange?:(ticker:string,inputs:{eps:number|null;growth:number;aaaYield:number|null}|null)=>void;lynchManualOverride?:LynchScenario|null;onLynchManualChange?:(ticker:string,inputs:LynchScenario|null)=>void}){
 const active=tabs.find(item=>item.id===tab)?.id??"synthesis";
 return <div className="premium-analysis-workbook">
  <nav className="premium-analysis-tabs" aria-label="Premium Analysis worksheets">
   {tabs.map(item=><NavLink to={"/premium-analysis/"+item.id} key={item.id} className={({isActive})=>"premium-analysis-tab"+(isActive?" active":"")}>{item.label}</NavLink>)}
  </nav>
  <div className="premium-analysis-sheet">
   {active==="synthesis"?<ValuationSynthesis valuation={valuation} companyName={asset?.name}/>:
    active==="dcf"?(asset?<ValuationWorkspace key={asset.ticker} asset={asset} tab="dcf" premiumDcf onUpdate={onUpdate} grahamManualOverride={grahamManualOverride} onGrahamManualChange={onGrahamManualChange} lynchManualOverride={lynchManualOverride} onLynchManualChange={onLynchManualChange}/>:<section className="premium-analysis-placeholder"><h2>DCF Engine</h2><p>No financial snapshot available for the selected security.</p></section>):
    <section className="premium-analysis-placeholder" aria-label={tabs.find(item=>item.id===active)?.label}>
     <span className="nr-eyebrow">PREMIUM ANALYSIS / WORKSHEET</span>
     <h2>{tabs.find(item=>item.id===active)?.label}</h2>
     <div className="premium-analysis-blank" aria-label="Empty worksheet"/>
    </section>}
  </div>
 </div>;
}
