import {useEffect,useRef} from "react";
import {SecurityLogo} from "./SecurityLogo";
import "./tradingview-company-widgets.css";

export type TradingViewMarket="NASDAQ"|"NYSE";
export type TradingViewWidgetKind="symbol-info"|"company-profile"|"financials"|"technical-analysis"|"news";

type WidgetConfig={
 script:string;
 height?:number;
 options:Record<string,unknown>;
};

const widgetConfigs:Record<TradingViewWidgetKind,WidgetConfig>={
 "symbol-info":{
  script:"embed-widget-symbol-info.js",
  options:{isTransparent:true}
 },
 "company-profile":{
  script:"embed-widget-symbol-profile.js",
  height:310,
  options:{}
 },
 financials:{
  script:"embed-widget-financials.js",
  height:540,
  options:{displayMode:"regular"}
 },
 "technical-analysis":{
  script:"embed-widget-technical-analysis.js",
  height:380,
  options:{interval:"1D",displayMode:"single",showIntervalTabs:true}
 },
 news:{
  script:"embed-widget-timeline.js",
  height:480,
  options:{feedMode:"symbol",displayMode:"regular"}
 }
};

const titleByKind:Record<TradingViewWidgetKind,string>={
 "symbol-info":"Market snapshot",
 "company-profile":"Company profile · TradingView",
 financials:"Financial data · TradingView",
 "technical-analysis":"Technical analysis · TradingView",
 news:"Related news · TradingView"
};

export function TradingViewCompanyWidget({ticker,market,kind,title,description,onMarketResolved}:{ticker:string;market:TradingViewMarket|null;kind:TradingViewWidgetKind;title?:string;description?:string;onMarketResolved?:(market:TradingViewMarket)=>void}){
 const hostRef=useRef<HTMLDivElement|null>(null);
 const config=widgetConfigs[kind];
 const symbol=market?market+":"+ticker.trim().toUpperCase():null;

 useEffect(()=>{
  const host=hostRef.current;
  if(!host||!symbol)return;
  host.replaceChildren();
  const applyEmbedScale=()=>{
   const viewportWidth=window.innerWidth||1;
   const displayWidth=Math.max(1,window.screen.width||viewportWidth);
   const scale=Math.min(2,Math.max(1.15,viewportWidth/displayWidth));
   host.style.setProperty("--tv-content-scale",scale.toFixed(3));
   host.style.setProperty("--tv-content-inverse",(1/scale).toFixed(4));
  };
  applyEmbedScale();
  window.addEventListener("resize",applyEmbedScale);

  const widget=document.createElement("div");
  widget.className="tradingview-widget-container__widget";
  if(config.height!==undefined)widget.style.height=config.height+"px";
  widget.style.width="100%";

  const attribution=document.createElement("div");
  attribution.className="tradingview-widget-copyright";
  const link=document.createElement("a");
  link.href="https://www.tradingview.com/symbols/"+symbol.replace(/[^a-z0-9_-]+/gi,"-")+"/";
  link.target="_blank";
  link.rel="noopener nofollow";
  link.textContent=ticker.toUpperCase()+" data";
  const brand=document.createElement("span");
  brand.textContent=" by TradingView";
  attribution.append(link,brand);

  const script=document.createElement("script");
  script.src="https://s3.tradingview.com/external-embedding/"+config.script;
  script.async=true;
  script.textContent=JSON.stringify({
   symbol,
   width:"100%",
   ...(config.height!==undefined?{height:config.height}:{}),
   colorTheme:"light",
   isTransparent:false,
   locale:"en",
   ...config.options
  });

  host.append(widget,attribution,script);
  return ()=>{window.removeEventListener("resize",applyEmbedScale);host.replaceChildren()};
 },[config.height,config.options,config.script,symbol,ticker]);

 return <section className={"tv-company-widget tv-company-widget-"+kind} aria-label={title??titleByKind[kind]}>
  {(title||description)&&<header className="tv-company-widget-heading"><div><h3>{title??titleByKind[kind]}</h3>{description&&<p>{description}</p>}</div><span>TradingView</span></header>}
  {symbol?<div ref={hostRef} className="tv-company-widget-host tradingview-widget-container"/>:
   <div className="tv-company-widget-waiting"><SecurityLogo ticker={ticker} size="small" onMarketResolved={onMarketResolved}/><span>Resolving the exchange for <b>{ticker}</b>…</span></div>}
 </section>;
}
