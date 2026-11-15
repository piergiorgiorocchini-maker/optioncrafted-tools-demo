import {buildModel,dataByTicker,formatMillions,formatNumber,formatPct,formatPrice} from "../core/waccValuation";
export function WaccResearchPanel({ticker}:{ticker:string}){
 const input=dataByTicker[ticker.toUpperCase()];
 if(!input)return <section className="wacc-no-data" aria-label="WACC model data status"><div><span className="wacc-eyebrow">DCF ENGINE / WACC</span><h3>WACC valuation</h3></div><span className="wacc-no-data-badge">No data</span><p>Verified FCFF, capital structure and discount-rate inputs are not yet available for {ticker.toUpperCase()}.</p></section>;

 const model=buildModel(input);
 const metricRows=[
  ["Revenue TTM",formatMillions(input.revenueTtm),"Prior TTM",formatMillions(input.revenuePriorTtm)],
  ["TTM revenue growth",formatPct(model.revenueGrowth),"FY2026 guidance growth",formatPct(input.fy26RevenueGrowth)],
  ["Operating income · TTM",formatMillions(input.ebitTtm),"EBIT margin · TTM",formatPct(model.ebitMargin,1)],
  ["Tax rate",formatPct(input.taxRate,1),"Diluted shares · FY2026 guide",formatNumber(input.dilutedShares,0)+"m"],
  ["D&A · TTM",formatMillions(input.depreciation),"CapEx · TTM",formatMillions(input.capex)],
  ["Historical NWC cash release",formatMillions(input.historicalNwcCashRelease),"Forecast ΔNWC assumption","$0m / year"],
  ["Cash + short-term investments",formatMillions(input.cash+input.shortTermInvestments),"Total debt",formatMillions(input.totalDebt)],
  ["Net debt · leases excluded",formatMillions(model.netDebt),"Market capitalization",formatMillions(input.marketCap)],
  ["Reference share price",formatPrice(input.price),"Market snapshot",input.marketAsOf],
  ["Levered beta · 5Y monthly",formatNumber(input.beta,2),"Risk-free rate · 10Y",formatPct(input.riskFreeRate)],
  ["Equity risk premium",formatPct(input.equityRiskPremium),"Cost of debt · pre-tax",formatPct(model.costOfDebt)],
  ["Cost of equity · CAPM",formatPct(model.costOfEquity),"Cost of debt · after-tax",formatPct(model.afterTaxCostOfDebt)],
  ["Equity / debt weights",formatPct(model.equityWeight,1)+" / "+formatPct(model.debtWeight,1),"Terminal growth",formatPct(input.terminalGrowth,1)]
 ];
 const sourceLinks=[
  {label:"SEC FY2025 Form 10-K",url:"https://www.sec.gov/Archives/edgar/data/796343/000079634326000003/adbe-20251128.htm"},
  {label:"SEC Q3 FY2026 Form 10-Q",url:"https://www.sec.gov/Archives/edgar/data/796343/000079634326000156/adbe-20260828.htm"},
  {label:"Adobe Q3 FY2026 earnings release",url:"https://www.sec.gov/Archives/edgar/data/796343/000079634326000147/adbeex991q326.htm"},
  {label:"U.S. Treasury · 10Y yield",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value_month=202611&type=daily_treasury_yield_curve"},
  {label:"Damodaran · implied ERP",url:"https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm"},
  {label:"CBO · long-term nominal GDP",url:"https://www.cbo.gov/publication/62044"},
  {label:"Yahoo Finance · beta",url:"https://finance.yahoo.com/quote/ADBE/"},
  {label:"StockAnalysis · market data",url:"https://stockanalysis.com/stocks/adbe/"}
 ];

 return <section className="wacc-worksheet" aria-label="Adobe WACC discounted cash flow worksheet">
  <section className="wacc-overview">
   
   <div className="wacc-output-grid">
    <article className="wacc-fair-value"><span>Intrinsic Value / Share</span><strong>{formatPrice(model.fairValue)}</strong><small>{formatPct(model.upside,1)} vs. reference price {formatPrice(input.price)}</small></article>
    <article><span>Terminal value · FY2031</span><strong>{formatMillions(model.terminalValue)}</strong></article>
    <article><span>Enterprise value</span><strong>{formatMillions(model.enterpriseValue)}</strong></article>
    <article><span>Equity value</span><strong>{formatMillions(model.equityValue)}</strong><small>EV less net debt</small></article>

   </div>
  </section>
  <section className="wacc-panel wacc-sensitivity-panel">
   <div className="wacc-section-title"><div><span className="wacc-eyebrow">SENSITIVITY ANALYSIS</span></div></div>
   <div className="wacc-table-scroll"><table className="wacc-sensitivity-table"><thead><tr><th>WACC \ terminal growth</th>{model.terminalCases.map(growth=><th key={growth}>{formatPct(growth,1)}</th>)}</tr></thead><tbody>{model.waccCases.map((scenarioWacc,rowIndex)=><tr key={scenarioWacc}><th>{formatPct(scenarioWacc)}</th>{model.sensitivity[rowIndex].map((value,columnIndex)=><td className={rowIndex===1&&columnIndex===2?"wacc-base-case":""} key={columnIndex}>{formatPrice(value)}</td>)}</tr>)}</tbody></table></div>
   <p className="wacc-note">Only the discount rate and terminal growth change in this matrix. The explicit revenue path, operating margins, net debt and diluted share count remain fixed.</p>
  </section>
  <header className="wacc-panel wacc-heading">
   <div><span className="wacc-eyebrow">ADOBE INC. · DISCOUNTED CASH FLOW</span><h3>WACC valuation worksheet</h3><p>Enterprise cash flows discounted at the weighted average cost of capital, then bridged to equity value per diluted share.</p></div>
   <div className="wacc-status"><span>INPUTS VERIFIED</span><small>Financials through {input.financialAsOf} · market snapshot {input.marketAsOf}</small></div>
  </header>
  <div className="wacc-kpis">
   <article><span>Cost of equity · CAPM</span><strong>{formatPct(model.costOfEquity)}</strong><small>Risk-free + beta × ERP</small></article>
   <article className="wacc-kpi-primary"><span>WACC · working rate</span><strong>{formatPct(model.wacc)}</strong><small>Market-value weights · after-tax debt cost</small></article>
   <article><span>Terminal growth</span><strong>{formatPct(input.terminalGrowth,1)}</strong><small>CBO nominal GDP proxy</small></article>
   <article><span>Normalized TTM FCFF</span><strong>{formatMillions(model.normalizedStartingFcff)}</strong><small>Excludes the one-off NWC cash release</small></article>
  </div>
  <section className="wacc-panel wacc-bridge-details">
   <div className="wacc-section-title"><div><span className="wacc-eyebrow">VALUATION BRIDGE</span><h4>Enterprise value to equity value</h4></div></div>
   <div className="wacc-bridge-table"><div><span>PV explicit FCFF</span><strong>{formatMillions(model.pvExplicit)}</strong></div><div><span>PV terminal value</span><strong>{formatMillions(model.pvTerminal)}</strong></div><div><span>Net debt · excluding leases</span><strong>−{formatMillions(model.netDebt)}</strong></div><div><span>Diluted shares</span><strong>{formatNumber(input.dilutedShares,0)}m</strong></div><div><span>PV terminal value / EV</span><strong>{formatPct(model.terminalShare,1)}</strong></div></div>
  </section>
  <section className="wacc-panel">
   <div className="wacc-section-title"><div><span className="wacc-eyebrow">MODEL INPUTS</span><h4>Financial, capital and market assumptions</h4></div><span className="wacc-period">USD millions except per-share data and rates</span></div>
   <div className="wacc-table-scroll"><table className="wacc-input-table"><tbody>{metricRows.map((row,index)=><tr key={index}><th>{row[0]}</th><td>{row[1]}</td><th>{row[2]}</th><td>{row[3]}</td></tr>)}</tbody></table></div>
   <p className="wacc-note">TTM values are FY2025 plus nine months FY2026 minus nine months FY2025. The TTM working-capital release of {formatMillions(input.historicalNwcCashRelease)} is not forecast as recurring; forecast ΔNWC is normalized to zero. Beta, ERP, Treasury rate and market capitalization have different snapshot dates, so WACC remains a documented working assumption.</p>
  </section>
  <section className="wacc-panel">
   <div className="wacc-section-title"><div><span className="wacc-eyebrow">EXPLICIT FORECAST · 5 YEARS</span><h4>Revenue fade and FCFF build</h4></div><span className="wacc-period">Growth fades linearly from TTM to terminal growth</span></div>
   <div className="wacc-table-scroll"><table className="wacc-forecast-table"><thead><tr><th>Fiscal year</th><th>Revenue growth</th><th>Revenue</th><th>EBIT margin</th><th>EBIT</th><th>Tax rate</th><th>NOPAT</th><th>D&amp;A</th><th>CapEx</th><th>ΔNWC</th><th>FCFF</th><th>Discount factor</th><th>PV of FCFF</th></tr></thead><tbody>{model.projections.map(row=><tr key={row.year}><th>FY{row.year}</th><td>{formatPct(row.growth)}</td><td>{formatNumber(row.revenue)}</td><td>{formatPct(row.ebitMargin,1)}</td><td>{formatNumber(row.ebit)}</td><td>{formatPct(row.taxRate,1)}</td><td>{formatNumber(row.nopat)}</td><td>{formatNumber(row.depreciation)}</td><td>{formatNumber(row.capex)}</td><td>—</td><td><strong>{formatNumber(row.fcff)}</strong></td><td>{formatPct(row.discountFactor,1)}</td><td><strong>{formatNumber(row.pvFcff)}</strong></td></tr>)}</tbody><tfoot><tr><th>TTM base</th><td>{formatPct(model.revenueGrowth)}</td><td>{formatNumber(input.revenueTtm)}</td><td>{formatPct(model.ebitMargin,1)}</td><td>{formatNumber(input.ebitTtm)}</td><td>{formatPct(input.taxRate,1)}</td><td>{formatNumber(input.ebitTtm*(1-input.taxRate))}</td><td>{formatNumber(input.depreciation)}</td><td>{formatNumber(input.capex)}</td><td>{formatMillions(input.historicalNwcCashRelease)} historical</td><td><strong>{formatNumber(model.normalizedStartingFcff)}</strong></td><td>—</td><td>—</td></tr></tfoot></table></div>
   <p className="wacc-formula-note">FCFF = EBIT × (1 − tax) + D&amp;A − CapEx + ΔNWC. EBIT margin, D&amp;A/revenue and CapEx/revenue stay at TTM levels; share-based compensation remains an operating expense.</p>
  </section>
  <footer className="wacc-sources"><strong>Sources and dates</strong><span>Official filings supply the financial statements; public market and macro references supply beta, price, rates and terminal-growth proxy.</span><div>{sourceLinks.map(source=><a href={source.url} key={source.label} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div></footer>
 </section>;
}
