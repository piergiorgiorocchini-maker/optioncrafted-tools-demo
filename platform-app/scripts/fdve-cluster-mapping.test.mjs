import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFiscalSec,deriveTotalLiabilities,reconcileValue,selectBankFiscalSec,findRelatedTags,diagnoseInterestTags,resolveValidatedIndustrialMetric} from './fdve-cluster-mapping.mjs';
const fact=(val,end,fy,extra={})=>({val,end,fy,fp:'FY',form:'10-K',filed:fy+'-03-01',accn:'0000104169-25-000001',...extra});
test('a historical tag is not coverage for FY2025',()=>{
 const concepts={InventoryNet:{units:{USD:[fact(100,'2012-01-31',2012)]}}};
 assert.equal(selectFiscalSec(concepts,'inventory','instant',2025,'2026-10-30').status,'PERIOD_MISSING');
});
test('fiscal year selection excludes quarterly and annual mismatches',()=>{
 const concepts={Revenues:{units:{USD:[fact(200,'2025-12-31',2025,{start:'2025-01-01'}),fact(500,'2025-12-31',2025,{start:'2025-10-01',form:'10-Q'})]}}};
 assert.equal(selectFiscalSec(concepts,'revenue','flow',2025,'2026-10-30').value,200);
});
test('WMT liabilities derivation requires consolidated total equity',()=>{
 const assets=fact(300,'2025-01-31',2025);
 const equity=fact(110,'2025-01-31',2025);
 const concepts={Assets:{units:{USD:[assets]}},StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest:{units:{USD:[equity]}}};
 assert.equal(deriveTotalLiabilities(concepts,2025,'2026-10-30').value,190);
 assert.equal(deriveTotalLiabilities({Assets:concepts.Assets},2025,'2026-10-30').status,'DERIVATION_UNAVAILABLE');
});
test('FMP period/currency mismatch is not a numerical match',()=>{
 const sec={status:'AVAILABLE',value:100,periodEnd:'2025-09-27'};
 assert.equal(reconcileValue(sec,{value:100,periodEnd:'2025-09-26',currency:'USD'},'revenue').status,'PERIOD_MISMATCH');
 assert.equal(reconcileValue(sec,{value:100,periodEnd:'2025-09-27',currency:'EUR'},'revenue').status,'CURRENCY_MISMATCH');
 assert.equal(reconcileValue(sec,{value:100,periodEnd:'2025-09-27',currency:'USD'},'revenue').status,'MATCH');
});

test('bank-specific deposits require current fiscal period',()=>{
 const concepts={Deposits:{units:{USD:[fact(1000,'2025-12-31',2025)]}}};
 assert.equal(selectBankFiscalSec(concepts,'deposits',2025,'2026-10-30').value,1000);
 assert.equal(selectBankFiscalSec(concepts,'deposits',2024,'2026-10-30').status,'PERIOD_MISSING');
});
test('taxonomy suggestions are not automatically mapped',()=>{
 const concepts={LongTermDebtAndCapitalLeaseObligations:{units:{USD:[]}}};
 assert.ok(findRelatedTags(concepts,'longTermDebt').length>0);
 assert.equal(selectFiscalSec(concepts,'longTermDebt','instant',2025,'2026-10-30').status,'PERIOD_MISSING');
});

test('SEC D&A and interest expense map only to same-year annual 10-K facts',()=>{
 const concepts={
  DepreciationDepletionAndAmortization:{units:{USD:[fact(11500000000,'2025-09-27',2025,{start:'2024-09-29'})]}},
  InterestExpenseNonOperating:{units:{USD:[fact(400000000,'2025-09-27',2025,{start:'2024-09-29'})]}}
 };
 assert.equal(selectFiscalSec(concepts,'depreciationAmortization','flow',2025,'2026-10-31').value,11500000000);
 assert.equal(selectFiscalSec(concepts,'interestExpense','flow',2025,'2026-10-31').value,400000000);
 assert.equal(selectFiscalSec(concepts,'depreciationAmortization','flow',2024,'2026-10-31').status,'PERIOD_MISSING');
});

test('interest tag diagnostics never promote cash interest paid to interest expense',()=>{
 const concepts={InterestPaidNet:{label:'Cash interest paid',units:{USD:[fact(50,'2025-12-31',2025,{start:'2025-01-01'})]}}};
 assert.equal(selectFiscalSec(concepts,'interestExpense','flow',2025,'2026-10-31').status,'PERIOD_MISSING');
 const diagnostic=diagnoseInterestTags(concepts,2025,'2026-10-31');
 assert.equal(diagnostic.status,'DIAGNOSTIC_ONLY');
 assert.equal(diagnostic.availableTags[0].tag,'InterestPaidNet');
 assert.equal(diagnostic.availableTags[0].values[0].value,50);
});

