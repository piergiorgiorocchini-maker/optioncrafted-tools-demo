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
  {label:"Current Assets",unit:"amount",read:row=>numberValue(row.currentAssets)},
  {label:"Inventory",unit:"amount",read:row=>numberValue(row.inventory)},
  {label:"Current Liabilities",unit:"amount",read:row=>numberValue(row.currentLiabilities)},
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

function ManualStatementsPanel({data}:{data:ManualStatementData}){
 const [activeStatement,setActiveStatement]=useState<FinancialStatementName>("Income Statement");
 const rows=data.statementDetail.filter(item=>item.statement===activeStatement);
 const columns=activeStatement==="Balance Sheet"?["FY2026","FY2025","FY2024","FY2023"]:["TTM","FY2026","FY2025","FY2024","FY2023"];
 return <section className="vf-panel vf-statements" aria-label="Financial statements">
  <div className="vf-top"><div><h3>Financial statements</h3><p>Currency in {data.currency} · amounts and shares in thousands, except per-share data</p></div><small className="vf-period-note">TTM through {data.ttm.periodEnd} · Balance sheet {data.balanceSheet.periodEnd}</small></div>
  <div className="vf-statement-tabs" role="tablist" aria-label="Financial statements">
   {financialStatementTabs.map(statement=><button key={statement} type="button" role="tab" aria-selected={activeStatement===statement} className={activeStatement===statement?"selected":""} onClick={()=>setActiveStatement(statement)}>{statement}</button>)}
  </div>
  <div className="vf-table-wrap" role="tabpanel" aria-label={activeStatement}>
   <table className="vf-table vf-statement-table"><thead><tr><th>Metric</th>{columns.map(column=><th key={column} className="vf-number">{column==="TTM"?"TTM":column==="FY2026"?"1/31/2026":column==="FY2025"?"1/31/2025":column==="FY2024"?"1/31/2024":"1/31/2023"}</th>)}</tr></thead><tbody>
    {rows.length?rows.map((item,index)=>{const section=columns.every(column=>item.values[column]===null||item.values[column]===undefined);return <tr key={index} className={section?"vf-statement-section":""}><td>{item.reportedLabel}</td>{columns.map(column=><td key={column}>{financialStatementValue(item.values[column]??null,item.unit,data.currency)}</td>)}</tr>;}):<tr><td colSpan={columns.length+1}>No data available for this statement.</td></tr>}
   </tbody></table>
  </div>
 </section>;
}
function AnnualStatementsPanel({ticker,history}:{ticker:string;history:SecAnnualFinancialYear[]}){
 const [activeStatement,setActiveStatement]=useState<FinancialStatementName>("Income Statement");
 const periods=history.slice(-6).reverse();
 const currency=periods[0]?.currency||"USD";
 const rows=statementRows[activeStatement].filter(metric=>periods.some(period=>metric.read(period)!==null));
 return <section className="vf-panel vf-statements" aria-label={"Financial statements for "+ticker}>
  <div className="vf-top"><div><h3>Financial statements</h3><p>Currency in {currency} · amounts and shares in thousands, except per-share data</p></div><small className="vf-period-note">Annual periods · latest available</small></div>
  <div className="vf-statement-tabs" role="tablist" aria-label="Financial statements">
   {financialStatementTabs.map(statement=><button key={statement} type="button" role="tab" aria-selected={activeStatement===statement} className={activeStatement===statement?"selected":""} onClick={()=>setActiveStatement(statement)}>{statement}</button>)}
  </div>
  <div className="vf-table-wrap" role="tabpanel" aria-label={activeStatement}>
   <table className="vf-table vf-statement-table"><thead><tr><th>Metric</th>{periods.map(period=><th key={period.periodEnd} className="vf-number">{periodLabel(period)}</th>)}</tr></thead><tbody>
    {rows.length?rows.map(metric=><tr key={metric.label}><td>{metric.label}</td>{periods.map(period=><td key={period.periodEnd}>{financialStatementValue(metric.read(period),metric.unit,period.currency)}</td>)}</tr>):<tr><td colSpan={periods.length+1}>No data available for this statement.</td></tr>}
   </tbody></table>
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
