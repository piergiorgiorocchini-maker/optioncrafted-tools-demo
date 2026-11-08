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

## Valuation triangulation implementation status — 2026-11-08

- The valuation layer now consumes a versioned Google Sheets `SEC_Raw` export containing 4,446 verified SEC facts across six statement metrics, normalized to 852 annual periods for 175 tickers. The source snapshot was imported at `2026-11-07T22:41:47Z`; this is a static fundamentals snapshot, not a per-request API call or a daily refresh guarantee.
- Normalized annual data preserves fiscal period, currency, SEC tag, accession, filing date and source URL. FCF is derived as operating cash flow less absolute CapEx. FCF/share uses an implied share count from same-period net income divided by diluted EPS and is explicitly treated as an estimate; missing source fields remain missing.
- The automatic DCF requires four consecutive positive annual FCF/share observations. It derives historical CAGR, bounds forecast growth to ±15%, uses a five-year base estimate and presents seven-/ten-year horizons as sensitivity within the same method family. Graham earnings requires four consecutive positive annual diluted-EPS observations and uses the median of the last three positive years. DDM remains pending until dividend history/sustainability is mapped; peer multiples remain pending until a dated, validated peer benchmark set exists.
- The published intrinsic value is formed only when at least two independent method families qualify. At most one estimate per family is counted; weights follow the data-quality score and are capped at 65% per family. The simple mean/median are secondary diagnostics. The 25% margin-of-safety buy-under is kept separate from intrinsic value and never enters the triangulation.
- Comparison with market price is suppressed when the price is missing, older than four days, undated, or predates the latest included SEC filing. Thus a calculated intrinsic value can exist while the over-/undervalued label remains pending.
- On the 227-symbol `Assets` snapshot dated 2026-11-06, the current rules produced: DCF available 63/227, Graham available 62/227, two-family triangulation 45/227, pending 182/227. For those 45, comparison was 32 overvalued, 12 undervalued, and 1 in line; none failed the quote-date gate. DDM and peer-comparable methods were not yet available for any ticker, so this is a two-family composite, not a broad four-method consensus.
- `ABNB` remains pending for an evidenced data reason: the imported SEC facts lack latest annual CapEx and same-period diluted EPS/net income needed by the current FCF/share derivation; its annual diluted EPS series is absent, so Graham is unavailable too. Better raw coverage in general does not satisfy these exact method inputs. This should be addressed by expanding verified SEC tags (including diluted weighted-average shares) and mapping dividend/peer data, not by filling gaps with zero or a fabricated estimate.
- The same `ValuationBridge` is wired through Home, Company Intelligence, Valuation Lab, Options and the Football Field. The integration compiles and the production build succeeds locally with 73 integration assertions. At the time of this entry these changes are **local only**; do not call the site updated until the commit is on the deployment branch and the resulting Actions/Pages run succeeds.
