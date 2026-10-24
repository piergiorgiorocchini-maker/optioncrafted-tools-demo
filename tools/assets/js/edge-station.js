/* OptionsCrafted™ – Edge Station™ v5.0 Free Hand DOM Builder
   File: tools/edge-station/edge-station.js
   © 2026 OptionsCrafted. All rights reserved.

   Purpose:
   - Preset scenarios remain available for hedge/repair logic.
   - Free Hand Hedge is a separate manual payoff snapshot mode.
   - Free Hand Hedge uses two independent custom-leg builders: Current Position and Hedge Position.
   - Free Hand Hedge accepts stock/spot, futures, calls, and puts.
   - In Free Hand Hedge, the DOM is intentionally simple: Underlying Price and Combined P/L only.
   - No presets, recommendation engine, utility score, or decision tree are used in Free Hand Hedge.
*/

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    scenarioSelect: $("scenarioSelect"),
    currentUnderlyingPrice: $("currentUnderlyingPrice"),
    daysToExpiration: $("daysToExpiration"),
    contracts: $("contracts"),
    optionMultiplier: $("optionMultiplier"),

    entryUnderlyingPrice: $("entryUnderlyingPrice"),
    shortOptionStrike: $("shortOptionStrike"),
    premiumReceived: $("premiumReceived"),
    averageStockCost: $("averageStockCost"),
    sharesOwned: $("sharesOwned"),
    premiumPaid: $("premiumPaid"),

    hedgePreset: $("hedgePreset"),
    protectionStrike: $("protectionStrike"),
    hedgeCost: $("hedgeCost"),
    primaryObjective: $("primaryObjective"),
    rollTargetStrike: $("rollTargetStrike"),
    newCallPremium: $("newCallPremium"),
    newExpirationDays: $("newExpirationDays"),

    positionInputs: $("positionInputs"),
    currentPositionDescription: $("currentPositionDescription"),
    recommendedActionTitle: $("recommendedActionTitle"),
    recommendedActionText: $("recommendedActionText"),
    recommendedActionBadge: $("recommendedActionBadge"),
    recommendedLegsBody: $("recommendedLegsBody"),

    beforeStructure: $("beforeStructure"),
    afterStructure: $("afterStructure"),
    riskChangeText: $("riskChangeText"),

    capitalPremiumReceived: $("capitalPremiumReceived"),
    capitalHedgeCost: $("capitalHedgeCost"),
    capitalNetPremium: $("capitalNetPremium"),
    capitalFundsRequired: $("capitalFundsRequired"),

    metricOriginalBreakeven: $("metricOriginalBreakeven"),
    metricNewBreakeven: $("metricNewBreakeven"),
    metricMaxLoss: $("metricMaxLoss"),
    metricRiskProfile: $("metricRiskProfile"),

    netTradeCalculation: $("netTradeCalculation"),
    edgePayoffChart: $("edgePayoffChart"),
    payoffTapeScenario: $("payoffTapeScenario"),
    payoffTapeGrid: $("payoffTapeGrid"),

    currentPositionSummary: $("currentPositionSummary"),
    summaryContracts: $("summaryContracts"),
    summaryStrike: $("summaryStrike"),
    summaryPremiumPerContract: $("summaryPremiumPerContract"),
    summaryPremiumFormula: $("summaryPremiumFormula"),

    hedgePresetSummary: $("hedgePresetSummary"),
    hedgePresetName: $("hedgePresetName"),
    hedgePresetSize: $("hedgePresetSize"),
    hedgePresetCostFormula: $("hedgePresetCostFormula"),
    hedgeCoverageFormula: $("hedgeCoverageFormula"),

    coveredCallDecisionSection: $("coveredCallDecisionSection"),
    coveredCallDecisionBody: $("coveredCallDecisionBody"),
    coveredCallDecisionPathSection: $("coveredCallDecisionPathSection"),
    coveredCallDecisionPathBody: $("coveredCallDecisionPathBody"),

    manualLegsBody: $("manualLegsBody"),
    addManualLegButton: $("addManualLegButton"),

    operatingRuleTitle: $("operatingRuleTitle"),
    operatingRuleText: $("operatingRuleText"),
    tradeOffText: $("tradeOffText"),

    freeHandHedgeSection: $("freeHandHedgeSection"),
    freeHandCurrentLegsBody: $("freeHandCurrentLegsBody"),
    freeHandHedgeLegsBody: $("freeHandHedgeLegsBody"),
    addFreeHandCurrentLegButton: $("addFreeHandCurrentLegButton"),
    addFreeHandHedgeLegButton: $("addFreeHandHedgeLegButton"),
    freeHandExpiryWarning: $("freeHandExpiryWarning"),
    freeHandExpiryWarningText: $("freeHandExpiryWarningText"),
  };

  const SCENARIOS = {
    "short-put-pressure": {
      label: "Naked Put Repair",
      positionText: "You sold a naked put and the underlying is approaching the sold strike. The repair should convert open downside into controlled downside or neutralize it at the strike.",
    },
    "short-call-pressure": {
      label: "Naked Call Repair",
      positionText: "You sold a naked call and the underlying is approaching the sold strike. The repair should cap upside risk before the position becomes structurally dangerous.",
    },
    "long-stock-protection": {
      label: "Long Stock Protection",
      positionText: "Use this when you want to keep the shares but temporarily limit downside risk, for example before earnings, after a strong rally, during macro uncertainty, or when the chart has entered a danger zone. The protection cost is the price of staying invested without leaving the downside fully open.",
    },
    "covered-call-adjustment": {
      label: "Covered Call Adjustment",
      positionText: "Use this when your short call is threatened and you must decide whether to accept assignment, buy the call back, or later roll it. This is not about undefined risk; it is about ownership, capped upside, taxes, opportunity cost, and not paying too much just to avoid being assigned.",
    },
    "free-hand-hedge": {
      label: "Free Hand Hedge",
      positionText: "Build the current position and the hedge position manually. The DOM shows only the combined payoff, price by price.",
    },
  };

  let manualLegs = [];
  let freeHandCurrentLegs = [];
  let freeHandHedgeLegs = [];

  const SCENARIO_PRESETS = {
    "short-put-pressure": {
      currentUnderlyingPrice: 178.30,
      daysToExpiration: 30,
      contracts: 1,
      entryUnderlyingPrice: 190.00,
      shortOptionStrike: 178.00,
      premiumReceived: 3.00,
      averageStockCost: 190.00,
      sharesOwned: 100,
      premiumPaid: 0.00,
      hedgePreset: "protective-put-at-sold-strike",
      protectionStrike: 178.00,
      hedgeCost: 3.10,
      primaryObjective: "compare-objectively",
      rollTargetStrike: 185.00,
      newCallPremium: 0.00,
      newExpirationDays: 45,
    },
    "short-call-pressure": {
      currentUnderlyingPrice: 190.00,
      daysToExpiration: 30,
      contracts: 1,
      entryUnderlyingPrice: 178.00,
      shortOptionStrike: 190.00,
      premiumReceived: 3.00,
      averageStockCost: 178.00,
      sharesOwned: 100,
      premiumPaid: 0.00,
      hedgePreset: "protective-call-at-sold-strike",
      protectionStrike: 190.00,
      hedgeCost: 3.10,
      primaryObjective: "compare-objectively",
      rollTargetStrike: 195.00,
      newCallPremium: 0.00,
      newExpirationDays: 45,
    },
    "long-stock-protection": {
      currentUnderlyingPrice: 190.00,
      daysToExpiration: 30,
      contracts: 1,
      entryUnderlyingPrice: 160.00,
      shortOptionStrike: 0.00,
      premiumReceived: 0.00,
      averageStockCost: 160.00,
      sharesOwned: 100,
      premiumPaid: 0.00,
      hedgePreset: "protective-put-for-long-stock",
      protectionStrike: 190.00,
      hedgeCost: 3.00,
      primaryObjective: "compare-objectively",
      rollTargetStrike: 200.00,
      newCallPremium: 0.00,
      newExpirationDays: 45,
    },
    "covered-call-adjustment": {
      currentUnderlyingPrice: 190.00,
      daysToExpiration: 30,
      contracts: 1,
      entryUnderlyingPrice: 170.00,
      shortOptionStrike: 185.00,
      premiumReceived: 3.00,
      averageStockCost: 170.00,
      sharesOwned: 100,
      premiumPaid: 0.00,
      hedgePreset: "covered-call-decision-check",
      protectionStrike: 185.00,
      hedgeCost: 5.50,
      primaryObjective: "maximize-realized-profit",
      rollTargetStrike: 195.00,
      newCallPremium: 3.00,
      newExpirationDays: 45,
    },
  };

  const HEDGE_PRESET_OPTIONS = {
    "short-put-pressure": [
      { value: "protective-put-at-sold-strike", label: "Protective Put at Sold Strike" },
    ],
    "short-call-pressure": [
      { value: "protective-call-at-sold-strike", label: "Protective Call at Sold Strike" },
    ],
    "long-stock-protection": [
      { value: "protective-put-for-long-stock", label: "ATM Protective Put" },
    ],
    "covered-call-adjustment": [
      { value: "covered-call-decision-check", label: "Covered Call Decision Check" },
    ],
    "free-hand-hedge": [
      { value: "free-hand-manual", label: "Manual payoff snapshot" },
    ],
  };

  function n(input, fallback = 0) {
    const value = Number(input && input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function money(value) {
    if (!Number.isFinite(value)) return "—";
    const sign = value < 0 ? "-" : "";
    return `${sign}$${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function price(value) {
    if (!Number.isFinite(value)) return "—";
    return `$${value.toFixed(2)}`;
  }

  function pct(value) {
    if (!Number.isFinite(value)) return "—";
    return `${value.toFixed(1)}%`;
  }

  function setFieldVisibility(inputEl, visible) {
    if (!inputEl) return;
    const field = inputEl.closest(".edge-field");
    if (!field) return;
    field.classList.toggle("edge-hide", !visible);
  }

  function setFieldOrder(inputEl, order) {
    if (!inputEl) return;
    const field = inputEl.closest(".edge-field");
    if (!field) return;
    field.style.order = order === null || order === undefined ? "" : String(order);
  }

  function setFieldReadOnly(inputEl, isReadOnly) {
    if (!inputEl) return;
    inputEl.readOnly = Boolean(isReadOnly);
    inputEl.setAttribute("aria-readonly", Boolean(isReadOnly) ? "true" : "false");
  }

  function setFieldLabel(inputEl, text) {
    if (!inputEl) return;
    const field = inputEl.closest(".edge-field");
    const label = field ? field.querySelector("span") : null;
    if (label && text) label.textContent = text;
  }

  function applyScenarioFieldLayout(x) {
    const scenario = x.scenario;

    if (scenario === "free-hand-hedge") {
      return;
    }

    // Reset all Step 2 / Step 3 fields first.
    [
      els.entryUnderlyingPrice,
      els.shortOptionStrike,
      els.contracts,
      els.daysToExpiration,
      els.premiumReceived,
      els.averageStockCost,
      els.sharesOwned,
      els.premiumPaid,
      els.hedgePreset,
      els.protectionStrike,
      els.hedgeCost,
      els.primaryObjective,
      els.rollTargetStrike,
      els.newCallPremium,
      els.newExpirationDays,
    ].forEach((el) => {
      setFieldVisibility(el, true);
      setFieldOrder(el, null);
    });

    setFieldReadOnly(els.contracts, false);
    [els.primaryObjective, els.rollTargetStrike, els.newCallPremium, els.newExpirationDays].forEach((el) => setFieldVisibility(el, false));

    if (scenario === "short-put-pressure") {
      setFieldLabel(els.shortOptionStrike, "Short Put Strike");
      setFieldLabel(els.contracts, "Short Put Contracts");
      setFieldLabel(els.premiumReceived, "Premium Received Per Share");
      setFieldLabel(els.protectionStrike, "Protective Put Strike");
      setFieldLabel(els.hedgeCost, "Estimated Put Cost Per Share");

      setFieldVisibility(els.entryUnderlyingPrice, false);
      setFieldVisibility(els.averageStockCost, false);
      setFieldVisibility(els.sharesOwned, false);
      setFieldVisibility(els.premiumPaid, false);
      return;
    }

    if (scenario === "short-call-pressure") {
      setFieldLabel(els.shortOptionStrike, "Short Call Strike");
      setFieldLabel(els.contracts, "Short Call Contracts");
      setFieldLabel(els.premiumReceived, "Premium Received Per Share");
      setFieldLabel(els.protectionStrike, "Protective Call Strike");
      setFieldLabel(els.hedgeCost, "Estimated Call Cost Per Share");

      setFieldVisibility(els.entryUnderlyingPrice, false);
      setFieldVisibility(els.averageStockCost, false);
      setFieldVisibility(els.sharesOwned, false);
      setFieldVisibility(els.premiumPaid, false);
      return;
    }

    if (scenario === "long-stock-protection") {
      const derivedPutContracts = Math.max(0, Math.floor(x.shares / x.multiplier));

      setFieldLabel(els.sharesOwned, "Shares Owned");
      setFieldLabel(els.averageStockCost, "Average Stock Cost");
      setFieldLabel(els.contracts, "Put Contracts Needed");
      setFieldLabel(els.protectionStrike, "Protective Put Strike");
      setFieldLabel(els.hedgeCost, "Estimated Put Cost Per Share");

      setInputValue(els.contracts, derivedPutContracts);
      setFieldReadOnly(els.contracts, true);

      setFieldOrder(els.sharesOwned, 1);
      setFieldOrder(els.averageStockCost, 2);
      setFieldOrder(els.contracts, 3);
      setFieldOrder(els.daysToExpiration, 4);

      setFieldVisibility(els.entryUnderlyingPrice, false);
      setFieldVisibility(els.shortOptionStrike, false);
      setFieldVisibility(els.premiumReceived, false);
      setFieldVisibility(els.premiumPaid, false);
      return;
    }

    if (scenario === "covered-call-adjustment") {
      setFieldLabel(els.sharesOwned, "Shares Owned");
      setFieldLabel(els.averageStockCost, "Average Stock Cost");
      setFieldLabel(els.shortOptionStrike, "Short Call Strike");
      setFieldLabel(els.contracts, "Short Call Contracts");
      setFieldLabel(els.premiumReceived, "Call Premium Received Per Share");
      setFieldLabel(els.hedgeCost, "Current Buyback Cost Per Share");
      setFieldLabel(els.rollTargetStrike, "Roll Target Strike");
      setFieldLabel(els.newCallPremium, "New Call Premium");
      setFieldLabel(els.newExpirationDays, "New Expiration Days");

      setFieldOrder(els.sharesOwned, 1);
      setFieldOrder(els.averageStockCost, 2);
      setFieldOrder(els.shortOptionStrike, 3);
      setFieldOrder(els.contracts, 4);
      setFieldOrder(els.daysToExpiration, 5);
      setFieldOrder(els.premiumReceived, 6);

      setFieldVisibility(els.entryUnderlyingPrice, false);
      setFieldVisibility(els.premiumPaid, false);
      setFieldVisibility(els.protectionStrike, false);
      setFieldVisibility(els.primaryObjective, true);
      setFieldVisibility(els.rollTargetStrike, true);
      setFieldVisibility(els.newCallPremium, true);
      setFieldVisibility(els.newExpirationDays, true);
      return;
    }

}

  function getInputs() {
    const contracts = Math.max(1, Math.round(n(els.contracts, 1)));
    const multiplier = Math.max(1, Math.round(n(els.optionMultiplier, 100)));
    const current = Math.max(0.01, n(els.currentUnderlyingPrice, 178.3));
    const shortStrike = Math.max(0.01, n(els.shortOptionStrike, current));
    const rawScenario = els.scenarioSelect ? els.scenarioSelect.value : "short-put-pressure";
    const scenario = SCENARIOS[rawScenario] ? rawScenario : "long-stock-protection";

    const trigger = scenario === "short-put-pressure" || scenario === "short-call-pressure"
      ? shortStrike
      : current;

    return {
      scenario,
      hedgePreset: els.hedgePreset ? els.hedgePreset.value : "protective-put-at-sold-strike",
      current,
      entryUnderlying: Math.max(0.01, n(els.entryUnderlyingPrice, current)),
      shortStrike,
      premiumReceived: Math.max(0, n(els.premiumReceived, 0)),
      premiumPaid: Math.max(0, n(els.premiumPaid, 0)),
      averageCost: Math.max(0, n(els.averageStockCost, current)),
      shares: Math.max(0, Math.round(n(els.sharesOwned, 100))),
      contracts,
      multiplier,
      trigger,
      protectionStrike: Math.max(0.01, n(els.protectionStrike, shortStrike)),
      hedgeCost: Math.max(0, n(els.hedgeCost, 0)),
      primaryObjective: els.primaryObjective ? els.primaryObjective.value : "compare-objectively",
      rollTargetStrike: Math.max(0.01, n(els.rollTargetStrike, Math.max(current, shortStrike) + 5)),
      newCallPremium: Math.max(0, n(els.newCallPremium, 0)),
      newExpirationDays: Math.max(1, Math.round(n(els.newExpirationDays, 45))),
      days: Math.max(1, Math.round(n(els.daysToExpiration, 30))),
    };
  }

  function syncHedgePresetOptions() {
    if (!els.hedgePreset || !els.scenarioSelect) return;

    const scenario = els.scenarioSelect.value || "short-put-pressure";
    const options = HEDGE_PRESET_OPTIONS[scenario] || HEDGE_PRESET_OPTIONS["short-put-pressure"];
    const currentValue = els.hedgePreset.value;

    els.hedgePreset.innerHTML = options.map((option) => {
      return `<option value="${option.value}">${option.label}</option>`;
    }).join("");

    const allowed = options.some((option) => option.value === currentValue);
    els.hedgePreset.value = allowed ? currentValue : options[0].value;
  }

  function setInputValue(el, value) {
    if (!el || value === undefined || value === null) return;
    if (el.tagName === "SELECT") {
      el.value = String(value);
      return;
    }

    const integerFields = new Set(["contracts", "daysToExpiration", "newExpirationDays", "optionMultiplier", "sharesOwned"]);
    el.value = integerFields.has(el.id) ? String(Math.round(Number(value))) : Number(value).toFixed(2);
  }

  function applyScenarioPreset(scenario) {
    const preset = SCENARIO_PRESETS[scenario];
    if (!preset) return;

    Object.entries(preset).forEach(([id, value]) => {
      setInputValue(els[id], value);
    });

    manualLegs = [];
    renderManualLegs();
    applyManualLegListeners();
  }

  function updateScenarioOptionLabels() {
    if (!els.scenarioSelect) return;
    Array.from(els.scenarioSelect.options).forEach((option) => {
      if (SCENARIOS[option.value]) option.textContent = SCENARIOS[option.value].label;
    });
  }

  function putPayoffAtExpiry(priceAtExpiry, strike, premiumReceived, quantity, multiplier) {
    return (premiumReceived - Math.max(0, strike - priceAtExpiry)) * quantity * multiplier;
  }

  function callPayoffAtExpiry(priceAtExpiry, strike, premiumReceived, quantity, multiplier) {
    return (premiumReceived - Math.max(0, priceAtExpiry - strike)) * quantity * multiplier;
  }

  function longPutPayoffAtExpiry(priceAtExpiry, strike, cost, quantity, multiplier) {
    return (Math.max(0, strike - priceAtExpiry) - cost) * quantity * multiplier;
  }

  function longCallPayoffAtExpiry(priceAtExpiry, strike, cost, quantity, multiplier) {
    return (Math.max(0, priceAtExpiry - strike) - cost) * quantity * multiplier;
  }

  function stockPayoffAtExpiry(priceAtExpiry, costBasis, shares) {
    return (priceAtExpiry - costBasis) * shares;
  }

  function getLongStockCoverage(x) {
    const shares = Math.max(0, Math.round(x.shares));
    const multiplier = Math.max(1, Math.round(x.multiplier));
    const hedgeContracts = Math.max(0, Math.floor(shares / multiplier));
    const protectedShares = hedgeContracts * multiplier;
    const uncoveredShares = Math.max(0, shares - protectedShares);
    const coveragePct = shares > 0 ? (protectedShares / shares) * 100 : 0;

    return {
      shares,
      multiplier,
      hedgeContracts,
      protectedShares,
      uncoveredShares,
      coveragePct,
    };
  }

  function manualLegPayoffAtExpiry(priceAtExpiry, leg, multiplier) {
    const action = String(leg.action || "Buy");
    const type = String(leg.type || "Put");
    const strikeOrAvg = Math.max(0, Number(leg.strike) || 0);
    const premium = Math.max(0, Number(leg.premium) || 0);
    const qty = Math.max(0, Number(leg.qty) || 0);

    if (qty === 0) return 0;

    // Underlying and futures custom legs are intentionally disabled for now.
    // They require separate capital, margin, and average-price handling.
    if (type === "Stock" || type === "Future") return 0;

    if (strikeOrAvg === 0) return 0;

    if (type === "Call") {
      return action === "Sell"
        ? callPayoffAtExpiry(priceAtExpiry, strikeOrAvg, premium, qty, multiplier)
        : longCallPayoffAtExpiry(priceAtExpiry, strikeOrAvg, premium, qty, multiplier);
    }

    return action === "Sell"
      ? putPayoffAtExpiry(priceAtExpiry, strikeOrAvg, premium, qty, multiplier)
      : longPutPayoffAtExpiry(priceAtExpiry, strikeOrAvg, premium, qty, multiplier);
  }

  function manualLegCashTotals(multiplier) {
    return manualLegs.reduce((totals, leg) => {
      const type = String(leg.type || "Put");
      const action = String(leg.action || "Buy");
      const premium = Math.max(0, Number(leg.premium) || 0);
      const avgPrice = Math.max(0, Number(leg.strike) || 0);
      const qty = Math.max(0, Number(leg.qty) || 0);

      // Stock and futures custom legs are visible as future modules but excluded from calculations.
      if (type === "Stock" || type === "Future") return totals;

      const optionCash = premium * qty * multiplier;
      if (action === "Sell") totals.received += optionCash;
      else totals.paid += optionCash;

      return totals;
    }, { received: 0, paid: 0 });
  }

  function applyManualLegsToModel(x, model) {
    if (!manualLegs.length) return model;

    const basePayoffHedged = model.payoffHedged;
    const cash = manualLegCashTotals(x.multiplier);

    model.payoffHedged = (s) => {
      const manualPayoff = manualLegs.reduce((sum, leg) => {
        return sum + manualLegPayoffAtExpiry(s, leg, x.multiplier);
      }, 0);
      return basePayoffHedged(s) + manualPayoff;
    };

    model.legs = model.legs.concat(manualLegs.map((leg) => {
      const type = String(leg.type || "Put");
      const action = String(leg.action || "Buy");
      const strikeOrAvg = Number(leg.strike) || 0;
      const premium = Number(leg.premium) || 0;
      const qty = Number(leg.qty) || 0;
      return {
        label: "Optional custom adjustment",
        action: type === "Stock" ? (action === "Sell" ? "Short" : "Long") : action,
        type,
        strike: strikeOrAvg,
        premium,
        qty,
        cashText: type === "Stock" || type === "Future"
          ? "Coming next — not included in calculations"
          : `${money(premium)} ${action === "Sell" ? "received" : "paid"}`
      };
    }));

    model.premiumReceivedTotal += cash.received;
    model.hedgeCostTotal += cash.paid;
    model.netPremiumTotal += cash.received - cash.paid;
    model.fundsRequired += cash.paid;

    model.calculationRows = model.calculationRows.concat([
      ["Custom legs premium received", cash.received],
      ["Custom legs premium paid", -cash.paid],
      ["Net impact from custom legs", cash.received - cash.paid],
    ]);

    const sampledPrices = [];
    const range = getChartRange(x, model);
    const steps = 120;
    for (let i = 0; i <= steps; i += 1) {
      sampledPrices.push(range.low + ((range.high - range.low) * i) / steps);
    }
    manualLegs.forEach((leg) => {
      const strike = Number(leg.strike);
      if (Number.isFinite(strike) && strike > 0) sampledPrices.push(strike);
    });

    const minHedged = Math.min(...sampledPrices.map((s) => model.payoffHedged(s)));
    model.maxLoss = Math.max(0, -minHedged);

    model.riskProfile = `${model.riskProfile} + custom legs`;
    return model;
  }

  function coveredCallPayoffAtExpiry(priceAtExpiry, stockCost, callStrike, premiumReceived, shares, contracts, multiplier) {
    const stockResult = stockPayoffAtExpiry(priceAtExpiry, stockCost, shares);
    const callResult = callPayoffAtExpiry(priceAtExpiry, callStrike, premiumReceived, contracts, multiplier);
    return stockResult + callResult;
  }

  function buildShortPutRepair(x) {
    const q = x.contracts;
    const m = x.multiplier;
    const shortK = x.shortStrike;
    const hedgeK = x.protectionStrike;
    const netPremium = x.premiumReceived - x.hedgeCost;

    const spreadWidth = Math.max(0, shortK - hedgeK);
    const maxLoss = (spreadWidth - netPremium) * q * m;
    const cappedMaxLoss = Math.max(0, maxLoss);
    const originalBreakeven = shortK - x.premiumReceived;
    const newBreakeven = shortK - netPremium;

    const actionTitle = hedgeK >= shortK
      ? "Buy protective put at the sold strike"
      : "Buy lower protective put to define risk";

    const actionText = hedgeK >= shortK
      ? `If the underlying reaches ${price(shortK)}, buy ${optionContractText(q)} of the ${price(hedgeK)} protective put. The edge quantity matches the current short put position, so the hedge can neutralize additional downside from that point. Total premium received is ${money(x.premiumReceived * q * m)} and estimated hedge cost is ${money(x.hedgeCost * q * m)}.`
      : `If the underlying reaches ${price(shortK)}, buy ${optionContractText(q)} of the ${price(hedgeK)} protective put. This converts the naked short put into a defined-risk put spread and stops further loss expansion below the protective strike. Total premium received is ${money(x.premiumReceived * q * m)} and estimated hedge cost is ${money(x.hedgeCost * q * m)}.`;

    return {
      label: SCENARIOS[x.scenario].label,
      actionTitle,
      actionText,
      badge: "Best hedge",
      before: "Naked short put",
      after: hedgeK >= shortK ? "Hedged short put at sold strike" : "Defined-risk short put spread",
      riskChange: hedgeK >= shortK
        ? "Further downside is mostly neutralized from the hedge strike, net of hedge cost."
        : "Downside loss stops expanding below the protection strike.",
      legs: [
        { label: "Existing position", action: "Sell", type: "Put", strike: shortK, premium: x.premiumReceived, qty: q, cashText: `${money(x.premiumReceived)} received per share / ${money(x.premiumReceived * q * m)} total` },
        { label: "Recommended hedge", action: "Buy", type: "Put", strike: hedgeK, premium: x.hedgeCost, qty: q, cashText: `${money(x.hedgeCost)} paid per share / ${money(x.hedgeCost * q * m)} total` },
      ],
      premiumReceivedTotal: x.premiumReceived * q * m,
      hedgeCostTotal: x.hedgeCost * q * m,
      netPremiumTotal: netPremium * q * m,
      fundsRequired: x.hedgeCost * q * m,
      originalBreakeven,
      newBreakeven,
      maxLoss: cappedMaxLoss,
      riskProfile: hedgeK >= shortK ? "Downside neutralized after hedge" : "Defined downside risk",
      operatingRule: `Use when the short put is in the danger zone near ${price(shortK)} and assignment is not desired. Edit the protective strike and cost with live market data before using the repair.`,
      tradeOff: "The hedge can turn an originally profitable premium trade into a small controlled loss if protection is expensive. That is still cleaner than unlimited downside exposure.",
      payoffOriginal: (s) => putPayoffAtExpiry(s, shortK, x.premiumReceived, q, m),
      payoffHedged: (s) => putPayoffAtExpiry(s, shortK, x.premiumReceived, q, m) + longPutPayoffAtExpiry(s, hedgeK, x.hedgeCost, q, m),
      calculationRows: [
        ["Short put premium received", x.premiumReceived * q * m],
        ["Immediate hedge cost", -x.hedgeCost * q * m],
        ["Net premium after hedge", netPremium * q * m],
        ["Maximum loss after hedge", -cappedMaxLoss],
      ],
    };
  }

  function buildShortCallRepair(x) {
    const q = x.contracts;
    const m = x.multiplier;
    const shortK = x.shortStrike;
    const hedgeK = x.protectionStrike;
    const netPremium = x.premiumReceived - x.hedgeCost;

    const spreadWidth = Math.max(0, hedgeK - shortK);
    const maxLoss = (spreadWidth - netPremium) * q * m;
    const cappedMaxLoss = Math.max(0, maxLoss);
    const originalBreakeven = shortK + x.premiumReceived;
    const newBreakeven = shortK + netPremium;

    const actionTitle = hedgeK <= shortK
      ? "Buy protective call at the sold strike"
      : "Buy higher protective call to define risk";

    const actionText = hedgeK <= shortK
      ? `If the underlying reaches ${price(shortK)}, buy ${optionContractText(q)} of the ${price(hedgeK)} protective call. The edge quantity matches the current short call position, so the hedge can neutralize additional upside risk from that point. Total premium received is ${money(x.premiumReceived * q * m)} and estimated hedge cost is ${money(x.hedgeCost * q * m)}.`
      : `If the underlying reaches ${price(shortK)}, buy ${optionContractText(q)} of the ${price(hedgeK)} protective call. This converts the naked short call into a defined-risk call spread and caps further upside risk above the protective strike. Total premium received is ${money(x.premiumReceived * q * m)} and estimated hedge cost is ${money(x.hedgeCost * q * m)}.`;

    return {
      label: SCENARIOS[x.scenario].label,
      actionTitle,
      actionText,
      badge: "Best hedge",
      before: "Naked short call",
      after: hedgeK <= shortK ? "Hedged short call at sold strike" : "Defined-risk short call spread",
      riskChange: hedgeK <= shortK
        ? "Further upside risk is mostly neutralized from the hedge strike, net of hedge cost."
        : "Upside loss stops expanding above the protection strike.",
      legs: [
        { label: "Existing position", action: "Sell", type: "Call", strike: shortK, premium: x.premiumReceived, qty: q, cashText: `${money(x.premiumReceived)} received per share / ${money(x.premiumReceived * q * m)} total` },
        { label: "Recommended hedge", action: "Buy", type: "Call", strike: hedgeK, premium: x.hedgeCost, qty: q, cashText: `${money(x.hedgeCost)} paid per share / ${money(x.hedgeCost * q * m)} total` },
      ],
      premiumReceivedTotal: x.premiumReceived * q * m,
      hedgeCostTotal: x.hedgeCost * q * m,
      netPremiumTotal: netPremium * q * m,
      fundsRequired: x.hedgeCost * q * m,
      originalBreakeven,
      newBreakeven,
      maxLoss: cappedMaxLoss,
      riskProfile: hedgeK <= shortK ? "Upside risk neutralized after hedge" : "Defined upside risk",
      operatingRule: `Use when the short call is in the danger zone near ${price(shortK)} and assignment or open upside risk is not desired. Edit the protective call strike and cost with live market data before using the repair.`,
      tradeOff: "Buying protection can turn an originally profitable premium trade into a small controlled loss if the call hedge is expensive. That is still cleaner than open-ended upside risk.",
      payoffOriginal: (s) => callPayoffAtExpiry(s, shortK, x.premiumReceived, q, m),
      payoffHedged: (s) => callPayoffAtExpiry(s, shortK, x.premiumReceived, q, m) + longCallPayoffAtExpiry(s, hedgeK, x.hedgeCost, q, m),
      calculationRows: [
        ["Short call premium received", x.premiumReceived * q * m],
        ["Immediate hedge cost", -x.hedgeCost * q * m],
        ["Net premium after hedge", netPremium * q * m],
        ["Maximum loss after hedge", -cappedMaxLoss],
      ],
    };
  }

  function buildLongStockProtection(x) {
    const c = getLongStockCoverage(x);
    const shares = Math.max(1, c.shares);
    const putK = x.protectionStrike;
    const hedgeContracts = c.hedgeContracts;
    const protectedShares = c.protectedShares;
    const uncoveredShares = c.uncoveredShares;
    const hedgeCostTotal = x.hedgeCost * hedgeContracts * x.multiplier;
    const stockValue = x.current * shares;
    const unrealizedPL = stockPayoffAtExpiry(x.current, x.averageCost, shares);
    const originalBreakeven = x.averageCost;
    const newBreakeven = x.averageCost + (hedgeCostTotal / shares);
    const protectedFloorPL = (putK - x.averageCost) * protectedShares - hedgeCostTotal;
    const uncoveredZeroLoss = x.averageCost * uncoveredShares;
    const maxLoss = Math.max(0, (x.averageCost * shares) + hedgeCostTotal - (putK * protectedShares));

    const coverageText = hedgeContracts > 0
      ? `${protectedShares} of ${shares} shares are protected by ${optionContractText(hedgeContracts)}. ${uncoveredShares} share${uncoveredShares === 1 ? "" : "s"} remain uncovered.`
      : `No full option contract can be built from ${shares} shares with a ${x.multiplier} multiplier. The position remains uncovered unless the user accepts over-hedging, which this preset intentionally does not do.`;

    return {
      label: SCENARIOS[x.scenario].label,
      actionTitle: "Buy ATM protective put to protect covered shares",
      actionText: `Use this when you want to keep ${shares} shares but protect the current stock value instead of leaving the downside fully open. The default starts near the current price; lower the strike manually if you want a cheaper hedge and accept more drawdown. Buy ${optionContractText(hedgeContracts)} at ${price(putK)} and keep the hedge editable with live option prices. ${coverageText}`,
      badge: "Recommended hedge",
      before: "Long stock with open downside",
      after: hedgeContracts > 0 ? "Long stock protected by put coverage" : "Long stock without full-contract hedge",
      riskChange: hedgeContracts > 0
        ? `Downside is reduced below ${price(putK)} on ${protectedShares} covered shares. ${uncoveredShares} shares remain exposed.`
        : "No standard protective put coverage is active because the share count is below one full option contract.",
      legs: [
        { label: "Existing position", action: "Own", type: "Stock", strike: x.averageCost, premium: 0, qty: shares, cashText: `${shares} shares / ${money(stockValue)} current value` },
        { label: "Recommended hedge", action: "Buy", type: "Put", strike: putK, premium: x.hedgeCost, qty: hedgeContracts, cashText: hedgeContracts > 0 ? `${money(x.hedgeCost)} paid per share / ${money(hedgeCostTotal)} total` : "0 contracts / no full coverage" },
      ],
      premiumReceivedTotal: 0,
      hedgeCostTotal,
      netPremiumTotal: -hedgeCostTotal,
      fundsRequired: hedgeCostTotal,
      originalBreakeven,
      newBreakeven,
      maxLoss,
      riskProfile: uncoveredShares > 0 ? "Partial protection + uncovered shares" : "Fully covered protective floor",
      operatingRule: "Use after a strong rally, before a known risk event, during a macro drawdown risk window, or when selling the shares is not desired. If the thesis is broken, closing the stock may be cleaner than paying for protection.",
      tradeOff: "The ATM put protects the covered shares and keeps upside open, but the cost reduces return. Lowering the strike makes the hedge cheaper and leaves more downside open. Any uncovered shares remain exposed, because this preset avoids accidental over-hedging.",
      payoffOriginal: (s) => stockPayoffAtExpiry(s, x.averageCost, shares),
      payoffHedged: (s) => stockPayoffAtExpiry(s, x.averageCost, shares) + longPutPayoffAtExpiry(s, putK, x.hedgeCost, hedgeContracts, x.multiplier),
      calculationRows: [
        ["Shares owned", `${shares} shares`],
        ["Put contracts needed", `${hedgeContracts} contract${hedgeContracts === 1 ? "" : "s"}`],
        ["Protected shares", `${protectedShares} shares`],
        ["Uncovered shares", `${uncoveredShares} shares`],
        ["Current stock value", stockValue],
        ["Current unrealized stock P/L", unrealizedPL],
        ["Immediate hedge cost", -hedgeCostTotal],
        ["Covered-share floor before uncovered exposure", protectedFloorPL],
        ["Uncovered shares loss at zero", -uncoveredZeroLoss],
        ["Estimated max protected loss", -maxLoss],
      ],
    };
  }


  function objectiveLabel(value) {
    const labels = {
      "compare-objectively": "Compare objectively",
      "maximize-realized-profit": "Maximize realized profit",
      "keep-shares": "Keep the shares",
      "avoid-assignment-reasonable": "Avoid assignment if reasonable",
      "roll-efficiently": "Roll only if economically efficient",
      "minimize-cash-outlay": "Minimize extra cash outlay",
    };
    return labels[value] || labels["compare-objectively"];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalize(value, min, max) {
    if (!Number.isFinite(value)) return 0;
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 0.000001) return 0.5;
    return clamp((value - min) / (max - min), 0, 1);
  }

  function utilityWeightsForObjective(objective) {
    const weights = {
      "compare-objectively": {
        payoff: 0.30,
        cashEfficiency: 0.22,
        upsideReopened: 0.13,
        shareRetention: 0.04,
        ownershipControl: 0.04,
        assignmentAvoidance: 0.05,
        rollEfficiency: 0.10,
        simplicity: 0.12,
      },
      "maximize-realized-profit": {
        payoff: 0.58,
        cashEfficiency: 0.14,
        upsideReopened: 0.08,
        shareRetention: 0.00,
        ownershipControl: 0.00,
        assignmentAvoidance: 0.00,
        rollEfficiency: 0.05,
        simplicity: 0.15,
      },
      "keep-shares": {
        payoff: 0.12,
        cashEfficiency: 0.14,
        upsideReopened: 0.20,
        shareRetention: 0.08,
        ownershipControl: 0.27,
        assignmentAvoidance: 0.10,
        rollEfficiency: 0.04,
        simplicity: 0.05,
      },
      "avoid-assignment-reasonable": {
        payoff: 0.16,
        cashEfficiency: 0.32,
        upsideReopened: 0.10,
        shareRetention: 0.05,
        ownershipControl: 0.03,
        assignmentAvoidance: 0.24,
        rollEfficiency: 0.07,
        simplicity: 0.03,
      },
      "roll-efficiently": {
        payoff: 0.08,
        cashEfficiency: 0.18,
        upsideReopened: 0.15,
        shareRetention: 0.02,
        ownershipControl: 0.01,
        assignmentAvoidance: 0.03,
        rollEfficiency: 0.48,
        simplicity: 0.05,
      },
      "minimize-cash-outlay": {
        payoff: 0.18,
        cashEfficiency: 0.50,
        upsideReopened: 0.03,
        shareRetention: 0.02,
        ownershipControl: 0.02,
        assignmentAvoidance: 0.00,
        rollEfficiency: 0.00,
        simplicity: 0.25,
      },
    };

    return weights[objective] || weights["compare-objectively"];
  }

  function applyCoveredCallGuardrails(branch, objective, context) {
    let multiplier = 1;
    const cashOutlay = Math.max(0, -branch.cashImpact);

    if (branch.name === "Roll Up / Out") {
      if (!branch.rollEfficient) {
        if (objective === "roll-efficiently") {
          multiplier *= 0.20;
        } else if (objective === "compare-objectively" || objective === "avoid-assignment-reasonable") {
          multiplier *= 0.70;
        } else if (objective === "maximize-realized-profit") {
          multiplier *= 0.85;
        }
      }

      if (branch.cashImpact < 0 && Math.abs(branch.cashImpact) > context.acceptableDebit) {
        if (objective === "minimize-cash-outlay") {
          multiplier *= 0.25;
        } else if (objective === "avoid-assignment-reasonable") {
          multiplier *= 0.75;
        }
      }
    }

    if (branch.name === "Buy Back Call") {
      if (cashOutlay > context.veryExpensiveBuybackThreshold) {
        if (objective === "keep-shares") {
          multiplier *= 0.72;
        } else if (objective === "avoid-assignment-reasonable") {
          multiplier *= 0.45;
        } else if (objective === "roll-efficiently") {
          multiplier *= 0.35;
        } else if (objective === "minimize-cash-outlay") {
          multiplier *= 0.20;
        } else {
          multiplier *= 0.65;
        }
      } else if (cashOutlay > context.expensiveBuybackThreshold) {
        if (objective === "keep-shares") {
          multiplier *= 0.86;
        } else if (objective === "avoid-assignment-reasonable") {
          multiplier *= 0.65;
        } else if (objective === "roll-efficiently") {
          multiplier *= 0.50;
        } else if (objective === "minimize-cash-outlay") {
          multiplier *= 0.30;
        }
      }
    }

    if (branch.name === "Accept Assignment") {
      if (objective === "keep-shares") multiplier *= 0.35;
      if (objective === "avoid-assignment-reasonable") multiplier *= 0.45;
    }

    if (branch.name === "Wait / No Action") {
      if (objective === "avoid-assignment-reasonable") multiplier *= 0.60;
      if (objective === "roll-efficiently") multiplier *= 0.65;
    }

    return multiplier;
  }

  function scoreCoveredCallBranches(branches, context) {
    const objective = context.objective || "compare-objectively";
    const weights = utilityWeightsForObjective(objective);
    const payoffValues = branches.map((b) => b.outcomeValue).filter(Number.isFinite);
    const payoffMin = Math.min(...payoffValues);
    const payoffMax = Math.max(...payoffValues);
    const finiteUpsides = branches
      .map((b) => Number.isFinite(b.upsideReopened) ? b.upsideReopened : context.fullUpsideProxy)
      .filter(Number.isFinite);
    const maxUpside = Math.max(1, ...finiteUpsides);
    const maxCashOutlay = Math.max(1, ...branches.map((b) => Math.max(0, -b.cashImpact)));

    branches.forEach((branch) => {
      const cashOutlay = Math.max(0, -branch.cashImpact);
      const upsideAmount = Number.isFinite(branch.upsideReopened) ? branch.upsideReopened : context.fullUpsideProxy;
      const rollEfficiencyScore = branch.name === "Roll Up / Out"
        ? clamp((branch.efficiencyRatio || 0) / 3, 0, 1)
        : 0;

      const factors = {
        payoff: normalize(branch.outcomeValue, payoffMin, payoffMax),
        cashEfficiency: branch.cashImpact >= 0 ? 1 : clamp(1 - (cashOutlay / maxCashOutlay), 0, 1),
        upsideReopened: clamp(upsideAmount / maxUpside, 0, 1),
        shareRetention: branch.keepsShares ? 1 : 0,
        ownershipControl: branch.ownershipControlScore || 0,
        assignmentAvoidance: branch.avoidsAssignment ? 1 : 0,
        rollEfficiency: rollEfficiencyScore,
        simplicity: branch.simplicityScore,
      };

      let rawUtility = 0;
      Object.keys(weights).forEach((key) => {
        rawUtility += (weights[key] || 0) * (factors[key] || 0);
      });

      rawUtility *= applyCoveredCallGuardrails(branch, objective, context);

      if (objective === "minimize-cash-outlay" && cashOutlay > 0) {
        const cashPenalty = clamp(cashOutlay / Math.max(1, context.acceptableDebit), 0, 1) * 0.25;
        rawUtility = Math.max(0, rawUtility - cashPenalty);
      }

      branch.utilityFactors = factors;
      branch.score = clamp(rawUtility * 100, 0, 100);
    });
  }

  function buildCoveredCallDecisionBranches(x) {
    const shares = Math.max(1, x.shares);
    const q = Math.max(1, x.contracts);
    const m = x.multiplier;
    const coveredShares = Math.min(shares, q * m);
    const uncoveredShares = Math.max(0, shares - coveredShares);
    const callK = x.shortStrike;
    const premium = x.premiumReceived;
    const premiumTotal = premium * q * m;
    const closeCost = x.hedgeCost;
    const closeCostTotal = closeCost * q * m;
    const newK = Math.max(callK + 0.01, x.rollTargetStrike);
    const newPremium = x.newCallPremium;
    const newPremiumTotal = newPremium * q * m;
    const netBuybackCost = closeCostTotal - premiumTotal;
    const netRollCash = newPremiumTotal - closeCostTotal;
    const totalRollOptionResult = premiumTotal + newPremiumTotal - closeCostTotal;
    const extraUpsideUnlocked = Math.max(0, newK - callK) * coveredShares;
    const efficiencyRatio = netRollCash < 0
      ? extraUpsideUnlocked / Math.max(1, Math.abs(netRollCash))
      : extraUpsideUnlocked > 0 ? 99 : 0;

    const assignedCoveredPL = (callK - x.averageCost) * coveredShares + premiumTotal;
    const uncoveredCurrentPL = (x.current - x.averageCost) * uncoveredShares;
    const assignmentPL = assignedCoveredPL + uncoveredCurrentPL;
    const currentCoveredCallPL = coveredCallPayoffAtExpiry(x.current, x.averageCost, callK, premium, shares, q, m);
    const buybackCurrentPL = stockPayoffAtExpiry(x.current, x.averageCost, shares) + premiumTotal - closeCostTotal;
    const buybackJustificationMove = closeCostTotal / shares;
    const rollAssignedCoveredPL = (newK - x.averageCost) * coveredShares + premiumTotal + newPremiumTotal - closeCostTotal;
    const rollAssignedUncoveredPL = (x.current - x.averageCost) * uncoveredShares;
    const rollAssignedPL = rollAssignedCoveredPL + rollAssignedUncoveredPL;
    const waitAtCurrentPL = currentCoveredCallPL;

    const assignmentProfitAbs = Math.max(1, Math.abs(assignmentPL));
    const acceptableDebit = Math.max(100, premiumTotal, assignmentProfitAbs * 0.15);
    const expensiveBuybackThreshold = Math.max(premiumTotal * 2, assignmentProfitAbs * 0.20, 300);
    const veryExpensiveBuybackThreshold = Math.max(premiumTotal * 3, assignmentProfitAbs * 0.35, 600);

    const context = {
      objective: x.primaryObjective,
      shares,
      multiplier: m,
      coveredShares,
      uncoveredShares,
      acceptableDebit,
      expensiveBuybackThreshold,
      veryExpensiveBuybackThreshold,
      fullUpsideProxy: Math.max(extraUpsideUnlocked, Math.abs(x.current - callK) * coveredShares, coveredShares * Math.max(1, x.current * 0.08)),
    };

    const branches = [
      {
        name: "Accept Assignment",
        cashImpact: 0,
        cashImpactText: `No new cash / original ${money(premiumTotal)} premium retained`,
        outcomeValue: assignmentPL,
        outcomeText: `${money(assignmentPL)} if assigned at ${price(callK)}`,
        upsideReopened: 0,
        capLevel: price(callK),
        verdict: assignmentPL >= 0 ? "Clean profitable exit" : "Assignment locks a loss",
        realized: true,
        keepsShares: uncoveredShares > 0,
        avoidsAssignment: false,
        simplicityScore: 1.00,
        ownershipControlScore: uncoveredShares > 0 ? 0.20 : 0.00,
        payoff: () => assignmentPL,
      },
      {
        name: "Buy Back Call",
        cashImpact: -closeCostTotal,
        cashImpactText: `${money(-closeCostTotal)} gross / ${money(premiumTotal - closeCostTotal)} net option result`,
        outcomeValue: buybackCurrentPL,
        outcomeText: `${money(buybackCurrentPL)} current net stock P/L after close`,
        upsideReopened: Number.POSITIVE_INFINITY,
        capLevel: "None",
        verdict: `Full upside reopened; stock needs about ${price(x.current + buybackJustificationMove)} to mechanically earn back the close cost`,
        realized: false,
        keepsShares: true,
        avoidsAssignment: true,
        simplicityScore: 0.35,
        ownershipControlScore: 1.00,
        payoff: (s) => stockPayoffAtExpiry(s, x.averageCost, shares) + premiumTotal - closeCostTotal,
      },
      {
        name: "Roll Up / Out",
        cashImpact: netRollCash,
        cashImpactText: `${money(netRollCash)} roll cash / ${money(totalRollOptionResult)} total option result`,
        outcomeValue: rollAssignedPL,
        outcomeText: `${money(rollAssignedPL)} if later assigned at ${price(newK)}`,
        upsideReopened: extraUpsideUnlocked,
        capLevel: price(newK),
        verdict: netRollCash >= 0
          ? `Credit roll; cap moved higher by ${price(newK - callK)}`
          : `Debit roll; ${money(extraUpsideUnlocked)} extra upside for ${money(Math.abs(netRollCash))} net debit (${efficiencyRatio.toFixed(1)}x)`,
        realized: false,
        keepsShares: true,
        avoidsAssignment: true,
        efficiencyRatio,
        rollEfficient: netRollCash >= 0 || efficiencyRatio >= 3,
        simplicityScore: 0.55,
        ownershipControlScore: 0.65,
        payoff: (s) => coveredCallPayoffAtExpiry(s, x.averageCost, newK, premium + newPremium - closeCost, shares, q, m),
      },
      {
        name: "Wait / No Action",
        cashImpact: 0,
        cashImpactText: `No new cash / original ${money(premiumTotal)} premium retained`,
        outcomeValue: waitAtCurrentPL,
        outcomeText: `${money(waitAtCurrentPL)} if expiry were near current price`,
        upsideReopened: 0,
        capLevel: price(callK),
        verdict: "Keeps cash and optionality, but does not solve assignment pressure",
        realized: false,
        keepsShares: true,
        avoidsAssignment: false,
        simplicityScore: 0.80,
        ownershipControlScore: 0.45,
        payoff: (s) => coveredCallPayoffAtExpiry(s, x.averageCost, callK, premium, shares, q, m),
      },
    ];

    scoreCoveredCallBranches(branches, context);

    branches.sort((a, b) => b.score - a.score);

    return {
      branches,
      best: branches[0],
      shares,
      q,
      m,
      coveredShares,
      uncoveredShares,
      callK,
      premium,
      premiumTotal,
      closeCost,
      closeCostTotal,
      newK,
      newPremium,
      newPremiumTotal,
      netBuybackCost,
      netRollCash,
      totalRollOptionResult,
      extraUpsideUnlocked,
      efficiencyRatio,
      assignmentPL,
      currentCoveredCallPL,
      buybackCurrentPL,
      rollAssignedPL,
      acceptableDebit,
      expensiveBuybackThreshold,
      veryExpensiveBuybackThreshold,
    };
  }


  function buildCoveredCallDecisionPath(x, d, best, second) {
    const assignmentProfitable = d.assignmentPL >= 0;
    const netBuybackText = d.netBuybackCost >= 0
      ? `${money(d.netBuybackCost)} net cost after original premium`
      : `${money(Math.abs(d.netBuybackCost))} net credit after original premium`;
    const rollCostText = d.netRollCash < 0
      ? `${money(Math.abs(d.netRollCash))} net debit`
      : `${money(d.netRollCash)} net credit`;
    const closeness = second && Number.isFinite(second.score)
      ? Math.abs(best.score - second.score)
      : 100;
    const closeAlternative = second && closeness < 8
      ? `${second.name} is a close alternative (${second.score.toFixed(1)} vs ${best.score.toFixed(1)}).`
      : second
        ? `${second.name} is the second-ranked branch (${second.score.toFixed(1)} vs ${best.score.toFixed(1)}).`
        : "No second-ranked branch available.";

    const finalReason = best.name === "Accept Assignment"
      ? "The utility engine is saying the capped exit is clean enough that paying extra to avoid it is not justified under the selected objective."
      : best.name === "Buy Back Call"
        ? "The utility engine is prioritizing share retention and full upside reopening enough to justify the buyback cost."
        : best.name === "Roll Up / Out"
          ? "The utility engine is favoring the roll because it buys additional capped upside with better efficiency than a pure buyback."
          : "The utility engine is favoring patience because immediate action does not dominate the no-cash alternative.";

    return [
      ["Assignment profitability", assignmentProfitable ? `Yes: ${money(d.assignmentPL)} if assigned at ${price(d.callK)}` : `No: ${money(d.assignmentPL)} if assigned at ${price(d.callK)}`],
      ["Primary objective", objectiveLabel(x.primaryObjective)],
      ["Buyback economics", `${money(d.closeCostTotal)} gross close cost; ${netBuybackText}`],
      ["Roll economics", `${rollCostText}; unlocks ${money(d.extraUpsideUnlocked)} of extra capped upside; efficiency ${d.netRollCash < 0 ? `${d.efficiencyRatio.toFixed(1)}x` : "credit / no debit"}`],
      ["Utility ranking", closeAlternative],
      ["Decision result", `${best.name}: ${finalReason}`],
    ];
  }

  function buildCoveredCallAdjustment(x) {
    const d = buildCoveredCallDecisionBranches(x);
    const best = d.best;
    const second = d.branches[1] || null;
    const decisionPath = buildCoveredCallDecisionPath(x, d, best, second);
    const objective = objectiveLabel(x.primaryObjective);
    const originalBreakeven = x.averageCost - x.premiumReceived;
    const bestBreakeven = best.name === "Buy Back Call"
      ? x.averageCost - x.premiumReceived + d.closeCost
      : best.name === "Roll Up / Out"
        ? x.averageCost - x.premiumReceived - x.newCallPremium + d.closeCost
        : originalBreakeven;

    const netOptionCashForBest = best.name === "Buy Back Call"
      ? d.premiumTotal - d.closeCostTotal
      : best.name === "Roll Up / Out"
        ? d.premiumTotal + d.newPremiumTotal - d.closeCostTotal
        : d.premiumTotal;
    const downsideMaxLoss = Math.max(0, (x.averageCost * d.shares) - netOptionCashForBest);

    const badge = best.name === "Accept Assignment"
      ? "Assignment acceptable"
      : best.name === "Roll Up / Out"
        ? "Best roll logic"
        : best.name === "Buy Back Call"
          ? "Keep shares"
          : "Wait check";

    const actionText = `Objective: ${objective}. Edge Station™ compared assignment, buyback, roll, and wait outcomes. Best-ranked branch: ${best.name}. ${best.verdict}. Assignment is not treated as failure; the tool ranks whether paying to avoid it is actually worth it, because apparently that still needs to be said out loud.`;

    return {
      label: SCENARIOS[x.scenario].label,
      actionTitle: `Best decision: ${best.name}`,
      actionText,
      badge,
      before: "Long stock + short covered call",
      after: best.name,
      riskChange: best.name === "Accept Assignment"
        ? "The position exits cleanly at the short call strike if assigned. The trade-off is missed upside above the strike."
        : best.name === "Buy Back Call"
          ? "The short call is removed. The shares remain owned and upside is reopened, but the buyback cost must be earned back."
          : best.name === "Roll Up / Out"
            ? "The cap is moved higher. The trade-off is the net roll debit/credit and the new capped upside."
            : "No immediate cash is spent, but the original cap and assignment risk remain active.",
      legs: [
        { label: "Existing position", action: "Own", type: "Stock", strike: x.averageCost, premium: 0, qty: d.shares, cashText: `${d.shares} shares / cost basis ${price(x.averageCost)}` },
        { label: "Existing position", action: "Sell", type: "Call", strike: d.callK, premium: d.premium, qty: d.q, cashText: `${money(d.premium)} received per share / ${money(d.premiumTotal)} total` },
        best.name === "Buy Back Call"
          ? { label: "Best decision", action: "Buy to close", type: "Call", strike: d.callK, premium: d.closeCost, qty: d.q, cashText: `${money(d.closeCost)} paid per share / ${money(d.closeCostTotal)} total` }
          : best.name === "Roll Up / Out"
            ? { label: "Best decision", action: "Roll", type: "Call", strike: d.newK, premium: d.newPremium, qty: d.q, cashText: `${money(d.netRollCash)} net roll cash impact` }
            : { label: "Best decision", action: best.name === "Accept Assignment" ? "Allow assignment" : "Wait", type: "Call", strike: d.callK, premium: d.premium, qty: d.q, cashText: best.name === "Accept Assignment" ? "No new cash outlay" : "No immediate adjustment" },
      ],
      premiumReceivedTotal: d.premiumTotal + (best.name === "Roll Up / Out" ? d.newPremiumTotal : 0),
      hedgeCostTotal: best.name === "Buy Back Call" || best.name === "Roll Up / Out" ? d.closeCostTotal : 0,
      netPremiumTotal: best.name === "Buy Back Call"
        ? d.premiumTotal - d.closeCostTotal
        : best.name === "Roll Up / Out"
          ? d.premiumTotal + d.newPremiumTotal - d.closeCostTotal
          : d.premiumTotal,
      fundsRequired: best.cashImpact < 0 ? Math.abs(best.cashImpact) : 0,
      originalBreakeven,
      newBreakeven: bestBreakeven,
      maxLoss: downsideMaxLoss,
      riskProfile: `Decision matrix: ${best.name}`,
      operatingRule: "Use this module when the covered call is ITM or threatened. First decide whether selling the shares is acceptable. Only pay to buy back or roll if the cost buys enough ownership value or extra upside.",
      tradeOff: best.name === "Accept Assignment"
        ? "You keep the premium and accept the capped sale. The cost is missed upside above the strike, not a trading loss. Civilization may survive this."
        : best.name === "Buy Back Call"
          ? "You keep the shares and reopen upside, but the buyback debit raises the effective breakeven. If the stock reverses, the buyback becomes regret with a ticker symbol."
          : best.name === "Roll Up / Out"
            ? "You move the cap higher, but the new call still caps upside. A debit roll must buy enough extra upside to justify the cost."
            : "Waiting preserves cash but leaves the original assignment and cap problem unresolved.",
      payoffOriginal: (s) => coveredCallPayoffAtExpiry(s, x.averageCost, d.callK, d.premium, d.shares, d.q, d.m),
      payoffHedged: (s) => best.payoff(s),
      decisionBranches: d.branches,
      decisionPath,
      calculationRows: [
        ["Primary objective", objective],
        ["Premium originally received", d.premiumTotal],
        ["Assignment P/L at short strike", d.assignmentPL],
        ["Buyback cost", -d.closeCostTotal],
        ["Net buyback result after original premium", d.premiumTotal - d.closeCostTotal],
        ["Roll net cash impact", d.netRollCash],
        ["Extra upside unlocked by roll", d.extraUpsideUnlocked],
        ["Roll upside/cost ratio", d.netRollCash < 0 ? `${d.efficiencyRatio.toFixed(1)}x` : "Credit / no debit"],
        ["Best-ranked decision", best.name],
      ],
    };
  }

  function buildStockBreakEvenRepair(x) {
    const shares = Math.max(1, x.shares);
    const q = Math.max(1, Math.ceil(shares / x.multiplier));
    const longCallK = Math.max(0.01, x.current);
    const shortCallK = Math.max(longCallK + 0.01, x.shortStrike || x.averageCost);
    const repairCost = Math.max(0, x.hedgeCost);
    const originalBreakeven = x.averageCost;
    const maxRepairBenefitPerShare = Math.max(0, shortCallK - longCallK);
    const theoreticalNewBreakeven = Math.max(0, x.averageCost - maxRepairBenefitPerShare + repairCost);
    const capPrice = shortCallK;
    const capPL = stockPayoffAtExpiry(capPrice, x.averageCost, shares)
      + longCallPayoffAtExpiry(capPrice, longCallK, repairCost, q, x.multiplier)
      - Math.max(0, capPrice - shortCallK) * (2 * q) * x.multiplier;

    return {
      label: SCENARIOS[x.scenario].label,
      actionTitle: "Add stock repair call structure",
      actionText: `Buy a call near ${price(longCallK)} and finance it by selling higher calls near ${price(shortCallK)}. This can improve the path toward breakeven, but caps recovery above the short call zone.`,
      badge: "Best repair",
      before: "Long stock below cost basis",
      after: "Long stock plus repair call structure",
      riskChange: "Recovery improves inside the repair zone, but upside is capped after the short call area.",
      legs: [
        { label: "Existing position", action: "Own", type: "Stock", strike: x.averageCost, premium: 0, qty: shares, cashText: `${shares} shares` },
        { label: "Recommended repair", action: "Buy", type: "Call", strike: longCallK, premium: repairCost, qty: q, cashText: `${money(repairCost)} paid` },
        { label: "Recommended repair", action: "Sell", type: "Call", strike: shortCallK, premium: 0, qty: 2 * q, cashText: "financing leg" },
      ],
      premiumReceivedTotal: 0,
      hedgeCostTotal: repairCost * q * x.multiplier,
      netPremiumTotal: -repairCost * q * x.multiplier,
      fundsRequired: repairCost * q * x.multiplier,
      originalBreakeven,
      newBreakeven: theoreticalNewBreakeven,
      maxLoss: Math.max(0, x.averageCost * shares + repairCost * q * x.multiplier),
      riskProfile: "Recovery improved, upside capped",
      operatingRule: "Use only when the investor accepts an upside cap in exchange for a lower recovery threshold.",
      tradeOff: "Stock repair is not magic. It shifts the recovery profile and caps upside. Anyone calling it free repair is selling theatre.",
      payoffOriginal: (s) => stockPayoffAtExpiry(s, x.averageCost, shares),
      payoffHedged: (s) => {
        const stock = stockPayoffAtExpiry(s, x.averageCost, shares);
        const longCall = longCallPayoffAtExpiry(s, longCallK, repairCost, q, x.multiplier);
        const shortCalls = -Math.max(0, s - shortCallK) * (2 * q) * x.multiplier;
        return stock + longCall + shortCalls;
      },
      calculationRows: [
        ["Original unrealized P/L at current price", stockPayoffAtExpiry(x.current, x.averageCost, shares)],
        ["Immediate repair cost", -repairCost * q * x.multiplier],
        ["Theoretical improved breakeven", theoreticalNewBreakeven],
        ["Estimated P/L at repair cap", capPL],
      ],
    };
  }


  function makeFreeHandLeg(group, side, instrument, entryOrStrike, premium, quantity, multiplier, dte) {
    return {
      group,
      side: side || "long",
      instrument: instrument || "stock",
      entryOrStrike: Number.isFinite(Number(entryOrStrike)) ? Number(entryOrStrike) : 0,
      premium: Number.isFinite(Number(premium)) ? Number(premium) : 0,
      quantity: Number.isFinite(Number(quantity)) ? Number(quantity) : 1,
      multiplier: Number.isFinite(Number(multiplier)) ? Number(multiplier) : (instrument === "call" || instrument === "put" ? 100 : 1),
      dte: dte === null || dte === undefined || dte === "" ? "" : Number(dte),
    };
  }

  function freeHandInstrumentLabel(instrument) {
    const labels = {
      stock: "Stock / Spot",
      future: "Future",
      call: "Call",
      put: "Put",
    };
    return labels[instrument] || "Stock / Spot";
  }

  function freeHandSideLabel(side) {
    return side === "short" ? "Short" : "Long";
  }

  function isOptionInstrument(instrument) {
    return instrument === "call" || instrument === "put";
  }

  function normalizeFreeHandLeg(leg) {
    const instrument = ["stock", "future", "call", "put"].includes(leg.instrument) ? leg.instrument : "stock";
    const side = leg.side === "short" ? "short" : "long";
    const isOption = isOptionInstrument(instrument);
    const multiplierFallback = isOption ? 100 : 1;
    return {
      group: leg.group || "current",
      side,
      instrument,
      entryOrStrike: Math.max(0, Number(leg.entryOrStrike) || 0),
      premium: isOption ? Math.max(0, Number(leg.premium) || 0) : 0,
      quantity: Math.max(0, Number(leg.quantity) || 0),
      multiplier: Math.max(1, Number(leg.multiplier) || multiplierFallback),
      dte: isOption ? Math.max(0, Number(leg.dte) || 0) : "",
    };
  }

  function freeHandLegPayoffAtPrice(priceAtExpiry, rawLeg) {
    const leg = normalizeFreeHandLeg(rawLeg);
    const q = leg.quantity;
    const m = leg.multiplier;
    const ref = leg.entryOrStrike;
    const premium = leg.premium;

    if (q <= 0 || m <= 0) return 0;

    if (leg.instrument === "stock" || leg.instrument === "future") {
      const base = (priceAtExpiry - ref) * q * m;
      return leg.side === "short" ? -base : base;
    }

    if (leg.instrument === "call") {
      const intrinsic = Math.max(0, priceAtExpiry - ref);
      const longValue = (intrinsic - premium) * q * m;
      return leg.side === "short" ? -longValue : longValue;
    }

    const intrinsic = Math.max(0, ref - priceAtExpiry);
    const longValue = (intrinsic - premium) * q * m;
    return leg.side === "short" ? -longValue : longValue;
  }

  function freeHandGroupPayoff(legs, priceAtExpiry) {
    return legs.reduce((sum, leg) => sum + freeHandLegPayoffAtPrice(priceAtExpiry, leg), 0);
  }

  function freeHandCashflow(legs) {
    return legs.reduce((sum, rawLeg) => {
      const leg = normalizeFreeHandLeg(rawLeg);
      if (!isOptionInstrument(leg.instrument)) return sum;
      const cash = leg.premium * leg.quantity * leg.multiplier;
      return leg.side === "short" ? sum + cash : sum - cash;
    }, 0);
  }

  function getFreeHandExpiryWarning(currentLegs, hedgeLegs) {
    const currentDtes = currentLegs
      .map(normalizeFreeHandLeg)
      .filter((leg) => isOptionInstrument(leg.instrument) && leg.dte > 0)
      .map((leg) => leg.dte);
    const hedgeDtes = hedgeLegs
      .map(normalizeFreeHandLeg)
      .filter((leg) => isOptionInstrument(leg.instrument) && leg.dte > 0)
      .map((leg) => leg.dte);

    if (!currentDtes.length || !hedgeDtes.length) return "";

    const minCurrent = Math.min(...currentDtes);
    const minHedge = Math.min(...hedgeDtes);
    const maxCurrent = Math.max(...currentDtes);
    const maxHedge = Math.max(...hedgeDtes);

    if (minCurrent === minHedge && maxCurrent === maxHedge) return "";
    if (minHedge < maxCurrent) {
      return `Hedge option expiry is shorter than at least one current option leg (${minHedge} DTE vs ${maxCurrent} DTE). Residual exposure may reopen after the hedge expires.`;
    }
    return `Expiry mismatch: hedge option DTE and current option DTE are not identical (${minHedge}-${maxHedge} vs ${minCurrent}-${maxCurrent}). Snapshot payoff is mechanical, not a time-value model.`;
  }

  function buildFreeHandHedge(x) {
    const currentLegs = freeHandCurrentLegs.map(normalizeFreeHandLeg);
    const hedgeLegs = freeHandHedgeLegs.map(normalizeFreeHandLeg);
    const selectedPrice = x.current;
    const currentPL = freeHandGroupPayoff(currentLegs, selectedPrice);
    const hedgePL = freeHandGroupPayoff(hedgeLegs, selectedPrice);
    const combinedPL = currentPL + hedgePL;
    const hedgeCashflow = freeHandCashflow(hedgeLegs);
    const allLegs = currentLegs.concat(hedgeLegs);
    const keyPrices = allLegs
      .map((leg) => leg.entryOrStrike)
      .filter((value) => Number.isFinite(value) && value > 0);

    const sampleLow = Math.max(0.01, Math.min(selectedPrice, ...keyPrices) * 0.72);
    const sampleHigh = Math.max(selectedPrice, ...keyPrices, selectedPrice * 1.28);
    const sampledPrices = [];
    for (let i = 0; i <= 160; i += 1) {
      sampledPrices.push(sampleLow + ((sampleHigh - sampleLow) * i) / 160);
    }
    keyPrices.forEach((value) => sampledPrices.push(value));

    const combinedValues = sampledPrices.map((s) => freeHandGroupPayoff(currentLegs, s) + freeHandGroupPayoff(hedgeLegs, s));
    const minCombined = Math.min(...combinedValues);
    const maxCombined = Math.max(...combinedValues);
    const breakeven = findApproxBreakeven((s) => freeHandGroupPayoff(currentLegs, s) + freeHandGroupPayoff(hedgeLegs, s), sampleLow, sampleHigh);
    const expiryWarning = getFreeHandExpiryWarning(currentLegs, hedgeLegs);

    return {
      isFreeHand: true,
      label: SCENARIOS[x.scenario].label,
      actionTitle: "Free Hand Hedge snapshot",
      actionText: `At ${price(selectedPrice)}, combined P/L is ${money(combinedPL)}. Current position P/L is ${money(currentPL)} and hedge position P/L is ${money(hedgePL)}.`,
      badge: "Snapshot",
      before: "Manual current position",
      after: "Manual current position + hedge legs",
      riskChange: "The combined payoff shows whether the hedge reduces, shifts, or amplifies risk across the selected price range.",
      legs: allLegs.map((leg) => ({
        label: leg.group === "hedge" ? "Hedge leg" : "Current leg",
        action: freeHandSideLabel(leg.side),
        type: freeHandInstrumentLabel(leg.instrument),
        strike: leg.entryOrStrike,
        premium: leg.premium,
        qty: leg.quantity,
        cashText: isOptionInstrument(leg.instrument)
          ? `${money(leg.premium)} ${leg.side === "short" ? "received" : "paid"} / ${leg.multiplier}× / ${leg.dte || 0} DTE`
          : `${leg.quantity} units at ${price(leg.entryOrStrike)} / ${leg.multiplier}×`,
      })),
      premiumReceivedTotal: Math.max(0, hedgeCashflow),
      hedgeCostTotal: Math.max(0, -hedgeCashflow),
      netPremiumTotal: hedgeCashflow,
      fundsRequired: Math.max(0, -hedgeCashflow),
      originalBreakeven: breakeven,
      newBreakeven: breakeven,
      maxLoss: Math.max(0, -minCombined),
      maxGain: maxCombined,
      riskProfile: expiryWarning ? "Snapshot hedge with expiry mismatch" : "Snapshot hedge",
      operatingRule: "Use Free Hand Hedge when you already know the structure you want to test. Add the current position first, then add the hedge legs, and judge the combined P/L at the selected underlying price.",
      tradeOff: expiryWarning || "This view ignores Greeks, implied volatility, and time decay. It is a clean payoff snapshot, not a pricing oracle wearing a cape.",
      payoffOriginal: (s) => freeHandGroupPayoff(currentLegs, s),
      payoffHedge: (s) => freeHandGroupPayoff(hedgeLegs, s),
      payoffHedged: (s) => freeHandGroupPayoff(currentLegs, s) + freeHandGroupPayoff(hedgeLegs, s),
      calculationRows: [
        ["Selected underlying price", price(selectedPrice)],
        ["Current position P/L", currentPL],
        ["Hedge position P/L", hedgePL],
        ["Combined P/L", combinedPL],
        ["Net hedge debit / credit", hedgeCashflow],
        ["Visible max loss", -Math.max(0, -minCombined)],
      ],
      freeHandCurrentLegs: currentLegs,
      freeHandHedgeLegs: hedgeLegs,
      freeHandExpiryWarning: expiryWarning,
    };
  }

  function findApproxBreakeven(payoffFn, low, high) {
    let previousPrice = low;
    let previousValue = payoffFn(low);
    const steps = 240;
    for (let i = 1; i <= steps; i += 1) {
      const s = low + ((high - low) * i) / steps;
      const value = payoffFn(s);
      if (value === 0) return s;
      if ((previousValue < 0 && value > 0) || (previousValue > 0 && value < 0)) {
        const denom = Math.abs(previousValue) + Math.abs(value);
        const weight = denom > 0 ? Math.abs(previousValue) / denom : 0;
        return previousPrice + (s - previousPrice) * weight;
      }
      previousPrice = s;
      previousValue = value;
    }
    return NaN;
  }

  function buildModel(x) {
    switch (x.scenario) {
      case "short-call-pressure":
        return buildShortCallRepair(x);
      case "long-stock-protection":
        return buildLongStockProtection(x);
      case "covered-call-adjustment":
        return buildCoveredCallAdjustment(x);
      case "free-hand-hedge":
        return buildFreeHandHedge(x);
      case "short-put-pressure":
      default:
        return buildShortPutRepair(x);
    }
  }

  function optionContractText(q) {
    return `${q} contract${q === 1 ? "" : "s"}`;
  }

  function renderCurrentPositionSummary(x) {
    if (!els.currentPositionSummary) return;

    const q = x.contracts;
    const m = x.multiplier;
    const totalPremium = x.premiumReceived * q * m;

    if (x.scenario === "short-put-pressure" || x.scenario === "short-call-pressure") {
      if (els.summaryContracts) els.summaryContracts.textContent = optionContractText(q);
      if (els.summaryStrike) els.summaryStrike.textContent = price(x.shortStrike);
      if (els.summaryPremiumPerContract) els.summaryPremiumPerContract.textContent = `${money(x.premiumReceived)} × ${m} multiplier = ${money(x.premiumReceived * m)} per contract`;
      if (els.summaryPremiumFormula) els.summaryPremiumFormula.textContent = `${money(x.premiumReceived)} × ${m} × ${q} = ${money(totalPremium)}`;
      els.currentPositionSummary.classList.remove("edge-hide");
      return;
    }

    if (x.scenario === "covered-call-adjustment") {
      const total = x.premiumReceived * q * m;
      if (els.summaryContracts) els.summaryContracts.textContent = `${x.shares} shares / ${optionContractText(q)}`;
      if (els.summaryStrike) els.summaryStrike.textContent = price(x.shortStrike);
      if (els.summaryPremiumPerContract) els.summaryPremiumPerContract.textContent = `${money(x.premiumReceived)} × ${m} = ${money(x.premiumReceived * m)} per call contract`;
      if (els.summaryPremiumFormula) els.summaryPremiumFormula.textContent = `${money(x.premiumReceived)} × ${m} × ${q} = ${money(total)}`;
      els.currentPositionSummary.classList.remove("edge-hide");
      return;
    }

    if (x.scenario === "long-stock-protection") {
      const c = getLongStockCoverage(x);
      if (els.summaryContracts) els.summaryContracts.textContent = `${c.shares} shares owned`;
      if (els.summaryStrike) els.summaryStrike.textContent = `Average cost ${price(x.averageCost)}`;
      if (els.summaryPremiumPerContract) els.summaryPremiumPerContract.textContent = `${c.protectedShares} protected / ${c.uncoveredShares} uncovered shares`;
      if (els.summaryPremiumFormula) els.summaryPremiumFormula.textContent = c.hedgeContracts > 0
        ? `${money(x.hedgeCost)} × ${c.multiplier} × ${c.hedgeContracts} = ${money(x.hedgeCost * c.multiplier * c.hedgeContracts)} estimated hedge cost`
        : `No full option contract coverage available with ${c.shares} shares and ${c.multiplier} multiplier`;
      els.currentPositionSummary.classList.remove("edge-hide");
      return;
    }

    if (x.scenario === "free-hand-hedge") {
      els.currentPositionSummary.classList.add("edge-hide");
      return;
    }

  }

  function renderHedgePresetSummary(x) {
    if (!els.hedgePresetSummary) return;
    if (x.scenario === "free-hand-hedge") {
      els.hedgePresetSummary.classList.add("edge-hide");
      return;
    }
    els.hedgePresetSummary.classList.remove("edge-hide");

    const coverage = x.scenario === "long-stock-protection" ? getLongStockCoverage(x) : null;
    const q = coverage ? coverage.hedgeContracts : x.contracts;
    const m = x.multiplier;
    const totalHedgeCost = x.hedgeCost * q * m;

    const selectedOption = els.hedgePreset
      ? els.hedgePreset.options[els.hedgePreset.selectedIndex]
      : null;
    const presetName = selectedOption ? selectedOption.textContent : "Editable hedge preset";

    if (els.hedgePresetName) els.hedgePresetName.textContent = presetName;

    if (els.hedgePresetSize) {
      if (x.scenario === "short-put-pressure") {
        els.hedgePresetSize.textContent = `${optionContractText(q)} protective put${q === 1 ? "" : "s"}`;
      } else if (x.scenario === "short-call-pressure") {
        els.hedgePresetSize.textContent = `${optionContractText(q)} protective call${q === 1 ? "" : "s"}`;
      } else if (x.scenario === "long-stock-protection") {
        els.hedgePresetSize.textContent = q > 0
          ? `${optionContractText(q)} protective put${q === 1 ? "" : "s"}`
          : "0 full protective put contracts";
      } else if (x.scenario === "covered-call-adjustment") {
        els.hedgePresetSize.textContent = `${optionContractText(x.contracts)} short call${x.contracts === 1 ? "" : "s"} against ${x.shares} shares`;
      } else {
        els.hedgePresetSize.textContent = `${optionContractText(q)} derived from position size`;
      }
    }

    if (els.hedgePresetCostFormula) {
      els.hedgePresetCostFormula.textContent = q > 0
        ? `${money(x.hedgeCost)} × ${m} × ${q} = ${money(totalHedgeCost)}`
        : `${money(x.hedgeCost)} × ${m} × 0 = ${money(0)}`;
    }

    if (els.hedgeCoverageFormula) {
      if (coverage) {
        els.hedgeCoverageFormula.textContent = `${coverage.protectedShares} protected shares / ${coverage.uncoveredShares} uncovered shares (${pct(coverage.coveragePct)} covered)`;
      } else if (x.scenario === "short-put-pressure" || x.scenario === "short-call-pressure") {
        els.hedgeCoverageFormula.textContent = `Hedge quantity matches ${optionContractText(q)} in the existing short option position`;
      } else if (x.scenario === "covered-call-adjustment") {
        els.hedgeCoverageFormula.textContent = `Decision matrix compares assignment, buyback, roll to ${price(x.rollTargetStrike)}, and wait`;
      } else {
        els.hedgeCoverageFormula.textContent = "Scenario-specific coverage shown after preset calculation";
      }
    }
  }


  function renderCoveredCallDecisionMatrix(x, model) {
    if (!els.coveredCallDecisionSection || !els.coveredCallDecisionBody) return;

    const isCoveredCall = x.scenario === "covered-call-adjustment" && Array.isArray(model.decisionBranches);
    els.coveredCallDecisionSection.classList.toggle("edge-hide", !isCoveredCall);
    if (!isCoveredCall) {
      els.coveredCallDecisionBody.innerHTML = "";
      return;
    }

    const bestName = model.decisionBranches[0] ? model.decisionBranches[0].name : "";
    els.coveredCallDecisionBody.innerHTML = model.decisionBranches.map((branch) => {
      const isBest = branch.name === bestName;
      const cashClass = branch.cashImpact >= 0 ? "is-profit" : "is-loss";
      const upsideText = branch.upsideReopened === Number.POSITIVE_INFINITY
        ? "Full upside reopened"
        : money(branch.upsideReopened);
      return `
        <tr ${isBest ? 'style="background: rgba(201, 162, 39, 0.13);"' : ""}>
          <td><strong>${branch.name}${isBest ? " · Best" : ""}</strong></td>
          <td><span class="edge-dom-pl ${cashClass}">${branch.cashImpactText || money(branch.cashImpact)}</span></td>
          <td>${branch.outcomeText}</td>
          <td>${upsideText}</td>
          <td>${branch.capLevel}</td>
          <td><strong>${branch.score.toFixed(1)}</strong></td>
          <td>${branch.verdict}</td>
        </tr>
      `;
    }).join("");
  }


  function renderCoveredCallDecisionPath(x, model) {
    if (!els.coveredCallDecisionPathSection || !els.coveredCallDecisionPathBody) return;

    const isCoveredCall = x.scenario === "covered-call-adjustment" && Array.isArray(model.decisionPath);
    els.coveredCallDecisionPathSection.classList.toggle("edge-hide", !isCoveredCall);
    if (!isCoveredCall) {
      els.coveredCallDecisionPathBody.innerHTML = "";
      return;
    }

    els.coveredCallDecisionPathBody.innerHTML = model.decisionPath.map((row, index) => `
      <tr>
        <th>${index + 1}. ${row[0]}</th>
        <td>${row[1]}</td>
      </tr>
    `).join("");
  }

  function renderRecommendedLegs(model) {
    if (!els.recommendedLegsBody) return;
    els.recommendedLegsBody.innerHTML = model.legs.map((leg, index) => {
      const role = leg.label || `Leg ${index + 1}`;
      const strikeLabel = leg.type === "Stock" ? `${price(leg.strike)} avg price` : price(leg.strike);
      const qtyLabel = leg.type === "Stock" ? `${leg.qty} shares` : optionContractText(Number(leg.qty) || 0);
      return `
        <tr>
          <td>${role}</td>
          <td>${leg.action}</td>
          <td>${leg.type}</td>
          <td>${strikeLabel}</td>
          <td>${leg.cashText || "—"}</td>
          <td><strong>${qtyLabel}</strong></td>
        </tr>
      `;
    }).join("");
  }

  function renderCalculation(model) {
    if (!els.netTradeCalculation) return;

    const rows = model.calculationRows.map(([label, value]) => `
      <div class="edge-calculation-row">
        <span>${label}</span>
        <strong>${typeof value === "string" ? value : (typeof value === "number" && Math.abs(value) < 1000 && label.toLowerCase().includes("breakeven") ? price(value) : money(value))}</strong>
      </div>
    `).join("");

    els.netTradeCalculation.innerHTML = `
      <p><strong>${model.actionTitle}</strong></p>
      <p>${model.actionText}</p>
      <div class="edge-calculation-grid">
        ${rows}
        <div class="edge-calculation-row final">
          <span>Core diagnostic</span>
          <strong>${model.riskProfile}</strong>
        </div>
      </div>
    `;
  }

  function getChartRange(x, model) {
    /*
      Edge Station chart philosophy:
      The chart should explain the repair zone, not map the whole universe.
      For short-option repair, the sold strike/protection zone should sit near
      the visual centre of the payoff diagram. The DOM handles the detailed ladder.
    */
    if (model && model.isFreeHand) {
      const legLevels = (model.freeHandCurrentLegs || []).concat(model.freeHandHedgeLegs || [])
        .map((leg) => leg.entryOrStrike)
        .filter((value) => Number.isFinite(value) && value > 0);
      const allLevels = [x.current].concat(legLevels, [model.newBreakeven]).filter((value) => Number.isFinite(value) && value > 0);
      const minLevel = allLevels.length ? Math.min(...allLevels) : x.current;
      const maxLevel = allLevels.length ? Math.max(...allLevels) : x.current;
      const span = Math.max(maxLevel - minLevel, x.current * 0.20, 20);
      const low = Math.max(0.01, minLevel - span * 0.35);
      const high = maxLevel + span * 0.35;
      return { low, high, step: Math.max((high - low) / 120, 0.25), anchor: x.current };
    }

    const keyLevels = [
      x.current,
      x.scenario === "long-stock-protection" ? x.averageCost : x.shortStrike,
      x.protectionStrike,
      x.scenario === "covered-call-adjustment" ? x.rollTargetStrike : NaN,
      model.originalBreakeven,
      model.newBreakeven,
    ].filter((value) => Number.isFinite(value) && value > 0);

    const anchor = x.scenario === "long-stock-protection"
      ? (Number.isFinite(x.current) && x.current > 0 ? x.current : x.protectionStrike)
      : Number.isFinite(x.shortStrike) && x.shortStrike > 0
        ? x.shortStrike
        : Number.isFinite(x.protectionStrike) && x.protectionStrike > 0
          ? x.protectionStrike
          : Number.isFinite(x.current) && x.current > 0
            ? x.current
            : 100;

    const farthestKeyDistance = keyLevels.length
      ? Math.max(...keyLevels.map((level) => Math.abs(level - anchor)))
      : 0;

    /*
      A tighter default window keeps the strike context readable.
      The window expands only when a relevant key level would otherwise fall outside.
    */
    const defaultHalfWidth = Math.max(anchor * 0.14, 12);
    const halfWidth = Math.max(defaultHalfWidth, farthestKeyDistance * 1.35);

    const low = Math.max(0.01, anchor - halfWidth);
    const high = anchor + halfWidth;

    return {
      low,
      high,
      step: Math.max((high - low) / 120, 0.25),
      anchor,
    };
  }

  function drawChart(x, model) {
    const canvas = els.edgePayoffChart;
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const range = getChartRange(x, model);
    const points = [];

    const sampleCount = 180;
    for (let i = 0; i <= sampleCount; i += 1) {
      const s = range.low + ((range.high - range.low) * i) / sampleCount;
      points.push({
        s,
        original: model.payoffOriginal(s),
        hedge: typeof model.payoffHedge === "function" ? model.payoffHedge(s) : 0,
        hedged: model.payoffHedged(s),
      });
    }

    const allY = points.flatMap((p) => model.isFreeHand ? [p.hedged, 0] : [p.original, p.hedged, 0]);
    let yMin = Math.min(...allY);
    let yMax = Math.max(...allY);

    if (Math.abs(yMax - yMin) < 1) {
      yMax += 100;
      yMin -= 100;
    }

    /*
      Keep the zero line away from the extreme top/bottom.
      For repair views, the after-hedge result often sits near zero, so we add
      deliberate headroom above zero instead of letting the old naked exposure
      dominate the entire canvas.
    */
    const rawSpan = yMax - yMin;
    const topHeadroom = Math.max(rawSpan * 0.22, 250);
    const bottomHeadroom = Math.max(rawSpan * 0.10, 120);

    yMax = Math.max(yMax + topHeadroom, topHeadroom);
    yMin = yMin - bottomHeadroom;

    const left = 92;
    const right = 52;
    const top = 58;
    const bottom = 86;

    const plotW = w - left - right;
    const plotH = h - top - bottom;

    const xScale = (s) => left + ((s - range.low) / (range.high - range.low)) * plotW;
    const yScale = (v) => top + ((yMax - v) / (yMax - yMin)) * plotH;

    const yZero = yScale(0);

    const clampX = (px) => Math.max(left, Math.min(w - right, px));

    const chartMoney = (value) => {
      if (!Number.isFinite(value)) return "—";
      const sign = value < 0 ? "-" : "";
      return `${sign}$${Math.abs(value).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`;
    };

    const chartPrice = (value) => {
      if (!Number.isFinite(value)) return "—";
      return `$${value.toFixed(2)}`;
    };

    ctx.save();

    /* Background */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    /* Plot background */
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(left, top, plotW, plotH);

    /* Y grid */
    const yTicks = 5;
    ctx.font = "13px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= yTicks; i += 1) {
      const v = yMin + ((yMax - yMin) * i) / yTicks;
      const py = yScale(v);

      ctx.strokeStyle = Math.abs(v) < (yMax - yMin) / 100 ? "#94a3b8" : "#e7ecf2";
      ctx.lineWidth = Math.abs(v) < (yMax - yMin) / 100 ? 1.4 : 1;

      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(w - right, py);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.fillText(chartMoney(v), left - 10, py);
    }

    /* X grid: centre around strike/anchor */
    const xTicks = [
      range.low,
      range.anchor - (range.anchor - range.low) / 2,
      range.anchor,
      range.anchor + (range.high - range.anchor) / 2,
      range.high,
    ];

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    xTicks.forEach((s) => {
      const px = xScale(s);

      ctx.strokeStyle = Math.abs(s - range.anchor) < 0.001 ? "#d6b24a" : "#e7ecf2";
      ctx.lineWidth = Math.abs(s - range.anchor) < 0.001 ? 1.3 : 1;

      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, top + plotH);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = Math.abs(s - range.anchor) < 0.001 ? "700 13px Arial" : "13px Arial";
      ctx.fillText(`$${Math.round(s)}`, px, top + plotH + 16);
    });

    /* Axes */
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, top + plotH);
    ctx.lineTo(w - right, top + plotH);
    ctx.stroke();

    /* Axis titles */
    ctx.fillStyle = "#334155";
    ctx.font = "700 15px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("P/L at expiry", left, 30);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 13px Arial";
    ctx.textAlign = "right";
    ctx.fillText("Expiry Price", w - right, h - 18);

    /* Area fills based on hedged payoff */
    function drawArea(sign, fillStyle) {
      ctx.beginPath();
      let drawing = false;

      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const value = p.hedged;
        const inZone = sign === "profit" ? value >= 0 : value <= 0;

        if (inZone && !drawing) {
          ctx.moveTo(xScale(p.s), yZero);
          drawing = true;
        }

        if (inZone) {
          ctx.lineTo(xScale(p.s), yScale(value));
        }

        const next = points[i + 1];
        const nextInZone = next ? (sign === "profit" ? next.hedged >= 0 : next.hedged <= 0) : false;

        if (drawing && !nextInZone) {
          ctx.lineTo(xScale(p.s), yZero);
          ctx.closePath();
          ctx.fillStyle = fillStyle;
          ctx.fill();
          drawing = false;
        }
      }
    }

    drawArea("profit", "rgba(22, 101, 52, 0.13)");
    drawArea("loss", "rgba(153, 27, 27, 0.11)");

    /* Payoff lines */
    function drawLine(key, color, width, dash = []) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.beginPath();
      points.forEach((p, i) => {
        const px = xScale(p.s);
        const py = yScale(p[key]);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }

    if (!model.isFreeHand) drawLine("original", "#9ca3af", 2.2, [7, 5]);
    drawLine("hedged", "#10233f", 3.4);

    function drawVerticalMarker(value, label, color, yOffset, dash = [6, 5]) {
      if (!Number.isFinite(value)) return;

      const px = clampX(xScale(value));
      if (px < left || px > w - right) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, top + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = color;
      ctx.font = "700 13px Arial";
      ctx.textAlign = px > w - right - 170 ? "right" : "left";
      ctx.textBaseline = "top";

      const labelX = px > w - right - 170 ? px - 8 : px + 8;
      ctx.fillText(`${label} ${chartPrice(value)}`, labelX, top + yOffset);
    }

    drawVerticalMarker(x.current, "Spot", "#c9a227", 18, [6, 5]);
    drawVerticalMarker(model.newBreakeven, "B/E", "#b91c1c", 46, [7, 5]);

    /* Strike/protection label, grouped when identical or close */
    const strikeMarkers = model.isFreeHand
      ? (model.freeHandCurrentLegs || []).concat(model.freeHandHedgeLegs || [])
          .filter((leg) => Number.isFinite(leg.entryOrStrike) && leg.entryOrStrike > 0)
          .slice(0, 6)
          .map((leg) => ({ value: leg.entryOrStrike, label: isOptionInstrument(leg.instrument) ? `${freeHandInstrumentLabel(leg.instrument)} strike` : `${freeHandInstrumentLabel(leg.instrument)} entry` }))
      : x.scenario === "long-stock-protection"
        ? [
          { value: x.averageCost, label: "Cost basis" },
          { value: x.protectionStrike, label: "Protection" },
        ]
      : x.scenario === "covered-call-adjustment"
        ? [
            { value: x.shortStrike, label: "Short call" },
            { value: x.rollTargetStrike, label: "Roll target" },
          ]
        : [
          { value: x.shortStrike, label: "Sold strike" },
          { value: x.protectionStrike, label: "Protection" },
        ];

    const grouped = [];
    strikeMarkers.forEach((marker) => {
      const px = xScale(marker.value);
      const match = grouped.find((group) => Math.abs(group.px - px) < 44);

      if (match) {
        match.labels.push(marker.label);
        match.values.push(marker.value);
        match.value = match.values.reduce((a, b) => a + b, 0) / match.values.length;
        match.px = xScale(match.value);
      } else {
        grouped.push({
          value: marker.value,
          px,
          labels: [marker.label],
          values: [marker.value],
        });
      }
    });

    grouped.forEach((marker, index) => {
      const px = clampX(marker.px);
      const label = `${marker.labels.join(" / ")} ${chartPrice(marker.value)}`;

      ctx.strokeStyle = "#d6b24a";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#8a6d13";
      ctx.font = "700 12px Arial";
      ctx.textAlign = px > w - right - 230 ? "right" : "left";
      ctx.textBaseline = "bottom";

      const labelX = px > w - right - 230 ? px - 8 : px + 8;
      ctx.fillText(label, labelX, top + plotH - 12 - index * 16);
    });

    /* Legend */
    const legendY = 28;
    const legendStart = Math.max(left + 300, w - right - 430);

    function legendItem(x0, label, type, color) {
      ctx.save();

      if (type === "box") {
        ctx.fillStyle = color;
        ctx.fillRect(x0, legendY - 10, 12, 12);
        ctx.strokeStyle = color.includes("153") ? "rgba(153, 27, 27, 0.55)" : "rgba(22, 101, 52, 0.55)";
        ctx.strokeRect(x0, legendY - 10, 12, 12);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x0, legendY - 4);
        ctx.lineTo(x0 + 18, legendY - 4);
        ctx.stroke();
      }

      ctx.fillStyle = "#64748b";
      ctx.font = "700 12px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x0 + 20, legendY - 4);

      ctx.restore();
    }

    if (model.isFreeHand) {
      legendItem(legendStart, "Combined", "line", "#10233f");
    } else {
      legendItem(legendStart, "Profit zone", "box", "rgba(22, 101, 52, 0.13)");
      legendItem(legendStart + 118, "Loss zone", "box", "rgba(153, 27, 27, 0.11)");
      legendItem(legendStart + 228, "Original", "line", "#9ca3af");
      legendItem(legendStart + 318, "After hedge", "line", "#10233f");
    }

    /* Footer range */
    ctx.fillStyle = "#64748b";
    ctx.font = "700 13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      `Underlying price range: $${range.low.toFixed(2)} – $${range.high.toFixed(2)}`,
      left,
      h - 18
    );

    ctx.restore();
  }

  function renderDomTape(x, model) {
    if (!els.payoffTapeGrid) return;

    const domTable = els.payoffTapeGrid.closest(".edge-dom-table");
    const domHeader = domTable ? domTable.querySelector(".edge-dom-row-head") : null;

    if (model.isFreeHand) {
      if (domTable) domTable.classList.remove("is-freehand");
      if (domHeader) {
        domHeader.classList.remove("is-freehand");
        domHeader.innerHTML = `<span>Underlying</span><span>Combined P/L</span>`;
      }

      const center = Math.round(x.current);
      const allLegs = (model.freeHandCurrentLegs || []).concat(model.freeHandHedgeLegs || []);
      const spread = Math.max(8, Math.round(x.current * 0.10));
      const step = Math.max(1, Math.round(spread / 6));
      const rows = [];

      for (let s = center + spread; s >= center - spread; s -= step) rows.push(s);
      allLegs.forEach((leg) => rows.push(Math.round(leg.entryOrStrike)));
      if (Number.isFinite(model.newBreakeven)) rows.push(Math.round(model.newBreakeven));

      const unique = [...new Set(rows.filter((v) => v > 0))].sort((a, b) => b - a);
      const selected = Math.round(x.current);

      els.payoffTapeGrid.innerHTML = unique.map((s) => {
        const combinedPL = model.payoffHedged(s);
        const isSelected = Math.abs(s - selected) < step / 2;
        const isStrike = allLegs.some((leg) => Math.abs(s - leg.entryOrStrike) < 0.5);
        return `
          <div class="edge-dom-row ${isStrike ? "is-strike" : ""} ${isSelected ? "is-selected" : ""}">
            <span class="edge-dom-price">${price(s)}</span>
            <span class="edge-dom-pl ${combinedPL >= 0 ? "is-profit" : "is-loss"}">${money(combinedPL)}</span>
          </div>
        `;
      }).join("");
      return;
    }

    if (domTable) domTable.classList.remove("is-freehand");
    if (domHeader) {
      domHeader.classList.remove("is-freehand");
      domHeader.innerHTML = `<span>Underlying</span><span>Net Trade P/L</span>`;
    }

    const center = Math.round(x.current);
    const spread = Math.max(8, Math.round(x.current * 0.08));
    const step = Math.max(1, Math.round(spread / 6));
    const rows = [];

    for (let s = center + spread; s >= center - spread; s -= step) {
      rows.push(s);
    }

    [x.shortStrike, x.protectionStrike, model.newBreakeven].forEach((v) => {
      if (Number.isFinite(v)) rows.push(Math.round(v));
    });

    const unique = [...new Set(rows.filter((v) => v > 0))].sort((a, b) => b - a);
    const selected = Math.round(x.current);

    els.payoffTapeGrid.innerHTML = unique.map((s) => {
      const pl = model.payoffHedged(s);
      const isProfit = pl >= 0;
      const contextLevel = x.scenario === "long-stock-protection" ? x.averageCost : x.shortStrike;
      const secondaryLevel = x.scenario === "covered-call-adjustment" ? x.rollTargetStrike : x.protectionStrike;
      const isStrike = Math.abs(s - contextLevel) < 0.5 || Math.abs(s - secondaryLevel) < 0.5 || Math.abs(s - model.newBreakeven) < 0.5;
      const isSelected = Math.abs(s - selected) < step / 2;
      return `
        <div class="edge-dom-row ${isStrike ? "is-strike" : ""} ${isSelected ? "is-selected" : ""}">
          <span class="edge-dom-price">${price(s)}</span>
          <span class="edge-dom-pl ${isProfit ? "is-profit" : "is-loss"}">${money(pl)}</span>
        </div>
      `;
    }).join("");
  }

  function renderManualLegs() {
    if (!els.manualLegsBody) return;

    if (manualLegs.length === 0) {
      els.manualLegsBody.innerHTML = `
        <tr>
          <td colspan="6"><strong>Optional custom adjustment.</strong> No extra option legs added. Stock and futures overlays are visible as coming-next modules and are not included in calculations yet.</td>
        </tr>
      `;
      return;
    }

    els.manualLegsBody.innerHTML = manualLegs.map((leg, i) => `
      <tr>
        <td>
          <select data-manual-index="${i}" data-manual-field="action">
            <option value="Buy" ${leg.action === "Buy" ? "selected" : ""}>Buy</option>
            <option value="Sell" ${leg.action === "Sell" ? "selected" : ""}>Sell</option>
          </select>
        </td>
        <td>
          <select data-manual-index="${i}" data-manual-field="type">
            <option value="Put" ${leg.type === "Put" ? "selected" : ""}>Put</option>
            <option value="Call" ${leg.type === "Call" ? "selected" : ""}>Call</option>
            <option value="Stock" disabled ${leg.type === "Stock" ? "selected" : ""}>Long / Short Stock — coming next</option>
            <option value="Future" disabled ${leg.type === "Future" ? "selected" : ""}>Long / Short Future — coming next</option>
          </select>
        </td>
        <td><input data-manual-index="${i}" data-manual-field="strike" type="number" min="0" step="0.01" value="${leg.strike}"></td>
        <td><input data-manual-index="${i}" data-manual-field="premium" type="number" min="0" step="0.01" value="${leg.premium}"></td>
        <td><input data-manual-index="${i}" data-manual-field="qty" type="number" min="1" step="1" value="${leg.qty}"></td>
        <td><button class="edge-remove-manual-leg" data-remove-manual="${i}" type="button">Remove</button></td>
      </tr>
    `).join("");
  }

  function applyManualLegListeners() {
    if (!els.manualLegsBody) return;

    els.manualLegsBody.querySelectorAll("[data-manual-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.getAttribute("data-manual-index"));
        const field = input.getAttribute("data-manual-field");
        if (!manualLegs[index]) return;
        if (field === "strike" || field === "premium" || field === "qty") {
          manualLegs[index][field] = Number(input.value);
        } else {
          manualLegs[index][field] = input.value;
        }
        update();
      });
    });

    els.manualLegsBody.querySelectorAll("[data-remove-manual]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-remove-manual"));
        manualLegs.splice(index, 1);
        renderManualLegs();
        applyManualLegListeners();
        update();
      });
    });
  }


  function renderFreeHandLegs() {
    renderFreeHandLegGroup("current", freeHandCurrentLegs, els.freeHandCurrentLegsBody);
    renderFreeHandLegGroup("hedge", freeHandHedgeLegs, els.freeHandHedgeLegsBody);
  }

  function renderFreeHandLegGroup(group, legs, tbody) {
    if (!tbody) return;

    if (!legs.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8"><strong>No ${group === "hedge" ? "hedge" : "current position"} legs added.</strong> Add a stock, future, call, or put leg to calculate the payoff snapshot.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = legs.map((rawLeg, i) => {
      const leg = normalizeFreeHandLeg(rawLeg);
      const isOption = isOptionInstrument(leg.instrument);
      return `
        <tr class="edge-freehand-leg-row">
          <td>
            <select data-freehand-group="${group}" data-freehand-index="${i}" data-freehand-field="side">
              <option value="long" ${leg.side === "long" ? "selected" : ""}>Long</option>
              <option value="short" ${leg.side === "short" ? "selected" : ""}>Short</option>
            </select>
          </td>
          <td>
            <select data-freehand-group="${group}" data-freehand-index="${i}" data-freehand-field="instrument">
              <option value="stock" ${leg.instrument === "stock" ? "selected" : ""}>Stock / Spot</option>
              <option value="future" ${leg.instrument === "future" ? "selected" : ""}>Future</option>
              <option value="call" ${leg.instrument === "call" ? "selected" : ""}>Call</option>
              <option value="put" ${leg.instrument === "put" ? "selected" : ""}>Put</option>
            </select>
          </td>
          <td><input data-freehand-group="${group}" data-freehand-index="${i}" data-freehand-field="entryOrStrike" type="number" min="0" step="0.01" value="${leg.entryOrStrike}"></td>
          <td><input data-freehand-group="${group}" data-freehand-index="${i}" data-freehand-field="premium" type="number" min="0" step="0.01" value="${leg.premium}" ${isOption ? "" : "disabled"}></td>
          <td><input data-freehand-group="${group}" data-freehand-index="${i}" data-freehand-field="quantity" type="number" min="0" step="1" value="${leg.quantity}"></td>
          <td><input data-freehand-group="${group}" data-freehand-index="${i}" data-freehand-field="multiplier" type="number" min="1" step="1" value="${leg.multiplier}"></td>
          <td><input data-freehand-group="${group}" data-freehand-index="${i}" data-freehand-field="dte" type="number" min="0" step="1" value="${isOption ? leg.dte : ""}" ${isOption ? "" : "disabled"}></td>
          <td><button class="edge-remove-manual-leg" data-remove-freehand-group="${group}" data-remove-freehand-index="${i}" type="button">Remove</button></td>
        </tr>
      `;
    }).join("");
  }

  function removeFreeHandLeg(group, index) {
    const list = group === "hedge" ? freeHandHedgeLegs : freeHandCurrentLegs;
    if (!Array.isArray(list)) return;
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return;
    list.splice(index, 1);
    renderFreeHandLegs();
    applyFreeHandLegListeners();
    update();
  }

  function applyFreeHandLegListeners() {
    [els.freeHandCurrentLegsBody, els.freeHandHedgeLegsBody].filter(Boolean).forEach((tbody) => {
      if (!tbody.dataset.freehandBound) {
        tbody.addEventListener("input", (event) => {
          const target = event.target;
          if (target && target.matches("[data-freehand-field]")) {
            handleFreeHandInput({ currentTarget: target });
          }
        });

        tbody.addEventListener("change", (event) => {
          const target = event.target;
          if (target && target.matches("[data-freehand-field]")) {
            handleFreeHandInput({ currentTarget: target });
          }
        });

        tbody.addEventListener("click", (event) => {
          const button = event.target.closest("[data-remove-freehand-group]");
          if (!button) return;
          event.preventDefault();
          event.stopPropagation();
          const group = button.getAttribute("data-remove-freehand-group");
          const index = Number(button.getAttribute("data-remove-freehand-index"));
          removeFreeHandLeg(group, index);
        });

        tbody.dataset.freehandBound = "true";
      }
    });
  }

  function handleFreeHandInput(event) {
    const input = event.currentTarget;
    const group = input.getAttribute("data-freehand-group");
    const index = Number(input.getAttribute("data-freehand-index"));
    const field = input.getAttribute("data-freehand-field");
    const list = group === "hedge" ? freeHandHedgeLegs : freeHandCurrentLegs;
    if (!list[index]) return;

    if (field === "side" || field === "instrument") {
      const previousInstrument = list[index].instrument;
      list[index][field] = input.value;
      if (field === "instrument" && previousInstrument !== input.value) {
        if (isOptionInstrument(input.value)) {
          if (!Number(list[index].multiplier) || Number(list[index].multiplier) === 1) list[index].multiplier = 100;
          if (list[index].dte === "" || list[index].dte === null || list[index].dte === undefined) list[index].dte = 30;
          if (!Number(list[index].quantity)) list[index].quantity = 1;
        } else {
          list[index].premium = 0;
          list[index].multiplier = 1;
          list[index].dte = "";
        }
        renderFreeHandLegs();
        applyFreeHandLegListeners();
      }
    } else {
      list[index][field] = field === "dte" && input.value === "" ? "" : Number(input.value);
    }

    update();
  }

  function addFreeHandLeg(group) {
    const x = getInputs();
    const list = group === "hedge" ? freeHandHedgeLegs : freeHandCurrentLegs;
    list.push(makeFreeHandLeg(group, "long", "stock", x.current, 0, 1, 1, ""));
    renderFreeHandLegs();
    applyFreeHandLegListeners();
    update();
  }

  function renderFreeHandExpiryWarning(model) {
    if (!els.freeHandExpiryWarning || !els.freeHandExpiryWarningText) return;
    const warning = model && model.isFreeHand ? model.freeHandExpiryWarning : "";
    els.freeHandExpiryWarning.classList.toggle("edge-hide", !warning);
    els.freeHandExpiryWarningText.textContent = warning || "—";
  }

  function updateScenarioCopy(x) {
    const config = SCENARIOS[x.scenario] || SCENARIOS["short-put-pressure"];
    if (els.currentPositionDescription) els.currentPositionDescription.textContent = config.positionText;
    if (els.payoffTapeScenario) els.payoffTapeScenario.textContent = `Scenario: ${config.label}`;
  }

  function update() {
    syncHedgePresetOptions();

    const x = getInputs();
    applyScenarioFieldLayout(x);

    const isFreeHand = x.scenario === "free-hand-hedge";
    if (els.freeHandHedgeSection) els.freeHandHedgeSection.classList.toggle("edge-hide", !isFreeHand);
    const presetInputLayout = els.positionInputs ? els.positionInputs.closest(".edge-two-column") : null;
    if (presetInputLayout) presetInputLayout.classList.toggle("edge-hide", isFreeHand);
    const optionalManualSection = els.manualLegsBody ? els.manualLegsBody.closest(".edge-manual-section") : null;
    if (optionalManualSection) optionalManualSection.classList.toggle("edge-hide", isFreeHand);

    const recommendationSection = els.recommendedActionTitle ? els.recommendedActionTitle.closest(".edge-recommendation-section") : null;
    if (recommendationSection) recommendationSection.classList.toggle("edge-hide", isFreeHand);

    const model = isFreeHand ? buildModel(x) : applyManualLegsToModel(x, buildModel(x));

    updateScenarioCopy(x);
    renderCurrentPositionSummary(x);
    renderHedgePresetSummary(x);

    if (els.recommendedActionTitle) els.recommendedActionTitle.textContent = model.actionTitle;
    if (els.recommendedActionText) els.recommendedActionText.textContent = model.actionText;
    if (els.recommendedActionBadge) els.recommendedActionBadge.textContent = model.badge;

    if (els.beforeStructure) els.beforeStructure.textContent = model.before;
    if (els.afterStructure) els.afterStructure.textContent = model.after;
    if (els.riskChangeText) els.riskChangeText.textContent = model.riskChange;

    if (els.capitalPremiumReceived) els.capitalPremiumReceived.textContent = money(model.premiumReceivedTotal);
    if (els.capitalHedgeCost) els.capitalHedgeCost.textContent = money(model.hedgeCostTotal);
    if (els.capitalNetPremium) els.capitalNetPremium.textContent = money(model.netPremiumTotal);
    if (els.capitalFundsRequired) els.capitalFundsRequired.textContent = money(model.fundsRequired);

    if (els.metricOriginalBreakeven) els.metricOriginalBreakeven.textContent = price(model.originalBreakeven);
    if (els.metricNewBreakeven) els.metricNewBreakeven.textContent = price(model.newBreakeven);
    if (els.metricMaxLoss) els.metricMaxLoss.textContent = money(model.maxLoss);
    if (els.metricRiskProfile) els.metricRiskProfile.textContent = model.riskProfile;

    if (els.operatingRuleText) els.operatingRuleText.textContent = model.operatingRule;
    if (els.tradeOffText) els.tradeOffText.textContent = model.tradeOff;

    renderCoveredCallDecisionMatrix(x, model);
    renderCoveredCallDecisionPath(x, model);
    renderFreeHandExpiryWarning(model);
    renderRecommendedLegs(model);
    renderCalculation(model);
    drawChart(x, model);
    renderDomTape(x, model);
  }

  function bindEvents() {
    const inputs = [
      els.currentUnderlyingPrice,
      els.daysToExpiration,
      els.contracts,
      els.optionMultiplier,
      els.entryUnderlyingPrice,
      els.shortOptionStrike,
      els.premiumReceived,
      els.averageStockCost,
      els.sharesOwned,
      els.premiumPaid,
      els.hedgePreset,
      els.protectionStrike,
      els.hedgeCost,
      els.primaryObjective,
      els.rollTargetStrike,
      els.newCallPremium,
      els.newExpirationDays,
    ].filter(Boolean);

    if (els.scenarioSelect) {
      els.scenarioSelect.addEventListener("change", () => {
        applyScenarioPreset(els.scenarioSelect.value);
        update();
      });
    }

    inputs.forEach((input) => {
      input.addEventListener("input", update);
      input.addEventListener("change", update);
    });

    if (els.addFreeHandCurrentLegButton) {
      els.addFreeHandCurrentLegButton.addEventListener("click", () => addFreeHandLeg("current"));
    }

    if (els.addFreeHandHedgeLegButton) {
      els.addFreeHandHedgeLegButton.addEventListener("click", () => addFreeHandLeg("hedge"));
    }

    if (els.addManualLegButton) {
      els.addManualLegButton.addEventListener("click", () => {
        const x = getInputs();
        const coverage = x.scenario === "long-stock-protection" ? getLongStockCoverage(x) : null;
        manualLegs.push({
          action: "Buy",
          type: x.scenario.includes("call") ? "Call" : "Put",
          strike: x.protectionStrike,
          premium: x.hedgeCost,
          qty: coverage ? Math.max(1, coverage.hedgeContracts) : x.contracts,
        });
        renderManualLegs();
        applyManualLegListeners();
        update();
      });
    }
  }

  function init() {
    updateScenarioOptionLabels();
    renderManualLegs();
    renderFreeHandLegs();
    applyFreeHandLegListeners();
    bindEvents();
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
