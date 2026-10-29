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
 "platform-app/src/components/ValuationWorkspace.tsx":["ValuationFootballField","requiredReturnModel","grahamModel","dividendModel","ResponsiveContainer"],
 "platform-app/src/components/OptionsWorkspace.tsx":["cspModel","coveredCallModel","wheelModel","hedgeModel","lognormalProbability","ResponsiveContainer"],
 "platform-app/src/core/valuationModels.ts":["function dcfModel","function requiredReturnModel","function grahamModel","function dividendModel"],
 "platform-app/src/core/optionsModels.ts":["function cspModel","function coveredCallModel","function wheelModel","function hedgeModel","function lognormalProbability"],
 "tools/assets/js/tools-hub.js":["initFairValueCalculator","initDividendValueCalculator","initGrahamLynchCalculator","initCashSecuredPutCalculator","initCoveredCallCalculator","initWheelStrategyCalculator","initPortfolioIncomePlanner"]
};
let checks=0;
for(const [path,markers] of Object.entries(required)){
 const content=read(path);
 for(const marker of markers){if(!content.includes(marker))throw new Error("Missing "+marker+" in "+path);checks++;}
}
for(const path of ["tools/index.html","tools/probability-station/index.html","tools/options-strategy-lab/index.html","tools/edge-station/index.html"]){if(read(path).includes("tools-embed-bridge.js"))throw new Error("Legacy page must remain standalone: "+path);checks++;}
if(read("platform-app/src/main.tsx").includes("<LegacyToolsWorkspace"))throw new Error("Iframe-based tools must not be embedded in the native app");
console.log("OptionsCrafted integration checks passed: "+checks+" assertions (native valuation and options modules plus preserved standalone legacy engines).");
