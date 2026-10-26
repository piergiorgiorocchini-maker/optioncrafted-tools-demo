import type {MarketDataProvider,Security} from "../core/contracts";
const records:Security[]=[
{ticker:"DEMO",name:"Illustrative Dividend Company",sector:"Industrials",currency:"USD",snapshotDate:"2026-10-24",price:30.50,eps:2,fcfPerShare:2.2,roic:16.2,buyBelow:26.85},
{ticker:"ALPHA",name:"Illustrative Quality Business",sector:"Technology",currency:"USD",snapshotDate:"2026-10-24",price:72.4,eps:3.8,fcfPerShare:4.2,roic:22.3,buyBelow:64.2},
{ticker:"BETA",name:"Illustrative Defensive Business",sector:"Consumer Staples",currency:"USD",snapshotDate:"2026-10-24",price:48.8,eps:2.9,fcfPerShare:3.15,roic:12.4,buyBelow:46.3}
];
export const demoProvider:MarketDataProvider={async listSecurities(){return records},async getSecurity(ticker){return records.find(x=>x.ticker===ticker)||null}};
// Later replace this adapter with Sheets/JSON/API provider returning the same Security contract.
