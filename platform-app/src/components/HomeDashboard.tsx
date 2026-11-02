import {useEffect,useMemo,useState} from "react";
import {NavLink} from "react-router-dom";
import {Activity,ArrowDownRight,ArrowRight,ArrowUpRight,BookOpen,BriefcaseBusiness,ChartNoAxesCombined,Compass,Layers3,Mail,Newspaper,Plus,Search,Shield,Target,Trash2,Wallet,GraduationCap} from "lucide-react";
import snapshot from "../data/assetsSnapshot.json";
import type {RealAsset} from "./RealResearch";
import type {ValuationBridge} from "./ValuationWorkspace";
import {verifiedFcf} from "../data/verifiedFinancials";
import {dcfModel,modelDefaults,money} from "../core/valuationModels";
import "./home-dashboard.css";

type ModelHolding={ticker:string;weight:number};
type ModelPortfolio={id:string;name:string;subtitle:string;icon:"growth"|"income"|"options"|"macro";holdings:ModelHolding[]};
const modelPortfolios:ModelPortfolio[]=[
{id:"core",name:"Free Core",subtitle:"Equity core + liquid reserve",icon:"growth",holdings:[{ticker:"SPY",weight:40},{ticker:"QQQ",weight:20},{ticker:"XLP",weight:10},{ticker:"BIL",weight:20},{ticker:"AAPL",weight:10}]},
{id:"income",name:"Income Framework",subtitle:"Equities + Treasury bills",icon:"income",holdings:[{ticker:"SPY",weight:30},{ticker:"XOM",weight:15},{ticker:"JPM",weight:15},{ticker:"KO",weight:10},{ticker:"BIL",weight:30}]},
{id:"options",name:"Options Income",subtitle:"Equity base + liquid reserve",icon:"options",holdings:[{ticker:"SPY",weight:30},{ticker:"QQQ",weight:20},{ticker:"AAPL",weight:15},{ticker:"MSFT",weight:15},{ticker:"BIL",weight:20}]},
{id:"macro",name:"Liquid Macro",subtitle:"Index, gold, cash and energy",icon:"macro",holdings:[{ticker:"SPY",weight:25},{ticker:"GLD",weight:25},{ticker:"SHY",weight:20},{ticker:"IBIT",weight:10},{ticker:"XLE",weight:10},{ticker:"BIL",weight:10}]}
];

