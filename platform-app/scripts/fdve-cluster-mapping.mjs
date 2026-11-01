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
 interestExpense:['InterestExpenseNonOperating','InterestExpenseNonoperating','InterestExpense','InterestExpenseDebt']
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
// Diagnostic-only resolver. SEC companyfacts does not expose issuer-specific extension namespaces.
// Never silently substitute interest paid, net interest or financing costs for gross expense.
export function diagnoseInterestTags(concepts,year,asOf){
 const pattern=/interest|financecost|borrowingcost/i;
 const tags=Object.entries(concepts).filter(([tag])=>pattern.test(tag)).map(([tag,concept])=>{
  const annual=(concept.units?.USD||[]).filter(x=>validSecObservation(x,'flow',year,asOf));
  return {tag,label:concept.label||null,description:concept.description||null,
   annualObservations:annual.length,
   values:annual.slice().sort((a,b)=>b.filed.localeCompare(a.filed)).slice(0,2).map(x=>({value:x.val,start:x.start,end:x.end,filed:x.filed,accession:x.accn}))};
 });
 return {status:'DIAGNOSTIC_ONLY',year,availableTags:tags.filter(x=>x.annualObservations>0),
  otherTags:tags.filter(x=>!x.annualObservations).map(x=>x.tag),
  note:'Tag candidates are not approved substitutes for InterestExpense. Review gross/net and filing presentation before mapping.'};
}
// Diagnostic-only search for unmapped annual tags, with the exact FY period preserved.
export function diagnoseMissingMetric(concepts,metric,year,asOf){
 const patterns={
  depreciationAmortization:/depreciat|amortiz|deplet/i,
  operatingIncome:/operatingincome|incomeoperations|incomelossfromcontinuingoperationsbeforeincometaxes/i,
  longTermDebt:/longtermdebt|longtermborrow|debtnoncurrent|longtermnotes|seniornotes/i,
  inventory:/inventor|inventories/i,
  totalLiabilities:/liabilit/i
 };
 const pattern=patterns[metric];
 if(!pattern)return {status:'NO_DIAGNOSTIC_PATTERN',metric,year};
 const tags=Object.entries(concepts).filter(([tag])=>pattern.test(tag)).map(([tag,concept])=>{
  const annual=(concept.units?.USD||[]).filter(x=>validSecObservation(x,metric==='depreciationAmortization'||metric==='operatingIncome'?'flow':'instant',year,asOf));
  return {tag,label:concept.label||null,annualObservations:annual.length,
   observations:annual.slice().sort((a,b)=>b.filed.localeCompare(a.filed)).slice(0,2)
    .map(x=>({value:x.val,start:x.start||null,end:x.end,filed:x.filed,accession:x.accn}))};
 });
 return {status:'DIAGNOSTIC_ONLY',metric,year,availableTags:tags.filter(x=>x.annualObservations>0),
  historicalOrOtherTags:tags.filter(x=>!x.annualObservations).map(x=>x.tag),
  note:'Candidates are NOT approved mappings. Validate definition, consolidation, period and double counting before adding an alias.'};
}
// Issuer-scoped mappings validated against consolidated 10-K line items.
// Never broaden these composite concepts into global SEC aliases.
export function resolveValidatedIndustrialMetric(concepts,ticker,metric,kind,year,asOf){
 const pick=(tag)=>{const unit='USD';const matches=(concepts[tag]?.units?.[unit]||[])
  .filter(x=>validSecObservation(x,kind,year,asOf))
  .sort((a,b)=>b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn));
  if(!matches.length)return null;
  const x=matches[0];
  return {status:'AVAILABLE',metric,year,value:x.val,unit,periodStart:x.start||null,
   periodEnd:x.end,tag,accession:x.accn,filed:x.filed,
   mappingScope:'ISSUER_VERIFIED',validation:'CONSOLIDATED_10K_LINE_ITEM'};
 };
 if(ticker==='WMT'&&metric==='depreciationAmortization'&&kind==='flow'){
  // WMT FY2025 10-K, consolidated cash-flow statement and segment reconciliation
  // both label these amounts "Depreciation and amortization", notwithstanding
  // the broader us-gaap XBRL tag name "DepreciationAmortizationAndAccretionNet".
  const da=pick('DepreciationAmortizationAndAccretionNet');
  const expected={2024:{value:11853000000,start:'2023-02-01',end:'2024-01-31'},
                  2025:{value:12973000000,start:'2024-02-01',end:'2025-01-31'}};
  const e=expected[year];
  if(!da||!e||da.value!==e.value||da.periodStart!==e.start||da.periodEnd!==e.end)return null;
  return {...da,tag:'DepreciationAmortizationAndAccretionNet',
   mappingScope:'ISSUER_VERIFIED',validation:'CONSOLIDATED_CASH_FLOW_AND_SEGMENT_RECONCILIATION',
   sourceFiling:'https://stock.walmart.com/sec-filings/all-sec-filings/content/0000104169-25-000021/wmt-20250131.htm',
   caveat:'WMT 10-K line label is depreciation and amortization; issuer-scoped tag only. Revalidate future years.'};
 }
 if(ticker==='MSFT'&&metric==='depreciationAmortization'){
  const depreciation=pick('Depreciation');
  const amortization=pick('AmortizationOfIntangibleAssets');
  const expected={2024:[15200000000,4800000000],2025:[22000000000,6000000000]};
  if(!depreciation||!amortization||depreciation.periodEnd!==amortization.periodEnd||
   depreciation.periodStart!==amortization.periodStart||!expected[year]||
   depreciation.value!==expected[year][0]||amortization.value!==expected[year][1])return null;
  return {status:'DERIVED',metric,year,value:depreciation.value+amortization.value,
   unit:'USD',periodStart:depreciation.periodStart,periodEnd:depreciation.periodEnd,
   method:'MSFT_DEPRECIATION_PLUS_INTANGIBLE_AMORTIZATION',
   inputs:[depreciation.tag,amortization.tag],
   accessions:[depreciation.accession,amortization.accession],
   mappingScope:'ISSUER_VERIFIED',validation:'COMPONENT_TAG_SUM_REVIEWED',
   caveat:'Finance lease ROU amortization excluded pending overlap verification; not cash flow depreciation amortization and other.'};
 }
 if(ticker==='XOM'&&metric==='longTermDebt'){
  return pick('LongTermDebtAndCapitalLeaseObligations');
 }
 if(ticker==='XOM'&&metric==='inventory'){
  const oil=pick('EnergyRelatedInventory');
  const supplies=pick('InventoryPartsAndComponentsNetOfReserves');
  if(!oil||!supplies||oil.periodEnd!==supplies.periodEnd)return null;
  // 2024/2025 XOM consolidated balance sheet: crude oil/products/merchandise + materials/supplies.
  const expected={2024:[19444000000,4080000000],2025:[22979000000,3323000000]};
  if(!expected[year]||oil.value!==expected[year][0]||supplies.value!==expected[year][1])return null;
  return {status:'DERIVED',metric,year,value:oil.value+supplies.value,unit:'USD',
   periodEnd:oil.periodEnd,method:'XOM_CONSOLIDATED_INVENTORY_COMPONENT_SUM',
   inputs:[oil.tag,supplies.tag],accessions:[oil.accession,supplies.accession],
   mappingScope:'ISSUER_VERIFIED',validation:'CONSOLIDATED_10K_LINE_ITEMS'};
 }
 return null;
}
// Only issuer-scoped component sums: each component must cover the identical full FY.
// These are labeled DERIVED, not a reported consolidated D&A total.
export function deriveDepreciationAmortization(concepts,ticker,year,asOf){
 if(!['AVGO','AMD','GOOGL','MRK'].includes(ticker))return null;
 const pick=tag=>(concepts[tag]?.units?.USD||[]).filter(x=>validSecObservation(x,'flow',year,asOf))
  .sort((a,b)=>b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn))[0];
 const depreciation=pick('Depreciation');
 const amortization=pick('AmortizationOfIntangibleAssets');
 if(!depreciation||!amortization||depreciation.start!==amortization.start||depreciation.end!==amortization.end||
  depreciation.val<0||amortization.val<0||depreciation.accn!==amortization.accn)return null;
 return {status:'DERIVED',metric:'depreciationAmortization',year,value:depreciation.val+amortization.val,
  unit:'USD',periodStart:depreciation.start,periodEnd:depreciation.end,
  method:'DEPRECIATION_PLUS_INTANGIBLE_AMORTIZATION',inputs:['Depreciation','AmortizationOfIntangibleAssets'],
  accessions:[depreciation.accn,amortization.accn],mappingScope:'ISSUER_SCOPED',
  caveat:'Component-based D&A; not independently reconciled to cash flow statement total. Excludes other amortization and depletion.'};
}
// GAAP ProfitLoss includes noncontrolling interests; subtract only a separately
// reported matching noncontrolling interest, never assume it is zero.
export function deriveNetIncomeAttributable(concepts,year,asOf){
 const pick=tag=>(concepts[tag]?.units?.USD||[]).filter(x=>validSecObservation(x,'flow',year,asOf))
  .sort((a,b)=>b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn))[0];
 const consolidated=pick('ProfitLoss');
 const nci=pick('NetIncomeLossAttributableToNoncontrollingInterest');
 if(!consolidated||!nci||consolidated.start!==nci.start||consolidated.end!==nci.end||consolidated.accn!==nci.accn)return null;
 return {status:'DERIVED',metric:'netIncome',year,value:consolidated.val-nci.val,unit:'USD',
  periodStart:consolidated.start,periodEnd:consolidated.end,
  method:'CONSOLIDATED_NET_INCOME_MINUS_NCI',inputs:['ProfitLoss','NetIncomeLossAttributableToNoncontrollingInterest'],
  accessions:[consolidated.accn,nci.accn]};
}
// us-gaap:LongTermDebt includes current maturities; subtract the same-date
// reported current maturities, never assume missing current debt is zero.
export function deriveLongTermDebtNoncurrent(concepts,year,asOf){
 const pick=tag=>(concepts[tag]?.units?.USD||[]).filter(x=>validSecObservation(x,'instant',year,asOf))
  .sort((a,b)=>b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn))[0];
 const total=pick('LongTermDebt');
 const current=pick('LongTermDebtCurrent');
 if(!total||!current||total.end!==current.end||total.accn!==current.accn||total.val<current.val||current.val<0)return null;
 return {status:'DERIVED',metric:'longTermDebt',year,value:total.val-current.val,unit:'USD',periodEnd:total.end,
  method:'LONG_TERM_DEBT_INCLUDING_CURRENT_MINUS_CURRENT',inputs:['LongTermDebt','LongTermDebtCurrent'],
  accessions:[total.accn,current.accn]};
}
// Full consolidated equity is not interchangeable with equity attributable to shareholders.
export function deriveShareholderEquity(concepts,year,asOf){
 const pick=tag=>(concepts[tag]?.units?.USD||[]).filter(x=>validSecObservation(x,'instant',year,asOf))
  .sort((a,b)=>b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn))[0];
 const total=pick('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest');
 const nci=pick('MinorityInterest');
 if(!total||!nci||total.end!==nci.end||total.accn!==nci.accn||nci.val<0)return null;
 return {status:'DERIVED',metric:'equity',year,value:total.val-nci.val,unit:'USD',periodEnd:total.end,
  method:'CONSOLIDATED_EQUITY_MINUS_NONCONTROLLING_INTEREST',inputs:['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest','MinorityInterest'],
  accessions:[total.accn,nci.accn]};
}
// Explicit GAAP balance identities only; no assumption that an absent item equals zero.
export function deriveBalanceMetric(concepts,metric,year,asOf){
 const formulas={
  currentAssets:['Assets','AssetsNoncurrent','TOTAL_MINUS_NONCURRENT_ASSETS'],
  currentLiabilities:['Liabilities','LiabilitiesNoncurrent','TOTAL_MINUS_NONCURRENT_LIABILITIES'],
  inventory:['InventoryGross','InventoryValuationReserves','GROSS_INVENTORY_MINUS_RESERVES'],
  cash:['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents','RestrictedCashAndCashEquivalents','CASH_INCL_RESTRICTED_MINUS_RESTRICTED'],
  equity:['Assets','Liabilities','ASSETS_MINUS_LIABILITIES_MINUS_NCI']
 };
 const spec=formulas[metric];if(!spec)return null;
 const pick=tag=>(concepts[tag]?.units?.USD||[]).filter(x=>validSecObservation(x,'instant',year,asOf))
  .sort((a,b)=>b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn))[0];
 const a=pick(spec[0]),b=pick(spec[1]);
 if(!a||!b||a.end!==b.end||a.accn!==b.accn||a.val<b.val||b.val<0)return null;
 let value=a.val-b.val,inputs=[spec[0],spec[1]],accessions=[a.accn,b.accn];
 if(metric==='equity'){
  const nci=pick('MinorityInterest');
  // Parent equity cannot be computed without an explicit NCI disclosure.
  if(!nci||nci.end!==a.end||nci.accn!==a.accn||value<nci.val||nci.val<0)return null;
  value-=nci.val;inputs.push('MinorityInterest');accessions.push(nci.accn);
 }
 return {status:'DERIVED',metric,year,value,unit:'USD',periodEnd:a.end,method:spec[2],inputs,accessions,
  mappingScope:'GAAP_ACCOUNTING_IDENTITY',caveat:'Same-period same-filing consolidated GAAP components; verify classification before cross-issuer comparison.'};
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
// Explain why a source tag is present yet excluded by strict FY selection.
export function diagnoseFiscalCandidates(concepts,metric,year,asOf){
 const kind=['cash','currentAssets','currentLiabilities','inventory','totalAssets','totalLiabilities','equity','longTermDebt','shortTermDebt'].includes(metric)?'instant':'flow';
 const unit=metric==='epsDiluted'?'USD/shares':'USD';
 return (SEC_ALIASES[metric]||[]).map(tag=>{
  const all=concepts[tag]?.units?.[unit]||[];
  const nearby=all.filter(x=>x.end?.slice(0,4)===String(year)&&x.filed<=asOf)
   .sort((a,b)=>b.filed.localeCompare(a.filed)).slice(0,3)
   .map(x=>({end:x.end,start:x.start||null,fy:x.fy,fp:x.fp,form:x.form,filed:x.filed,valid:validSecObservation(x,kind,year,asOf)}));
  return {tag,present:!!concepts[tag],unitCount:all.length,nearby};
 }).filter(x=>x.present);
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
