import {useEffect,useRef} from "react";

const embedUrl="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";

export function TradingViewSecurityChart({ticker,symbol}:{ticker:string;symbol:string|null}){
 const containerRef=useRef<HTMLDivElement|null>(null);

 useEffect(()=>{
  const container=containerRef.current;
  if(!container)return;
  container.replaceChildren();
  if(!symbol)return;

  const widget=document.createElement("div");
  widget.className="tradingview-widget-container__widget";
  const script=document.createElement("script");
  script.src=embedUrl;
  script.async=true;
  script.textContent=JSON.stringify({
   symbol:symbol,
   width:"100%",
   height:"100%",
   locale:"en",
   dateRange:"12M",
   dateRanges:["12m|1D"],
   colorTheme:"light",
   trendLineColor:"rgba(22, 126, 227, 1)",
   underLineColor:"rgba(22, 126, 227, 0.14)",
   underLineBottomColor:"rgba(22, 126, 227, 0)",
   isTransparent:true,
   autosize:true,
   chartOnly:true,
   noTimeScale:false,
   hideDateRanges:true,
   hideMarketStatus:true,
   showSymbolLogo:false
  });
  container.append(widget,script);
  return ()=>container.replaceChildren();
 },[ticker,symbol]);

 return <section className="ci-market-chart" aria-label={ticker+" one-year price chart"}>
  <div className="ci-market-chart-head"><strong>Price history</strong><span>1Y</span></div>
  {symbol?<div ref={containerRef} className="ci-market-chart-widget tradingview-widget-container"/>:<div className="ci-market-chart-placeholder">Loading chart…</div>}
 </section>;
}
