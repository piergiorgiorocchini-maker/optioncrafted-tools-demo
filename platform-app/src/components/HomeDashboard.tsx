import {useEffect,useMemo,useState} from "react";
import {NavLink} from "react-router-dom";
import {Activity,ArrowDownRight,ArrowRight,ArrowUpRight,BookOpen,BriefcaseBusiness,ChartNoAxesCombined,Compass,Layers3,Plus,Search,Shield,Target,Trash2,Wallet} from "lucide-react";
import snapshot from "../data/assetsSnapshot.json";
import type {RealAsset} from "./RealResearch";
import type {ValuationBridge} from "./ValuationWorkspace";
import {verifiedFcf} from "../data/verifiedFinancials";
import {dcfModel,modelDefaults,money} from "../core/valuationModels";
import "./home-dashboard.css";

const watchKey="optionscrafted.watchlist.v1";
const portfolioKey="optionscrafted.portfolio.v1";
const indexRecord=(ticker:string)=>snapshot.records.find(a=>a.ticker===ticker)??null;
const numberFormat=new Intl.NumberFormat("en-US",{maximumFractionDigits:2});
const returnText=(v:number|null)=>v===null?"N/D":`${v>=0?"+":""}${(v*100).toFixed(2)}%`;
const returnTone=(v:number|null)=>v===null?"home-return-missing":v>=0?"home-return-positive":"home-return-negative";
const getMoney=(v:number|null,currency="USD")=>v===null? "N/D":money(v,currency);
const savedList=(key:string):unknown=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};
function MarketQuote({label,ticker,format}:{label:string;ticker:string;format:"money"|"index"}){
 const asset=indexRecord(ticker);
 return <div className="home-market-quote"><span>{label}</span><small>{asset?.priceDate??"Date N/D"}</small><strong>{asset&&asset.price!==null?format==="money"?getMoney(asset.price,asset.currency):numberFormat.format(asset.price):"N/D"}</strong><b className={returnTone(asset?.change1d??null)}>{returnText(asset?.change1d??null)}</b></div>;
}
export function MarketTape(){
 return <div className="terminal-market-tape" aria-label="Market indicators">
  <MarketQuote label="S&P 500 · SPY" ticker="SPY" format="money"/>
  <MarketQuote label="Nasdaq Composite" ticker="INDEXNASDAQ:.IXIC" format="index"/>
  <MarketQuote label="VIX" ticker="VIX" format="index"/>
 </div>;
}
export function HomeDashboard({ticker,asset,name,valuation,onSelect}:{ticker:string;asset:RealAsset|null;name:string;valuation?:ValuationBridge;onSelect:(ticker:string)=>void}){
 const [watchlist,setWatchlist]=useState<string[]>([]);
 const [positionCount,setPositionCount]=useState(0);
 const [portfolioValue,setPortfolioValue]=useState<number|null>(null);
 const [notice,setNotice]=useState("");
 const macroRegime="Risk-on";
 useEffect(()=>{
  const raw=savedList(watchKey),items=Array.isArray(raw)?raw.filter((x):x is string=>typeof x==="string"):[];
  setWatchlist([...new Set(items)]);
  const positions=savedList(portfolioKey);
  if(Array.isArray(positions)){
   const valid=positions.filter((p):p is {ticker:string;shares:number}=>!!p&&typeof p.ticker==="string"&&Number.isFinite(p.shares));
   setPositionCount(valid.length);
   setPortfolioValue(valid.reduce((sum,p)=>sum+(indexRecord(p.ticker)?.price??0)*p.shares,0));
  }
 },[]);
 const fcf=verifiedFcf(ticker);
 const defaultDcf=useMemo(()=>dcfModel(fcf.perShare,modelDefaults.growth,modelDefaults.discount,modelDefaults.terminal,modelDefaults.years),[fcf.perShare]);
 const intrinsic=valuation?.fairValue??defaultDcf?.value??null;
 const buyUnder=valuation?.buyUnder??(intrinsic===null?null:intrinsic*(1-modelDefaults.mos/100));
 const marketPrice=asset?.price??null;
 const gap=intrinsic!==null&&intrinsic>0&&marketPrice!==null&&marketPrice>0?marketPrice/intrinsic-1:null;
 const valuationBasis=valuation?.source??(defaultDcf?"Default DCF scenario":"Data required");
 const vix=indexRecord("VIX");
 const addToWatchlist=()=>{
  if(watchlist.includes(ticker)){setNotice(ticker+" is already in your watchlist.");return}
  const next=[...watchlist,ticker];setWatchlist(next);try{localStorage.setItem(watchKey,JSON.stringify(next))}catch{}
  setNotice(ticker+" added to your watchlist.");
 };
 const removeFromWatchlist=(symbol:string)=>{
  const next=watchlist.filter(x=>x!==symbol);setWatchlist(next);try{localStorage.setItem(watchKey,JSON.stringify(next))}catch{}
  setNotice(symbol+" removed from your watchlist.");
 };
 const watchRows=watchlist.map(symbol=>{const a=indexRecord(symbol);return {symbol,name:a?.name??symbol,price:a?.price??null,date:a?.priceDate??null,currency:a?.currency??"USD",change1d:a?.change1d??null,changeYtd:a?.changeYtd??null}});
 const optionModules=[
  {title:"Cash-Secured Put",text:"Income while waiting for a preferred entry.",to:"/options/csp",icon:Activity},
  {title:"Covered Call",text:"Premium income on shares you hold.",to:"/options/covered-call",icon:ArrowUpRight},
  {title:"Wheel Strategy",text:"A two-step entry and income plan.",to:"/options/wheel",icon:Compass},
  {title:"Strategy Builder",text:"Compare multi-leg payoff scenarios.",to:"/options/strategy",icon:Layers3}
 ];
 return <div className="home-dashboard">
  <header className="home-welcome">
   <div className="home-welcome-copy"><span className="home-built-badge"><ChartNoAxesCombined size={14}/> BUILT FOR INDEPENDENT INVESTORS</span><h2>Your integrated options, research, and investing <b>workspace.</b></h2><p>Model options strategies, evaluate intrinsic value, build portfolios, and learn from connected research.</p></div>
   <div className="home-promise-points">
    <div><Activity size={20}/><span><strong>Smarter decisions</strong><small>Data-led research</small></span></div>
    <div><Layers3 size={20}/><span><strong>Complete workflow</strong><small>Research to execution</small></span></div>
    <div><BookOpen size={20}/><span><strong>Learn & grow</strong><small>Education at every level</small></span></div>
    <div><Compass size={20}/><span><strong>Independent investors</strong><small>Built for investors</small></span></div>
   </div>
  </header>
  <section className="home-kpis" aria-label="Market and account summary">
   <article className="home-kpi"><div><Activity size={17}/><span>MACRO REGIME</span></div><strong className="home-regime-value">{macroRegime}</strong><small>VIX {vix&&vix.price!==null?numberFormat.format(vix.price):"N/D"} · {vix?.priceDate??"date N/D"}</small></article>
   <article className="home-kpi"><div><Layers3 size={17}/><span>SCREENING UNIVERSE</span></div><strong>{snapshot.records.length} <em>assets</em></strong><small>Prices as of {snapshot.exportedAt}</small></article>
   <article className="home-kpi"><div><Target size={17}/><span>WATCHLIST</span></div><strong>{watchlist.length} <em>{watchlist.length===1?"security":"securities"}</em></strong><small>Saved in this browser</small></article>
   <article className="home-kpi"><div><Wallet size={17}/><span>PORTFOLIO</span></div><strong>{positionCount} <em>{positionCount===1?"position":"positions"}</em></strong><small>{portfolioValue===null?"Open Portfolio Studio":getMoney(portfolioValue)+" · snapshot value"}</small></article>
  </section>
  <section className="home-feature-grid">
   <article className="home-card home-options-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">OPTIONS STRATEGY WORKSPACE</span><h3>Options Modeling & Wheel Engine</h3><p>Choose a strategy to model it against the selected security.</p></div><NavLink className="home-button home-button-primary" to="/options">Open Options Lab <ArrowRight size={15}/></NavLink></header>
    <div className="home-strategy-grid">{optionModules.map(({title,text,to,icon:Icon})=><NavLink className="home-strategy" to={to} key={title}><span className="home-strategy-icon"><Icon size={19}/></span><strong>{title}</strong><small>{text}</small><span className="home-strategy-open">Open module <ArrowRight size={13}/></span></NavLink>)}</div>
    <div className="home-underlying"><div><span>UNDERLYING IN FOCUS</span><strong>{ticker} · {name}</strong></div><div><span>REFERENCE PRICE · {asset?.priceDate??"N/D"}</span><strong>{getMoney(marketPrice,asset?.currency)}</strong></div><NavLink to="/valuation/dcf">Review intrinsic value →</NavLink></div>
    <p className="home-data-note">Option premiums and chains are not live. Review the model inputs in Options Lab before using a scenario.</p>
   </article>
   <article className="home-card home-valuation-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">PRICE VS. VALUE</span><h3>{name} · {ticker}</h3><p>DCF base scenario · per share</p></div><button type="button" className="home-add-watch" onClick={addToWatchlist} aria-label={"Add "+ticker+" to watchlist"}><Plus size={16}/></button></header>
    <div className="home-value-pair"><div><span>Market price</span><strong>{getMoney(marketPrice,asset?.currency)}</strong></div><div><span>DCF estimate</span><strong>{getMoney(intrinsic,asset?.currency)}</strong></div></div>
    <div className={"home-upside "+(gap===null?"":gap>=0?"positive":"negative")}><span>{gap===null?"Valuation comparison unavailable":gap>=0?"Market price above DCF":"Market price below DCF"}</span><strong>{gap===null?"N/D":(gap>=0?"+":"")+(gap*100).toFixed(1)+"%"}</strong>{gap===null?null:gap>=0?<ArrowUpRight size={17}/>:<ArrowDownRight size={17}/>}</div>
    <div className="home-buy-under"><span>DCF buy-under · {modelDefaults.mos}% margin of safety</span><strong>{getMoney(buyUnder,asset?.currency)}</strong></div>
    <small className="home-valuation-note">{valuationBasis} · FCF/share {getMoney(fcf.perShare,asset?.currency)} ({fcf.basis})</small>
    <NavLink className="home-card-link" to="/valuation/dcf">Open full valuation <ArrowRight size={14}/></NavLink>
    <div className="home-probability-teaser"><span className="home-probability-ring"><Target size={22}/></span><div><span className="home-eyebrow">PROBABILITY STATION</span><strong>Scenario inputs needed</strong><small>VIX {vix&&vix.price!==null?numberFormat.format(vix.price):"N/D"} · {vix?.priceDate??"date N/D"} · no option chain loaded</small><NavLink to="/options/probability">Open Probability Station <ArrowRight size={13}/></NavLink></div></div>
   </article>
  </section>
  <section className="home-ecosystem-grid" aria-label="Explore the OptionsCrafted workspace">
   <article className="home-card home-models-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">MODEL PORTFOLIOS</span><h3>Portfolios for different objectives</h3><p>Open Portfolio Studio to connect the researched portfolio frameworks.</p></div><BriefcaseBusiness size={19}/></header>
    <div className="home-model-list">
     <NavLink to="/portfolio"><span className="home-model-icon growth"><Activity size={16}/></span><span><strong>Free Core Portfolio</strong><small>Balanced, long-term equity allocation</small></span><ArrowRight size={14}/></NavLink>
     <NavLink to="/portfolio"><span className="home-model-icon income"><Wallet size={16}/></span><span><strong>Income Portfolio</strong><small>Dividend income and options overlay</small></span><ArrowRight size={14}/></NavLink>
     <NavLink to="/portfolio"><span className="home-model-icon options"><ChartNoAxesCombined size={16}/></span><span><strong>Advanced Options Income</strong><small>Options strategies for income generation</small></span><ArrowRight size={14}/></NavLink>
     <NavLink to="/portfolio"><span className="home-model-icon macro"><Compass size={16}/></span><span><strong>Liquid Macro</strong><small>Macro-aware, liquid allocation</small></span><ArrowRight size={14}/></NavLink>
    </div>
    <NavLink className="home-card-link" to="/portfolio">View portfolios <ArrowRight size={14}/></NavLink>
   </article>
   <article className="home-card home-screener-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">MARKET EXPLORER</span><h3>Find and evaluate securities</h3><p>Start with the current Google Sheets universe and continue into the research tools.</p></div><Layers3 size={19}/></header>
    <div className="home-tool-list">
     <NavLink to="/discover"><span className="home-tool-icon blue"><Search size={16}/></span><span><strong>Explore securities</strong><small>{snapshot.records.length} instruments · dated market snapshot</small></span><ArrowRight size={14}/></NavLink>
     <NavLink to="/company"><span className="home-tool-icon green"><BriefcaseBusiness size={16}/></span><span><strong>Company Intelligence</strong><small>Review company fundamentals and financials</small></span><ArrowRight size={14}/></NavLink>
     <NavLink to="/valuation"><span className="home-tool-icon violet"><ChartNoAxesCombined size={16}/></span><span><strong>Price vs. intrinsic value</strong><small>Compare market price with valuation scenarios</small></span><ArrowRight size={14}/></NavLink>
     <NavLink to="/options/probability"><span className="home-tool-icon orange"><Target size={16}/></span><span><strong>Probability Station</strong><small>Run a scenario when model inputs are available</small></span><ArrowRight size={14}/></NavLink>
    </div>
   </article>
   <article className="home-card home-library-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">RESEARCH & KNOWLEDGE</span><h3>Research Library</h3><p>Research, education, and strategy guidance in one place.</p></div><BookOpen size={19}/></header>
    <div className="home-library-feature"><span className="home-library-mark"><BookOpen size={20}/></span><div><strong>Research & Insights</strong><small>Internal research, articles, and company notes</small></div></div>
    <div className="home-research-links"><NavLink to="/research">Research & articles <ArrowRight size={14}/></NavLink><NavLink to="/academy">Education & courses <ArrowRight size={14}/></NavLink><NavLink to="/options">Options strategies <ArrowRight size={14}/></NavLink></div>
   </article>
  </section>
  <section className="home-lower-grid">
   <article className="home-card home-watchlist-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">YOUR SECURITIES</span><h3>Watchlist</h3></div><NavLink to="/discover">Find securities <ArrowRight size={14}/></NavLink></header>
    {watchRows.length? <div className="home-table-wrap"><table className="home-watch-table"><thead><tr><th>Security</th><th>Price</th><th>1D %</th><th>YTD %</th><th>Snapshot date</th><th></th></tr></thead><tbody>{watchRows.map(row=><tr key={row.symbol}><td><button type="button" className="home-ticker-link" onClick={()=>onSelect(row.symbol)}><strong>{row.symbol}</strong><small>{row.name}</small></button></td><td>{getMoney(row.price,row.currency)}</td><td className={returnTone(row.change1d)}>{returnText(row.change1d)}</td><td className={returnTone(row.changeYtd)}>{returnText(row.changeYtd)}</td><td>{row.date??"N/D"}</td><td><button type="button" className="home-remove-watch" onClick={()=>removeFromWatchlist(row.symbol)} aria-label={"Remove "+row.symbol+" from watchlist"}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>:<div className="home-empty-watch"><Target size={21}/><strong>Your watchlist is ready</strong><p>Add {ticker} to track its reference price here.</p><button type="button" className="home-button home-button-primary" onClick={addToWatchlist}><Plus size={15}/> Add {ticker}</button></div>}
    <p className="home-inline-notice" role="status">{notice}</p>
   </article>
   <article className="home-card home-portfolio-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">ALLOCATION</span><h3>Portfolios & Portfolio Studio</h3></div><BriefcaseBusiness size={19}/></header>
    <p>Your researched portfolios can be connected here. Track positions and snapshot values in Portfolio Studio.</p>
    <div className="home-portfolio-summary"><strong>{positionCount}</strong><span>positions saved in this browser</span>{portfolioValue!==null&&<b>{getMoney(portfolioValue)} snapshot value</b>}</div>
    <NavLink className="home-card-link" to="/portfolio">Open Portfolio Studio <ArrowRight size={14}/></NavLink>
   </article>
   <article className="home-card home-research-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">YOUR WORKSPACE</span><h3>Quick access</h3></div><Compass size={19}/></header>
    <div className="home-shortcut-grid"><NavLink to="/options"><Activity size={18}/>Options Lab</NavLink><NavLink to="/portfolio"><BriefcaseBusiness size={18}/>Portfolio Studio</NavLink><NavLink to="/options/probability"><Target size={18}/>Probability Station</NavLink><NavLink to="/discover"><Search size={18}/>Market Explorer</NavLink></div>
   </article>
  </section>
  <footer className="home-footer"><Shield size={14}/> Market prices are dated reference values, not live quotes. DCF is a scenario estimate based on visible assumptions.</footer>
 </div>;
}