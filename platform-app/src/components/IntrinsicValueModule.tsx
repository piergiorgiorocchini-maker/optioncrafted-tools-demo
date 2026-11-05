import {useMemo} from "react";
import {dcfModel,modelDefaults,money} from "../core/valuationModels";
import type {ValuationBridge} from "./ValuationWorkspace";
import {verifiedFcf} from "../data/verifiedFinancials";
import {SecurityLogo} from "./SecurityLogo";
import "./home-dashboard.css";

type ListingMarket="NASDAQ"|"NYSE";
type IntrinsicValueModuleProps={
 ticker:string;
 name:string;
 currency:string;
 price:number|null;
 valuation?:ValuationBridge;
 market?:ListingMarket|null;
 onMarketResolved?:(market:ListingMarket)=>void;
};
const getMoney=(value:number|null,currency="USD")=>money(value,currency);

export function IntrinsicValueModule({ticker,name,currency,price,valuation,market,onMarketResolved}:IntrinsicValueModuleProps){
 const fcf=verifiedFcf(ticker);
 const defaultDcf=useMemo(()=>dcfModel(fcf.perShare,modelDefaults.growth,modelDefaults.discount,modelDefaults.terminal,modelDefaults.years),[fcf.perShare]);
 const intrinsic=valuation?.fairValue??defaultDcf?.value??null;
 const buyUnder=valuation?.buyUnder??(intrinsic===null?null:intrinsic*(1-modelDefaults.mos/100));
 const gap=intrinsic!==null&&Number.isFinite(intrinsic)&&intrinsic>0&&price!==null&&Number.isFinite(price)&&price>0?intrinsic/price-1:null;
 const comparisonPercent=gap===null?null:Math.abs(gap*100);
 const roundedComparisonPercent=comparisonPercent===null?null:Number(comparisonPercent.toFixed(1));
 const valuationState=gap===null?"unavailable":roundedComparisonPercent===0?"fair-value":gap>0?"undervalued":"overvalued";
 const valuationLabel=valuationState==="overvalued"?"OVERVALUED":valuationState==="undervalued"?"UNDERVALUED":valuationState==="fair-value"?"AT INTRINSIC VALUE":"VALUATION UNAVAILABLE";
 const marginOfSafety=intrinsic!==null&&intrinsic>0&&buyUnder!==null?Math.round(Math.max(0,Math.min(100,(1-buyUnder/intrinsic)*100))*10)/10:modelDefaults.mos;
 const valueAnchors=[price,intrinsic].filter((value):value is number=>value!==null&&Number.isFinite(value)&&value>0);
 const valueAnchorLow=valueAnchors.length?Math.min(...valueAnchors):0;
 const valueAnchorHigh=valueAnchors.length?Math.max(...valueAnchors):1;
 const valueScaleMin=valueAnchorLow*0.67;
 const valueScaleMax=Math.max(valueScaleMin+1,valueAnchorHigh*1.4);
 const valuePosition=(value:number|null)=>value===null?0:Math.min(100,Math.max(0,(value-valueScaleMin)/(valueScaleMax-valueScaleMin)*100));
 const axisLabelStyle=(value:number|null,other:number|null)=>{const position=valuePosition(value),otherPosition=other===null?null:valuePosition(other),crowded=otherPosition!==null&&Math.abs(position-otherPosition)<18;const transform=position<18?"translateX(0)":position>82?"translateX(-100%)":crowded?(position<otherPosition!?"translateX(-100%)":"translateX(0)"):"translateX(-50%)";return {left:position+"%",transform}};
 const calloutPosition=(value:number|null)=>Math.min(88,Math.max(12,valuePosition(value)));
 return <article className="home-card home-valuation-card">
  <header className="home-card-heading home-valuation-heading">
   <div className="home-valuation-title">
    <span className="home-eyebrow">PRICE VS. INTRINSIC VALUE</span>
    <h3 className="home-security-heading"><span className="home-security-name">{ticker} · {name}</span><SecurityLogo ticker={ticker} onMarketResolved={onMarketResolved}/><small className="home-market-badge">{market??(currency==="USD"?"U.S. MARKET":"MARKET N/D")}</small></h3>
    <p>DCF · {modelDefaults.years}Y growth exit</p>
   </div>
   <div className={"home-valuation-verdict is-"+valuationState} aria-live="polite">
    <strong>{comparisonPercent===null?"N/D":comparisonPercent.toFixed(1)+"%"}</strong>
    <span className="home-valuation-verdict-label">{valuationLabel}</span>
   </div>
  </header>
  <div className="home-value-pair home-intrinsic-value-pair">
   <div><span>Stock Price</span><strong>{getMoney(price,currency)}</strong></div>
   <div><span>Intrinsic Value</span><strong>{getMoney(intrinsic,currency)}</strong></div>
  </div>
  <div className="home-value-scale" role="img" aria-label={"Intrinsic value range from "+getMoney(valueScaleMin,currency)+" to "+getMoney(valueScaleMax,currency)+"; intrinsic value "+getMoney(intrinsic,currency)+"; stock price "+getMoney(price,currency)}>
   <div className="home-value-range-heading">
    <strong>INTRINSIC VALUE RANGE</strong>
    <div className="home-value-range-legend"><span><i className="undervalued-key"/>UNDERVALUED</span><span><i className="overvalued-key"/>OVERVALUED</span></div>
   </div>
   <div className="home-value-range-plot">
    {intrinsic!==null&&<div className="home-value-callout intrinsic" style={{left:calloutPosition(intrinsic)+"%"}}><strong>Intrinsic Value</strong><span>{getMoney(intrinsic,currency)}</span></div>}
    {price!==null&&<div className="home-value-callout market" style={{left:calloutPosition(price)+"%"}}><strong>Stock Price</strong><span>{getMoney(price,currency)}</span></div>}
    <div className="home-value-track" style={{background:"linear-gradient(90deg,#e6f2fc 0%,#e6f2fc "+valuePosition(intrinsic)+"%,#fff0f0 "+valuePosition(intrinsic)+"%,#fceaf0 100%)"}}>
     {intrinsic===null?null:<i className="dcf-marker" style={{left:valuePosition(intrinsic)+"%"}}/>}
     {price===null?null:<i className="market-marker" style={{left:valuePosition(price)+"%"}}/>}
    </div>
   </div>
   <div className="home-value-range-axis">
    <span className="range-end start">{getMoney(valueScaleMin,currency)}</span>
    {intrinsic===null?null:<span className="range-marker-value intrinsic" style={axisLabelStyle(intrinsic,price)}>{getMoney(intrinsic,currency)}</span>}
    {price===null?null:<span className="range-marker-value market" style={axisLabelStyle(price,intrinsic)}>{getMoney(price,currency)}</span>}
    <span className="range-end finish">{getMoney(valueScaleMax,currency)}</span>
   </div>
  </div>
  <div className="home-valuation-footer"><strong>{marginOfSafety}% margin of safety · Buy-under {getMoney(buyUnder,currency)}</strong><span>Illustrative valuation · {new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date())}</span></div>
 </article>;
}
