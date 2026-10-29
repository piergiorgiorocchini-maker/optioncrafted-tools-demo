import {ExternalLink,BookOpen,Database} from "lucide-react";
import {grahamModel,money} from "../core/valuationModels";
import "./graham-research.css";

type GrahamResult=ReturnType<typeof grahamModel>;
type Props={
 ticker:string;
 price:number|null;
 eps:number|null;
 dividendYield:number|null;
 growth:number;
 aaaYield:number|null;
 currency:string;
 result:GrahamResult;
 aaaObservationDate:string;
 aaaSourceUrl:string;
 aaaIsManual:boolean;
};

function verdict(upside:number|null,pegDividend:number|null){
 const up=upside!==null&&Number.isFinite(upside);
 const peg=pegDividend!==null&&Number.isFinite(pegDividend);
 if(!up&&!peg)return "Insufficient data";
 if(up&&upside>=.25&&peg&&pegDividend<=1.5)return "Attractive";
 if(up&&upside>=.1&&(!peg||pegDividend<=2))return "Reasonable";
 if(up&&upside<-.1&&peg&&pegDividend>2)return "Expensive";
 if(peg&&pegDividend<=1.2)return "PEG attractive";
 if(peg&&pegDividend>2.2)return "PEG stretched";
 return "Fair / neutral";
}
const pct=(n:number|null)=>n!==null&&Number.isFinite(n)?n.toFixed(2)+"%":"N/D";
const multiple=(n:number|null)=>n!==null&&Number.isFinite(n)?n.toFixed(2)+"×":"N/D";
const signedPct=(n:number|null)=>n!==null&&Number.isFinite(n)?(n>=0?"+":"")+(n*100).toFixed(2)+"%":"N/D";
const cleanTicker=(ticker:string)=>ticker.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g,"");

