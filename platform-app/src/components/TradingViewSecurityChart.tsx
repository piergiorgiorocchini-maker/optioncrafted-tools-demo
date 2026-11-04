import {useEffect,useRef} from "react";

const embedUrl="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";

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
   symbols:[[ticker,symbol+"|12M"]],
   chartOnly:true,
   width:"100%",
   height:"100%",
   locale:"en",
   colorTheme:"light",
   autosize:true,
   showVolume:false,
   showMA:false,
   hideDateRanges:true,
   hideMarketStatus:true,
   hideSymbolLogo:true,
   scalePosition:"right",
   scaleMode:"Normal",
   fontFamily:"-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
   fontSize:"11",
   noTimeScale:false,
   valuesTracking:"1",
   changeMode:"price-only",
   chartType:"line",
   lineWidth:2,
   lineType:0,
   dateRanges:["12m|1D"],
   lineColor:"rgba(22, 126, 227, 1)",
   upColor:"rgba(22, 126, 227, 1)",
   downColor:"rgba(22, 126, 227, 1)",
   gridLineColor:"rgba(35, 68, 105, 0.08)",
   fontColor:"#657b95",
   widgetFontColor:"#17375c",
   backgroundColor:"#ffffff"
  });
  container.append(widget,script);
  return ()=>container.replaceChildren();
 },[ticker,symbol]);

 return <section className="ci-market-chart" aria-label={ticker+" one-year price chart"}>
  <div className="ci-market-chart-head"><strong>Price history</strong><span>1Y</span></div>
  {symbol?<div ref={containerRef} className="ci-market-chart-widget tradingview-widget-container"/>:<div className="ci-market-chart-placeholder">Loading chart…</div>}
 </section>;
}
