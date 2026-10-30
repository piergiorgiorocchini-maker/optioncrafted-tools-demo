#!/usr/bin/env node
// Read-only, one-symbol access probe. Do not log credentials or raw provider responses.
const key=process.env.ALPHAVANTAGE_API_KEY;
if(!key){console.error('ALPHAVANTAGE_API_KEY secret missing');process.exit(2);}
const endpoints=['OVERVIEW','INCOME_STATEMENT','BALANCE_SHEET','CASH_FLOW'];
const results=[];
for(const fn of endpoints){
 const url=new URL('https://www.alphavantage.co/query');
 url.searchParams.set('function',fn);
 url.searchParams.set('symbol','AAPL');
 url.searchParams.set('apikey',key);
 let status='UNKNOWN',detail='';
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok){status='HTTP_ERROR';detail='HTTP '+response.status;}
  else {
   const body=await response.json();
   if(body['Error Message'])status='API_ERROR';
   else if(body.Information||body.Note){status='API_LIMIT_OR_PLAN';detail=String(body.Information||body.Note).slice(0,180).replaceAll(key,'[REDACTED]');}
   else if(fn==='OVERVIEW'){
    status=body.Symbol==='AAPL'?'AVAILABLE':'UNEXPECTED_RESPONSE';
    detail='fields='+Object.keys(body).length;
   }else{
    const annual=body.annualReports;
    status=Array.isArray(annual)&&annual.length?'AVAILABLE':Array.isArray(annual)?'EMPTY':'UNEXPECTED_RESPONSE';
    detail='annualReports='+(Array.isArray(annual)?annual.length:0);
   }
  }
 }catch(e){status='REQUEST_ERROR';detail=e.name==='TimeoutError'?'timeout':e.name;}
 results.push({endpoint:fn,status,detail});
 console.log(JSON.stringify(results.at(-1)));
 if(status==='API_LIMIT_OR_PLAN'&&/rate limit|calls per day|requests per day/i.test(detail)){console.log('Stopping to respect rate limit');break;}
}
console.log('PROBE_SUMMARY '+JSON.stringify({symbol:'AAPL',results}));
if(results.some(r=>r.status==='REQUEST_ERROR'||r.status==='HTTP_ERROR'))process.exitCode=1;
