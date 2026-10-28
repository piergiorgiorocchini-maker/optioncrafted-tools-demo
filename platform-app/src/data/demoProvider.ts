import type {MarketDataProvider,Security} from "../core/contracts";
import assets from "./assetsSnapshot.json";
import research from "./aaplResearch.json";
const a=assets.records.find(x=>x.ticker==="AAPL");
const records:Security[]=a?[{ticker:a.ticker,name:a.name,sector:a.sector,currency:a.currency,snapshotDate:assets.exportedAt,price:a.price??0,eps:a.eps??0,fcfPerShare:research.fcfPerShare,roic:0,buyBelow:0}]:[];
// Compatibility adapter for the visual shell. ROIC and buyBelow = 0 mean unavailable;
// never present these fields as validated AAPL research metrics.
export const demoProvider:MarketDataProvider={async listSecurities(){return records},async getSecurity(ticker){return records.find(x=>x.ticker===ticker)||null}};