test('XOM inventory is issuer-scoped and does not double count its subcomponents',()=>{
 const fy=2025,end='2025-12-31',asOf='2026-11-01';
 const concepts={
  EnergyRelatedInventory:{units:{USD:[fact(22979000000,end,fy)]}},
  InventoryPartsAndComponentsNetOfReserves:{units:{USD:[fact(3323000000,end,fy)]}},
  EnergyRelatedInventoryChemicals:{units:{USD:[fact(4261000000,end,fy)]}},
  EnergyRelatedInventoryPetroleum:{units:{USD:[fact(7976000000,end,fy)]}}
 };
 const result=resolveValidatedIndustrialMetric(concepts,'XOM','inventory','instant',fy,asOf);
 assert.equal(result.status,'DERIVED');
 assert.equal(result.value,26302000000);
 assert.equal(result.inputs.length,2);
 assert.equal(resolveValidatedIndustrialMetric(concepts,'MSFT','inventory','instant',fy,asOf),null);
 const modified=structuredClone(concepts);
 modified.EnergyRelatedInventory.units.USD[0].val=22979000001;
 assert.equal(resolveValidatedIndustrialMetric(modified,'XOM','inventory','instant',fy,asOf),null);
});
test('XOM consolidated long-term debt mapping is never applied to other issuers',()=>{
 const concepts={LongTermDebtAndCapitalLeaseObligations:{units:{USD:[fact(34241000000,'2025-12-31',2025)]}}};
 assert.equal(resolveValidatedIndustrialMetric(concepts,'XOM','longTermDebt','instant',2025,'2026-11-01').value,34241000000);
 assert.equal(resolveValidatedIndustrialMetric(concepts,'AAPL','longTermDebt','instant',2025,'2026-11-01'),null);
});

test('MSFT D&A is explicitly derived from two matched annual components, never the other-inclusive cashflow line',()=>{
 const year=2025,end='2025-06-30',start='2024-07-01';
 const concepts={
  Depreciation:{units:{USD:[fact(22000000000,end,year,{start})]}},
  AmortizationOfIntangibleAssets:{units:{USD:[fact(6000000000,end,year,{start})]}},
  FinanceLeaseRightOfUseAssetAmortization:{units:{USD:[fact(3408000000,end,year,{start})]}}
 };
 const result=resolveValidatedIndustrialMetric(concepts,'MSFT','depreciationAmortization','flow',year,'2026-11-01');
 assert.equal(result.status,'DERIVED');
 assert.equal(result.value,28000000000);
 assert.equal(result.inputs.length,2);
 assert.equal(resolveValidatedIndustrialMetric(concepts,'XOM','depreciationAmortization','flow',year,'2026-11-01'),null);
 const mismatch=structuredClone(concepts);
 mismatch.AmortizationOfIntangibleAssets.units.USD[0].start='2024-08-01';
 assert.equal(resolveValidatedIndustrialMetric(mismatch,'MSFT','depreciationAmortization','flow',year,'2026-11-01'),null);
});

import {auditIndexDependencies,auditDependencyReport} from './fdve-dependency-audit.mjs';
test('dependency audit distinguishes direct, derived and unavailable inputs',()=>{
 const f=(value,status='AVAILABLE')=>({value,status});
 const metrics={currentAssets:f(100),currentLiabilities:f(50),inventory:f(10,'DERIVED'),
  cash:f(20),interestExpense:{status:'PERIOD_MISSING'}};
 const result=auditIndexDependencies(metrics);
 assert.equal(result.currentRatio.status,'READY_DIRECT');
 assert.equal(result.quickRatio.status,'READY_DERIVED');
 assert.equal(result.interestCoverage.status,'BLOCKED');
 assert.equal(result.enterpriseValue.status,'BLOCKED');
});
test('zero interest expense is not a valid coverage denominator',()=>{
 const f=value=>({value,status:'AVAILABLE'});
 const result=auditIndexDependencies({operatingIncome:f(100),interestExpense:f(0)});
 assert.equal(result.interestCoverage.status,'BLOCKED');
 assert.ok(result.interestCoverage.missing.some(x=>x.reason==='INVALID_DENOMINATOR'));
});
test('dependency summary never counts banks as industrial readiness',()=>{
 const f=value=>({value,status:'AVAILABLE'});
 const report={companies:[{ticker:'JPM',profile:'bank',years:{2025:{metrics:{}}}},
  {ticker:'AAPL',profile:'industrial',years:{2025:{metrics:{currentAssets:f(100),currentLiabilities:f(50)}}}}]};
 const result=auditDependencyReport(report);
 assert.equal(result.summary.rows,1);
 assert.equal(result.summary.possible,10);
 assert.equal(result.rows[0].indexes.currentRatio.status,'READY_DIRECT');
});

