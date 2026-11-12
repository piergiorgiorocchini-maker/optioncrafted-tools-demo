import snapshot from "./googleSheetsManualFinancials.json";

type CoreMetric={value:number;unit:string;currency:string;reportedLabel:string;xbrlTag:string;source:string;sourceUrl:string;dataStatus:string;reviewStatus:string;notes:string};
type StatementDetailRow={
 ticker:string;statement:string;metricId:string|null;reportedLabel:string;
 values:Record<string,number|null>;unit:string;handling:string;notes:string|null;
};
type Dataset={
 ticker:string;currency:string;generatedAt:string;
 ttm:{
  fiscalYear:string;periodStart:string;periodEnd:string;currency:string;source:string;
  metrics:Record<string,CoreMetric>;
  calculated:{standardFreeCashFlow:number;standardFreeCashFlowPerShare:number;calculatedEbitdaCore:number;grossMargin:number;operatingMargin:number;netMargin:number};
  supplemental:{reportedEbit:number|null;reportedEbitda:number|null;normalizedEbitda:number|null;normalizedIncome:number|null;reportedNormalizedEps:number|null;freeCashFlowToFirm:number|null;sourceReportedCommonDividendPerShare:number|null};
 };
 balanceSheetSnapshot:{
  fiscalYear:string;periodEnd:string;currency:string;unitScale:string;
  totalAssets:number|null;currentAssets:number|null;cashAndShortTermInvestments:number|null;inventory:number|null;
  receivables:number|null;otherCurrentAssets:number|null;totalNonCurrentAssets:number|null;totalLiabilities:number|null;
  equity:number|null;debtMaturitySchedule:number|null;operatingLeaseObligationMaturitySchedule:number|null;totalDebt:number|null;
  netDebt:number|null;workingCapital:number|null;investedCapital:number|null;tangibleBookValue:number|null;
  commonEquityBookValue:number|null;currentLiabilitiesDerived:number|null;currentLiabilitiesDerivedNote:string;
 };
 statementDetail:StatementDetailRow[];
};
const data=snapshot as unknown as Dataset;

export type ManualTtmFinancials={
 ticker:string;currency:string;fiscalYear:string;periodStart:string;periodEnd:string;source:string;sourceUrl:string|null;
 revenue:number;grossProfit:number;costOfRevenue:number;netIncome:number;operatingIncome:number;
 cashFromOperations:number;capex:number;freeCashFlow:number;freeCashFlowPerShare:number;dilutedEps:number;dilutedShares:number;
 depreciationAndAmortization:number;interestExpense:number;calculatedEbitda:number;
 reportedEbit:number|null;reportedEbitda:number|null;normalizedEbitda:number|null;normalizedIncome:number|null;
 reportedNormalizedEps:number|null;freeCashFlowToFirm:number|null;sourceReportedCommonDividendPerShare:number|null;
 grossMargin:number;operatingMargin:number;netMargin:number;
};
export type ManualBalanceSheetSnapshot={
 ticker:string;currency:string;fiscalYear:string;periodEnd:string;
 totalAssets:number|null;currentAssets:number|null;cashAndShortTermInvestments:number|null;currentLiabilities:number|null;
 inventory:number|null;receivables:number|null;otherCurrentAssets:number|null;totalNonCurrentAssets:number|null;
 totalLiabilities:number|null;equity:number|null;debtMaturitySchedule:number|null;operatingLeaseObligationMaturitySchedule:number|null;
 totalDebt:number|null;netDebt:number|null;workingCapital:number|null;investedCapital:number|null;tangibleBookValue:number|null;
 commonEquityBookValue:number|null;currentLiabilitiesDerivedNote:string;
};
export type ManualStatementData={ticker:string;currency:string;generatedAt:string;ttm:ManualTtmFinancials;balanceSheet:ManualBalanceSheetSnapshot;statementDetail:StatementDetailRow[]};

const core=(metric:string)=>data.ttm.metrics[metric]?.value;
const dollarsFromBillions=(value:number|null)=>value===null?null:value*1e9;

