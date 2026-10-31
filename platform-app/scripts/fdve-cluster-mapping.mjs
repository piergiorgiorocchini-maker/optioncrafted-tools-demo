// FDVE cluster source semantics. Strict aliases only; never equate EBIT with operating income.
export const SEC_ALIASES={
 revenue:['RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerIncludingAssessedTax','Revenues','SalesRevenueNet'],
 netIncome:['NetIncomeLoss'],operatingIncome:['OperatingIncomeLoss'],
 cashFromOperations:['NetCashProvidedByUsedInOperatingActivities'],
 capex:['PaymentsToAcquirePropertyPlantAndEquipment'],epsDiluted:['EarningsPerShareDiluted'],
 cash:['CashAndCashEquivalentsAtCarryingValue'],currentAssets:['AssetsCurrent'],
 currentLiabilities:['LiabilitiesCurrent'],inventory:['InventoryNet'],
 totalAssets:['Assets'],totalLiabilities:['Liabilities'],equity:['StockholdersEquity'],
 longTermDebt:['LongTermDebtNoncurrent'],shortTermDebt:['LongTermDebtCurrent'],
 depreciationAmortization:['DepreciationDepletionAndAmortization','DepreciationDepletionAndAmortizationPropertyPlantAndEquipment','DepreciationAndAmortization'],
 interestExpense:['InterestExpenseNonOperating','InterestExpense']
};
export const FMP_FIELDS={
 revenue:['income','revenue',1],netIncome:['income','netIncome',1],
 operatingIncome:['income','operatingIncome',1],epsDiluted:['income','epsDiluted',1],
 cashFromOperations:['cashflow','operatingCashFlow',1],
 capex:['cashflow','capitalExpenditure',-1],
 cash:['balance','cashAndCashEquivalents',1],
 currentAssets:['balance','totalCurrentAssets',1],
 currentLiabilities:['balance','totalCurrentLiabilities',1],
 inventory:['balance','inventory',1],totalAssets:['balance','totalAssets',1],
 totalLiabilities:['balance','totalLiabilities',1],
 equity:['balance','totalStockholdersEquity',1],
 longTermDebt:['balance','longTermDebt',1],shortTermDebt:['balance','shortTermDebt',1]
};
export const BANK_SEC_CANDIDATES={
 netInterestIncome:['InterestIncomeExpenseNet'],
 provisionCreditLosses:['ProvisionForLoanLeaseAndOtherLosses','ProvisionForLoanAndLeaseLosses'],
 deposits:['Deposits'],loansNet:['LoansAndLeasesReceivableNetReportedAmount'],
 cet1Ratio:['CommonEquityTierOneCapitalRatio']
};
export function validSecObservation(x,kind,year,asOf){
 if(!x||!Number.isFinite(x.val)||!x.end||!x.filed||x.filed>asOf||x.form!=='10-K'||x.fp!=='FY'||x.fy!==year)return false;
 if(kind==='instant')return !x.start&&x.end.slice(0,4)===String(year);
 if(!x.start||x.end.slice(0,4)!==String(year))return false;
 const days=(Date.parse(x.end)-Date.parse(x.start))/86400000;
 return days>=330&&days<=380;
}
export function selectFiscalSec(concepts,metric,kind,year,asOf){
 const unit=metric==='epsDiluted'?'USD/shares':'USD';
 const aliases=SEC_ALIASES[metric]||[];
 const candidates=aliases.flatMap((tag,priority)=>(concepts[tag]?.units?.[unit]||[])
  .filter(x=>validSecObservation(x,kind,year,asOf))
  .map(x=>({...x,tag,priority})));
 candidates.sort((a,b)=>a.priority-b.priority||b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn));
 if(!candidates.length)return {status:'PERIOD_MISSING',metric,year};
 const chosen=candidates[0];
 const samePriority=candidates.filter(x=>x.priority===chosen.priority&&x.end===chosen.end&&x.filed===chosen.filed);
 if(new Set(samePriority.map(x=>x.val)).size>1)return {status:'AMBIGUOUS',metric,year};
 return {status:'AVAILABLE',metric,year,value:chosen.val,unit,periodStart:chosen.start||null,periodEnd:chosen.end,tag:chosen.tag,accession:chosen.accn,filed:chosen.filed};
}
export function deriveTotalLiabilities(concepts,year,asOf){
 // Only full consolidated equity including noncontrolling interest is compatible with Assets - Liabilities.
 const assets=selectFiscalSec(concepts,'totalAssets','instant',year,asOf);
 const equities=(concepts.StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest?.units?.USD||[])
  .filter(x=>validSecObservation(x,'instant',year,asOf)).sort((a,b)=>b.filed.localeCompare(a.filed));
 if(assets.status!=='AVAILABLE'||!equities.length)return {status:'DERIVATION_UNAVAILABLE',year};
 const e=equities.find(x=>x.end===assets.periodEnd);
 if(!e)return {status:'DERIVATION_UNAVAILABLE',year,reason:'PERIOD_MISMATCH'};
 const value=assets.value-e.val;
 if(value<0)return {status:'DERIVATION_UNAVAILABLE',year,reason:'NEGATIVE_LIABILITIES'};
 return {status:'DERIVED',metric:'totalLiabilities',year,value,unit:'USD',periodEnd:assets.periodEnd,method:'ASSETS_MINUS_TOTAL_EQUITY_INCL_NCI',inputs:[assets.tag,'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']};
}
export function reconcileValue(sec,fmp,metric){
 if(!sec||sec.status!=='AVAILABLE'&&sec.status!=='DERIVED')return {status:'SEC_UNAVAILABLE'};
 if(!fmp||!Number.isFinite(fmp.value))return {status:'FMP_UNAVAILABLE'};
 if(fmp.periodEnd!==sec.periodEnd)return {status:'PERIOD_MISMATCH',secEnd:sec.periodEnd,fmpEnd:fmp.periodEnd};
 if(fmp.currency!=='USD')return {status:'CURRENCY_MISMATCH',currency:fmp.currency};
 const diff=fmp.value-sec.value,scale=Math.max(Math.abs(sec.value),1);
 const absolute=metric==='epsDiluted'?0.005:Math.max(1,scale*0.00001);
 const relative=metric==='epsDiluted'?0.02:0.001;
 return {status:Math.abs(diff)<=absolute?'MATCH':Math.abs(diff)/scale<=relative?'ROUNDING':'DIFFERENCE',sec:sec.value,fmp:fmp.value,delta:diff,deltaPct:100*diff/scale};
}

