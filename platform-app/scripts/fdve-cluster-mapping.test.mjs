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
