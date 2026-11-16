import type {SecAnnualFinancialYear} from "../data/googleSheetsSecFinancials";

/** EPS CAGR fields are stored as decimals (0.10 = 10%). Only a continuous,
 * positive, source-backed history can supply an Automatic Graham forecast proxy.
 * This remains a backward-looking proxy, not an analyst forward consensus.
 */
export type GrahamGrowthEvidence={
 rate:number|null;
 rawPercent:number|null;
 cagr3yPercent:number|null;
 cagr5yPercent:number|null;
 source:"EPS CAGR 3Y + 5Y"|"EPS CAGR 3Y"|"EPS CAGR 5Y"|"UNAVAILABLE";
 capped:boolean;
 fiscalYear:string|null;
 note:string;
};
const validRate=(rate:number|null|undefined):rate is number=>typeof rate==="number"&&Number.isFinite(rate)&&rate>-1;
export function automaticGrahamGrowth(history:SecAnnualFinancialYear[]):GrahamGrowthEvidence{
 const latest=history.at(-1);
 const three=latest?.epsCagr3y;
 const five=latest?.epsCagr5y;
 const has3=validRate(three);
 const has5=validRate(five);
 const rates=[...(has3?[three*100]:[]),...(has5?[five*100]:[])];
 const raw=rates.length?rates.reduce((sum,n)=>sum+n,0)/rates.length:null;
 // Graham's original positive-earnings heuristic becomes nonpositive at -4.25%.
 // An upper 15% cap limits mechanical extrapolation of unusually high historical EPS growth.
 const applied=raw===null?null:Math.max(-4,Math.min(15,raw));
 const capped=raw!==null&&applied!==null&&Math.abs(raw-applied)>0.00001;
 const source: GrahamGrowthEvidence["source"]=has3&&has5?"EPS CAGR 3Y + 5Y":has3?"EPS CAGR 3Y":has5?"EPS CAGR 5Y":"UNAVAILABLE";
 const note=raw===null
  ?"No continuous, positive-EPS 3Y or 5Y SEC history; Graham Automatic growth unavailable (no fixed-rate fallback)."
  :`Historical EPS ${source}; raw ${raw.toFixed(2)}%, applied ${applied!.toFixed(2)}%${capped?" (bounded to -4%…15%)":""}. Historical proxy, not a forward analyst forecast.`;
 return {rate:applied,rawPercent:raw,cagr3yPercent:has3?three*100:null,cagr5yPercent:has5?five*100:null,source,capped,fiscalYear:latest?.fiscalYear??null,note};
}
