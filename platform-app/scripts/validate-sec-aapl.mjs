#!/usr/bin/env node
// Financial Data Validation Engine v1: conservative SEC provenance and accounting checks.
// Fails closed: never publishes unvalidated data.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const path=process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'platform-app/src/data/sec/aapl.json';
const doc=JSON.parse(await fs.readFile(path,'utf8'));
const issues=[], warnings=[], results={};
const fail=(metric,reason)=>issues.push({metric,reason});
const warn=(metric,reason)=>warnings.push({metric,reason});
if(doc.schemaVersion!==1||doc.ticker!=='AAPL'||doc.cik!=='0000320193') fail('identity','Unexpected ticker, CIK or schema');
if(doc.source!=='SEC EDGAR companyfacts'||!/^https:\/\/data\.sec\.gov\/api\/xbrl\/companyfacts\/CIK\d{10}\.json$/.test(doc.sourceUrl||'')) fail('source','Unexpected source');
const flow=new Set(['revenue','netIncome','operatingIncome','cashFromOperations','capex','epsDiluted']);
const balance=new Set(['cash','currentAssets','currentLiabilities','inventory','totalAssets','totalLiabilities','equity','longTermDebt','shortTermDebt']);
const required=[...flow,...balance];
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s));
for(const key of required){
 const m=doc.metrics?.[key];
 if(!m){fail(key,'Missing metric');continue;}
 const problems=[];
 if(!Number.isFinite(m.value)) problems.push('nonfinite value');
 if(m.unit!==(key==='epsDiluted'?'USD/shares':'USD')) problems.push('unexpected unit');
 if(!validDate(m.periodEnd)||!validDate(m.filed)) problems.push('invalid date');
 if(!['10-K','10-Q'].includes(m.form)) problems.push('unexpected form');
 if(!/^\d{10}-\d{2}-\d{6}$/.test(m.accession||'')) problems.push('invalid accession');
 if(!m.tag||m.source!==doc.sourceUrl) problems.push('missing taxonomy/source');
 if(validDate(m.periodEnd)&&validDate(m.filed)&&m.filed<m.periodEnd) problems.push('filing predates period');
 if(flow.has(key)){
  if(!validDate(m.periodStart)) problems.push('flow missing start');
  else {const days=(Date.parse(m.periodEnd)-Date.parse(m.periodStart))/86400000;
    if(days<330||days>380) problems.push('flow is not annual');
  }
 }else if(m.periodStart) problems.push('balance has period start');
 if(problems.length) fail(key,problems.join('; '));
 else results[key]={status:'valid',periodEnd:m.periodEnd,filed:m.filed,unit:m.unit};
}
function near(a,b,tolerance){return Math.abs(a-b)<=tolerance*Math.max(Math.abs(a),Math.abs(b),1);}
const m=doc.metrics||{};
if(m.currentAssets&&m.totalAssets&&m.currentAssets.periodEnd===m.totalAssets.periodEnd&&m.currentAssets.value>m.totalAssets.value) fail('currentAssets','Exceeds total assets');
if(m.currentLiabilities&&m.totalLiabilities&&m.currentLiabilities.periodEnd===m.totalLiabilities.periodEnd&&m.currentLiabilities.value>m.totalLiabilities.value) fail('currentLiabilities','Exceeds total liabilities');
if(m.totalAssets&&m.totalLiabilities&&m.equity){
 const [a,l,e]=[m.totalAssets,m.totalLiabilities,m.equity];
 if(a.periodEnd===l.periodEnd&&l.periodEnd===e.periodEnd&&!near(a.value,l.value+e.value,0.005)) fail('balanceSheet','Assets != liabilities + equity');
 else if(!(a.periodEnd===l.periodEnd&&l.periodEnd===e.periodEnd)) warn('balanceSheet','Balance sheet dates differ; reconciliation deferred');
}
const annualEnds=[...flow].map(k=>m[k]?.periodEnd).filter(Boolean);
if(new Set(annualEnds).size>1) warn('annualFlows','Annual periods differ; cross-metric ratios disabled');
const result={schemaVersion:1,ticker:doc.ticker,validatedAt:new Date().toISOString(),status:issues.length?'REJECTED':'VALIDATED',metricCount:Object.keys(results).length,issues,warnings,metrics:results};
if(process.argv.includes('--report')){await fs.mkdir('platform-app/src/data/sec',{recursive:true});await fs.writeFile('platform-app/src/data/sec/aapl-validation.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
assert.equal(issues.length,0,'SEC data validation failed; import blocked');
