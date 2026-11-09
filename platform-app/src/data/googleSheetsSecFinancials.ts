import sheetAnnualSecFacts from "./googleSheetsSecAnnual.json";

export type SecFinancialMetric="revenue"|"netIncome"|"operatingIncome"|"cashFromOperations"|"capex"|"epsDiluted"|"grossProfit"|"depreciationAndAmortization"|"interestExpense"|"dilutedShares"|"cash"|"currentAssets"|"currentLiabilities"|"inventory"|"totalAssets"|"totalLiabilities"|"equity"|"longTermDebt"|"shortTermDebt";
type Fact={value:number;unit:string;tag:string;filedDate:string;accession:string;sourceUrl:string;form:string};
type Period={ticker:string;cik:string;currency:string;periodStart:string;periodEnd:string;yearEndClose?:number;priceSource?:string;metrics:Partial<Record<SecFinancialMetric,Fact>>};
export type SecAnnualFinancialYear={
 fiscalYear:string;periodStart:string;periodEnd:string;currency:string;
 revenue:number|null;grossProfit:number|null;netIncome:number|null;operatingIncome:number|null;
 cashFromOperations:number|null;capex:number|null;freeCashFlow:number|null;dilutedEps:number|null;
 dilutedShares:number|null;impliedShares:number|null;shareCountSource:"SEC reported diluted shares"|"implied from net income / diluted EPS"|null;
 freeCashFlowPerShare:number|null;depreciationAndAmortization:number|null;ebitda:number|null;interestExpense:number|null;
 cash:number|null;currentAssets:number|null;currentLiabilities:number|null;currentRatio:number|null;inventory:number|null;
 totalAssets:number|null;totalLiabilities:number|null;equity:number|null;longTermDebt:number|null;shortTermDebt:number|null;
 totalDebt:number|null;netDebt:number|null;debtEquity:number|null;netDebtEbitda:number|null;interestCoverage:number|null;
 grossMargin:number|null;operatingMargin:number|null;netMargin:number|null;roe:number|null;roic:number|null;
 revenueCagr3y:number|null;revenueCagr5y:number|null;epsCagr3y:number|null;epsCagr5y:number|null;fcfCagr5y:number|null;normalizedEps5y:number|null;yearEndClose:number|null;historicalPe:number|null;historicalPeSource:string|null;
 filedDate:string|null;importedAt:string|null;
 sources:Partial<Record<SecFinancialMetric,{tag:string;unit:string;filedDate:string;accession:string;sourceUrl:string}>>;
 missingMetrics:SecFinancialMetric[];
};
const dataset=sheetAnnualSecFacts as unknown as {generatedAt:string;sourceImportedAt:string;rawFactCount:number;annualPeriodCount:number;tickerCount:number;periods:Period[]};
export const googleSheetsSecFinancialsMetadata={generatedAt:dataset.generatedAt,sourceImportedAt:dataset.sourceImportedAt,factCount:dataset.rawFactCount,annualPeriodCount:dataset.annualPeriodCount,tickerCount:dataset.tickerCount,source:"Google Sheets SEC_Raw · verified SEC annual facts"} as const;
const allMetrics:SecFinancialMetric[]=["revenue","netIncome","operatingIncome","cashFromOperations","capex","epsDiluted","grossProfit","depreciationAndAmortization","interestExpense","dilutedShares","cash","currentAssets","currentLiabilities","inventory","totalAssets","totalLiabilities","equity","longTermDebt","shortTermDebt"];
const valid=(v:number|null|undefined):v is number=>typeof v==="number"&&Number.isFinite(v);
const median=(values:number[])=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
function cagr(rows:SecAnnualFinancialYear[],field:"revenue"|"dilutedEps"|"freeCashFlow",span:number):number|null{
 if(rows.length!==span+1)return null;
 if(rows.some(r=>!valid(r[field])||r[field]<=0))return null;
 for(let i=1;i<rows.length;i++){const days=(Date.parse(rows[i].periodEnd+"T00:00:00Z")-Date.parse(rows[i-1].periodEnd+"T00:00:00Z"))/86400000;if(days<300||days>430)return null;}
 const years=(Date.parse(rows.at(-1)!.periodEnd+"T00:00:00Z")-Date.parse(rows[0].periodEnd+"T00:00:00Z"))/(365.2425*86400000);
 const out=Math.pow(rows.at(-1)![field]!/rows[0][field]!,1/years)-1;
 return Number.isFinite(out)?out:null;
}
export function googleSheetsSecAnnualHistory(ticker:string,currency?:string):SecAnnualFinancialYear[]{
 const t=ticker.trim().toUpperCase(),requested=currency?.trim().toUpperCase();
 const tickerPeriods=dataset.periods.filter(p=>p.ticker.toUpperCase()===t);
 const latest=tickerPeriods.slice().sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd)).at(-1);
 const selectedCurrency=requested||latest?.currency;
 const periods=tickerPeriods.filter(p=>!selectedCurrency||p.currency===selectedCurrency).sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
 const rows:SecAnnualFinancialYear[]=periods.map(p=>{
  const get=(m:SecFinancialMetric)=>p.metrics[m]?.value??null;
  const revenue=get("revenue"),netIncome=get("netIncome"),operatingIncome=get("operatingIncome"),cfo=get("cashFromOperations"),rawCapex=get("capex"),capex=rawCapex===null?null:Math.abs(rawCapex);
  const freeCashFlow=cfo!==null&&capex!==null?cfo-capex:null,eps=get("epsDiluted"),reportedShares=get("dilutedShares");
  const inferredShares=netIncome!==null&&eps!==null&&eps!==0&&netIncome/eps>0?netIncome/eps:null;
  const shares=reportedShares!==null&&reportedShares>0?reportedShares:inferredShares;
  const da=get("depreciationAndAmortization"),ebitda=operatingIncome!==null&&da!==null?operatingIncome+Math.abs(da):null;
  const cash=get("cash"),currentAssets=get("currentAssets"),currentLiabilities=get("currentLiabilities"),equity=get("equity"),lt=get("longTermDebt"),st=get("shortTermDebt");
  const totalDebt=lt!==null&&st!==null?lt+st:null,netDebt=totalDebt!==null&&cash!==null?totalDebt-cash:null,interest=get("interestExpense");

  const sources=Object.fromEntries(Object.entries(p.metrics).map(([metric,f])=>[metric,{tag:f!.tag,unit:f!.unit,filedDate:f!.filedDate,accession:f!.accession,sourceUrl:f!.sourceUrl}])) as SecAnnualFinancialYear["sources"];
  return {
   fiscalYear:p.periodEnd.slice(0,4),periodStart:p.periodStart,periodEnd:p.periodEnd,currency:p.currency,
   revenue,grossProfit:get("grossProfit"),netIncome,operatingIncome,cashFromOperations:cfo,capex,freeCashFlow,dilutedEps:eps,
   dilutedShares:reportedShares,impliedShares:inferredShares,
   shareCountSource:reportedShares!==null&&reportedShares>0?"SEC reported diluted shares":inferredShares!==null?"implied from net income / diluted EPS":null,
   freeCashFlowPerShare:freeCashFlow!==null&&shares!==null&&shares>0?freeCashFlow/shares:null,
   depreciationAndAmortization:da,ebitda,interestExpense:interest,
   cash,currentAssets,currentLiabilities,currentRatio:currentAssets!==null&&currentLiabilities!==null&&currentLiabilities>0?currentAssets/currentLiabilities:null,
   inventory:get("inventory"),totalAssets:get("totalAssets"),totalLiabilities:get("totalLiabilities"),equity,longTermDebt:lt,shortTermDebt:st,totalDebt,netDebt,
   debtEquity:totalDebt!==null&&equity!==null&&equity!==0?totalDebt/equity:null,
   netDebtEbitda:netDebt!==null&&ebitda!==null&&ebitda>0?netDebt/ebitda:null,
   interestCoverage:operatingIncome!==null&&interest!==null&&interest!==0?operatingIncome/Math.abs(interest):null,
   grossMargin:get("grossProfit")!==null&&revenue!==null&&revenue!==0?get("grossProfit")!/revenue:null,
   operatingMargin:operatingIncome!==null&&revenue!==null&&revenue!==0?operatingIncome/revenue:null,
   netMargin:netIncome!==null&&revenue!==null&&revenue!==0?netIncome/revenue:null,
   roe:null,roic:null,
   revenueCagr3y:null,revenueCagr5y:null,epsCagr3y:null,epsCagr5y:null,fcfCagr5y:null,normalizedEps5y:null,
   yearEndClose:valid(p.yearEndClose)?p.yearEndClose:null,
   historicalPe:valid(p.yearEndClose)&&p.yearEndClose>0&&valid(eps)&&eps>0?p.yearEndClose/eps:null,
   historicalPeSource:p.priceSource??null,
   filedDate:Object.values(p.metrics).map(f=>f.filedDate).sort().at(-1)??null,importedAt:dataset.sourceImportedAt,
   sources,missingMetrics:allMetrics.filter(m=>!p.metrics[m])
  };
 });
 for(let i=0;i<rows.length;i++){
  rows[i].revenueCagr3y=i>=3?cagr(rows.slice(i-3,i+1),"revenue",3):null;
  rows[i].revenueCagr5y=i>=5?cagr(rows.slice(i-5,i+1),"revenue",5):null;
  rows[i].epsCagr3y=i>=3?cagr(rows.slice(i-3,i+1),"dilutedEps",3):null;
  rows[i].epsCagr5y=i>=5?cagr(rows.slice(i-5,i+1),"dilutedEps",5):null;
  rows[i].fcfCagr5y=i>=5?cagr(rows.slice(i-5,i+1),"freeCashFlow",5):null;
  const eps=rows.slice(Math.max(0,i-4),i+1).map(r=>r.dilutedEps);
  rows[i].normalizedEps5y=eps.length===5&&eps.every(v=>valid(v)&&v>0)?median(eps as number[]):null;
  if(i>0){
   const days=(Date.parse(rows[i].periodEnd+"T00:00:00Z")-Date.parse(rows[i-1].periodEnd+"T00:00:00Z"))/86400000;
   if(days>=300&&days<=430&&valid(rows[i-1].equity)&&valid(rows[i].netIncome)&&valid(rows[i].equity)){
    const average=(rows[i-1].equity!+rows[i].equity!)/2;
    rows[i].roe=average!==0?rows[i].netIncome!/average:null;
   }
   const capital=(row:SecAnnualFinancialYear)=>row.totalDebt!==null&&row.equity!==null&&row.cash!==null?row.totalDebt+row.equity-row.cash:null;
   const priorCapital=capital(rows[i-1]),currentCapital=capital(rows[i]);
   const average=days>=300&&days<=430&&priorCapital!==null&&currentCapital!==null?(priorCapital+currentCapital)/2:null;
   rows[i].roic=rows[i].operatingIncome!==null&&average!==null&&average>0?rows[i].operatingIncome*0.79/average:null;
  }
 }
 return rows;
}
