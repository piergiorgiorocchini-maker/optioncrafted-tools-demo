#!/usr/bin/env node
// Industrial SEC coverage gate. Missing, derived, and verified are distinct states.
import fs from 'node:fs/promises';
const report=JSON.parse(await fs.readFile('platform-app/reports/fdve-cluster-v2.json','utf8'));
const tickers=['AAPL','MSFT','XOM','WMT'];
const rows=[];
for(const ticker of tickers){
 const company=report.companies.find(c=>c.ticker===ticker);
 if(!company)throw new Error('Missing pilot company '+ticker);
 for(const [year,period] of Object.entries(company.years)){
  const entries=Object.entries(period.metrics);
  const available=entries.filter(([,v])=>v.status==='AVAILABLE').length;
  const derived=entries.filter(([,v])=>v.status==='DERIVED').length;
  const unresolved=entries.filter(([,v])=>v.status!=='AVAILABLE'&&v.status!=='DERIVED').map(([metric,v])=>({metric,status:v.status}));
  rows.push({ticker,year,verified:available,total:entries.length,derived,coverage:Number((100*available/entries.length).toFixed(2)),unresolved});
 }
}
const verified=rows.reduce((a,r)=>a+r.verified,0);
const total=rows.reduce((a,r)=>a+r.total,0);
const result={target:95,verified,total,coverage:Number((100*verified/total).toFixed(2)),passes:verified/total>=.95,rows};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--enforce')&&!result.passes)process.exitCode=1;