export const BANK_METRIC_TYPES={
 netInterestIncome:'flow',provisionCreditLosses:'flow',
 deposits:'instant',loansNet:'instant',cet1Ratio:'instant'
};
export function selectBankFiscalSec(concepts,metric,year,asOf){
 const kind=BANK_METRIC_TYPES[metric],tags=BANK_SEC_CANDIDATES[metric];
 if(!kind||!tags)return {status:'UNKNOWN_BANK_METRIC'};
 const unit=metric==='cet1Ratio'?'pure':'USD';
 const candidates=tags.flatMap((tag,priority)=>(concepts[tag]?.units?.[unit]||[])
  .filter(x=>validSecObservation(x,kind,year,asOf))
  .map(x=>({...x,tag,priority})));
 candidates.sort((a,b)=>a.priority-b.priority||b.filed.localeCompare(a.filed));
 if(!candidates.length)return {status:'PERIOD_MISSING',metric,year,tagsChecked:tags};
 const chosen=candidates[0];
 return {status:'AVAILABLE',metric,year,value:chosen.val,unit,periodStart:chosen.start||null,periodEnd:chosen.end,tag:chosen.tag,accession:chosen.accn,filed:chosen.filed};
}
export function findRelatedTags(concepts,metric){
 const patterns={
  operatingIncome:/operatingincome|incomelossfromcontinuingoperationsbeforeincometaxes|incomeoperations/i,
  inventory:/inventor|inventories/i,
  longTermDebt:/longtermdebt|longtermborrow|debtnoncurrent|longtermnotes/i,
  totalLiabilities:/liabilit/i
 };
 const pattern=patterns[metric];
 return pattern?Object.keys(concepts).filter(tag=>pattern.test(tag)).slice(0,40):[];
}
