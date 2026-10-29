import {useMemo,useState} from "react";
import snapshot from "../data/assetsSnapshot.json";
const number=(x:number|null,digits=2)=>x===null?"N/D":new Intl.NumberFormat("en-US",{maximumFractionDigits:digits}).format(x);
const price=(value:number|null,currency:string)=>value===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(value);
export function LiveUniverseExplorer({onSelect,selectedTicker}:{onSelect:(ticker:string)=>void;selectedTicker:string}){
 const [query,setQuery]=useState("");
 const [onlyComplete,setOnlyComplete]=useState(false);
 const [sector,setSector]=useState("all");
 const [sortKey,setSortKey]=useState<"ticker"|"price"|"pe"|"eps"|"beta"|"dividendYield"|"marketCap">("ticker");
 const [descending,setDescending]=useState(false);
 const [page,setPage]=useState(0);
 const records=snapshot.records;
 const sectors=useMemo(()=>Array.from(new Set(records.map(r=>r.sector).filter(Boolean))).sort(),[records]);
 const filtered=useMemo(()=>records.filter(r=>(sector==="all"||r.sector===sector)&&(!onlyComplete||(r.price!==null&&r.eps!==null&&r.pe!==null))&&[r.ticker,r.name,r.sector].join(" ").toLowerCase().includes(query.toLowerCase().trim())).sort((a,b)=>{const av=a[sortKey],bv=b[sortKey];if(av===null)return bv===null?a.ticker.localeCompare(b.ticker):1;if(bv===null)return -1;const cmp=typeof av==="string"?av.localeCompare(String(bv)):Number(av)-Number(bv);return (descending?-cmp:cmp)||a.ticker.localeCompare(b.ticker)}),[onlyComplete,query,records,sector,sortKey,descending]);
 const shown=filtered.slice(page*30,page*30+30);
 return <section className="panel wide" style={{overflowX:"auto"}}>
 <span className="overline">GOOGLE SHEETS → OPTIONSCRAFTED · PHASE 1</span>
 <h2>Market Explorer · Research Universe</h2>
 <p>Snapshot importato dal foglio Assets il {snapshot.exportedAt}. Dati reali del foglio, non quotazioni live; alcuni campi possono essere obsoleti. FCF e ROIC non sono ancora disponibili da questo export.</p>
 <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",margin:"16px 0"}}>
 <input aria-label="Search securities" placeholder="Search ticker, company, sector..." value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} style={{flex:"1 1 260px",minWidth:160,padding:12,border:"1px solid #cfdbeb",borderRadius:8}}/>
 <label style={{display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={onlyComplete} onChange={e=>{setOnlyComplete(e.target.checked);setPage(0)}}/> Show price + EPS + P/E</label>
 <label style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}>Sector <select aria-label="Filter by sector" value={sector} onChange={e=>{setSector(e.target.value);setPage(0)}}><option value="all">All sectors</option>{sectors.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
 <label style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}>Sort <select aria-label="Sort securities" value={sortKey} onChange={e=>{setSortKey(e.target.value as typeof sortKey);setPage(0)}}><option value="ticker">Ticker</option><option value="price">Price</option><option value="marketCap">Market cap</option><option value="pe">P/E</option><option value="eps">EPS</option><option value="beta">Beta</option><option value="dividendYield">Dividend yield</option></select></label>
 <button type="button" onClick={()=>{setDescending(v=>!v);setPage(0)}} aria-label="Reverse sort order" style={{padding:"9px 12px",border:"1px solid #d3e1ee",borderRadius:8,background:"#fff",cursor:"pointer"}}>{descending?"↓ Desc":"↑ Asc"}</button>
 <span>{filtered.length} / {records.length} assets</span>
 </div>
 <table><thead><tr><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>Market Cap</th><th>1W %</th><th>1Y %</th><th>1Y trend</th><th>EPS TTM</th><th>P/E</th><th>Beta</th><th>Dividend Yield</th></tr></thead>
 <tbody>{shown.map(r=><tr key={r.ticker} style={{background:r.ticker===selectedTicker?"#e8f2fd":undefined}}><td><button type="button" onClick={()=>onSelect(r.ticker)} style={{fontWeight:700,color:"#1269ba",border:0,background:"transparent",cursor:"pointer",textDecoration:"underline"}} title={"Select "+r.ticker+" for Company Intelligence and Valuation"}>{r.ticker}</button></td><td>{r.name}</td><td>{r.sector||"N/D"}</td><td>{price(r.price,r.currency)}</td><td>{r.marketCap===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(r.marketCap)}</td><td title="Historical price series not connected">N/D</td><td title="Historical price series not connected">N/D</td><td><div className="explorer-sparkline-empty" title="Historical closes required to build sparkline"><svg viewBox="0 0 84 26" aria-hidden="true"><path d="M2 22 L82 22" stroke="#d8e3ef" strokeDasharray="3 4" strokeWidth="1.5" fill="none"/></svg><span>Pending</span></div></td><td>{number(r.eps)}</td><td>{number(r.pe)}</td><td>{number(r.beta)}</td><td>{r.dividendYield===null?"N/D":number(r.dividendYield)+"%"}</td></tr>)}</tbody></table>
 {filtered.length===0&&<p>No matching securities.</p>}
 <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16}}><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} / {Math.max(1,Math.ceil(filtered.length/30))}</span><button type="button" disabled={(page+1)*30>=filtered.length} onClick={()=>setPage(p=>p+1)}>Next</button></div>
 <p style={{fontSize:12,marginTop:12}}>Select a ticker to carry it into Company Intelligence and Valuation Lab. Missing FCF and ROIC remain N/D; DCF requires your own FCF assumption. Historical weekly/yearly returns and 1Y sparklines are reserved in the table, but intentionally show N/D until genuine historical daily/weekly closing prices are connected. No API credentials included.</p>
 </section>
}
