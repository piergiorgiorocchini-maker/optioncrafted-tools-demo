#!/usr/bin/env node
// SEC XBRL ingestion, initial AAPL pilot. Node 20+, no dependencies.
import fs from 'node:fs/promises';
const cik = '0000320193';
const ticker = 'AAPL';
const agent = process.env.SEC_USER_AGENT;
if (!agent || !agent.includes('@')) throw new Error('Set SEC_USER_AGENT to organization and contact email');
const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchFacts() {
  for (let attempt=0;attempt<4;attempt++) {
    const response = await fetch(url, {headers:{'User-Agent':agent,'Accept':'application/json','Accept-Encoding':'gzip'}});
    if(response.ok) return response.json();
    if (![429,500,502,503,504].includes(response.status)) throw new Error(`SEC HTTP ${response.status}`);
    if(attempt===3) throw new Error(`SEC HTTP ${response.status}, retries exhausted`);
    await sleep(2000 * 2**attempt);
  }
}
const tags = {
  revenue:['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],
  netIncome:['NetIncomeLoss'],
  operatingIncome:['OperatingIncomeLoss'],
  cashFromOperations:['NetCashProvidedByUsedInOperatingActivities'],
  capex:['PaymentsToAcquirePropertyPlantAndEquipment'],
  cash:['CashAndCashEquivalentsAtCarryingValue'],
  currentAssets:['AssetsCurrent'],
  currentLiabilities:['LiabilitiesCurrent'],
  inventory:['InventoryNet'],
  totalAssets:['Assets'],
  totalLiabilities:['Liabilities'],
  equity:['StockholdersEquity'],
  longTermDebt:['LongTermDebtNoncurrent'],
  shortTermDebt:['LongTermDebtCurrent'],
  epsDiluted:['EarningsPerShareDiluted']
};
function choose(concepts, names, unit, kind) {
  for(const name of names) {
    const facts = concepts[name]?.units?.[unit] || [];
    const eligible = facts.filter(f=>['10-K','10-Q'].includes(f.form) && f.filed && f.end && Number.isFinite(f.val) &&
      (kind==='instant' ? !f.start : !!f.start && (Date.parse(f.end)-Date.parse(f.start))/86400000 >= (kind==='annual'?330:70) &&
      (Date.parse(f.end)-Date.parse(f.start))/86400000 <= (kind==='annual'?380:105)));
    eligible.sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
    if(eligible.length) {
      const f=eligible[0];
      return {value:f.val,periodStart:f.start??null,periodEnd:f.end,filed:f.filed,form:f.form,accession:f.accn,tag:name,unit,source:url};
    }
  }
  return null;
}
const data = await fetchFacts();
if(!data?.facts?.['us-gaap'] || Number(data.cik)!==320193) throw new Error('Invalid AAPL SEC response');
const concepts=data.facts['us-gaap'];
const metrics={};
for(const [name,names] of Object.entries(tags)){
  const unit=name==='epsDiluted'?'USD/shares':'USD';
  const kind=['cash','currentAssets','currentLiabilities','inventory','totalAssets','totalLiabilities','equity','longTermDebt','shortTermDebt'].includes(name)?'instant':'annual';
  metrics[name]=choose(concepts,names,unit,kind);
}
const missing=Object.entries(metrics).filter(([,v])=>v===null).map(([k])=>k);
const output={schemaVersion:1,ticker,cik,company:data.entityName,source:'SEC EDGAR companyfacts',sourceUrl:url,generatedAt:new Date().toISOString(),units:'USD (raw, not millions)',metrics,missing,notes:'Annual flow metrics and latest balance-sheet instants. Do not interpret as TTM or sum debt fields without taxonomy reconciliation.'};
const file='platform-app/src/data/sec/aapl.json';
await fs.mkdir('platform-app/src/data/sec',{recursive:true});
await fs.writeFile(file,JSON.stringify(output,null,2)+'\n');
console.log(`SEC ${ticker}: ${Object.keys(metrics).length-missing.length} fields, ${missing.length} missing; wrote ${file}`);
