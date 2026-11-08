import sheetAnnualSecFacts from "./googleSheetsSecAnnual.json";

export type SecFinancialMetric =
  | "revenue"
  | "netIncome"
  | "operatingIncome"
  | "cashFromOperations"
  | "capex"
  | "epsDiluted";

type AnnualSecFact = {
  value:number;
  unit:string;
  tag:string;
  filedDate:string;
  accession:string;
  sourceUrl:string;
  form:string;
};
type AnnualSecPeriod = {
  ticker:string;
  cik:string;
  currency:string;
  periodStart:string;
  periodEnd:string;
  metrics:Partial<Record<SecFinancialMetric,AnnualSecFact>>;
};

export type SecAnnualFinancialYear = {
  fiscalYear:string;
  periodStart:string;
  periodEnd:string;
  currency:string;
  revenue:number|null;
  netIncome:number|null;
  operatingIncome:number|null;
  cashFromOperations:number|null;
  capex:number|null;
  freeCashFlow:number|null;
  dilutedEps:number|null;
  impliedShares:number|null;
  freeCashFlowPerShare:number|null;
  filedDate:string|null;
  importedAt:string|null;
  sources:Partial<Record<SecFinancialMetric,{tag:string;unit:string;filedDate:string;accession:string;sourceUrl:string}>>;
  missingMetrics:SecFinancialMetric[];
};

const dataset=sheetAnnualSecFacts as unknown as {
  generatedAt:string;
  sourceImportedAt:string;
  rawFactCount:number;
  annualPeriodCount:number;
  tickerCount:number;
  periods:AnnualSecPeriod[];
};

export const googleSheetsSecFinancialsMetadata={
  generatedAt:dataset.generatedAt,
  sourceImportedAt:dataset.sourceImportedAt,
  factCount:dataset.rawFactCount,
  annualPeriodCount:dataset.annualPeriodCount,
  tickerCount:dataset.tickerCount,
  source:"Google Sheets SEC_Raw · verified-source annual SEC facts",
} as const;

const FLOW_METRICS:SecFinancialMetric[]=["revenue","netIncome","operatingIncome","cashFromOperations","capex","epsDiluted"];

/**
 * Reads the annualized snapshot derived from SEC_Raw; it makes no provider calls.
 * Each period is already deduplicated to the latest verified filing for that
 * issuer, currency, fiscal start/end and metric.
 */
export function googleSheetsSecAnnualHistory(ticker:string,currency="USD"):SecAnnualFinancialYear[]{
  const normalizedTicker=ticker.trim().toUpperCase();
  const normalizedCurrency=currency.trim().toUpperCase();
  return dataset.periods
    .filter(period=>period.ticker.toUpperCase()===normalizedTicker&&period.currency===normalizedCurrency)
    .map(period=>{
      const value=(metric:SecFinancialMetric)=>period.metrics[metric]?.value??null;
      const netIncome=value("netIncome");
      const dilutedEps=value("epsDiluted");
      const cfo=value("cashFromOperations");
      const rawCapex=value("capex");
      const capex=rawCapex===null?null:Math.abs(rawCapex);
      const freeCashFlow=cfo!==null&&capex!==null?cfo-capex:null;
      const impliedShares=netIncome!==null&&netIncome>0&&dilutedEps!==null&&dilutedEps>0?netIncome/dilutedEps:null;
      const freeCashFlowPerShare=freeCashFlow!==null&&impliedShares!==null&&impliedShares>0?freeCashFlow/impliedShares:null;
      const sources=Object.fromEntries(Object.entries(period.metrics).map(([metric,fact])=>[metric,{
        tag:fact!.tag,
        unit:fact!.unit,
        filedDate:fact!.filedDate,
        accession:fact!.accession,
        sourceUrl:fact!.sourceUrl,
      }])) as SecAnnualFinancialYear["sources"];
      const missingMetrics=FLOW_METRICS.filter(metric=>!period.metrics[metric]);
      const records=Object.values(period.metrics);
      return {
        fiscalYear:period.periodEnd.slice(0,4),
        periodStart:period.periodStart,
        periodEnd:period.periodEnd,
        currency:normalizedCurrency,
        revenue:value("revenue"),
        netIncome,
        operatingIncome:value("operatingIncome"),
        cashFromOperations:cfo,
        capex,
        freeCashFlow,
        dilutedEps,
        impliedShares,
        freeCashFlowPerShare,
        filedDate:records.map(fact=>fact!.filedDate).sort().at(-1)??null,
        importedAt:dataset.sourceImportedAt,
        sources,
        missingMetrics,
      } satisfies SecAnnualFinancialYear;
    })
    .sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
}
