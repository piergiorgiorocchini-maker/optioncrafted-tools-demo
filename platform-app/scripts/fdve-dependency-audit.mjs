// Financial ratio dependency graph. A missing source never becomes zero.
// Keep this graph aligned with src/core/fundamentalMetrics.ts.
export const INDEX_DEPS=Object.freeze({
 currentRatio:['currentAssets','currentLiabilities'],
 quickRatio:['currentAssets','inventory','currentLiabilities'],
 cashRatio:['cash','currentLiabilities'],
 netDebt:['totalDebt','cash'],
 debtEquity:['totalDebt','equity'],
 netDebtEbitda:['totalDebt','cash','ebitda'],
 interestCoverage:['ebit','interestExpense'],
 fcfDebt:['freeCashFlow','totalDebt'],
 enterpriseValue:['marketCap','totalDebt','cash'],
 evEbitda:['marketCap','totalDebt','cash','ebitda']
});
export const INPUT_DEPS=Object.freeze({
 currentAssets:['currentAssets'],currentLiabilities:['currentLiabilities'],
 inventory:['inventory'],cash:['cash'],equity:['equity'],
 interestExpense:['interestExpense'],
 totalDebt:['longTermDebt','shortTermDebt'],
 freeCashFlow:['cashFromOperations','capex'],
 ebitda:['operatingIncome','depreciationAmortization'],
 ebit:['operatingIncome'],
 marketCap:null
});
export function auditIndexDependencies(metrics){
 const indexes={};
 for(const [name,inputs] of Object.entries(INDEX_DEPS)){
  const missing=[],derived=[],available=[];
  for(const input of inputs){
   const dependencies=INPUT_DEPS[input];
   if(!dependencies){missing.push({input,reason:'EXTERNAL_MARKET_DATA'});continue;}
   for(const metric of dependencies){
    const fact=metrics[metric];
    if(fact?.status==='AVAILABLE')available.push(metric);
    else if(fact?.status==='DERIVED')derived.push(metric);
    else missing.push({input,metric,reason:fact?.status||'MISSING'});
   }
  }
  const denominators={currentRatio:'currentLiabilities',quickRatio:'currentLiabilities',
   cashRatio:'currentLiabilities',debtEquity:'equity',netDebtEbitda:'ebitda',
   interestCoverage:'interestExpense',fcfDebt:'totalDebt',evEbitda:'ebitda'};
  const d=denominators[name];
  if(d&&INPUT_DEPS[d]){
   const vals=INPUT_DEPS[d].map(k=>metrics[k]);
   if(vals.every(v=>['AVAILABLE','DERIVED'].includes(v?.status))){
    const sum=vals.reduce((acc,v)=>acc+v.value,0);
    if(!Number.isFinite(sum)||sum<=0)missing.push({input:d,reason:'INVALID_DENOMINATOR'});
   }
  }
  indexes[name]={status:missing.length?'BLOCKED':derived.length?'READY_DERIVED':'READY_DIRECT',
   required:inputs,available:[...new Set(available)],derived:[...new Set(derived)],missing};
 }
 return indexes;
}
export function auditDependencyReport(report){
 const rows=[];
 for(const company of report.companies||[]){
  if(company.profile==='bank')continue;
  for(const [year,period] of Object.entries(company.years||{})){
   const indexes=auditIndexDependencies(period.metrics||{});
   rows.push({ticker:company.ticker,year,indexes});
  }
 }
 const summary={rows:rows.length,possible:0,readyDirect:0,readyDerived:0,blocked:0,blockers:{}};
 for(const row of rows)for(const index of Object.values(row.indexes)){
  summary.possible++;
  if(index.status==='BLOCKED'){
   summary.blocked++;
   for(const m of index.missing){const key=m.metric||m.input;summary.blockers[key]=(summary.blockers[key]||0)+1;}
  }else if(index.status==='READY_DERIVED')summary.readyDerived++;
  else summary.readyDirect++;
 }
 summary.readinessPct=summary.possible?Number((100*(summary.readyDirect+summary.readyDerived)/summary.possible).toFixed(2)):null;
 return {schemaVersion:1,scope:'SEC_ANNUAL_ONLY',note:'Readiness indicates dependency presence, not validated valuation or computed ratios. Market cap requires dated market data.',summary,rows};
}
