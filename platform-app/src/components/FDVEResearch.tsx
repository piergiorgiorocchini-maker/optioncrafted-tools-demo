import {useState} from "react";
import {NavLink} from "react-router-dom";
import audit from "../../reports/fdve-cluster-v2.json";
import snapshot from "../data/assetsSnapshot.json";
import {SecurityLogo} from "./SecurityLogo";
import {TradingViewSecurityChart} from "./TradingViewSecurityChart";
import {TradingViewCompanyWidget,type TradingViewMarket} from "./TradingViewCompanyWidgets";
import {IntrinsicValueModule} from "./IntrinsicValueModule";
import type {RealAsset} from "./RealResearch";
import type {ValuationBridge} from "../core/valuationTriangulation";
import "./fdveResearch.css";

type Fact={status:string;value?:number;periodEnd?:string};
type Year={metrics:Record<string,Fact>};
type Company={ticker:string;profile:string;sec:{status:string;source?:string};years:Record<string,Year>};
const companies=(audit.companies as unknown as Company[]);
const fact=(m:Record<string,Fact>,key:string)=>{const f=m[key];return f&&["AVAILABLE","DERIVED"].includes(f.status)&&Number.isFinite(f.value)?f.value!:null;};
const usd=(v:number|null)=>v===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(v);
const pct=(n:number|null)=>n===null?"N/D":(n*100).toFixed(1)+"%";
const quoteMoney=(n:number|null|undefined,currency:string,compact=false)=>{
 if(typeof n!=="number"||!Number.isFinite(n))return "N/D";
 return new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",notation:compact?"compact":"standard",maximumFractionDigits:2}).format(n);
};
const quotePercent=(n:number|null|undefined)=>{
 if(typeof n!=="number"||!Number.isFinite(n))return "N/D";
 return (n*100).toFixed(2)+"%";
};
const quoteMultiple=(n:number|null|undefined)=>typeof n!=="number"||!Number.isFinite(n)||n<=0?"N/D":n.toFixed(2)+"x";
const quoteDate=(date:string|null|undefined)=>{
 if(!date)return "N/D";
 const parsed=new Date(date+"T00:00:00Z");
 return Number.isNaN(parsed.getTime())?date:new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(parsed);
};

