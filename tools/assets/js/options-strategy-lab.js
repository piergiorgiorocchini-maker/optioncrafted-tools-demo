/* OptionsCrafted – Options Strategy Lab
   Version: v6
   File: tools/options-strategy-lab/options-strategy-lab.js

   Core logic:
   - Preset strategy legs stay linked to the Number of Contracts field.
   - One option contract controls 100 shares.
   - Preset stock legs display real shares: 1 contract = 100 shares, 2 = 200 shares.
   - Custom added legs remain independent.
   - Covered / cash-secured / wheel strategies use dedicated accounting logic.
   - Chart shows current underlying price, breakeven line(s), strikes, and red/green P/L zones.

   Educational model only:
   - Expiry payoff only.
   - No Greeks.
   - No IV surface.
   - No commissions, taxes, slippage, liquidity or broker-specific margin engine.
   - No early assignment modelling, only assignment notes.
*/

(function () {
  "use strict";

  const MULTIPLIER = 100;

  const els = {
    strategySelect: document.getElementById("strategySelect"),
    underlyingPrice: document.getElementById("underlyingPrice"),
    contractCount: document.getElementById("contractCount"),
    daysToExpiration: document.getElementById("daysToExpiration"),
    addLegBtn: document.getElementById("addLegBtn"),
    legsTableBody: document.getElementById("legsTableBody"),

    metricOneLabel: document.getElementById("metricOneLabel"),
    metricTwoLabel: document.getElementById("metricTwoLabel"),
    metricThreeLabel: document.getElementById("metricThreeLabel"),
    metricFourLabel: document.getElementById("metricFourLabel"),

    netDebitCredit: document.getElementById("netDebitCredit"),
    maxProfit: document.getElementById("maxProfit"),
    maxLoss: document.getElementById("maxLoss"),
    breakeven: document.getElementById("breakeven"),

    payoffChart: document.getElementById("payoffChart"),
    scenarioTableBody: document.getElementById("scenarioTableBody"),
    strategyDiagnostics: document.getElementById("strategyDiagnostics"),
    accountingLens: document.getElementById("accountingLens")
  };

  let legs = [];

  const strategyDescriptions = {
    "long-call": {
      label: "Long Call",
      bias: "Bullish",
      structure: "Defined-risk debit strategy",
      useCase: "Used when the investor expects upside movement and wants limited downside.",
      warning: "Time decay works against the buyer. If the underlying stays below the strike at expiry, the premium can be lost."
    },
    "long-put": {
      label: "Long Put",
      bias: "Bearish",
      structure: "Defined-risk debit strategy",
      useCase: "Used when the investor expects downside movement or wants directional protection.",
      warning: "Time decay works against the buyer. The underlying must move enough to overcome the premium paid."
    },
    "covered-call": {
      label: "Covered Call",
      bias: "Neutral to moderately bullish",
      structure: "Stock ownership plus short call",
      useCase: "Used to generate income from shares already owned and define a potential exit price.",
      warning: "Upside is capped above the short call strike. Assignment is possible, especially around dividends."
    },
    "cash-secured-put": {
      label: "Cash-Secured Put",
      bias: "Neutral to moderately bullish",
      structure: "Short put backed by cash",
      useCase: "Used to get paid while waiting to buy an asset at a chosen strike.",
      warning: "If assigned, the investor must buy 100 shares per contract. The real risk is owning the underlying after a large decline."
    },
    "protective-put": {
      label: "Protective Put",
      bias: "Bullish with downside protection",
      structure: "Stock ownership plus long put",
      useCase: "Used to protect an existing stock position against downside risk.",
      warning: "Protection has a cost. The premium paid reduces upside and total return."
    },
    "bull-call-spread": {
      label: "Bull Call Spread",
      bias: "Moderately bullish",
      structure: "Defined-risk debit spread",
      useCase: "Used when upside is expected but the investor wants lower cost than buying a call outright.",
      warning: "Upside is capped at the short call strike."
    },
    "bear-put-spread": {
      label: "Bear Put Spread",
      bias: "Moderately bearish",
      structure: "Defined-risk debit spread",
      useCase: "Used when downside is expected but the investor wants lower cost than buying a put outright.",
      warning: "Downside profit is capped at the short put strike."
    },
    "bull-put-credit-spread": {
      label: "Bull Put Credit Spread",
      bias: "Neutral to bullish",
      structure: "Defined-risk credit spread",
      useCase: "Used to collect premium when the investor expects the underlying to stay above the short put strike.",
      warning: "The credit is compensation for accepting downside obligation. Maximum loss can exceed the initial credit."
    },
    "bear-call-credit-spread": {
      label: "Bear Call Credit Spread",
      bias: "Neutral to bearish",
      structure: "Defined-risk credit spread",
      useCase: "Used to collect premium when the investor expects the underlying to stay below the short call strike.",
      warning: "The credit is compensation for accepting upside obligation. Maximum loss can exceed the initial credit."
    },
    "long-straddle": {
      label: "Long Straddle",
      bias: "Volatility expansion",
      structure: "Long call and long put at same strike",
      useCase: "Used when a large move is expected but direction is uncertain.",
      warning: "Requires a large move to overcome the combined premium. Time decay is aggressive."
    },
    "long-strangle": {
      label: "Long Strangle",
      bias: "Volatility expansion",
      structure: "Long OTM call and long OTM put",
      useCase: "Used when a large move is expected and the investor wants a lower-cost alternative to a straddle.",
      warning: "Both options may expire worthless if the move is not large enough."
    },
    "iron-condor": {
      label: "Iron Condor",
      bias: "Range-bound / neutral",
      structure: "Defined-risk credit structure with short call spread and short put spread",
      useCase: "Used to collect premium when the investor expects the underlying to remain inside a range.",
      warning: "Losses occur when price breaks strongly outside the expected range."
    },
    "wheel-entry": {
      label: "Wheel Entry",
      bias: "Neutral to bullish accumulation",
      structure: "Cash-secured put entry stage",
      useCase: "Used to get paid while targeting assignment at a chosen entry price.",
      warning: "Assignment is not a failure if the strike was intentionally selected. The real question is whether the underlying is worth owning."
    },
    "wheel-covered-call": {
      label: "Wheel Covered Call",
      bias: "Neutral to moderately bullish income",
      structure: "Assigned shares plus short call",
      useCase: "Used after assignment to generate income and define a potential exit.",
      warning: "Upside is capped, and the position still carries stock downside risk."
    },
    "wheel-full-cycle": {
      label: "Wheel Full Cycle",
      bias: "Income and disciplined accumulation/distribution",
      structure: "Simplified wheel cycle model",
      useCase: "Used to model a simplified cycle: assigned stock cost basis plus covered-call exit.",
      warning: "This is a simplified expiry model, not a full path-dependent wheel simulator."
    },
    "custom-multileg": {
      label: "Custom Multi-Leg",
      bias: "User-defined",
      structure: "Custom strategy",
      useCase: "Used to model any combination of long/short calls, puts, and optional stock legs.",
      warning: "The engine calculates expiry payoff. It does not judge whether the structure is suitable, liquid, or broker-margin efficient."
    },
    "naked-short-put": {
      label: "Naked Short Put",
      bias: "Neutral to bullish",
      structure: "Undefined-risk short put without cash-secured framing",
      useCase: "Used to model the payoff of an uncovered short put obligation.",
      warning: "This structure can create large losses if the underlying falls sharply. It is a margin-risk model, not a conservative income strategy."
    },
    "naked-short-call": {
      label: "Naked Short Call",
      bias: "Neutral to bearish",
      structure: "Undefined-risk short call",
      useCase: "Used to model the payoff of an uncovered short call obligation.",
      warning: "This structure has theoretically unlimited loss if the underlying rises sharply. It is included for modelling completeness, not as a recommended income structure."
    }
  };

  function getNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  function money(value) {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  }

  function signedMoney(value) {
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) < 0.005) return "$0.00";
    return value > 0 ? `+${money(value)}` : money(value);
  }

  function perShare(value) {
    if (!Number.isFinite(value)) return "—";
    return `$${value.toFixed(2)}/share`;
  }

  function pct(value) {
    if (!Number.isFinite(value)) return "—";
    return `${value.toFixed(2)}%`;
  }

  function getUnderlying() {
    return Math.max(0.01, getNumber(els.underlyingPrice.value, 100));
  }

  function getBaseContracts() {
    return Math.max(1, Math.floor(getNumber(els.contractCount.value, 1)));
  }

  function getDte() {
    return Math.max(0, Math.floor(getNumber(els.daysToExpiration.value, 30)));
  }

  function createLeg({ side, type, strike = 0, premium = 0, ratio = 1, custom = false, qty = null }) {
    return normalizeLeg({
      side,
      type,
      strike,
      premium,
      ratio,
      custom,
      qty: qty === null ? ratio : qty
    });
  }

  function defaultPresets(strategy, spot) {
    const atm = round2(spot);
    const otmUp = round2(spot * 1.05);
    const otmUp2 = round2(spot * 1.10);
    const otmDown = round2(spot * 0.95);
    const otmDown2 = round2(spot * 0.90);

    const premium = {
      low: round2(Math.max(0.25, spot * 0.012)),
      mid: round2(Math.max(0.50, spot * 0.025)),
      high: round2(Math.max(0.75, spot * 0.04))
    };

    switch (strategy) {
      case "long-call":
        return [createLeg({ side: "long", type: "call", strike: atm, premium: premium.mid })];

      case "long-put":
        return [createLeg({ side: "long", type: "put", strike: atm, premium: premium.mid })];

      case "covered-call":
        return [
          createLeg({ side: "long", type: "stock", premium: spot }),
          createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.low })
        ];

      case "cash-secured-put":
        return [createLeg({ side: "short", type: "put", strike: otmDown, premium: premium.low })];

      case "protective-put":
        return [
          createLeg({ side: "long", type: "stock", premium: spot }),
          createLeg({ side: "long", type: "put", strike: otmDown, premium: premium.low })
        ];

      case "bull-call-spread":
        return [
          createLeg({ side: "long", type: "call", strike: atm, premium: premium.mid }),
          createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.low })
        ];

      case "bear-put-spread":
        return [
          createLeg({ side: "long", type: "put", strike: atm, premium: premium.mid }),
          createLeg({ side: "short", type: "put", strike: otmDown, premium: premium.low })
        ];

      case "bull-put-credit-spread":
        return [
          createLeg({ side: "short", type: "put", strike: otmDown, premium: premium.mid }),
          createLeg({ side: "long", type: "put", strike: otmDown2, premium: premium.low })
        ];

      case "bear-call-credit-spread":
        return [
          createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.mid }),
          createLeg({ side: "long", type: "call", strike: otmUp2, premium: premium.low })
        ];

      case "long-straddle":
        return [
          createLeg({ side: "long", type: "call", strike: atm, premium: premium.mid }),
          createLeg({ side: "long", type: "put", strike: atm, premium: premium.mid })
        ];

      case "long-strangle":
        return [
          createLeg({ side: "long", type: "call", strike: otmUp, premium: premium.low }),
          createLeg({ side: "long", type: "put", strike: otmDown, premium: premium.low })
        ];

      case "iron-condor":
        return [
          createLeg({ side: "long", type: "put", strike: otmDown2, premium: premium.low }),
          createLeg({ side: "short", type: "put", strike: otmDown, premium: premium.mid }),
          createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.mid }),
          createLeg({ side: "long", type: "call", strike: otmUp2, premium: premium.low })
        ];

      case "wheel-entry":
        return [createLeg({ side: "short", type: "put", strike: otmDown, premium: premium.mid })];

      case "wheel-covered-call":
        return [
          createLeg({ side: "long", type: "stock", premium: spot }),
          createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.mid })
        ];

      case "wheel-full-cycle": {
        const putPremium = premium.mid;
        const assignedNetCost = round2(otmDown - putPremium);
        return [
          createLeg({ side: "long", type: "stock", premium: assignedNetCost }),
          createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.low })
        ];
      }

      case "naked-short-put":
        return [createLeg({ side: "short", type: "put", strike: otmDown, premium: premium.mid })];

      case "naked-short-call":
        return [createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.mid })];

      case "custom-multileg":
      default:
        return [
          createLeg({ side: "long", type: "call", strike: atm, premium: premium.mid, custom: true, qty: 1 }),
          createLeg({ side: "short", type: "call", strike: otmUp, premium: premium.low, custom: true, qty: 1 })
        ];
    }
  }

  function normalizeLeg(leg) {
    const type = ["call", "put", "stock"].includes(leg.type) ? leg.type : "call";
    const custom = Boolean(leg.custom);

    return {
      side: leg.side === "short" ? "short" : "long",
      type,
      strike: type === "stock" ? 0 : Math.max(0, getNumber(leg.strike, 0)),
      premium: Math.max(0, getNumber(leg.premium, 0)),
      ratio: Math.max(1, Math.floor(getNumber(leg.ratio, 1))),
      custom,
      qty: Math.max(1, Math.floor(getNumber(leg.qty, type === "stock" && custom ? 100 : 1)))
    };
  }

  function getLegUnits(rawLeg) {
    const leg = normalizeLeg(rawLeg);
    const baseContracts = getBaseContracts();

    if (leg.custom) {
      if (leg.type === "stock") {
        return {
          optionContracts: 0,
          shares: leg.qty,
          display: `${leg.qty} shares`,
          unitCount: leg.qty
        };
      }

      return {
        optionContracts: leg.qty,
        shares: leg.qty * MULTIPLIER,
        display: `${leg.qty} ${leg.qty === 1 ? "contract" : "contracts"}`,
        unitCount: leg.qty
      };
    }

    if (leg.type === "stock") {
      const shares = baseContracts * leg.ratio * MULTIPLIER;
      return {
        optionContracts: 0,
        shares,
        display: `${shares} shares`,
        unitCount: shares
      };
    }

    const optionContracts = baseContracts * leg.ratio;
    return {
      optionContracts,
      shares: optionContracts * MULTIPLIER,
      display: `${optionContracts} ${optionContracts === 1 ? "contract" : "contracts"}`,
      unitCount: optionContracts
    };
  }

  function setPreset(strategy) {
    legs = defaultPresets(strategy, getUnderlying()).map(normalizeLeg);
    renderLegRows();
    updateAll(false);
  }

  function renderLegRows() {
    if (!els.legsTableBody) return;

    els.legsTableBody.innerHTML = legs.map((rawLeg, index) => {
      const leg = normalizeLeg(rawLeg);
      const units = getLegUnits(leg);
      const strikeDisabled = leg.type === "stock" ? "disabled" : "";
      const strikeValue = leg.type === "stock" ? "" : leg.strike;
      const qtyCell = leg.custom
        ? `<input class="leg-qty" data-index="${index}" type="number" step="1" value="${leg.qty}" />`
        : `<span class="leg-quantity-display">${units.display}</span>`;

      return `
        <tr data-leg-index="${index}" class="${leg.custom ? "custom-leg-row" : "preset-leg-row"}">
          <td>
            <select class="leg-side" data-index="${index}">
              <option value="long" ${leg.side === "long" ? "selected" : ""}>Long</option>
              <option value="short" ${leg.side === "short" ? "selected" : ""}>Short</option>
            </select>
          </td>

          <td>
            <select class="leg-type" data-index="${index}">
              <option value="call" ${leg.type === "call" ? "selected" : ""}>Call</option>
              <option value="put" ${leg.type === "put" ? "selected" : ""}>Put</option>
              <option value="stock" ${leg.type === "stock" ? "selected" : ""}>Stock</option>
            </select>
          </td>

          <td>
            <input class="leg-strike" data-index="${index}" type="number" step="0.01" value="${strikeValue}" ${strikeDisabled} />
          </td>

          <td>
            <input class="leg-premium" data-index="${index}" type="number" step="0.01" value="${leg.premium}" />
          </td>

          <td>${qtyCell}</td>

          <td>
            <button class="remove-leg-btn" data-index="${index}" type="button" aria-label="Remove leg">×</button>
          </td>
        </tr>
      `;
    }).join("");

    bindLegRowEvents();
  }

  function bindLegRowEvents() {
    const rowInputs = els.legsTableBody.querySelectorAll("select, input");
    rowInputs.forEach((node) => {
      node.addEventListener("input", handleLegInput);
      node.addEventListener("change", handleLegInput);
    });

    const removeBtns = els.legsTableBody.querySelectorAll(".remove-leg-btn");
    removeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.index);
        legs.splice(index, 1);
        if (legs.length === 0) {
          legs.push(createLeg({
            side: "long",
            type: "call",
            strike: getUnderlying(),
            premium: Math.max(0.25, round2(getUnderlying() * 0.02)),
            custom: true,
            qty: 1
          }));
        }
        renderLegRows();
        updateAll(false);
      });
    });
  }

  function handleLegInput(event) {
    const target = event.target;
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index) || !legs[index]) return;

    const leg = normalizeLeg(legs[index]);

    if (target.classList.contains("leg-side")) {
      leg.side = target.value === "short" ? "short" : "long";
    }

    if (target.classList.contains("leg-type")) {
      const previousType = leg.type;
      leg.type = target.value;

      if (leg.type === "stock") {
        leg.strike = 0;
        if (leg.custom && previousType !== "stock") leg.qty = 100;
      }

      if (leg.type !== "stock" && previousType === "stock" && leg.custom) {
        leg.qty = 1;
      }

      legs[index] = normalizeLeg(leg);
      renderLegRows();
      updateAll(false);
      return;
    }

    if (target.classList.contains("leg-strike")) {
      leg.strike = Math.max(0, getNumber(target.value, 0));
    }

    if (target.classList.contains("leg-premium")) {
      leg.premium = Math.max(0, getNumber(target.value, 0));
    }

    if (target.classList.contains("leg-qty")) {
      leg.qty = Math.max(1, Math.floor(getNumber(target.value, 1)));
    }

    legs[index] = normalizeLeg(leg);
    updateAll(false);
  }

  function legOpeningOptionCashflow(rawLeg) {
    const leg = normalizeLeg(rawLeg);
    if (leg.type === "stock") return 0;

    const units = getLegUnits(leg);
    const direction = leg.side === "short" ? 1 : -1;
    return direction * leg.premium * units.shares;
  }

  function totalOpeningOptionCashflow() {
    return legs.reduce((sum, leg) => sum + legOpeningOptionCashflow(leg), 0);
  }

  function legPayoffAtExpiry(rawLeg, expiryPrice) {
    const leg = normalizeLeg(rawLeg);
    const units = getLegUnits(leg);
    const side = leg.side === "short" ? -1 : 1;

    if (leg.type === "call") {
      const intrinsic = Math.max(0, expiryPrice - leg.strike);
      return side * (intrinsic - leg.premium) * units.shares;
    }

    if (leg.type === "put") {
      const intrinsic = Math.max(0, leg.strike - expiryPrice);
      return side * (intrinsic - leg.premium) * units.shares;
    }

    if (leg.type === "stock") {
      return side * (expiryPrice - leg.premium) * units.shares;
    }

    return 0;
  }

  function totalPayoffAtExpiry(price) {
    return legs.reduce((sum, leg) => sum + legPayoffAtExpiry(leg, price), 0);
  }

  function getAllStrikes() {
    return legs
      .map(normalizeLeg)
      .filter((leg) => leg.type !== "stock")
      .map((leg) => leg.strike)
      .filter((x) => Number.isFinite(x) && x > 0);
  }

  function buildCalculationPriceGrid() {
    const spot = getUnderlying();
    const strikes = getAllStrikes();
    const maxAnchor = Math.max(spot, ...strikes, spot * 1.2);
    const max = Math.max(maxAnchor * 1.7, spot + 30);
    const steps = 260;
    const inc = max / steps;

    const prices = [];
    for (let i = 0; i <= steps; i += 1) {
      prices.push(round2(inc * i));
    }

    strikes.forEach((strike) => prices.push(round2(strike)));
    prices.push(round2(spot));

    return Array.from(new Set(prices)).sort((a, b) => a - b);
  }

  function buildVisualPriceGrid(extraAnchors = []) {
    const spot = getUnderlying();
    const strikes = getAllStrikes();
    const anchors = [spot, ...strikes, ...extraAnchors].filter((x) => Number.isFinite(x) && x >= 0);

    const minAnchor = Math.min(...anchors);
    const maxAnchor = Math.max(...anchors);

    /*
      Visual range is deliberately different from calculation range.
      Calculation range includes zero and wide tails.
      Visual range should remain readable around spot, strikes and breakevens.
    */
    const anchorSpread = Math.max(maxAnchor - minAnchor, spot * 0.10);
    const visualPad = Math.max(spot * 0.18, anchorSpread * 0.55, 6);

    let min = Math.max(0, minAnchor - visualPad);
    let max = maxAnchor + visualPad;

    /*
      Avoid absurdly narrow charts when all strikes are near spot.
    */
    const minWidth = Math.max(spot * 0.45, 12);
    if (max - min < minWidth) {
      const mid = (max + min) / 2;
      min = Math.max(0, mid - minWidth / 2);
      max = mid + minWidth / 2;
    }

    const steps = 220;
    const inc = (max - min) / steps;

    const prices = [];
    for (let i = 0; i <= steps; i += 1) {
      prices.push(round2(min + inc * i));
    }

    anchors.forEach((anchor) => {
      if (anchor >= min && anchor <= max) prices.push(round2(anchor));
    });

    return Array.from(new Set(prices)).sort((a, b) => a - b);
  }

  function calculateMetrics() {
    const prices = buildCalculationPriceGrid();
    const points = prices.map((price) => ({ price, pnl: totalPayoffAtExpiry(price) }));

    let maxProfit = -Infinity;
    let maxLoss = Infinity;

    points.forEach((point) => {
      if (point.pnl > maxProfit) maxProfit = point.pnl;
      if (point.pnl < maxLoss) maxLoss = point.pnl;
    });

    const highTailSlope = getHighPriceTailSlope();
    const maxProfitFinal = highTailSlope > 0 ? Infinity : maxProfit;
    const maxLossFinal = highTailSlope < 0 ? -Infinity : maxLoss;
    const breakevens = findBreakevens(points);

    return {
      calculationPrices: prices,
      calculationPoints: points,
      visualPrices: buildVisualPriceGrid(breakevens),
      optionCashflow: totalOpeningOptionCashflow(),
      maxProfit: maxProfitFinal,
      maxLoss: maxLossFinal,
      breakevens
    };
  }

  function getHighPriceTailSlope() {
    return legs.reduce((slope, rawLeg) => {
      const leg = normalizeLeg(rawLeg);
      const units = getLegUnits(leg);
      const signedShares = (leg.side === "short" ? -1 : 1) * units.shares;

      if (leg.type === "call") return slope + signedShares;
      if (leg.type === "stock") return slope + signedShares;
      return slope;
    }, 0);
  }

  function findBreakevens(points) {
    const breakevens = [];

    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];

      if (Math.abs(prev.pnl) < 0.01) {
        breakevens.push(prev.price);
        continue;
      }

      if ((prev.pnl < 0 && curr.pnl > 0) || (prev.pnl > 0 && curr.pnl < 0)) {
        const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
        const be = prev.price + (curr.price - prev.price) * ratio;
        breakevens.push(round2(be));
      }
    }

    return Array.from(new Set(breakevens));
  }

  function getFirstLeg(filterFn) {
    return legs.map(normalizeLeg).find(filterFn) || null;
  }

  function getMatchingLegs(filterFn) {
    return legs.map(normalizeLeg).filter(filterFn);
  }

  function getCoveredCallData() {
    const stock = getFirstLeg((leg) => leg.type === "stock" && leg.side === "long");
    const shortCall = getFirstLeg((leg) => leg.type === "call" && leg.side === "short");
    if (!stock || !shortCall) return null;

    const callUnits = getLegUnits(shortCall);
    const stockUnits = getLegUnits(stock);
    const shares = Math.min(stockUnits.shares, callUnits.shares);

    return {
      stock,
      shortCall,
      shares,
      contracts: callUnits.optionContracts,
      stockCost: stock.premium,
      strike: shortCall.strike,
      premium: shortCall.premium,
      optionIncome: shortCall.premium * callUnits.shares,
      stockGainToStrike: (shortCall.strike - stock.premium) * shares,
      maxCoveredProfit: (shortCall.strike - stock.premium + shortCall.premium) * shares,
      effectiveExit: shortCall.strike + shortCall.premium,
      breakeven: stock.premium - shortCall.premium,
      premiumCushion: shortCall.premium
    };
  }

  function getCashSecuredPutData() {
    const shortPut = getFirstLeg((leg) => leg.type === "put" && leg.side === "short");
    if (!shortPut) return null;

    const units = getLegUnits(shortPut);
    return {
      shortPut,
      contracts: units.optionContracts,
      shares: units.shares,
      strike: shortPut.strike,
      premium: shortPut.premium,
      premiumIncome: shortPut.premium * units.shares,
      assignmentCash: shortPut.strike * units.shares,
      effectiveEntry: shortPut.strike - shortPut.premium,
      breakeven: shortPut.strike - shortPut.premium,
      maxLossToZero: (shortPut.strike - shortPut.premium) * units.shares
    };
  }

  function getProtectivePutData() {
    const stock = getFirstLeg((leg) => leg.type === "stock" && leg.side === "long");
    const longPut = getFirstLeg((leg) => leg.type === "put" && leg.side === "long");
    if (!stock || !longPut) return null;

    const putUnits = getLegUnits(longPut);
    const stockUnits = getLegUnits(stock);
    const shares = Math.min(stockUnits.shares, putUnits.shares);
    const protectionCost = longPut.premium * putUnits.shares;
    const maxProtectedLoss = Math.max(0, (stock.premium + longPut.premium - longPut.strike) * shares);

    return {
      stock,
      longPut,
      shares,
      contracts: putUnits.optionContracts,
      stockCost: stock.premium,
      strike: longPut.strike,
      premium: longPut.premium,
      protectionCost,
      protectedFloor: longPut.strike,
      breakeven: stock.premium + longPut.premium,
      maxProtectedLoss
    };
  }

  function updateMetricCardLabelsAndValues(metrics) {
    const strategy = els.strategySelect.value;
    const standard = {
      one: ["Option Net Cashflow", signedMoney(metrics.optionCashflow)],
      two: ["Max Profit", metrics.maxProfit === Infinity ? "Unlimited" : money(metrics.maxProfit)],
      three: ["Max Loss", metrics.maxLoss === -Infinity ? "Unlimited" : money(Math.abs(metrics.maxLoss))],
      four: ["Breakeven", metrics.breakevens.length ? metrics.breakevens.map((x) => `$${x.toFixed(2)}`).join(" / ") : "—"]
    };

    let cardData = standard;

    if (strategy === "covered-call" || strategy === "wheel-covered-call" || strategy === "wheel-full-cycle") {
      const cc = getCoveredCallData();
      if (cc) {
        cardData = {
          one: ["Option Income", money(cc.optionIncome)],
          two: ["Effective Exit", perShare(cc.effectiveExit)],
          three: ["Premium Cushion", perShare(cc.premiumCushion)],
          four: ["Max Covered Profit", money(cc.maxCoveredProfit)]
        };
      }
    }

    if (strategy === "cash-secured-put" || strategy === "wheel-entry") {
      const csp = getCashSecuredPutData();
      if (csp) {
        cardData = {
          one: ["Put Premium", money(csp.premiumIncome)],
          two: ["Assignment Cash", money(csp.assignmentCash)],
          three: ["Effective Entry", perShare(csp.effectiveEntry)],
          four: ["Breakeven", perShare(csp.breakeven)]
        };
      }
    }

    if (strategy === "protective-put") {
      const pp = getProtectivePutData();
      if (pp) {
        cardData = {
          one: ["Protection Cost", money(pp.protectionCost)],
          two: ["Protected Floor", perShare(pp.protectedFloor)],
          three: ["Max Protected Loss", money(pp.maxProtectedLoss)],
          four: ["Breakeven", perShare(pp.breakeven)]
        };
      }
    }

    if (strategy === "naked-short-put") {
      const csp = getCashSecuredPutData();
      if (csp) {
        cardData = {
          one: ["Premium Received", money(csp.premiumIncome)],
          two: ["Breakeven", perShare(csp.breakeven)],
          three: ["Max Profit", money(csp.premiumIncome)],
          four: ["Max Loss to Zero", money(csp.maxLossToZero)]
        };
      }
    }

    if (els.metricOneLabel) els.metricOneLabel.textContent = cardData.one[0];
    if (els.metricTwoLabel) els.metricTwoLabel.textContent = cardData.two[0];
    if (els.metricThreeLabel) els.metricThreeLabel.textContent = cardData.three[0];
    if (els.metricFourLabel) els.metricFourLabel.textContent = cardData.four[0];

    els.netDebitCredit.textContent = cardData.one[1];
    els.maxProfit.textContent = cardData.two[1];
    els.maxLoss.textContent = cardData.three[1];
    els.breakeven.textContent = cardData.four[1];

    [els.netDebitCredit, els.maxProfit, els.maxLoss, els.breakeven].forEach((el) => {
      el.classList.remove("positive", "negative");
    });

    if (metrics.optionCashflow > 0) els.netDebitCredit.classList.add("positive");
    if (metrics.optionCashflow < 0) els.netDebitCredit.classList.add("negative");
  }

  function renderChart(metrics) {
    const canvas = els.payoffChart;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const visualPrices = metrics.visualPrices;
    const points = visualPrices.map((price) => ({ price, pnl: totalPayoffAtExpiry(price) }));
    const prices = points.map((p) => p.price);
    const pnls = points.map((p) => p.pnl);

    const xMin = Math.min(...prices);
    const xMax = Math.max(...prices);

    let yMin = Math.min(...pnls, 0);
    let yMax = Math.max(...pnls, 0);

    const yAbs = Math.max(Math.abs(yMin), Math.abs(yMax), 1);
    yMin = -yAbs * 1.18;
    yMax = yAbs * 1.18;

    const pad = { left: 74, right: 36, top: 46, bottom: 62 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const xScale = (x) => pad.left + ((x - xMin) / (xMax - xMin)) * chartW;
    const yScale = (y) => pad.top + (1 - ((y - yMin) / (yMax - yMin))) * chartH;

    const zeroY = yScale(0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    drawChartGrid(ctx, width, height, pad, xMin, xMax, yMin, yMax, xScale, yScale);
    drawPnLAreas(ctx, points, xScale, yScale, zeroY);

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(width - pad.right, zeroY);
    ctx.stroke();

    drawStrikeLines(ctx, pad, height, xMin, xMax, xScale);

    ctx.strokeStyle = "#1f3f7a";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = xScale(point.price);
      const y = yScale(point.pnl);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    drawBreakevenLines(ctx, metrics, pad, height, xMin, xMax, xScale);
    drawSpotLine(ctx, pad, height, xMin, xMax, xScale);
    drawChartLegend(ctx, width, pad);

    ctx.fillStyle = "#334155";
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.fillText("P/L at expiry", pad.left, 22);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText(`Underlying price range: $${xMin.toFixed(2)} – $${xMax.toFixed(2)}`, pad.left, height - 20);
  }

  function drawChartGrid(ctx, width, height, pad, xMin, xMax, yMin, yMax, xScale, yScale) {
    ctx.strokeStyle = "rgba(226, 232, 240, 0.9)";
    ctx.lineWidth = 1;

    const yTicks = [yMin / 1.18, (yMin / 1.18) / 2, 0, (yMax / 1.18) / 2, yMax / 1.18];

    yTicks.forEach((tick) => {
      const y = yScale(tick);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillText(signedMoney(tick), 10, y + 4);
    });

    const xTicks = buildAxisTicks(xMin, xMax, 5);
    xTicks.forEach((tick) => {
      const x = xScale(tick);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillText(`$${tick.toFixed(0)}`, x - 12, height - pad.bottom + 20);
    });

    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.lineTo(width - pad.right, height - pad.bottom);
    ctx.stroke();
  }

  function buildAxisTicks(min, max, count) {
    const ticks = [];
    const step = (max - min) / Math.max(1, count - 1);
    for (let i = 0; i < count; i += 1) {
      ticks.push(min + step * i);
    }
    return ticks;
  }

  function drawStrikeLines(ctx, pad, height, xMin, xMax, xScale) {
    const strikes = Array.from(new Set(getAllStrikes().map((x) => round2(x))));

    ctx.save();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.32)";
    ctx.fillStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.font = "11px Inter, system-ui, sans-serif";

    strikes.forEach((strike) => {
      if (strike < xMin || strike > xMax) return;

      const x = xScale(strike);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillText(`K $${strike.toFixed(2)}`, x + 4, height - pad.bottom - 8);
      ctx.setLineDash([2, 6]);
    });

    ctx.restore();
  }

  function drawBreakevenLines(ctx, metrics, pad, height, xMin, xMax, xScale) {
    ctx.save();
    ctx.strokeStyle = "#b42318";
    ctx.fillStyle = "#b42318";
    ctx.lineWidth = 1.9;
    ctx.setLineDash([8, 5]);
    ctx.font = "600 11px Inter, system-ui, sans-serif";

    metrics.breakevens.forEach((be, index) => {
      if (be < xMin || be > xMax) return;

      const x = xScale(be);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      const labelY = pad.top + 18 + index * 16;
      ctx.fillText(`BE $${be.toFixed(2)}`, x + 6, labelY);
      ctx.setLineDash([8, 5]);
    });

    ctx.restore();
  }

  function drawSpotLine(ctx, pad, height, xMin, xMax, xScale) {
    const spot = getUnderlying();
    if (spot < xMin || spot > xMax) return;

    ctx.save();
    ctx.strokeStyle = "#c9a227";
    ctx.fillStyle = "#8a6b00";
    ctx.lineWidth = 2.1;
    ctx.setLineDash([6, 6]);

    const x = xScale(spot);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText(`Spot $${spot.toFixed(2)}`, x + 6, pad.top + 34);

    ctx.restore();
  }

  function drawChartLegend(ctx, width, pad) {
    const items = [
      { label: "Profit zone", color: "rgba(21, 128, 61, 0.28)", stroke: "#15803d" },
      { label: "Loss zone", color: "rgba(180, 35, 24, 0.25)", stroke: "#b42318" },
      { label: "Spot", color: "#c9a227", stroke: "#c9a227" },
      { label: "Breakeven", color: "#b42318", stroke: "#b42318" }
    ];

    let x = width - pad.right - 330;
    const y = 18;

    ctx.font = "11px Inter, system-ui, sans-serif";
    items.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.strokeStyle = item.stroke;
      ctx.lineWidth = 1;
      ctx.fillRect(x, y - 9, 10, 10);
      ctx.strokeRect(x, y - 9, 10, 10);
      ctx.fillStyle = "#475569";
      ctx.fillText(item.label, x + 15, y);
      x += ctx.measureText(item.label).width + 42;
    });
  }

  function drawPnLAreas(ctx, points, xScale, yScale, zeroY) {
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];

      const segment = splitSegmentAtZero(a, b);
      segment.forEach(([p1, p2]) => {
        const avg = (p1.pnl + p2.pnl) / 2;
        ctx.fillStyle = avg >= 0 ? "rgba(21, 128, 61, 0.18)" : "rgba(180, 35, 24, 0.17)";

        ctx.beginPath();
        ctx.moveTo(xScale(p1.price), zeroY);
        ctx.lineTo(xScale(p1.price), yScale(p1.pnl));
        ctx.lineTo(xScale(p2.price), yScale(p2.pnl));
        ctx.lineTo(xScale(p2.price), zeroY);
        ctx.closePath();
        ctx.fill();
      });
    }
  }

  function splitSegmentAtZero(a, b) {
    if ((a.pnl >= 0 && b.pnl >= 0) || (a.pnl <= 0 && b.pnl <= 0)) {
      return [[a, b]];
    }

    const ratio = Math.abs(a.pnl) / (Math.abs(a.pnl) + Math.abs(b.pnl));
    const zeroPrice = a.price + (b.price - a.price) * ratio;
    const z = { price: zeroPrice, pnl: 0 };
    return [[a, z], [z, b]];
  }

  function renderScenarioTable(metrics) {
    if (!els.scenarioTableBody) return;

    const spot = getUnderlying();
    const scenarios = [
      spot * 0.80,
      spot * 0.90,
      spot * 0.95,
      spot,
      spot * 1.05,
      spot * 1.10,
      spot * 1.20
    ].map(round2);

    const riskBase = metrics.maxLoss === -Infinity
      ? Math.abs(Math.min(...metrics.calculationPoints.map((p) => p.pnl)))
      : Math.abs(metrics.maxLoss);

    els.scenarioTableBody.innerHTML = scenarios.map((price) => {
      const pnl = totalPayoffAtExpiry(price);
      const returnOnRisk = riskBase > 0 && Number.isFinite(riskBase) ? (pnl / riskBase) * 100 : NaN;
      const cls = pnl > 0 ? "positive" : pnl < 0 ? "negative" : "";

      return `
        <tr>
          <td>$${price.toFixed(2)}</td>
          <td class="${cls}">${signedMoney(pnl)}</td>
          <td class="${cls}">${pct(returnOnRisk)}</td>
        </tr>
      `;
    }).join("");
  }


  function hasShortAmericanStyleRisk() {
    return legs.some((leg) => {
      const normalized = normalizeLeg(leg);
      return normalized.side === "short" && (normalized.type === "call" || normalized.type === "put");
    });
  }

  function renderDiagnostics(metrics) {
    const strategy = els.strategySelect.value;
    const info = strategyDescriptions[strategy] || strategyDescriptions["custom-multileg"];
    const profile = getStrategyDiagnosticProfile(strategy);

    els.strategyDiagnostics.innerHTML = `
      <p><strong>${info.label}</strong> is a <strong>${info.structure}</strong> with a <strong>${info.bias}</strong> profile.</p>
      <p><strong>When it makes sense:</strong> ${profile.whenItMakesSense}</p>
      <p><strong>Best market context:</strong> ${profile.marketContext}</p>
      <p><strong>Volatility preference:</strong> ${profile.volatilityContext}</p>
      <p><strong>Main risk:</strong> ${profile.mainRisk}</p>
      <p><strong>Assignment / exercise risk:</strong> ${profile.assignmentRisk}</p>
      <p><strong>Position management note:</strong> ${profile.managementNote}</p>
      <p><strong>What to monitor before expiry:</strong> ${profile.monitoringChecklist}</p>
    `;
  }

  function getStrategyDiagnosticProfile(strategy) {
    const hasShortRisk = hasShortAmericanStyleRisk();

    const defaultProfile = {
      whenItMakesSense:
        "Use this structure when the payoff profile matches your directional view, risk tolerance and capital availability.",
      marketContext:
        "Depends on the selected legs. Review the payoff chart and accounting lens before treating this as a complete strategy.",
      volatilityContext:
        "Volatility impact depends on whether the structure is net long or net short premium.",
      mainRisk:
        "The main risk is that the underlying moves into the loss zone shown in the payoff chart.",
      assignmentRisk:
        hasShortRisk
          ? "Short option legs can create assignment risk before expiration for American-style equity options."
          : "No short option leg is present, so assignment risk is not the central issue.",
      managementNote:
        "This position does not need to be held until expiration. Closing early may make sense if the risk/reward has changed.",
      monitoringChecklist:
        "Monitor price relative to spot, strikes, breakeven, expiration date, liquidity and event risk."
    };

    const profiles = {
      "long-call": {
        whenItMakesSense:
          "Useful when you expect a meaningful upside move and want defined downside risk instead of buying shares outright.",
        marketContext:
          "Works best when the underlying can move above the strike plus premium before expiration.",
        volatilityContext:
          "Generally prefers lower implied volatility at entry, because expensive calls require a larger move to become profitable.",
        mainRisk:
          "The option can expire worthless if the underlying stays below the strike or does not move enough to overcome the premium paid.",
        assignmentRisk:
          "There is no assignment risk for a long call. You own a right, not an obligation.",
        managementNote:
          "Long calls often should not be passively held into expiration if the thesis plays out early. Selling the option before expiry can lock in remaining time value.",
        monitoringChecklist:
          "Monitor distance to breakeven, time decay, implied volatility changes and whether the upside thesis remains intact."
      },

      "long-put": {
        whenItMakesSense:
          "Useful when you expect downside movement or want defined-risk bearish exposure.",
        marketContext:
          "Works best when the underlying falls below the strike minus premium before expiration.",
        volatilityContext:
          "Generally prefers lower implied volatility at entry. Expensive puts require a larger decline to justify the debit.",
        mainRisk:
          "The put can expire worthless if the underlying remains above the strike or does not fall enough to overcome the premium.",
        assignmentRisk:
          "There is no assignment risk for a long put. You own a right, not an obligation.",
        managementNote:
          "If the put appreciates sharply before expiration, selling it early can preserve time value and avoid a reversal.",
        monitoringChecklist:
          "Monitor distance to breakeven, downside momentum, time decay and volatility changes."
      },

      "covered-call": {
        whenItMakesSense:
          "Useful when you own shares and are willing to sell them at the selected strike while collecting premium income.",
        marketContext:
          "Best in neutral to moderately bullish markets, especially when the strike represents an acceptable exit price.",
        volatilityContext:
          "Usually benefits from moderate to high implied volatility, because higher call premiums improve income and downside cushion.",
        mainRisk:
          "The stock still carries downside risk. The premium only cushions part of the decline. Upside is capped above the call strike.",
        assignmentRisk:
          "Assignment is possible if the call moves in the money, especially near ex-dividend dates or close to expiration.",
        managementNote:
          "If the stock approaches or exceeds the strike, you may let assignment occur, roll the call, or buy it back to keep the shares. The correct choice depends on whether the strike still represents a desired exit.",
        monitoringChecklist:
          "Monitor stock price versus strike, ex-dividend dates, call extrinsic value, breakeven and whether you still want to own the shares."
      },

      "cash-secured-put": {
        whenItMakesSense:
          "Useful when you are willing to buy the underlying at the strike and want to be paid while waiting.",
        marketContext:
          "Best when the strike represents a rational entry price based on valuation, support or portfolio plan.",
        volatilityContext:
          "Generally benefits from higher implied volatility, because put premiums become richer.",
        mainRisk:
          "If the underlying falls sharply, assignment can leave you owning shares above the new market price.",
        assignmentRisk:
          "Assignment is possible if the put moves in the money. That is not automatically a failure if you wanted to own the shares at the effective entry price.",
        managementNote:
          "If the put loses most of its value before expiration, buying it back early can free cash for a new cycle. If it moves deeply in the money, decide whether to accept assignment, roll, or close.",
        monitoringChecklist:
          "Monitor strike versus fair value, assignment cash required, breakeven, downside trend and whether your ownership thesis remains valid."
      },

      "protective-put": {
        whenItMakesSense:
          "Useful when you want to keep upside exposure to shares while defining a downside floor.",
        marketContext:
          "Best when downside protection is needed around uncertainty, event risk or portfolio drawdown concerns.",
        volatilityContext:
          "Preferably bought before volatility becomes extremely expensive. Buying protection after panic begins is usually costly.",
        mainRisk:
          "The premium paid reduces total return and raises the breakeven. Protection can be useful but expensive.",
        assignmentRisk:
          "There is no assignment risk from the long put. You own the right to sell shares at the strike.",
        managementNote:
          "If the risk event passes or the put gains substantial value, closing or rolling the protection may be better than holding it to expiration.",
        monitoringChecklist:
          "Monitor protected floor, remaining time value, cost of protection, underlying trend and whether the hedge is still needed."
      },

      "bull-call-spread": {
        whenItMakesSense:
          "Useful when you expect moderate upside and want a lower-cost bullish structure than a long call.",
        marketContext:
          "Best when you expect price to move toward or above the short call strike, but not necessarily explode far beyond it.",
        volatilityContext:
          "Less sensitive to volatility than a single long call because the short call offsets part of the debit.",
        mainRisk:
          "Maximum loss is the net debit paid if the underlying fails to move upward enough.",
        assignmentRisk:
          "The short call can create assignment risk if it becomes in the money, though the long call helps define the structure.",
        managementNote:
          "This spread does not need to be held until expiration. If it reaches a large portion of max profit early, closing can reduce reversal risk and free capital.",
        monitoringChecklist:
          "Monitor price versus both strikes, percentage of max profit captured, remaining time and liquidity."
      },

      "bear-put-spread": {
        whenItMakesSense:
          "Useful when you expect moderate downside and want a lower-cost bearish structure than a long put.",
        marketContext:
          "Best when you expect price to move toward or below the short put strike, but not necessarily collapse far beyond it.",
        volatilityContext:
          "Less sensitive to volatility than a single long put because the short put offsets part of the debit.",
        mainRisk:
          "Maximum loss is the net debit paid if the underlying fails to move downward enough.",
        assignmentRisk:
          "The short put can create assignment risk if it becomes in the money, though the long put helps define the structure.",
        managementNote:
          "If the spread approaches a large portion of max profit before expiry, closing early may avoid rebound risk.",
        monitoringChecklist:
          "Monitor price versus both put strikes, downside momentum, remaining time, percentage of max profit captured and liquidity."
      },

      "bull-put-credit-spread": {
        whenItMakesSense:
          "Useful when you expect the underlying to stay above the short put strike and want defined-risk premium income.",
        marketContext:
          "Best in neutral to bullish markets where the short put strike sits below a meaningful support or fair-value area.",
        volatilityContext:
          "Usually benefits from higher implied volatility at entry, provided the premium compensates for the risk.",
        mainRisk:
          "Losses occur if the underlying falls through the short put and toward the long put.",
        assignmentRisk:
          "The short put can be assigned if in the money. The long put defines risk but does not eliminate assignment mechanics.",
        managementNote:
          "Credit spreads are often closed early after capturing a large portion of the credit. Waiting for the last pennies can increase gamma and assignment risk.",
        monitoringChecklist:
          "Monitor distance to short strike, credit captured, remaining days, volatility contraction and whether support has failed."
      },

      "bear-call-credit-spread": {
        whenItMakesSense:
          "Useful when you expect the underlying to stay below the short call strike and want defined-risk premium income.",
        marketContext:
          "Best in neutral to bearish markets where the short call strike sits above resistance or above an acceptable risk zone.",
        volatilityContext:
          "Usually benefits from higher implied volatility at entry, followed by volatility contraction or stable price action.",
        mainRisk:
          "Losses occur if the underlying rises through the short call and toward the long call.",
        assignmentRisk:
          "The short call can be assigned if in the money. The long call defines risk but does not eliminate assignment mechanics.",
        managementNote:
          "If most of the credit has already been captured, closing early can reduce upside breakout and expiration-week gamma risk.",
        monitoringChecklist:
          "Monitor distance to short call, resistance levels, credit captured, implied volatility and time to expiry."
      },

      "long-straddle": {
        whenItMakesSense:
          "Useful when you expect a large move but do not know the direction.",
        marketContext:
          "Best before a major move if options are not already overpriced relative to the expected move.",
        volatilityContext:
          "Net long volatility. It benefits from rising implied volatility before exit, but suffers if volatility collapses after the event.",
        mainRisk:
          "The underlying may not move enough to overcome the combined call and put premiums.",
        assignmentRisk:
          "No assignment risk from long options. You own rights, not obligations.",
        managementNote:
          "Long straddles are often sold before or shortly after the event. Holding after volatility collapses can destroy value even if price moves.",
        monitoringChecklist:
          "Monitor expected move, implied volatility, event timing, total debit, breakevens and remaining time value."
      },

      "long-strangle": {
        whenItMakesSense:
          "Useful when you expect a large move but want a cheaper structure than a straddle.",
        marketContext:
          "Best when the underlying can move decisively beyond either outer strike.",
        volatilityContext:
          "Net long volatility. Benefits from volatility expansion but can suffer badly from volatility crush.",
        mainRisk:
          "Both options can expire worthless if the move is not large enough.",
        assignmentRisk:
          "No assignment risk from long options.",
        managementNote:
          "If either side gains sharply, selling or adjusting early can preserve profits before time decay accelerates.",
        monitoringChecklist:
          "Monitor distance to both breakevens, volatility, event timing and whether the move is large enough to justify the debit."
      },

      "iron-condor": {
        whenItMakesSense:
          "Useful when you expect the underlying to stay inside a defined range and want defined-risk premium income.",
        marketContext:
          "Best in range-bound, low-trend environments where both short strikes sit outside expected movement.",
        volatilityContext:
          "Usually benefits from higher implied volatility at entry and later volatility contraction.",
        mainRisk:
          "A strong move outside the range can push the structure toward maximum loss on one side.",
        assignmentRisk:
          "Short put and short call legs can create assignment risk if they become in the money, especially near expiration.",
        managementNote:
          "Iron condors are often actively managed. If a large percentage of the credit has been captured, closing early can be preferable to facing final-week gamma risk.",
        monitoringChecklist:
          "Monitor price relative to short strikes, credit captured, implied volatility, days to expiry and whether one side is being challenged."
      },

      "wheel-entry": {
        whenItMakesSense:
          "Useful when you want to enter a wheel cycle by selling a put at a price where you are willing to own the underlying.",
        marketContext:
          "Best when the strike is aligned with valuation, support or a planned accumulation zone.",
        volatilityContext:
          "Benefits from higher implied volatility, because put premiums improve effective entry price.",
        mainRisk:
          "You may be assigned shares during a decline, and the stock can continue falling after assignment.",
        assignmentRisk:
          "Assignment is part of the design. The question is whether the effective entry price is acceptable.",
        managementNote:
          "If the put decays substantially, buying it back early can reset the wheel. If challenged, choose between assignment, rolling or closing.",
        monitoringChecklist:
          "Monitor effective entry, assignment cash, fair value, downside trend and whether the asset still belongs in the portfolio."
      },

      "wheel-covered-call": {
        whenItMakesSense:
          "Useful after assignment when you own shares and want to generate income while defining a potential exit.",
        marketContext:
          "Best when the selected call strike is a rational exit level, not just the strike with the fattest premium.",
        volatilityContext:
          "Benefits from moderate to high call premiums, but high volatility often means higher assignment and movement risk.",
        mainRisk:
          "The stock can still fall. The call premium cushions downside only partially, while upside is capped at the strike.",
        assignmentRisk:
          "Assignment is possible if the call goes in the money. That may be desirable if the strike is a planned exit.",
        managementNote:
          "If the call becomes challenged, decide whether to let shares be called away, roll the call, or close it to keep the shares.",
        monitoringChecklist:
          "Monitor effective exit price, stock cost basis, call extrinsic value, dividend dates and whether you still want the shares."
      },

      "wheel-full-cycle": {
        whenItMakesSense:
          "Useful to understand the combined logic of assignment cost basis plus covered-call exit.",
        marketContext:
          "Best when the underlying is suitable for repeated ownership, income generation and disciplined exit planning.",
        volatilityContext:
          "Benefits from premium-rich environments, but higher volatility also increases assignment and drawdown risk.",
        mainRisk:
          "The wheel can become a long stock position during a downtrend. Premium income does not eliminate stock risk.",
        assignmentRisk:
          "Assignment and call-away events are part of the cycle, not exceptions.",
        managementNote:
          "Wheel positions are often actively managed. You may close puts early, accept assignment, roll calls, or let shares be called away depending on valuation and portfolio goals.",
        monitoringChecklist:
          "Monitor net basis, effective exit, total premium collected, downside exposure, dividend dates and whether the underlying remains high quality."
      },

      "custom-multileg": {
        whenItMakesSense:
          "Useful when you want to model a structure not covered by the preset strategies.",
        marketContext:
          "Depends entirely on the selected legs and ratios.",
        volatilityContext:
          "Depends on whether the structure is net long or net short premium.",
        mainRisk:
          "The risk may be non-obvious if the legs create hidden directional or tail exposure.",
        assignmentRisk:
          hasShortRisk
            ? "Short legs can create assignment risk. Review each short call or short put separately."
            : "No short option leg is present, so assignment risk is limited.",
        managementNote:
          "Custom structures should be reviewed leg by leg. Closing one leg without understanding the remaining exposure can transform the position into something materially different.",
        monitoringChecklist:
          "Monitor each strike, each short leg, total debit/credit, net directional exposure, liquidity and expiration risk."
      },

      "naked-short-put": {
        whenItMakesSense:
          "Useful only for modelling uncovered short-put exposure. It is not the same as a cash-secured put.",
        marketContext:
          "Works only if the underlying remains above breakeven, but adverse downside moves can create large losses.",
        volatilityContext:
          "Benefits from high implied volatility and volatility contraction, but high IV often exists because real risk is elevated.",
        mainRisk:
          "Large downside losses if the underlying falls sharply. The broker margin requirement may understate real economic exposure.",
        assignmentRisk:
          "Assignment can force stock purchase at the strike. Without reserved cash, this can create liquidity and margin stress.",
        managementNote:
          "Naked short puts require active risk control. If the trade moves against you, closing or reducing exposure early may be necessary.",
        monitoringChecklist:
          "Monitor margin usage, downside velocity, breakeven, assignment risk, event risk and whether you could actually own the shares."
      },

      "naked-short-call": {
        whenItMakesSense:
          "Useful only for modelling uncovered short-call exposure. It is not a conservative income strategy.",
        marketContext:
          "Works only if the underlying stays below breakeven. A strong upside move can create open-ended losses.",
        volatilityContext:
          "Benefits from high implied volatility and volatility contraction, but the upside tail risk remains severe.",
        mainRisk:
          "Theoretically unlimited loss if the underlying rises sharply.",
        assignmentRisk:
          "Assignment can create a short stock position or force delivery of shares you do not own.",
        managementNote:
          "Naked short calls require strict risk control. If the underlying breaks upward, closing early may be necessary before losses expand further.",
        monitoringChecklist:
          "Monitor upside breakout risk, margin usage, borrow/assignment mechanics, short strike, breakeven and event catalysts."
      }
    };

    return profiles[strategy] || defaultProfile;
  }

  function renderAccountingLens(metrics) {
    const strategy = els.strategySelect.value;

    if (strategy === "covered-call" || strategy === "wheel-covered-call") {
      const cc = getCoveredCallData();
      if (cc) return renderCoveredCallAccounting(cc, strategy);
    }

    if (strategy === "wheel-full-cycle") {
      const cc = getCoveredCallData();
      if (cc) return renderWheelFullCycleAccounting(cc);
    }

    if (strategy === "cash-secured-put" || strategy === "wheel-entry") {
      const csp = getCashSecuredPutData();
      if (csp) return renderCashSecuredPutAccounting(csp, strategy);
    }

    if (strategy === "protective-put") {
      const pp = getProtectivePutData();
      if (pp) return renderProtectivePutAccounting(pp);
    }

    if (strategy === "naked-short-put") {
      const np = getCashSecuredPutData();
      if (np) return renderNakedShortPutAccounting(np);
    }

    if (strategy === "naked-short-call") {
      return renderNakedShortCallAccounting(metrics);
    }

    if (strategy === "iron-condor") {
      const condor = getIronCondorData(metrics);
      if (condor) return renderIronCondorAccounting(condor);
    }

    if (["bull-call-spread", "bear-put-spread", "bull-put-credit-spread", "bear-call-credit-spread"].includes(strategy)) {
      const spread = getVerticalSpreadData(strategy);
      if (spread) return renderVerticalSpreadAccounting(spread, metrics, strategy);
      return renderSpreadAccounting(metrics, strategy);
    }

    renderGenericAccounting(metrics);
  }

  function renderCoveredCallAccounting(cc, strategy) {
    const title = strategy === "wheel-covered-call" ? "wheel covered-call stage" : "covered call";
    const perDollarMove = cc.shares;

    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>${title}</strong> using <strong>${cc.contracts}</strong> short call ${cc.contracts === 1 ? "contract" : "contracts"} against <strong>${cc.shares}</strong> shares.</p>
      <p>By selling the call for <strong>${perShare(cc.premium)}</strong>, you receive <strong>${cc.shares} shares × $${cc.premium.toFixed(2)} = ${money(cc.optionIncome)}</strong> upfront option income.</p>
      <p>Your stock cost basis is <strong>${perShare(cc.stockCost)}</strong>. The call strike is <strong>${perShare(cc.strike)}</strong>.</p>
      <p>For every <strong>$1</strong> increase in the underlying above your cost basis and up to the call strike, the stock leg adds <strong>${money(perDollarMove)}</strong> of profit. This upside stops at the strike because the shares may be called away.</p>
      <p>If assigned at the strike, the stock gain is <strong>($${cc.strike.toFixed(2)} − $${cc.stockCost.toFixed(2)}) × ${cc.shares} = ${money(cc.stockGainToStrike)}</strong>.</p>
      <p>Adding the call premium, maximum covered-call profit before costs and taxes is <strong>${money(cc.maxCoveredProfit)}</strong>.</p>
      <p>Your effective exit price including premium is <strong>$${cc.strike.toFixed(2)} + $${cc.premium.toFixed(2)} = ${perShare(cc.effectiveExit)}</strong>.</p>
      <p>Your breakeven is <strong>$${cc.stockCost.toFixed(2)} − $${cc.premium.toFixed(2)} = ${perShare(cc.breakeven)}</strong>. The premium creates a <strong>${perShare(cc.premiumCushion)}</strong> downside cushion.</p>
    `;
  }

  function renderCashSecuredPutAccounting(csp, strategy) {
    const title = strategy === "wheel-entry" ? "Wheel entry short put" : "cash-secured put";

    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>${title}</strong> with <strong>${csp.contracts}</strong> short put ${csp.contracts === 1 ? "contract" : "contracts"}.</p>
      <p>By selling the put for <strong>${perShare(csp.premium)}</strong>, you receive <strong>${csp.shares} shares × $${csp.premium.toFixed(2)} = ${money(csp.premiumIncome)}</strong> upfront premium.</p>
      <p>If the put expires worthless, that premium is the maximum option income from this leg.</p>
      <p>If assigned, you must buy <strong>${csp.shares}</strong> shares at the <strong>${perShare(csp.strike)}</strong> strike.</p>
      <p>Gross assignment cash required is <strong>${csp.shares} × $${csp.strike.toFixed(2)} = ${money(csp.assignmentCash)}</strong>.</p>
      <p>Because you already received <strong>${money(csp.premiumIncome)}</strong>, your effective entry price becomes <strong>$${csp.strike.toFixed(2)} − $${csp.premium.toFixed(2)} = ${perShare(csp.effectiveEntry)}</strong>.</p>
      <p>The premium creates an implicit <strong>${perShare(csp.premium)}</strong> discount versus buying directly at the strike. Below <strong>${perShare(csp.breakeven)}</strong>, the assigned stock position begins to show a net loss.</p>
    `;
  }

  function renderWheelFullCycleAccounting(cc) {
    const priorPutNote = strategyHasOnlyStandardLegs()
      ? "In this simplified preset, the stock cost basis is already treated as a net assigned cost after the prior put premium."
      : "Because custom legs are present, treat this as a modified wheel stage and review each added leg separately.";

    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>simplified Wheel full-cycle stage</strong>: assigned stock plus a covered call exit.</p>
      <p>${priorPutNote}</p>
      <p>The model assumes you hold <strong>${cc.shares}</strong> shares with a net stock cost basis of <strong>${perShare(cc.stockCost)}</strong>.</p>
      <p>You are selling <strong>${cc.contracts}</strong> covered call ${cc.contracts === 1 ? "contract" : "contracts"} at a strike of <strong>${perShare(cc.strike)}</strong> for <strong>${perShare(cc.premium)}</strong>.</p>
      <p>Call premium received now: <strong>${cc.shares} shares × $${cc.premium.toFixed(2)} = ${money(cc.optionIncome)}</strong>.</p>
      <p>If the shares are called away, the stock sale proceeds are <strong>${cc.shares} × $${cc.strike.toFixed(2)} = ${money(cc.strike * cc.shares)}</strong>.</p>
      <p>The stock gain from the current net basis to the call strike is <strong>($${cc.strike.toFixed(2)} − $${cc.stockCost.toFixed(2)}) × ${cc.shares} = ${money(cc.stockGainToStrike)}</strong>.</p>
      <p>Adding the call premium, maximum modelled profit from this wheel stage is <strong>${money(cc.maxCoveredProfit)}</strong>.</p>
      <p>Effective exit price including the call premium is <strong>$${cc.strike.toFixed(2)} + $${cc.premium.toFixed(2)} = ${perShare(cc.effectiveExit)}</strong>.</p>
      <p>Breakeven after the call premium is <strong>$${cc.stockCost.toFixed(2)} − $${cc.premium.toFixed(2)} = ${perShare(cc.breakeven)}</strong>.</p>
      <p>Operationally: the wheel is not “free income”. It is a sequence of obligations. The put stage defines entry, the stock stage carries market risk, and the covered call stage defines income plus a possible exit.</p>
    `;
  }

  function renderProtectivePutAccounting(pp) {
    const unprotectedRiskToZero = pp.stockCost * pp.shares;
    const protectedFloorValue = pp.strike * pp.shares;

    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>protective put</strong>: <strong>${pp.shares}</strong> shares protected by <strong>${pp.contracts}</strong> long put ${pp.contracts === 1 ? "contract" : "contracts"}.</p>
      <p>The put costs <strong>${pp.shares} shares × $${pp.premium.toFixed(2)} = ${money(pp.protectionCost)}</strong>.</p>
      <p>Your stock cost basis is <strong>${perShare(pp.stockCost)}</strong>, and the protective floor is the put strike at <strong>${perShare(pp.strike)}</strong>.</p>
      <p>Without protection, a fall to zero would expose approximately <strong>${money(unprotectedRiskToZero)}</strong> of stock value. With the put, the protected floor value is approximately <strong>${money(protectedFloorValue)}</strong>.</p>
      <p>Your breakeven becomes <strong>$${pp.stockCost.toFixed(2)} + $${pp.premium.toFixed(2)} = ${perShare(pp.breakeven)}</strong>, because protection has a cost.</p>
      <p>Maximum protected loss is approximately <strong>${money(pp.maxProtectedLoss)}</strong>, calculated as stock cost plus put premium minus the put strike, multiplied by protected shares.</p>
      <p>Upside remains open, but every dollar of protection premium is a hurdle the position must first recover. Insurance is useful. It is not free, despite humanity’s recurring hope that risk can be abolished with paperwork.</p>
    `;
  }

  function renderNakedShortPutAccounting(np) {
    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>naked short put</strong> with <strong>${np.contracts}</strong> short put ${np.contracts === 1 ? "contract" : "contracts"}.</p>
      <p>The premium received is <strong>${np.shares} shares × $${np.premium.toFixed(2)} = ${money(np.premiumIncome)}</strong>. This is the maximum possible profit.</p>
      <p>If assigned, the contractual purchase obligation is still <strong>${np.shares} shares × $${np.strike.toFixed(2)} = ${money(np.assignmentCash)}</strong>.</p>
      <p>The economic breakeven is <strong>${perShare(np.breakeven)}</strong>.</p>
      <p>If the underlying went to zero, the modelled loss would be approximately <strong>${money(np.maxLossToZero)}</strong>. This is finite, but large. The broker margin requirement may be much lower than the real economic exposure, which is exactly how people get surprised by things they technically agreed to.</p>
    `;
  }

  function renderNakedShortCallAccounting(metrics) {
    const shortCall = getFirstLeg((leg) => leg.type === "call" && leg.side === "short");
    if (!shortCall) return renderGenericAccounting(metrics);

    const units = getLegUnits(shortCall);
    const income = shortCall.premium * units.shares;
    const breakeven = shortCall.strike + shortCall.premium;

    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>naked short call</strong> with <strong>${units.optionContracts}</strong> short call ${units.optionContracts === 1 ? "contract" : "contracts"}.</p>
      <p>The premium received is <strong>${units.shares} shares × $${shortCall.premium.toFixed(2)} = ${money(income)}</strong>. This is the maximum possible profit.</p>
      <p>The breakeven is <strong>$${shortCall.strike.toFixed(2)} + $${shortCall.premium.toFixed(2)} = ${perShare(breakeven)}</strong>.</p>
      <p>Above breakeven, losses increase dollar-for-dollar with the underlying. Since a stock can theoretically keep rising, the model treats upside loss as <strong>unlimited</strong>.</p>
      <p>This is not a conservative income structure. It is included for modelling completeness, not because civilisation required another way to vaporise a margin account.</p>
    `;
  }

  function renderIronCondorAccounting(condor) {
    els.accountingLens.innerHTML = `
      <p>You are modelling an <strong>Iron Condor</strong> with <strong>${condor.contracts}</strong> contract ${condor.contracts === 1 ? "set" : "sets"}.</p>
      <p>The structure sells the middle put and call, then buys wings for protection: long put <strong>${perShare(condor.longPut.strike)}</strong>, short put <strong>${perShare(condor.shortPut.strike)}</strong>, short call <strong>${perShare(condor.shortCall.strike)}</strong>, long call <strong>${perShare(condor.longCall.strike)}</strong>.</p>
      <p>Net credit received: <strong>${money(condor.netCredit)}</strong>, equal to approximately <strong>${perShare(condor.netCreditPerShare)}</strong>.</p>
      <p>Maximum profit occurs if the underlying expires between the short put and short call: <strong>${perShare(condor.maxProfitRangeLow)} to ${perShare(condor.maxProfitRangeHigh)}</strong>. In that range, all short options expire worthless and the credit is retained.</p>
      <p>Lower breakeven: <strong>$${condor.shortPut.strike.toFixed(2)} − $${condor.netCreditPerShare.toFixed(2)} = ${perShare(condor.lowerBreakeven)}</strong>.</p>
      <p>Upper breakeven: <strong>$${condor.shortCall.strike.toFixed(2)} + $${condor.netCreditPerShare.toFixed(2)} = ${perShare(condor.upperBreakeven)}</strong>.</p>
      <p>Put-side wing width: <strong>${perShare(condor.putWidth)}</strong>. Call-side wing width: <strong>${perShare(condor.callWidth)}</strong>. The widest wing determines the conservative maximum risk estimate.</p>
      <p>Maximum modelled loss is approximately <strong>${money(condor.maxLoss)}</strong>, calculated as widest wing value minus credit received.</p>
      <p>Operationally: this is a range strategy. You are paid upfront because you accept the risk that price escapes the expected range. The long wings turn that risk into a defined-risk structure instead of a naked obligation.</p>
    `;
  }

  function renderVerticalSpreadAccounting(spread, metrics, strategy) {
    const info = strategyDescriptions[strategy];
    const isDebit = spread.netCashflow < 0;
    const isCredit = spread.netCashflow > 0;
    const maxProfit = metrics.maxProfit === Infinity ? "Unlimited" : money(metrics.maxProfit);
    const maxLoss = metrics.maxLoss === -Infinity ? "Unlimited" : money(Math.abs(metrics.maxLoss));
    const breakevenText = metrics.breakevens.length
      ? metrics.breakevens.map((x) => `$${x.toFixed(2)}`).join(" / ")
      : "not detected";

    let formula = "";
    let interpretation = "";

    if (strategy === "bull-call-spread") {
      formula = `
        <p>Net debit per share is long call premium minus short call premium. Maximum loss is the debit paid. Maximum profit is spread width minus net debit.</p>
        <p>Breakeven is lower strike plus net debit per share.</p>
      `;
      interpretation = "This structure profits from a move upward, but the upside is capped at the short call strike.";
    }

    if (strategy === "bear-put-spread") {
      formula = `
        <p>Net debit per share is long put premium minus short put premium. Maximum loss is the debit paid. Maximum profit is spread width minus net debit.</p>
        <p>Breakeven is upper put strike minus net debit per share.</p>
      `;
      interpretation = "This structure profits from a move downward, but the downside profit is capped at the short put strike.";
    }

    if (strategy === "bull-put-credit-spread") {
      formula = `
        <p>Net credit is received upfront. Maximum profit is the credit retained. Maximum loss is spread width minus credit received.</p>
        <p>The structure usually wins if the underlying stays above the short put strike through expiration.</p>
      `;
      interpretation = "This is an income structure with defined downside risk. The credit is compensation for accepting a limited obligation.";
    }

    if (strategy === "bear-call-credit-spread") {
      formula = `
        <p>Net credit is received upfront. Maximum profit is the credit retained. Maximum loss is spread width minus credit received.</p>
        <p>The structure usually wins if the underlying stays below the short call strike through expiration.</p>
      `;
      interpretation = "This is an income structure with defined upside risk. The long call caps the danger that would otherwise be naked.";
    }

    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>${info.label}</strong> with <strong>${spread.contracts}</strong> contract ${spread.contracts === 1 ? "set" : "sets"}.</p>
      <p>Lower strike: <strong>${perShare(spread.lowerStrike)}</strong>. Upper strike: <strong>${perShare(spread.upperStrike)}</strong>. Spread width: <strong>${perShare(spread.width)}</strong>.</p>
      <p>Opening option cashflow: <strong>${signedMoney(spread.netCashflow)}</strong>. This is a <strong>${isCredit ? "credit" : isDebit ? "debit" : "near-flat"}</strong> spread.</p>
      <p>Spread width value: <strong>$${spread.width.toFixed(2)} × ${spread.shares} shares = ${money(spread.widthValue)}</strong>.</p>
      ${formula}
      <p>Maximum profit: <strong>${maxProfit}</strong>. Maximum loss: <strong>${maxLoss}</strong>. Breakeven: <strong>${breakevenText}</strong>.</p>
      <p>Operationally: ${interpretation}</p>
    `;
  }

  function renderSpreadAccounting(metrics, strategy) {
    const info = strategyDescriptions[strategy];
    const net = metrics.optionCashflow;
    const isCredit = net > 0;
    const maxProfit = metrics.maxProfit === Infinity ? "Unlimited" : money(metrics.maxProfit);
    const maxLoss = metrics.maxLoss === -Infinity ? "Unlimited" : money(Math.abs(metrics.maxLoss));
    const breakevenText = metrics.breakevens.length
      ? metrics.breakevens.map((x) => `$${x.toFixed(2)}`).join(" / ")
      : "not detected";

    els.accountingLens.innerHTML = `
      <p>You are modelling a <strong>${info.label}</strong>, a <strong>${info.structure}</strong>.</p>
      <p>The opening option cashflow is <strong>${signedMoney(net)}</strong>, so this is a <strong>${isCredit ? "credit" : "debit"}</strong> structure.</p>
      <p>Maximum profit is <strong>${maxProfit}</strong>. Maximum loss is <strong>${maxLoss}</strong>.</p>
      <p>Breakeven: <strong>${breakevenText}</strong>.</p>
      <p>${isCredit ? "The credit is received upfront, but it is not free income. It is compensation for accepting a defined obligation until expiration." : "The debit is paid upfront. The strategy must move far enough in the intended direction to recover that cost before producing profit."}</p>
      <p>Operationally, this structure is cleaner than an outright naked option because the opposing long leg defines the risk boundary.</p>
    `;
  }

  function renderGenericAccounting(metrics) {
    const net = metrics.optionCashflow;
    const maxProfit = metrics.maxProfit === Infinity ? "Unlimited" : money(metrics.maxProfit);
    const maxLoss = metrics.maxLoss === -Infinity ? "Unlimited" : money(Math.abs(metrics.maxLoss));
    const breakevenText = metrics.breakevens.length
      ? metrics.breakevens.map((x) => `$${x.toFixed(2)}`).join(" / ")
      : "not detected";

    els.accountingLens.innerHTML = `
      <p>Opening option cashflow: <strong>${signedMoney(net)}</strong>.</p>
      <p>Maximum modelled profit: <strong>${maxProfit}</strong>.</p>
      <p>Maximum modelled loss: <strong>${maxLoss}</strong>.</p>
      <p>Breakeven: <strong>${breakevenText}</strong>.</p>
      <p>This custom or volatility-oriented structure is calculated leg by leg at expiration. The model does not evaluate liquidity, execution quality, margin requirement or early assignment path.</p>
    `;
  }

  function addLeg() {
    legs.push(createLeg({
      side: "long",
      type: "call",
      strike: round2(getUnderlying()),
      premium: Math.max(0.25, round2(getUnderlying() * 0.02)),
      custom: true,
      qty: 1
    }));

    renderLegRows();
    updateAll(false);
  }

  function updateAll(shouldRenderRows = false) {
    if (!legs.length) {
      legs = defaultPresets(els.strategySelect.value || "long-call", getUnderlying()).map(normalizeLeg);
      shouldRenderRows = true;
    }

    legs = legs.map(normalizeLeg);

    if (shouldRenderRows) {
      renderLegRows();
    }

    const metrics = calculateMetrics();
    updateMetricCardLabelsAndValues(metrics);
    renderChart(metrics);
    renderScenarioTable(metrics);
    renderDiagnostics(metrics);
    renderAccountingLens(metrics);
  }

  function bindGlobalEvents() {
    els.strategySelect.addEventListener("change", () => {
      setPreset(els.strategySelect.value);
    });

    els.underlyingPrice.addEventListener("input", () => {
      updateAll(false);
    });

    els.contractCount.addEventListener("input", () => {
      updateAll(true);
    });

    els.daysToExpiration.addEventListener("input", () => {
      updateAll(false);
    });

    els.addLegBtn.addEventListener("click", addLeg);
  }

  function init() {
    bindGlobalEvents();
    setPreset(els.strategySelect.value || "long-call");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
