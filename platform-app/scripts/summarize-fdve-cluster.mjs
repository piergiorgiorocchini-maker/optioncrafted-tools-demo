#!/usr/bin/env node
// Read-only interpretation of the existing five-company SEC mapping audit.
import fs from 'node:fs/promises';
const report=JSON.parse(await fs.readFile('platform-app/reports/fdve-cluster-sec-coverage.json','utf8'));
const config=JSON.parse(await fs.readFile('platform-app/config/fdve-sector-profiles.json','utf8'));
const results=[];
for(const company of report.companies){
 const profile=Object.entries(config.profiles).find(([,p])=>p.companies.includes(company.ticker));
 if(!profile)throw Error('Missing profile for '+company.ticker);
 const [profileName,definition]=profile;
 const applicable=definition.applicable;
 const valid=applicable.filter(metric=>company.metrics?.[metric]?.status==='MAPPED');
 const unmapped=applicable.filter(metric=>company.metrics?.[metric]?.status!=='MAPPED');
 const notApplicable=definition.notApplicable||[];
 results.push({ticker:company.ticker,profile:profileName,status:company.status,applicable:applicable.length,mappedApplicable:valid.length,coverage:valid.length/applicable.length,unmapped,notApplicable,optional:definition.optional||[]});
}
const output={schemaVersion:1,sourceReportAt:report.generatedAt,createdAt:new Date().toISOString(),warning:'Coverage of taxonomy presence only, not period-validated financial values or provider reconciliation',companies:results,aggregate:{applicable:results.reduce((n,x)=>n+x.applicable,0),mapped:results.reduce((n,x)=>n+x.mappedApplicable,0)}};
output.aggregate.coverage=output.aggregate.mapped/output.aggregate.applicable;
await fs.mkdir('platform-app/reports',{recursive:true});
await fs.writeFile('platform-app/reports/fdve-cluster-sector-coverage.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
