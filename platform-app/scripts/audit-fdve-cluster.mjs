#!/usr/bin/env node
// Read-only five-company SEC coverage audit. Does not alter Fundamentals or AAPL pipeline.
// Requires SEC_USER_AGENT. Outputs an audit report, preserving unknown/missing concepts.
import fs from 'node:fs/promises';
import {METRICS} from './fdve-model.mjs';
const cfg=JSON.parse(await fs.readFile('platform-app/config/fdve-cluster-pilot.json','utf8'));
const agent=process.env.SEC_USER_AGENT;
if(!agent||!agent.includes('@')) throw new Error('SEC_USER_AGENT required');
const aliases={
 revenue:['RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerIncludingAssessedTax','Revenues','SalesRevenueNet','SalesRevenueGoodsNet','InterestAndDividendIncomeOperating','InterestIncomeExpenseAfterProvisionForLoanLoss'],
 netIncome:['NetIncomeLoss','ProfitLoss','NetIncomeLossAvailableToCommonStockholdersBasic'],
 operatingIncome:['OperatingIncomeLoss'],
 cashFromOperations:['NetCashProvidedByUsedInOperatingActivities'],
 capex:['PaymentsToAcquirePropertyPlantAndEquipment'],
 epsDiluted:['EarningsPerShareDiluted'],
 cash:['CashAndCashEquivalentsAtCarryingValue'],
 currentAssets:['AssetsCurrent'],
 currentLiabilities:['LiabilitiesCurrent'],
 inventory:['InventoryNet'],
 totalAssets:['Assets'],
 totalLiabilities:['Liabilities'],
 equity:['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
 longTermDebt:['LongTermDebtNoncurrent'],
 shortTermDebt:['LongTermDebtCurrent','CurrentPortionOfLongTermDebt']
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchCompany(cik){
 const url='https://data.sec.gov/api/xbrl/companyfacts/CIK'+cik+'.json';
 for(let i=0;i<4;i++){
  const r=await fetch(url,{headers:{'User-Agent':agent,Accept:'application/json'}});
  if(r.ok)return {data:await r.json(),url};
  if(![429,500,502,503,504].includes(r.status)||i===3)throw Error('SEC '+r.status+' '+cik);
  await sleep(1500*(i+1));
 }
}
const companies=[];
for(const company of cfg.companies){
 try{
  const {data,url}=await fetchCompany(company.cik);
  if(String(data.cik).padStart(10,'0')!==company.cik)throw Error('CIK mismatch');
  const concepts=data.facts?.['us-gaap']||{};
  const metrics={};
  for(const [metric,def] of Object.entries(METRICS)){
   const unit=def.unit,choices=aliases[metric]||[];
   const observations=choices.flatMap(tag=>(concepts[tag]?.units?.[unit]||[]).filter(x=>x.form==='10-K'||x.form==='10-Q').map(x=>({tag,value:x.val,start:x.start||null,end:x.end,filed:x.filed,form:x.form,accn:x.accn})));
   const annual=observations.filter(x=>x.start&&x.end&&Math.round((Date.parse(x.end)-Date.parse(x.start))/86400000)>=330&&Math.round((Date.parse(x.end)-Date.parse(x.start))/86400000)<=380);
   const instant=observations.filter(x=>!x.start&&x.end);
   const relevant=def.kind==='instant'?instant:annual;
   const years=['2024','2025'];
   const byYear=Object.fromEntries(years.map(year=>[year,relevant.filter(x=>x.end?.startsWith(year)).length]));
   metrics[metric]={status:relevant.length?'MAPPED':'UNMAPPED',tagsFound:[...new Set(observations.map(x=>x.tag))],annualOrInstantCount:relevant.length,byCalendarEndYear:byYear,latest:relevant.sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed))[0]||null};
  }
  const mapped=Object.values(metrics).filter(m=>m.status==='MAPPED').length;
  companies.push({...company,companyName:data.entityName,source:url,status:'FETCHED',mapped,metricCount:Object.keys(metrics).length,coverage:mapped/Object.keys(metrics).length,metrics});
 }catch(e){companies.push({...company,status:'SOURCE_ERROR',error:String(e.message)});}
 await sleep(200);
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),purpose:'Source mapping coverage only; not SEC/FMP value reconciliation',companies};
await fs.mkdir('platform-app/reports',{recursive:true});
await fs.writeFile('platform-app/reports/fdve-cluster-sec-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(companies.map(({ticker,status,mapped,metricCount,coverage,error})=>({ticker,status,mapped,metricCount,coverage,error})),null,2));
if(companies.some(x=>x.status==='SOURCE_ERROR'))process.exitCode=1;
