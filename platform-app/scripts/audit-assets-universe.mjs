#!/usr/bin/env node
// Read-only inventory of the existing OptionsCrafted Assets snapshot.
// Instrument type is never inferred from the provider's "sector" field.
import fs from 'node:fs/promises';
const src='platform-app/src/data/assetsSnapshot.json';
const snapshot=JSON.parse(await fs.readFile(src,'utf8'));
const etfs=new Set('AAAU AMLP BIL BTC CONL DURA EEM EFA ETH EWZ FXI GBTC GDX GDXY GLD GLDM GUNR IAU IBB IBIT IEMG INDA IWM IXC IYR KWEB MSTY PHYS PPLT QQQ RSP SHY SIVR SLV SLYV SPY TIP TSLT TQQQ URA USO VEA VNQ VTV VWO XLB XLC XLE XLF XLK XLP XLU XLV XLY XOP'.split(' '));
const indices=new Set(['INDEXNASDAQ:.IXIC','VIX']);
const equityReview=new Set(['ASST','BTBT','BTCS','CCCM','CRCL','CRWV','ENVL','HONA','NBIS','SBET','SMLR','SPCX','STRC']);
// Listing venue and index membership are separate dimensions. Unknown is not a negative.
const listingAndMembership=()=>({listingExchange:'UNVERIFIED',indexMembership:[],
 membershipStatus:'NOT_CHECKED',classificationSource:null,verifiedAt:null});
const classification=record=>{
 const t=record.ticker;
 if(indices.has(t))return {instrumentType:'INDEX',review:false};
 if(etfs.has(t))return {instrumentType:'FUND_OR_ETP',review:false};
 if(equityReview.has(t))return {instrumentType:'EQUITY_CANDIDATE',review:true,reason:'IDENTITY_OR_INSTRUMENT_TYPE'};
 return {instrumentType:'EQUITY_CANDIDATE',review:false};
};
const knownCiks=new Map([['AAPL','0000320193'],['MSFT','0000789019'],['XOM','0000034088'],['WMT','0000104169'],['JPM','0000019617']]);
const records=snapshot.records.map(r=>({ticker:r.ticker,name:r.name,sourceSector:r.sector,
 ...classification(r),...listingAndMembership(),cik:knownCiks.get(r.ticker)||null,issuerIdentityStatus:knownCiks.has(r.ticker)?'VERIFIED_PILOT':'PENDING_SEC_MATCH',fundamentalModel:indices.has(r.ticker)?'NOT_APPLICABLE':etfs.has(r.ticker)?'FUND_ANALYTICS':'ISSUER_FUNDAMENTALS',
 snapshotDate:snapshot.exportedAt}));
const duplicates=records.filter((r,i)=>records.findIndex(x=>x.ticker===r.ticker)!==i).map(x=>x.ticker);
const counts=Object.fromEntries([...new Set(records.map(x=>x.instrumentType))].map(k=>[k,records.filter(x=>x.instrumentType===k).length]));
const report={schemaVersion:1,source:src,snapshotDate:snapshot.exportedAt,sourceIsLive:snapshot.dataIsLive,
 total:records.length,unique:new Set(records.map(x=>x.ticker)).size,duplicates,counts,
 manualReview:records.filter(x=>x.review),classificationCoverage:{listingVerified:0,indexMembershipVerified:0,issuerIdentityVerified:records.filter(x=>x.issuerIdentityStatus==='VERIFIED_PILOT').length},records};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('OptionsCrafted Assets inventory | snapshot '+report.snapshotDate+' | live='+report.sourceIsLive);
 console.log('Total='+report.total+' unique='+report.unique+' duplicates='+duplicates.length);
 console.log('Types: '+JSON.stringify(counts));
 console.log('Manual review candidates: '+report.manualReview.map(x=>x.ticker).join(', '));
 console.log('Listing venue and index memberships are unverified placeholders, not inferred from sector or ticker.');
 console.log('No SEC data fetched and no financial coverage implied.');
}
if(duplicates.length)process.exitCode=1;
