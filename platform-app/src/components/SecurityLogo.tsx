import {useEffect,useState} from "react";
import "./security-logo.css";

const logoRoots=[
 "https://cdn.jsdelivr.net/gh/ahmeterenodaci/Nasdaq-Stock-Exchange-including-Symbols-and-Logos/logos/_",
 "https://cdn.jsdelivr.net/gh/ahmeterenodaci/New-York-Stock-Exchange--NYSE--including-Symbols-and-Logos/logos/_"
];

export function SecurityLogo({ticker,size="default",onMarketResolved}:{ticker:string;size?:"small"|"default";onMarketResolved?:(market:"NASDAQ"|"NYSE")=>void}){
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>setAttempt(0),[ticker]);
 const symbol=ticker.trim().toUpperCase();
 const valid=/^[A-Z0-9.-]+$/.test(symbol);
 if(!valid||attempt>=logoRoots.length)return <span className="security-logo security-logo-fallback" data-size={size} aria-hidden="true">{symbol.slice(0,2)||"?"}</span>;
 const src=logoRoots[attempt]+encodeURIComponent(symbol)+".png";
 return <span className="security-logo" data-size={size} aria-hidden="true"><img src={src} alt="" loading="eager" referrerPolicy="no-referrer" onLoad={()=>onMarketResolved?.(attempt===0?"NASDAQ":"NYSE")} onError={()=>setAttempt(n=>n+1)}/></span>;
}
