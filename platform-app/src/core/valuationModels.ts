/* Pure, source-aware valuation models. All values are per share.
   No implicit substitute for missing financial data. */
export type ValuationMode="manual"|"hybrid"|"automatic";
export type ValuationMethod="dcf"|"required-return"|"graham"|"dividend"|"peers";
export type Financials={price:number|null;eps:number|null;fcf:number|null;dividend:number|null;beta:number|null;currency:string};
export type ModelInputs={growth:number;discount:number;terminal:number;years:number;mos:number;exitPe:number;growth2:number;divGrowth:number;divGrowth2:number;aaaYield:number|null;dividendDiscount:number;dividendTerminal:number;dividendGrowth:number;requiredReturn:number};
export type DcfResult={value:number;pvCashflows:number;pvTerminal:number;projection:{year:number;cashflow:number;pv:number}[]};
export const modelDefaults:ModelInputs={growth:5,discount:10,terminal:2.5,years:5,mos:25,exitPe:18,growth2:3,divGrowth:3,divGrowth2:2,aaaYield:null,dividendDiscount:10,dividendTerminal:2.5,dividendGrowth:4,requiredReturn:12};
const valid=(n:number|null):n is number=>n!==null&&Number.isFinite(n);
export const money=(n:number|null,currency="USD")=>!valid(n)?"N/D":new Intl.NumberFormat("en-US",{style:"currency",currency:/^[A-Z]{3}$/.test(currency)?currency:"USD",maximumFractionDigits:2}).format(n);
export const percent=(n:number|null)=>!valid(n)?"N/D":(n*100).toFixed(1)+"%";
export function dcfModel(fcf:number|null,growth:number,discount:number,terminal:number,years:number):DcfResult|null{
 if(!valid(fcf)||fcf<=0||![growth,discount,terminal,years].every(Number.isFinite)||discount<=terminal||discount<=0||terminal<=-100||growth<=-100||!Number.isInteger(years)||years<1||years>30)return null;
 let current=fcf,pvCashflows=0;const projection:DcfResult["projection"]=[];
 for(let year=1;year<=years;year++){current*=1+growth/100;const pv=current/Math.pow(1+discount/100,year);pvCashflows+=pv;projection.push({year,cashflow:current,pv})}
 const pvTerminal=(current*(1+terminal/100)/((discount-terminal)/100))/Math.pow(1+discount/100,years);
 return Number.isFinite(pvCashflows+pvTerminal)&&pvCashflows+pvTerminal>=0?{value:pvCashflows+pvTerminal,pvCashflows,pvTerminal,projection}:null;
}
/* Matches legacy Tools Hub: two five-year growth stages and compounded dividends. */
export function requiredReturnModel(eps:number|null,dividend:number|null,a:ModelInputs){
 if(!valid(eps)||eps<=0||!valid(a.requiredReturn)||a.requiredReturn<=0||!valid(a.exitPe)||a.exitPe<=0||![a.growth,a.growth2,a.divGrowth,a.divGrowth2].every(v=>valid(v)&&v>-100))return null;
 let projectedEps=eps,projectedDividend=valid(dividend)?dividend:0;
 let futureDividends=0;const projection:{year:number;eps:number;dividend:number;futureDividend:number}[]=[];
 for(let year=1;year<=10;year++){
  projectedEps*=1+(year<=5?a.growth:a.growth2)/100;
  projectedDividend*=1+(year<=5?a.divGrowth:a.divGrowth2)/100;
  const futureDividend=projectedDividend*Math.pow(1+a.requiredReturn/100,10-year);
  futureDividends+=futureDividend;
  projection.push({year,eps:projectedEps,dividend:projectedDividend,futureDividend});
 }
 const exitValue=projectedEps*a.exitPe;
 const entry=(exitValue+futureDividends)/Math.pow(1+a.requiredReturn/100,10);
 return Number.isFinite(entry)&&entry>=0?{entry,exitValue,futureDividends,projection}:null;
}
export function grahamModel(eps:number|null,growth:number,aaaYield:number|null,price:number|null,dividendYield:number|null){
 if(!valid(eps)||eps<=0||!valid(growth)||growth<=-4.25)return null;
 const classic=eps*(8.5+2*growth);
 const adjusted=valid(aaaYield)&&aaaYield>0?classic*4.4/aaaYield:null;
 const pe=valid(price)&&price>0?price/eps:null;
 const peg=valid(pe)&&growth>0?pe/growth:null;
 const pegDividend=valid(pe)&&valid(dividendYield)&&growth+dividendYield>0?pe/(growth+dividendYield):null;
 return {classic,adjusted,peg,pegDividend};
}
/* Shared screening thresholds preserved from the legacy Graham–Lynch calculator.
   This is a qualitative screen, not an independently validated investment rating. */
export function grahamLynchVerdict(upside:number|null,pegDividend:number|null):string{
 const up=upside!==null&&Number.isFinite(upside);
 const peg=pegDividend!==null&&Number.isFinite(pegDividend);
 if(!up&&!peg)return "Insufficient data";
 if(up&&upside!==null&&upside>=.25&&peg&&pegDividend!==null&&pegDividend<=1.5)return "Attractive";
 if(up&&upside!==null&&upside>=.1&&(!peg||pegDividend!==null&&pegDividend<=2))return "Reasonable";
 if(up&&upside!==null&&upside<-.1&&peg&&pegDividend!==null&&pegDividend>2)return "Expensive";
 if(peg&&pegDividend!==null&&pegDividend<=1.2)return "PEG attractive";
 if(peg&&pegDividend!==null&&pegDividend>2.2)return "PEG stretched";
 return "Fair / neutral";
}
/* Legacy Tools Hub: 30 years explicit dividends, growth 10y then perpetual. */
export function dividendModel(dividend:number|null,growth:number,terminal:number,discount:number){
 if(!valid(dividend)||dividend<=0||![growth,terminal,discount].every(Number.isFinite)||growth<=-100||terminal<=-100||discount<=terminal||discount<=0)return null;
 let d=dividend,pvDividends=0;const projection:{year:number;dividend:number;pv:number}[]=[];
 for(let year=1;year<=30;year++){d*=1+(year<=10?growth:terminal)/100;const pv=d/Math.pow(1+discount/100,year);pvDividends+=pv;projection.push({year,dividend:d,pv})}
 const terminalValue=d*(1+terminal/100)/((discount-terminal)/100);
 const pvTerminal=terminalValue/Math.pow(1+discount/100,30);
 const value=pvDividends+pvTerminal;
 return Number.isFinite(value)&&value>=0?{value,pvDividends,pvTerminal,terminalValue,year30Dividend:d,projection}:null;
}
