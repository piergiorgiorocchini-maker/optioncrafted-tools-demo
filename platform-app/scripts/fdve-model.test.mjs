import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSecFact,validateFact,selectPeriod,deriveAnnualOrTTM,validateBalance} from './fdve-model.mjs';
const sourceUrl='https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json';
const make=(metric,value,start,end,filed='2026-07-31',accn='0000320193-26-000020')=>normalizeSecFact({ticker:'AAPL',cik:'0000320193',metric,tag:'ExampleTag',sourceUrl,unit:metric==='epsDiluted'?'USD/shares':'USD',observation:{val:value,start,end,filed,form:start?'10-Q':'10-Q',accn}});
test('valid SEC instant and rejection of wrong units',()=>{
 const f=make('cash',100,null,'2026-06-27');
 assert.equal(validateFact(f).status,'VALID');
 assert.equal(validateFact({...f,unit:'USD millions'}).status,'REJECTED');
});
test('reject malformed and future filing dates without throwing',()=>{
 const f=make('cash',100,null,'2026-06-27');
 assert.equal(validateFact({...f,filing:{...f.filing,filed:'2026-99-99'}}).status,'REJECTED');
 assert.equal(validateFact({...f,filing:{...f.filing,filed:'2027-01-01'}},{asOf:'2026-10-30'}).status,'REJECTED');
});
test('reject mixed CIK provenance',()=>{
 const f=make('cash',100,null,'2026-06-27');
 assert.equal(validateFact({...f,entity:{ticker:'AAPL',cik:'0000000001'}}).status,'REJECTED');
});
test('latest filed revision wins only within same period',()=>{
 const old=make('cash',100,null,'2026-06-27','2026-07-31');
 const revised=make('cash',110,null,'2026-06-27','2026-08-03','0000320193-26-000021');
 const different=make('cash',999,null,'2026-03-28','2026-08-04','0000320193-26-000022');
 assert.equal(selectPeriod([old,revised,different],{metric:'cash',end:'2026-06-27',asOf:'2026-10-30'}).value,110);
});
test('TTM derived from aligned annual and YTD, not EPS',()=>{
 const annual=make('revenue',400,'2024-09-29','2025-09-27','2025-10-31','0000320193-25-000079');
 const curr=make('revenue',330,'2025-09-28','2026-06-27');
 const prior=make('revenue',300,'2024-09-29','2025-06-28','2025-08-01','0000320193-25-000050');
 assert.equal(deriveAnnualOrTTM({annual,currentYtd:curr,priorYtd:prior}).value,430);
 assert.equal(deriveAnnualOrTTM({annual:{...annual,metric:'epsDiluted'},currentYtd:curr,priorYtd:prior}).status,'UNAVAILABLE');
});
test('balance sheet equality and subtotal checks',()=>{
 const a=make('totalAssets',300,null,'2026-06-27');
 const l=make('totalLiabilities',200,null,'2026-06-27');
 const e=make('equity',100,null,'2026-06-27');
 assert.equal(validateBalance({totalAssets:a,totalLiabilities:l,equity:e}).status,'VALID');
 assert.equal(validateBalance({totalAssets:a,totalLiabilities:l,equity:{...e,value:90}}).status,'REJECTED');
});
