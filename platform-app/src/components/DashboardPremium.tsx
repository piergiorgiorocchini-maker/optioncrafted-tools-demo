import {NavLink} from "react-router-dom";
import {ArrowRight,BarChart3,BookOpen,ChevronRight,CircleDot,Layers3,ShieldCheck,Target,TrendingUp,Wallet} from "lucide-react";
import type {Security,Tier} from "../core/contracts";
import "./dashboard.css";

const usd=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

export function DashboardPremium({company,tier}:{company:Security;tier:Tier}){
 const discount=((company.buyBelow/company.price)-1)*100;
 const marginOfSafety=(1-company.price/company.buyBelow)*100;
 const steps=[
  {number:"01",label:"Discover",detail:"Quality & screening",to:"/discover"},
  {number:"02",label:"Evaluate",detail:"Business fundamentals",to:"/company"},
  {number:"03",label:"Value",detail:"Intrinsic value models",to:"/valuation"},
  {number:"04",label:"Execute",detail:"Options & risk",to:"/options"}
 ];
 return <div className="premium-home">
  <section className="premium-hero">
   <div className="premium-hero-copy">
    <div className="premium-eyebrow"><CircleDot size={13}/> OPTIONSCRAFTED / RESEARCH TERMINAL <span className="premium-demo-chip">DEMO MODE</span></div>
    <h2>Investment intelligence.<br/><em>Engineered for decisions.</em></h2>
    <p>One connected workspace to discover quality businesses, estimate intrinsic value, manage risk and structure disciplined options strategies.</p>
    <div className="premium-hero-buttons"><NavLink className="premium-primary" to="/discover">Explore opportunities <ArrowRight size={16}/></NavLink><NavLink className="premium-outline" to="/valuation">Open Valuation Lab <ChevronRight size={15}/></NavLink></div>
   </div>
   <div className="premium-security-card">
    <div className="premium-security-top"><span>SECURITY IN FOCUS</span><span className="premium-ticker-chip">{company.ticker}</span></div>
    <h3>{company.name}</h3><p>{company.sector} · {company.currency} · Snapshot {company.snapshotDate}</p>
    <div className="premium-price-line"><span>Reference price</span><strong>{usd(company.price)}</strong></div>
    <div className="premium-price-line"><span>Buy-under level*</span><strong>{usd(company.buyBelow)}</strong></div>
    <div className="premium-price-line"><span>ROIC*</span><strong>{company.roic.toFixed(1)}%</strong></div>
    <div className="premium-security-foot">* Illustrative inputs, not live investment signals.</div>
   </div>
  </section>

  <section className="premium-kpi-row" aria-label="Security financial snapshot">
   <div className="premium-kpi"><div className="premium-kpi-label"><BarChart3 size={16}/> PRICE / BUY-UNDER GAP</div><strong className={discount<0?"premium-negative":"premium-positive"}>{discount>0?"+":""}{discount.toFixed(1)}%</strong><p>Difference from model buy-under level</p></div>
   <div className="premium-kpi"><div className="premium-kpi-label"><Target size={16}/> MARGIN OF SAFETY</div><strong>{marginOfSafety.toFixed(1)}%</strong><p>Reference price versus buy-under level</p></div>
   <div className="premium-kpi"><div className="premium-kpi-label"><TrendingUp size={16}/> EARNINGS / SHARE</div><strong>{usd(company.eps)}</strong><p>Illustrative fundamental snapshot</p></div>
   <div className="premium-kpi"><div className="premium-kpi-label"><Wallet size={16}/> FREE CASH FLOW / SHARE</div><strong>{usd(company.fcfPerShare)}</strong><p>Illustrative fundamental snapshot</p></div>
  </section>

  <div className="premium-sections">
   <section className="premium-workflow premium-surface">
    <div className="premium-section-heading"><div><div className="premium-section-overline">CONNECTED ANALYSIS</div><h3>From research to execution</h3><p>The selected company follows you through every module.</p></div><span className="premium-mini-tag">{tier.toUpperCase()} PREVIEW</span></div>
    <div className="premium-steps">{steps.map((step,i)=><NavLink className="premium-step" to={step.to} key={step.number}><span className="premium-step-index">{step.number}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div>{i<steps.length-1?<ChevronRight size={16}/>:<ArrowRight size={16}/>}</NavLink>)}</div>
    <div className="premium-note"><ShieldCheck size={16}/><span>Architecture preview. Financial models will be integrated and validated separately.</span></div>
   </section>
   <section className="premium-toolbox premium-surface">
    <div className="premium-section-overline">QUICK ACCESS</div><h3>Research modules</h3><div className="premium-tool-list">
     <NavLink to="/company"><Layers3 size={19}/><span><strong>Company Intelligence</strong><small>Fundamentals, quality and peers</small></span><ArrowRight size={15}/></NavLink>
     <NavLink to="/valuation"><Target size={19}/><span><strong>Valuation Lab</strong><small>DCF, fair value and scenarios</small></span><ArrowRight size={15}/></NavLink>
     <NavLink to="/options"><BarChart3 size={19}/><span><strong>Options Lab</strong><small>CSP, covered calls and Wheel</small></span><ArrowRight size={15}/></NavLink>
     <NavLink to="/academy"><BookOpen size={19}/><span><strong>The Option Edge</strong><small>Learning & premium products</small></span><ArrowRight size={15}/></NavLink>
    </div></section>
  </div>
  <div className="premium-disclaimer">ILLUSTRATIVE DATA · NO LIVE FEED · NO VERIFIED VALUATION OUTPUTS · NOT INVESTMENT ADVICE</div>
 </div>;
}
