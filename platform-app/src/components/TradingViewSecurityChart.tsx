import {useEffect,useRef,useState} from "react";

const embedUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

export function TradingViewSecurityChart({ticker,symbol}:{ticker:string;symbol:string|null}){
 const containerRef=useRef<HTMLDivElement|null>(null);
 const [compactViewport,setCompactViewport]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 900px)").matches);

 useEffect(()=>{
  const media=window.matchMedia("(max-width: 900px)");
  const update=()=>setCompactViewport(media.matches);
  media.addEventListener("change",update);
  return ()=>media.removeEventListener("change",update);
 },[]);

 useEffect(()=>{
  const container=containerRef.current;
  if(!container)return;
  if(!symbol)return;
  let disposed=false;
  let settled=false;

  const widget=document.createElement("div");
  widget.className="tradingview-widget-container__widget";
  widget.style.height="calc(100% - 24px)";
  widget.style.width="100%";

  const attribution=document.createElement("div");
  attribution.className="tradingview-widget-copyright";
  const link=document.createElement("a");
  const symbolPath=symbol.replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"");
  link.href="https://www.tradingview.com/symbols/"+symbolPath+"/";
  link.target="_blank";
  link.rel="noopener nofollow";
  link.textContent=ticker+" chart";
  const trademark=document.createElement("span");
  trademark.textContent=" by TradingView";
  attribution.append(link,trademark);

  const script=document.createElement("script");
  script.src=embedUrl;
  script.async=true;
  script.textContent=JSON.stringify({
   symbol,
   width:"100%",
   height:"100%",
   autosize:true,
   locale:"en",
   timezone:"exchange",
   interval:"W",
   theme:"light",
   style:"1",
   backgroundColor:"rgba(255, 255, 255, 1)",
   gridColor:"rgba(30, 69, 105, 0.08)",
   withdateranges:true,
   hide_top_toolbar:false,
   hide_side_toolbar:compactViewport,
   hide_legend:false,
   hide_volume:false,
   allow_symbol_change:false,
   details:false,
   hotlist:false,
   calendar:false,
   save_image:false,
   show_popup_button:true,
   popup_width:"1200",
   popup_height:"800",
   studies:[],
   support_host:"https://www.tradingview.com"
  });

  script.onload=()=>{settled=true;if(disposed)container.replaceChildren()};
  script.onerror=()=>{settled=true;if(disposed)container.replaceChildren()};
  container.append(widget,attribution,script);
  return ()=>{
   disposed=true;
   if(settled)container.replaceChildren();
  };
 },[ticker,symbol,compactViewport]);

 return <section className="ci-market-chart" aria-label={ticker+" interactive TradingView chart"}>
  {symbol?<div key={symbol+":"+(compactViewport?"compact":"wide")} ref={containerRef} className="ci-market-chart-widget tradingview-widget-container"/>:<div className="ci-market-chart-placeholder">Chart unavailable for this symbol</div>}
 </section>;
}
