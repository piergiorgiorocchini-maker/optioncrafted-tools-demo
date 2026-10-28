import {useMemo,useState} from "react";
import snapshot from "../data/assetsSnapshot.json";
const number=(x:number|null,digits=2)=>x===null?"N/D":new Intl.NumberFormat("en-US",{maximumFractionDigits:digits}).format(x);
const price=(value:number|null,currency:string)=>value===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(value);
export function LiveUniverseExplorer({onSelect,selectedTicker}:{onSelect:(ticker:string)=>void;selectedTicker:string}){
 const [query,setQuery]=useState("");
 const [onlyComplete,setOnlyComplete]=useState(false);
 const [page,setPage]=useState(0);
 const records=snapshot.records;
 const filtered=useMemo(()=>records.filter(r=>(!onlyComplete||(r.price!==null&&r.eps!==null&&r.pe!==null))&&[r.ticker,r.name,r.sector].join(" ").toLowerCase().includes(query.toLowerCase().trim())),[onlyComplete,query,records]);
 const shown=filtered.slice(page*30,page*30+30);
 return <section className="panel wide" style={{overflowX:"auto"}}>
 <span className="overline">GOOGLE SHEETS → OPTIONSCRAFTED · PHASE 1</span>
 <h2>Market Explorer · Research Universe</h2>
 <p>Snapshot importato dal foglio Assets il {snapshot.exportedAt}. Dati reali del foglio, non quotazioni live; alcuni campi possono essere obsoleti. FCF e ROIC non sono ancora disponibili da questo export.</p>
 <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",margin:"16px 0"}}>
 <input aria-label="Search securities" placeholder="Search ticker, company, sector..." value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} style={{flex:"1 1 260px",minWidth:160,padding:12,border:"1px solid #cfdbeb",borderRadius:8}}/>
 <label style={{display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={onlyComplete} onChange={e=>{setOnlyComplete(e.target.checked);setPage(0)}}/> Show price + EPS + P/E</label>
 <span>{filtered.length} / {records.length} assets</span>
 </div>
 <table><thead><tr><th>Ticker</th><th>Company</th><th>Sector</th><th>Price</th><th>EPS TTM</th><th>P/E</th><th>Beta</th><th>Dividend Yield</th></tr></thead>
 <tbody>{shown.map(r=><tr key={r.ticker} style={{background:r.ticker===selectedTicker?"#e8f2fd":undefined}}><td><button type="button" onClick={()=>onSelect(r.ticker)} style={{fontWeight:700,color:"#1269ba",border:0,background:"transparent",cursor:"pointer",textDecoration:"underline"}} title={"Select "+r.ticker+" for Company Intelligence and Valuation"}>{r.ticker}</button></td><td>{r.name}</td><td>{r.sector||"N/D"}</td><td>{price(r.price,r.currency)}</td><td>{number(r.eps)}</td><td>{number(r.pe)}</td><td>{number(r.beta)}</td><td>{r.dividendYield===null?"N/D":number(r.dividendYield)+"%"}</td></tr>)}</tbody></table>
 {filtered.length===0&&<p>No matching securities.</p>}
 <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16}}><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} / {Math.max(1,Math.ceil(filtered.length/30))}</span><button type="button" disabled={(page+1)*30>=filtered.length} onClick={()=>setPage(p=>p+1)}>Next</button></div>
 <p style={{fontSize:12,marginTop:12}}>Select a ticker to carry it into Company Intelligence and Valuation Lab. Missing FCF and ROIC remain N/D; DCF requires your own FCF assumption. No API credentials included.</p>
 </section>
}
