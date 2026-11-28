/**
 * OptionsCrafted / Forward Dividends (pilot).
 *
 * Add this as a separate .gs file to the EXISTING Apps Script project attached
 * to "Tabella Stagionalità". No trigger is installed automatically.
 *
 * FMP /stable/dividends returns individual dividend amount and frequency.
 * DO NOT substitute profile.lastDividend: it is not guaranteed to represent
 * the current regular dividend annualized.
 *
 * Requires Script Properties: FMP_API_KEY
 * Existing Assets columns B (ticker), C (GOOGLEFINANCE price).
 * Existing DividendCache A:G and Assets V:W formulas supply the computed yield.
 *
 * Pilot: refreshOCForwardDividendsPilot()              (2 FMP requests)
 * Gradual collection: refreshOCForwardDividendsBatch() (up to 15 / day)
 * After installing this update run auditOCForwardDividendCache() once.\n * Once the pilot is accepted, optionally run installOCForwardDividendTrigger().
 *
 * Does not alter ProviderCache, Assets!O or existing export scripts.
 */
const OC_FORWARD_DIVIDENDS = Object.freeze({
  sheet: 'DividendCache',
  assetSheet: 'Assets',
  endpoint: 'https://financialmodelingprep.com/stable/dividends',
  dailyCap: 15,
  stateKey: 'OC_FORWARD_DIVIDENDS_STATE_V1',
  cursorKey: 'OC_FORWARD_DIVIDENDS_CURSOR_V1',
  timezone: 'Europe/Rome'
});

function ocDivDate_() {
  return Utilities.formatDate(new Date(), OC_FORWARD_DIVIDENDS.timezone, 'yyyy-MM-dd');
}

function ocDivFrequency_(value) {
  const f = String(value || '').trim().toLowerCase().replace(/[-_\s]/g, '');
  if (f === 'quarterly' || f === 'quarter') return {name:'Quarterly', multiplier:4};
  if (f === 'semiannual' || f === 'semiannually' || f === 'biannual') return {name:'Semiannual', multiplier:2};
  if (f === 'annual' || f === 'annually' || f === 'yearly') return {name:'Annual', multiplier:1};
  if (f === 'monthly' || f === 'month') return {name:'Monthly', multiplier:12};
  return null;
}

// Allow a little payment slippage, but NEVER promote a historical distribution
// to a forward dividend. Frequency controls the maximum permitted age.
function ocDivMaxAgeDays_(frequency) {
  return {Monthly:75,Quarterly:200,Semiannual:300,Annual:500}[frequency] || 0;
}

function ocDivAgeDays_(dateText, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const d=Date.parse(dateText+'T00:00:00Z');
  const now=Date.parse(today+'T00:00:00Z');
  if (!Number.isFinite(d)||!Number.isFinite(now)) return null;
  const age=(now-d)/86400000;
  return Number.isInteger(age)&&age>=0?age:null;
}

function ocDivFindLatest_(records, today) {
  if (!Array.isArray(records)) return null;
  const eligible=records.map(event=>{
    if (!event || typeof event!=='object') return null;
    const freq=ocDivFrequency_(event.frequency);
    const amount=Number(event.dividend);
    if (!freq||!Number.isFinite(amount)||amount<=0) return null;
    const type=String(event.type||event.dividendType||'').toLowerCase();
    if (/special|extraordinary|irregular|one.time/.test(type)) return null;
    const declared=String(event.declarationDate||'');
    const exDate=String(event.date||'');
    const eventDate=declared||exDate;
    const age=ocDivAgeDays_(eventDate,today);
    // Ignore future declarations, unparseable dates and stale historical dividends.
    if(age===null||age>ocDivMaxAgeDays_(freq.name)) return null;
    return {amount,frequency:freq.name,date:eventDate,exDate};
  }).filter(Boolean);
  eligible.sort((a,b)=>(b.date.localeCompare(a.date)||b.exDate.localeCompare(a.exDate)));
  return eligible[0]||null;
}

function ocDivSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cache = ss.getSheetByName(OC_FORWARD_DIVIDENDS.sheet);
  const assets = ss.getSheetByName(OC_FORWARD_DIVIDENDS.assetSheet);
  if (!cache || !assets) throw Error('Missing DividendCache or Assets sheet');
  return {cache,assets};
}

function ocDivCacheRow_(cache,ticker) {
  const last=Math.max(1,cache.getLastRow());
  const tickers=last>1?cache.getRange(2,1,last-1,1).getDisplayValues().flat():[];
  const ix=tickers.indexOf(ticker);
  const row=ix>=0?ix+2:last+1;
  if(row>cache.getMaxRows()) throw Error('DividendCache is out of rows');
  return row;
}

function ocDivInvalidate_(cache,ticker,today,reason) {
  const row=ocDivCacheRow_(cache,ticker);
  // Blank numeric inputs and annualization so Assets!V:W cannot use stale values.
  cache.getRange(row,1,1,7).setValues([[
    ticker,'','','','FMP stable/dividends',today,reason
  ]]);
  return row;
}

