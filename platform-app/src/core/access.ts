import type {Feature,Tier} from "./contracts";
export const tierGrants: Record<Tier,readonly Feature[]> = {
 free:["overview","discover","tools","research"],
 investor:["overview","discover","tools","company","valuation","options","research"],
 premium:["overview","discover","tools","company","valuation","options","probability","portfolio","research","academy"],
 ultra:["overview","discover","tools","company","valuation","options","probability","portfolio","research","academy"]
};
export function canAccess(tier:Tier, feature:Feature, purchased:readonly Feature[]=[]){return tierGrants[tier].includes(feature)||purchased.includes(feature)}
// UI preview only. Production authorisation must be enforced by trusted server APIs.
