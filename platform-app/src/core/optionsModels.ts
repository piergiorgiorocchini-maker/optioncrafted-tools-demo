/* Deterministic expiration payoffs. All option premiums are user-supplied,
   never inferred from a price snapshot or represented as live chain quotes. */
export type OptionKind="put"|"call";
export type OptionSide="long"|"short";
export type OptionLeg={id:number;kind:OptionKind;side:OptionSide;strike:number|null;premium:number|null;contracts:number};
export const validPositive=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>0;
export const validNonNegative=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>=0;
export function intrinsic(kind:OptionKind,spot:number,strike:number){return kind==="call"?Math.max(spot-strike,0):Math.max(strike-spot,0)}
export function legProfit(leg:OptionLeg,spot:number){if(!validPositive(leg.strike)||!validNonNegative(leg.premium)||leg.contracts<1)return null;const side=leg.side==="long"?1:-1;return side*(intrinsic(leg.kind,spot,leg.strike)-leg.premium)*100*leg.contracts}
export function strategyProfit(legs:OptionLeg[],spot:number){if(!legs.length)return null;let total=0;for(const leg of legs){const value=legProfit(leg,spot);if(value===null)return null;total+=value}return total}
export function cspModel(spot:number|null,strike:number|null,premium:number|null,contracts:number,dte:number){
 if(!validPositive(spot)||!validPositive(strike)||!validNonNegative(premium)||premium>=strike||contracts<1||dte<=0)return null;
 const shares=contracts*100,capital=strike*shares,totalPremium=premium*shares,breakeven=strike-premium;
 const returnOnCash=totalPremium/capital;
 return {shares,capital,totalPremium,breakeven,returnOnCash,annualized:Math.pow(1+returnOnCash,365/dte)-1,discount:(spot-breakeven)/spot,maxLoss:breakeven*shares,profit:(s:number)=>(premium-Math.max(strike-s,0))*shares};
}
export function coveredCallModel(spot:number|null,basis:number|null,strike:number|null,premium:number|null,contracts:number,dte:number,dividend=0){
 if(!validPositive(spot)||!validPositive(basis)||!validPositive(strike)||!validNonNegative(premium)||!validNonNegative(dividend)||contracts<1||dte<=0)return null;
 const shares=contracts*100,premiumTotal=premium*shares,breakeven=basis-premium-dividend;
 const maxProfit=(strike-basis+premium+dividend)*shares;
 return {shares,premiumTotal,breakeven,maxProfit,capital:basis*shares,premiumYield:premium/basis,returnIfCalled:maxProfit/(basis*shares),profit:(s:number)=>(Math.min(s,strike)-basis+premium+dividend)*shares};
}
export function wheelModel(spot:number|null,putStrike:number|null,putPremium:number|null,callStrike:number|null,callPremium:number|null,contracts:number){
 if(!validPositive(spot)||!validPositive(putStrike)||!validNonNegative(putPremium)||putPremium>=putStrike||!validPositive(callStrike)||!validNonNegative(callPremium)||contracts<1)return null;
 const shares=contracts*100;
 const adjustedBasis=putStrike-putPremium-callPremium;
 return {shares,putCredit:putPremium*shares,callCredit:callPremium*shares,totalCredit:(putPremium+callPremium)*shares,adjustedBasis,assignedCapital:putStrike*shares,profit:(s:number)=>(Math.min(s,callStrike)-adjustedBasis)*shares};
}
export function hedgeModel(basis:number|null,putStrike:number|null,putPremium:number|null,callStrike:number|null,callPremium:number|null,shares:number){
 if(!validPositive(basis)||!validPositive(putStrike)||!validNonNegative(putPremium)||shares<=0)return null;
 const collar=validPositive(callStrike)&&validNonNegative(callPremium);
 const netDebit=putPremium-(collar?callPremium:0);
 const profit=(s:number)=>(Math.max(s,putStrike)-(collar?Math.max(s-callStrike,0):0)-basis-netDebit)*shares;
 return {netDebit:netDebit*shares,protectedFloor:(putStrike-basis-netDebit)*shares,cappedProfit:collar?(callStrike-basis-netDebit)*shares:null,profit,collar};
}
export function standardNormalCdf(x:number){
 const sign=x<0?-1:1,z=Math.abs(x)/Math.SQRT2,t=1/(1+0.3275911*z);
 const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-z*z);
 return (1+sign*erf)/2;
}
export function lognormalProbability(spot:number|null,strike:number|null,iv:number|null,dte:number,riskFree=0){
 if(!validPositive(spot)||!validPositive(strike)||!validPositive(iv)||dte<=0)return null;
 const time=dte/365,vol=iv/100,mu=(riskFree/100-vol*vol/2)*time,sigma=vol*Math.sqrt(time);
 const z=(Math.log(strike/spot)-mu)/sigma;
 const below=standardNormalCdf(z);
 return {below,above:1-below,sigma,mu};
}
export function scenarioPoints(spot:number,strikes:number[],payoff:(price:number)=>number,comparison?:(price:number)=>number){
 const high=Math.max(spot,...strikes)*1.55,low=Math.max(0,Math.min(spot,...strikes)*0.48);
 return Array.from({length:91},(_,i)=>{const price=low+(high-low)*i/90;return {price:Number(price.toFixed(2)),payoff:payoff(price),comparison:comparison?comparison(price):null}});
}
