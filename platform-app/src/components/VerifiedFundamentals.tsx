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
type FinancialStatementName="Income Statement"|"Balance Sheet"|"Cash Flow";
const financialStatementTabs:FinancialStatementName[]=["Income Statement","Balance Sheet","Cash Flow"];
const financialStatementValue=(n:number|null|undefined,unit:string)=>{
 if(n===null||n===undefined||!Number.isFinite(n))return "—";
 if(unit.startsWith("USD bn")||unit.startsWith("shares bn"))return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n*1_000_000);
 if(unit==="USD/share")return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
 if(unit.startsWith("ratio"))return n.toFixed(2);
 return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n);
};
function ManualStatementsPanel({data}:{data:ManualStatementData}){
 const [activeStatement,setActiveStatement]=useState<FinancialStatementName>("Income Statement");
 const rows=data.statementDetail.filter(item=>item.statement===activeStatement);
 const columns=activeStatement==="Balance Sheet"?["FY2026","FY2025","FY2024","FY2023"]:["TTM","FY2026","FY2025","FY2024","FY2023"];
 return <section className="vf-panel vf-statements" aria-label="Financial statements">
  <div className="vf-top"><div><h3>Financial statements</h3><p>Currency in USD · All numbers in thousands, except per-share data</p></div><small className="vf-period-note">TTM through {data.ttm.periodEnd} · Balance sheet {data.balanceSheet.periodEnd}</small></div>
  <div className="vf-statement-tabs" role="tablist" aria-label="Financial statements">
   {financialStatementTabs.map(statement=><button key={statement} type="button" role="tab" aria-selected={activeStatement===statement} className={activeStatement===statement?"selected":""} onClick={()=>setActiveStatement(statement)}>{statement}</button>)}
  </div>
  <div className="vf-table-wrap" role="tabpanel" aria-label={activeStatement}>
   <table className="vf-table vf-statement-table"><thead><tr><th>Metric</th>{columns.map(column=><th key={column}>{column==="TTM"?"TTM":`1/31/${column.slice(2)}`}</th>)}</tr></thead><tbody>
    {rows.map((item,index)=>{const section=columns.every(column=>item.values[column]===null||item.values[column]===undefined);return <tr key={index} className={section?"vf-statement-section":""}><td>{item.reportedLabel}</td>{columns.map(column=><td key={column}>{financialStatementValue(item.values[column]??null,item.unit)}</td>)}</tr>;})}
   </tbody></table>
  </div>
 </section>;
}
export function VerifiedFundamentals({ticker}:{ticker:string}){
 const [year,setYear]=useState<string|null>(null);
 const [tab,setTab]=useState<"raw"|"calculated">("calculated");
 const classification=getSecFinancialClassification(ticker);
 const history=googleSheetsSecAnnualHistory(ticker);
 const manualData=getManualStatementData(ticker);
 if(classification.isFundOrIndex)return <section className="vf-panel"><div className="vf-top"><div><span className="vf-kicker">SEC EDGAR</span><h3>Company fundamentals</h3><p>{classification.profile} · Corporate financial statements are not applicable.</p></div></div></section>;
 if(!history.length)return <section className="vf-panel"><div className="vf-top"><div><span className="vf-kicker">SEC EDGAR</span><h3>Annual fundamentals</h3><p>No matched SEC annual history is currently available for {ticker}.</p></div></div></section>;
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
 return <section className="vf-panel" aria-label="SEC annual fundamentals and calculated metrics">
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
