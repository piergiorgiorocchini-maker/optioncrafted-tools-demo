import {readFileSync,existsSync} from "node:fs";
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
 "platform-app/src/main.tsx":["LegacyToolsWorkspace","Tools & Calculators","onSelect={openAsset}"],
 "platform-app/src/components/LegacyToolsWorkspace.tsx":["oc:embedded-height","tools/probability-station","tools/options-strategy-lab","tools/edge-station"],
 "tools/assets/js/tools-hub.js":["initFairValueCalculator","initDividendValueCalculator","initGrahamLynchCalculator","initCashSecuredPutCalculator","initCoveredCallCalculator","initWheelStrategyCalculator","initPortfolioIncomePlanner"]
};
let checks=0;
for(const [path,markers] of Object.entries(required)){
 const content=read(path);
 for(const marker of markers){if(!content.includes(marker))throw new Error("Missing "+marker+" in "+path);checks++;}
}
for(const path of ["tools/index.html","tools/probability-station/index.html","tools/options-strategy-lab/index.html","tools/edge-station/index.html"]){
 const html=read(path);
 for(const asset of ["tools-embedded.css","tools-embed-bridge.js"]){if(!html.includes(asset))throw new Error("Missing "+asset+" in "+path);checks++;}
}
for(const path of ["tools/assets/css/tools-embedded.css","tools/assets/js/tools-embed-bridge.js"]){if(!existsSync(resolve(root,path)))throw new Error("Missing "+path);checks++;}
console.log("OptionsCrafted integration checks passed: "+checks+" assertions (7 core calculators + 3 analytical stations + output/embedding markers).");
