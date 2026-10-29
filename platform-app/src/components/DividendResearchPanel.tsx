import {useState} from "react";
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {ChevronDown,ChevronUp,Database} from "lucide-react";
import {dividendModel,money} from "../core/valuationModels";
import "./dividend-research.css";

type DdmResult=ReturnType<typeof dividendModel>;
type Props={
 result:DdmResult;
 currentDividend:number|null;
 currency:string;
 growth:number;
 terminalGrowth:number;
 discount:number;
};

export function DividendResearchPanel({result,currentDividend,currency,growth,terminalGrowth,discount}:Props){
 const [showAll,setShowAll]=useState(false);
 const impliedYield=result&&currentDividend!==null&&result.value>0?currentDividend/result.value*100:null;
 const rows=result?.projection.slice(0,showAll?30:10)??[];
 const pct=(n:number)=>Number.isFinite(n)?n.toFixed(2)+"%":"N/D";
 const invalidSpread=Number.isFinite(discount)&&Number.isFinite(terminalGrowth)&&discount<=terminalGrowth;
 return <div className="nr-dividend-panel">
  <section className="nr-dividend-summary" aria-label="Dividend discount model results">
   <div className="nr-section-title">
    <div><span className="nr-eyebrow">DIVIDEND DISCOUNT MODEL / OUTPUTS</span><h3>Dividend value & return threshold</h3></div>
    <span className="nr-status">30-YEAR MODEL · NOT A QUOTE</span>
   </div>
   <div className="nr-dividend-metrics">
    <div className="nr-metric nr-dividend-primary"><span>Primary output · Buy now below</span><strong>{money(result?.value??null,currency)}</strong><small>DDM value at {pct(discount)} required return</small></div>
    <div className="nr-metric"><span>Implied dividend yield</span><strong>{impliedYield===null?"N/D":pct(impliedYield)}</strong><small>Current dividend / modeled value</small></div>
    <div className="nr-metric"><span>PV of 30-year dividends</span><strong>{money(result?.pvDividends??null,currency)}</strong><small>Discounted annual payments</small></div>
    <div className="nr-metric"><span>Terminal value · year 30</span><strong>{money(result?.terminalValue??null,currency)}</strong><small>Undiscounted perpetuity value</small></div>
    <div className="nr-metric"><span>PV of terminal value</span><strong>{money(result?.pvTerminal??null,currency)}</strong><small>Terminal value discounted to today</small></div>
    <div className="nr-metric"><span>Year-30 dividend</span><strong>{money(result?.year30Dividend??null,currency)}</strong><small>Projected annual dividend / share</small></div>
   </div>
  </section>
  <section className="nr-dividend-body" aria-label="Dividend projection and valuation explanation">
   <div className="nr-control-card nr-dividend-schedule">
    <div className="nr-section-title"><div><span className="nr-eyebrow">FORECAST TRANSPARENCY</span><h3>30-Year Dividend Discount Schedule</h3></div><span className="nr-status">YEAR BY YEAR</span></div>
    <p className="nr-dividend-note">Years 1–10 use the initial dividend growth rate. Years 11–30 use perpetual growth. Every annual dividend is discounted to today.</p>
    {result?<><div className="nr-dividend-table-scroll"><table className="nr-dividend-table">
     <thead><tr><th>Year</th><th>Dividend</th><th>PV cash flow</th><th>Terminal value</th></tr></thead>
     <tbody>
      {rows.map(row=><tr key={row.year}><td>{row.year}</td><td>{money(row.dividend,currency)}</td><td>{money(row.pv,currency)}</td><td>—</td></tr>)}
      {showAll&&<tr className="nr-dividend-terminal-row"><td>Terminal</td><td>—</td><td>{money(result.pvTerminal,currency)}</td><td>{money(result.terminalValue,currency)}</td></tr>}
     </tbody>
    </table></div>
    <button type="button" className="nr-dividend-expand" aria-expanded={showAll} onClick={()=>setShowAll(v=>!v)}>
     {showAll?<><ChevronUp size={14}/> Show first 10 years</>:<><ChevronDown size={14}/> Show all 30 years + terminal value</>}
    </button>
    <div className="nr-dividend-table-total"><span>Total DDM value</span><strong>{money(result.value,currency)}</strong></div>
    </>:<div className="nr-empty">{invalidSpread?"The required return must exceed perpetual dividend growth.":"Enter a positive annual dividend and valid growth/return assumptions to calculate the 30-year schedule."}</div>}
   </div>
   <div className="nr-dividend-visual-column">
    <div className="nr-dividend-chart">
     <div className="nr-section-title"><div><span className="nr-eyebrow">EXPECTED DIVIDEND GROWTH</span><h3>Dividend Projection & Discounted Value</h3></div><span className="nr-status">30-YEAR SCENARIO</span></div>
     <p className="nr-dividend-note">Navy: projected annual dividend. Gold: present value of each dividend. Terminal value is shown separately in the valuation summary.</p>
     {result?<><ResponsiveContainer width="100%" height={298}>
      <BarChart data={result.projection} margin={{top:14,right:5,left:0,bottom:2}} barGap={1} barCategoryGap="12%">
       <CartesianGrid stroke="#e3eaf2" strokeDasharray="3 4" vertical={false}/>
       <XAxis dataKey="year" interval={0} tickFormatter={v=>v===1||v%5===0?"Y"+v:""} stroke="#8193a7" tickLine={false} axisLine={false} tick={{fontSize:10}} dy={5}/>
       <YAxis stroke="#8193a7" tickLine={false} axisLine={false} width={64} tick={{fontSize:10}} tickFormatter={v=>money(Number(v),currency)}/>
       <Tooltip contentStyle={{background:"#fff",border:"1px solid #d1ddea",borderRadius:9,color:"#16334e",boxShadow:"0 6px 18px #1939591a"}} itemStyle={{color:"#16334e"}} formatter={v=>money(Number(v),currency)} labelFormatter={v=>"Year "+v}/>
       <Bar dataKey="dividend" name="Projected dividend" fill="#142744" radius={[2,2,0,0]} maxBarSize={16}/>
       <Bar dataKey="pv" name="Discounted dividend" fill="#d2a126" radius={[2,2,0,0]} maxBarSize={16}/>
      </BarChart>
     </ResponsiveContainer><div className="nr-dividend-legend"><span><i className="nr-dividend-legend-navy"/> Projected dividend</span><span><i className="nr-dividend-legend-gold"/> Discounted dividend</span></div></>:<div className="nr-dividend-empty"><Database size={25}/><strong>Projection awaits valid inputs</strong><span>No invented dividend series is displayed.</span></div>}
    </div>
    <div className="nr-dividend-interpretation">
     <span className="nr-eyebrow">MODEL INTERPRETATION</span>
     {result?<p>Starting from an annual dividend of <strong>{money(currentDividend,currency)}</strong>, the model assumes <strong>{pct(growth)}</strong> growth for years 1–10, followed by <strong>{pct(terminalGrowth)}</strong> from year 11 onward. Discounting at <strong>{pct(discount)}</strong> produces <strong>{money(result.pvDividends,currency)}</strong> in present value from 30 annual dividends. The year-30 terminal value is <strong>{money(result.terminalValue,currency)}</strong>, worth <strong>{money(result.pvTerminal,currency)}</strong> today. Their sum is a modeled dividend value of <strong>{money(result.value,currency)}</strong>, implying a starting dividend yield of <strong>{impliedYield===null?"N/D":pct(impliedYield)}</strong>.</p>:<p>The 30-year dividend forecast, discounted annual payments, terminal value and implied yield will appear once the dividend input and assumptions are valid.</p>}
     <small>DDM assumes sustainable dividend payments and long-run growth. Terminal value can be highly sensitive to the gap between discount rate and perpetual growth. This is a scenario estimate, not a market quote or an independent guarantee of intrinsic value.</small>
    </div>
   </div>
  </section>
 </div>;
}