function ocDivUpsert_(cache,ticker,selected,today) {
  const row=ocDivCacheRow_(cache,ticker);
  const annualFormula='=IF(OR(B'+row+'="";C'+row+'="");"";IFERROR(B'+row+
      '*SWITCH(C'+row+';"Quarterly";4;"Semiannual";2;"Annual";1;"Monthly";12);""))';
  cache.getRange(row,1,1,7).setValues([[
    ticker,selected.amount,selected.frequency,annualFormula,
    'FMP stable/dividends; declaration '+selected.date,today,'FMP_AUTO'
  ]]);
  return row;
}

// Run once after installation (and periodically if desired). Keeps ticker rows,
// removes only dividends that have become too old to qualify as forward.
function auditOCForwardDividendCache() {
  const {cache}=ocDivSheet_(),today=ocDivDate_(),last=cache.getLastRow();
  if(last<2)return {checked:0,invalidated:0};
  const records=cache.getRange(2,1,last-1,7).getValues();
  let invalidated=0;
  records.forEach((values,i)=>{
    const ticker=String(values[0]||'').trim().toUpperCase();
    const amount=Number(values[1]);
    const freq=ocDivFrequency_(values[2]);
    const dateMatch=String(values[4]||'').match(/declaration\s+(\d{4}-\d{2}-\d{2})/i);
    if(!ticker||!(amount>0))return;
    const age=dateMatch?ocDivAgeDays_(dateMatch[1],today):null;
    if(!freq||age===null||age>ocDivMaxAgeDays_(freq.name)){
      ocDivInvalidate_(cache,ticker,today,'STALE_OR_UNVERIFIED');
      invalidated++;
    }
  });
  Logger.log('DividendCache audit: '+JSON.stringify({checked:records.length,invalidated}));
  return {checked:records.length,invalidated};
}

function ocDivPull_(ticker,key,today) {
  const url=OC_FORWARD_DIVIDENDS.endpoint+'?symbol='+encodeURIComponent(ticker)+
      '&apikey='+encodeURIComponent(key);
  const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
  const http=response.getResponseCode();
  if (http!==200) throw Error('FMP_HTTP_'+http);
  let payload;
  try {payload=JSON.parse(response.getContentText());}
  catch (_) {throw Error('FMP_BAD_JSON');}
  if (!Array.isArray(payload)) throw Error('FMP_NO_ARRAY_OR_PREMIUM');
  return ocDivFindLatest_(payload,today);
}

function ocDivRun_(tickers) {
  const props=PropertiesService.getScriptProperties();
  const key=props.getProperty('FMP_API_KEY');
  if (!key) throw Error('FMP_API_KEY missing in Script Properties');
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const today=ocDivDate_();
    const stored=JSON.parse(props.getProperty(OC_FORWARD_DIVIDENDS.stateKey)||'{}');
    const state=stored.date===today?stored:{date:today,count:0};
    const {cache}=ocDivSheet_();
    const output=[];
    for (const ticker of tickers) {
      if(state.count>=OC_FORWARD_DIVIDENDS.dailyCap) {
        output.push({ticker,status:'DAILY_BUDGET_EXHAUSTED'});
        break;
      }
      // Count before the request, including unsuccessful requests.
      state.count+=1;
      props.setProperty(OC_FORWARD_DIVIDENDS.stateKey,JSON.stringify(state));
      try{
        const candidate=ocDivPull_(ticker,key,today);
        if (!candidate) {
          const row=ocDivInvalidate_(cache,ticker,today,'NO_CURRENT_REGULAR_DIVIDEND');
          output.push({ticker,status:'NO_CURRENT_REGULAR_DIVIDEND',row});
          continue;
        }
        const row=ocDivUpsert_(cache,ticker,candidate,today);
        output.push({ticker,status:'OK',row,annualized:candidate.amount*
            ocDivFrequency_(candidate.frequency).multiplier});
      }catch(err){
        output.push({ticker,status:String(err.message || err).slice(0,100)});
        // Keep previously verified entries intact on API errors.
        if (/FMP_HTTP_40[1239]|FMP_NO_ARRAY_OR_PREMIUM/.test(String(err.message||err))) break;
      }
    }
    Logger.log(JSON.stringify(output));
    return output;
  }finally{lock.releaseLock();}
}

function refreshOCForwardDividendsPilot() {
  return ocDivRun_(['NVDA','PEP']);
}

function refreshOCForwardDividendsBatch() {
  const props=PropertiesService.getScriptProperties();
  const {assets}=ocDivSheet_();
  const tickers=assets.getRange(2,2,Math.max(1,assets.getLastRow()-1),1)
    .getDisplayValues().flat().map(x=>String(x).trim().toUpperCase())
    .filter((x,i,a)=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(x)&&a.indexOf(x)===i);
  if (!tickers.length) return [];
  const cursor=Number(props.getProperty(OC_FORWARD_DIVIDENDS.cursorKey)||0);
  const window=[];
  for (let i=0;i<OC_FORWARD_DIVIDENDS.dailyCap;i++) {
    window.push(tickers[(cursor+i)%tickers.length]);
  }
  const result=ocDivRun_(window);
  const attempted=result.filter(x=>x.status!=='DAILY_BUDGET_EXHAUSTED').length;
  props.setProperty(OC_FORWARD_DIVIDENDS.cursorKey,String((cursor+attempted)%tickers.length));
  return result;
}

function installOCForwardDividendTrigger() {
  const handler='refreshOCForwardDividendsBatch';
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler)
      .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(14)
      .inTimezone(OC_FORWARD_DIVIDENDS.timezone).create();
}
