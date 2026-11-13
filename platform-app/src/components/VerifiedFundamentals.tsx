import {useState} from "react";
import {googleSheetsSecAnnualHistory,type SecAnnualFinancialYear} from "../data/googleSheetsSecFinancials";
import {getManualStatementData,type ManualStatementData} from "../data/googleSheetsManualFinancials";
import {getSecFinancialClassification} from "../data/secFinancialBridge";
import "./verifiedFundamentals.css";

type FinancialStatementName="Income Statement"|"Balance Sheet"|"Cash Flow";
type StatementUnit="amount"|"perShare"|"shares";
type StatementRow={label:string;unit:StatementUnit;read:(row:SecAnnualFinancialYear)=>number|null};
const financialStatementTabs:FinancialStatementName[]=["Income Statement","Balance Sheet","Cash Flow"];
const numberValue=(value:number|null|undefined):number|null=>typeof value==="number"&&Number.isFinite(value)?value:null;
const grossProfit=(row:SecAnnualFinancialYear):number|null=>{
 if(row.grossProfit!==null)return row.grossProfit;
 return row.revenue!==null&&row.costOfRevenue!==null?row.revenue-Math.abs(row.costOfRevenue):null;
};
const statementRows:Record<FinancialStatementName,StatementRow[]>={
 "Income Statement":[
  {label:"Total Revenue",unit:"amount",read:row=>numberValue(row.revenue)},
  {label:"Cost of Revenue",unit:"amount",read:row=>row.costOfRevenue===null?null:-Math.abs(row.costOfRevenue)},
  {label:"Gross Profit",unit:"amount",read:grossProfit},
  {label:"Operating Income",unit:"amount",read:row=>numberValue(row.operatingIncome)},
  {label:"Depreciation & Amortization",unit:"amount",read:row=>row.depreciationAndAmortization===null?null:Math.abs(row.depreciationAndAmortization)},
  {label:"Interest Expense",unit:"amount",read:row=>row.interestExpense===null?null:-Math.abs(row.interestExpense)},
  {label:"Net Income",unit:"amount",read:row=>numberValue(row.netIncome)},
  {label:"Diluted EPS",unit:"perShare",read:row=>numberValue(row.dilutedEps)},
  {label:"Diluted Weighted-average Shares",unit:"shares",read:row=>numberValue(row.dilutedShares)}
 ],
 "Balance Sheet":[
  {label:"Cash & Equivalents",unit:"amount",read:row=>numberValue(row.cash)},
  {label:"Short-term Investments",unit:"amount",read:row=>numberValue(row.shortTermInvestments)},
  {label:"Trade and Other Receivables",unit:"amount",read:row=>numberValue(row.receivables)},
  {label:"Current Assets",unit:"amount",read:row=>numberValue(row.currentAssets)},
  {label:"Inventory",unit:"amount",read:row=>numberValue(row.inventory)},
  {label:"Current Liabilities",unit:"amount",read:row=>numberValue(row.currentLiabilities)},
  {label:"Non-current Assets",unit:"amount",read:row=>numberValue(row.totalNonCurrentAssets)},
  {label:"Total Assets",unit:"amount",read:row=>numberValue(row.totalAssets)},
  {label:"Total Liabilities",unit:"amount",read:row=>numberValue(row.totalLiabilities)},
  {label:"Total Debt",unit:"amount",read:row=>numberValue(row.totalDebt)},
  {label:"Net Debt",unit:"amount",read:row=>numberValue(row.netDebt)},
  {label:"Shareholders' Equity",unit:"amount",read:row=>numberValue(row.equity)}
 ],
 "Cash Flow":[
  {label:"Cash from Operating Activities",unit:"amount",read:row=>numberValue(row.cashFromOperations)},
  {label:"Capital Expenditure",unit:"amount",read:row=>row.capex===null?null:-Math.abs(row.capex)},
  {label:"Free Cash Flow",unit:"amount",read:row=>numberValue(row.freeCashFlow)},
  {label:"Depreciation & Amortization",unit:"amount",read:row=>row.depreciationAndAmortization===null?null:Math.abs(row.depreciationAndAmortization)}
 ]
};
const financialStatementValue=(value:number|null|undefined,unit:string,currency="USD")=>{
 if(value===null||value===undefined||!Number.isFinite(value))return "—";
 if(unit==="perShare"||unit==="USD/share")return new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(value);
 if(unit==="ratio"||unit.startsWith("ratio"))return value.toFixed(2);
 if(unit==="amount"||unit==="shares")return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(value/1000);
 if(unit.startsWith("USD bn")||unit.startsWith("shares bn"))return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(value*1_000_000);
 return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(value);
};
const periodLabel=(row:SecAnnualFinancialYear)=>{
 const date=Date.parse(row.periodEnd+"T00:00:00Z");
 return Number.isFinite(date)?new Intl.DateTimeFormat("en-US",{month:"numeric",day:"numeric",year:"numeric",timeZone:"UTC"}).format(date):"FY "+row.fiscalYear;
};

