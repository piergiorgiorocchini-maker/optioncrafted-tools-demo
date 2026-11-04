import {useState} from "react";
import {NavLink} from "react-router-dom";
import audit from "../../reports/fdve-cluster-v2.json";
import {SecurityLogo} from "./SecurityLogo";
import {TradingViewSecurityChart} from "./TradingViewSecurityChart";
import "./fdveResearch.css";

type Fact={status:string;value?:number;periodEnd?:string};
type Year={metrics:Record<string,Fact>};
type Company={ticker:string;profile:string;sec:{status:string;source?:string};years:Record<string,Year>};
const companies=(audit.companies as unknown as Company[]);
const fact=(m:Record<string,Fact>,key:string)=>{const f=m[key];return f&&["AVAILABLE","DERIVED"].includes(f.status)&&Number.isFinite(f.value)?f.value!:null;};
const usd=(v:number|null)=>v===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(v);
const pct=(n:number|null)=>n===null?"N/D":(n*100).toFixed(1)+"%";

export function FDVEResearch({ticker,onSelect,compact=false}:{ticker?:string;onSelect?:(ticker:string)=>void;compact?:boolean}){
 const [year,setYear]=useState<string|null>(null);
 const [chartMarkets,setChartMarkets]=useState<Record<string,"NASDAQ"|"NYSE">>({});
 const selected=companies.find(c=>c.ticker===ticker);
 const years=selected?Object.keys(selected.years).sort((a,b)=>Number(a)-Number(b)):[];
 const activeYear=years.includes(year??"")?year??"":years.at(-1)??"";
 const m=selected?.years[activeYear]?.metrics;
 const cfo=m?fact(m,"cashFromOperations"):null,capex=m?fact(m,"capex"):null,fcf=cfo!==null&&capex!==null?cfo-capex:null;
 const operating=m?fact(m,"operatingIncome"):null,revenue=m?fact(m,"revenue"):null;
 const operatingMargin=operating!==null&&revenue!==null&&revenue>0?operating/revenue:null;
 const chartMarket=ticker?chartMarkets[ticker]??(ticker==="ALAB"?"NASDAQ":null):null;
 const resolveMarket=(market:"NASDAQ"|"NYSE")=>{
  if(!ticker)return;
  setChartMarkets(current=>current[ticker]===market?current:{...current,[ticker]:market});
 };
 const chart=ticker&&!compact?<TradingViewSecurityChart ticker={ticker} symbol={chartMarket?chartMarket+":"+ticker:null}/>:null;

 if(!selected||!m){
  const panel=<section className="fdve-panel">
   <div className="fdve-head">
    <div><span className="overline">ANNUAL FINANCIALS</span><h3>Company statements</h3><p>Choose a security with available SEC annual filings.</p></div>
    {ticker&&!compact&&<SecurityLogo ticker={ticker} size="small" onMarketResolved={resolveMarket}/>}
   </div>
  </section>;
  return chart?<div className="company-market-overview">{panel}{chart}</div>:panel;
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
 return chart?<div className="company-market-overview">{panel}{chart}</div>:panel;
}
