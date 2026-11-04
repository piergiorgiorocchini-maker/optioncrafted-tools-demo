import {useEffect,useRef,useState} from "react";

const tradingViewEmbedUrl="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";

export function TradingViewTrend({ticker,symbol}:{ticker:string;symbol:string|null}){
 const containerRef=useRef<HTMLDivElement|null>(null);
 const [visible,setVisible]=useState(false);

 useEffect(()=>{
  const node=containerRef.current;
  if(!node)return;
  if(!("IntersectionObserver" in window)){setVisible(true);return}
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}
  },{rootMargin:"140px"});
  observer.observe(node);
  return ()=>observer.disconnect();
 },[]);

 useEffect(()=>{
  const container=containerRef.current;
  if(!visible||!symbol||!container)return;
  container.replaceChildren();
  const widget=document.createElement("div");
  widget.className="tradingview-widget-container__widget";
  const script=document.createElement("script");
  script.src=tradingViewEmbedUrl;
  script.async=true;
  script.textContent=JSON.stringify({
   autosize:false,
   chartOnly:true,
   colorTheme:"light",
   dateRanges:["12m|1D"],
   fontSize:"10",
   hideDateRanges:true,
   hideMarketStatus:true,
   isTransparent:true,
   locale:"en",
   noTimeScale:true,
   showSymbolLogo:false,
   symbol:symbol,
   dateRange:"12M",
   support_host:"https://www.tradingview.com",
   width:"120",
   height:"54"
  });
  container.append(widget,script);
  return ()=>container.replaceChildren();
 },[visible,symbol,ticker]);

 return <div ref={containerRef} className="explorer-sparkline-widget tradingview-widget-container" aria-label={symbol?("TradingView 1-year chart for "+ticker):undefined} title={symbol?("TradingView 1-year chart for "+ticker):"TradingView symbol unavailable"}>{(!visible||!symbol)&&<span className="explorer-sparkline-placeholder">—</span>}</div>;
}