const manualPeriodTitle=(column:string)=>column==="TTM"?"TTM":"1/31/"+column.replace(/^FY/,"");

function ManualStatementsPanel({data}:{data:ManualStatementData}){
 const [activeStatement,setActiveStatement]=useState<FinancialStatementName>("Income Statement");
 const [mobileStart,setMobileStart]=useState(0);
 const rows=data.statementDetail.filter(item=>item.statement===activeStatement);
 const columns=activeStatement==="Balance Sheet"?["FY2026","FY2025","FY2024","FY2023"]:["TTM","FY2026","FY2025","FY2024","FY2023"];
 const mobileColumns=columns.slice(mobileStart,mobileStart+2);
 const selectStatement=(statement:FinancialStatementName)=>{setActiveStatement(statement);setMobileStart(0);};
 const table=(visibleColumns:string[],mobile=false)=><table className={"vf-table vf-statement-table"+(mobile?" vf-mobile-table":"")}><thead><tr><th>Metric</th>{visibleColumns.map(column=><th key={column} className="vf-number">{manualPeriodTitle(column)}</th>)}</tr></thead><tbody>
  {rows.length?rows.map((item,index)=>{const section=visibleColumns.every(column=>item.values[column]===null||item.values[column]===undefined);const displayLabel=item.reportedLabel.replace(/\s*\((?:SEC|EDGAR|FMP|Yahoo|Google Sheets)[^)]*\)/gi,"");return <tr key={index} className={section?"vf-statement-section":""}><td>{displayLabel}</td>{visibleColumns.map(column=><td key={column}>{financialStatementValue(item.values[column]??null,item.unit,data.currency)}</td>)}</tr>;}):<tr><td colSpan={visibleColumns.length+1}>No data available for this statement.</td></tr>}
 </tbody></table>;
 return <section className="vf-panel vf-statements" aria-label="Financial statements">
  <div className="vf-top"><div><h3>Financial statements</h3><p>Currency in {data.currency} · amounts and shares in thousands, except per-share data</p></div><small className="vf-period-note">TTM through {data.ttm.periodEnd} · Balance sheet {data.balanceSheet.periodEnd}</small></div>
  <div className="vf-statement-tabs" role="tablist" aria-label="Financial statements">
   {financialStatementTabs.map(statement=><button key={statement} type="button" role="tab" aria-selected={activeStatement===statement} className={activeStatement===statement?"selected":""} onClick={()=>selectStatement(statement)}>{statement}</button>)}
  </div>
  <div className="vf-table-wrap vf-desktop-statement" role="tabpanel" aria-label={activeStatement}>{table(columns)}</div>
  <div className="vf-mobile-statement" role="tabpanel" aria-label={activeStatement+" mobile periods"}>
   <div className="vf-mobile-period-controls"><button type="button" onClick={()=>setMobileStart(start=>Math.max(0,start-2))} disabled={mobileStart===0} aria-label="Show newer periods">← Recenti</button><span aria-live="polite">{mobileColumns.map(manualPeriodTitle).join(" · ")}</span><button type="button" onClick={()=>setMobileStart(start=>Math.min(Math.max(0,columns.length-2),start+2))} disabled={mobileStart+2>=columns.length} aria-label="Show older periods">Anni precedenti →</button></div>
   <div className="vf-table-wrap">{table(mobileColumns,true)}</div>
  </div>
 </section>;
}
function AnnualStatementsPanel({ticker,history}:{ticker:string;history:SecAnnualFinancialYear[]}){
 const [activeStatement,setActiveStatement]=useState<FinancialStatementName>("Income Statement");
 const [mobileStart,setMobileStart]=useState(0);
 const periods=history.slice(-6).reverse();
 const mobilePeriods=periods.slice(mobileStart,mobileStart+2);
 const currency=periods[0]?.currency||"USD";
 const rows=statementRows[activeStatement].filter(metric=>periods.some(period=>metric.read(period)!==null));
 const selectStatement=(statement:FinancialStatementName)=>{setActiveStatement(statement);setMobileStart(0);};
 const table=(visiblePeriods:SecAnnualFinancialYear[],mobile=false)=><table className={"vf-table vf-statement-table"+(mobile?" vf-mobile-table":"")}><thead><tr><th>Metric</th>{visiblePeriods.map(period=><th key={period.periodEnd} className="vf-number">{periodLabel(period)}</th>)}</tr></thead><tbody>
  {rows.length?rows.map(metric=><tr key={metric.label}><td>{metric.label}</td>{visiblePeriods.map(period=><td key={period.periodEnd}>{financialStatementValue(metric.read(period),metric.unit,period.currency)}</td>)}</tr>):<tr><td colSpan={visiblePeriods.length+1}>No data available for this statement.</td></tr>}
 </tbody></table>;
 return <section className="vf-panel vf-statements" aria-label={"Financial statements for "+ticker}>
  <div className="vf-top"><div><h3>Financial statements</h3><p>Currency in {currency} · amounts and shares in thousands, except per-share data</p></div><small className="vf-period-note">Annual periods · latest available</small></div>
  <div className="vf-statement-tabs" role="tablist" aria-label="Financial statements">
   {financialStatementTabs.map(statement=><button key={statement} type="button" role="tab" aria-selected={activeStatement===statement} className={activeStatement===statement?"selected":""} onClick={()=>selectStatement(statement)}>{statement}</button>)}
  </div>
  <div className="vf-table-wrap vf-desktop-statement" role="tabpanel" aria-label={activeStatement}>{table(periods)}</div>
  <div className="vf-mobile-statement" role="tabpanel" aria-label={activeStatement+" mobile periods"}>
   <div className="vf-mobile-period-controls"><button type="button" onClick={()=>setMobileStart(start=>Math.max(0,start-2))} disabled={mobileStart===0} aria-label="Show newer periods">← Recenti</button><span aria-live="polite">{mobilePeriods.map(periodLabel).join(" · ")}</span><button type="button" onClick={()=>setMobileStart(start=>Math.min(Math.max(0,periods.length-2),start+2))} disabled={mobileStart+2>=periods.length} aria-label="Show older periods">Anni precedenti →</button></div>
   <div className="vf-table-wrap">{table(mobilePeriods,true)}</div>
  </div>
 </section>;
}
export function VerifiedFundamentals({ticker}:{ticker:string}){
 const classification=getSecFinancialClassification(ticker);
 const history=googleSheetsSecAnnualHistory(ticker);
 const manualData=getManualStatementData(ticker);
 if(manualData)return <ManualStatementsPanel data={manualData}/>;
 if(classification.isFundOrIndex)return <section className="vf-panel"><div className="vf-top"><div><h3>Financial statements</h3><p>Not applicable to this instrument.</p></div></div></section>;
 return <AnnualStatementsPanel ticker={ticker} history={history}/>;
}
