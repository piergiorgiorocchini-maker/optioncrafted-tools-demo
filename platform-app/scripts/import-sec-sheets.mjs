#!/usr/bin/env node
// Import validated SEC AAPL snapshot into the existing Google Sheet.
// Requires GOOGLE_SERVICE_ACCOUNT_JSON (service account shared as editor).
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const spreadsheetId=process.env.OPTIONSCRAFTED_SHEET_ID;
const credentials=process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if(!spreadsheetId||!credentials) throw new Error('Set OPTIONSCRAFTED_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON');
const account=JSON.parse(credentials);
if(!account.client_email||!account.private_key) throw new Error('Invalid service account JSON');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const head=b64({alg:'RS256',typ:'JWT'});
const body=b64({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
const signature=crypto.sign('RSA-SHA256',Buffer.from(head+'.'+body),account.private_key).toString('base64url');
const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+body+'.'+signature})});
if(!response.ok) throw new Error('Google token HTTP '+response.status);
const token=(await response.json()).access_token;
const base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheetId);
async function api(path,opts={}){const r=await fetch(base+path,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opts.headers||{})}});if(!r.ok) throw new Error('Sheets HTTP '+r.status+': '+(await r.text()).slice(0,350));return r.json();}
const data=JSON.parse(await fs.readFile('platform-app/src/data/sec/aapl.json','utf8'));
if(data.ticker!=='AAPL'||data.cik!=='0000320193'||!data.metrics) throw new Error('Unexpected SEC snapshot');
const rows=Object.entries(data.metrics).filter(([,v])=>v&&Number.isFinite(v.value)).map(([name,v])=>[data.ticker,data.cik,name,v.value,v.periodStart||'',v.periodEnd,v.filed,v.form,v.accession||'',v.tag,v.unit,v.source,data.generatedAt,'VERIFIED_SOURCE']);
if(rows.length<8) throw new Error('SEC snapshot incomplete: '+rows.length);
const read=async range=>api('/values/'+encodeURIComponent(range));
const raw=await read('SEC_Raw!A1:N5000');
const old=raw.values||[];
const retained=old.slice(1).filter(r=>r[0]!=='AAPL'&&r.some(v=>v!==''));
if(retained.length+rows.length>4999) throw new Error('SEC_Raw capacity exceeded');
const all=[['Ticker','CIK','Metric','Value USD','Period Start','Period End','Filed Date','Form','Accession','SEC Tag','Unit','Source URL','Imported At','Status'],...retained,...rows];
const log=await read('Sync_Log!A1:I5000');
const oldLog=(log.values||[]).slice(1).filter(r=>r[0]!=='AAPL'||r[1]!=='SEC');
const latest=rows.map(r=>r[6]).sort().at(-1)||'';
const logAll=[['Ticker','Provider','Last Attempt','Last Success','Next Check','Status','Records Updated','Error','Source Version'],...oldLog,['AAPL','SEC',data.generatedAt,data.generatedAt,'', 'OK',rows.length,'',latest]];
// Replaces only AAPL SEC_Raw records; never overwrites existing Fundamentals fields.
await api('/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:[{range:'SEC_Raw!A1:N'+all.length,values:all},{range:'Sync_Log!A1:I'+logAll.length,values:logAll}]})});
if(old.length>all.length) await api('/values/'+encodeURIComponent('SEC_Raw!A'+(all.length+1)+':N'+old.length)+':clear',{method:'POST',body:'{}'});
if((log.values||[]).length>logAll.length) await api('/values/'+encodeURIComponent('Sync_Log!A'+(logAll.length+1)+':I'+(log.values||[]).length)+':clear',{method:'POST',body:'{}'});
console.log('Imported '+rows.length+' SEC AAPL facts into SEC_Raw and Sync_Log. Fundamentals unchanged pending mapping.');