import {validateFiscalRow} from './fdve-quality-gate.mjs';
test('quality gate rejects missing provenance and misaligned fiscal years',()=>{
 const row=validateFiscalRow('TEST',2025,{cash:{status:'AVAILABLE',value:100,periodEnd:'2024-12-31'}});
 assert.equal(row.status,'REVIEW_REQUIRED');
 assert.ok(row.issues.some(x=>x.code==='PERIOD_MISMATCH'));
 assert.ok(row.issues.some(x=>x.code==='MISSING_PROVENANCE'));
});
test('quality gate rejects inventory exceeding current assets',()=>{
 const f=(value,tag)=>({status:'AVAILABLE',value,periodEnd:'2025-12-31',tag,accession:'000001-25-000001'});
 const row=validateFiscalRow('TEST',2025,{currentAssets:f(50,'AssetsCurrent'),inventory:f(90,'InventoryNet')});
 assert.ok(row.issues.some(x=>x.code==='INVENTORY_EXCEEDS_CURRENT_ASSETS'));
});

import {validateMarketSnapshot} from './fdve-dependency-audit.mjs';
test('market capitalization must be sourced and aligned with fiscal year end',()=>{
 const good={marketCap:3e12,currency:'USD',asOf:'2025-09-30',source:'EXCHANGE'};
 assert.equal(validateMarketSnapshot(good,'2025-09-27').status,'VALID');
 assert.equal(validateMarketSnapshot({...good,asOf:'2026-11-01'},'2025-09-27').status,'REJECTED');
 assert.equal(validateMarketSnapshot({...good,source:''},'2025-09-27').status,'REJECTED');
 assert.equal(validateMarketSnapshot({...good,currency:'EUR'},'2025-09-27').status,'REJECTED');
 const f=value=>({value,status:'AVAILABLE'});
 const metrics={longTermDebt:f(100),shortTermDebt:f(20),cash:f(30),operatingIncome:f(60),depreciationAmortization:f(10)};
 assert.equal(auditIndexDependencies(metrics).evEbitda.status,'BLOCKED');
 assert.equal(auditIndexDependencies(metrics,{marketSnapshot:good,periodEnd:'2025-09-27'}).evEbitda.status,'READY_DIRECT');
});

test('quality gate quarantines mixed fiscal dates within the same year',()=>{
 const f=(value,periodEnd)=>({status:'AVAILABLE',value,periodEnd,tag:'Assets',accession:'0000000000-25-000001'});
 const row=validateFiscalRow('TEST',2025,{totalAssets:f(100,'2025-09-27'),cash:f(10,'2025-12-31')});
 assert.equal(row.status,'REVIEW_REQUIRED');
 assert.ok(row.issues.some(x=>x.code==='FISCAL_END_INCONSISTENT'));
});
test('quality gate rejects quarterly cash flows mislabeled as annual',()=>{
 const row=validateFiscalRow('TEST',2025,{revenue:{status:'AVAILABLE',value:100,periodStart:'2025-10-01',periodEnd:'2025-12-31',tag:'Revenues',accession:'0000000000-25-000001'}});
 assert.ok(row.issues.some(x=>x.code==='INVALID_ANNUAL_DURATION'));
});

test('WMT FY2024/2025 D&A is approved only when matching issuer 10-K line and fiscal duration',()=>{
 const cases=[[2024,11853000000,'2023-02-01','2024-01-31'],[2025,12973000000,'2024-02-01','2025-01-31']];
 for(const [year,value,start,end] of cases){
  const concepts={DepreciationAmortizationAndAccretionNet:{units:{USD:[fact(value,end,year,{start})]}}};
  const matched=resolveValidatedIndustrialMetric(concepts,'WMT','depreciationAmortization','flow',year,'2026-11-01');
  assert.equal(matched.status,'AVAILABLE');
  assert.equal(matched.value,value);
  assert.equal(matched.validation,'CONSOLIDATED_CASH_FLOW_AND_SEGMENT_RECONCILIATION');
  assert.equal(resolveValidatedIndustrialMetric(concepts,'XOM','depreciationAmortization','flow',year,'2026-11-01'),null);
  concepts.DepreciationAmortizationAndAccretionNet.units.USD[0].val++;
  assert.equal(resolveValidatedIndustrialMetric(concepts,'WMT','depreciationAmortization','flow',year,'2026-11-01'),null);
 }
});

