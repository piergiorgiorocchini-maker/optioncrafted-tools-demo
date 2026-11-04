import {useMemo,useState} from "react";
import {TradingViewTrend} from "./TradingViewTrend";
import {TradingViewMarketHeatmap} from "./TradingViewMarketHeatmap";
import snapshot from "../data/assetsSnapshot.json";
import {SecurityLogo} from "./SecurityLogo";
const number=(x:number|null,digits=2)=>x===null?"N/D":new Intl.NumberFormat("en-US",{maximumFractionDigits:digits}).format(x);
const price=(value:number|null,currency:string)=>value===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(value);
const percent=(value:number|null)=>value===null?"N/D":`${value>=0?"+":""}${(value*100).toFixed(2)}%`;
const tradingViewSymbol=(ticker:string,category:string,name:string,logoMarket?:"NASDAQ"|"NYSE")=>{if(ticker==="VIX")return "CBOE:VIX";if(category==="Index")return ticker==="IXIC"?"NASDAQ:IXIC":null;const isETF=category==="ETF"||/\bETF\b/i.test(name);if(isETF){if(ticker==="QQQ")return "NASDAQ:QQQ";if(ticker==="IBIT")return "NASDAQ:IBIT";return `AMEX:${ticker}`}const knownMarket:Record<string,"NASDAQ"|"NYSE">={ALAB:"NASDAQ"};const market=logoMarket||knownMarket[ticker];return market?`${market}:${ticker}`:null;};
export function LiveUniverseExplorer({onSelect,selectedTicker}:{onSelect:(ticker:string)=>void;selectedTicker:string}){
 const [query,setQuery]=useState("");
 const [sector,setSector]=useState("all");
 const [sortKey,setSortKey]=useState<"ticker"|"price"|"pe"|"eps"|"beta"|"dividendYield"|"marketCap"|"change1d"|"changeYtd">("ticker");
 const [descending,setDescending]=useState(false);
 const [page,setPage]=useState(0);
 const [logoMarkets,setLogoMarkets]=useState<Record<string,"NASDAQ"|"NYSE">>({});
 const records=snapshot.records;
 const sectors=useMemo(()=>Array.from(new Set(records.map(r=>r.sector).filter(Boolean))).sort(),[records]);
 const filtered=useMemo(()=>records.filter(r=>(sector==="all"||r.sector===sector)&&[r.ticker,r.name,r.sector].join(" ").toLowerCase().includes(query.toLowerCase().trim())).sort((a,b)=>{const av=a[sortKey],bv=b[sortKey];if(av===null)return bv===null?a.ticker.localeCompare(b.ticker):1;if(bv===null)return -1;const cmp=typeof av==="string"?av.localeCompare(String(bv)):Number(av)-Number(bv);return (descending?-cmp:cmp)||a.ticker.localeCompare(b.ticker)}),[query,records,sector,sortKey,descending]);
 const shown=filtered.slice(page*30,page*30+30);
 return <section className="panel wide" style={{overflowX:"auto"}}>
 <style>{`.market-explorer-titlebar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:16px 0 8px}.market-explorer-titlebar h3{font-size:16px;margin:0}.market-explorer-titlebar input{width:min(260px,45%);padding:9px 11px;border:1px solid #cfdbeb;border-radius:8px}.market-explorer-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 16px}.market-explorer-controls>*{flex-shrink:0}@media(max-width:640px){.market-explorer-controls{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;padding:4px 0 8px;margin:10px 0;scrollbar-width:none}.market-explorer-controls::-webkit-scrollbar{display:none}.market-explorer-titlebar{margin:12px 0 6px}.market-explorer-titlebar h3{font-size:14px}.market-explorer-titlebar input{width:180px!important;padding:8px!important}.market-explorer-controls{margin:6px 0 12px}.market-explorer-controls label{font-size:11px!important;white-space:nowrap}.market-explorer-controls button{padding:7px 9px!important}.market-explorer-controls select{max-width:118px}.market-explorer-controls>span{font-size:11px;white-space:nowrap}}`}</style>
 <TradingViewMarketHeatmap/>
 <div className="market-explorer-titlebar"><h3>Titoli</h3><input aria-label="Search securities" placeholder="Cerca ticker o società..." value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/></div>
 <div className="market-explorer-controls">
 <label style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}>Sector <select aria-label="Filter by sector" value={sector} onChange={e=>{setSector(e.target.value);setPage(0)}}><option value="all">All sectors</option>{sectors.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
 <label style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}>Sort <select aria-label="Sort securities" value={sortKey} onChange={e=>{setSortKey(e.target.value as typeof sortKey);setPage(0)}}><option value="ticker">Ticker</option><option value="price">Price</option><option value="marketCap">Market cap</option><option value="change1d">1D return</option><option value="changeYtd">YTD return</option><option value="pe">P/E</option><option value="eps">EPS</option><option value="beta">Beta</option><option value="dividendYield">Dividend yield</option></select></label>
 <button type="button" onClick={()=>{setDescending(v=>!v);setPage(0)}} aria-label="Reverse sort order" style={{padding:"9px 12px",border:"1px solid #d3e1ee",borderRadius:8,background:"#fff",cursor:"pointer"}}>{descending?"↓ Desc":"↑ Asc"}</button>
 <span>{filtered.length} / {records.length} assets</span>
 </div>
 <table><thead><tr><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>Market Cap</th><th>1D %</th><th>YTD %</th><th>1Y trend</th><th>EPS TTM</th><th>P/E</th><th>Beta</th><th>Dividend Yield</th></tr></thead>
 <tbody>{shown.map(r=><tr key={r.ticker} style={{background:r.ticker===selectedTicker?"#e8f2fd":undefined}}><td><button type="button" className="explorer-security" onClick={()=>onSelect(r.ticker)} title={"Select "+r.ticker+" for Company Intelligence and Valuation"}><SecurityLogo ticker={r.ticker} size="small" onMarketResolved={market=>setLogoMarkets(current=>current[r.ticker]===market?current:{...current,[r.ticker]:market})}/><strong>{r.ticker}</strong></button></td><td>{r.name}</td><td>{r.sector||"N/D"}</td><td>{price(r.price,r.currency)}</td><td>{r.marketCap===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(r.marketCap)}</td><td title="Google Sheets daily change">{percent(r.change1d)}</td><td title="Google Sheets year-to-date change">{percent(r.changeYtd)}</td><td><TradingViewTrend ticker={r.ticker} symbol={tradingViewSymbol(r.ticker,r.category,r.name,logoMarkets[r.ticker])}/></td><td>{number(r.eps)}</td><td>{number(r.pe)}</td><td>{number(r.beta)}</td><td>{r.dividendYield===null?"N/D":number(r.dividendYield)+"%"}</td></tr>)}</tbody></table>
 {filtered.length===0&&<p>No matching securities.</p>}
 <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16}}><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} / {Math.max(1,Math.ceil(filtered.length/30))}</span><button type="button" disabled={(page+1)*30>=filtered.length} onClick={()=>setPage(p=>p+1)}>Next</button></div>
 <p style={{fontSize:12,marginTop:12}}>A missing value means Google does not provide that metric for the selected security. 1Y charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a> may update on a different schedule and can show delayed market data.</p>
 </section>
}
