import {NavLink} from "react-router-dom";
import {BarChart3,BookOpen,ChevronRight,Layers3,Target,TrendingUp,Wallet,Star,ShieldCheck,ArrowUpRight,Activity} from "lucide-react";
import type {Security,Tier} from "../core/contracts";
import "./dashboard.css";
const money=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
const universe=[
 {ticker:"DEMO",name:"Illustrative Dividend Company",sector:"Industrials",roic:16.2,price:30.50,buy:26.85},
 {ticker:"ALPHA",name:"Illustrative Quality Business",sector:"Technology",roic:22.3,price:72.40,buy:64.20},
 {ticker:"BETA",name:"Illustrative Defensive Business",sector:"Consumer Staples",roic:12.4,price:48.80,buy:46.30}
];
const portfolio=[{name:"Core Quality",kind:"Business quality",goal:"Quality-focused allocation"},{name:"Income & Options",kind:"Options overlay",goal:"Income-oriented strategies"},{name:"Opportunity Watch",kind:"Research list",goal:"Potential valuation entries"}];
function DemoLabel(){return <span className="mock-demo-tag">SIMULATED / NO LIVE DATA</span>}
export function DashboardPremium({company,tier}:{company:Security;tier:Tier}){
 const gap=(company.buyBelow/company.price-1)*100;
 return <div className="mock-dashboard">
  <header className="mock-welcome"><div><div className="mock-section-label">INVESTMENT COMMAND CENTER</div><h2>Good to see you. <span>Let's find your next opportunity.</span></h2><p>Quality, valuation and options execution in one connected research workspace.</p></div><DemoLabel/></header>
  <div className="mock-summary">
    <article className="mock-stat"><div className="mock-stat-title"><Activity size={19}/> MARKET REGIME</div><div className="mock-stat-value">Not connected</div><p>Macro conditions will be sourced from verified datasets.</p><span className="mock-stat-foot">Future Macro Intelligence</span></article>
    <article className="mock-stat"><div className="mock-stat-title"><Layers3 size={19}/> SCREENING UNIVERSE</div><div className="mock-stat-value">3 <small>securities</small></div><p>Illustrative companies available for exploration.</p><NavLink to="/discover">Open Explorer <ArrowUpRight size={14}/></NavLink></article>
    <article className="mock-stat"><div className="mock-stat-title"><Star size={19}/> WATCHLIST</div><div className="mock-stat-value">3 <small>sample assets</small></div><p>Reference universe, not saved user positions.</p><span className="mock-stat-foot">Sample workspace</span></article>
    <article className="mock-stat"><div className="mock-stat-title"><Target size={19}/> RESEARCH SIGNALS</div><div className="mock-stat-value">Not scored</div><p>Signals require validated valuation and risk models.</p><NavLink to="/valuation">Valuation Lab <ArrowUpRight size={14}/></NavLink></article>
  </div>
  <div className="mock-feature-grid">
   <section className="mock-panel"><header className="mock-panel-header"><h3><Star size={18}/> Research watchlist</h3><NavLink to="/discover">View all <ChevronRight size={15}/></NavLink></header><div className="mock-table-scroll"><table className="mock-table"><thead><tr><th>Symbol</th><th>Company</th><th>Price*</th><th>ROIC*</th><th>Buy-under*</th><th>Gap*</th></tr></thead><tbody>{universe.map(item=><tr key={item.ticker} className={company.ticker===item.ticker?"mock-active-row":""}><td><strong>{item.ticker}</strong></td><td>{item.name}</td><td>{money(item.price)}</td><td>{item.roic.toFixed(1)}%</td><td>{money(item.buy)}</td><td className="mock-neg">{((item.buy/item.price-1)*100).toFixed(1)}%</td></tr>)}</tbody></table></div><p className="mock-panel-note">* Artificial financial data for interface testing. Select the active ticker using the security selector above.</p></section>
   <section className="mock-panel"><header className="mock-panel-header"><h3><BarChart3 size={18}/> Valuation snapshot</h3><NavLink to="/valuation">View Lab <ChevronRight size={15}/></NavLink></header><div className="mock-valuation"><div><span>Active security</span><strong>{company.ticker}</strong><small>{company.name}</small></div><div className="mock-valuation-pair"><span>Reference price <b>{money(company.price)}</b></span><span>Buy-under* <b>{money(company.buyBelow)}</b></span></div><div className="mock-valu-track"><span style={{width:`${Math.max(6,Math.min(100,company.price/company.buyBelow*72))}%`}}/></div><div className="mock-valu-gap"><span>Buy-under / price gap*</span><strong className={gap<0?"mock-neg":"mock-pos"}>{gap.toFixed(1)}%</strong></div></div><p className="mock-panel-note">* Illustrative model target, not a computed fair value or trading signal.</p></section>
  </div>
  <div className="mock-lower-grid">
   <section className="mock-panel"><header className="mock-panel-header"><h3><Wallet size={18}/> Model portfolios</h3><NavLink to="/portfolio">Portfolio Studio <ChevronRight size={15}/></NavLink></header><div className="mock-portfolios">{portfolio.map((p,i)=><div key={p.name} className="mock-portfolio"><span className="mock-round">{i+1}</span><div><b>{p.name}</b><small>{p.goal}</small></div><em>{p.kind}</em></div>)}</div><p className="mock-panel-note">Concept portfolios: no holdings, historical returns, or simulations have been verified.</p></section>
   <section className="mock-panel"><header className="mock-panel-header"><h3><TrendingUp size={18}/> Your research workflow</h3><NavLink to="/company">Company Intelligence <ChevronRight size={15}/></NavLink></header><div className="mock-workflow">{[{label:"01 · Quality",desc:"Inspect fundamentals",url:"/company"},{label:"02 · Value",desc:"Review valuation assumptions",url:"/valuation"},{label:"03 · Execution",desc:"Plan an option strategy",url:"/options"}].map(x=><NavLink to={x.url} key={x.label}><b>{x.label}</b><span>{x.desc}</span><ChevronRight size={14}/></NavLink>)}</div></section>
   <section className="mock-panel"><header className="mock-panel-header"><h3><BookOpen size={18}/> Research & learning</h3><NavLink to="/research">Research Library <ChevronRight size={15}/></NavLink></header><div className="mock-research"><div><span className="mock-pill">EDUCATION</span><b>The Option Edge</b><p>Course concept. Access and content integration are planned.</p></div><div><span className="mock-pill">RESEARCH</span><b>Independent analysis</b><p>Reports and contributor publications will be connected later.</p></div></div></section>
  </div>
  <footer className="mock-data-footer"><ShieldCheck size={14}/> Preview tier: {tier.toUpperCase()} · Demo data only · No live markets, user accounts, backtests or validated performance.</footer>
 </div>
}