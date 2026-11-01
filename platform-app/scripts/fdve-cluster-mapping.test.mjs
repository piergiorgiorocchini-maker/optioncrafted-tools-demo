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
