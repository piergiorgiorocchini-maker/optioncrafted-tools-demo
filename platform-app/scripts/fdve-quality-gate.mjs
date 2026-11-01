// Industrial data quality checks.
export function validateFiscalRow(ticker,year,metrics){
 const issues=[];
 for(const [metric,f] of Object.entries(metrics)){
  if(!['AVAILABLE','DERIVED'].includes(f.status))continue;
  if(!Number.isFinite(f.value))issues.push({metric,code:'NON_FINITE'});
  if(!f.periodEnd||f.periodEnd.slice(0,4)!==String(year))issues.push({metric,code:'PERIOD_MISMATCH'});
  if(f.status==='AVAILABLE'&&(!f.tag||!f.accession))issues.push({metric,code:'MISSING_PROVENANCE'});
  if(f.status==='DERIVED'&&(!f.method||!f.inputs?.length))issues.push({metric,code:'MISSING_DERIVATION'});
  if(['totalAssets','totalLiabilities','currentAssets','currentLiabilities','inventory','cash','longTermDebt','shortTermDebt','capex','depreciationAmortization'].includes(metric)&&f.value<0)issues.push({metric,code:'NEGATIVE_BALANCE_OR_EXPENSE'});
 }
 // One fiscal row must refer to one consolidated reporting end date.
 const dated=Object.entries(metrics).filter(([,f])=>['AVAILABLE','DERIVED'].includes(f.status)&&f.periodEnd);
 const dates=new Set(dated.map(([,f])=>f.periodEnd));
 if(dates.size>1)for(const [metric,f] of dated)issues.push({metric,code:'FISCAL_END_INCONSISTENT',periodEnd:f.periodEnd});
 const flowKeys=new Set(['revenue','netIncome','operatingIncome','depreciationAmortization','interestExpense','cashFromOperations','capex','epsDiluted']);
 for(const [metric,f] of dated){
  if(!flowKeys.has(metric)||!f.periodStart)continue;
  const duration=(Date.parse(f.periodEnd)-Date.parse(f.periodStart))/86400000;
  if(!Number.isFinite(duration)||duration<330||duration>380)issues.push({metric,code:'INVALID_ANNUAL_DURATION'});
 }
 const value=k=>['AVAILABLE','DERIVED'].includes(metrics[k]?.status)?metrics[k].value:null;
 const a=value('totalAssets'),l=value('totalLiabilities'),e=value('equity');
 const ca=value('currentAssets'),cl=value('currentLiabilities'),inv=value('inventory'),cash=value('cash');
 if(a!==null&&ca!==null&&ca>a*1.001)issues.push({metric:'currentAssets',code:'CURRENT_EXCEEDS_TOTAL'});
 if(l!==null&&cl!==null&&cl>l*1.001)issues.push({metric:'currentLiabilities',code:'CURRENT_EXCEEDS_TOTAL'});
 if(ca!==null&&inv!==null&&inv>ca*1.001)issues.push({metric:'inventory',code:'INVENTORY_EXCEEDS_CURRENT_ASSETS'});
 if(ca!==null&&cash!==null&&cash>ca*1.001)issues.push({metric:'cash',code:'CASH_EXCEEDS_CURRENT_ASSETS'});
 // Equity excludes noncontrolling interests for some issuers. Only flag negative residual.
 if(a!==null&&l!==null&&e!==null&&a-l-e < -Math.max(1000000,Math.abs(a)*0.001))
  issues.push({metric:'totalLiabilities',code:'BALANCE_SHEET_INCONSISTENT'});
 return {ticker,year,status:issues.length?'REVIEW_REQUIRED':'PASS',issues};
}

export function qualityGate(report){
 const rows=[];
 for(const company of report.companies||[]){
  if(company.profile==='bank')continue;
  for(const [year,period] of Object.entries(company.years||{}))
   rows.push(validateFiscalRow(company.ticker,year,period.metrics||{}));
 }
 return {status:rows.some(r=>r.status!=='PASS')?'REVIEW_REQUIRED':'PASS',checked:rows.length,failed:rows.filter(r=>r.status!=='PASS').length,rows};
}
