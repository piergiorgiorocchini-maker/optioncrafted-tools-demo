#!/usr/bin/env node
// Five-company FDVE audit: fiscal-period SEC coverage, bank-specific taxonomy, optional live FMP reconciliation.
// Read-only for production data. Never commits raw provider payloads or credentials.
import fs from 'node:fs/promises';
import {METRICS} from './fdve-model.mjs';
import {BANK_SEC_CANDIDATES,FMP_FIELDS,selectFiscalSec,deriveTotalLiabilities,reconcileValue,selectBankFiscalSec,findRelatedTags} from './fdve-cluster-mapping.mjs';
const cfg=JSON.parse(await fs.readFile('platform-app/config/fdve-cluster-pilot.json','utf8'));
const profiles=JSON.parse(await fs.readFile('platform-app/config/fdve-sector-profiles.json','utf8'));
const asOf=new Date().toISOString().slice(0,10);
const agent=process.env.SEC_USER_AGENT;
if(!agent||!agent.includes('@'))throw Error('SEC_USER_AGENT required');
const fmpKey=process.env.FMP_API_KEY||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,headers={}){
 for(let i=0;i<4;i++){
  const response=await fetch(url,{headers});
  if(response.ok)return response.json();
  if(![429,500,502,503,504].includes(response.status)||i===3)throw Error('HTTP '+response.status+' from '+new URL(url).hostname);
  await sleep(1200*(i+1));
 }
}
const out=[];
await fs.mkdir('platform-app/reports/fdve-cluster-raw',{recursive:true});
for(const company of cfg.companies){
 const profile=Object.entries(profiles.profiles).find(([,p])=>p.companies.includes(company.ticker));
 if(!profile)throw Error('Missing sector profile for '+company.ticker);
 const [profileName,definition]=profile;
 const item={ticker:company.ticker,cik:company.cik,profile:profileName,sec:{status:'PENDING'},fmp:{status:fmpKey?'PENDING':'MISSING_CREDENTIAL'},years:{}};
 try{
  const url='https://data.sec.gov/api/xbrl/companyfacts/CIK'+company.cik+'.json';
  const doc=await request(url,{'User-Agent':agent,Accept:'application/json'});
  if(String(doc.cik).padStart(10,'0')!==company.cik)throw Error('CIK mismatch');
  await fs.writeFile('platform-app/reports/fdve-cluster-raw/'+company.ticker+'-sec.json',JSON.stringify(doc));
  const concepts=doc.facts?.['us-gaap']||{};
  item.sec={status:'OK',source:url,company:doc.entityName};
  for(const year of [2024,2025]){
   const metrics={};
   for(const metric of definition.applicable){
    const kind=METRICS[metric].kind;
    let found=selectFiscalSec(concepts,metric,kind,year,asOf);
    if(metric==='totalLiabilities'&&found.status==='PERIOD_MISSING'&&company.ticker==='WMT'){
     found=deriveTotalLiabilities(concepts,year,asOf);
    }
    if(found.status==='PERIOD_MISSING')found.taxonomyCandidates=findRelatedTags(concepts,metric);
    metrics[metric]=found;
   }
   const bank={};
   if(profileName==='bank'){
    for(const [metric,tags] of Object.entries(BANK_SEC_CANDIDATES)){
     const present=tags.filter(tag=>!!concepts[tag]);
     bank[metric]={...selectBankFiscalSec(concepts,metric,year,asOf),tagsPresent:present};
    }
   }
   item.years[year]={metrics,bank,coverage:{applicable:definition.applicable.length,available:Object.values(metrics).filter(x=>['AVAILABLE','DERIVED'].includes(x.status)).length}};
   item.years[year].coverage.rate=item.years[year].coverage.available/item.years[year].coverage.applicable;
  }
 }catch(e){item.sec={status:'SOURCE_ERROR',reason:e.message};out.push(item);continue;}
 if(fmpKey){
  const datasets={};let error=null;
  for(const [name,endpoint] of Object.entries({income:'income-statement',balance:'balance-sheet-statement',cashflow:'cash-flow-statement'})){
   try{
    const url='https://financialmodelingprep.com/stable/'+endpoint+'?symbol='+encodeURIComponent(company.ticker)+'&period=annual&limit=6&apikey='+encodeURIComponent(fmpKey);
    const data=await request(url);
    if(!Array.isArray(data))throw Error('Unexpected '+name+' response');
    datasets[name]=data;
    await fs.writeFile('platform-app/reports/fdve-cluster-raw/'+company.ticker+'-fmp-'+name+'.json',JSON.stringify(data));
   }catch(e){error=(error?error+'; ':'')+name+': '+e.message;}
  }
  item.fmp={status:error?'PARTIAL':'OK',error:error||null};
  for(const year of [2024,2025]){
   const comparisons={};
   for(const [metric,sec] of Object.entries(item.years[year].metrics)){
    const [dataset,field,sign]=FMP_FIELDS[metric];
    const records=datasets[dataset]||[];
    const candidates=records.filter(x=>Number(x.fiscalYear)===year&&x.period==='FY'&&x.date===sec.periodEnd&&Number.isFinite(x[field]));
    if(!candidates.length){
     comparisons[metric]={status:records.length?'FMP_PERIOD_OR_FIELD_MISSING':'FMP_SOURCE_MISSING'};
     continue;
    }
    const vals=new Set(candidates.map(x=>x[field]));
    if(vals.size>1){comparisons[metric]={status:'AMBIGUOUS_FMP_REVISION'};continue;}
    const x=candidates[0];
    const currency=x.reportedCurrency||x.currency||null;
    comparisons[metric]=reconcileValue(sec,{value:x[field]*sign,periodEnd:x.date,currency},metric);
    comparisons[metric].fmpField=field;
   }
   item.years[year].comparisons=comparisons;
  }
 }
 out.push(item);
 await sleep(250);
}
const totals={applicable:0,available:0,compared:0,matched:0,differences:0,unresolved:0};
for(const item of out)for(const year of [2024,2025]){
 const row=item.years[year];
 if(!row)continue;
 totals.applicable+=row.coverage.applicable;totals.available+=row.coverage.available;
 for(const c of Object.values(row.comparisons||{})){
  if(['MATCH','ROUNDING','DIFFERENCE'].includes(c.status)){totals.compared++;if(c.status!=='DIFFERENCE')totals.matched++;else totals.differences++;}
  else totals.unresolved++;
 }
}
totals.coverage=totals.applicable?totals.available/totals.applicable:null;
totals.reconciliationRate=totals.compared?totals.matched/totals.compared:null;
const report={schemaVersion:2,generatedAt:new Date().toISOString(),periods:['FY2024','FY2025'],method:'SEC 10-K fiscal-year aligned, strict aliases; optional FMP same-date and USD reconciliation',notes:['Coverage excludes stale observations and NOT_APPLICABLE metrics','Bank-specific concepts are discovery-only until definitions validated','DERIVED liabilities are not source-reported and must be marked as such','FMP comparisons require FMP_API_KEY secret; absence is reported, never interpreted as success'],totals,companies:out};
await fs.writeFile('platform-app/reports/fdve-cluster-v2.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals,companies:out.map(x=>({ticker:x.ticker,sec:x.sec.status,fmp:x.fmp.status,coverage2024:x.years[2024]?.coverage,coverage2025:x.years[2025]?.coverage}))},null,2));
if(out.some(x=>x.sec.status!=='OK'))process.exitCode=1;
