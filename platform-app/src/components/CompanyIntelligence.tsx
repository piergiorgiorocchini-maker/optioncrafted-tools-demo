import {NavLink} from "react-router-dom";
import {ArrowRight,Building2,ChartNoAxesCombined,ShieldCheck,Target,TrendingUp} from "lucide-react";
import type {Security} from "../core/contracts";import type {RealAsset} from "./RealResearch";
import "./company.css";import {FinancialCharts} from "./FinancialCharts";import appleResearch from "../data/aaplResearch.json";
const fmt=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v);
export function CompanyIntelligence({company,asset}:{company:Security;asset?:RealAsset}){
 const apple=asset?.ticker==="AAPL";const appleFcf=apple?appleResearch.fcfPerShare:null; const real=Boolean(asset);const name=asset?.name??company.name;const symbol=asset?.ticker??company.ticker;const sector=asset?.sector??company.sector;const currency=asset?.currency??company.currency;const referencePrice=asset?.price??(real?null:company.price);const earnings=asset?.eps??(real?null:company.eps);const show=(n:number|null,suffix="")=>n===null?"N/D":n.toFixed(2)+suffix;const showMoney=(n:number|null)=>n===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD"}).format(n);
 const earningsYield=company.eps/company.price*100;
 const fcfYield=company.fcfPerShare/company.price*100;
 const gap=(company.buyBelow/company.price-1)*100;
 const demoSeries=[.69,.75,.81,.88,1].map((factor,i)=>({period:String(2022+i),revenue:Math.round(100*factor),fcf:Math.round(100*factor*(1.04+i*.012))}));
 return <div className="ci">
  <section className="ci-head"><div><div className="ci-overline">EQUITY RESEARCH / COMPANY INTELLIGENCE</div><h2>{name}</h2><p><b>{symbol}</b> · {sector} · {currency} · {real?"Google Sheets snapshot 2026-10-28":"Demo snapshot "+company.snapshotDate}</p></div><span className="ci-demo">{real?"REAL SNAPSHOT + LAB PREVIEW":"ILLUSTRATIVE FINANCIALS"}</span></section>
  <section className="ci-metrics">
   <article><span><Building2 size={16}/> REFERENCE PRICE</span><strong>{showMoney(referencePrice)}</strong><small>{real?"Google Sheets · snapshot":"Historical-style demo input"}</small></article>
   <article><span><TrendingUp size={16}/> RETURN ON INVESTED CAPITAL</span><strong>{apple?appleResearch.roic.toFixed(1)+"%":real?"N/D":company.roic.toFixed(1)+"%"}</strong><small>{real?"Awaiting validated financials":"Provided sample ratio"}</small></article>
   <article><span><ChartNoAxesCombined size={16}/> FREE CASH FLOW YIELD</span><strong>{apple&&referencePrice!==null?(appleFcf!/referencePrice*100).toFixed(2)+"%":real?"N/D":fcfYield.toFixed(2)+"%"}</strong><small>{real?"FCF data pending":"Derived from demo FCF/share ÷ price"}</small></article>
   <article><span><Target size={16}/> EARNINGS YIELD</span><strong>{real?(earnings!==null&&referencePrice!==null&&referencePrice>0?show(earnings/referencePrice*100,"%"):"N/D"):earningsYield.toFixed(2)+"%"}</strong><small>{real?"Computed from snapshot EPS / price":"Derived from demo EPS ÷ price"}</small></article>
  </section>
  <FinancialCharts asset={asset} company={company}/>
  <div className="ci-main">
   <section className="ci-panel"><div className="ci-panel-head"><h3>Financial overview</h3><span>{real?"Real partial snapshot":"Sample snapshot"}</span></div><div className="ci-fundamentals">
    <div><span>Earnings per share</span><b>{showMoney(earnings)}</b></div>
    <div><span>Free cash flow per share</span><b>{apple?showMoney(appleFcf):real?"N/D":fmt(company.fcfPerShare)}</b></div>
    <div><span>FCF / EPS conversion</span><b>{apple&&earnings!==null?(appleFcf!/earnings*100).toFixed(1)+"%":real?"N/D":(company.fcfPerShare/company.eps*100).toFixed(1)+"%"}</b></div>
    <div><span>Return on invested capital</span><b>{apple?appleResearch.roic.toFixed(1)+"%":real?"N/D":company.roic.toFixed(1)+"%"}</b></div>
    <div><span>Sector</span><b>{sector}</b></div>
    <div><span>Financial data status</span><b className="ci-warning">{real?"Partial snapshot":"Simulated"}</b></div>
   </div><p className="ci-note">{apple?"Price and EPS from Sheets; FCF/share and financial history reconstructed from Apple SEC filings (TTM Jun 2026). ROIC calculated on gross invested capital, cash-inclusive; see SEC methodology.":real?"Snapshot fields from Google Sheets; other fundamental data pending.":"Demo financials."}</p></section>
   <section className="ci-panel"><div className="ci-panel-head"><h3>Quality lens</h3><span>Interpretation framework</span></div>
    <div className="ci-quality"><div className="ci-quality-line"><span>Capital efficiency</span><strong>{apple?appleResearch.roic.toFixed(1)+"% ROIC (gross)":real?"N/D":company.roic.toFixed(1)+"% ROIC*"}</strong></div><div className="ci-bar"><span style={{width:`${apple?Math.min(100,appleResearch.roic):real?0:Math.min(100,Math.max(0,company.roic/25*100))}%`}}/></div>
    <div className="ci-quality-line"><span>Cash earnings conversion</span><strong>{apple&&earnings!==null?(appleFcf!/earnings*100).toFixed(1)+"%":real?"N/D":(company.fcfPerShare/company.eps*100).toFixed(1)+"%*"}</strong></div><div className="ci-bar"><span style={{width:`${real?0:Math.min(100,Math.max(0,company.fcfPerShare/company.eps*70))}%`}}/></div>
    <div className="ci-quality-line"><span>Leverage / balance-sheet risk</span><strong>Data required</strong></div><div className="ci-bar ci-empty"></div></div>
    <p className="ci-note">* Ratios use unverified sample data. Quality scores remain disabled until sector-specific definitions and financial statement sources are established.</p></section>
   <section className="ci-panel ci-wide"><div className="ci-panel-head"><h3>From quality to valuation</h3><span>Connected workflow</span></div>
    <div className="ci-next"><div><span>{real?"Investor entry target":"Illustrative buy-under target"}</span><strong>{real?"Pending":fmt(company.buyBelow)}</strong><small>{real?"Requires valuation assumptions":"Gap versus price: "+gap.toFixed(1)+"%"}</small></div><p>Review business fundamentals, select an appropriate valuation model, and carry the same ticker into the Options Lab. Current buy-under values are illustrative inputs, not computed fair values.</p><NavLink to="/valuation">Continue to Valuation Lab <ArrowRight size={16}/></NavLink></div>
   </section>
  </div><section className="ci-panel ci-wide"><div className="ci-panel-head"><h3>SEC Filings & Trading Comparables</h3><span>INTERACTIVE DESIGN PREVIEW</span></div><p className="ci-note">{real?"The model below uses fictional DEMO companies, not financial data for "+symbol+". Layout and peer-filter interactions remain available while verified integrations are built.":"Fictional filings and peers for layout and calculation testing."}</p></section>{apple?<div className="ci-panel ci-wide"><div className="ci-panel-head"><h3>SEC Filings & Trading Comparables</h3><span>REAL FILINGS · PEER ENGINE PENDING</span></div><p><a href={appleResearch.sourceUrls[0]} target="_blank" rel="noreferrer">Apple FY2025 10-K</a> · <a href={appleResearch.sourceUrls[1]} target="_blank" rel="noreferrer">Apple Q3 FY2026 10-Q</a></p><p className="ci-note">Filing sources are real; peer-specific EV/EBITDA, ROIC and normalized metrics are not populated until verified. No fabricated companies are included.</p></div>:null}<div className="ci-foot"><ShieldCheck size={15}/> AAPL SEC FINANCIALS VERIFIED · ROIC AND ADJUSTED PEER METRICS PENDING · NOT INVESTMENT ADVICE</div>
 </div>;
}