export function FDVEResearch({ticker,onSelect,compact=false,asset,valuation,showAnnualSummary=true}:{ticker?:string;onSelect?:(ticker:string)=>void;compact?:boolean;asset?:RealAsset|null;valuation?:ValuationBridge|null;showAnnualSummary?:boolean}){
 const [year,setYear]=useState<string|null>(null);
 const [chartMarkets,setChartMarkets]=useState<Record<string,TradingViewMarket>>({});
 const selected=companies.find(c=>c.ticker===ticker);
 const years=selected?Object.keys(selected.years).sort((a,b)=>Number(a)-Number(b)):[];
 const activeYear=years.includes(year??"")?year??"":years.at(-1)??"";
 const m=selected?.years[activeYear]?.metrics;
 const cfo=m?fact(m,"cashFromOperations"):null,capex=m?fact(m,"capex"):null,fcf=cfo!==null&&capex!==null?cfo-capex:null;
 const operating=m?fact(m,"operatingIncome"):null,revenue=m?fact(m,"revenue"):null;
 const operatingMargin=operating!==null&&revenue!==null&&revenue>0?operating/revenue:null;
 const chartMarket=ticker?chartMarkets[ticker]??(ticker==="ALAB"?"NASDAQ":null):null;
 const quoteAsset=asset??snapshot.records.find(row=>row.ticker===ticker);
 const quoteCurrency=quoteAsset?.currency??"USD";
 const quoteName=quoteAsset?.name??selected?.ticker??ticker??"";
 const quoteChange=quoteAsset?.change1d??null;
 const quoteChangeClass=typeof quoteChange==="number"&&Number.isFinite(quoteChange)?quoteChange>0?"positive":quoteChange<0?"negative":"neutral":"neutral";
 const exchangeLabel=chartMarket==="NASDAQ"?"Nasdaq Stock Market":chartMarket==="NYSE"?"New York Stock Exchange":"";
 const marketSnapshotDate=quoteDate(quoteAsset?.priceDate??null);
 const resolveMarket=(market:TradingViewMarket)=>{
  if(!ticker)return;
  setChartMarkets(current=>current[ticker]===market?current:{...current,[ticker]:market});
 };
 const chart=ticker&&!compact?(chartMarket?<TradingViewSecurityChart ticker={ticker} symbol={chartMarket+":"+ticker}/>:<section className="ci-market-chart" aria-label={ticker+" interactive TradingView chart"}><div className="ci-market-chart-placeholder"><div><SecurityLogo ticker={ticker} size="small" onMarketResolved={resolveMarket}/><span>Connecting to TradingView…</span></div></div></section>):null;
 const marketSnapshot=ticker&&!compact?<section className="ci-native-quote" aria-label={quoteName+" price and key data"}>
  <div className="ci-quote-identity">
   <SecurityLogo ticker={ticker} onMarketResolved={resolveMarket}/>
   <div className="ci-quote-identity-copy"><h2>{quoteName}</h2><p><b>{ticker}</b>{exchangeLabel&&<span>· {exchangeLabel}</span>}</p></div>
  </div>
  <div className="ci-quote-price">
   <div className="ci-quote-price-line"><strong>{quoteMoney(quoteAsset?.price,quoteCurrency)}</strong><span className={"ci-quote-change "+quoteChangeClass}>{quotePercent(quoteChange)}<small>1D</small></span></div>
   <span className="ci-quote-asof">Price · {marketSnapshotDate}</span>
  </div>
  <div className="ci-quote-facts">
   <div className="ci-quote-fact"><span>EPS · TTM</span><strong>{quoteMoney(quoteAsset?.eps,quoteCurrency)}</strong></div>
   <div className="ci-quote-fact"><span>Market cap</span><strong>{quoteMoney(quoteAsset?.marketCap,quoteCurrency,true)}</strong></div>
   <div className="ci-quote-fact"><span>Dividend yield</span><strong>{quotePercent(quoteAsset?.dividendYield)}</strong></div>
   <div className="ci-quote-fact"><span>P/E · TTM</span><strong>{quoteMultiple(quoteAsset?.pe)}</strong></div>
  </div>
 </section>:null;
 const companyProfile=ticker&&!compact?<TradingViewCompanyWidget ticker={ticker} market={chartMarket} kind="company-profile" onMarketResolved={resolveMarket}/>:null;

 if(!selected||!m){
  const panel=<section className="fdve-panel">
   <div className="fdve-head">
    <div><span className="overline">ANNUAL FINANCIALS</span><h3>Company statements</h3><p>Choose a security with available SEC annual filings.</p></div>
    {ticker&&!compact&&<SecurityLogo ticker={ticker} size="small" onMarketResolved={resolveMarket}/>}
   </div>
  </section>;
  return chart?<div className="company-market-overview">{marketSnapshot}<div className="company-market-top">{chart}</div>{asset&&ticker&&!compact&&<div className="company-market-valuation-row"><IntrinsicValueModule ticker={ticker} name={asset.name} currency={asset.currency} price={asset.price} valuation={valuation} market={chartMarket} onMarketResolved={resolveMarket}/></div>}{companyProfile}{showAnnualSummary?panel:null}</div>:showAnnualSummary?panel:null;
 }

 const cards:[string,string][]=[
  ["Revenue",usd(revenue)],["Net income",usd(fact(m,"netIncome"))],["Operating income",usd(operating)],["Operating margin",pct(operatingMargin)],
  ["Operating cash flow",usd(cfo)],["Capital expenditure",usd(capex)],["Free cash flow",usd(fcf)],["Shareholders' equity",usd(fact(m,"equity"))]
 ];
 const panel=<section className="fdve-panel" aria-label="Annual company financials">
  <div className="fdve-head"><div><span className="overline">ANNUAL FINANCIALS</span><h3>{selected.ticker} · FY {activeYear}</h3><p>SEC company filings · USD totals · not live market data</p></div>{selected.sec.source&&<a href={selected.sec.source} target="_blank" rel="noreferrer">View SEC filing ↗</a>}</div>
  <div className="fdve-detail">
   <div className="fdve-detail-top">
    <div className="fdve-security-label"><SecurityLogo ticker={selected.ticker} size="small" onMarketResolved={resolveMarket}/><span><b>{selected.ticker}</b> · {selected.profile==="bank"?"Financial institution":"Company fundamentals"}</span></div>
    <div>{years.slice().reverse().map(y=><button type="button" key={y} onClick={()=>setYear(y)} className={activeYear===y?"active":""}>FY {y}</button>)}</div>
   </div>
   <div className="fdve-financial-grid">{cards.map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
   <p className="fdve-disclaimer">Figures are reported fiscal-year amounts. Free cash flow is operating cash flow minus capital expenditure. Missing values are shown as N/D.</p>
   {!compact&&<NavLink to="/company">See company analysis →</NavLink>}
  </div>
 </section>;
 return chart?<div className="company-market-overview">{marketSnapshot}<div className="company-market-top">{chart}</div>{asset&&ticker&&!compact&&<div className="company-market-valuation-row"><IntrinsicValueModule ticker={ticker} name={asset.name} currency={asset.currency} price={asset.price} valuation={valuation} market={chartMarket} onMarketResolved={resolveMarket}/></div>}{companyProfile}{showAnnualSummary?panel:null}</div>:showAnnualSummary?panel:null;
}
