import type {FundamentalInputs} from "../core/fundamentalMetrics";
import {verifiedAnnualHistory,verifiedFinancialProfile} from "./verifiedFinancials";
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
export type SecFinancialInputs=Partial<FundamentalInputs>&{periodEnd?:string;fiscalYear?:string;profile?:string;instrumentType?:string;currency?:string;source?:string};
export function getSecFinancialInputs(ticker:string,currency?:string):SecFinancialInputs{
 const classification=getSecFinancialClassification(ticker);
 const latest=verifiedAnnualHistory(ticker,currency).at(-1);
 const metadata:SecFinancialInputs={profile:classification.profile,instrumentType:classification.instrumentType,source:latest&&!classification.isFundOrIndex?"SEC EDGAR · annual":"",...(latest?{periodEnd:latest.periodEnd,fiscalYear:latest.year,currency:latest.currency}:{})};
 if(!latest||classification.isFundOrIndex||classification.isFinancial)return metadata;
 return {...metadata,cash:latest.cash,shortTermInvestments:null,currentAssets:latest.currentAssets,currentLiabilities:latest.currentLiabilities,
  inventory:latest.inventory,receivables:null,totalDebt:latest.totalDebt,minorityInterest:null,preferredEquity:null,ebitda:latest.ebitda,
  ebit:latest.operatingIncome,interestExpense:latest.interestExpense,freeCashFlow:latest.fcf,equity:latest.equity};
}
