import type {ValuationBridge} from "../core/valuationTriangulation";
import {SecurityLogo} from "./SecurityLogo";
import "./intrinsic-value.css";

type ListingMarket="NASDAQ"|"NYSE";
type IntrinsicValueModuleProps={
 ticker:string;
 name:string;
 currency:string;
 price:number|null;
 valuation?:ValuationBridge|null;
 market?:ListingMarket|null;
 onMarketResolved?:(market:ListingMarket)=>void;
};
const getMoney=(value:number|null,currency="USD")=>value===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(value);
const comparisonText=(comparison:ValuationBridge["marketComparison"]|undefined)=>{
 if(comparison==="OVERVALUED")return "ABOVE FAIR VALUE";
 if(comparison==="UNDERVALUED")return "BELOW FAIR VALUE";
 if(comparison==="IN_LINE")return "NEAR FAIR VALUE";
 return "VALUATION PENDING";
};

export function IntrinsicValueModule({ticker,name,currency,price,valuation,market,onMarketResolved}:IntrinsicValueModuleProps){
 const intrinsic=valuation?.intrinsicValue??null;
 const comparisonPercent=valuation?.comparisonPercent??null;
 const confidence=valuation?.confidence??"INSUFFICIENT";
 const comparison=valuation?.marketComparison??"PENDING";
 const valuationState=comparison==="OVERVALUED"?"overvalued":comparison==="UNDERVALUED"?"undervalued":comparison==="IN_LINE"?"fair-value":"unavailable";
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
    <span className="home-eyebrow">PRICE VS. FAIR VALUE</span>
    <h3 className="home-security-heading"><span className="home-security-name">{ticker} · {name}</span><SecurityLogo ticker={ticker} onMarketResolved={onMarketResolved}/><small className="home-market-badge">{market??(currency==="USD"?"U.S. MARKET":"MARKET N/D")}</small></h3>
    <p>{valuation?.status==="TRIANGULATED"?"Fair value · "+confidence.toLowerCase()+" confidence":"Fair value pending"}</p>
   </div>
   <div className={"home-valuation-verdict is-"+valuationState} aria-live="polite">
    <strong>{comparisonPercent===null?"N/D":comparisonPercent.toFixed(1)+"%"}</strong>
    <span className="home-valuation-verdict-label">{comparisonText(comparison)}</span>
   </div>
  </header>
  <div className="home-fair-value-box" aria-label={"Fair value "+getMoney(intrinsic,currency)}>
   <strong>{getMoney(intrinsic,currency)}</strong>
   <span className="home-valuation-verdict-label">FAIR VALUE</span>
  </div>
  <div className="home-value-scale" role="img" aria-label={"Price "+getMoney(price,currency)+" and fair value "+getMoney(intrinsic,currency)}>
   <div className="home-value-range-heading">
    <strong>PRICE VS FAIR VALUE</strong>
    <div className="home-value-range-legend"><span><i className="undervalued-key"/>BELOW FAIR VALUE</span><span><i className="overvalued-key"/>ABOVE FAIR VALUE</span></div>
   </div>
   <div className="home-value-range-plot">
    {intrinsic!==null&&<div className="home-value-callout intrinsic" style={{left:calloutPosition(intrinsic)+"%"}}><strong>Fair Value</strong><span>{getMoney(intrinsic,currency)}</span></div>}
    {price!==null&&<div className="home-value-callout market" style={{left:calloutPosition(price)+"%"}}><strong>Price</strong><span>{getMoney(price,currency)}</span></div>}
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
  <div className="home-valuation-footer"><strong>Valuation confidence · {confidence.toLowerCase()}</strong><span>{valuation?.status==="TRIANGULATED"?"Current fair value estimate.":"The estimate will appear when sufficient valuation data is available."}</span></div>
 </article>;
}
