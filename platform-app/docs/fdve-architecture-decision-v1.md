# FDVE architecture decision v1 — 2026-10-30

## Decision
SEC EDGAR is the authoritative primary source for US issuer financial statements.
Alpha Vantage annual INCOME_STATEMENT, BALANCE_SHEET and CASH_FLOW are accessible on the tested key (AAPL, 20 annual reports each) and form the optional comparison/coverage layer. OVERVIEW returned PREMIUM_REQUIRED. FMP stable statements returned HTTP 402; it is optional and must never gate SEC processing. Damodaran is a **separate, versioned valuation-assumptions provider**, not a substitute for audited company facts.

## Pipeline and boundaries
1. **Provider ingestion:** preserve source, retrieved timestamp, provider field, raw fiscal end, original unit and statement type; secrets are read from GitHub Actions environment only.
2. **Canonical fundamentals:** common METRICS vocabulary, SEC 10-K fiscal-year selection, bank/industrial applicability, explicit derived values. Missing is not zero.
3. **Validation and reconciliation:** compare only same metric, fiscal end and unit; source definitions may still require semantic review. SEC remains primary; never silently overwrite with Alpha Vantage or FMP.
4. **Published Company Intelligence dataset:** only validated SEC facts or explicitly labeled derivations; discrepancies and unavailable metrics remain visible. Production Sheets and tools are not modified by audits.
5. **Valuation assumptions:** Damodaran ERP, industry beta, capital structure, cost of capital and multiples are downloaded/versioned with geography, sector and observation date. Risk-free rates and company-specific overrides are tracked separately.
6. **Consumers:** Company Intelligence -> Quality/Financial Health -> Valuation Lab / Football Field -> Options Lab. All consumers use canonical data rather than vendor response fields.

## Source and validation statuses
- SEC: AVAILABLE, DERIVED, PERIOD_MISSING, AMBIGUOUS, SOURCE_ERROR.
- Alternative provider: AVAILABLE, SOURCE_UNAVAILABLE, PERIOD_MISSING, FIELD_MISSING, CURRENCY_REVIEW, SIGN_REVIEW, PREMIUM_REQUIRED, RATE_LIMITED.
- Reconciliation: MATCH, ROUNDING, REVIEW_REQUIRED, PERIOD_MISMATCH, UNIT_MISMATCH, SEC_UNAVAILABLE, ALTERNATIVE_UNAVAILABLE.
- Do not call a workflow success a successful reconciliation when the provider returned an access error.

## Scope of first completed vertical slice
- Five companies: AAPL, MSFT, XOM, WMT, JPM.
- FY2024 and FY2025, SEC baseline coverage 126/132 applicable observations (95.45%).
- Alpha Vantage read-only access verified on AAPL. Pure adapter and tests added; live SEC/AV five-company reconciliation is a **next implementation step**, not yet complete.
- FMP is non-blocking. No paid subscriptions or API purchases required for this phase.
- Bank-specific KPIs must not inherit industrial definitions by default.
- Historical Damodaran datasets must not be confused with live market prices.

## Acceptance gates for production
- Each published fact has ticker, metric, value, unit, fiscal period, source and extraction timestamp.
- SEC taxonomy and period validated; derivations carry method and inputs.
- Cross-source discrepancies trigger review, not silent selection.
- Sector applicability respected; failures are observable per metric and provider.
- Tests pass and first real SEC/AV reconciliation is inspected before connecting to Company Intelligence.
