export type WaccInputs={
 ticker:string;
 company:string;
 financialAsOf:string;
 marketAsOf:string;
 revenueTtm:number;
 revenuePriorTtm:number;
 fy26RevenueGrowth:number;
 ebitTtm:number;
 interestExpenseTtm:number;
 priorYearDebt:number;
 totalDebt:number;
 cash:number;
 shortTermInvestments:number;
 depreciation:number;
 capex:number;
 historicalNwcCashRelease:number;
 taxRate:number;
 dilutedShares:number;
 price:number;
 marketCap:number;
 beta:number;
 riskFreeRate:number;
 equityRiskPremium:number;
 terminalGrowth:number;
};

const adobeInputs:WaccInputs={
 ticker:"ADBE",
 company:"Adobe Inc.",
 financialAsOf:"2026-08-28",
 marketAsOf:"2026-11-13",
 revenueTtm:25970,
 revenuePriorTtm:23181,
 fy26RevenueGrowth:0.11914678783289157,
 ebitTtm:9271,
 interestExpenseTtm:260,
 priorYearDebt:6210,
 totalDebt:6363,
 cash:4359,
 shortTermInvestments:1280,
 depreciation:766,
 capex:214,
 historicalNwcCashRelease:498,
 taxRate:0.225,
 dilutedShares:400,
 price:243.08,
 marketCap:94610,
 beta:1.38,
 riskFreeRate:0.0515,
 equityRiskPremium:0.0441,
 terminalGrowth:0.038
};

export const dataByTicker:Record<string,WaccInputs>={ADBE:adobeInputs};
export const formatMillions=(value:number)=>"$"+new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(value)+"m";
export const formatNumber=(value:number,digits=1)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:digits}).format(value);
export const formatPct=(value:number,digits=2)=>(value*100).toFixed(digits)+"%";
export const formatPrice=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(value);

export function buildModel(input:WaccInputs){
 const revenueGrowth=input.revenueTtm/input.revenuePriorTtm-1;
 const ebitMargin=input.ebitTtm/input.revenueTtm;
 const depreciationRatio=input.depreciation/input.revenueTtm;
 const capexRatio=input.capex/input.revenueTtm;
 const costOfEquity=input.riskFreeRate+input.beta*input.equityRiskPremium;
 const costOfDebt=input.interestExpenseTtm/((input.priorYearDebt+input.totalDebt)/2);
 const afterTaxCostOfDebt=costOfDebt*(1-input.taxRate);
 const equityWeight=input.marketCap/(input.marketCap+input.totalDebt);
 const debtWeight=input.totalDebt/(input.marketCap+input.totalDebt);
 const wacc=equityWeight*costOfEquity+debtWeight*afterTaxCostOfDebt;
 const netDebt=input.totalDebt-input.cash-input.shortTermInvestments;
 const normalizedStartingFcff=input.ebitTtm*(1-input.taxRate)+input.depreciation-input.capex;
 let previousRevenue=input.revenueTtm;
 const projections=Array.from({length:5},(_,index)=>{
  const year=index+1;
  const growth=revenueGrowth+(input.terminalGrowth-revenueGrowth)*year/5;
  const revenue=previousRevenue*(1+growth);
  previousRevenue=revenue;
  const ebit=revenue*ebitMargin;
  const nopat=ebit*(1-input.taxRate);
  const depreciation=revenue*depreciationRatio;
  const capex=revenue*capexRatio;
  const deltaNwc=0;
  const fcff = nopat + depreciation - capex + deltaNwc;
  const discountFactor=1/Math.pow(1+wacc,year);
  return {year:2026+year,growth,revenue,ebitMargin,ebit,taxRate:input.taxRate,nopat,depreciation,capex,deltaNwc,fcff,discountFactor,pvFcff:fcff*discountFactor};
 });
 const finalFcff=projections[projections.length-1].fcff;
 const terminalValue=finalFcff*(1+input.terminalGrowth)/(wacc-input.terminalGrowth);
 const pvTerminal=terminalValue*projections[projections.length-1].discountFactor;
 const pvExplicit=projections.reduce((total,row)=>total+row.pvFcff,0);
 const enterpriseValue=pvExplicit+pvTerminal;
 const equityValue=enterpriseValue-netDebt;
 const fairValue=equityValue/input.dilutedShares;
 const waccCases=[wacc-0.005,wacc,wacc+0.005];
 const terminalCases=[0.03,0.035,input.terminalGrowth];
 const sensitivity=waccCases.map((scenarioWacc)=>terminalCases.map((growth)=>{
  const forecastPv=projections.reduce((total,row,index)=>total+row.fcff/Math.pow(1+scenarioWacc,index+1),0);
  const terminalAtYear5=finalFcff*(1+growth)/(scenarioWacc-growth);
  const presentValue=terminalAtYear5/Math.pow(1+scenarioWacc,5);
  return (forecastPv+presentValue-netDebt)/input.dilutedShares;
 }));
 return {revenueGrowth,ebitMargin,depreciationRatio,capexRatio,costOfEquity,costOfDebt,afterTaxCostOfDebt,equityWeight,debtWeight,wacc,netDebt,normalizedStartingFcff,projections,terminalValue,pvTerminal,pvExplicit,enterpriseValue,equityValue,fairValue,upside:fairValue/input.price-1,terminalShare:pvTerminal/enterpriseValue,waccCases,terminalCases,sensitivity};
}


// The same underlying FCFF/WACC model powers both the worksheet and the
// published valuation bridge. Missing tickers never inherit Adobe assumptions.
export function getWaccValuation(ticker:string,currency:string="USD"){
 if(currency!=="USD")return null;
 const input=dataByTicker[ticker.toUpperCase()];
 if(!input||input.ticker.toUpperCase()!==ticker.toUpperCase())return null;
 if(!Number.isFinite(input.dilutedShares)||input.dilutedShares<=0)return null;
 const result=buildModel(input);
 if(!Number.isFinite(result.wacc)||result.wacc<=input.terminalGrowth)return null;
 if(!Number.isFinite(result.fairValue)||result.fairValue<=0)return null;
 return {value:result.fairValue,wacc:result.wacc,financialAsOf:input.financialAsOf,marketAsOf:input.marketAsOf,method:"FCFF discounted at WACC",quality:0.7};
}
