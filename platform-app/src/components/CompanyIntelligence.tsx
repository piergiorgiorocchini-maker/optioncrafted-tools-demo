import {NavLink} from "react-router-dom";
import {ArrowRight,Building2,ChartNoAxesCombined,ShieldCheck,Target,TrendingUp} from "lucide-react";
import type {Security} from "../core/contracts";
import "./company.css";import {FilingPeers} from "./FilingPeers";
const fmt=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v);
export function CompanyIntelligence({company}:{company:Security}){
 const earningsYield=company.eps/company.price*100;
 const fcfYield=company.fcfPerShare/company.price*100;
 const gap=(company.buyBelow/company.price-1)*100;
 const demoSeries=[.69,.75,.81,.88,1].map((factor,i)=>({period:String(2022+i),revenue:Math.round(100*factor),fcf:Math.round(100*factor*(1.04+i*.012))}));
 return <div className="ci">
  <section className="ci-head"><div><div className="ci-overline">EQUITY RESEARCH / COMPANY INTELLIGENCE</div><h2>{company.name}</h2><p><b>{company.ticker}</b> · {company.sector} · {company.currency} · Snapshot: {company.snapshotDate}</p></div><span className="ci-demo">ILLUSTRATIVE FINANCIALS</span></section>
  <section className="ci-metrics">
   <article><span><Building2 size={16}/> REFERENCE PRICE</span><strong>{fmt(company.price)}</strong><small>Historical-style demo input</small></article>
   <article><span><TrendingUp size={16}/> RETURN ON INVESTED CAPITAL</span><strong>{company.roic.toFixed(1)}%</strong><small>Provided sample ratio</small></article>
   <article><span><ChartNoAxesCombined size={16}/> FREE CASH FLOW YIELD</span><strong>{fcfYield.toFixed(2)}%</strong><small>Derived from demo FCF/share ÷ price</small></article>
   <article><span><Target size={16}/> EARNINGS YIELD</span><strong>{earningsYield.toFixed(2)}%</strong><small>Derived from demo EPS ÷ price</small></article>
  </section>
  <div className="ci-main">
   <section className="ci-panel"><div className="ci-panel-head"><h3>Financial overview</h3><span>Sample snapshot</span></div><div className="ci-fundamentals">
    <div><span>Earnings per share</span><b>{fmt(company.eps)}</b></div>
    <div><span>Free cash flow per share</span><b>{fmt(company.fcfPerShare)}</b></div>
    <div><span>FCF / EPS conversion</span><b>{(company.fcfPerShare/company.eps*100).toFixed(1)}%</b></div>
    <div><span>Return on invested capital</span><b>{company.roic.toFixed(1)}%</b></div>
    <div><span>Sector</span><b>{company.sector}</b></div>
    <div><span>Financial data status</span><b className="ci-warning">Simulated</b></div>
   </div><p className="ci-note">Figures are constructed for UI testing, not extracted from company filings. ROIC has not been independently recalculated.</p></section>
   <section className="ci-panel"><div className="ci-panel-head"><h3>Quality lens</h3><span>Interpretation framework</span></div>
    <div className="ci-quality"><div className="ci-quality-line"><span>Capital efficiency</span><strong>{company.roic.toFixed(1)}% ROIC*</strong></div><div className="ci-bar"><span style={{width:`${Math.min(100,Math.max(0,company.roic/25*100))}%`}}/></div>
    <div className="ci-quality-line"><span>Cash earnings conversion</span><strong>{(company.fcfPerShare/company.eps*100).toFixed(1)}%*</strong></div><div className="ci-bar"><span style={{width:`${Math.min(100,Math.max(0,company.fcfPerShare/company.eps*70))}%`}}/></div>
    <div className="ci-quality-line"><span>Leverage / balance-sheet risk</span><strong>Data required</strong></div><div className="ci-bar ci-empty"></div></div>
    <p className="ci-note">* Ratios use unverified sample data. Quality scores remain disabled until sector-specific definitions and financial statement sources are established.</p></section>
   <section className="ci-panel ci-wide"><div className="ci-panel-head"><h3>Financial trend visualization</h3><span>Indexed illustration · 2022 = 69</span></div>
    <div className="ci-bars">{demoSeries.map((v)=><div className="ci-year" key={v.period}><div className="ci-twin"><span title={`Illustrative revenue index ${v.revenue}`} style={{height:`${v.revenue}%`}}/><span title={`Illustrative FCF index ${v.fcf}`} style={{height:`${Math.min(v.fcf,110)/1.1}%`}}/></div><strong>{v.period}</strong></div>)}</div>
    <div className="ci-legend"><span>■ Revenue (indexed)</span><span>■ Free cash flow (indexed)</span></div><p className="ci-note">The series is intentionally artificial for layout testing, not an actual financial history or growth forecast.</p>
   </section>
   <section className="ci-panel ci-wide"><div className="ci-panel-head"><h3>From quality to valuation</h3><span>Connected workflow</span></div>
    <div className="ci-next"><div><span>Illustrative buy-under target</span><strong>{fmt(company.buyBelow)}</strong><small>Gap versus price: {gap.toFixed(1)}%</small></div><p>Review business fundamentals, select an appropriate valuation model, and carry the same ticker into the Options Lab. Current buy-under values are illustrative inputs, not computed fair values.</p><NavLink to="/valuation">Continue to Valuation Lab <ArrowRight size={16}/></NavLink></div>
   </section>
  </div><FilingPeers company={company}/><div className="ci-foot"><ShieldCheck size={15}/> DEMO ONLY · NO VERIFIED FILINGS, PEER DATA, FAIR VALUES OR INVESTMENT RECOMMENDATIONS</div>
 </div>;
}