export function getManualTtmFinancials(ticker:string,currency?:string):ManualTtmFinancials|null{
 const symbol=ticker.trim().toUpperCase(),requested=currency?.trim().toUpperCase();
 if(symbol!==data.ticker||requested&&requested!==data.currency)return null;
 const metric=(key:string)=>core(key);
 const requiredMetrics=["revenue","grossProfit","costOfRevenue","netIncome","operatingIncome","cashFromOperations","capex","epsDiluted","dilutedShares","depreciationAndAmortization","interestExpense"];
 if(requiredMetrics.some(key=>typeof metric(key)!=="number"))return null;
 const revenue=metric("revenue")!,grossProfit=metric("grossProfit")!,costOfRevenue=metric("costOfRevenue")!,netIncome=metric("netIncome")!;
 const operatingIncome=metric("operatingIncome")!,cashFromOperations=metric("cashFromOperations")!,capex=metric("capex")!;
 const dilutedEps=metric("epsDiluted")!,dilutedShares=metric("dilutedShares")!,depreciationAndAmortization=metric("depreciationAndAmortization")!,interestExpense=metric("interestExpense")!;
 const sourceUrl=data.ttm.metrics.revenue.sourceUrl||null;
 return {ticker:symbol,currency:data.currency,fiscalYear:data.ttm.fiscalYear,periodStart:data.ttm.periodStart,periodEnd:data.ttm.periodEnd,source:data.ttm.source,sourceUrl,
  revenue,grossProfit,costOfRevenue,netIncome,operatingIncome,cashFromOperations,capex,
  freeCashFlow:data.ttm.calculated.standardFreeCashFlow,freeCashFlowPerShare:data.ttm.calculated.standardFreeCashFlowPerShare,
  dilutedEps,dilutedShares,depreciationAndAmortization,interestExpense,calculatedEbitda:data.ttm.calculated.calculatedEbitdaCore,
  reportedEbit:data.ttm.supplemental.reportedEbit,reportedEbitda:data.ttm.supplemental.reportedEbitda,
  normalizedEbitda:data.ttm.supplemental.normalizedEbitda,normalizedIncome:data.ttm.supplemental.normalizedIncome,
  reportedNormalizedEps:data.ttm.supplemental.reportedNormalizedEps,freeCashFlowToFirm:data.ttm.supplemental.freeCashFlowToFirm,
  sourceReportedCommonDividendPerShare:data.ttm.supplemental.sourceReportedCommonDividendPerShare,
  grossMargin:data.ttm.calculated.grossMargin,operatingMargin:data.ttm.calculated.operatingMargin,netMargin:data.ttm.calculated.netMargin};
}

export function getManualBalanceSheetSnapshot(ticker:string,currency?:string):ManualBalanceSheetSnapshot|null{
 const symbol=ticker.trim().toUpperCase(),requested=currency?.trim().toUpperCase();
 if(symbol!==data.ticker||requested&&requested!==data.currency)return null;
 const b=data.balanceSheetSnapshot;
 return {ticker:symbol,currency:data.currency,fiscalYear:b.fiscalYear,periodEnd:b.periodEnd,
  totalAssets:dollarsFromBillions(b.totalAssets),currentAssets:dollarsFromBillions(b.currentAssets),
  cashAndShortTermInvestments:dollarsFromBillions(b.cashAndShortTermInvestments),
  currentLiabilities:dollarsFromBillions(b.currentLiabilitiesDerived),inventory:dollarsFromBillions(b.inventory),
  receivables:dollarsFromBillions(b.receivables),otherCurrentAssets:dollarsFromBillions(b.otherCurrentAssets),
  totalNonCurrentAssets:dollarsFromBillions(b.totalNonCurrentAssets),totalLiabilities:dollarsFromBillions(b.totalLiabilities),
  equity:dollarsFromBillions(b.equity),debtMaturitySchedule:dollarsFromBillions(b.debtMaturitySchedule),
  operatingLeaseObligationMaturitySchedule:dollarsFromBillions(b.operatingLeaseObligationMaturitySchedule),
  totalDebt:dollarsFromBillions(b.totalDebt),netDebt:dollarsFromBillions(b.netDebt),workingCapital:dollarsFromBillions(b.workingCapital),
  investedCapital:dollarsFromBillions(b.investedCapital),tangibleBookValue:dollarsFromBillions(b.tangibleBookValue),
  commonEquityBookValue:dollarsFromBillions(b.commonEquityBookValue),currentLiabilitiesDerivedNote:b.currentLiabilitiesDerivedNote};
}

export function getManualStatementData(ticker:string):ManualStatementData|null{
 const symbol=ticker.trim().toUpperCase();
 if(symbol!==data.ticker)return null;
 const ttm=getManualTtmFinancials(symbol),balanceSheet=getManualBalanceSheetSnapshot(symbol);
 return ttm&&balanceSheet?{ticker:symbol,currency:data.currency,generatedAt:data.generatedAt,ttm,balanceSheet,statementDetail:data.statementDetail}:null;
}
