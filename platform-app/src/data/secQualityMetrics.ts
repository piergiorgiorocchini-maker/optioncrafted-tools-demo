/* SEC annual quality metrics. All inputs come from the same fiscal period and reporting currency. */
import {verifiedAnnualHistory} from "./verifiedFinancials";
import {getSecFinancialClassification} from "./secFinancialBridge";
export type QualityRatio={value:number|null;method:string;note:string;period:string;status:"AVAILABLE"|"MISSING"|"NOT_APPLICABLE"};
const missing=(period:string,method:string,note:string):QualityRatio=>({value:null,method,note,period,status:"MISSING"});
const notApplicable=(period:string,method:string,note:string):QualityRatio=>({value:null,method,note,period,status:"NOT_APPLICABLE"});
const rowFor=(ticker:string,year?:string,currency?:string)=>{
 const history=verifiedAnnualHistory(ticker,currency);
 const index=year?history.findIndex(row=>row.year===year):history.length-1;
 return index>=0?{history,index,row:history[index]}:null;
};
export function secCashConversion(ticker:string,year?:string,currency?:string):QualityRatio{
 const classification=getSecFinancialClassification(ticker);
 const period=year??"latest fiscal year";
 if(classification.isFundOrIndex)return notApplicable(period,"FCF / net income","Company cash-flow conversion does not apply to ETFs or indices");
 if(classification.isFinancial)return notApplicable(period,"FCF / net income","Industrial cash-flow conversion is not comparable for this financial profile");
 if(classification.isReitOrMlp)return notApplicable(period,"FCF / net income","REIT/MLP cash-flow analysis requires AFFO/FFO-based measures");
 const found=rowFor(ticker,year,currency);
 if(!found)return missing(period,"FCF / net income","No matched SEC annual data for the requested fiscal year");
 const {row}=found,periodLabel="FY "+row.year;
 if(row.fcf===null||row.netIncome===null||row.netIncome<=0)return missing(periodLabel,"FCF / net income","Requires same-year annual FCF and positive net income");
 return {value:100*row.fcf/row.netIncome,method:"(SEC annual CFO - SEC annual CapEx) / SEC annual net income",note:"Same-fiscal-year cash conversion. It is not computed with snapshot EPS and is not TTM.",period:periodLabel,status:"AVAILABLE"};
}
export function secRoicEstimate(ticker:string,year?:string,assumedTaxRate=0.21,currency?:string):QualityRatio{
 const classification=getSecFinancialClassification(ticker);
 const period=year??"latest fiscal year",method="NOPAT / average invested capital";
 if(classification.isFundOrIndex)return notApplicable(period,method,"ROIC does not apply to ETFs or indices");
 if(classification.isFinancial)return notApplicable(period,method,"Industrial ROIC is not comparable for this financial profile");
 if(classification.isReitOrMlp)return notApplicable(period,method,"REIT/MLP return metrics require AFFO and property-capital adjustments");
 if(!Number.isFinite(assumedTaxRate)||assumedTaxRate<0||assumedTaxRate>=1)return missing(period,method,"Invalid assumed tax rate");
 const found=rowFor(ticker,year,currency);
 if(!found)return missing(period,method,"No matched SEC annual data for the requested fiscal year");
 const {history,index,row}=found,prior=history[index-1];
 if(!prior)return missing("FY "+row.year,method,"Requires an adjacent prior-year balance sheet");
 const days=(Date.parse(row.periodEnd+"T00:00:00Z")-Date.parse(prior.periodEnd+"T00:00:00Z"))/86400000;
 if(days<300||days>430)return missing("FY "+row.year,method,"Adjacent fiscal periods are not approximately one year apart");
 const capital=(x:typeof row)=>x.totalDebt!==null&&x.equity!==null&&x.cash!==null?x.totalDebt+x.equity-x.cash:null;
 const current=capital(row),previous=capital(prior),operatingIncome=row.operatingIncome;
 if(current===null||previous===null||operatingIncome===null||current<=0||previous<=0)return missing("FY "+row.year,method,"Operating income and same-scope debt, equity and cash are required for both years");
 const average=(current+previous)/2;
 return {value:100*operatingIncome*(1-assumedTaxRate)/average,method:"SEC operating income × (1 - assumed tax) / average (equity + debt - cash)",note:"Estimated ROIC, not a reported ratio. Assumes a 21% tax rate and average year-end invested capital; the basis is parent equity + long- and short-term debt - cash. Other financing and excess-cash adjustments are not verified.",period:"FY "+row.year,status:"AVAILABLE"};
}
