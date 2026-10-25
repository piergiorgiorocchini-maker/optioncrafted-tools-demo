// OptionsCrafted Platform Prototype v0.1
// Data access is isolated so a future Sheets/API provider can implement the same contract.
const demoProvider = {
  async load() {
    const response = await fetch("./data/demo.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Demo data unavailable");
    return response.json();
  }
};
const features = {
  overview: "Overview",
  scanner: "Market Explorer",
  company: "Company Intelligence",
  valuation: "Valuation Lab",
  options: "Options Lab",
  probability: "Probability Station",
  portfolio: "Portfolio Studio",
  research: "Research & Education",
  account: "Account & Products"
};
const tierAccess = {
  free: ["overview", "scanner", "research", "account"],
  investor: ["overview", "scanner", "company", "valuation", "options", "research", "account"],
  premium: ["overview", "scanner", "company", "valuation", "options", "probability", "portfolio", "research", "account"],
  ultra: Object.keys(features)
};
const productCatalog = [
  {name:"OptionsCrafted Investor",type:"Subscription",permission:"investor",status:"Concept"},
  {name:"OptionsCrafted Premium",type:"Subscription",permission:"premium",status:"Concept"},
  {name:"OptionsCrafted Ultra",type:"Subscription",permission:"ultra",status:"Concept"},
  {name:"The Option Edge",type:"Course / one-time purchase",permission:"course.option-edge",status:"Planned"},
  {name:"Independent Manager Research",type:"Publisher add-on",permission:"research.partner",status:"Exploratory"}
];
const state = {page:"overview",tier:"free",ticker:"DEMO",data:null};
const $ = id => document.getElementById(id);
const money = (n, digits=2) => Number(n).toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:digits,maximumFractionDigits:digits});
const number = n => Number(n).toLocaleString("en-US",{maximumFractionDigits:2});
const esc = value => String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const card = (title,html,extra="") => `<section class="card ${extra}"><h2>${title}</h2>${html}</section>`;
const metric = (label,value,description="") => `<section class="card"><div class="kicker">${label}</div><div class="metric">${value}</div><div class="muted">${description}</div></section>`;
function security(){return state.data.securities.find(s=>s.ticker===state.ticker)}
function allowed(section){return tierAccess[state.tier].includes(section)}
function table(headers,rows){return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`}
function notice(text){return card("Prototype note",`<p class="muted">${text}</p>`,"full")}
function locked(section){
  const required = ["company","valuation","options"].includes(section) ? "Investor" : "Premium";
  return `<div class="grid">${card("Access preview",`<div class="badge">Available from ${required}</div><p class="muted">This screen is intentionally restricted in the ${esc(state.tier)} tier preview. Change “View as” to inspect the mock experience. Actual security rules will be enforced in the backend.</p>`,"full")}</div>`;
}
function overview(s){
 return `<div class="grid">
  ${metric("Active security",esc(s.ticker),esc(s.name))}
  ${metric("Illustrative stock price",money(s.price),esc(s.sector))}
  ${metric("Valuation buy-under",money(s.valuation.buyUnder),"Model-dependent estimate")}
  ${card("From research to action",`<p class="muted">Discover a business, inspect the financial profile, test valuation assumptions, examine a cash-secured put, and evaluate portfolio exposure. The selected ticker stays active across all sections.</p><div class="actions"><button data-goto="company">Company intelligence</button><button data-goto="valuation">View valuation</button><button data-goto="options">Model put</button></div>`,"wide")}
  ${card("Subscription preview",`<div class="badge">${esc(state.tier.toUpperCase())}</div><p class="muted">Permissions are simulated with an entitlement matrix. Courses and partner research can be purchased separately from platform subscriptions.</p>`)}
  ${notice("This is an interactive product structure prototype. All prices, EPS, metrics, option premiums, and valuations are hypothetical and do not constitute investable quotes.")}</div>`;
}
function scanner(){
 const rows=state.data.securities.map(s=>[esc(s.ticker),esc(s.name),esc(s.sector),money(s.price),number(s.roic)+"%",money(s.valuation.buyUnder),`<button data-ticker="${esc(s.ticker)}">Open</button>`]);
 return `<div class="grid">${card("Security universe · demo",`<p class="muted">Three hypothetical companies; schema designed for expansion to a Sheets snapshot or financial-data API.</p>${table(["Ticker","Company","Sector","Price","ROIC","Buy-under",""],rows)}`,"full")}</div>`;
}
function company(s){
 return `<div class="grid">
 ${metric("Earnings per share",money(s.eps),"Illustrative annual value")}
 ${metric("Return on invested capital",number(s.roic)+"%","Simplified demo metric")}
 ${metric("Debt / equity",number(s.debtToEquity)+"×","Illustrative leverage ratio")}
 ${card("Fundamentals snapshot",table(["Field","Value"],[["Revenue",money(s.revenue,0)],["Free cash flow",money(s.fcf,0)],["Dividend/share",money(s.dividend)],["Industry",esc(s.sector)]]),"wide")}
 ${card("Research questions",'<p class="muted">Are cash flows durable? Does the business earn returns above its cost of capital? Can it fund its dividends through a downturn? Peer comparisons and source-backed annual statements will be connected later.</p>')}
 </div>`;
}
function valuation(s){
 const upside=(s.valuation.buyUnder/s.price-1)*100;
 return `<div class="grid">${metric("Current price",money(s.price),"Hypothetical market price")}
 ${metric("Buy-under price",money(s.valuation.buyUnder),"Imported illustrative assumption")}
 ${metric("Value gap",number(upside)+"%","Buy-under relative to price")}
 ${card("Model assumptions",`<p class="muted">${esc(s.valuation.assumptions)}</p><p class="muted">Prototype only: the buy-under figure comes from the demo dataset, not a recalculation. Our existing Fair Value Calculator will become the calculation engine.</p>`,"wide")}
 ${card("Next decision",`<p class="muted">If the stock trades above your acceptable acquisition price, evaluate the net cost from a short put.</p><div class="actions"><button data-goto="options">Go to Options Lab</button></div>`)}
 </div>`;
}
function options(s){
 const o=s.option, collateral=o.strike*100, premium=o.premium*100, net=o.strike-o.premium;
 const expirationPrices=[0.7,0.85,0.95,1,1.05,1.2].map(m=>Number((o.strike*m).toFixed(2)));
 const rows=expirationPrices.map(price=>[money(price),money((Math.min(price-o.strike,0)+o.premium)*100),money((price-s.price)*100)]);
 return `<div class="grid">
 ${metric("Short put strike",money(o.strike),esc(o.kind))}
 ${metric("Premium / contract",money(premium),number(o.months)+" months assumed")}
 ${metric("Effective cost if assigned",money(net),"Strike less premium")}
 ${card("Cash-secured put · illustrative",table(["Input","Value"],[["Gross collateral",money(collateral)],["Premium on collateral",number(premium/collateral*100)+"%"],["Distance to strike",number((o.strike/s.price-1)*100)+"%"],["Contracts","1 × 100 shares"]]),"wide")}
 ${card("Decision context",`<p class="muted">Valuation buy-under: <strong>${money(s.valuation.buyUnder)}</strong>. Net assignment cost: <strong>${money(net)}</strong>.</p><span class="badge">${net<=s.valuation.buyUnder?"Below valuation threshold":"Above valuation threshold"}</span><p class="muted">Premium is not a live quote. Actual availability, liquidity, contract details and assignment risk must be checked.</p>`)}
 ${card("Expiration scenario comparison",table(["Underlying at expiry","Short put P/L","Stock buy-and-hold P/L"],rows),"full")}
 </div>`;
}
function research(){
 return `<div class="grid">${card("Research library",'<p class="muted">Editorial articles, fundamental research, independent perspectives and product walkthroughs can link back to WordPress without duplicating the CMS.</p><span class="badge">Architecture demo</span>',"wide")}
 ${card("The Option Edge",'<p class="muted">Planned course catalog item. Course access will be an independent entitlement, not hard-coded to a subscription.</p><span class="badge">Planned</span>')}
 ${card("Contributor publications",'<p class="muted">Partner and fund-manager research may be sold as add-ons, subject to editorial contracts and licensing.</p><span class="badge">Exploratory</span>',"full")}</div>`;
}
function account(){
 return `<div class="grid">${card("Products & entitlements",`<p class="muted">A user can hold a platform tier plus separate product grants. This sample catalog is structural, not an actual offer or pricing page.</p>${table(["Product","Commercial model","Entitlement","Status"],productCatalog.map(p=>[esc(p.name),esc(p.type),`<code>${esc(p.permission)}</code>`,esc(p.status)]))}`,"full")}
 ${card("Future billing",'<p class="muted">Provider adapter for recurring plans, one-time purchases, trial periods and partner payouts. No payment details are processed here.</p>',"wide")}
 ${card("Current preview",`<span class="badge">${esc(state.tier)}</span><p class="muted">The tier selector is local-only and does not confer access rights.</p>`)}</div>`;
}
function placeholder(name){return `<div class="grid">${card(name,`<p class="muted">Navigation and entitlement structure ready. Next iteration will integrate existing OptionsCrafted calculators with shared ticker data, then probability and portfolio modules. No fake analytics are presented as calculated results.</p><span class="badge">Feature shell</span>`,"full")}</div>`}
function render(){
 const s=security(); $("pageTitle").textContent=features[state.page];
 $("dataStatus").textContent=`DEMO · snapshot ${state.data.metadata.asOf} · no live feed`;
 $("nav").innerHTML=Object.entries(features).map(([key,label])=>`<button data-page="${key}" class="${state.page===key?"active":""}" aria-current="${state.page===key?"page":"false"}">${label}${allowed(key)?"":" ·"}</button>`).join("");
 const sections={overview:()=>overview(s),scanner,company:()=>company(s),valuation:()=>valuation(s),options:()=>options(s),probability:()=>placeholder("Probability Station"),portfolio:()=>placeholder("Portfolio Studio"),research,account};
 $("content").innerHTML=allowed(state.page)?sections[state.page]():locked(state.page);
 document.querySelectorAll("[data-page],[data-goto]").forEach(el=>el.addEventListener("click",()=>{state.page=el.dataset.page||el.dataset.goto;render()}));
 document.querySelectorAll("[data-ticker]").forEach(el=>el.addEventListener("click",()=>{state.ticker=el.dataset.ticker;$("ticker").value=state.ticker;state.page="overview";render()}));
}
async function init(){
 try{
 state.data=await demoProvider.load();
 $("ticker").innerHTML=state.data.securities.map(s=>`<option value="${esc(s.ticker)}">${esc(s.ticker)} · ${esc(s.name)}</option>`).join("");
 $("ticker").value=state.ticker;
 $("ticker").addEventListener("change",e=>{state.ticker=e.target.value;render()});
 $("tier").addEventListener("change",e=>{state.tier=e.target.value;render()});
 render();
 }catch(error){$("content").textContent="Unable to load demo data. Run this project from a local web server.";console.error(error)}
}
init();
