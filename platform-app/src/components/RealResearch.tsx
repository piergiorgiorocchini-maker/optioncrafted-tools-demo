import {useEffect,useState} from "react";
import {NavLink} from "react-router-dom";
import snapshot from "../data/assetsSnapshot.json";import {ValuationFootballField} from "./ValuationFootballField";
export type RealAsset=(typeof snapshot.records)[number];
const fmt=(n:number|null,digits=2)=>n===null?"N/D":new Intl.NumberFormat("en-US",{maximumFractionDigits:digits}).format(n);
const money=(n:number|null,currency:string)=>n===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(n);
export function RealCompany({asset}:{asset:RealAsset}){
 return <section className="panel wide"><span className="overline">COMPANY INTELLIGENCE / GOOGLE SHEETS SNAPSHOT</span><h2>{asset.name} · {asset.ticker}</h2>
 <p>{asset.sector||"Sector unavailable"} · {asset.currency||"Currency unavailable"} · Snapshot exported {snapshot.exportedAt}; individual data timestamps have not been verified.</p>
 <div className="workflow-grid">{[["Reference price",money(asset.price,asset.currency)],["EPS TTM",fmt(asset.eps)],["P/E TTM",fmt(asset.pe)],["Beta",fmt(asset.beta)],["Average volume",fmt(asset.avgVolume,0)],["Market capitalization",money(asset.marketCap,asset.currency)],["Dividend yield",asset.dividendYield===null?"N/D":fmt(asset.dividendYield)+"%"],["FCF / share","N/D"],["ROIC","N/D"]].map(([name,value])=><div key={name} className="workflow-step"><span>{name}</span><h3>{value}</h3></div>)}</div>
 <p><strong>Data boundary:</strong> FCF, ROIC, balance-sheet history, filings and comparable companies have not been validated for this asset. No synthetic metrics or research conclusions are displayed.</p>
 <NavLink className="textlink" to="/valuation">Open Valuation Lab with {asset.ticker} →</NavLink></section>;
}
function dcf(fcf:number,growth:number,discount:number,terminal:number,horizon:number){if(fcf<=0||discount<=terminal||discount<=0)return null;let pv=0;let last=fcf;for(let i=1;i<=horizon;i++){last*=1+growth/100;pv+=last/Math.pow(1+discount/100,i)}return pv+(last*(1+terminal/100)/(discount/100-terminal/100))/Math.pow(1+discount/100,horizon)}
export function RealValuation({asset}:{asset:RealAsset}){
 const [fcf,setFcf]=useState("");
 const [growth,setGrowth]=useState(5);
 const [discount,setDiscount]=useState(10);
 const [terminal,setTerminal]=useState(2.5);
 const [years,setYears]=useState(5);
 const [mos,setMos]=useState(25);
 const [riskFree,setRiskFree]=useState(4);
 const [erp,setErp]=useState(5.5);
 const [beta,setBeta]=useState(String(asset.beta??""));
 const [rateMode,setRateMode]=useState<"manual"|"capm">("manual");
 useEffect(()=>{setFcf("");setBeta(String(asset.beta??""))},[asset.ticker,asset.beta]);
 const b=beta.trim()?Number(beta):NaN,capm=Number.isFinite(b)&&b>=0?riskFree+b*erp:null;
 const usedRate=rateMode==="capm"?capm:discount;
 const cash=fcf.trim()?Number(fcf):NaN;
 const value=usedRate!==null&&Number.isFinite(cash)&&Number.isFinite(usedRate)?dcf(cash,growth,usedRate,terminal,years):null;
 const input=(label:string,value:string|number,onChange:(s:string)=>void,step="any")=><label style={{display:"grid",gap:5}}><span>{label}</span><input style={{padding:10,border:"1px solid #cbd8e6",borderRadius:6,width:"100%"}} type="number" step={step} value={value} onChange={e=>onChange(e.target.value)}/></label>;
 return <section className="panel wide"><span className="overline">VALUATION LAB / REAL TICKER · FREE-HAND DCF</span><h2>{asset.name} · {asset.ticker}</h2><p>Reference price: {money(asset.price,asset.currency)} · EPS TTM: {fmt(asset.eps)} · Beta: {fmt(asset.beta)}. FCF per share is not supplied in the current Google Sheets export and must be entered manually. No fictional cash flows are inserted.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"18px 0"}}>{input("FCF per share · required",fcf,setFcf)}{input("FCF growth %",growth,s=>setGrowth(Number(s)))}{input("Terminal growth %",terminal,s=>setTerminal(Number(s)))}{input("Forecast years",years,s=>setYears(Math.max(1,Math.min(30,Number(s)||1))),"1")}{input("Margin of safety %",mos,s=>setMos(Math.max(0,Math.min(100,Number(s)))) )}</div>
 <h3>Cost of Equity · CAPM</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"12px 0"}}>{input("Risk-free rate % (assumption)",riskFree,s=>setRiskFree(Number(s)))}{input("Equity risk premium % (assumption)",erp,s=>setErp(Number(s)))}{input("Levered beta",beta,setBeta)}</div>
 <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14}}><label>Discount method <select value={rateMode} onChange={e=>setRateMode(e.target.value as "manual"|"capm")}><option value="manual">Manual return</option><option value="capm">CAPM</option></select></label>{rateMode==="manual"&&input("Required return %",discount,s=>setDiscount(Number(s)))}<strong>CAPM: {capm===null?"N/D":capm.toFixed(2)+"%"}</strong><strong>Applied: {usedRate===null?"N/D":usedRate.toFixed(2)+"%"}</strong></div>
 <div className="workflow-grid">{[["DCF intrinsic value / share",money(value,asset.currency)],["Buy-below after margin of safety",money(value===null?null:value*(1-mos/100),asset.currency)],["Price-to-value upside",value!==null&&asset.price!==null&&asset.price>0?((value/asset.price-1)*100).toFixed(1)+"%":"N/D"]].map(([k,v])=><div className="workflow-step" key={k}><span>{k}</span><h3>{v}</h3></div>)}</div>
 <ValuationFootballField price={asset.price} currency={asset.currency} bear={value===null?null:dcf(cash,growth-3,usedRate!+2,Math.max(0,terminal-1),years)} base={value} bull={value===null?null:dcf(cash,growth+3,Math.max(1,usedRate!-1),Math.min(usedRate!-0.5,terminal+0.5),years)} mos={mos} source="REAL TICKER / USER ASSUMPTIONS"/>
 <p>{value===null?"Enter positive FCF per share and ensure the discount rate exceeds terminal growth to calculate a DCF.":"DCF values are scenario calculations using the user's assumptions, not verified analyst forecasts."} Rates are editable assumptions, not current market feeds. The per-share equity cash-flow model uses an equity discount rate, not WACC.</p>
 </section>;
}
