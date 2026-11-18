/** Growth-relative Peter Lynch PEG / PEGY heuristics, one valuation family.
 * The historical EPS CAGR is a backward-looking scenario proxy, not consensus.
 * All growth/yield values are in percentage points: 10 means 10%, not 0.10.
 */
export const lynchGrowthAssumption=(epsCagr3y:number|null|undefined)=>{
 const historic=typeof epsCagr3y==="number"&&Number.isFinite(epsCagr3y)?epsCagr3y*100:null;
 const historical=historic!==null&&historic>0&&historic<=30;
 return {growth:historical?Number(historic.toFixed(2)):10,basis:historical?"HISTORICAL_PROXY" as const:"STANDARD_ASSUMPTION" as const,rawHistoricalGrowth:historic};
};
const validPositive=(n:number|null|undefined):n is number=>typeof n==="number"&&Number.isFinite(n)&&n>0;
export function lynchModel(eps:number|null,growth:number,dividendYieldPercent:number|null,price:number|null){
 if(!validPositive(eps)||!Number.isFinite(growth)||growth<=0||growth>50)return null;
 const validYield=typeof dividendYieldPercent==="number"&&Number.isFinite(dividendYieldPercent)&&dividendYieldPercent>=0&&dividendYieldPercent<=100;
 const basic=eps*growth;
 const withDividend=validYield?eps*(growth+dividendYieldPercent):null;
 const values=withDividend===null?[basic]:[basic,withDividend];
 const value=values.reduce((sum,v)=>sum+v,0)/values.length;
 if(!validPositive(value))return null;
 const pe=validPositive(price)?price/eps:null;
 return {value,composite:withDividend===null?null:value,low:Math.min(...values),high:Math.max(...values),basic,withDividend,
  pe,peg:pe!==null?pe/growth:null,
  pegy:pe!==null&&validYield?pe/(growth+dividendYieldPercent):null,
  upside:validPositive(price)?(value/price-1)*100:null};
}
