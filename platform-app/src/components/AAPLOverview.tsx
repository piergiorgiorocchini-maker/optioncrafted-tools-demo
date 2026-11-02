import {NavLink} from "react-router-dom";
import {verifiedAnnualHistory,verifiedFcf} from "../data/verifiedFinancials";
import type {RealAsset} from "./RealResearch";
import {BarChart3,BriefcaseBusiness,Search} from "lucide-react";

const money=(n:number|null)=>n===null||!Number.isFinite(n)?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const compactMoney=(n:number|null)=>n===null||!Number.isFinite(n)?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(n);
export function AAPLOverview({ticker,asset,name}:{ticker:string;asset:RealAsset|null;name:string}){
 const history=verifiedAnnualHistory(ticker),latest=history.at(-1),prior=history.at(-2),fcf=verifiedFcf(ticker);
 const eps=asset?.eps??latest?.eps??null,price=asset?.price??null;
 const growth=(latest?.revenue!==null&&latest?.revenue!==undefined&&prior?.revenue!==null&&prior?.revenue!==undefined&&prior.revenue!==0)?(latest.revenue/prior.revenue-1)*100:null;
 const cards=[
  ["REFERENCE PRICE",money(price),asset?.priceDate?"Market snapshot · "+asset.snapshotDate:"No price in snapshot"],
  ["EPS TTM",money(eps),"Per share · latest available"],
  ["FREE CASH FLOW / SHARE",money(fcf.perShare),fcf.perShare===null?"Unavailable for this company":fcf.basis],
  ["LATEST FISCAL YEAR",latest?"FY "+latest.year:"N/D",latest?.periodEnd?"Period ended "+latest.periodEnd:"SEC annual statements"]
 ];
 return <div className="investor-overview">
  <section className="hero wide"><div><span className="overline">INVESTMENT SNAPSHOT</span><h2>{name} · {ticker}</h2><p>A concise view of price, earnings and cash generation, with links to the research behind the next decision.</p><div className="hero-actions"><NavLink to="/company">Company fundamentals →</NavLink><NavLink to="/valuation/dcf">Review valuation →</NavLink></div></div><div className="hero-symbol"><span>SECURITY IN FOCUS</span><strong>{ticker}</strong><small>{asset?.sector||"SEC annual fundamentals"}</small></div></section>
  <section className="workflow-grid investor-metrics">{cards.map(([label,value,detail])=><article key={label} className="workflow-step"><span>{label}</span><h3>{value}</h3><p>{detail}</p></article>)}</section>
  <section className="panel wide investor-summary"><div><span className="overline">BUSINESS TREND</span><h2>{latest?.revenue!==null&&latest?.revenue!==undefined?compactMoney(latest.revenue)+" revenue in FY"+latest.year:"Annual revenue not available"}</h2><p>{growth===null?"A year-over-year comparison will appear when consecutive annual filings are available.":`Revenue changed ${growth>=0?"+":""}${growth.toFixed(1)}% from FY${prior!.year} to FY${latest!.year}.`} {latest?.fcf!==null&&latest?.fcf!==undefined?`Free cash flow was ${compactMoney(latest.fcf)} in the same fiscal year.`:"Free cash flow is not available for the latest fiscal year."}</p></div><div className="hero-actions"><NavLink to="/discover"><Search size={15}/> Find another security</NavLink><NavLink to="/portfolio"><BriefcaseBusiness size={15}/> Open portfolio</NavLink></div></section>
  <section className="panel wide investor-next"><div><span className="overline">YOUR RESEARCH PATH</span><h2>Start with the company, then compare value and risk.</h2><p>Review annual fundamentals, set your valuation assumptions, and add a security to a portfolio when you are ready.</p></div><div className="investor-next-links"><NavLink to="/company"><BarChart3 size={16}/> Review financial statements</NavLink><NavLink to="/valuation/dcf">Run a cash-flow valuation →</NavLink><NavLink to="/portfolio">Track this security in Portfolio Studio →</NavLink></div></section>
 </div>;
}