import {readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const inputPath=resolve(root,"src/data/googleSheetsSecFacts.json");
const outputPath=resolve(root,"src/data/googleSheetsSecAnnual.json");
const source=JSON.parse(await readFile(inputPath,"utf8"));
const annualForms=new Set(["10-K","10-K/A","20-F","20-F/A","40-F","40-F/A"]);
const metrics=new Set(["revenue","netIncome","operatingIncome","cashFromOperations","capex","epsDiluted"]);
const groups=new Map();

for(const fact of source.facts){
  if(fact.status!=="VERIFIED_SOURCE"||!annualForms.has(String(fact.form).toUpperCase())||!metrics.has(fact.metric))continue;
  if(!fact.periodStart||!fact.periodEnd||!Number.isFinite(fact.value))continue;
  const start=Date.parse(`${fact.periodStart}T00:00:00Z`);
  const end=Date.parse(`${fact.periodEnd}T00:00:00Z`);
  const days=(end-start)/86_400_000;
  if(!Number.isFinite(days)||days<300||days>430)continue;
  const ticker=fact.ticker.toUpperCase();
  const currency=String(fact.unit).split("/")[0].trim().toUpperCase();
  const key=[ticker,currency,fact.periodStart,fact.periodEnd].join("|");
  let period=groups.get(key);
  if(!period){
    period={ticker,cik:fact.cik,currency,periodStart:fact.periodStart,periodEnd:fact.periodEnd,metrics:{}};
    groups.set(key,period);
  }
  const prior=period.metrics[fact.metric];
  if(!prior||[fact.filedDate,fact.importedAt].join("|")>[prior.filedDate,prior.importedAt].join("|")){
    period.metrics[fact.metric]={value:fact.value,unit:fact.unit,tag:fact.tag,filedDate:fact.filedDate,accession:fact.accession,sourceUrl:fact.sourceUrl,form:fact.form};
  }
}

const periods=[...groups.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)||a.periodEnd.localeCompare(b.periodEnd));
const quarterForms=new Set(["10-Q","10-Q/A"]);
const quarterlyGroups=new Map();
for(const fact of source.facts){
  if(fact.status!=="VERIFIED_SOURCE"||!quarterForms.has(String(fact.form).toUpperCase())||!metrics.has(fact.metric))continue;
  if(!fact.periodStart||!fact.periodEnd||!Number.isFinite(fact.value)||fact.periodEnd<"2025-01-01")continue;
  const start=Date.parse(`${fact.periodStart}T00:00:00Z`);
  const end=Date.parse(`${fact.periodEnd}T00:00:00Z`);
  const days=(end-start)/86_400_000;
  if(!Number.isFinite(days)||![[60,110],[150,200],[240,280]].some(([min,max])=>days>=min&&days<=max))continue;
  const ticker=fact.ticker.toUpperCase();
  const currency=String(fact.unit).split("/")[0].trim().toUpperCase();
  const key=[ticker,currency,fact.periodStart,fact.periodEnd].join("|");
  let period=quarterlyGroups.get(key);
  if(!period){
    period={ticker,cik:fact.cik,currency,periodStart:fact.periodStart,periodEnd:fact.periodEnd,metrics:{}};
    quarterlyGroups.set(key,period);
  }
  const prior=period.metrics[fact.metric];
  if(!prior||[fact.filedDate,fact.importedAt].join("|")>[prior.filedDate,prior.importedAt].join("|")){
    period.metrics[fact.metric]={value:fact.value,unit:fact.unit,tag:fact.tag,filedDate:fact.filedDate,accession:fact.accession,sourceUrl:fact.sourceUrl,form:fact.form};
  }
}
const quarterlyPeriods=[...quarterlyGroups.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)||a.periodEnd.localeCompare(b.periodEnd)||a.periodStart.localeCompare(b.periodStart));
const annual={
  schemaVersion:1,
  generatedAt:source.generatedAt,
  source:"Google Sheets SEC_Raw · normalized annual and reported quarterly SEC facts",
  spreadsheetId:source.spreadsheetId,
  sourceImportedAt:source.sourceImportedAt,
  rawFactCount:source.factCount,
  annualPeriodCount:periods.length,
  quarterlyPeriodCount:quarterlyPeriods.length,
  tickerCount:new Set(periods.map(period=>period.ticker)).size,
  metrics:source.metrics,
  periods,
  quarterlyPeriods,
};
await writeFile(outputPath,JSON.stringify(annual));
console.log(`Normalized ${source.factCount} source facts to ${periods.length} annual and ${quarterlyPeriods.length} reported quarterly period rows across ${annual.tickerCount} tickers.`);