const watchKey="optionscrafted.watchlist.v1";
const portfolioKey="optionscrafted.portfolio.v1";
const demoWatchKey="optionscrafted.demo.watchlist.v1";
const demoPortfolioKey="optionscrafted.demo.portfolio.v1";
const starterWatchlist=["AAPL","MSFT","GOOGL","JPM","AVGO","SPY"];
const starterPositions=[{ticker:"AAPL",shares:20,averageCost:290},{ticker:"MSFT",shares:8,averageCost:470},{ticker:"GOOGL",shares:12,averageCost:250},{ticker:"JPM",shares:15,averageCost:310},{ticker:"SPY",shares:25,averageCost:690}];
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
const logoRoots=[
 "https://cdn.jsdelivr.net/gh/ahmeterenodaci/Nasdaq-Stock-Exchange-including-Symbols-and-Logos/logos/_",
 "https://cdn.jsdelivr.net/gh/ahmeterenodaci/New-York-Stock-Exchange--NYSE--including-Symbols-and-Logos/logos/_"
];
export function SecurityLogo({ticker}:{ticker:string}){
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>setAttempt(0),[ticker]);
 const valid=/^[A-Z0-9.-]+$/i.test(ticker);
 if(!valid||attempt>=logoRoots.length)return <span className="home-security-logo home-security-fallback" aria-hidden="true">{ticker.slice(0,2).toUpperCase()}</span>;
 const src=logoRoots[attempt]+encodeURIComponent(ticker.toUpperCase())+".png";
 return <span className="home-security-logo" aria-hidden="true"><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setAttempt(n=>n+1)}/></span>;
}
export function HomeDashboard({ticker,asset,name,valuation,onSelect}:{ticker:string;asset:RealAsset|null;name:string;valuation?:ValuationBridge;onSelect:(ticker:string)=>void}){
 const [watchlist,setWatchlist]=useState<string[]>([]);
 const [positionCount,setPositionCount]=useState(0);
 const [portfolioValue,setPortfolioValue]=useState<number|null>(null);
 const [demoWatchlist,setDemoWatchlist]=useState(false);
 const [demoPortfolio,setDemoPortfolio]=useState(false);
 const [notice,setNotice]=useState("");
 const [selectedModelId,setSelectedModelId]=useState("core");
 const [putStrike,setPutStrike]=useState<number>((asset?.price??100)*0.95);
 const [putPremium,setPutPremium]=useState<number>((asset?.price??100)*0.015);
 const [putDays,setPutDays]=useState(30);
 const [putContracts,setPutContracts]=useState(1);
 useEffect(()=>{const spot=asset?.price??100;setPutStrike(Number((spot*0.95).toFixed(2)));setPutPremium(Number((spot*0.015).toFixed(2)));},[ticker,asset?.price]);
 const macroRegime="Risk-on";
 useEffect(()=>{
  const existingWatchlist=localStorage.getItem(watchKey);
  const isDemoWatchlist=existingWatchlist===null;
  const raw=isDemoWatchlist?starterWatchlist:savedList(watchKey);
  const items=Array.isArray(raw)?raw.filter((x):x is string=>typeof x==="string"):[];
  if(isDemoWatchlist){try{localStorage.setItem(watchKey,JSON.stringify(starterWatchlist));localStorage.setItem(demoWatchKey,"true")}catch{}}
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
 const fcf=verifiedFcf(ticker);
 const defaultDcf=useMemo(()=>dcfModel(fcf.perShare,modelDefaults.growth,modelDefaults.discount,modelDefaults.terminal,modelDefaults.years),[fcf.perShare]);
 const intrinsic=valuation?.fairValue??defaultDcf?.value??null;
 const buyUnder=valuation?.buyUnder??(intrinsic===null?null:intrinsic*(1-modelDefaults.mos/100));
 const marketPrice=asset?.price??null;
 const gap=intrinsic!==null&&intrinsic>0&&marketPrice!==null&&marketPrice>0?marketPrice/intrinsic-1:null;
 const valueScaleMax=Math.max(marketPrice??0,intrinsic??0,buyUnder??0)*1.12||1;
 const valuePosition=(value:number|null)=>value===null?0:Math.min(100,Math.max(0,value/valueScaleMax*100));
 const valuationBasis=valuation?.source??(defaultDcf?"Default DCF scenario":"Data required");
 const vix=indexRecord("VIX");
 const selectedModel=modelPortfolios.find(p=>p.id===selectedModelId)??modelPortfolios[0];
 const selectedHoldings=selectedModel.holdings.map(h=>({ ...h,asset:indexRecord(h.ticker) }));
 const modelYtd=selectedHoldings.every(h=>h.asset?.changeYtd!=null)?selectedHoldings.reduce((sum,h)=>sum+h.weight/100*(h.asset?.changeYtd??0),0):null;
 const modelDay=selectedHoldings.every(h=>h.asset?.change1d!=null)?selectedHoldings.reduce((sum,h)=>sum+h.weight/100*(h.asset?.change1d??0),0):null;
 const modelValue=modelYtd===null?null:100000*(1+modelYtd);
 const demoSpot=marketPrice??100;
 const putCollateral=Math.max(0,putStrike)*100*putContracts;
 const putCollected=Math.max(0,putPremium)*100*putContracts;
 const putBreakEven=Math.max(0,putStrike-putPremium);
 const putMaxLoss=Math.max(0,putCollateral-putCollected);
 const putCollateralYield=putCollateral>0?putCollected/putCollateral:null;
 const chartMin=Math.max(0,demoSpot*0.55),chartMax=demoSpot*1.45,chartWidth=470,chartHeight=150,chartLeft=32,chartRight=14,chartTop=14,chartBottom=25;
 const chartInnerW=chartWidth-chartLeft-chartRight,chartInnerH=chartHeight-chartTop-chartBottom;
 const payoffAt=(price:number)=>putCollected-Math.max(putStrike-price,0)*100*putContracts;
 const chartScale=Math.max(putCollateral,putCollected,1);
 const chartX=(price:number)=>chartLeft+(price-chartMin)/(chartMax-chartMin)*chartInnerW;
 const chartY=(value:number)=>chartTop+(chartScale-value)/(2*chartScale)*chartInnerH;
 const payoffPath=Array.from({length:41},(_,i)=>{const price=chartMin+(chartMax-chartMin)*i/40;return (i===0?"M":"L")+chartX(price).toFixed(1)+","+chartY(payoffAt(price)).toFixed(1)}).join(" ");
 const payoffZeroY=chartY(0);
 const pricedCount=snapshot.records.filter(a=>a.price!==null).length;
 const screeners=[
  {title:"Value · P/E ≤ 20",count:snapshot.records.filter(a=>a.pe!==null&&a.pe>0&&a.pe<=20).length,tickers:snapshot.records.filter(a=>a.pe!==null&&a.pe>0&&a.pe<=20).sort((a,b)=>(a.pe??99)-(b.pe??99)).slice(0,3).map(a=>a.ticker).join(" · ")},
  {title:"Positive momentum · YTD ≥ 20%",count:snapshot.records.filter(a=>a.changeYtd!==null&&a.changeYtd>=.2).length,tickers:snapshot.records.filter(a=>a.changeYtd!==null&&a.changeYtd>=.2).sort((a,b)=>(b.changeYtd??0)-(a.changeYtd??0)).slice(0,3).map(a=>a.ticker).join(" · ")},
  {title:"Lower beta · beta < 1",count:snapshot.records.filter(a=>a.beta!==null&&a.beta>0&&a.beta<1).length,tickers:snapshot.records.filter(a=>a.beta!==null&&a.beta>0&&a.beta<1).sort((a,b)=>(a.beta??9)-(b.beta??9)).slice(0,3).map(a=>a.ticker).join(" · ")}
 ];
 const addToWatchlist=()=>{
  if(watchlist.includes(ticker)){setNotice(ticker+" is already in your watchlist.");return}
  const next=[...watchlist,ticker];setWatchlist(next);setDemoWatchlist(false);try{localStorage.setItem(watchKey,JSON.stringify(next));localStorage.removeItem(demoWatchKey)}catch{}
  setNotice(ticker+" added to your watchlist.");
 };
 const removeFromWatchlist=(symbol:string)=>{
  const next=watchlist.filter(x=>x!==symbol);setWatchlist(next);setDemoWatchlist(false);try{localStorage.setItem(watchKey,JSON.stringify(next));localStorage.removeItem(demoWatchKey)}catch{}
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
   <article className="home-kpi"><div><Layers3 size={17}/><span>SCREENING UNIVERSE</span></div><strong>{snapshot.records.length} <em>securities</em></strong><small>{pricedCount} with price · snapshot {snapshot.exportedAt}</small></article>
   <article className="home-kpi"><div><Target size={17}/><span>WATCHLIST</span></div><strong>{watchlist.length} <em>{watchlist.length===1?"security":"securities"}</em></strong><small>Saved in this browser</small></article>
   <article className="home-kpi"><div><Wallet size={17}/><span>PORTFOLIO</span></div><strong>{positionCount} <em>{positionCount===1?"position":"positions"}</em></strong><small>{portfolioValue===null?"Open Portfolio Studio":getMoney(portfolioValue)+" · snapshot value"}</small></article>
  </section>
  <section className="home-feature-grid">
   <article className="home-card home-options-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">OPTIONS STRATEGY WORKSPACE</span><h3>Options Modeling & Wheel Engine</h3><p>Choose a strategy to model it against the selected security.</p></div><NavLink className="home-button home-button-primary" to="/options">Open Options Lab <ArrowRight size={15}/></NavLink></header>
    <div className="home-strategy-grid">{optionModules.map(({title,text,to,icon:Icon})=><NavLink className="home-strategy" to={to} key={title}><span className="home-strategy-icon"><Icon size={19}/></span><strong>{title}</strong><small>{text}</small><span className="home-strategy-open">Open module <ArrowRight size={13}/></span></NavLink>)}</div>
    <div className="home-underlying-market"><div className="home-underlying-identity"><SecurityLogo ticker={ticker}/><span><strong>{ticker} · {name}</strong><small>Google Sheets snapshot · {asset?.priceDate??"date N/D"}</small></span></div><div><small>REFERENCE PRICE</small><strong>{getMoney(marketPrice,asset?.currency)}</strong></div><div><small>1D SNAPSHOT</small><strong className={returnTone(asset?.change1d??null)}>{returnText(asset?.change1d??null)}</strong></div><div><small>YTD</small><strong className={returnTone(asset?.changeYtd??null)}>{returnText(asset?.changeYtd??null)}</strong></div><NavLink to="/valuation/dcf">Review intrinsic value <ArrowRight size={13}/></NavLink></div>
    <div className="home-demo-option">
     <div className="home-demo-title"><span><strong>Cash-Secured Put</strong><small>Manual scenario · illustrative inputs, not option quotes</small></span><span className="home-demo-badge">DEMO SCENARIO</span></div>
     <div className="home-demo-grid">
      <div className="home-demo-controls">
       <label>Put strike <span><b>$</b><input type="number" min="0" step="0.01" value={putStrike.toFixed(2)} onChange={e=>setPutStrike(Number(e.target.value)||0)}/></span></label>
       <label>Premium / share <span><b>$</b><input type="number" min="0" step="0.01" value={putPremium.toFixed(2)} onChange={e=>setPutPremium(Number(e.target.value)||0)}/></span></label>
       <label>Days to expiry <input type="number" min="1" max="730" value={putDays} onChange={e=>setPutDays(Math.max(1,Number(e.target.value)||1))}/></label>
       <label>Contracts <input type="number" min="1" max="100" value={putContracts} onChange={e=>setPutContracts(Math.min(100,Math.max(1,Number(e.target.value)||1)))}/></label>
       <div className="home-demo-results"><span><small>Premium collected</small><strong>{getMoney(putCollected)}</strong></span><span><small>Break-even</small><strong>{getMoney(putBreakEven)}</strong></span><span><small>Capital secured</small><strong>{getMoney(putCollateral)}</strong></span><span><small>Max loss at $0</small><strong>{getMoney(putMaxLoss)}</strong></span></div>
      </div>
      <div className="home-payoff-card"><div className="home-payoff-heading"><span><strong>Payoff at expiration</strong><small>{putDays} DTE · {putContracts} contract{putContracts===1?"":"s"} · per scenario</small></span><span>Net P/L</span></div><svg className="home-payoff-svg" viewBox={"0 0 "+chartWidth+" "+chartHeight} role="img" aria-label="Illustrative cash-secured put payoff at expiration"><line x1={chartLeft} x2={chartWidth-chartRight} y1={payoffZeroY} y2={payoffZeroY} className="home-payoff-axis"/><line x1={chartX(demoSpot)} x2={chartX(demoSpot)} y1={chartTop} y2={chartHeight-chartBottom} className="home-payoff-spot"/><path d={payoffPath} className="home-payoff-line"/>{putBreakEven>=chartMin&&putBreakEven<=chartMax&&<line x1={chartX(putBreakEven)} x2={chartX(putBreakEven)} y1={chartTop} y2={chartHeight-chartBottom} className="home-payoff-breakeven"/>}<text x={chartLeft} y={chartHeight-5}>{getMoney(chartMin)}</text><text x={chartX(demoSpot)} y={chartHeight-5} textAnchor="middle">Spot {getMoney(demoSpot)}</text><text x={chartWidth-chartRight} y={chartHeight-5} textAnchor="end">{getMoney(chartMax)}</text><text x={chartLeft-5} y={chartTop+4} textAnchor="end">{getMoney(chartScale)}</text><text x={chartLeft-5} y={payoffZeroY+3} textAnchor="end">$0</text><text x={chartLeft-5} y={chartHeight-chartBottom} textAnchor="end">-{getMoney(chartScale)}</text></svg><div className="home-payoff-legend"><span><i/>Strategy P/L</span><span><i/>Break-even {getMoney(putBreakEven)}</span><span><i/>Reference price {getMoney(demoSpot)}</span></div></div>
     </div>
     <small className="home-demo-disclaimer">Scenario math only. Premium is a user-adjustable assumption; no option chain, implied volatility, probability of profit, fees or assignment forecast is available.</small>
    </div>
   </article>
   <article className="home-card home-valuation-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">PRICE VS. VALUE</span><h3 className="home-security-heading"><SecurityLogo ticker={ticker}/>{name} · {ticker}</h3><p>DCF base scenario · per share</p></div><button type="button" className="home-add-watch" onClick={addToWatchlist} aria-label={"Add "+ticker+" to watchlist"}><Plus size={16}/></button></header>
    <div className="home-value-pair"><div><span>Market price</span><strong>{getMoney(marketPrice,asset?.currency)}</strong></div><div><span>DCF estimate</span><strong>{getMoney(intrinsic,asset?.currency)}</strong></div></div>
    <div className={"home-upside "+(gap===null?"":gap>=0?"negative":"positive")}><span>{gap===null?"Valuation comparison unavailable":gap>=0?"Market price above DCF":"Market price below DCF"}</span><strong>{gap===null?"N/D":(gap>=0?"+":"")+(gap*100).toFixed(1)+"%"}</strong>{gap===null?null:gap>=0?<ArrowUpRight size={17}/>:<ArrowDownRight size={17}/>}</div>
    <div className="home-buy-under"><span>DCF buy-under · {modelDefaults.mos}% margin of safety</span><strong>{getMoney(buyUnder,asset?.currency)}</strong></div>
    <div className="home-value-scale" role="img" aria-label={"Per-share comparison: buy-under "+getMoney(buyUnder,asset?.currency)+", DCF "+getMoney(intrinsic,asset?.currency)+", market "+getMoney(marketPrice,asset?.currency)}><div className="home-value-scale-labels"><span>BUY-UNDER</span><span>DCF BASE</span><span>MARKET</span></div><div className="home-value-track"><i className="buy-marker" style={{left:valuePosition(buyUnder)+"%"}}/><i className="dcf-marker" style={{left:valuePosition(intrinsic)+"%"}}/><i className="market-marker" style={{left:valuePosition(marketPrice)+"%"}}/></div><div className="home-value-scale-values"><span>{getMoney(buyUnder,asset?.currency)}</span><span>{getMoney(intrinsic,asset?.currency)}</span><span>{getMoney(marketPrice,asset?.currency)}</span></div></div>
    <small className="home-valuation-note">{valuationBasis} · FCF/share {getMoney(fcf.perShare,asset?.currency)} ({fcf.basis})</small>
    <NavLink className="home-card-link" to="/valuation/dcf">Open full valuation <ArrowRight size={14}/></NavLink>
    <div className="home-probability-teaser"><span className="home-probability-ring"><Target size={22}/></span><div><span className="home-eyebrow">PROBABILITY STATION</span><strong>Scenario inputs needed</strong><small>VIX {vix&&vix.price!==null?numberFormat.format(vix.price):"N/D"} · {vix?.priceDate??"date N/D"} · no option chain loaded</small><NavLink to="/options/probability">Open Probability Station <ArrowRight size={13}/></NavLink></div></div>
   </article>
  </section>
  <section className="home-ecosystem-grid" aria-label="Explore the OptionsCrafted workspace">
   <article className="home-card home-models-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">MODEL PORTFOLIOS · SIMULATED</span><h3>Illustrative portfolio lab</h3><p>Choose a sample allocation built from securities in the dated market snapshot.</p></div><BriefcaseBusiness size={19}/></header>
    <div className="home-model-list home-model-select-list">
     {modelPortfolios.map(model=>{const ytd=model.holdings.every(h=>indexRecord(h.ticker)?.changeYtd!=null)?model.holdings.reduce((sum,h)=>sum+h.weight/100*(indexRecord(h.ticker)?.changeYtd??0),0):null;return <button type="button" className={`home-model-option ${model.id===selectedModelId?"active":""}`} onClick={()=>setSelectedModelId(model.id)} key={model.id}><span className={`home-model-icon ${model.icon}`}>{model.icon==="growth"?<Activity size={16}/>:model.icon==="income"?<Wallet size={16}/>:model.icon==="options"?<ChartNoAxesCombined size={16}/>:<Compass size={16}/>}</span><span><strong>{model.name}</strong><small>{model.subtitle}</small></span><b className={returnTone(ytd)}>{returnText(ytd)}</b></button>})}
    </div>
    <div className="home-model-detail">
     <div className="home-model-summary"><span><strong>$100,000</strong><small>initial illustrative capital</small></span><span><strong>{modelValue===null?"N/D":getMoney(modelValue)}</strong><small>snapshot value · YTD price proxy</small></span><span><strong className={returnTone(modelDay)}>{returnText(modelDay)}</strong><small>weighted 1D proxy</small></span></div>
     <div className="home-allocation-bar" aria-label={selectedModel.name+" illustrative allocation"}>{selectedHoldings.map(h=><span key={h.ticker} title={h.ticker+" "+h.weight+"%"} style={{width:h.weight+"%"}}/>)}</div>
     <div className="home-holding-chips">{selectedHoldings.map(h=><span key={h.ticker}><SecurityLogo ticker={h.ticker}/><b>{h.ticker}</b><small>{h.weight}%</small></span>)}</div>
     <small className="home-model-disclaimer">Simulation only: weighted price changes from the snapshot; assumes allocation at year start, no rebalance, dividends, fees or options premiums. Not a backtest or actual portfolio result.</small>
    </div>
    <NavLink className="home-card-link" to="/portfolio">Open Portfolio Studio <ArrowRight size={14}/></NavLink>
   </article>
   <article className="home-card home-screener-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">STOCK SCANNERS & SCREENERS</span><h3>Snapshot filters</h3><p>Simple filters computed from the available Google Sheets fields.</p></div><ChartNoAxesCombined size={19}/></header>
    <div className="home-screener-grid">{screeners.map(s=><div className="home-screener-tile" key={s.title}><span>{s.title}</span><strong>{s.count}</strong><small>{s.tickers||"No matching symbols"}</small></div>)}<div className="home-screener-tile coverage"><span>Price coverage</span><strong>{pricedCount}/{snapshot.records.length}</strong><small>{snapshot.records.length-pricedCount} without a reference price</small></div></div>
    <small className="home-screener-note">Exploratory filters only · snapshot {snapshot.exportedAt} · not recommendations. Fields with incomplete coverage are excluded.</small>
    <NavLink className="home-card-link" to="/discover">Explore market universe <ArrowRight size={14}/></NavLink>
   </article>
   <article className="home-card home-library-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">RESEARCH & KNOWLEDGE</span><h3>Research, articles & learning</h3><p>Editorial resources from OptionCrafted and the platform.</p></div><BookOpen size={19}/></header>
    <a className="home-article-feature" href="https://optioncrafted.com/articles/what-options-really-are.html" target="_blank" rel="noreferrer"><span className="home-article-icon"><Newspaper size={19}/></span><span><small>FEATURED ARTICLE</small><strong>What Options Really Are: Rights, Obligations, and Income</strong><em>Read on OptionCrafted.com <ArrowUpRight size={12}/></em></span></a>
    <div className="home-research-links"><a href="https://optioncrafted.com/options.html" target="_blank" rel="noreferrer">Options strategies <ArrowUpRight size={13}/></a><a href="https://optioncrafted.com/investing.html" target="_blank" rel="noreferrer">Investing research <ArrowUpRight size={13}/></a><a href="https://optioncrafted.com/free-newsletter" target="_blank" rel="noreferrer">Free newsletter <ArrowUpRight size={13}/></a><NavLink to="/academy">Education & courses <ArrowRight size={14}/></NavLink></div>
   </article>
  </section>
  <section className="home-lower-grid">
   <article className="home-card home-watchlist-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">YOUR SECURITIES</span><h3>Watchlist</h3></div><div className="home-watch-actions">{demoWatchlist&&<span className="home-demo-badge">SAMPLE LIST</span>}<NavLink to="/discover">Find securities <ArrowRight size={14}/></NavLink></div></header>
    {watchRows.length? <div className="home-table-wrap"><table className="home-watch-table"><thead><tr><th>Security</th><th>Price</th><th>1D %</th><th>YTD %</th><th>Snapshot date</th><th></th></tr></thead><tbody>{watchRows.map(row=><tr key={row.symbol}><td><button type="button" className="home-ticker-link" onClick={()=>onSelect(row.symbol)}><SecurityLogo ticker={row.symbol}/><span className="home-ticker-copy"><strong>{row.symbol}</strong><small>{row.name}</small></span></button></td><td>{getMoney(row.price,row.currency)}</td><td className={returnTone(row.change1d)}>{returnText(row.change1d)}</td><td className={returnTone(row.changeYtd)}>{returnText(row.changeYtd)}</td><td>{row.date??"N/D"}</td><td><button type="button" className="home-remove-watch" onClick={()=>removeFromWatchlist(row.symbol)} aria-label={"Remove "+row.symbol+" from watchlist"}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>:<div className="home-empty-watch"><Target size={21}/><strong>Your watchlist is ready</strong><p>Add {ticker} to track its reference price here.</p><button type="button" className="home-button home-button-primary" onClick={addToWatchlist}><Plus size={15}/> Add {ticker}</button></div>}
    <p className="home-inline-notice" role="status">{notice}</p>
   </article>
   <article className="home-card home-portfolio-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">ALLOCATION</span><h3>Portfolios & Portfolio Studio</h3></div>{demoPortfolio?<span className="home-demo-badge">SAMPLE PORTFOLIO</span>:<BriefcaseBusiness size={19}/>}</header>
    <p>Your researched portfolios can be connected here. Track positions and snapshot values in Portfolio Studio.</p>
    <div className="home-portfolio-summary"><strong>{positionCount}</strong><span>positions saved in this browser</span>{portfolioValue!==null&&<b>{getMoney(portfolioValue)} snapshot value</b>}</div>
    <NavLink className="home-card-link" to="/portfolio">Open Portfolio Studio <ArrowRight size={14}/></NavLink>
   </article>
   <article className="home-card home-research-card">
    <header className="home-card-heading"><div><span className="home-eyebrow">YOUR WORKSPACE</span><h3>Quick access</h3></div><Compass size={19}/></header>
    <div className="home-shortcut-grid"><NavLink to="/options"><Activity size={18}/>Options Lab</NavLink><NavLink to="/portfolio"><BriefcaseBusiness size={18}/>Portfolio Studio</NavLink><NavLink to="/options/probability"><Target size={18}/>Probability Station</NavLink><NavLink to="/discover"><Search size={18}/>Market Explorer</NavLink><NavLink to="/discover"><ChartNoAxesCombined size={18}/>Stock Scanner</NavLink><NavLink to="/company"><BriefcaseBusiness size={18}/>Company Intelligence</NavLink><NavLink to="/research"><Newspaper size={18}/>Research Library</NavLink><NavLink to="/academy"><GraduationCap size={18}/>Education</NavLink></div>
   </article>
  </section>
  <section className="home-learning-grid"><article className="home-learning-card"><span className="home-learning-icon"><GraduationCap size={21}/></span><div><span className="home-eyebrow">THE OPTION EDGE</span><h3>Options education & courses</h3><p>Build the concepts behind disciplined options strategies.</p><NavLink to="/academy">Explore learning <ArrowRight size={14}/></NavLink></div></article><article className="home-learning-card newsletter"><span className="home-learning-icon"><Mail size={21}/></span><div><span className="home-eyebrow">NEWSLETTER</span><h3>OptionCrafted Free Newsletter</h3><p>Market insights, options ideas, and research from OptionCrafted.</p><a href="https://optioncrafted.com/free-newsletter" target="_blank" rel="noreferrer">Join the newsletter <ArrowUpRight size={14}/></a></div></article></section>
  <footer className="home-footer"><Shield size={14}/> Market prices are dated reference values, not live quotes. DCF is a scenario estimate based on visible assumptions. Logo sources: <a href="https://github.com/ahmeterenodaci/Nasdaq-Stock-Exchange-including-Symbols-and-Logos" target="_blank" rel="noreferrer">Nasdaq</a> · <a href="https://github.com/ahmeterenodaci/New-York-Stock-Exchange--NYSE--including-Symbols-and-Logos" target="_blank" rel="noreferrer">NYSE</a></footer>
 </div>;
}