import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlphaVantageAnnual,compareAnnualFacts} from './fdve-alpha-vantage-adapter.mjs';
const income={annualReports:[{fiscalDateEnding:'2025-09-27',reportedCurrency:'USD',totalRevenue:'416161000000',reportedEPS:'6.61',netIncome:'112010000000'}]};
const balance={annualReports:[{fiscalDateEnding:'2025-09-27',reportedCurrency:'USD',totalAssets:'359241000000'}]};
const cashflow={annualReports:[{fiscalDateEnding:'2025-09-27',reportedCurrency:'USD',capitalExpenditures:'-12715000000'}]};
const statements={income,balance,cashflow};
test('annual revenue normalized with provenance and fiscal period',()=>{
 const r=normalizeAlphaVantageAnnual({ticker:'AAPL',metric:'revenue',year:2025,statements});
 assert.equal(r.status,'AVAILABLE');assert.equal(r.value,416161000000);
 assert.equal(r.periodEnd,'2025-09-27');assert.equal(r.provenance.endpoint,'INCOME_STATEMENT');
});
test('capital spending is positive canonical magnitude',()=>{
 const r=normalizeAlphaVantageAnnual({ticker:'AAPL',metric:'capex',year:2025,statements});
 assert.equal(r.status,'AVAILABLE');assert.equal(r.value,12715000000);
});
test('unknown and missing fiscal periods cannot be treated as zero',()=>{
 assert.equal(normalizeAlphaVantageAnnual({ticker:'AAPL',metric:'revenue',year:2024,statements}).status,'PERIOD_MISSING');
 assert.equal(normalizeAlphaVantageAnnual({ticker:'AAPL',metric:'inventory',year:2025,statements}).status,'FIELD_MISSING');
});
test('foreign currency and unexpected positive capex require review',()=>{
 const foreign={income:{annualReports:[{...income.annualReports[0],reportedCurrency:'EUR'}]}};
 assert.equal(normalizeAlphaVantageAnnual({ticker:'AAPL',metric:'revenue',year:2025,statements:foreign}).status,'CURRENCY_REVIEW');
 const positive={cashflow:{annualReports:[{...cashflow.annualReports[0],capitalExpenditures:'12715000000'}]}};
 assert.equal(normalizeAlphaVantageAnnual({ticker:'AAPL',metric:'capex',year:2025,statements:positive}).status,'SIGN_REVIEW');
});
test('reconciliation requires same fiscal end and unit',()=>{
 const av=normalizeAlphaVantageAnnual({ticker:'AAPL',metric:'revenue',year:2025,statements});
 assert.equal(compareAnnualFacts({status:'AVAILABLE',value:416161000000,periodEnd:'2025-09-27',unit:'USD'},av,'revenue').status,'MATCH');
 assert.equal(compareAnnualFacts({status:'AVAILABLE',value:416161000000,periodEnd:'2025-09-28',unit:'USD'},av,'revenue').status,'PERIOD_MISMATCH');
 assert.equal(compareAnnualFacts({status:'AVAILABLE',value:416161000000,periodEnd:'2025-09-27',unit:'EUR'},av,'revenue').status,'UNIT_MISMATCH');
 assert.equal(compareAnnualFacts({status:'AVAILABLE',value:400000000000,periodEnd:'2025-09-27',unit:'USD'},av,'revenue').status,'REVIEW_REQUIRED');
});
