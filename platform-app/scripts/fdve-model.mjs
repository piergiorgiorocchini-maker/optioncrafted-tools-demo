// FDVE canonical contract v1. Pure functions, no network, no implicit unit conversion.
// A fact is an observation, never a TTM estimate or a price-derived ratio.
export const METRICS=Object.freeze({
 revenue:{kind:'flow',unit:'USD',sign:'nonnegative'},
 netIncome:{kind:'flow',unit:'USD',sign:'signed'},
 operatingIncome:{kind:'flow',unit:'USD',sign:'signed'},
 depreciationAmortization:{kind:'flow',unit:'USD',sign:'nonnegative'},
 interestExpense:{kind:'flow',unit:'USD',sign:'nonnegative'},
 cashFromOperations:{kind:'flow',unit:'USD',sign:'signed'},
 capex:{kind:'flow',unit:'USD',sign:'nonnegative'},
 epsDiluted:{kind:'flow',unit:'USD/shares',sign:'signed'},
 cash:{kind:'instant',unit:'USD',sign:'nonnegative'},
 currentAssets:{kind:'instant',unit:'USD',sign:'nonnegative'},
 currentLiabilities:{kind:'instant',unit:'USD',sign:'nonnegative'},
 inventory:{kind:'instant',unit:'USD',sign:'nonnegative'},
 totalAssets:{kind:'instant',unit:'USD',sign:'nonnegative'},
 totalLiabilities:{kind:'instant',unit:'USD',sign:'nonnegative'},
 equity:{kind:'instant',unit:'USD',sign:'signed'},
 longTermDebt:{kind:'instant',unit:'USD',sign:'nonnegative'},
 shortTermDebt:{kind:'instant',unit:'USD',sign:'nonnegative'}
});
const DAY=86400000;
const dateOK=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x+'T00:00:00.000Z';
const days=(a,b)=>(Date.parse(b)-Date.parse(a))/DAY;
const err=(code,detail)=>({code,detail});
export function normalizeSecFact({ticker,cik,metric,observation,sourceUrl,tag,unit}){
 const def=METRICS[metric];
 if(!def) throw new Error('UNKNOWN_METRIC:'+metric);
 // Never guess scaling, percentage vs fraction, or whether a flow is TTM.
 return {schemaVersion:1,entity:{ticker,cik},metric,value:observation.val,unit,
  period:{kind:def.kind,start:observation.start??null,end:observation.end},
  filing:{form:observation.form,accession:observation.accn,filed:observation.filed},
  provenance:{provider:'SEC',sourceUrl,tag},
  identity:[cik,metric,observation.start??'',observation.end,unit,observation.accn].join('|')};
}
export function validateFact(f,{asOf=new Date().toISOString().slice(0,10)}={}){
 const issues=[];const def=METRICS[f?.metric];
 if(!def) return {status:'REJECTED',issues:[err('UNKNOWN_METRIC',String(f?.metric))]};
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(f.entity?.ticker||'')||!/^[0-9]{10}$/.test(f.entity?.cik||'')) issues.push(err('IDENTITY','Invalid ticker or CIK'));
 if(!Number.isFinite(f.value)) issues.push(err('VALUE','Nonfinite'));
 if(f.unit!==def.unit) issues.push(err('UNIT','Expected '+def.unit));
 if(def.sign==='nonnegative'&&f.value<0) issues.push(err('SIGN','Negative value'));
 const p=f.period||{}, filing=f.filing||{};
 if(p.kind!==def.kind||!dateOK(p.end)) issues.push(err('PERIOD','Invalid period kind/end'));
 if(def.kind==='instant'&&p.start!==null) issues.push(err('PERIOD','Instant must have null start'));
 if(def.kind==='flow'&&(!dateOK(p.start)||days(p.start,p.end)<0||days(p.start,p.end)>380)) issues.push(err('PERIOD','Invalid flow duration'));
 if(!dateOK(filing.filed)||!['10-K','10-Q'].includes(filing.form)||!/^[0-9]{10}-[0-9]{2}-[0-9]{6}$/.test(filing.accession||'')) issues.push(err('FILING','Invalid SEC filing'));
 if(dateOK(filing.filed)&&dateOK(p.end)&&filing.filed<p.end) issues.push(err('FILING','Filed before period end'));
 if(dateOK(filing.filed)&&dateOK(asOf)&&filing.filed>asOf) issues.push(err('FUTURE','Filing date in future'));
 if(f.provenance?.provider!=='SEC'||!/^https:\/\/data\.sec\.gov\/api\/xbrl\/companyfacts\/CIK[0-9]{10}\.json$/.test(f.provenance?.sourceUrl||'')||!f.provenance?.tag) issues.push(err('PROVENANCE','Untrusted/missing provenance'));
 if(f.provenance?.sourceUrl&&!f.provenance.sourceUrl.includes('CIK'+f.entity?.cik+'.json')) issues.push(err('PROVENANCE','CIK/source mismatch'));
 return {status:issues.length?'REJECTED':'VALID',issues};
}
// Multiple filings for the same economic period are kept as distinct observations.
// Prefer latest filed revision, but never combine different fiscal periods.
export function selectPeriod(facts,{metric,start=null,end,asOf=new Date().toISOString().slice(0,10)}){
 const candidates=facts.filter(f=>f.metric===metric&&f.period?.start===start&&f.period?.end===end&&validateFact(f,{asOf}).status==='VALID');
 return candidates.sort((a,b)=>b.filing.filed.localeCompare(a.filing.filed)||b.filing.accession.localeCompare(a.filing.accession))[0]??null;
}
export function deriveAnnualOrTTM({annual,currentYtd,priorYtd}){
 // TTM = last FY + current YTD - comparable prior-year YTD.
 // EPS is excluded because weighted-average diluted shares differ by period.
 if(!annual||!currentYtd||!priorYtd) return {status:'UNAVAILABLE',reason:'MISSING_PERIOD'};
 if(annual.metric==='epsDiluted'||annual.metric!==currentYtd.metric||annual.metric!==priorYtd.metric) return {status:'UNAVAILABLE',reason:'INCOMPATIBLE_METRIC'};
 const fs=[annual,currentYtd,priorYtd];
 if(fs.some(f=>validateFact(f).status!=='VALID'||f.period.kind!=='flow'||f.unit!==annual.unit)) return {status:'UNAVAILABLE',reason:'INVALID_INPUT'};
 if(days(currentYtd.period.start,currentYtd.period.end)!==days(priorYtd.period.start,priorYtd.period.end)&&Math.abs(days(currentYtd.period.start,currentYtd.period.end)-days(priorYtd.period.start,priorYtd.period.end))>8) return {status:'UNAVAILABLE',reason:'NONCOMPARABLE_YTD'};
 if(!(priorYtd.period.end<annual.period.end&&annual.period.end<currentYtd.period.end)) return {status:'UNAVAILABLE',reason:'PERIOD_ORDER'};
 if(days(annual.period.end,currentYtd.period.end)>380||days(priorYtd.period.end,currentYtd.period.end)<350||days(priorYtd.period.end,currentYtd.period.end)>380) return {status:'UNAVAILABLE',reason:'PERIOD_ALIGNMENT'};
 return {status:'DERIVED',value:annual.value+currentYtd.value-priorYtd.value,unit:annual.unit,periodEnd:currentYtd.period.end,method:'FY_PLUS_YTD_MINUS_PRIOR_YTD',inputs:fs.map(f=>f.identity)};
}
export function validateBalance(metrics){
 const issues=[];const same=(...keys)=>keys.every(k=>metrics[k]?.period?.end===metrics[keys[0]]?.period?.end);
 const value=k=>metrics[k]?.value;
 if(same('totalAssets','totalLiabilities','equity')&&['totalAssets','totalLiabilities','equity'].every(k=>metrics[k])){
  const delta=Math.abs(value('totalAssets')-value('totalLiabilities')-value('equity'));
  if(delta>Math.max(1,Math.abs(value('totalAssets'))*.005)) issues.push(err('BALANCE','Assets != liabilities + equity'));
 }
 for(const [part,whole] of [['currentAssets','totalAssets'],['currentLiabilities','totalLiabilities'],['inventory','currentAssets']]){
  if(metrics[part]&&metrics[whole]&&same(part,whole)&&value(part)>value(whole)) issues.push(err('SUBTOTAL',part+' exceeds '+whole));
 }
 return {status:issues.length?'REJECTED':'VALID',issues};
}
