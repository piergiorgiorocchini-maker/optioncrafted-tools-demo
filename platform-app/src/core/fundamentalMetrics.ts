/* Shared, pure fundamental metrics. Missing inputs stay null, never zero-filled.
   Amounts must share currency, period and consolidation scope before use. */
export type FundamentalInputs={
 marketCap:number|null;cash:number|null;shortTermInvestments:number|null;
 currentAssets:number|null;currentLiabilities:number|null;inventory:number|null;
 receivables:number|null;totalDebt:number|null;minorityInterest:number|null;
 preferredEquity:number|null;ebitda:number|null;ebit:number|null;
 interestExpense:number|null;freeCashFlow:number|null;equity:number|null;
};
export type FundamentalMetric={value:number|null;unit:"ratio"|"money"|"percent";required:(keyof FundamentalInputs)[]};
const valid=(v:number|null):v is number=>v!==null&&Number.isFinite(v);
const calc=(keys:(keyof FundamentalInputs)[],input:FundamentalInputs,fn:(v:number[])=>number,unit:FundamentalMetric["unit"]="ratio"):FundamentalMetric=>{
 const values=keys.map(k=>input[k]);
 if(values.some(v=>!valid(v)))return {value:null,unit,required:keys};
 const n=fn(values as number[]);
 return {value:Number.isFinite(n)?n:null,unit,required:keys};
};
const divide=(a:number,b:number)=>b>0?a/b:NaN;
export function fundamentalMetrics(i:FundamentalInputs){
 return {
  currentRatio:calc(["currentAssets","currentLiabilities"],i,([a,b])=>divide(a,b)),
  quickRatio:calc(["currentAssets","inventory","currentLiabilities"],i,([a,b,c])=>divide(a-b,c)),
  cashRatio:calc(["cash","currentLiabilities"],i,([a,b])=>divide(a,b)),
  netDebt:calc(["totalDebt","cash"],i,([a,b])=>a-b,"money"),
  debtEquity:calc(["totalDebt","equity"],i,([a,b])=>divide(a,b)),
  netDebtEbitda:calc(["totalDebt","cash","ebitda"],i,([a,b,c])=>divide(a-b,c)),
  interestCoverage:calc(["ebit","interestExpense"],i,([a,b])=>divide(a,b)),
  fcfDebt:calc(["freeCashFlow","totalDebt"],i,([a,b])=>divide(a,b),"ratio"),
  enterpriseValue:calc(["marketCap","totalDebt","cash","minorityInterest","preferredEquity"],i,([a,b,c,d,e])=>a+b-c+d+e,"money"),
  evEbitda:calc(["marketCap","totalDebt","cash","minorityInterest","preferredEquity","ebitda"],i,([a,b,c,d,e,f])=>divide(a+b-c+d+e,f))
 };
}
export const missingFundamentals:FundamentalInputs={marketCap:null,cash:null,shortTermInvestments:null,currentAssets:null,currentLiabilities:null,inventory:null,receivables:null,totalDebt:null,minorityInterest:null,preferredEquity:null,ebitda:null,ebit:null,interestExpense:null,freeCashFlow:null,equity:null};
