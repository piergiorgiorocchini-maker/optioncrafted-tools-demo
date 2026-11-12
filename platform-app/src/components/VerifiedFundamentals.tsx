import {useState} from "react";
import {googleSheetsSecAnnualHistory,type SecAnnualFinancialYear} from "../data/googleSheetsSecFinancials";
import {getManualStatementData,type ManualStatementData} from "../data/googleSheetsManualFinancials";
import {getSecFinancialClassification} from "../data/secFinancialBridge";
import "./verifiedFundamentals.css";

type RawMetric={key:keyof SecAnnualFinancialYear;label:string;unit:"amount"|"perShare"|"shares"};
type CalculatedMetric={key:keyof SecAnnualFinancialYear;label:string;unit:"amount"|"perShare"|"ratio"|"percent"|"multiple";method:string;financialNA?:boolean;reitNA?:boolean};
const rawMetrics:RawMetric[]=[
 {key:"revenue",label:"Revenue",unit:"amount"},{key:"grossProfit",label:"Gross profit",unit:"amount"},
 {key:"netIncome",label:"Net income",unit:"amount"},{key:"operatingIncome",label:"Operating income",unit:"amount"},
 {key:"depreciationAndAmortization",label:"Depreciation & amortization",unit:"amount"},{key:"interestExpense",label:"Interest expense",unit:"amount"},
 {key:"dilutedShares",label:"Weighted-average diluted shares",unit:"shares"},
 {key:"cashFromOperations",label:"Operating cash flow",unit:"amount"},{key:"capex",label:"Capital expenditure",unit:"amount"},
 {key:"dilutedEps",label:"Diluted EPS",unit:"perShare"},{key:"cash",label:"Cash & equivalents",unit:"amount"},
 {key:"currentAssets",label:"Current assets",unit:"amount"},{key:"currentLiabilities",label:"Current liabilities",unit:"amount"},
 {key:"inventory",label:"Inventory",unit:"amount"},{key:"totalAssets",label:"Total assets",unit:"amount"},
 {key:"totalLiabilities",label:"Total liabilities",unit:"amount"},{key:"equity",label:"Shareholders' equity",unit:"amount"},
 {key:"longTermDebt",label:"Long-term debt",unit:"amount"},{key:"shortTermDebt",label:"Short-term debt",unit:"amount"}
];
const calculatedMetrics:CalculatedMetric[]=[
 {key:"freeCashFlow",label:"Free cash flow",unit:"amount",method:"Operating cash flow − CapEx",financialNA:true},
 {key:"freeCashFlowPerShare",label:"FCF per share",unit:"perShare",method:"Annual FCF ÷ diluted shares; SEC reported shares where available, otherwise implied shares",financialNA:true,reitNA:true},
 {key:"totalDebt",label:"Total debt",unit:"amount",method:"Long-term debt + short-term debt",financialNA:true},
 {key:"netDebt",label:"Net debt",unit:"amount",method:"Total debt − cash",financialNA:true},
 {key:"debtEquity",label:"Debt / equity",unit:"ratio",method:"Total debt ÷ shareholders' equity",financialNA:true},
 {key:"currentRatio",label:"Current ratio",unit:"ratio",method:"Current assets ÷ current liabilities",financialNA:true},
 {key:"ebitda",label:"EBITDA",unit:"amount",method:"SEC operating income + depreciation and amortization",financialNA:true},
 {key:"netDebtEbitda",label:"Net debt / EBITDA",unit:"ratio",method:"Net debt ÷ positive EBITDA",financialNA:true},
 {key:"interestCoverage",label:"Interest coverage",unit:"ratio",method:"Operating income ÷ absolute interest expense",financialNA:true},
 {key:"grossMargin",label:"Gross margin",unit:"percent",method:"Gross profit ÷ revenue",financialNA:true},
 {key:"operatingMargin",label:"Operating margin",unit:"percent",method:"Operating income ÷ revenue",financialNA:true},
 {key:"netMargin",label:"Net margin",unit:"percent",method:"Net income ÷ revenue",financialNA:true},
 {key:"roe",label:"Return on equity",unit:"percent",method:"Net income ÷ average year-end equity"},
 {key:"roic",label:"ROIC estimate",unit:"percent",method:"Operating income × (1 − 21% assumed tax) ÷ average invested capital",financialNA:true,reitNA:true},
 {key:"revenueCagr3y",label:"Revenue CAGR · 3Y",unit:"percent",method:"Three-year CAGR using matched annual periods"},
 {key:"revenueCagr5y",label:"Revenue CAGR · 5Y",unit:"percent",method:"Five-year CAGR using matched annual periods"},
 {key:"normalizedEps5y",label:"Normalized EPS · 5Y median",unit:"perShare",method:"Median of five positive annual diluted EPS observations"},
 {key:"epsCagr3y",label:"Diluted EPS CAGR · 3Y",unit:"percent",method:"Three-year CAGR; all annual EPS observations must be positive"},
 {key:"epsCagr5y",label:"Diluted EPS CAGR · 5Y",unit:"percent",method:"Five-year CAGR; all annual EPS observations must be positive"},
 {key:"fcfCagr5y",label:"FCF CAGR · 5Y",unit:"percent",method:"Five-year CAGR; all annual FCF observations must be positive",financialNA:true,reitNA:true},
 {key:"historicalPe",label:"Fiscal year-end P/E",unit:"multiple",method:"Fiscal year-end close ÷ same-year diluted EPS"}
];
const value=(row:SecAnnualFinancialYear,key:keyof SecAnnualFinancialYear):number|null=>{
 const v=row[key];return typeof v==="number"&&Number.isFinite(v)?v:null;
};
const format=(n:number|null,unit:RawMetric["unit"]|CalculatedMetric["unit"],currency:string)=>{
 if(n===null)return "N/D";
 if(unit==="amount")return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n/1e9)+" B";
 if(unit==="shares")return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n/1e9)+" B shares";
 if(unit==="perShare")return new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(n);
 if(unit==="percent")return (n*100).toFixed(1)+"%";
 if(unit==="multiple")return n.toFixed(2)+"x";
 return n.toFixed(2);
};
type ManualUnit="amount"|"perShare"|"shares"|"percent";
const formatManual=(n:number|null|undefined,unit:ManualUnit)=>{
 if(n===null||n===undefined||!Number.isFinite(n))return "N/D";
 if(unit==="amount"){const absolute=Math.abs(n);return n<0?"−$"+(absolute>=1e9?(absolute/1e9).toFixed(2)+"B":(absolute/1e6).toFixed(0)+"M"):"$"+(absolute>=1e9?(absolute/1e9).toFixed(2)+"B":(absolute/1e6).toFixed(0)+"M");}
 if(unit==="shares")return (n/1e9).toFixed(2)+"B shares";
 if(unit==="perShare")return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
 if(unit==="percent")return (n*100).toFixed(1)+"%";
 return String(n);
};
const formatDetail=(n:number|null,unit:string,label:string)=>{
 if(n===null)return "—";
 if(unit.startsWith("USD bn"))return n<0?"−$"+(Math.abs(n)>=1?Math.abs(n).toFixed(2)+"B":(Math.abs(n)*1000).toFixed(0)+"M"):"$"+(Math.abs(n)>=1?Math.abs(n).toFixed(2)+"B":(Math.abs(n)*1000).toFixed(0)+"M");
 if(unit.startsWith("shares bn"))return n.toFixed(2)+"B";
 if(unit==="USD/share")return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
 if(unit.startsWith("ratio"))return label==="Tax Rate, Calculated"?(n*100).toFixed(1)+"%":n.toFixed(2)+"x";
 return String(n);
};
function ManualTtmPanel({data}:{data:ManualStatementData}){
 const t=data.ttm,b=data.balanceSheet;
 const inputRows:{label:string;value:number|null;unit:ManualUnit;detail:string}[]=[
  {label:"Revenue",value:t.revenue,unit:"amount",detail:"TTM input · cross-checked to SEC Company Facts"},
  {label:"Gross profit",value:t.grossProfit,unit:"amount",detail:"TTM input"},
  {label:"Cost of revenue",value:t.costOfRevenue,unit:"amount",detail:"Source expense sign normalized to positive magnitude"},
  {label:"Net income",value:t.netIncome,unit:"amount",detail:"TTM input"},
  {label:"Operating income",value:t.operatingIncome,unit:"amount",detail:"TTM input"},
  {label:"Diluted EPS",value:t.dilutedEps,unit:"perShare",detail:"TTM input · primary EPS for Valuation Lab"},
  {label:"Diluted weighted-average shares",value:t.dilutedShares,unit:"shares",detail:"TTM input"},
  {label:"Operating cash flow",value:t.cashFromOperations,unit:"amount",detail:"TTM input"},
  {label:"Capital expenditure",value:t.capex,unit:"amount",detail:"TTM input · positive expense magnitude"},
  {label:"Depreciation & amortization",value:t.depreciationAndAmortization,unit:"amount",detail:"TTM input · SEC cross-check"},
  {label:"Interest expense",value:t.interestExpense,unit:"amount",detail:"TTM input · source screenshot figure"},
  {label:"Standard free cash flow",value:t.freeCashFlow,unit:"amount",detail:"Calculated as operating cash flow − CapEx"},
  {label:"FCF per diluted share",value:t.freeCashFlowPerShare,unit:"perShare",detail:"Calculated as standard FCF ÷ diluted weighted-average shares"},
  {label:"Core EBITDA estimate",value:t.calculatedEbitda,unit:"amount",detail:"Calculated as operating income + D&A"},
  {label:"Gross margin",value:t.grossMargin,unit:"percent",detail:"Calculated as gross profit ÷ revenue"},
  {label:"Operating margin",value:t.operatingMargin,unit:"percent",detail:"Calculated as operating income ÷ revenue"},
  {label:"Net margin",value:t.netMargin,unit:"percent",detail:"Calculated as net income ÷ revenue"},
  {label:"Reported EBIT · source supplemental",value:t.reportedEbit,unit:"amount",detail:"Kept separate from core operating income"},
  {label:"Reported EBITDA · source supplemental",value:t.reportedEbitda,unit:"amount",detail:"Kept separate from core EBITDA estimate"},
  {label:"Normalized EBITDA · source supplemental",value:t.normalizedEbitda,unit:"amount",detail:"Source supplemental line"},
  {label:"Normalized income · source supplemental",value:t.normalizedIncome,unit:"amount",detail:"Source supplemental line"},
  {label:"Reported normalized EPS · source supplemental",value:t.reportedNormalizedEps,unit:"perShare",detail:"Source supplemental line"},
  {label:"Free cash flow to firm · source supplemental",value:t.freeCashFlowToFirm,unit:"amount",detail:"Not substituted for standard FCF in DCF"},
  {label:"Common dividend/share · source supplemental",value:t.sourceReportedCommonDividendPerShare,unit:"perShare",detail:"Source-specific TTM figure"}
 ];
 const balanceRows:{label:string;value:number|null;detail:string}[]=[
  {label:"Total assets",value:b.totalAssets,detail:"Source screenshot · FY2026"},
  {label:"Current assets",value:b.currentAssets,detail:"Source screenshot · FY2026"},
  {label:"Cash, equivalents & short-term investments",value:b.cashAndShortTermInvestments,detail:"Broader source definition; kept separate from SEC cash"},
  {label:"Current liabilities (derived)",value:b.currentLiabilities,detail:"Current assets − working capital; not separately shown"},
  {label:"Inventory",value:b.inventory,detail:"Source screenshot · FY2026"},
  {label:"Receivables",value:b.receivables,detail:"Source screenshot · FY2026"},
  {label:"Total liabilities",value:b.totalLiabilities,detail:"Source screenshot · FY2026"},
  {label:"Total equity",value:b.equity,detail:"Source screenshot · FY2026"},
  {label:"Total debt · source definition",value:b.totalDebt,detail:"Source screenshot · FY2026"},
  {label:"Net debt · source definition",value:b.netDebt,detail:"Source screenshot · FY2026"},
  {label:"Working capital",value:b.workingCapital,detail:"Source screenshot · FY2026"},
  {label:"Invested capital",value:b.investedCapital,detail:"Source screenshot · FY2026"},
  {label:"Tangible book value",value:b.tangibleBookValue,detail:"Source screenshot · FY2026"}
 ];
 return <section className="vf-panel" aria-label="Imported NVDA TTM and statement data">
  <div className="vf-top"><div><span className="vf-kicker">MANUAL IMPORT · SEC CROSS-CHECK</span><h3>NVDA TTM fundamentals & statement snapshot</h3><p>TTM {t.periodStart} to {t.periodEnd} · balance sheet FY{b.fiscalYear} at {b.periodEnd} · USD</p></div></div>
  <div className="vf-summary"><div><small>Core TTM inputs</small><strong>11 verified</strong></div><div><small>Standard FCF</small><strong>{formatManual(t.freeCashFlow,"amount")}</strong></div><div><small>FCF / share</small><strong>{formatManual(t.freeCashFlowPerShare,"perShare")}</strong></div></div>
  <div className="vf-table-wrap"><table className="vf-table"><thead><tr><th>TTM metric</th><th>Value</th><th>Data basis / calculation</th></tr></thead><tbody>{inputRows.map((item,index)=><tr key={index}><td>{item.label}</td><td className="vf-number">{formatManual(item.value,item.unit)}</td><td><span className={index<11?"vf-ok":index<17?"vf-derived":"vf-muted"}>{index<11?"Imported":index<17?"Calculated":"Supplemental"}</span><small className="vf-detail">{item.detail}</small></td></tr>)}</tbody></table></div>
  <div className="vf-table-wrap" style={{marginTop:14}}><table className="vf-table"><thead><tr><th>Balance sheet · FY{b.fiscalYear}</th><th>Value</th><th>Basis</th></tr></thead><tbody>{balanceRows.map((item,index)=><tr key={index}><td>{item.label}</td><td className="vf-number">{formatManual(item.value,"amount")}</td><td><small className="vf-detail">{item.detail}</small></td></tr>)}</tbody></table></div>
  <p className="vf-note">TTM flows and FY2026 point-in-time balances retain their own dates. DCF uses standard FCF = operating cash flow − CapEx; source-reported EBIT/EBITDA and FCFF remain supplemental, not replacements for core calculations. The source-reported FCFF of {formatManual(t.freeCashFlowToFirm,"amount")} remains a separate supplemental figure. Current liabilities are derived from current assets less reported working capital.</p>
  <details className="vf-details"><summary>Imported statement detail · {data.statementDetail.length} rows · FY2023–FY2026 and TTM</summary>
   <div className="vf-table-wrap"><table className="vf-table"><thead><tr><th>Statement</th><th>Reported metric</th><th>FY2023</th><th>FY2024</th><th>FY2025</th><th>FY2026</th><th>TTM</th></tr></thead><tbody>{data.statementDetail.map((item,index)=><tr key={index}><td>{item.statement}</td><td title={item.notes??undefined}>{item.reportedLabel}<small className="vf-detail">{item.handling}</small></td><td className="vf-number">{formatDetail(item.values.FY2023??null,item.unit,item.reportedLabel)}</td><td className="vf-number">{formatDetail(item.values.FY2024??null,item.unit,item.reportedLabel)}</td><td className="vf-number">{formatDetail(item.values.FY2025??null,item.unit,item.reportedLabel)}</td><td className="vf-number">{formatDetail(item.values.FY2026??null,item.unit,item.reportedLabel)}</td><td className="vf-number">{formatDetail(item.values.TTM??null,item.unit,item.reportedLabel)}</td></tr>)}</tbody></table></div>
  </details>
 </section>;
}
export function VerifiedFundamentals({ticker}:{ticker:string}){
 const [year,setYear]=useState<string|null>(null);
 const [tab,setTab]=useState<"raw"|"calculated">("calculated");
 const classification=getSecFinancialClassification(ticker);
 const history=googleSheetsSecAnnualHistory(ticker);
 const manualData=getManualStatementData(ticker);
 if(classification.isFundOrIndex)return <section className="vf-panel"><div className="vf-top"><div><span className="vf-kicker">SEC EDGAR</span><h3>Company fundamentals</h3><p>{classification.profile} · Corporate financial statements are not applicable.</p></div></div></section>;
 if(!history.length)return <>{manualData&&<ManualTtmPanel data={manualData}/>}<section className="vf-panel"><div className="vf-top"><div><span className="vf-kicker">SEC EDGAR</span><h3>Annual fundamentals</h3><p>No matched SEC annual history is currently available for {ticker}.</p></div></div></section></>;
 const availableYears=history.map(row=>row.fiscalYear).sort((a,b)=>Number(b)-Number(a));
 const activeYear=availableYears.includes(year??"")?year!:availableYears[0];
 const row=history.find(item=>item.fiscalYear===activeYear)!;
 const currency=row.currency||"USD";
 const rows=tab==="raw"?rawMetrics.map(metric=>{
  const n=value(row,metric.key),source=row.sources[metric.key as keyof typeof row.sources];
  return {key:metric.key,label:metric.label,display:format(n,metric.unit,currency),status:n===null?"MISSING":"DIRECT",detail:source?.tag||"SEC filing fact",sourceUrl:source?.sourceUrl||null};
 }):calculatedMetrics.map(metric=>{
  const notApplicable=(classification.isFinancial&&metric.financialNA)||(classification.isReitOrMlp&&metric.reitNA);
  const n=value(row,metric.key);
  return {key:metric.key,label:metric.label,display:notApplicable?"N/A":format(n,metric.unit,currency),status:notApplicable?"NOT_APPLICABLE":n===null?"MISSING":"DERIVED",detail:notApplicable?"Not applicable to this valuation profile":metric.key==="freeCashFlowPerShare"&&row.shareCountSource?"FCF ÷ "+row.shareCountSource:metric.key==="historicalPe"&&row.historicalPeSource?metric.method+" · "+row.historicalPeSource:metric.method,sourceUrl:null};
 });
 const present=rows.filter(item=>["DIRECT","DERIVED"].includes(item.status)).length;
 return <>{manualData&&<ManualTtmPanel data={manualData}/>}<section className="vf-panel" aria-label="SEC annual fundamentals and calculated metrics">
  <div className="vf-top"><div><span className="vf-kicker">SEC EDGAR · FINANCIAL STATEMENTS</span><h3>Annual fundamentals & calculations</h3><p>{classification.profile} · Fiscal year {activeYear} · {row.periodEnd} · Reporting currency {currency}</p></div>
   <div className="vf-year">{availableYears.map(y=><button key={y} className={activeYear===y?"selected":""} type="button" onClick={()=>setYear(y)}>FY {y}</button>)}</div>
  </div>
  <div className="vf-summary"><div><small>Fields in view</small><strong>{present}/{rows.length}</strong></div><div><small>Fiscal period</small><strong>FY {activeYear}</strong></div><div><small>Import</small><strong className="vf-muted">{row.importedAt?new Date(row.importedAt).toLocaleDateString("en-US"):"SEC annual"}</strong></div></div>
  <div className="vf-tabs" role="tablist" aria-label="SEC data view">
   <button type="button" role="tab" aria-selected={tab==="calculated"} className={tab==="calculated"?"selected":""} onClick={()=>setTab("calculated")}>Calculated metrics</button>
   <button type="button" role="tab" aria-selected={tab==="raw"} className={tab==="raw"?"selected":""} onClick={()=>setTab("raw")}>SEC filing values</button>
  </div>
  <div className="vf-table-wrap"><table className="vf-table"><thead><tr><th>Metric</th><th>FY {activeYear} · {currency}</th><th>Data status / formula</th></tr></thead><tbody>{rows.map(item=><tr key={item.key}><td>{item.label}</td><td className="vf-number">{item.display}</td><td><span className={item.status==="DIRECT"?"vf-ok":item.status==="DERIVED"?"vf-derived":item.status==="NOT_APPLICABLE"?"vf-na":"vf-missing"} title={item.detail}>{item.status==="DIRECT"?"SEC filed":item.status==="DERIVED"?"Calculated":item.status==="NOT_APPLICABLE"?"N/A":"Missing"}</span><small className="vf-detail">{item.detail}{item.sourceUrl&&<> · <a href={item.sourceUrl} target="_blank" rel="noreferrer">SEC filing ↗</a></>}</small></td></tr>)}</tbody></table></div>
  <div className="vf-foot"><span>Annual SEC fiscal years only. Amounts are shown in billions of the issuer reporting currency; per-share fields use that currency/share.</span><span>Source import: {row.importedAt??"N/D"}</span></div>
  <p className="vf-note">Calculated fields use matched annual SEC inputs. They are not TTM. ROIC uses a stated 21% tax assumption and average invested capital; bank, insurer, REIT and MLP metrics follow profile-specific exclusions. Missing inputs remain N/D.</p>
 </section></>;
}
