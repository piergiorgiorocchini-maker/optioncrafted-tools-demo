
import {verifiedFcf,verifiedAnnualHistory} from "../data/verifiedFinancials";
import {getSecFinancialInputs} from "../data/secFinancialBridge";
import {secCashConversion as calculateSecCashConversion,secRoicEstimate} from "../data/secQualityMetrics";
import {VerifiedFundamentals} from "./VerifiedFundamentals";
import {NavLink} from "react-router-dom";
import {ArrowRight,Building2,ChartNoAxesCombined,ShieldCheck,Target,TrendingUp} from "lucide-react";
import type {Security} from "../core/contracts";import type {RealAsset} from "./RealResearch";
import "./company.css";import {FinancialCharts} from "./FinancialCharts";import appleResearch from "../data/aaplResearch.json";
import {fundamentalMetrics,missingFundamentals} from "../core/fundamentalMetrics";
import {SecurityLogo} from "./SecurityLogo";
import type {ValuationBridge} from "./ValuationWorkspace";
const fmt=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v);
const compactMoney=(n:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",notation:"compact",maximumFractionDigits:2}).format(n);
export function CompanyIntelligence({company,asset,valuation}:{company:Security;asset?:RealAsset;valuation?:ValuationBridge}){
 const apple=asset?.ticker==="AAPL";const appleFcf=apple?appleResearch.fcfPerShare:null; const real=Boolean(asset);const name=asset?.name??company.name;const symbol=asset?.ticker??company.ticker;const sector=asset?.sector??company.sector;const currency=asset?.currency??company.currency;const referencePrice=asset?.price??(real?null:company.price);const earnings=asset?.eps??(real?verifiedAnnualHistory(symbol).at(-1)?.eps??null:company.eps);const show=(n:number|null,suffix="")=>n===null?"N/D":n.toFixed(2)+suffix;const showMoney=(n:number|null)=>n===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD"}).format(n);
 const secInputs=getSecFinancialInputs(symbol);
 const secFcf=verifiedFcf(symbol);
 const secConversion=calculateSecCashConversion(symbol);
 const secRoic=secRoicEstimate(symbol);
 const roicDisplay=secRoic.value!==null?secRoic.value.toFixed(1)+"% (est.)":apple?appleResearch.roic.toFixed(1)+"%":"N/D";
 const conversionDisplay=secConversion.value!==null?secConversion.value.toFixed(1)+"%":"N/D";
 const secHistory=verifiedAnnualHistory(symbol);
 const secLatest=secHistory.at(-1);
 const secOperatingIncome=secLatest?.operatingIncome??null;
 const secOperatingMargin=secLatest?.operatingIncome!==null&&secLatest?.operatingIncome!==undefined&&secLatest.revenue!==null&&secLatest.revenue>0?secLatest.operatingIncome/secLatest.revenue*100:null;
 const secCashConversion=secLatest?.fcf!==null&&secLatest?.fcf!==undefined&&secLatest.netIncome!==null&&secLatest.netIncome>0?secLatest.fcf/secLatest.netIncome*100:null;
 const snapshotPE=asset?.pe??null;
 const fcfYieldFromMarketCap=secFcf.annualUsd!==null&&asset?.marketCap!==null&&asset?.marketCap!==undefined&&asset.marketCap>0?secFcf.annualUsd/asset.marketCap*100:null;
 const fcfYieldFromPerShare=secFcf.perShare!==null&&referencePrice!==null&&referencePrice>0?secFcf.perShare/referencePrice*100:null;
 const fcfYieldVerified=fcfYieldFromMarketCap??fcfYieldFromPerShare;
 const isBank=secInputs.profile==="bank";
 const balanceInputs={...missingFundamentals,...(apple?{cash:appleResearch.balanceSheet.cash,currentAssets:appleResearch.balanceSheet.currentAssets,currentLiabilities:appleResearch.balanceSheet.currentLiabilities,inventory:appleResearch.balanceSheet.inventory,totalDebt:appleResearch.balanceSheet.totalDebt,equity:appleResearch.balanceSheet.shareholdersEquity,freeCashFlow:appleResearch.annualData[3].fcfB*1000}:{}),...secInputs,...(asset?.marketCap!==null&&asset?.marketCap!==undefined?{marketCap:asset.marketCap}:{})};
 const balanceMetrics=fundamentalMetrics(balanceInputs);
 const balanceRows=[["Current ratio",balanceMetrics.currentRatio],["Quick ratio",balanceMetrics.quickRatio],["Cash ratio",balanceMetrics.cashRatio],["Net debt",balanceMetrics.netDebt],["Net debt / EBITDA",balanceMetrics.netDebtEbitda],["Debt / Equity",balanceMetrics.debtEquity],["Interest coverage",balanceMetrics.interestCoverage],["FCF / Debt",balanceMetrics.fcfDebt],["Enterprise value · basic",balanceMetrics.enterpriseValue],["EV / EBITDA · basic",balanceMetrics.evEbitda]] as const;
 const earningsYield=company.eps/company.price*100;
 const fcfYield=company.fcfPerShare/company.price*100;
 const gap=(company.buyBelow/company.price-1)*100;
 const demoSeries=[.69,.75,.81,.88,1].map((factor,i)=>({period:String(2022+i),revenue:Math.round(100*factor),fcf:Math.round(100*factor*(1.04+i*.012))}));
 return <div className="ci">
  <section className="ci-head"><div><div className="ci-overline">EQUITY RESEARCH / COMPANY INTELLIGENCE</div><h2 className="ci-security-title"><SecurityLogo ticker={symbol}/>{name}</h2><p><b>{symbol}</b> · {sector} · {currency} · {real?`Google Sheets · as of ${asset?.priceDate??"N/D"}`:"Demo snapshot "+company.snapshotDate}</p></div><span className="ci-demo">{real?"REAL SNAPSHOT + LAB PREVIEW":"ILLUSTRATIVE FINANCIALS"}</span></section>
  <section className="ci-metrics">
   <article><span><Building2 size={16}/> REFERENCE PRICE</span><strong>{showMoney(referencePrice)}</strong><small>{real?"Google Sheets · snapshot":"Historical-style demo input"}</small></article>
   <article><span><TrendingUp size={16}/> RETURN ON INVESTED CAPITAL</span><strong>{real?roicDisplay:company.roic.toFixed(1)+"%"}</strong><small>{real?(secRoic.value!==null?"SEC FY2025 · 21% assumed tax · average capital":apple?"Apple SEC research · gross capital basis":"ROIC requires operating income and 2 FY balance sheets"):"Provided sample ratio"}</small></article>
   <article><span><ChartNoAxesCombined size={16}/> FREE CASH FLOW YIELD</span><strong>{fcfYieldVerified!==null?fcfYieldVerified.toFixed(2)+"%":apple&&referencePrice!==null?(appleFcf!/referencePrice*100).toFixed(2)+"%":real?"N/D":fcfYield.toFixed(2)+"%"}</strong><small>{fcfYieldFromMarketCap!==null?"SEC FY "+secLatest?.year+" FCF / Sheets market cap":fcfYieldFromPerShare!==null?"SEC FCF/share / Sheets price"+(secLatest?.year?" · FY "+secLatest.year:""):apple?"SEC reconstructed TTM FCF/share / Sheets price":real?"FCF data pending":"Derived from demo FCF/share ÷ price"}</small></article>
   <article><span><Target size={16}/> EARNINGS YIELD</span><strong>{real?(earnings!==null&&referencePrice!==null&&referencePrice>0?show(earnings/referencePrice*100,"%"):"N/D"):earningsYield.toFixed(2)+"%"}</strong><small>{real?"Computed from snapshot EPS / price":"Derived from demo EPS ÷ price"}</small></article>
  </section>
  <VerifiedFundamentals ticker={symbol}/>
  <FinancialCharts asset={asset} company={company}/>
  <section className="ci-panel ci-wide"><div className="ci-panel-head"><h3>Liquidity, leverage & enterprise value</h3><span>{secInputs.source?"SEC FY2025 · "+secInputs.periodEnd:apple?"SEC 10-Q · 27 JUN 2026":"SOURCE DATA PENDING"}</span></div><div className="ci-balance-grid">{(isBank?[]:balanceRows).map(([label,metric])=><div key={label}><span>{label}</span><b title={"Requires: "+metric.required.join(", ")}>{metric.value===null?"N/D":metric.unit==="money"?compactMoney(metric.value,currency):metric.value.toFixed(2)+(metric.unit==="percent"?"%":"x")}</b></div>)}</div><p className="ci-note">{isBank?"Bank-specific capital, liquidity and leverage ratios require a separate banking methodology. Industrial ratios are deliberately disabled.":secInputs.source?"SEC FY2025 inputs. Debt is long-term debt plus its current portion, not necessarily total financial borrowings. FCF/Debt uses FY2025 annual cash flow, not TTM. EBITDA uses SEC operating income plus fiscal-year D&A when available. Interest coverage uses operating income as a proxy. Basic EV uses a dated Sheets market-cap snapshot and SEC FY balance sheet, excluding unverified preferred equity and minority interest; this is not a same-date enterprise value.":apple?"SEC research snapshot, partial financial inputs.":"Balance-sheet fields are not yet available in the validated asset snapshot. Missing metrics remain N/D."}</p></section>
  <div className="ci-main">
   <section className="ci-panel"><div className="ci-panel-head"><h3>Financial overview</h3><span>{real?"Real partial snapshot":"Sample snapshot"}</span></div><div className="ci-fundamentals">
    <div><span>Earnings per share</span><b>{showMoney(earnings)}</b></div>
    <div><span>P/E · snapshot</span><b>{snapshotPE!==null&&snapshotPE>0?snapshotPE.toFixed(2)+"x":real?"N/D":(company.price/company.eps).toFixed(2)+"x"}</b></div>
    <div><span>Industry P/E · median</span><b>N/D · peer set pending</b></div>
    <div><span>52W range · Sheets</span><b>{asset?.low52!=null&&asset?.high52!=null?showMoney(asset.low52)+" – "+showMoney(asset.high52):"N/D"}</b></div>
    <div><span>52W drawdown · Sheets</span><b>{asset?.drawdown52==null?"N/D":(asset.drawdown52*100).toFixed(1)+"%"}</b></div>
    <div><span>Operating income · SEC FY {secLatest?.year??"—"}</span><b>{secOperatingIncome!==null?compactMoney(secOperatingIncome,currency):"N/D"}</b></div>
    <div><span>Operating margin · SEC FY {secLatest?.year??"—"}</span><b>{secOperatingMargin===null?"N/D":secOperatingMargin.toFixed(1)+"%"}</b></div>
    <div><span>FCF / net income · SEC FY {secLatest?.year??"—"}</span><b>{secCashConversion===null?"N/D":secCashConversion.toFixed(1)+"%"}</b></div>
    <div><span>EBITDA · SEC FY {secLatest?.year??"—"} · operating proxy</span><b>{balanceInputs.ebitda!==null&&balanceInputs.ebitda!==undefined?compactMoney(balanceInputs.ebitda,currency):"N/D · D&A pending"}</b></div>
    <div title={secFcf.warning}><span>Free cash flow per share</span><b>{secFcf.perShare!==null?showMoney(secFcf.perShare):real?"N/D":fmt(company.fcfPerShare)}</b></div>
    <div><span>FCF / EPS conversion</span><b>{real?conversionDisplay:(company.fcfPerShare/company.eps*100).toFixed(1)+"%"}</b></div>
    <div><span>Return on invested capital</span><b>{real?roicDisplay:company.roic.toFixed(1)+"%"}</b></div>
    <div><span>Sector</span><b>{sector}</b></div>
    <div><span>Financial data status</span><b className="ci-warning">{real?"Partial snapshot":"Simulated"}</b></div>
   </div><p className="ci-note">Operating margin and FCF/net income use matched SEC fiscal-year observations, not snapshot EPS. Operating income is a SEC-reported FY metric, shown separately from EBIT until reconciliation of non-operating items. EBITDA = SEC operating income + SEC depreciation/amortization for the same fiscal year; operating income is used as an operating-EBIT proxy, not independently reconciled EBIT. P/E is from the Sheets snapshot; industry median requires a dated, audited peer universe.</p><p className="ci-note">{apple?"Price and EPS from Sheets; FCF/share and financial history reconstructed from Apple SEC filings (TTM Jun 2026). ROIC calculated on gross invested capital, cash-inclusive; see SEC methodology.":real?`Snapshot price, EPS TTM, P/E and 52-week metrics from Google Sheets as of ${asset?.priceDate??"N/D"}; SEC annual FCF and balance-sheet metrics are separate fiscal-period observations. Where same-year net income and diluted EPS are present, FCF/share is an estimate using FCF × diluted EPS ÷ net income; the implied share count is not separately reported. ROIC (est.) assumes 21% tax and average invested capital where sufficient SEC data exist.`:"Demo financials."}</p></section>
   <section className="ci-panel"><div className="ci-panel-head"><h3>Quality lens</h3><span>Interpretation framework</span></div>
    <div className="ci-quality"><div className="ci-quality-line"><span>Capital efficiency</span><strong>{real?roicDisplay:company.roic.toFixed(1)+"% ROIC*"}</strong></div><div className="ci-bar"><span style={{width:`${real?(secRoic.value!==null?Math.min(100,Math.max(0,secRoic.value/25*100)):0):Math.min(100,Math.max(0,company.roic/25*100))}%`}}/></div>
    <div className="ci-quality-line"><span>Cash earnings conversion</span><strong>{real?conversionDisplay:(company.fcfPerShare/company.eps*100).toFixed(1)+"%*"}</strong></div><div className="ci-bar"><span style={{width:`${real?(secConversion.value!==null?Math.min(100,Math.max(0,secConversion.value)):0):Math.min(100,Math.max(0,company.fcfPerShare/company.eps*70))}%`}}/></div>
    <div className="ci-quality-line"><span>Leverage / balance-sheet risk</span><strong>Data required</strong></div><div className="ci-bar ci-empty"></div></div>
    <p className="ci-note">{real?"Cash conversion uses same-year SEC FCF and net income. ROIC estimates use FY2025 SEC operating income, average FY2024–FY2025 invested capital and an explicitly assumed 21% tax rate; where unavailable, the metric remains N/D. Apple historical ROIC fallback uses a different gross-capital methodology. Not a verified sector score.":"* Ratios use illustrative data. Quality scores remain disabled until sector-specific definitions are established."}</p></section>
   <section className="ci-panel ci-wide"><div className="ci-panel-head"><h3>From quality to valuation</h3><span>Connected workflow</span></div>
    <div className="ci-next"><div><span>{real?"Investor entry target":"Illustrative buy-under target"}</span><strong>{real?"Pending":fmt(company.buyBelow)}</strong><small>{real?"Requires valuation assumptions":"Gap versus price: "+gap.toFixed(1)+"%"}</small></div><p>Review business fundamentals, select an appropriate valuation model, and carry the same ticker into the Options Lab. Current buy-under values are illustrative inputs, not computed fair values.</p><NavLink to="/valuation">Continue to Valuation Lab <ArrowRight size={16}/></NavLink></div>
   </section>
  </div><section className="ci-panel ci-wide"><div className="ci-panel-head"><h3>SEC Filings & Trading Comparables</h3><span>FILINGS VERIFIED WHERE AVAILABLE · PEER ENGINE PENDING</span></div>{apple?<p><a href={appleResearch.sourceUrls[0]} target="_blank" rel="noreferrer">Apple FY2025 10-K</a> · <a href={appleResearch.sourceUrls[1]} target="_blank" rel="noreferrer">Apple Q3 FY2026 10-Q</a></p>:null}<details><summary>Design preview & planned peer-comparison functionality</summary><p className="ci-note">{real?"The design preview uses fictional DEMO companies, not financial data for "+symbol+". Existing layout and peer-filter functionality is preserved pending verified integrations.":"Fictional filings and peers for layout and calculation testing."}</p></details><p className="ci-note">Filing sources are real where linked; peer-specific EV/EBITDA, ROIC and normalized metrics are pending independent validation. No fabricated companies are included in real research outputs.</p></section><div className="ci-foot"><ShieldCheck size={15}/> SEC ANNUAL FINANCIALS WHERE AVAILABLE · CROSS-SOURCE VERIFICATION PARTIAL · NOT INVESTMENT ADVICE</div>
 </div>;
}
