export type Tier = "free" | "investor" | "premium" | "ultra";
export type Feature = "overview"|"discover"|"company"|"valuation"|"options"|"probability"|"portfolio"|"research"|"academy";
export interface Security { ticker:string; name:string; sector:string; currency:string; snapshotDate:string; price:number; eps:number; fcfPerShare:number; roic:number; buyBelow:number; }
export interface MarketDataProvider { listSecurities():Promise<Security[]>; getSecurity(ticker:string):Promise<Security|null>; }
export interface Product {id:string;name:string;category:"strategy"|"course"|"research"|"subscription";access:Feature[];}
