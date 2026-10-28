import "./football-field.css";
type Method={label:string;low:number|null;mid:number|null;high:number|null;kind:"intrinsic"|"entry"|"pending";detail:string};
export function ValuationFootballField({price,currency="USD",bear,base,bull,mos=25,source="USER ASSUMPTIONS",extra=[]}:{price:number|null;currency?:string;bear:number|null;base:number|null;bull:number|null;mos?:number;source?:string;extra?:Method[]}){
 const money=(n:number|null)=>n===null?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(n);
 const dcf:[number|null,number|null,number|null]=bear!==null&&base!==null&&bull!==null?[Math.min(bear,base,bull),base,Math.max(bear,base,bull)]:[null,null,null];
 const methods:Method[]=[
 {label:"DCF scenarios",low:dcf[0],mid:dcf[1],high:dcf[2],kind:"intrinsic",detail:"Bear / base / bull from editable assumptions"},
 {label:"DCF buy-under (MOS)",low:base===null?null:base*(1-mos/100),mid:base===null?null:base*(1-mos/100),high:base===null?null:base*(1-mos/100),kind:"entry",detail:mos+"% margin of safety from DCF base"},
 {label:"Graham / earnings power",low:null,mid:null,high:null,kind:"pending",detail:"Pending normalized earnings and model validation"},
 {label:"DDM / dividend value",low:null,mid:null,high:null,kind:"pending",detail:"Pending sustainable dividends and assumptions"},
 {label:"Peer comparables",low:null,mid:null,high:null,kind:"pending",detail:"Pending verified sector peers and accounting adjustments"},
 ...extra
 ];
 const numbers=[price,...methods.flatMap(m=>[m.low,m.mid,m.high])].filter((x):x is number=>x!==null&&Number.isFinite(x)&&x>=0);
 const axisMax=Math.max(1,...numbers)*1.12;
 const pos=(n:number)=>Math.max(0,Math.min(100,n/axisMax*100));
 return <section className="ff-panel"><div className="ff-header"><div><span>VALUATION TRIANGULATION</span><h3>Valuation Football Field</h3></div><b>{source}</b></div><p>Intrinsic value estimates and entry thresholds are different concepts. Pending methodologies are visible without fictional results.</p>
 <div className="ff-legend"><span><i className="ff-dot ff-blue"/> Intrinsic value</span><span><i className="ff-dot ff-gold"/> Entry threshold</span><span><i className="ff-dot ff-black"/> Reference price</span></div>
 <div className="ff-plot" role="img" aria-label="Valuation range comparison and market price"><div className="ff-price-line" style={{left:price===null?"-10px":pos(price)+"%"}}/>
 {methods.map(m=><div key={m.label} className="ff-row"><div className="ff-label"><strong>{m.label}</strong><small>{m.detail}</small></div><div className="ff-track">{m.low!==null&&m.high!==null&&m.mid!==null?<><div className={m.kind==="entry"?"ff-range ff-gold-range":"ff-range"} style={{left:pos(m.low)+"%",width:Math.max(.8,pos(m.high)-pos(m.low))+"%"}}/><div className={m.kind==="entry"?"ff-median ff-gold-median":"ff-median"} style={{left:pos(m.mid)+"%"}} title={m.label+": "+money(m.mid)}/></>:<span className="ff-pending">DATA PENDING</span>}</div><div className="ff-value">{money(m.mid)}</div></div>)}
 <div className="ff-scale"><span>0</span><span>{money(axisMax/2)}</span><span>{money(axisMax)}</span></div></div>
 <div className="ff-footer"><strong>Reference price: {money(price)}</strong><span>Scenario outputs are not independently estimated probabilities. No averaging of entry thresholds with intrinsic values.</span></div></section>;
}
