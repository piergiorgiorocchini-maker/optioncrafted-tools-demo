import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const required={
 "tools/index.html":[
  "id=\"tool-fair-value\"","id=\"fv-buy-below\"","id=\"fv-growth-chart\"",
  "id=\"tool-dividend-value\"","id=\"dv-results\"","id=\"dv-bar-chart\"",
  "id=\"tool-graham-lynch\"","id=\"gl-results\"",
  "id=\"tool-cash-secured-put\"","id=\"csp-results\"","id=\"csp-ror-chart\"",
  "id=\"tool-covered-call\"","id=\"cc-results\"","id=\"cc-ror-chart\"",
  "id=\"tool-wheel-strategy\"","id=\"wheel-results\"","id=\"wheel-cycle-chart\"",
  "id=\"tool-portfolio-income\"","id=\"pi-results\"","id=\"pi-capital-projection-chart\""
 ],
 "tools/probability-station/index.html":["id=\"seasonalityEquityChart\"","id=\"probabilityBellChart\"","id=\"probabilityReading\""],
 "tools/options-strategy-lab/index.html":["id=\"payoffChart\"","id=\"scenarioTableBody\""],
 "tools/edge-station/index.html":["id=\"edgePayoffChart\"","id=\"metricRiskProfile\""],
 "platform-app/src/main.tsx":["ValuationWorkspace","OptionsWorkspace","nav-submenu","onSelect={openAsset}"],
 "platform-app/src/components/ValuationWorkspace.tsx":["requiredReturnModel","grahamModel","dividendModel","ResponsiveContainer"],
 "platform-app/src/components/ValuationSynthesis.tsx":["ValuationFootballField","ValuationBridge","Fair Value","Market Price","Upside / Downside"],
 "platform-app/src/components/OptionsWorkspace.tsx":["cspModel","coveredCallModel","wheelModel","hedgeModel","lognormalProbability","ResponsiveContainer"],
 "platform-app/src/components/ValuationFootballField.tsx":["ff-vertical-range","ff-single-estimate","ff-market-line","ff-entry-section","Purchase thresholds","No averaging of intrinsic estimates with entry thresholds"],
 "platform-app/src/core/valuationModels.ts":["function dcfModel","function requiredReturnModel","function grahamModel","function dividendModel"],
 "platform-app/src/core/optionsModels.ts":["function cspModel","function coveredCallModel","function wheelModel","function hedgeModel","function lognormalProbability"],
 "tools/assets/js/tools-hub.js":["initFairValueCalculator","initDividendValueCalculator","initGrahamLynchCalculator","initCashSecuredPutCalculator","initCoveredCallCalculator","initWheelStrategyCalculator","initPortfolioIncomePlanner"]
};
let checks=0;
for(const [path,markers] of Object.entries(required)){
 const content=read(path);
 for(const marker of markers){if(!content.includes(marker))throw new Error("Missing "+marker+" in "+path);checks++;}
}
if(read("platform-app/src/components/ValuationFootballField.tsx").includes("ff-scale-toggle"))throw new Error("Redundant Football Field scale toggle must remain removed");
checks++;
// The Football Field must occur only in the dedicated Premium synthesis surface.
if(read("platform-app/src/components/ValuationWorkspace.tsx").includes("ValuationFootballField"))throw new Error("Football Field must not render in individual valuation methods");
if(!read("platform-app/src/main.tsx").includes('page==="premium-analysis"?<PremiumAnalysisWorkspace')||!read("platform-app/src/core/access.ts").includes('"premium-analysis"'))throw new Error("Premium Analysis workbook route and tier gate are required");
if(!read("platform-app/src/components/PremiumAnalysisWorkspace.tsx").includes('"precedent-transactions"')||!read("platform-app/src/components/PremiumAnalysisWorkspace.tsx").includes('"multiples"'))throw new Error("Premium workbook tabs must remain available");
checks+=2;
for(const path of ["tools/index.html","tools/probability-station/index.html","tools/options-strategy-lab/index.html","tools/edge-station/index.html"]){if(read(path).includes("tools-embed-bridge.js"))throw new Error("Legacy page must remain standalone: "+path);checks++;}
if(read("platform-app/src/main.tsx").includes("<LegacyToolsWorkspace"))throw new Error("Iframe-based tools must not be embedded in the native app");
// Prevent reintroduction of simulated financial histories for live securities.
const financialCharts=read("platform-app/src/components/FinancialCharts.tsx");
if(!financialCharts.includes("verifiedAnnualHistory(symbol)"))throw new Error("Financial charts must use verified annual SEC history");
if(financialCharts.includes("const sample=")||financialCharts.includes("INDEXED DESIGN PREVIEW"))throw new Error("Simulated financial chart data detected");
const financialBridge=read("platform-app/src/data/verifiedFinancials.ts");
if(!financialBridge.includes("cfo-capex"))throw new Error("Annual FCF must derive from SEC CFO less capex");
// WACC must be a validated cash-flow component, never another family vote.
const bridge=read("platform-app/src/core/valuationTriangulation.ts");
const waccModel=read("platform-app/src/core/waccValuation.ts");
const waccPanel=read("platform-app/src/components/WaccResearchPanel.tsx");
const synthesis=read("platform-app/src/components/ValuationSynthesis.tsx");
if(!bridge.includes("buildVisibleDcfComposite(")||!bridge.includes("dcfComponents")||bridge.includes("DCF_HORIZONS"))throw new Error("Valuation engine must use visible DCF models without hidden historical-growth model");
const visibleDcf=read("platform-app/src/core/visibleDcfComposite.ts");
if(!visibleDcf.includes("dcfModel(fcf,inputs.growth,inputs.discount")||!visibleDcf.includes("getWaccValuation(asset.ticker,asset.currency)")||!visibleDcf.includes("capmDiscount")||!visibleDcf.includes("Math.min(...values)"))throw new Error("DCF Composite must include Manual CAPM and WACC with range across valid model estimates");
if(!waccModel.includes("if(!input||input.ticker.toUpperCase()")||!waccModel.includes("result.fairValue")||!waccPanel.includes('from "../core/waccValuation"'))throw new Error("WACC must use shared and ticker-specific verified inputs");
if(!synthesis.includes('DCF Composite')||!synthesis.includes('valuation.dcfComponents'))throw new Error("Premium synthesis must disclose DCF Composite components");
checks+=3;
// Premium DCF must stay within the viewport; wide data tables scroll locally.
const responsive=read("platform-app/src/components/native-research.css");
for(const marker of [".premium-analysis-sheet>.nr-workspace","grid-template-columns:minmax(0,1fr)","overscroll-behavior-x:contain",".premium-analysis-sheet .wacc-table-scroll"]){
 if(!responsive.includes(marker))throw new Error("Missing mobile DCF containment rule: "+marker);
 checks++;
}
const grahamBridge=read("platform-app/src/core/valuationTriangulation.ts");
const grahamPanel=read("platform-app/src/components/GrahamResearchPanel.tsx");
const grahamWorkspace=read("platform-app/src/components/ValuationWorkspace.tsx");
if(!grahamBridge.includes("grahamComponents.reduce")||!grahamBridge.includes("aaaYieldSnapshot.value"))throw new Error("Published Graham Composite must average classic and Aaa adjusted values");
if(!grahamPanel.includes("bridgeGraham")||!grahamWorkspace.includes("bridgeGraham={publishedValuation.methods.find"))throw new Error("Graham worksheet and synthesis must share the published Graham Composite");
if(!grahamBridge.includes("grahamManual?:")||!grahamBridge.includes("grahamManual?")&& !grahamBridge.includes("manualGraham?"))throw new Error("Graham Manual mode must be available in valuation bridge");
if(!grahamWorkspace.includes('mode==="automatic"?modelDefaults.growth')||!grahamWorkspace.includes("onGrahamManualChange"))throw new Error("Graham Automatic and Manual inputs must stay synchronized");
if(grahamPanel.includes('className="nr-graham-published"'))throw new Error("Remove redundant second published Graham panel");
checks+=3;
const football=read("platform-app/src/components/ValuationFootballField.tsx");
if(football.includes("averageCandidates")||football.includes("averageValuation"))throw new Error("Football Field must not invent an independent arithmetic Fair Value");
if(!football.includes("triangulatedValue")||!football.includes("methods=candidates.filter"))throw new Error("Football Field must plot eligible methods and use the shared triangulated Fair Value");
checks+=4;
console.log("OptionsCrafted integration checks passed: "+checks+" assertions (native valuation and options modules plus preserved standalone legacy engines).");
