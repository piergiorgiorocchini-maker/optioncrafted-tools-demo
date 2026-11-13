#!/usr/bin/env node
// Conservative incremental provider ingestion. FMP responses are normalized before caching.
// FMP requires explicit multi-user display permission, and this workflow publishes its cache
// through the static app repository. Both approvals must be enabled before any FMP request.
import fs from 'node:fs/promises';
import {AV_ENDPOINTS,AV_FIELDS} from './fdve-alpha-vantage-adapter.mjs';
import {FMP_FIELDS} from './fdve-cluster-mapping.mjs';
const dir='platform-app/reports/provider-cache',statePath=dir+'/daily-state.json';
const today=new Date().toISOString().slice(0,10);
const parseLimit=(name,defaultValue,max)=>{const raw=process.env[name];const n=raw===undefined?defaultValue:Number(raw);if(!Number.isInteger(n)||n<0||n>max)throw Error('Invalid '+name);return n;};
const parseTickers=(value)=>String(value||'').split(',').map(s=>s.trim().toUpperCase()).filter((s,i,a)=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(s)&&a.indexOf(s)===i);
const budgets={FMP:parseLimit('FDVE_FMP_DAILY_CALLS',0,250),ALPHA_VANTAGE:parseLimit('FDVE_AV_DAILY_CALLS',3,250)};
const pilotTickers=parseTickers(process.env.FDVE_PROVIDER_TICKERS||'AAPL,MSFT,XOM,WMT');
let coveredCommonStocks=[];
try{
 const coverage=JSON.parse(await fs.readFile('platform-app/src/data/adminCoverageSnapshot.json','utf8'));
 coveredCommonStocks=parseTickers((coverage.tickers||[]).filter(x=>String(x.instrumentType||'').toUpperCase()==='COMMON_STOCK').map(x=>x.ticker).join(','));
}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
const fmpTickers=parseTickers(process.env.FDVE_FMP_TICKERS||coveredCommonStocks.join(',')||pilotTickers.join(','));
const providerTickers={FMP:fmpTickers,ALPHA_VANTAGE:parseTickers(process.env.FDVE_AV_TICKERS||process.env.FDVE_PROVIDER_TICKERS||'AAPL,MSFT,XOM,WMT')};
const fmpDisplayLicensed=String(process.env.FMP_DATA_DISPLAY_LICENSED||'').toLowerCase()==='true';
const fmpPublicCacheApproved=String(process.env.FDVE_FMP_PUBLIC_CACHE_APPROVED||'').toLowerCase()==='true';
await fs.mkdir(dir,{recursive:true});
const read=async(p,fallback)=>{try{return JSON.parse(await fs.readFile(p,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const state=await read(statePath,{schemaVersion:1,days:{},cursor:{FMP:0,ALPHA_VANTAGE:0}});
state.days[today]??={FMP:{attempts:[],count:0},ALPHA_VANTAGE:{attempts:[],count:0}};
const current=state.days[today];
const save=()=>fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n');
const request=async url=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)return {status:'HTTP_'+response.status};
 const data=await response.json();
 if(data?.Information||data?.Note||data?.['Error Message']||data?.['Error Message.'])return {status:/premium/i.test(String(data.Information||data.Note))?'PREMIUM_REQUIRED':'API_NOTICE'};
 return {status:'OK',data};
};
const endpoints={
 FMP:[['income','income-statement'],['balance','balance-sheet-statement'],['cashflow','cash-flow-statement']],
 ALPHA_VANTAGE:Object.entries(AV_ENDPOINTS)
};
const keys={FMP:process.env.FMP_API_KEY,ALPHA_VANTAGE:process.env.ALPHAVANTAGE_API_KEY};
const result={schemaVersion:1,generatedAt:new Date().toISOString(),budgets,providers:{}};
for(const provider of ['FMP','ALPHA_VANTAGE']){
 const tickers=providerTickers[provider],log=current[provider],key=keys[provider],rows=[];
 if(provider==='FMP'&&(!fmpDisplayLicensed||!fmpPublicCacheApproved)){
  result.providers[provider]={status:!fmpDisplayLicensed?'DISPLAY_LICENSE_REQUIRED':'PUBLIC_CACHE_APPROVAL_REQUIRED',requestsToday:log.count};
  continue;
 }
 if(!key){result.providers[provider]={status:'MISSING_CREDENTIAL',requestsToday:log.count};continue;}
 let available=budgets[provider]-log.count;
 if(available<=0){result.providers[provider]={status:'DAILY_BUDGET_EXHAUSTED',requestsToday:log.count};continue;}
 let cursor=state.cursor[provider]||0,examined=0,halted=false;
 while(available>0&&examined<tickers.length){
  const ticker=tickers[cursor%tickers.length];cursor++;examined++;
  const cached=await read(dir+'/'+provider.toLowerCase()+'-'+ticker+'.json',{schemaVersion:1,provider,ticker,statements:{},updatedAt:null});
  for(const [statement,endpoint] of endpoints[provider]){
   if(available<=0||halted)break;
   const id=ticker+':'+statement;
   if(log.attempts.some(x=>x.id===id))continue;
   // Reserve before network request so reruns never exceed the daily budget.
   log.attempts.push({id,at:new Date().toISOString(),status:'ATTEMPTED'});
   log.count++;available--;state.cursor[provider]=cursor-1;await save();
   let outcome;
   try{
    const url=provider==='FMP'?new URL('https://financialmodelingprep.com/stable/'+endpoint):new URL('https://www.alphavantage.co/query');
    if(provider==='FMP'){url.searchParams.set('symbol',ticker);url.searchParams.set('period','annual');url.searchParams.set('limit','6');url.searchParams.set('apikey',key);}
    else{url.searchParams.set('function',endpoint);url.searchParams.set('symbol',ticker);url.searchParams.set('apikey',key);}
    outcome=await request(url);
   }catch(e){outcome={status:'REQUEST_ERROR'};}
   const valid=outcome.status==='OK'&&(provider==='FMP'?Array.isArray(outcome.data):Array.isArray(outcome.data?.annualReports));
   const status=valid?'AVAILABLE':outcome.status==='OK'?'UNEXPECTED_RESPONSE':outcome.status;
   if(valid){
    if(provider==='FMP'){
     const fields=Object.entries(FMP_FIELDS).filter(([,spec])=>spec[0]===statement);
     cached.statements[statement]=outcome.data.filter(x=>x.period==='FY'&&/^20\d\d-\d\d-\d\d$/.test(x.date||'')).map(x=>{
      const values={};
      for(const [metric,spec] of fields){
       const raw=x[spec[1]];
       if(raw===null||raw===undefined||raw==='')continue;
       const number=Number(raw);
       if(!Number.isFinite(number))continue;
       values[metric]=metric==='capex'?Math.abs(number):number*spec[2];
      }
      return {year:String(x.fiscalYear||x.date.slice(0,4)),date:x.date,filedDate:x.filingDate||x.fillingDate||x.acceptedDate||null,currency:x.reportedCurrency||x.currency||null,values};
     });
    }else{
     const fields=Object.keys(AV_FIELDS).filter(k=>AV_FIELDS[k][0]===statement);
     cached.statements[statement]=outcome.data.annualReports.filter(x=>/^20\d\d-\d\d-\d\d$/.test(x.fiscalDateEnding||'')).map(x=>({
      date:x.fiscalDateEnding,currency:x.reportedCurrency||null,
      values:Object.fromEntries(fields.filter(k=>Number.isFinite(Number(x[AV_FIELDS[k][1]]))&&x[AV_FIELDS[k][1]]!==null&&x[AV_FIELDS[k][1]]!=='None').map(k=>[k,k==='capex'?Math.abs(Number(x[AV_FIELDS[k][1]])):Number(x[AV_FIELDS[k][1]])]))
     }));
    }
    cached.updatedAt=new Date().toISOString();await fs.writeFile(dir+'/'+provider.toLowerCase()+'-'+ticker+'.json',JSON.stringify(cached,null,2)+'\n');
   }
   log.attempts[log.attempts.length-1].status=status;await save();rows.push({ticker,statement,status});
   if(['PREMIUM_REQUIRED','API_NOTICE','HTTP_402','HTTP_429','HTTP_403'].includes(status))halted=true;
  }
  if(halted)break;
 }
 state.cursor[provider]=cursor%tickers.length;await save();
 result.providers[provider]={status:halted?'PROVIDER_NOTICE':'COMPLETED',requestsToday:log.count,attempts:rows};
}
await fs.writeFile(dir+'/last-run.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({date:today,budgets,providers:result.providers},null,2));