export function GrahamResearchPanel({ticker,price,eps,dividendYield,growth,aaaYield,currency,result,aaaObservationDate,aaaSourceUrl,aaaIsManual}:Props){
 const symbol=cleanTicker(ticker);
 const stockAnalysis="https://stockanalysis.com/stocks/"+encodeURIComponent(symbol.toLowerCase())+"/statistics/";
 const yahoo="https://finance.yahoo.com/quote/"+encodeURIComponent(symbol)+"/key-statistics/";
 const sec="https://www.sec.gov/edgar/search/?entityName="+encodeURIComponent(symbol);
 const pe=price!==null&&eps!==null&&eps>0?price/eps:null;
 const adjusted=result?.adjusted??null;
 const upside=adjusted!==null&&price!==null&&price>0?adjusted/price-1:null;
 const peg=result?.peg??null;
 const pegDividend=result?.pegDividend??null;
 const reading=verdict(upside,pegDividend);
 const bondDate=aaaIsManual?"USER OVERRIDE":"FRED SNAPSHOT · "+aaaObservationDate;
 const data=[
  {name:"Diluted EPS",preferred:"TTM diluted EPS; use normalized EPS if a cycle distorts earnings.",source:"Stock Analysis · "+symbol,url:stockAnalysis},
  {name:"Expected EPS growth",preferred:"Forward 3–5 year annual growth assumption; do not confuse it with historical growth.",source:"Yahoo Finance · "+symbol,url:yahoo},
  {name:"Reference price & P/E",preferred:"Price from the same observation period as EPS. This module derives P/E as price ÷ EPS.",source:"Yahoo Finance · "+symbol,url:yahoo},
  {name:"Dividend yield",preferred:"Forward annual dividend yield, with payout sustainability checked separately.",source:"Stock Analysis · "+symbol,url:stockAnalysis},
  {name:"Aaa corporate yield",preferred:"Moody’s Seasoned Aaa Corporate Bond Yield (DAAA), long-maturity US corporate bonds.",source:"FRED · DAAA",url:aaaSourceUrl},
  {name:"Financial filings",preferred:"Primary filings to validate EPS, share count, dividend payments and unusual items.",source:"SEC EDGAR · "+symbol,url:sec}
 ];
 return <div className="nr-graham-panel">
  <section className="nr-graham-summary" aria-label="Graham Lynch model outputs">
   <div className="nr-section-title"><div><span className="nr-eyebrow">GRAHAM / LYNCH · EARNINGS VALUATION</span><h3>Six research outputs</h3></div><span className="nr-status">SCENARIO · NOT A QUOTE</span></div>
   <div className="nr-graham-metrics">
    <div className="nr-metric"><span>Classic Graham value</span><strong>{money(result?.classic??null,currency)}</strong><small>EPS × (8.5 + 2g)</small></div>
    <div className="nr-metric nr-graham-primary"><span>Primary output · Aaa-adjusted Graham</span><strong>{money(adjusted,currency)}</strong><small>Bond-adjusted earnings anchor</small></div>
    <div className="nr-metric"><span>Upside / downside</span><strong className={upside!==null?(upside<0?"nr-graham-down":"nr-graham-up"):""}>{signedPct(upside)}</strong><small>Adjusted value vs reference price</small></div>
    <div className="nr-metric"><span>PEG</span><strong>{multiple(peg)}</strong><small>P/E ÷ expected growth %</small></div>
    <div className="nr-metric"><span>Dividend-adjusted PEG</span><strong>{multiple(pegDividend)}</strong><small>P/E ÷ (growth % + dividend yield %)</small></div>
    <div className="nr-metric"><span>Screening verdict</span><strong className="nr-graham-verdict">{reading}</strong><small>Heuristic, not an investment rating</small></div>
   </div>
   <div className="nr-graham-provenance"><span>Reference price: <b>{money(price,currency)}</b></span><span>Derived P/E: <b>{multiple(pe)}</b></span><span>Bond input: <b>{pct(aaaYield)}</b></span><span>{bondDate}</span><a href={aaaSourceUrl} target="_blank" rel="noopener noreferrer">Verify on FRED <ExternalLink size={12}/></a></div>
  </section>
  <section className="nr-graham-body">
   <div className="nr-graham-left">
    <div className="nr-control-card nr-graham-method">
     <div className="nr-section-title"><div><span className="nr-eyebrow">CALCULATION EXPLAINED</span><h3>How Graham–Lynch works</h3></div><span className="nr-status"><BookOpen size={13}/> TRANSPARENT FORMULAS</span></div>
     <p>The classic Graham formula is an earnings-based heuristic. The Aaa adjustment applies the historical 4.4% reference rate; the Lynch-style ratios compare earnings growth with the stock’s P/E. None of these is a discounted cash-flow forecast.</p>
     <div className="nr-graham-formulas">
      <div><span>01 · Classic Graham</span><code>EPS × (8.5 + 2 × g)</code><small>g is annual EPS growth entered as a percent number, e.g. 7 for 7%.</small><b>{eps!==null&&Number.isFinite(growth)?money(eps,currency)+" × (8.5 + 2 × "+growth+") = "+money(result?.classic??null,currency):"Awaiting EPS and growth inputs"}</b></div>
      <div><span>02 · Bond-adjusted Graham</span><code>Classic × 4.4 ÷ Aaa yield</code><small>4.4 is Graham’s historical bond-yield reference, not today’s yield.</small><b>{result?.classic!==undefined&&aaaYield!==null?money(result.classic,currency)+" × 4.4 ÷ "+aaaYield+" = "+money(adjusted,currency):"Awaiting positive Aaa bond yield"}</b></div>
      <div><span>03 · PEG ratio</span><code>(Price ÷ EPS) ÷ g</code><small>Compares the P/E multiple with expected annual EPS growth.</small><b>{pe!==null&&Number.isFinite(growth)?multiple(pe)+" ÷ "+growth+" = "+multiple(peg):"Awaiting valid price, EPS and growth"}</b></div>
      <div><span>04 · Dividend-adjusted PEG</span><code>P/E ÷ (g + dividend yield)</code><small>Both growth and dividend yield are percent numbers.</small><b>{pe!==null&&dividendYield!==null&&Number.isFinite(growth)?multiple(pe)+" ÷ ("+growth+" + "+dividendYield.toFixed(2)+") = "+multiple(pegDividend):"Awaiting valid P/E and dividend yield"}</b></div>
     </div>
     <div className="nr-graham-caveat"><strong>What this model misses</strong><span>Capital allocation, reinvestment returns, buybacks, debt, cash conversion, moat durability and the distribution of future growth. Use the output as one valuation anchor, never as the entire thesis.</span></div>
    </div>
    <div className="nr-graham-interpretation">
     <span className="nr-eyebrow">MODEL INTERPRETATION</span>
     {result?<p>For <strong>{symbol}</strong>, the classic Graham estimate is <strong>{money(result.classic,currency)}</strong>. Applying the <strong>{pct(aaaYield)}</strong> Aaa corporate yield produces <strong>{money(adjusted,currency)}</strong>. Against the reference price of <strong>{money(price,currency)}</strong>, that implies <strong>{signedPct(upside)}</strong>. The PEG is <strong>{multiple(peg)}</strong> and the dividend-adjusted PEG is <strong>{multiple(pegDividend)}</strong>. The legacy screening rules classify this combination as <strong>{reading}</strong>. This is a deliberately conservative earnings heuristic and does not, by itself, establish intrinsic value.</p>:<p>Enter valid diluted EPS and expected growth to calculate the Graham value and PEG ratios. A positive Aaa yield is required for the interest-adjusted estimate.</p>}
     <small>Financial inputs come from the selected OptionsCrafted snapshot or user entries. Growth is a user assumption. The bond observation is dated; source links may contain more recent data than the application snapshot.</small>
    </div>
   </div>
   <div className="nr-control-card nr-graham-sources">
    <div className="nr-section-title"><div><span className="nr-eyebrow">INPUT GUIDE / DATA SOURCES</span><h3>Find data for {symbol}</h3></div><span className="nr-status"><Database size={13}/> RESEARCH LINKS</span></div>
    <p>Use these links to verify inputs or complete the model manually. The company links follow the selected ticker; the bond link always points to FRED series DAAA.</p>
    <div className="nr-graham-source-links">
     <a href={stockAnalysis} target="_blank" rel="noopener noreferrer">Stock Analysis · {symbol} <ExternalLink size={12}/></a>
     <a href={yahoo} target="_blank" rel="noopener noreferrer">Yahoo · {symbol} <ExternalLink size={12}/></a>
     <a href={sec} target="_blank" rel="noopener noreferrer">SEC EDGAR · {symbol} <ExternalLink size={12}/></a>
     <a href={aaaSourceUrl} target="_blank" rel="noopener noreferrer">FRED · DAAA <ExternalLink size={12}/></a>
    </div>
    <div className="nr-graham-table-scroll"><table className="nr-graham-table"><thead><tr><th>Input</th><th>Preferred data</th><th>Source / ticker</th></tr></thead><tbody>
     {data.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.preferred}</td><td><a href={row.url} target="_blank" rel="noopener noreferrer">{row.source} <ExternalLink size={11}/></a></td></tr>)}
    </tbody></table></div>
    <p className="nr-graham-sources-foot">A linked provider may not cover every ticker, exchange or ETF. Check the company's reporting period and the definition of forward versus trailing metrics before transferring values.</p>
   </div>
  </section>
 </div>;
}
