// Industrial data quality checks.
export function validateFiscalRow(ticker,year,metrics){
 const issues=[];
 for(const [metric,f] of Object.entries(metrics)){
  if(!['AVAILABLE','DERIVED'].includes(f.status))continue;
  if(!Number.isFinite(f.value))issues.push({metric,code:'NON_FINITE'});
  if(!f.periodEnd||f.periodEnd.slice(0,4)!==String(year))issues.push({metric,code:'PERIOD_MISMATCH'});
  if(f.status==='AVAILABLE'&&(!f.tag||!f.accession))issues.push({metric,code:'MISSING_PROVENANCE'});
  if(f.status==='DERIVED'&&(!f.method||!f.inputs?.length))issues.push({metric,code:'MISSING_DERIVATION'});
 }
 return {ticker,year,status:issues.length?'REVIEW_REQUIRED':'PASS',issues};
}
