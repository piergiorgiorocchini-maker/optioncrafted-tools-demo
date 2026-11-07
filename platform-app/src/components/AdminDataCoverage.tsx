import {useMemo,useState} from "react";
import {BarChart3,Calculator,Check,Database,Info,Search,X} from "lucide-react";
import snapshotJson from "../data/adminCoverageSnapshot.json";
import "./adminCoverage.css";

type CoverageMetric={id:string;label:string};
type CoverageGroup={id:string;label:string;metrics:CoverageMetric[]};
type CoverageTicker={ticker:string;name:string;sector:string;present:Record<string,string[]>};
type CoverageSnapshot={schemaVersion:number;generatedAt:string;definition:string;source:string;universeCount:number;groups:CoverageGroup[];tickers:CoverageTicker[]};
const snapshot=snapshotJson as unknown as CoverageSnapshot;

const groupIcon=(id:string)=>{
 if(id==="market")return <BarChart3 size={16}/>;
 if(id==="sec")return <Database size={16}/>;
 return <Calculator size={16}/>;
};

export function AdminDataCoverage(){
 const [activeGroupId,setActiveGroupId]=useState("sec");
 const [query,setQuery]=useState("");
 const [missingOnly,setMissingOnly]=useState(false);
 const group=snapshot.groups.find(item=>item.id===activeGroupId)||snapshot.groups[0];
 const presentCount=snapshot.tickers.reduce((sum,ticker)=>sum+(ticker.present[group.id]||[]).length,0);
 const totalCells=snapshot.tickers.length*group.metrics.length;
 const missingCount=Math.max(0,totalCells-presentCount);
 const tickersWithAnyData=snapshot.tickers.filter(ticker=>(ticker.present[group.id]||[]).length>0).length;
 const filtered=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return snapshot.tickers.filter(ticker=>{
   const matches=!needle||(ticker.ticker+" "+ticker.name+" "+ticker.sector).toLowerCase().includes(needle);
   const values=new Set(ticker.present[group.id]||[]);
   const hasMissing=group.metrics.some(metric=>!values.has(metric.id));
   return matches&&(!missingOnly||hasMissing);
  });
 },[query,missingOnly,group]);

 const updatedAt=new Intl.DateTimeFormat("it-IT",{dateStyle:"medium",timeStyle:"short"}).format(new Date(snapshot.generatedAt));
 return <section className="admin-coverage">
  <header className="coverage-welcome">
   <div>
    <span className="coverage-eyebrow">ADMINISTRAZIONE · DATA COVERAGE</span>
    <h2>Copertura dati per ticker</h2>
    <p>Una matrice binaria per vedere subito quali campi sono presenti e quali mancano.</p>
   </div>
   <span className="coverage-readonly">SOLA LETTURA</span>
  </header>

  <div className="coverage-notice"><Info size={16}/><span>Il pannello è un’anteprima amministrativa read-only. SÌ significa che esiste almeno un valore per quel campo; NO significa che non è presente. Non indica quanti esercizi sono coperti né la qualità del dato. Login e permessi reali non sono ancora attivi.</span></div>

  <div className="coverage-stats">
   <article><small>TICKER NELL’UNIVERSO</small><strong>{snapshot.universeCount}</strong></article>
   <article><small>CAMPI NEL GRUPPO</small><strong>{group.metrics.length}</strong></article>
   <article className="coverage-stat-yes"><small>CELLE PRESENTI · SÌ</small><strong>{presentCount.toLocaleString("it-IT")}</strong><span>{tickersWithAnyData} ticker con almeno un campo presente</span></article>
   <article className="coverage-stat-no"><small>CELLE ASSENTI · NO</small><strong>{missingCount.toLocaleString("it-IT")}</strong></article>
  </div>

  <section className="coverage-panel">
   <div className="coverage-panel-head">
    <div><span className="coverage-section-kicker">MATRICE DI DISPONIBILITÀ</span><h3>{group.label}</h3><p>{snapshot.source} · aggiornato {updatedAt}</p></div>
    <label className="coverage-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cerca ticker, società o settore" aria-label="Cerca ticker, società o settore"/></label>
   </div>

   <div className="coverage-tabs" role="tablist" aria-label="Tipo di dati">
    {snapshot.groups.map(item=><button key={item.id} type="button" role="tab" aria-selected={item.id===group.id} className={item.id===group.id?"active":""} onClick={()=>setActiveGroupId(item.id)}>{groupIcon(item.id)}<span>{item.label}</span><small>{item.metrics.length}</small></button>)}
   </div>

   <div className="coverage-controls">
    <label><input type="checkbox" checked={missingOnly} onChange={event=>setMissingOnly(event.target.checked)}/> Mostra solo ticker con almeno un campo NO</label>
    <span>{filtered.length} di {snapshot.universeCount} ticker</span>
   </div>

   <div className="coverage-table-scroll" role="region" aria-label={"Matrice binaria: "+group.label} tabIndex={0}>
    <table className="coverage-table">
     <thead><tr><th className="coverage-sticky ticker-heading" scope="col">Ticker</th><th scope="col">Società</th><th scope="col">Settore</th>{group.metrics.map(metric=><th className="coverage-metric-heading" scope="col" key={metric.id} title={metric.label}>{metric.label}</th>)}</tr></thead>
     <tbody>
      {filtered.map(ticker=>{
       const present=new Set(ticker.present[group.id]||[]);
       return <tr key={ticker.ticker}>
        <th className="coverage-sticky coverage-ticker" scope="row">{ticker.ticker}</th>
        <td className="coverage-company">{ticker.name||"—"}</td>
        <td className="coverage-sector">{ticker.sector||"—"}</td>
        {group.metrics.map(metric=>{
         const yes=present.has(metric.id);
         return <td className="coverage-binary-cell" key={metric.id}><span className={yes?"coverage-binary yes":"coverage-binary no"} aria-label={yes?"Presente":"Assente"}>{yes?<Check size={13}/>:<X size={13}/>}<b>{yes?"SÌ":"NO"}</b></span></td>;
        })}
       </tr>;
      })}
      {!filtered.length&&<tr><td className="coverage-empty" colSpan={group.metrics.length+3}>Nessun ticker corrisponde ai filtri.</td></tr>}
     </tbody>
    </table>
   </div>
   <div className="coverage-legend"><span><i className="coverage-legend-dot yes-dot"></i>SÌ · presente</span><span><i className="coverage-legend-dot no-dot"></i>NO · assente</span></div>
  </section>
 </section>;
}
