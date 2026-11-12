import type {FundamentalInputs} from "../core/fundamentalMetrics";
import {verifiedAnnualHistory,verifiedFinancialProfile} from "./verifiedFinancials";
import {getManualBalanceSheetSnapshot,getManualTtmFinancials} from "./googleSheetsManualFinancials";
import adminCoverage from "./adminCoverageSnapshot.json";
type CoverageTicker={ticker:string;instrumentType?:string;valuationProfile?:string};
const classifications=(adminCoverage as unknown as {tickers:CoverageTicker[]}).tickers;
const financialProfiles=new Set(["BANK","CONSUMER_FINANCE","BROKERAGE","FINANCIAL_MARKET_INFRASTRUCTURE","INSURANCE"]);
export type SecClassification={instrumentType:string;profile:string;isFundOrIndex:boolean;isFinancial:boolean;isReitOrMlp:boolean};
export function getSecFinancialClassification(ticker:string):SecClassification{
 const symbol=ticker.trim().toUpperCase(),entry=classifications.find(x=>x.ticker.toUpperCase()===symbol);
 const instrumentType=String(entry?.instrumentType||"UNKNOWN").toUpperCase();
 const profile=String(entry?.valuationProfile||verifiedFinancialProfile(symbol)||"UNKNOWN").toUpperCase();
 return {instrumentType,profile,isFundOrIndex:["ETF","INDEX"].includes(instrumentType)||profile.startsWith("ETF_")||profile.endsWith("_INDEX")||profile==="BROAD_MARKET_INDEX"||profile==="VOLATILITY_INDEX",isFinancial:financialProfiles.has(profile),isReitOrMlp:/REIT|MLP/.test(profile)};
}
export type SecFinancialInputs=Partial<FundamentalInputs>&{periodEnd?:string;fiscalYear?:string;profile?:string;instrumentType?:string;currency?:string;source?:string;balanceSheetPeriodEnd?:string;balanceSheetNote?:string};
export function getSecFinancialInputs(ticker:string,currency?:string):SecFinancialInputs{
 const classification=getSecFinancialClassification(ticker);
 const latest=verifiedAnnualHistory(ticker,currency).at(-1);
 const manualTtm=getManualTtmFinancials(ticker,currency);
 const manualBalance=getManualBalanceSheetSnapshot(ticker,currency);
 const hasManual=Boolean(manualTtm||manualBalance);
 const metadata:SecFinancialInputs={
  profile:classification.profile,instrumentType:classification.instrumentType,
  source:hasManual
   ? "Google Sheets manual statement import · income/cash flow TTM through "+(manualTtm?.periodEnd??"N/D")+" · balance sheet "+(manualBalance?.periodEnd??"N/D")
   : latest&&!classification.isFundOrIndex?"SEC EDGAR · annual":"",
  ...(manualTtm?{periodEnd:manualTtm.periodEnd,fiscalYear:manualTtm.fiscalYear,currency:manualTtm.currency}:latest?{periodEnd:latest.periodEnd,fiscalYear:latest.year,currency:latest.currency}:{}),
  ...(manualBalance?{balanceSheetPeriodEnd:manualBalance.periodEnd,balanceSheetNote:manualBalance.currentLiabilitiesDerivedNote}:{})
 };
 if(classification.isFundOrIndex||classification.isFinancial)return metadata;
 if(!latest&&!manualTtm)return metadata;
 return {...metadata,
  cash:manualBalance?.cashAndShortTermInvestments??latest?.cash??null,
  shortTermInvestments:null,
  currentAssets:manualBalance?.currentAssets??latest?.currentAssets??null,
  currentLiabilities:manualBalance?.currentLiabilities??latest?.currentLiabilities??null,
  inventory:manualBalance?.inventory??latest?.inventory??null,
  receivables:manualBalance?.receivables??null,
  totalDebt:manualBalance?.totalDebt??latest?.totalDebt??null,
  minorityInterest:null,preferredEquity:null,
  ebitda:manualTtm?.calculatedEbitda??latest?.ebitda??null,
  ebit:manualTtm?.operatingIncome??latest?.operatingIncome??null,
  interestExpense:manualTtm?.interestExpense??latest?.interestExpense??null,
  freeCashFlow:manualTtm?.freeCashFlow??latest?.fcf??null,
  equity:manualBalance?.equity??latest?.equity??null
 };
}
