import {useEffect,useRef,useState} from "react";

const tradingViewEmbedUrl="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";

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
   autosize:true,
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
   symbols:[[ticker,symbol+"|1D"]],
   support_host:"https://www.tradingview.com",
   width:"100%",
   height:"100%"
  });
  container.append(widget,script);
  return ()=>container.replaceChildren();
 },[visible,symbol,ticker]);

 if(!symbol)return <div className="explorer-sparkline-placeholder" title="TradingView symbol unavailable">—</div>;
 return <div ref={containerRef} className="explorer-sparkline-widget" aria-label={"TradingView 1-year chart for "+ticker} title={"TradingView 1-year chart for "+ticker}/>;
}
