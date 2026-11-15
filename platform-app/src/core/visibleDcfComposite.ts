import {dcfModel,modelDefaults,type ModelInputs} from "./valuationModels";
import {verifiedFcf} from "../data/verifiedFinancials";
import {getWaccValuation} from "./waccValuation";

/**
 * The DCF Synthesis uses only methods visible in Premium Analysis > DCF Engine.
 * Manual and CAPM are FCF/share valuations; WACC is FCFF less net debt.
 * All three return equity value per diluted share; missing results are excluded.
 * This default research snapshot is separate from the user's editable inputs.
 */
export function buildVisibleDcfComposite(asset:{ticker:string;currency:string;beta:number|null},inputs:ModelInputs=modelDefaults,riskFree=4,erp=5.5){
 const fcf=verifiedFcf(asset.ticker,asset.currency).perShare;
 const manual=dcfModel(fcf,inputs.growth,inputs.discount,inputs.terminal,inputs.years);
 const capmDiscount=typeof asset.beta==="number"&&Number.isFinite(asset.beta)&&asset.beta>=0?riskFree+asset.beta*erp:null;
 const capm=capmDiscount===null?null:dcfModel(fcf,inputs.growth,capmDiscount,inputs.terminal,inputs.years);
 const wacc=getWaccValuation(asset.ticker,asset.currency);
 const parts=[
  manual&&{id:"manual" as const,label:"Manual DCF",value:manual.value},
  capm&&{id:"capm" as const,label:"CAPM DCF",value:capm.value},
  wacc&&{id:"wacc" as const,label:"WACC DCF",value:wacc.value}
 ].filter((part):part is {id:"manual"|"capm"|"wacc";label:string;value:number}=>part!==null);
 const values=parts.map(part=>part.value);
 const value=values.length?values.reduce((sum,v)=>sum+v,0)/values.length:null;
 // Range describes dispersion across available model point estimates.
 // It is not a probabilistic confidence interval or 5/7/10Y horizon range.
 const range=values.length?{low:Math.min(...values),high:Math.max(...values)}:null;
 return {value,range,parts,fcfPerShare:fcf,capmDiscount,inputs:{growth:inputs.growth,discount:inputs.discount,terminal:inputs.terminal,years:inputs.years,riskFree,erp,beta:asset.beta},wacc};
}
