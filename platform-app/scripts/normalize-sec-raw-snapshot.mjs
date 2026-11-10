import {readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const inputPath=resolve(root,"src/data/googleSheetsSecFacts.json");
const outputPath=resolve(root,"src/data/googleSheetsSecAnnual.json");
const source=JSON.parse(await readFile(inputPath,"utf8"));
const annualForms=new Set(["10-K","10-K/A","20-F","20-F/A","40-F","40-F/A"]);
const quarterForms=new Set(["10-Q","10-Q/A"]);
const metricList=["revenue","netIncome","operatingIncome","cashFromOperations","capex","epsDiluted","grossProfit","costOfRevenue","depreciationAndAmortization","interestExpense","dilutedShares","cash","currentAssets","currentLiabilities","inventory","totalAssets","totalLiabilities","equity","longTermDebt","shortTermDebt"];
const metrics=new Set(metricList);
const instantMetrics=new Set(["cash","currentAssets","currentLiabilities","inventory","totalAssets","totalLiabilities","equity","longTermDebt","shortTermDebt"]);
const baseCurrency=unit=>String(unit||"").split("/")[0].trim().toUpperCase();
const key=(ticker,currency,end)=>[ticker,currency,end].join("|");
const days=(start,end)=>(Date.parse(end+"T00:00:00Z")-Date.parse(start+"T00:00:00Z"))/86400000;
const isAnnual=f=>f.status==="VERIFIED_SOURCE"&&annualForms.has(String(f.form).toUpperCase())&&metrics.has(f.metric)&&f.periodEnd&&Number.isFinite(f.value);
const isQuarter=f=>f.status==="VERIFIED_SOURCE"&&quarterForms.has(String(f.form).toUpperCase())&&metrics.has(f.metric)&&f.periodEnd&&f.periodEnd>="2025-01-01"&&Number.isFinite(f.value);
function normalize(facts,quarter=false){
 const allowed=facts.filter(quarter?isQuarter:isAnnual);
 const durations=allowed.filter(f=>!instantMetrics.has(f.metric)&&f.periodStart&&/^[A-Z]{3}$/.test(baseCurrency(f.unit)));
 const startCounts=new Map();
 for(const f of durations){
  const k=key(f.ticker.toUpperCase(),baseCurrency(f.unit),f.periodEnd),m=startCounts.get(k)||new Map();
  m.set(f.periodStart,(m.get(f.periodStart)||0)+1);startCounts.set(k,m);
 }
 const starts=new Map([...startCounts].map(([k,m])=>[k,[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0]]));
 const periods=new Map();
 for(const f of allowed){
  const ticker=f.ticker.toUpperCase();
  let currency=baseCurrency(f.unit);
  if(!/^[A-Z]{3}$/.test(currency)){
   currency=[...starts.keys()].map(k=>k.split("|")).find(parts=>parts[0]===ticker&&parts[2]===f.periodEnd)?.[1]||"";
  }
  if(!/^[A-Z]{3}$/.test(currency))continue;
  const periodKey=key(ticker,currency,f.periodEnd);
  const periodStart=instantMetrics.has(f.metric)?starts.get(periodKey):f.periodStart;
  if(!periodStart||starts.get(periodKey)!==periodStart)continue;
  const elapsed=days(f.periodStart,f.periodEnd);
  if(!instantMetrics.has(f.metric)){
   const valid=quarter?[[60,110],[150,200],[240,280]].some(([lo,hi])=>elapsed>=lo&&elapsed<=hi):elapsed>=300&&elapsed<=430;
   if(!valid)continue;
  }
  let p=periods.get(periodKey);
  if(!p){p={ticker,cik:f.cik,currency,periodStart,periodEnd:f.periodEnd,metrics:{}};periods.set(periodKey,p);}
  const old=p.metrics[f.metric];
  if(!old||[f.filedDate,f.importedAt].join("|")>[old.filedDate,old.importedAt].join("|")){
   p.metrics[f.metric]={value:f.value,unit:f.unit,tag:f.tag,filedDate:f.filedDate,accession:f.accession,sourceUrl:f.sourceUrl,form:f.form};
  }
 }
 return [...periods.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)||a.periodEnd.localeCompare(b.periodEnd));
}
const periods=normalize(source.facts,false);
const priceByPeriod=new Map((source.annualPrices||[]).map(price=>[[price.ticker.toUpperCase(),String(price.currency||'').toUpperCase(),price.periodEnd].join("|"),price]));
for(const period of periods){
 const quote=priceByPeriod.get([period.ticker,period.currency,period.periodEnd].join("|"));
 if(quote&&Number.isFinite(quote.close)&&quote.close>0){
  period.yearEndClose=quote.close;
  period.priceSource=quote.source||"GOOGLEFINANCE close · Financial_History";
 }
}
const quarterlyPeriods=normalize(source.facts,true);
const annual={schemaVersion:2,generatedAt:source.generatedAt,
 source:"Google Sheets SEC_Raw + Financial_History · SEC annual/quarterly facts and fiscal year-end closes",
 spreadsheetId:source.spreadsheetId,sourceImportedAt:source.sourceImportedAt,rawFactCount:source.factCount,
 annualPeriodCount:periods.length,quarterlyPeriodCount:quarterlyPeriods.length,
 tickerCount:new Set(periods.map(p=>p.ticker)).size,metrics:metricList,periods,quarterlyPeriods};
await writeFile(outputPath,JSON.stringify(annual));
console.log(`Normalized ${source.factCount} source facts to ${periods.length} annual and ${quarterlyPeriods.length} quarterly periods across ${annual.tickerCount} tickers.`);
