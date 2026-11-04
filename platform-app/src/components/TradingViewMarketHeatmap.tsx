import {useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";

type HeatmapView="sector"|"titles";

export function TradingViewMarketHeatmap(){
 const [view,setView]=useState<HeatmapView>("sector");
 const containerRef=useRef<HTMLDivElement|null>(null);

 useEffect(()=>{
  const container=containerRef.current;
  if(!container)return;
  container.replaceChildren();

  const widget=document.createElement("div");
  widget.className="tradingview-widget-container__widget";
  const script=document.createElement("script");
  script.src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
  script.async=true;
  script.textContent=JSON.stringify({
   dataSource:"SPX500",
   blockSize:"market_cap_basic",
   blockColor:"change",
   grouping:view==="sector"?"sector":"no_group",
   locale:"en",
   symbolUrl:"",
   colorTheme:"light",
   exchanges:[],
   hasTopBar:false,
   isDataSetEnabled:false,
   isZoomEnabled:true,
   hasSymbolTooltip:true,
   isMonoSize:false,
   autosize:true,
   width:"100%",
   height:"100%"
  });
  container.append(widget,script);
  return ()=>container.replaceChildren();
 },[view]);

 const buttonStyle=(active:boolean):CSSProperties=>({
  border:"1px solid "+(active?"#1d78d4":"#d5e1ee"),
  background:active?"#eaf4ff":"#fff",
  color:active?"#125eaa":"#62748a",
  borderRadius:7,
  padding:"7px 12px",
  fontSize:12,
  fontWeight:active?750:600,
  cursor:"pointer"
 });

 return <section className="panel wide" style={{padding:20}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:10}}>
   <div><span className="overline">MARKET PULSE · TRADINGVIEW</span><h2 style={{margin:"8px 0 3px"}}>Market Heatmap</h2><p style={{margin:0,fontSize:12}}>S&amp;P 500 · dimensione per capitalizzazione · colore per variazione giornaliera</p></div>
   <div role="tablist" aria-label="Heatmap view" style={{display:"flex",gap:6}}>
    <button type="button" role="tab" aria-selected={view==="sector"} onClick={()=>setView("sector")} style={buttonStyle(view==="sector")}>Settori</button>
    <button type="button" role="tab" aria-selected={view==="titles"} onClick={()=>setView("titles")} style={buttonStyle(view==="titles")}>Titoli</button>
   </div>
  </div>
  <div ref={containerRef} className="market-heatmap-widget tradingview-widget-container" aria-label={"TradingView S&P 500 heatmap by "+(view==="sector"?"sector":"stock")} style={{height:"clamp(260px, 30vw, 360px)",minWidth:0,overflow:"hidden"}} />
  <p style={{fontSize:11,margin:"8px 0 0"}}>La heatmap usa l’universo S&amp;P 500 e i dati TradingView; è distinta dai 227 titoli dello snapshot Google Sheets qui sotto. Clicca un settore per approfondire i titoli.</p>
 </section>;
}
