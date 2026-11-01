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
export function validateMarketSnapshot(snapshot,periodEnd,{maxAgeDays=7}={}){
 if(!snapshot)return {status:'MISSING',reason:'EXTERNAL_MARKET_DATA'};
 const {marketCap,currency,asOf,source}=snapshot;
 if(!Number.isFinite(marketCap)||marketCap<=0||currency!=='USD'||!source||!/^\d{4}-\d{2}-\d{2}$/.test(asOf||''))return {status:'REJECTED',reason:'INVALID_MARKET_SNAPSHOT'};
 const delta=(Date.parse(asOf)-Date.parse(periodEnd))/86400000;
 if(!Number.isFinite(delta)||delta<0||delta>maxAgeDays)return {status:'REJECTED',reason:'MARKET_DATE_MISMATCH'};
 return {status:'VALID',value:marketCap,source,asOf};
}
export function auditIndexDependencies(metrics,{marketSnapshot=null,periodEnd=null}={}){
 const indexes={};
 for(const [name,inputs] of Object.entries(INDEX_DEPS)){
  const missing=[],derived=[],available=[];
  for(const input of inputs){
   const dependencies=INPUT_DEPS[input];
   if(!dependencies){
    const market=validateMarketSnapshot(marketSnapshot,periodEnd);
    if(market.status==='VALID')available.push(input);
    else missing.push({input,reason:market.reason});
    continue;
   }
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
   const periodEnd=Object.values(period.metrics||{}).find(x=>x?.status==='AVAILABLE'&&x?.periodEnd)?.periodEnd||null;
   const marketSnapshot=report.marketSnapshots?.[company.ticker]?.[year]||null;
   const indexes=auditIndexDependencies(period.metrics||{},{marketSnapshot,periodEnd});
   rows.push({ticker:company.ticker,year,indexes});
  }
 }
 const summary={rows:rows.length,possible:0,readyDirect:0,readyDerived:0,blocked:0,blockers:{},accountingOnly:{possible:0,ready:0,blocked:0,readinessPct:null},marketDependent:{possible:0,ready:0,blocked:0,readinessPct:null}};
 for(const row of rows)for(const [name,index] of Object.entries(row.indexes)){
  const group=['enterpriseValue','evEbitda'].includes(name)?summary.marketDependent:summary.accountingOnly;
  group.possible++;
  if(index.status==='BLOCKED')group.blocked++;else group.ready++;
  summary.possible++;
  if(index.status==='BLOCKED'){
   summary.blocked++;
   for(const key of new Set(index.missing.map(m=>m.metric||m.input)))summary.blockers[key]=(summary.blockers[key]||0)+1;
  }else if(index.status==='READY_DERIVED')summary.readyDerived++;
  else summary.readyDirect++;
 }
 summary.readinessPct=summary.possible?Number((100*(summary.readyDirect+summary.readyDerived)/summary.possible).toFixed(2)):null;
 for(const group of [summary.accountingOnly,summary.marketDependent])group.readinessPct=group.possible?Number((100*group.ready/group.possible).toFixed(2)):null;
 return {schemaVersion:1,scope:'SEC_ANNUAL_ONLY',note:'Readiness indicates dependency presence, not validated valuation or computed ratios. Market cap requires independently sourced USD market data dated within 7 days after the matching fiscal period end. Historical snapshots are not inferred from current Google/FMP prices. Accounting-only readiness is reported separately from market-dependent readiness.',summary,rows};
}
