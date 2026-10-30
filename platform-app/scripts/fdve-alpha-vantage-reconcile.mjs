#!/usr/bin/env node
// Read-only pilot reconciliation: SEC 10-K vs Alpha Vantage FY2024/FY2025 for AAPL.
// Writes a public summary, never provider raw payloads or credentials.
import fs from 'node:fs/promises';
import {normalizeAlphaVantageAnnual,compareAnnualFacts,AV_ENDPOINTS} from './fdve-alpha-vantage-adapter.mjs';
const key=process.env.ALPHAVANTAGE_API_KEY;
if(!key)throw Error('ALPHAVANTAGE_API_KEY is required');
const report=JSON.parse(await fs.readFile('platform-app/reports/fdve-cluster-v2.json','utf8'));
const company=report.companies.find(c=>c.ticker==='AAPL');
if(!company||company.sec.status!=='OK')throw Error('SEC AAPL baseline unavailable');
const statements={};const sourceStatuses={};
for(const [name,fn] of Object.entries(AV_ENDPOINTS)){
 await new Promise(r=>setTimeout(r,1800));
 const url=new URL('https://www.alphavantage.co/query');
 url.searchParams.set('function',fn);url.searchParams.set('symbol','AAPL');url.searchParams.set('apikey',key);
 const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
 if(!response.ok){sourceStatuses[name]='HTTP_'+response.status;continue;}
 const data=await response.json();
 if(Array.isArray(data.annualReports)){statements[name]=data;sourceStatuses[name]='AVAILABLE';}
 else if(data.Information||data.Note){const msg=String(data.Information||data.Note);sourceStatuses[name]=/premium endpoint/i.test(msg)?'PREMIUM_REQUIRED':/requests more sparingly|rate limit/i.test(msg)?'RATE_LIMITED':'API_NOTICE';}
 else sourceStatuses[name]='UNEXPECTED_RESPONSE';
}
const years={};const totals={matched:0,rounding:0,review:0,unavailable:0};
for(const year of [2024,2025]){
 const comparisons={};
 for(const [metric,sec] of Object.entries(company.years[String(year)].metrics)){
  const av=normalizeAlphaVantageAnnual({ticker:'AAPL',metric,year,statements});
  const cmp=compareAnnualFacts(sec,av,metric);
  comparisons[metric]={...cmp,secStatus:sec.status,alternativeStatus:av.status,secTag:sec.tag||sec.method||null,alternativeField:av.field||null};
  if(cmp.status==='MATCH')totals.matched++;
  else if(cmp.status==='ROUNDING')totals.rounding++;
  else if(cmp.status==='REVIEW_REQUIRED')totals.review++;
  else totals.unavailable++;
 }
 years[year]={comparisons};
}
const output={schemaVersion:1,generatedAt:new Date().toISOString(),ticker:'AAPL',periods:['FY2024','FY2025'],primary:'SEC',alternative:'ALPHA_VANTAGE',sourceStatuses,totals,years,notes:['Exact fiscal-end and unit matching required','Differences require semantic review; never overwrite SEC','Only AAPL included in this initial live reconciliation']};
await fs.writeFile('platform-app/reports/fdve-alpha-vantage-aapl.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({sourceStatuses,totals}));
if(Object.values(sourceStatuses).some(x=>x!=='AVAILABLE'))process.exitCode=1;