import {buildMarketSnapshot} from './fdve-dependency-audit.mjs';
test('price times shares creates a dated, source-labelled market cap without lookahead',()=>{
 const snapshot=buildMarketSnapshot({price:150,sharesOutstanding:1000000,asOf:'2025-09-30',source:'GOOGLE'});
 assert.equal(snapshot.marketCap,150000000);
 assert.equal(validateMarketSnapshot(snapshot,'2025-09-27').status,'VALID');
 assert.equal(validateMarketSnapshot(snapshot,'2024-09-28').status,'REJECTED');
 assert.equal(buildMarketSnapshot({price:150,sharesOutstanding:0,asOf:'2025-09-30',source:'GOOGLE'}).status,'REJECTED');
});
test('historical market cap gaps do not contaminate SEC-only readiness',()=>{
 const f=value=>({value,status:'AVAILABLE'});
 const metrics={currentAssets:f(100),currentLiabilities:f(50),inventory:f(10),cash:f(20),equity:f(100),interestExpense:f(2),longTermDebt:f(40),shortTermDebt:f(10),cashFromOperations:f(50),capex:f(20),operatingIncome:f(60),depreciationAmortization:f(10)};
 const report={companies:[{ticker:'AAPL',profile:'industrial',years:{2025:{metrics}}}]};
 const summary=auditDependencyReport(report).summary;
 assert.equal(summary.accountingOnly.possible,8);
 assert.equal(summary.accountingOnly.ready,8);
 assert.equal(summary.marketDependent.possible,2);
 assert.equal(summary.marketDependent.blocked,2);
});
test('liabilities can be derived only from consolidated equity including NCI',()=>{
 const assets=fact(300,'2025-12-31',2025);
 const equity=fact(110,'2025-12-31',2025);
 const c={Assets:{units:{USD:[assets]}},StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest:{units:{USD:[equity]}}};
 assert.equal(deriveTotalLiabilities(c,2025,'2026-11-01').value,190);
 assert.equal(deriveTotalLiabilities({Assets:c.Assets},2025,'2026-11-01').status,'DERIVATION_UNAVAILABLE');
});

import {deriveDepreciationAmortization,deriveShareholderEquity} from './fdve-cluster-mapping.mjs';
test('D&A component sum is scoped, period-aligned and explicitly derived',()=>{
 const a=fact(20,'2025-12-31',2025,{start:'2025-01-01'});
 const b=fact(5,'2025-12-31',2025,{start:'2025-01-01'});
 const c={Depreciation:{units:{USD:[a]}},AmortizationOfIntangibleAssets:{units:{USD:[b]}}};
 assert.equal(deriveDepreciationAmortization(c,'AMD',2025,'2026-11-01').value,25);
 assert.equal(deriveDepreciationAmortization(c,'CAT',2025,'2026-11-01'),null);
 c.AmortizationOfIntangibleAssets.units.USD[0].start='2025-02-01';
 assert.equal(deriveDepreciationAmortization(c,'AMD',2025,'2026-11-01'),null);
});
test('shareholder equity excludes NCI and requires same accession',()=>{
 const a=fact(100,'2025-12-31',2025);
 const b=fact(4,'2025-12-31',2025);
 const c={StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest:{units:{USD:[a]}},MinorityInterest:{units:{USD:[b]}}};
 assert.equal(deriveShareholderEquity(c,2025,'2026-11-01').value,96);
 c.MinorityInterest.units.USD[0].accn='different';
 assert.equal(deriveShareholderEquity(c,2025,'2026-11-01'),null);
});

import {deriveNetIncomeAttributable,deriveLongTermDebtNoncurrent} from './fdve-cluster-mapping.mjs';
test('net income attributable to parent requires same FY and same filing NCI',()=>{
 const p=fact(100,'2025-12-31',2025,{start:'2025-01-01'});
 const n=fact(7,'2025-12-31',2025,{start:'2025-01-01'});
 const c={ProfitLoss:{units:{USD:[p]}},NetIncomeLossAttributableToNoncontrollingInterest:{units:{USD:[n]}}};
 assert.equal(deriveNetIncomeAttributable(c,2025,'2026-11-01').value,93);
 c.NetIncomeLossAttributableToNoncontrollingInterest.units.USD[0].accn='mismatch';
 assert.equal(deriveNetIncomeAttributable(c,2025,'2026-11-01'),null);
});
test('noncurrent long-term debt subtracts only matching reported current maturities',()=>{
 const t=fact(100,'2025-12-31',2025),c=fact(25,'2025-12-31',2025);
 const x={LongTermDebt:{units:{USD:[t]}},LongTermDebtCurrent:{units:{USD:[c]}}};
 assert.equal(deriveLongTermDebtNoncurrent(x,2025,'2026-11-01').value,75);
 x.LongTermDebtCurrent.units.USD[0].val=101;
 assert.equal(deriveLongTermDebtNoncurrent(x,2025,'2026-11-01'),null);
});
