import {useEffect,useRef,useState} from "react";
import {NavLink} from "react-router-dom";
import {Activity,ArrowRight,ArrowUpRight,BookOpen,BriefcaseBusiness,CalendarDays,ChartNoAxesCombined,ExternalLink,GraduationCap,Layers3,Newspaper,Plus,Search,Shield,Target,Trash2,Wallet} from "lucide-react";
import snapshot from "../data/assetsSnapshot.json";
import {money} from "../core/valuationModels";
import {SecurityLogo} from "./SecurityLogo";
import "./home-dashboard.css";

const watchKey="optionscrafted.watchlist.v1";
const portfolioKey="optionscrafted.portfolio.v1";
const demoWatchKey="optionscrafted.demo.watchlist.v1";
const demoWatchVersionKey="optionscrafted.demo.watchlist.version";
const demoPortfolioKey="optionscrafted.demo.portfolio.v1";
const starterWatchlist=["AAPL","MSFT","GOOGL","JPM","AVGO","SPY"];
const starterPositions=[{ticker:"AAPL",shares:20,averageCost:290},{ticker:"MSFT",shares:8,averageCost:470},{ticker:"GOOGL",shares:12,averageCost:250},{ticker:"JPM",shares:15,averageCost:310},{ticker:"SPY",shares:25,averageCost:690}];
const indexRecord=(ticker:string)=>snapshot.records.find(a=>a.ticker===ticker)??null;
const numberFormat=new Intl.NumberFormat("en-US",{maximumFractionDigits:2});
const today=new Date();
const homeDateIso=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
const homeDateLabel=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric"}).format(today);
const returnText=(v:number|null)=>v===null?"N/D":`${v>=0?"+":""}${(v*100).toFixed(2)}%`;
const returnTone=(v:number|null)=>v===null?"home-return-missing":v>=0?"home-return-positive":"home-return-negative";
const getMoney=(v:number|null,currency="USD")=>v===null?"N/D":money(v,currency);
const savedList=(key:string):unknown=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};

const tradingViewAssets=[
 {sectionName:"U.S. indices & volatility",symbols:["FOREXCOM:SPXUSD","NASDAQ:IXIC","NASDAQ:NDX","CBOE:VIX"]},
 {sectionName:"U.S. Treasury yields",symbols:["TVC:US02Y","TVC:US10Y","TVC:US30Y"]},
 {sectionName:"Major stocks",symbols:["NASDAQ:NVDA","NASDAQ:AAPL","NASDAQ:MSFT","NASDAQ:AMZN"]}
];
const tradingViewMarketAttributes={"symbol-sectors":JSON.stringify(tradingViewAssets),theme:"light"};
const tradingViewLightAttributes={theme:"light"};
const tradingViewYieldAttributes={symbol:"TVC:US10Y-TVC:US02Y",interval:"1D",theme:"light"};

const tvWidgetPromises=new Map<string,Promise<void>>();
function loadTradingViewWidget(tag:string,source:string):Promise<void>{
 if(customElements.get(tag))return Promise.resolve();
 const existing=tvWidgetPromises.get(tag);
 if(existing)return existing;
 const pending=new Promise<void>((resolve,reject)=>{
  const script=document.createElement("script");
  script.type="module";
  script.src=source;
  script.async=true;
  script.onload=()=>customElements.get(tag)?resolve():reject(new Error("TradingView widget was not registered."));
  script.onerror=()=>reject(new Error("TradingView widget could not be loaded."));
  document.head.append(script);
 });
 tvWidgetPromises.set(tag,pending);
 pending.catch(()=>tvWidgetPromises.delete(tag));
 return pending;
}

function TradingViewEmbed({tag,source,attributes,link,label,className}:{tag:string;source:string;attributes:Record<string,string>;link:string;label:string;className?:string}){
 const containerRef=useRef<HTMLDivElement|null>(null);
 const [loadFailed,setLoadFailed]=useState(false);
 useEffect(()=>{
  let active=true;
  setLoadFailed(false);
  loadTradingViewWidget(tag,source).then(()=>{
   const container=containerRef.current;
   if(!active||!container)return;
   const widget=document.createElement(tag);
   Object.entries(attributes).forEach(([key,value])=>widget.setAttribute(key,value));
   widget.style.display="block";
   widget.style.width="100%";
   widget.style.height="100%";
   container.replaceChildren(widget);
  }).catch(()=>{
   if(active)setLoadFailed(true);
  });
  return ()=>{active=false;containerRef.current?.replaceChildren()};
 },[tag,source,attributes]);
 return <div ref={containerRef} className={"dashboard-tv-widget"+(className?" "+className:"")}>
  {loadFailed&&<div className="dashboard-widget-fallback"><p>{label} could not load in this preview.</p><a href={link} target="_blank" rel="noreferrer">Open on TradingView <ArrowUpRight size={13}/></a></div>}
 </div>;
}

