#!/usr/bin/env node
// Conservative incremental provider ingestion. No credentials or raw payloads committed.
// A durable per-day ledger prevents accidental repeat calls after reruns.
import fs from 'node:fs/promises';
import {AV_ENDPOINTS,normalizeAlphaVantageAnnual} from './fdve-alpha-vantage-adapter.mjs';
import {FMP_FIELDS} from './fdve-cluster-mapping.mjs';
const dir='platform-app/reports/provider-cache',statePath=dir+'/daily-state.json';
const today=new Date().toISOString().slice(0,10);
const parseLimit=(name,defaultValue,max)=>{const raw=process.env[name];const n=raw===undefined?defaultValue:Number(raw);if(!Number.isInteger(n)||n<0||n>max)throw Error('Invalid '+name);return n;};
const budgets={FMP:parseLimit('FDVE_FMP_DAILY_CALLS',3,250),ALPHA_VANTAGE:parseLimit('FDVE_AV_DAILY_CALLS',3,250)};
const tickers=(process.env.FDVE_PROVIDER_TICKERS||'AAPL,MSFT,XOM,WMT').split(',').map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(s));
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
 const log=current[provider],key=keys[provider],rows=[];
 if(!key){result.providers[provider]={status:'MISSING_CREDENTIAL',requestsToday:log.count};continue;}
 let available=budgets[provider]-log.count;
 if(available<=0){result.providers[provider]={status:'DAILY_BUDGET_EXHAUSTED',requestsToday:log.count};continue;}
 // Round robin over issuers, maintaining state across days.
 let cursor=state.cursor[provider]||0,examined=0,halted=false;
 while(available>0&&examined<tickers.length){
  const ticker=tickers[cursor%tickers.length];cursor++;examined++;
  const cached=await read(dir+'/'+provider.toLowerCase()+'-'+ticker+'.json',{schemaVersion:1,provider,ticker,statements:{},updatedAt:null});
  for(const [statement,endpoint] of endpoints[provider]){
   if(available<=0||halted)break;
   const id=ticker+':'+statement;
   if(log.attempts.some(x=>x.id===id))continue;
   // Persist reservation BEFORE network request. A failed request consumes one conservative budget slot.
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
    // Cache only normalized, selected annual statement fields; no raw provider responses.
    const fields=provider==='FMP'?Object.entries(FMP_FIELDS).filter(([,x])=>x[0]===statement):[];
    if(provider==='FMP'){
     cached.statements[statement]=outcome.data.filter(x=>x.period==='FY'&&/^20\d\d-\d\d-\d\d$/.test(x.date||'')).map(x=>({
      year:x.fiscalYear,date:x.date,currency:x.reportedCurrency||x.currency||null,
      values:Object.fromEntries(fields.filter(([,spec])=>Number.isFinite(x[spec[1]])).map(([metric,spec])=>[metric,x[spec[1]]*spec[2]]))
     }));
    }else{
     const fields=Object.keys((await import('./fdve-alpha-vantage-adapter.mjs')).AV_FIELDS).filter(k=>(awaitableField(k))===statement);
     function awaitableField(k){return ({revenue:'income',netIncome:'income',operatingIncome:'income',epsDiluted:'income',cashFromOperations:'cashflow',capex:'cashflow',cash:'balance',currentAssets:'balance',currentLiabilities:'balance',inventory:'balance',totalAssets:'balance',totalLiabilities:'balance',equity:'balance',longTermDebt:'balance',shortTermDebt:'balance'})[k];}
     const {AV_FIELDS}=await import('./fdve-alpha-vantage-adapter.mjs');
     cached.statements[statement]=outcome.data.annualReports.filter(x=>/^20\d\d-\d\d-\d\d$/.test(x.fiscalDateEnding||'')).map(x=>({
      date:x.fiscalDateEnding,currency:x.reportedCurrency||null,
      values:Object.fromEntries(fields.filter(k=>Number.isFinite(Number(x[AV_FIELDS[k][1]]))&&x[AV_FIELDS[k][1]]!==null&&x[AV_FIELDS[k][1]]!=='None').map(k=>[k,k==='capex'?Math.abs(Number(x[AV_FIELDS[k][1]])):Number(x[AV_FIELDS[k][1]])]))
     }));
    }
    cached.updatedAt=new Date().toISOString();await fs.writeFile(dir+'/'+provider.toLowerCase()+'-'+ticker+'.json',JSON.stringify(cached,null,2)+'\n');
   }
   log.attempts[log.attempts.length-1].status=status;await save();
   rows.push({ticker,statement,status});
   if(['PREMIUM_REQUIRED','API_NOTICE','HTTP_429','HTTP_403'].includes(status))halted=true;
  }
  if(halted)break;
 }
 state.cursor[provider]=cursor%tickers.length;await save();
 result.providers[provider]={status:halted?'PROVIDER_NOTICE':'COMPLETED',requestsToday:log.count,attempts:rows};
}
await fs.writeFile(dir+'/last-run.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({date:today,budgets,providers:result.providers},null,2));
