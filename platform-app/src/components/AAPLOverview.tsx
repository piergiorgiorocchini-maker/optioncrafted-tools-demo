import {NavLink} from "react-router-dom";
import snapshot from "../data/assetsSnapshot.json";
import aapl from "../data/aaplResearch.json";
import {WorkspaceTour} from "./WorkspaceTour";
const asset=snapshot.records.find(x=>x.ticker==="AAPL");
export function AAPLOverview(){
 const price=asset?.price??null;
 const money=(n:number|null)=>n===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
 return <div style={{gridColumn:"1/-1",display:"grid",gap:16}}>
 <section className="hero wide"><div><span className="overline">OPTIONSCRAFTED / REAL RESEARCH WORKSPACE</span><h2>Apple Inc. · AAPL</h2><p>One fully sourced company to validate business quality, valuation, margin of safety and option execution. No fictional companies.</p><div className="hero-actions"><NavLink to="/company">Explore Company →</NavLink><NavLink to="/valuation">Open Valuation Lab →</NavLink></div></div><div className="hero-symbol"><span>RESEARCH SECURITY</span><strong>AAPL</strong><small>SEC financials + Google Sheets</small></div></section>
 <div className="workflow-grid">{[["REFERENCE PRICE",money(price),"Sheets snapshot "+snapshot.exportedAt],["EPS TTM",money(asset?.eps??null),"Sheets snapshot"],["FCF / SHARE",money(aapl.fcfPerShare),"SEC TTM, approximate"],["ROIC · GROSS",aapl.roic.toFixed(1)+"%","SEC, normalized tax, cash-inclusive"]].map(([k,v,s])=><article key={k} className="workflow-step"><span>{k}</span><h3>{v}</h3><p>{s}</p></article>)}</div>
 <section className="panel wide"><span className="overline">RESEARCH WORKFLOW</span><h2>Quality → Valuation → Allocation → Risk → Time</h2><p>SEC source history and latest known snapshot are connected for AAPL. Peer ROIC analysis, full valuation triangulation and live option chains remain pending. Each module remains visible during development.</p></section><WorkspaceTour/></div>;
}