export function MarketTape(){
 const quote=(label:string,ticker:string,format:"money"|"index")=>{
  const asset=indexRecord(ticker);
  return <div className="home-market-quote" key={ticker}><span>{label}</span><small>{asset?.priceDate??"Date N/D"}</small><strong>{asset&&asset.price!==null?format==="money"?getMoney(asset.price,asset.currency):numberFormat.format(asset.price):"N/D"}</strong><b className={returnTone(asset?.change1d??null)}>{returnText(asset?.change1d??null)}</b></div>;
 };
 return <div className="terminal-market-tape" aria-label="Market indicators">
  {quote("S&P 500 · SPY","SPY","money")}
  {quote("Nasdaq Composite","INDEXNASDAQ:.IXIC","index")}
  {quote("VIX","VIX","index")}
 </div>;
}
export {SecurityLogo} from "./SecurityLogo";

export function HomeDashboard({ticker,name,onSelect}:{ticker:string;name:string;onSelect:(ticker:string)=>void}){
 const [watchlist,setWatchlist]=useState<string[]>([]);
 const [positionCount,setPositionCount]=useState(0);
 const [portfolioValue,setPortfolioValue]=useState<number|null>(null);
 const [demoWatchlist,setDemoWatchlist]=useState(false);
 const [demoPortfolio,setDemoPortfolio]=useState(false);
 const [notice,setNotice]=useState("");

 useEffect(()=>{
  const existingWatchlist=localStorage.getItem(watchKey);
  const savedWatchlist=savedList(watchKey);
  const legacyAaplDemo=localStorage.getItem(demoWatchVersionKey)!=="2"&&Array.isArray(savedWatchlist)&&savedWatchlist.length===1&&savedWatchlist[0]==="AAPL";
  const isDemoWatchlist=existingWatchlist===null||localStorage.getItem(demoWatchKey)==="true"||legacyAaplDemo;
  const raw=isDemoWatchlist?starterWatchlist:savedWatchlist;
  const items=Array.isArray(raw)?raw.filter((x):x is string=>typeof x==="string"):[];
  if(isDemoWatchlist){try{localStorage.setItem(watchKey,JSON.stringify(starterWatchlist));localStorage.setItem(demoWatchKey,"true");localStorage.setItem(demoWatchVersionKey,"2")}catch{}}
  setWatchlist([...new Set(items)]);
  setDemoWatchlist(isDemoWatchlist&&items.length>0&&localStorage.getItem(demoWatchKey)==="true");

  const existingPortfolio=localStorage.getItem(portfolioKey);
  const isDemoPortfolio=existingPortfolio===null;
  const positions=isDemoPortfolio?starterPositions:savedList(portfolioKey);
  if(isDemoPortfolio){try{localStorage.setItem(portfolioKey,JSON.stringify(starterPositions));localStorage.setItem(demoPortfolioKey,"true")}catch{}}
  if(Array.isArray(positions)){
   const valid=positions.filter((p):p is {ticker:string;shares:number;averageCost:number}=>!!p&&typeof p.ticker==="string"&&Number.isFinite(p.shares));
   setPositionCount(valid.length);
   setPortfolioValue(valid.reduce((sum,p)=>sum+(indexRecord(p.ticker)?.price??0)*p.shares,0));
  }
  setDemoPortfolio(isDemoPortfolio&&Array.isArray(positions)&&positions.length>0&&localStorage.getItem(demoPortfolioKey)==="true");
 },[]);

 const addToWatchlist=()=>{
  if(watchlist.includes(ticker)){setNotice(ticker+" is already in your watchlist.");return}
  const next=[...watchlist,ticker];
  setWatchlist(next);setDemoWatchlist(false);
  try{localStorage.setItem(watchKey,JSON.stringify(next));localStorage.removeItem(demoWatchKey)}catch{}
  setNotice(ticker+" added to your watchlist.");
 };
 const removeFromWatchlist=(symbol:string)=>{
  const next=watchlist.filter(x=>x!==symbol);
  setWatchlist(next);setDemoWatchlist(false);
  try{localStorage.setItem(watchKey,JSON.stringify(next));localStorage.removeItem(demoWatchKey)}catch{}
  setNotice(symbol+" removed from your watchlist.");
 };
 const watchRows=watchlist.map(symbol=>{
  const a=indexRecord(symbol);
  return {symbol,name:a?.name??symbol,price:a?.price??null,date:a?.priceDate??null,currency:a?.currency??"USD",change1d:a?.change1d??null,changeYtd:a?.changeYtd??null};
 });

 return <div className="home-dashboard">
  <section className="dashboard-intro">
   <div><span className="dashboard-eyebrow">OPTIONCRAFTED · MARKET WORKSPACE</span><h2>Dashboard</h2><p>Market context, economic events, important news and your watchlist in one place.</p></div>
   <div className="dashboard-date"><CalendarDays size={17}/><span>{homeDateLabel}</span></div>
  </section>

  <div className="dashboard-grid">
   <section className="dashboard-module dashboard-module--market">
    <header className="dashboard-module-head"><div><span className="dashboard-eyebrow">MARKET OVERVIEW</span><h3>Indices, volatility and key securities</h3><p>Explore the Nasdaq, S&P 500, VIX and Treasury yields.</p></div><a className="dashboard-source-link" href="https://www.tradingview.com/markets/" target="_blank" rel="noreferrer">TradingView <ExternalLink size={13}/></a></header>
    <TradingViewEmbed tag="tv-market-overview" source="https://widgets.tradingview-widget.com/w/en/tv-market-overview.js" attributes={tradingViewMarketAttributes} link="https://www.tradingview.com/markets/" label="Market overview" className="dashboard-tv-market"/>
   </section>

   <section className="dashboard-module dashboard-module--calendar">
    <header className="dashboard-module-head"><div><span className="dashboard-eyebrow">ECONOMIC EVENTS</span><h3>Economic calendar</h3><p>Upcoming releases and central-bank events.</p></div><a className="dashboard-source-link" href="https://www.tradingview.com/economic-calendar/" target="_blank" rel="noreferrer">Full calendar <ArrowUpRight size={13}/></a></header>
    <TradingViewEmbed tag="tv-economic-calendar" source="https://widgets.tradingview-widget.com/w/en/tv-economic-calendar.js" attributes={tradingViewLightAttributes} link="https://www.tradingview.com/economic-calendar/" label="Economic calendar" className="dashboard-tv-calendar"/>
   </section>

   <section className="dashboard-module dashboard-module--rates">
    <header className="dashboard-module-head"><div><span className="dashboard-eyebrow">RATES & MACRO</span><h3>U.S. Treasury yield curve</h3><p>10-year yield minus 2-year yield · 2s10s spread</p></div><a className="dashboard-source-link" href="https://www.tradingview.com/chart/?symbol=TVC%3AUS10Y-TVC%3AUS02Y" target="_blank" rel="noreferrer">Open chart <ArrowUpRight size={13}/></a></header>
    <TradingViewEmbed tag="tv-advanced-chart" source="https://widgets.tradingview-widget.com/w/en/tv-advanced-chart.js" attributes={tradingViewYieldAttributes} link="https://www.tradingview.com/chart/?symbol=TVC%3AUS10Y-TVC%3AUS02Y" label="Treasury yield spread" className="dashboard-tv-rates"/>
    <p className="dashboard-module-note">A positive value means the 10-year yield is above the 2-year yield.</p>
   </section>

   <section className="dashboard-module dashboard-module--news">
    <header className="dashboard-module-head"><div><span className="dashboard-eyebrow">MARKET NEWS</span><h3>Important stories</h3><p>Top market stories and headlines.</p></div><a className="dashboard-source-link" href="https://www.tradingview.com/news/" target="_blank" rel="noreferrer">More news <ArrowUpRight size={13}/></a></header>
    <TradingViewEmbed tag="tv-news-feed" source="https://widgets.tradingview-widget.com/w/en/tv-news-feed.js" attributes={tradingViewLightAttributes} link="https://www.tradingview.com/news/" label="Market news" className="dashboard-tv-news"/>
   </section>

   <section className="dashboard-module dashboard-module--watchlist">
    <header className="dashboard-module-head"><div><span className="dashboard-eyebrow">YOUR SECURITIES</span><h3>Watchlist</h3><p>{watchlist.length} {watchlist.length===1?"security":"securities"} saved in this browser.</p></div><div className="dashboard-watch-actions">{demoWatchlist&&<span className="dashboard-sample-badge">Sample list</span>}<NavLink to="/discover">Find securities <ArrowRight size={13}/></NavLink></div></header>
    {watchRows.length?<div className="dashboard-table-wrap"><table className="dashboard-watch-table"><thead><tr><th>Security</th><th>Price</th><th>1D</th><th>YTD</th><th>Snapshot date</th><th></th></tr></thead><tbody>{watchRows.map(row=><tr key={row.symbol} className={row.symbol===ticker?"dashboard-watch-row-active":""}><td><button type="button" className="dashboard-ticker-button" onClick={()=>onSelect(row.symbol)} aria-label={"Set "+row.symbol+" as security in focus"} aria-current={row.symbol===ticker?"true":undefined}><SecurityLogo ticker={row.symbol}/><span><strong>{row.symbol}</strong><small>{row.name}</small></span></button></td><td>{getMoney(row.price,row.currency)}</td><td className={returnTone(row.change1d)}>{returnText(row.change1d)}</td><td className={returnTone(row.changeYtd)}>{returnText(row.changeYtd)}</td><td>{row.date??"N/D"}</td><td><button type="button" className="dashboard-remove-watch" onClick={()=>removeFromWatchlist(row.symbol)} aria-label={"Remove "+row.symbol+" from watchlist"}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>:<div className="dashboard-empty-watch"><Target size={22}/><strong>Your watchlist is ready</strong><p>Add {ticker} ({name}) to track it here.</p><button type="button" className="dashboard-primary-button" onClick={addToWatchlist}><Plus size={15}/> Add {ticker}</button></div>}
    <p className="dashboard-inline-notice" role="status">{notice}</p>
   </section>

   <section className="dashboard-module dashboard-module--workspace">
    <header className="dashboard-module-head"><div><span className="dashboard-eyebrow">OPTIONCRAFTED WORKSPACE</span><h3>Your tools and portfolio</h3><p>Go from research to an options strategy.</p></div><BriefcaseBusiness size={19}/></header>
    <div className="dashboard-portfolio-strip"><span className="dashboard-portfolio-icon"><Wallet size={18}/></span><span><strong>Portfolio Studio</strong><small>{demoPortfolio?"Illustrative sample · ":""}{positionCount} {positionCount===1?"position":"positions"} in this browser</small></span><b>{portfolioValue===null?"Open":getMoney(portfolioValue)}</b><NavLink to="/portfolio" aria-label="Open Portfolio Studio"><ArrowRight size={15}/></NavLink></div>
    <div className="dashboard-options-grid">
     <NavLink to="/options/csp"><Activity size={17}/><span><strong>Cash-Secured Put</strong><small>Plan a preferred entry</small></span></NavLink>
     <NavLink to="/options/covered-call"><ArrowUpRight size={17}/><span><strong>Covered Call</strong><small>Income on shares held</small></span></NavLink>
     <NavLink to="/options/wheel"><ChartNoAxesCombined size={17}/><span><strong>Wheel Strategy</strong><small>Entry and income workflow</small></span></NavLink>
     <NavLink to="/options/strategy"><Layers3 size={17}/><span><strong>Strategy Builder</strong><small>Compare payoff scenarios</small></span></NavLink>
    </div>
    <div className="dashboard-workspace-links">
     <NavLink to="/company"><BriefcaseBusiness size={15}/>Company Intelligence</NavLink>
     <NavLink to="/valuation/dcf"><ChartNoAxesCombined size={15}/>Valuation Lab</NavLink>
     <NavLink to="/options/probability"><Target size={15}/>Probability Station</NavLink>
     <NavLink to="/academy"><GraduationCap size={15}/>Education</NavLink>
    </div>
    <div className="dashboard-screener-link"><span className="dashboard-screener-icon"><Search size={16}/></span><span><strong>TradingView Stock Screener</strong><small>Open the market screener; use it alongside OptionsCrafted research.</small></span><a href="https://www.tradingview.com/screener/" target="_blank" rel="noreferrer" aria-label="Open TradingView Stock Screener"><ArrowUpRight size={15}/></a></div>
    <a className="dashboard-newsletter-link" href="https://optioncrafted.com/free-newsletter" target="_blank" rel="noreferrer"><BookOpen size={16}/> OptionsCrafted research & newsletter <ArrowUpRight size={13}/></a>
   </section>
  </div>

  <footer className="dashboard-footer"><Shield size={14}/> TradingView widgets are embedded in the dashboard. Prices in the app's top market strip remain dated reference snapshots.</footer>
 </div>;
}
