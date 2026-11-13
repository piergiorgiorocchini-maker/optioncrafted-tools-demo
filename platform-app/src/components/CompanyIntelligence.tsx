import {verifiedFcf,verifiedAnnualHistory} from "../data/verifiedFinancials";
import {getSecFinancialInputs,getSecFinancialClassification} from "../data/secFinancialBridge";
import {secCashConversion as calculateSecCashConversion,secRoicEstimate} from "../data/secQualityMetrics";
import {VerifiedFundamentals} from "./VerifiedFundamentals";
import {NavLink} from "react-router-dom";
import {Building2,ChartNoAxesCombined,ShieldCheck,Target} from "lucide-react";
import type {Security} from "../core/contracts";
import type {RealAsset} from "./RealResearch";
import "./company.css";
import {FinancialCharts} from "./FinancialCharts";
import {fundamentalMetrics,missingFundamentals} from "../core/fundamentalMetrics";
import {SecurityLogo} from "./SecurityLogo";
import type {ValuationBridge} from "../core/valuationTriangulation";

const compactMoney=(n:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",notation:"compact",maximumFractionDigits:2}).format(n);
const money=(n:number|null,currency:string)=>n===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD"}).format(n);
const percent=(n:number|null|undefined)=>typeof n!=="number"||!Number.isFinite(n)?"N/D":(n*100).toFixed(1)+"%";
const ratingLabel=(value:ValuationBridge["marketComparison"]|undefined)=>{
 if(value==="UNDERVALUED")return "Below fair value";
 if(value==="OVERVALUED")return "Above fair value";
 if(value==="IN_LINE")return "Near fair value";
 return "Pending";
};
const confidenceLabel=(value:ValuationBridge["confidence"]|undefined)=>value?value[0]+value.slice(1).toLowerCase():"Pending";

export function CompanyIntelligence({company,asset,valuation}:{company:Security;asset?:RealAsset;valuation?:ValuationBridge|null}){
 const real=Boolean(asset),name=asset?.name??company.name,symbol=asset?.ticker??company.ticker,sector=asset?.sector??company.sector;
 const currency=asset?.currency??company.currency,price=asset?.price??(real?null:company.price);
 const history=verifiedAnnualHistory(symbol,currency),latest=history.at(-1);
 const earnings=real?(asset?.eps??latest?.eps??null):company.eps;
 const classification=getSecFinancialClassification(symbol),secInputs=real?getSecFinancialInputs(symbol):missingFundamentals;
 const secInputCurrency="currency" in secInputs?secInputs.currency:null;
 const secFcf=verifiedFcf(symbol,currency),secConversion=calculateSecCashConversion(symbol),secRoic=secRoicEstimate(symbol);
 const isFinancial=classification.isFinancial,isFundOrIndex=classification.isFundOrIndex,isReitMlp=classification.isReitOrMlp;
 const triangulatedValue=valuation?.intrinsicValue??null;
 const rating=ratingLabel(valuation?.marketComparison),confidence=confidenceLabel(valuation?.confidence);
 const fcfYield=real
  ?isFundOrIndex||isFinancial||isReitMlp?null
   :secFcf.perShare!==null&&price!==null&&price>0&&secFcf.currency===currency?secFcf.perShare/price*100
    :secFcf.annualAmount!==null&&asset?.marketCap!==null&&asset?.marketCap!==undefined&&asset.marketCap>0&&secFcf.currency===currency?secFcf.annualAmount/asset.marketCap*100:null
  :company.fcfPerShare/company.price*100;
 const fcfYieldLabel=isFundOrIndex||isFinancial||isReitMlp?"N/A":fcfYield===null?"N/D":fcfYield.toFixed(2)+"%";
 const balanceInputs={...missingFundamentals,...(real?secInputs:{}),...(asset?.marketCap!==null&&asset?.marketCap!==undefined&&secInputCurrency===currency?{marketCap:asset.marketCap}:{})};
 const metrics=fundamentalMetrics(balanceInputs);
 const rows:{label:string;value:string}[]=[];
 const addPercent=(label:string,value:number|null|undefined)=>{if(typeof value==="number"&&Number.isFinite(value))rows.push({label,value:percent(value)});};
 const addRatio=(label:string,value:number|null|undefined)=>{if(typeof value==="number"&&Number.isFinite(value))rows.push({label,value:value.toFixed(2)+"x"});};
 const addMoney=(label:string,value:number|null|undefined)=>{if(typeof value==="number"&&Number.isFinite(value))rows.push({label,value:compactMoney(value,currency)});};
 if(!isFundOrIndex&&!isFinancial){
  addPercent("Gross margin",latest?.grossMargin);
  addPercent("Operating margin",latest?.operatingMargin);
  addPercent("Net margin",latest?.netMargin);
  addPercent("Return on equity",latest?.roe);
  if(secRoic.value!==null&&!isReitMlp)addPercent("Return on invested capital",secRoic.value/100);
  if(secConversion.value!==null&&!isReitMlp)addPercent("Cash conversion",secConversion.value/100);
  addRatio("Current ratio",metrics.currentRatio.value);
  addMoney("Net debt",metrics.netDebt.value);
  addRatio("Net debt / EBITDA",metrics.netDebtEbitda.value);
  addRatio("Debt / equity",metrics.debtEquity.value);
  addRatio("Interest coverage",metrics.interestCoverage.value);
 }
 if(earnings!==null)rows.unshift({label:"Earnings per share",value:money(earnings,currency)});
 const pe=real?asset?.pe??null:company.price/company.eps;
 if(typeof pe==="number"&&Number.isFinite(pe)&&pe>0)rows.splice(1,0,{label:"P/E",value:pe.toFixed(2)+"x"});
 return <div className="ci">
  <section className="ci-head"><div><div className="ci-overline">EQUITY RESEARCH / COMPANY INTELLIGENCE</div><h2 className="ci-security-title"><SecurityLogo ticker={symbol}/>{name}</h2><p><b>{symbol}</b> · {sector} · {currency}{real&&asset?.priceDate?" · "+asset.priceDate:""}</p></div><span className="ci-demo">COMPANY PROFILE</span></section>
  <section className="ci-metrics">
   <article><span><Building2 size={16}/> REFERENCE PRICE</span><strong>{money(price,currency)}</strong><small>{real&&asset?.priceDate?asset.priceDate:""}</small></article>
   <article><span><Target size={16}/> TRIANGULATED VALUE</span><strong>{money(triangulatedValue,currency)}</strong><small>Per share</small></article>
   <article><span><ShieldCheck size={16}/> VALUATION RATING</span><strong>{rating}</strong><small>{confidence} confidence</small></article>
   <article><span><ChartNoAxesCombined size={16}/> FREE CASH FLOW YIELD</span><strong>{fcfYieldLabel}</strong><small></small></article>
  </section>
  <VerifiedFundamentals ticker={symbol}/>
  <FinancialCharts asset={asset} company={company}/>
  <section className="ci-panel ci-wide">
   <div className="ci-panel-head"><h3>Key financial metrics</h3><span>{latest?"FY "+latest.year:""}</span></div>
   <div className="ci-fundamentals">{rows.length?rows.map(row=><div key={row.label}><span>{row.label}</span><b>{row.value}</b></div>):<div><span>No metrics available</span><b>—</b></div>}</div>
   <NavLink className="textlink" to="/valuation">Open Valuation Lab →</NavLink>
  </section>
  <div className="ci-foot"><ShieldCheck size={15}/> FINANCIAL INFORMATION · NOT INVESTMENT ADVICE</div>
 </div>;
}
