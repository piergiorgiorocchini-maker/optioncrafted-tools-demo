import {useMemo,useState} from "react";
import {BarChart3,Calculator,Check,Database,Info,Search,X} from "lucide-react";
import snapshotJson from "../data/adminCoverageSnapshot.json";
import {getManualStatementData,type ManualStatementData} from "../data/googleSheetsManualFinancials";
import "./adminCoverage.css";

type CoverageMetric={id:string;label:string};
type CoverageGroup={id:string;label:string;metrics:CoverageMetric[]};
type CoverageTicker={ticker:string;name:string;sector:string;instrumentType?:string;valuationProfile?:string;present:Record<string,string[]>;notApplicable?:Record<string,string[]>;periodCounts?:Record<string,Record<string,number>>};
type CoverageSnapshot={schemaVersion:number;generatedAt:string;definition:string;source:string;universeCount:number;groups:CoverageGroup[];tickers:CoverageTicker[]};
const snapshot=snapshotJson as unknown as CoverageSnapshot;
type AdminStatementName="Income Statement"|"Balance Sheet"|"Cash Flow";
const adminStatementTabs:AdminStatementName[]=["Income Statement","Balance Sheet","Cash Flow"];
const formatAuditValue=(n:number|null|undefined,unit:string,label:string)=>{
 if(n===null||n===undefined||!Number.isFinite(n))return "—";
 if(unit.startsWith("USD bn")||unit.startsWith("shares bn"))return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n*1_000_000);
 if(unit==="USD/share")return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
 if(unit.startsWith("ratio"))return label.includes("Tax Rate")?(n*100).toFixed(1)+"%":n.toFixed(2);
 return String(n);
};
function ManualStatementAudit({data}:{data:ManualStatementData}){
 const [activeStatement,setActiveStatement]=useState<AdminStatementName>("Income Statement");
 const rows=data.statementDetail.filter(item=>item.statement===activeStatement);
 return <details className="admin-statement-details">
  <summary>NVDA statement detail · {data.statementDetail.length} rows</summary>
  <div className="coverage-panel-head admin-statement-head"><div><span className="coverage-section-kicker">ADMIN DETAIL</span><h3>NVDA · financial statements</h3><p>Reported lines, treatment notes, FY2023–FY2026 and TTM.</p></div></div>
  <div className="coverage-tabs" role="tablist" aria-label="Statement detail">
   {adminStatementTabs.map(statement=><button key={statement} type="button" role="tab" aria-selected={activeStatement===statement} className={activeStatement===statement?"active":""} onClick={()=>setActiveStatement(statement)}><span>{statement}</span></button>)}
  </div>
  <div className="admin-statement-scroll" role="tabpanel" aria-label={activeStatement}>
   <table className="admin-statement-table"><thead><tr><th>Reported metric</th><th>FY2023</th><th>FY2024</th><th>FY2025</th><th>FY2026</th><th>TTM</th><th>Handling and notes</th></tr></thead><tbody>
    {rows.map((item,index)=><tr key={index}><th scope="row">{item.reportedLabel}</th><td>{formatAuditValue(item.values.FY2023??null,item.unit,item.reportedLabel)}</td><td>{formatAuditValue(item.values.FY2024??null,item.unit,item.reportedLabel)}</td><td>{formatAuditValue(item.values.FY2025??null,item.unit,item.reportedLabel)}</td><td>{formatAuditValue(item.values.FY2026??null,item.unit,item.reportedLabel)}</td><td>{formatAuditValue(item.values.TTM??null,item.unit,item.reportedLabel)}</td><td><strong>{item.handling}</strong>{item.notes&&<small>{item.notes}</small>}</td></tr>)}
   </tbody></table>
  </div>
 </details>;
}

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
 const notApplicableCount=snapshot.tickers.reduce((sum,ticker)=>sum+(ticker.notApplicable?.[group.id]||[]).length,0);
 const totalCells=Math.max(0,snapshot.tickers.length*group.metrics.length-notApplicableCount);
 const missingCount=Math.max(0,totalCells-presentCount);
 const tickersWithAnyData=snapshot.tickers.filter(ticker=>(ticker.present[group.id]||[]).length>0).length;
 const filtered=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return snapshot.tickers.filter(ticker=>{
   const matches=!needle||(ticker.ticker+" "+ticker.name+" "+ticker.sector).toLowerCase().includes(needle);
   const values=new Set(ticker.present[group.id]||[]);
   const na=new Set(ticker.notApplicable?.[group.id]||[]);
   const hasMissing=group.metrics.some(metric=>!values.has(metric.id)&&!na.has(metric.id));
   return matches&&(!missingOnly||hasMissing);
  });
 },[query,missingOnly,group]);

 const updatedAt=new Intl.DateTimeFormat("it-IT",{dateStyle:"medium",timeStyle:"short"}).format(new Date(snapshot.generatedAt));
 const manualStatementData=getManualStatementData("NVDA");
 return <section className="admin-coverage">
  <header className="coverage-welcome">
   <div>
    <span className="coverage-eyebrow">ADMINISTRAZIONE · DATA COVERAGE</span>
    <h2>Copertura dati per ticker</h2>
    <p>Una matrice binaria per vedere subito quali campi sono presenti e quali mancano.</p>
   </div>
   <span className="coverage-readonly">SOLA LETTURA</span>
  </header>

  <div className="coverage-notice"><Info size={16}/><span>La matrice mostra dati presenti, mancanti e non applicabili per categoria. In Fundamentals, i calcoli SEC annuali aggiungono un SÌ solo ai campi con significato equivalente: non riempiono né rinominano i campi TTM. Il numero FY accanto a SÌ indica gli esercizi SEC disponibili; la presenza non significa che la serie sia completa.</span></div>

  <div className="coverage-stats">
   <article><small>TICKER NELL’UNIVERSO</small><strong>{snapshot.universeCount}</strong></article>
   <article><small>CAMPI NEL GRUPPO</small><strong>{group.metrics.length}</strong></article>
   <article className="coverage-stat-yes"><small>CELLE PRESENTI · SÌ</small><strong>{presentCount.toLocaleString("it-IT")}</strong><span>{tickersWithAnyData} ticker con almeno un campo presente</span></article>
   <article className="coverage-stat-no"><small>CELLE ASSENTI · NO</small><strong>{missingCount.toLocaleString("it-IT")}</strong></article>
   <article><small>NON APPLICABILI</small><strong>{notApplicableCount.toLocaleString("it-IT")}</strong></article>
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
       const na=new Set(ticker.notApplicable?.[group.id]||[]);
       return <tr key={ticker.ticker}>
        <th className="coverage-sticky coverage-ticker" scope="row">{ticker.ticker}</th>
        <td className="coverage-company">{ticker.name||"—"}</td>
        <td className="coverage-sector">{ticker.sector||"—"}</td>
        {group.metrics.map(metric=>{
         const yes=present.has(metric.id),notApplicable=na.has(metric.id);
         const periods=ticker.periodCounts?.[group.id]?.[metric.id]||0;
         return <td className="coverage-binary-cell" key={metric.id}><span className={notApplicable?"coverage-binary na":yes?"coverage-binary yes":"coverage-binary no"} aria-label={notApplicable?"Non applicabile":yes?"Presente":"Assente"}>{notApplicable?null:yes?<Check size={13}/>:<X size={13}/>}<b>{notApplicable?"N/A":yes?"SÌ":"NO"}</b>{yes&&periods>0?<small>{periods} FY</small>:null}</span></td>;
        })}
       </tr>;
      })}
      {!filtered.length&&<tr><td className="coverage-empty" colSpan={group.metrics.length+3}>Nessun ticker corrisponde ai filtri.</td></tr>}
     </tbody>
    </table>
   </div>
   <div className="coverage-legend"><span><i className="coverage-legend-dot yes-dot"></i>SÌ · disponibile</span><span><i className="coverage-legend-dot no-dot"></i>NO · mancante</span><span>N/A · non applicabile alla categoria</span></div>
  </section>
  {manualStatementData&&<ManualStatementAudit data={manualStatementData}/>}
 </section>;
}
