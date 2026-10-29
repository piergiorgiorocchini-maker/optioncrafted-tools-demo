import {useEffect,useRef,useState} from "react";
import {ExternalLink,ShieldCheck} from "lucide-react";
import "./legacy-tools.css";

type Section="core"|"probability"|"strategies"|"edge";
const areas:{id:Section;label:string;description:string;url:string}[]=[
 {id:"core",label:"Core Calculators",description:"Fair Value · Dividend Value · Graham–Lynch · CSP · Covered Call · Wheel · Portfolio Income",url:"../tools/?embedded=1"},
 {id:"probability",label:"Probability Station",description:"Seasonality · volatility · strike probability · risk context",url:"../tools/probability-station/?embedded=1"},
 {id:"strategies",label:"Options Strategy Lab",description:"Option payoff curves · multi-leg structures · risk/reward",url:"../tools/options-strategy-lab/?embedded=1"},
 {id:"edge",label:"Edge Station",description:"Hedging · repair scenarios · net payoff and capital impact",url:"../tools/edge-station/?embedded=1"}
];
export function LegacyToolsWorkspace({initialSection="core"}:{initialSection?:Section}){
 const [section,setSection]=useState<Section>(initialSection);
 const [height,setHeight]=useState(900);
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{setSection(initialSection)},[initialSection]);
 useEffect(()=>{setHeight(900)},[section]);
 useEffect(()=>{
  function onMessage(event:MessageEvent){
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
   const data=event.data;
   if(data&&data.type==="oc:embedded-height"&&typeof data.height==="number"&&Number.isFinite(data.height)){
    setHeight(Math.max(650,Math.min(18000,Math.ceil(data.height)+20)));
   }
  }
  window.addEventListener("message",onMessage);
  return ()=>window.removeEventListener("message",onMessage);
 },[]);
 const selected=areas.find(a=>a.id===section)!;
 const standalone=selected.url.replace("?embedded=1","");
 return <div className="legacy-workspace">
  <section className="legacy-intro">
   <div><span className="overline">OPTIONSCRAFTED / INTEGRATED ANALYTICAL TOOLS</span><h2>Tools & Strategy Workbench</h2><p>Original financial engines, complete inputs, calculated outputs, tables and charts. Presented within the OptionsCrafted research workspace without rewriting or silently changing the calculations.</p></div>
   <span className="legacy-engine-status"><ShieldCheck size={15}/> ORIGINAL ENGINES</span>
  </section>
  <div className="legacy-tabs" role="group" aria-label="Select an analytical tool family">
   {areas.map(a=><button type="button" key={a.id} className={a.id===section?"active":""} onClick={()=>setSection(a.id)} aria-pressed={a.id===section}>{a.label}</button>)}
  </div>
  <div className="legacy-section-heading"><div><h3>{selected.label}</h3><p>{selected.description}</p></div><a href={standalone} target="_blank" rel="noreferrer">Open original <ExternalLink size={14}/></a></div>
  <iframe ref={frame} key={section} title={selected.label+" · original OptionsCrafted calculators"} src={selected.url} style={{height}} className="legacy-frame" onLoad={()=>{if(frame.current?.contentDocument){const body=frame.current.contentDocument.body;setHeight(Math.max(650,Math.min(18000,body.scrollHeight+20)))}}}/>
  <p className="legacy-disclaimer">Embedded presentation layer only. Calculation logic, outputs and charts are loaded from the existing tool pages. Data sources and model assumptions remain those of the original tools; the tier selector is a visual prototype, not access control.</p>
 </div>;
}
