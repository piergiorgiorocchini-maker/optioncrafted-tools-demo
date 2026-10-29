import {useState} from "react";
import "./decision-tools.css";
export function ValuationDecisionTools({fcf,eps,price,currency="USD",horizon=5,growth=5,terminal=2.5}:{fcf:number|null;eps:number|null;price:number|null;currency?:string;horizon?:number;growth?:number;terminal?:number}){
 const [required,setRequired]=useState(12);
 const [exitPe,setExitPe]=useState(22);
 const [dividend,setDividend]=useState(0);
 const [divGrowth,setDivGrowth]=useState(4);
 const [showDividend,setShowDividend]=useState(false);
 const [heatDiscount,setHeatDiscount]=useState(10);
 const [heatGrowth,setHeatGrowth]=useState(growth);
 const money=(v:number|null)=>v===null||!Number.isFinite(v)?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(v);
 function dcf(start:number,r:number,g:number,t:number,n:number){if(start<=0||r<=t||r<=0)return null;let pv=0,last=start;for(let i=1;i<=n;i++){last*=1+g/100;pv+=last/Math.pow(1+r/100,i)}return pv+last*(1+t/100)/(r/100-t/100)/Math.pow(1+r/100,n)}
 const rates=[-4,-2,0,2,4].map(x=>heatDiscount+x),growths=[-4,-2,0,2,4].map(x=>heatGrowth+x),cells=rates.flatMap(r=>growths.map(g=>fcf===null?null:dcf(fcf,r,g,terminal,horizon))).filter((x):x is number=>x!==null);const low=Math.min(...cells),high=Math.max(...cells);
 const valid=eps!==null&&eps>0&&horizon>0&&required>=0&&exitPe>0;
 const futureEps=valid?eps*Math.pow(1+growth/100,horizon):null;
 const futureDiv=showDividend?Array.from({length:horizon},(_,i)=>dividend*Math.pow(1+divGrowth/100,i+1)):Array(horizon).fill(0);
 const pvDiv=futureDiv.reduce((acc,c,i)=>acc+c/Math.pow(1+required/100,i+1),0);
 const maxEntry=futureEps===null?null:futureEps*exitPe/Math.pow(1+required/100,horizon)+pvDiv;
 const currentReturn=maxEntry!==null&&price!==null&&price>0?((maxEntry/price-1)*100):null;
 return <div className="vdt-stack">
 <section className="vdt-card"><div className="vdt-header"><div><span>DCF SCENARIO ENGINE</span><h3>Sensitivity Heatmap</h3></div><b>USER ASSUMPTIONS</b></div><p>Intrinsic value per share by required return (rows) and cash-flow growth (columns). Terminal growth {terminal}%, forecast {horizon} years.</p>
 <div className="vdt-fields"><label>Center discount % <input type="number" step="0.5" value={heatDiscount} onChange={e=>setHeatDiscount(Number(e.target.value))}/></label><label>Center FCF growth % <input type="number" step="0.5" value={heatGrowth} onChange={e=>setHeatGrowth(Number(e.target.value))}/></label></div>
 <div className="vdt-table-scroll"><table className="vdt-matrix"><thead><tr><th>Rate ↓ / Growth →</th>{growths.map((g,i)=><th key={i}>{g.toFixed(1)}%</th>)}</tr></thead><tbody>{rates.map((r,i)=><tr key={i}><th>{r.toFixed(1)}%</th>{growths.map((g,j)=>{const v=fcf===null?null:dcf(fcf,r,g,terminal,horizon);const intensity=v===null||high<=low?0.4:(v-low)/(high-low);return <td key={j} style={{background:v===null?"#f4f7fa":`rgba(22,126,210,${0.08+intensity*0.32})`}} title={"Discount "+r+"%; growth "+g+"%"}>{money(v)}</td>})}</tr>)}</tbody></table></div><p className="vdt-note">Cells are scenario outputs, not probability forecasts. N/D when FCF is missing or discount rate does not exceed terminal growth.</p>
 </section>
 <section className="vdt-card"><div className="vdt-header"><div><span>INVESTOR RETURN TARGET</span><h3>Required Return Entry Price</h3></div><b>NOT AN INTRINSIC FAIR VALUE</b></div><p>EPS-based investor return model: maximum acquisition price for a specified compound return, terminal P/E and dividend assumptions. Distinct from the intrinsic DCF above. Exploratory approximation, not the authoritative original calculator. Use the integrated Tools Workbench for the existing model and complete outputs.</p>
 <div className="vdt-fields">{[["Target annual return %",required,setRequired],["Exit P/E",exitPe,setExitPe],["Starting annual dividend / share",dividend,setDividend],["Annual dividend growth %",divGrowth,setDivGrowth]].map(([label,value,fn])=><label key={label as string}>{label as string}<input type="number" step="0.5" value={value as number} onChange={e=>(fn as (n:number)=>void)(Number(e.target.value))}/></label>)}</div>
 <label className="vdt-toggle"><input type="checkbox" checked={showDividend} onChange={e=>setShowDividend(e.target.checked)}/> Include dividends in target-return calculation</label>
 <div className="vdt-results"><div><small>Required-return entry price</small><strong>{money(maxEntry)}</strong></div><div><small>Reference market price</small><strong>{money(price)}</strong></div><div><small>Entry price / market price gap</small><strong>{currentReturn===null?"N/D":currentReturn.toFixed(1)+"%"}</strong></div></div>
 <p className="vdt-note">Projection uses current EPS × (1 + growth) ^ {horizon}, terminal P/E and discounted future cash dividends. Dividends and earnings growth are editable assumptions, not estimates supplied by Apple. Do not combine this price mechanically with intrinsic fair values.</p>
 </section></div>;
}
