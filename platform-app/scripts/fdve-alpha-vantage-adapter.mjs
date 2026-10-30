// Alpha Vantage annual fundamentals adapter. Pure functions: no network, no credentials.
// Keep provider observations separate from SEC facts until fiscal period, unit and definition match.
import {METRICS} from './fdve-model.mjs';
export const AV_FIELDS=Object.freeze({
 revenue:['income','totalRevenue'],netIncome:['income','netIncome'],
 operatingIncome:['income','operatingIncome'],epsDiluted:['income','reportedEPS'],
 cashFromOperations:['cashflow','operatingCashflow'],
 capex:['cashflow','capitalExpenditures'],
 cash:['balance','cashAndCashEquivalentsAtCarryingValue'],
 currentAssets:['balance','totalCurrentAssets'],
 currentLiabilities:['balance','totalCurrentLiabilities'],
 inventory:['balance','inventory'],totalAssets:['balance','totalAssets'],
 totalLiabilities:['balance','totalLiabilities'],
 equity:['balance','totalShareholderEquity'],
 longTermDebt:['balance','longTermDebt'],
 shortTermDebt:['balance','shortTermDebt']
});
export const AV_ENDPOINTS=Object.freeze({income:'INCOME_STATEMENT',balance:'BALANCE_SHEET',cashflow:'CASH_FLOW'});
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
export function normalizeAlphaVantageAnnual({ticker,metric,year,statements}){
 const field=AV_FIELDS[metric],definition=METRICS[metric];
 if(!field||!definition)return {status:'UNKNOWN_METRIC',metric};
 const [statement,key]=field;
 const reports=statements?.[statement]?.annualReports;
 if(!Array.isArray(reports))return {status:'SOURCE_UNAVAILABLE',metric,source:statement};
 const candidates=reports.filter(r=>r.fiscalDateEnding?.slice(0,4)===String(year));
 if(!candidates.length)return {status:'PERIOD_MISSING',metric,year};
 if(candidates.length>1)return {status:'AMBIGUOUS_PERIOD',metric,year};
 const report=candidates[0],raw=report[key];
 if(raw===undefined||raw===null||raw===''||raw==='None'||raw==='null')return {status:'FIELD_MISSING',metric,year,field:key};
 if(!/^-?(?:\d+\.?\d*|\.\d+)$/.test(String(raw)))return {status:'INVALID_VALUE',metric,year,field:key};
 const value=Number(raw);
 if(!Number.isFinite(value))return {status:'INVALID_VALUE',metric,year,field:key};
 if(!validDate(report.fiscalDateEnding))return {status:'INVALID_PERIOD',metric,year};
 const currency=report.reportedCurrency;
 if(currency!=='USD')return {status:'CURRENCY_REVIEW',metric,year,currency:currency||null};
 // Capital expenditures are cash outflows in AV; canonical capex is positive spending.
 if(metric==='capex'&&value>0)return {status:'SIGN_REVIEW',metric,year,value};
 const normalized=metric==='capex'?-value:value;
 if(definition.sign==='nonnegative'&&normalized<0)return {status:'SIGN_REVIEW',metric,year,value};
 return {status:'AVAILABLE',provider:'ALPHA_VANTAGE',ticker,metric,year,
  value:normalized,unit:definition.unit,periodEnd:report.fiscalDateEnding,
  field:key,statement,sourceEndpoint:AV_ENDPOINTS[statement],
  provenance:{provider:'ALPHA_VANTAGE',field:key,endpoint:AV_ENDPOINTS[statement]}};
}
export function compareAnnualFacts(sec,av,metric){
 if(!sec||!['AVAILABLE','DERIVED'].includes(sec.status))return {status:'SEC_UNAVAILABLE'};
 if(!av||av.status!=='AVAILABLE')return {status:'ALTERNATIVE_UNAVAILABLE',reason:av?.status||'MISSING'};
 if(sec.periodEnd!==av.periodEnd)return {status:'PERIOD_MISMATCH',secEnd:sec.periodEnd,alternativeEnd:av.periodEnd};
 if(sec.unit!==av.unit)return {status:'UNIT_MISMATCH',secUnit:sec.unit,alternativeUnit:av.unit};
 const delta=av.value-sec.value;
 const base=Math.max(Math.abs(sec.value),1);
 const tolerance=metric==='epsDiluted'?0.005:Math.max(1,base*0.00001);
 const status=Math.abs(delta)<=tolerance?'MATCH':Math.abs(delta)/base<=0.001?'ROUNDING':'REVIEW_REQUIRED';
 return {status,secValue:sec.value,alternativeValue:av.value,delta,deltaPct:delta/base*100,
  primary:'SEC',alternative:'ALPHA_VANTAGE',periodEnd:sec.periodEnd};
}
