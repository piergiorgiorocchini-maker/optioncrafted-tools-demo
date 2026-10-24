/*
  OptionsCrafted Probability Station
  Prototype v1.1

  Modules:
  - Asset data loading
  - Seasonality rendering
  - Best/Worst seasonal month summary
  - Historical forward return probability
  - Forward-return bell curve chart
  - Smart rule-based explanations
  - Basic downside-risk diagnostics
  - Simplified Black-Scholes option modelling
*/

const DATA_PATHS = {
  assets: "data/assets.json",
  monthlyReturns: "data/monthly-returns.json",
  historicalPrices: "data/historical-prices.json",
  seasonalityMatrix: "data/seasonality-matrix.json"
};

let assets = [];
let monthlyReturns = {};
let historicalData = {};
let seasonalityMatrix = {};

let activeMatrixRange = "10Y";

let latestProbabilityState = null;
let latestPremiumState = null;
let latestPremiumQualityState = null;

const premiumManualOverrides = new Set();
const PREMIUM_AUTO_FIELDS = new Set(["historicalVol", "optionDelta"]);

const els = {
  assetSelect: document.getElementById("assetSelect"),
  spotPrice: document.getElementById("spotPrice"),
  strikePrice: document.getElementById("strikePrice"),
  expiryDate: document.getElementById("expiryDate"),
  daysToExpiry: document.getElementById("daysToExpiry"),
  optionType: document.getElementById("optionType"),

  marketPulseSPY: document.getElementById("marketPulseSPY"),
  marketPulseQQQ: document.getElementById("marketPulseQQQ"),
  marketPulseVIX: document.getElementById("marketPulseVIX"),

  distanceToStrike: document.getElementById("distanceToStrike"),
  probAbove: document.getElementById("probAbove"),
  probBelow: document.getElementById("probBelow"),
  expectedMove: document.getElementById("expectedMove"),

  seasonalityTable: document.getElementById("seasonalityTable"),
  seasonalityMatrixBody: document.getElementById("seasonalityMatrixBody"),
  seasonalityEquityChart: document.getElementById("seasonalityEquityChart"),
  bestSeasonalMonth: document.getElementById("bestSeasonalMonth"),
  bestSeasonalStats: document.getElementById("bestSeasonalStats"),
  worstSeasonalMonth: document.getElementById("worstSeasonalMonth"),
  worstSeasonalStats: document.getElementById("worstSeasonalStats"),
  seasonalityReading: document.getElementById("seasonalityReading"),

  requiredReturn: document.getElementById("requiredReturn"),
  p5Move: document.getElementById("p5Move"),
  p1Move: document.getElementById("p1Move"),
  worstMove: document.getElementById("worstMove"),
  probTouch: document.getElementById("probTouch"),
  probabilityBellChart: document.getElementById("probabilityBellChart"),
  probabilityReading: document.getElementById("probabilityReading"),

  impliedVol: document.getElementById("impliedVol"),
  riskFreeRate: document.getElementById("riskFreeRate"),
  dividendYield: document.getElementById("dividendYield"),
  marketPremium: document.getElementById("marketPremium"),
  scenarioSpot: document.getElementById("scenarioSpot"),
  scenarioVol: document.getElementById("scenarioVol"),
  scenarioDaysLeft: document.getElementById("scenarioDaysLeft"),

  theoreticalPremium: document.getElementById("theoreticalPremium"),
  scenarioPremium: document.getElementById("scenarioPremium"),
  shortOptionPL: document.getElementById("shortOptionPL"),
  premiumReading: document.getElementById("premiumReading"),

  premiumQualitySection: document.getElementById("premiumQualitySection"),
  qualityObjective: document.getElementById("qualityObjective"),
  historicalVol: document.getElementById("historicalVol"),
  ivRank: document.getElementById("ivRank"),
  optionDelta: document.getElementById("optionDelta"),
  eventRisk: document.getElementById("eventRisk"),
  qualityTargetPrice: document.getElementById("qualityTargetPrice"),
  optionBid: document.getElementById("optionBid"),
  optionAsk: document.getElementById("optionAsk"),
  openInterest: document.getElementById("openInterest"),
  optionVolume: document.getElementById("optionVolume"),
  marketQualityScore: document.getElementById("marketQualityScore"),
  marketQualityStatus: document.getElementById("marketQualityStatus"),
  objectiveFitScore: document.getElementById("objectiveFitScore"),
  objectiveFitStatus: document.getElementById("objectiveFitStatus"),
  riskExposureScore: document.getElementById("riskExposureScore"),
  riskExposureStatus: document.getElementById("riskExposureStatus"),
  overallQualityScore: document.getElementById("overallQualityScore"),
  overallQualityStatus: document.getElementById("overallQualityStatus"),
  premiumQualityReading: document.getElementById("premiumQualityReading"),
  premiumQualityConfidence: document.getElementById("premiumQualityConfidence"),

  strategyNote: document.getElementById("strategyNote"),
  executionHint: document.getElementById("executionHint")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setDefaultExpiryDate();
  setupPremiumQualityUI();

  /*
    Attach UI listeners immediately.

    Important:
    the seasonality tabs are interface controls, not data controls.
    They must keep working even if one JSON file is missing, cached badly,
    or temporarily returns a 404. Humans call this "basic UX"; apparently
    we had to rediscover it through mild suffering.
  */
  attachListeners();

  try {
    const [assetRes, monthlyRes, historicalRes] = await Promise.all([
      fetch(DATA_PATHS.assets),
      fetch(DATA_PATHS.monthlyReturns),
      fetch(DATA_PATHS.historicalPrices)
    ]);

    if (!assetRes.ok || !monthlyRes.ok || !historicalRes.ok) {
      throw new Error("One or more core data files could not be loaded.");
    }

    assets = await assetRes.json();
    monthlyReturns = await monthlyRes.json();
    historicalData = await historicalRes.json();

    try {
      const seasonalityMatrixRes = await fetch(DATA_PATHS.seasonalityMatrix);

      if (seasonalityMatrixRes.ok) {
        seasonalityMatrix = await seasonalityMatrixRes.json();
      } else {
        console.warn("seasonality-matrix.json could not be loaded. Matrix and equity tabs will show fallback messages.");
        seasonalityMatrix = {};
      }
    } catch (matrixError) {
      console.warn("seasonality-matrix.json could not be parsed or fetched.", matrixError);
      seasonalityMatrix = {};
    }

    populateAssetSelect();
    updateAll();
    setSeasonalityTab("summary");
  } catch (error) {
    console.error(error);
    showDataError();
  }
}

function setDefaultExpiryDate() {
  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(today.getDate() + 35);

  if (els.expiryDate) {
    els.expiryDate.value = expiry.toISOString().slice(0, 10);
  }
}

function populateAssetSelect() {
  els.assetSelect.innerHTML = "";

  assets.forEach(asset => {
    const option = document.createElement("option");
    option.value = asset.ticker;
    option.textContent = `${asset.ticker} · ${asset.name}`;
    els.assetSelect.appendChild(option);
  });

  if (assets.some(asset => asset.ticker === "XLK")) {
    els.assetSelect.value = "XLK";
  }
}

function attachListeners() {
  const inputIds = [
    "assetSelect",
    "spotPrice",
    "strikePrice",
    "expiryDate",
    "daysToExpiry",
    "optionType",
    "impliedVol",
    "riskFreeRate",
    "dividendYield",
    "marketPremium",
    "scenarioSpot",
    "scenarioVol",
    "scenarioDaysLeft",
    "qualityObjective",
    "historicalVol",
    "ivRank",
    "optionDelta",
    "eventRisk",
    "qualityTargetPrice",
    "optionBid",
    "optionAsk",
    "openInterest",
    "optionVolume"
  ];

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", handleInputChange);
    el.addEventListener("change", handleInputChange);
  });

  els.expiryDate.addEventListener("change", updateDaysFromDate);
  els.daysToExpiry.addEventListener("input", updateDateFromDays);

  document.querySelectorAll("[data-seasonality-tab]").forEach(button => {
    button.addEventListener("click", () => {
      setSeasonalityTab(button.dataset.seasonalityTab);
    });
  });

  document.querySelectorAll("[data-matrix-range]").forEach(button => {
    button.addEventListener("click", () => {
      setMatrixRange(button.dataset.matrixRange);
    });
  });

  window.addEventListener("resize", debounce(() => {
    updateProbabilityEngine();
    drawSeasonalityEquityCurve(els.assetSelect.value);
  }, 120));
}

function handleInputChange(event) {
  const targetId = event.target.id;

  if (targetId === "assetSelect") {
    applySelectedAssetDefaults();
    resetPremiumInputsForNewContract();
  } else if (targetId === "optionType") {
    syncObjectiveWithOptionType();
    premiumManualOverrides.delete("optionDelta");
  } else if (PREMIUM_AUTO_FIELDS.has(targetId)) {
    premiumManualOverrides.add(targetId);
  }

  updatePremiumSourceBadges();
  updateAll();
}

function applySelectedAssetDefaults() {
  const asset = getSelectedAsset();
  if (!asset) return;

  const defaultSpot = getNumber(asset.defaultSpot, 0);
  const defaultIV = getNumber(asset.defaultIV, 20);

  els.spotPrice.value = defaultSpot.toFixed(2);
  els.impliedVol.value = defaultIV.toFixed(1);
  els.dividendYield.value = getNumber(asset.dividendYield, 0).toFixed(1);

  const suggestedStrike = defaultSpot * 0.94;
  els.strikePrice.value = suggestedStrike.toFixed(2);

  els.scenarioSpot.value = (defaultSpot * 0.96).toFixed(2);
  els.scenarioVol.value = (defaultIV + 5).toFixed(1);
}

function updateDaysFromDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(els.expiryDate.value);
  expiry.setHours(0, 0, 0, 0);

  const diffMs = expiry - today;
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  els.daysToExpiry.value = diffDays;
  updateAll();
}

function updateDateFromDays() {
  const dte = getNumber(els.daysToExpiry.value, 35);
  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(today.getDate() + dte);

  els.expiryDate.value = expiry.toISOString().slice(0, 10);
}

function updateAll() {
  updateMarketPulse();
  updateDistanceMetrics();
  renderSeasonality();
  updateProbabilityEngine();
  updateOptionModel();
  updatePremiumQualityRating();
  updateStrategyNote();
  updateExecutionHint();
}


function updateMarketPulse() {
  renderMarketPulseValue(els.marketPulseSPY, findAssetByTicker("SPY"));
  renderMarketPulseValue(els.marketPulseQQQ, findAssetByTicker("QQQ"));
  renderMarketPulseValue(els.marketPulseVIX, findAssetByTicker("VIX"));
}

function renderMarketPulseValue(targetEl, asset) {
  if (!targetEl) return;

  const change = asset ? getNumber(asset.dailyChange, NaN) : NaN;

  targetEl.classList.remove(
    "market-pulse-positive",
    "market-pulse-negative",
    "market-pulse-neutral"
  );

  if (!Number.isFinite(change)) {
    targetEl.textContent = "—";
    targetEl.classList.add("market-pulse-neutral");
    return;
  }

  const sign = change > 0 ? "+" : "";
  targetEl.textContent = `${sign}${change.toFixed(2)}%`;

  if (change > 0) {
    targetEl.classList.add("market-pulse-positive");
  } else if (change < 0) {
    targetEl.classList.add("market-pulse-negative");
  } else {
    targetEl.classList.add("market-pulse-neutral");
  }
}

function findAssetByTicker(ticker) {
  if (!Array.isArray(assets)) return null;
  return assets.find((asset) => String(asset.ticker).toUpperCase() === ticker.toUpperCase()) || null;
}

function updateDistanceMetrics() {
  const spot = getNumber(els.spotPrice.value);
  const strike = getNumber(els.strikePrice.value);

  if (!spot || !strike) {
    els.distanceToStrike.textContent = "—";
    return;
  }

  const distance = (strike / spot - 1) * 100;
  els.distanceToStrike.textContent = formatPct(distance);
}

function renderSeasonality() {
  const ticker = els.assetSelect.value;
  const rows = Array.isArray(monthlyReturns[ticker]) ? monthlyReturns[ticker] : [];

  updateSeasonalitySummary(rows);
  updateSeasonalityReading(ticker, rows);
  renderSeasonalityMatrix(ticker);
  drawSeasonalityEquityCurve(ticker);

  els.seasonalityTable.innerHTML = "";

  if (!rows.length) {
    els.seasonalityTable.innerHTML = `
      <tr>
        <td colspan="7">No monthly seasonality data is available for ${ticker}.</td>
      </tr>
    `;
    return;
  }

  rows.forEach(row => {
    const score = getSeasonalityScore(row.avgReturn, row.positivePct);
    const scoreClass = getScoreClass(score);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.month}</td>
      <td>${formatPct(row.avgReturn)}</td>
      <td>${formatPct(row.medianReturn)}</td>
      <td>${formatPct(row.positivePct)}</td>
      <td>${formatPct(row.bestReturn)}</td>
      <td>${formatPct(row.worstReturn)}</td>
      <td class="${scoreClass}">${score}</td>
    `;

    els.seasonalityTable.appendChild(tr);
  });
}

function updateSeasonalitySummary(rows) {
  if (!rows || !rows.length) {
    setText(els.bestSeasonalMonth, "—");
    setText(els.bestSeasonalStats, "—");
    setText(els.worstSeasonalMonth, "—");
    setText(els.worstSeasonalStats, "—");
    return;
  }

  const best = [...rows].sort((a, b) => b.avgReturn - a.avgReturn)[0];
  const worst = [...rows].sort((a, b) => a.avgReturn - b.avgReturn)[0];

  setText(els.bestSeasonalMonth, best.month);
  setText(
    els.bestSeasonalStats,
    `Avg ${formatPct(best.avgReturn)} · Positive ${formatPct(best.positivePct)} · Best ${formatPct(best.bestReturn)}`
  );

  setText(els.worstSeasonalMonth, worst.month);
  setText(
    els.worstSeasonalStats,
    `Avg ${formatPct(worst.avgReturn)} · Positive ${formatPct(worst.positivePct)} · Worst ${formatPct(worst.worstReturn)}`
  );
}

function updateSeasonalityReading(ticker, rows) {
  if (!els.seasonalityReading) return;

  if (!rows || !rows.length) {
    els.seasonalityReading.textContent =
      `${ticker} does not yet have monthly seasonality data. No proxy asset or synthetic neutral profile is being used.`;
    return;
  }

  const best = [...rows].sort((a, b) => b.avgReturn - a.avgReturn)[0];
  const worst = [...rows].sort((a, b) => a.avgReturn - b.avgReturn)[0];
  const positiveMonths = rows.filter(row => row.avgReturn > 0).length;
  const negativeMonths = rows.length - positiveMonths;

  const quality = positiveMonths >= 9
    ? "broadly constructive"
    : positiveMonths >= 7
      ? "selectively constructive"
      : "mixed";

  els.seasonalityReading.textContent =
    `${ticker} has a ${quality} seasonal profile in this sample: ${positiveMonths} positive-average months and ${negativeMonths} negative-average months. ${best.month} is the strongest historical month by average return, while ${worst.month} is the weakest. Use this as context, not as a trading signal; seasonality is a tailwind or headwind, not a prophecy carved into stone by market gods.`;
}

function setSeasonalityTab(tabName) {
  document.querySelectorAll("[data-seasonality-tab]").forEach(button => {
    const isActive = button.dataset.seasonalityTab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-seasonality-panel]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.seasonalityPanel === tabName);
  });

  if (tabName === "equity") {
    drawSeasonalityEquityCurve(els.assetSelect.value);
  }
}

function setMatrixRange(rangeName) {
  activeMatrixRange = rangeName === "5Y" ? "5Y" : "10Y";

  document.querySelectorAll("[data-matrix-range]").forEach(button => {
    button.classList.toggle("active", button.dataset.matrixRange === activeMatrixRange);
  });

  renderSeasonalityMatrix(els.assetSelect.value);
}

function renderSeasonalityMatrix(ticker) {
  if (!els.seasonalityMatrixBody) return;

  const payload = seasonalityMatrix[ticker];

  if (!payload) {
    els.seasonalityMatrixBody.innerHTML = `
      <tr>
        <td colspan="14">No year-by-year seasonality matrix is available for ${ticker}.</td>
      </tr>
    `;
    return;
  }

  const rows = activeMatrixRange === "5Y" ? payload.matrix5Y : payload.matrix10Y;
  const average = activeMatrixRange === "5Y" ? payload.average5Y : payload.average10Y;
  const empirical = activeMatrixRange === "5Y" ? payload.empirical5Y : payload.empirical10Y;

  if (!rows || !rows.length) {
    els.seasonalityMatrixBody.innerHTML = `
      <tr>
        <td colspan="14">No ${activeMatrixRange} matrix data is available for ${ticker}.</td>
      </tr>
    `;
    return;
  }

  const bodyRows = rows.map(row => {
    const monthCells = MONTHS.map(month => {
      const value = row[month];
      return `<td class="${getMatrixCellClass(value)}">${formatPct(value)}</td>`;
    }).join("");

    return `
      <tr>
        <td>${row.year}</td>
        ${monthCells}
        <td class="${getMatrixCellClass(row.sum)}">${formatPct(row.sum)}</td>
      </tr>
    `;
  }).join("");

  const averageRow = `
    <tr class="matrix-summary-row">
      <td>Average</td>
      ${MONTHS.map(month => `<td class="${getMatrixCellClass(average ? average[month] : null)}">${formatPct(average ? average[month] : null)}</td>`).join("")}
      <td>—</td>
    </tr>
  `;

  const empiricalRow = `
    <tr class="matrix-summary-row">
      <td>Empirical %</td>
      ${MONTHS.map(month => `<td>${formatPct(empirical ? empirical[month] : null)}</td>`).join("")}
      <td>—</td>
    </tr>
  `;

  els.seasonalityMatrixBody.innerHTML = bodyRows + averageRow + empiricalRow;
}

function drawSeasonalityEquityCurve(ticker) {
  const canvas = els.seasonalityEquityChart;
  if (!canvas) return;

  const payload = seasonalityMatrix[ticker];
  const curve = payload && payload.equityCurve ? payload.equityCurve : [];

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const cssWidth = Math.max(320, rect.width || 960);
  const cssHeight = 340;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = cssWidth;
  const height = cssHeight;

  ctx.clearRect(0, 0, width, height);

  const paddingLeft = 58;
  const paddingRight = 28;
  const paddingTop = 34;
  const paddingBottom = 44;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (!curve.length) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Inter, system-ui, sans-serif";
    ctx.fillText(`No equity curve data is available for ${ticker}.`, paddingLeft, paddingTop + 20);
    return;
  }

  const values = curve.map(point => Number(point.value)).filter(Number.isFinite);
  const years = curve.map(point => point.year);

  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);

  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  }

  const rangePadding = (maxValue - minValue) * 0.12;
  minValue -= rangePadding;
  maxValue += rangePadding;

  function xForIndex(index) {
    if (curve.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (curve.length - 1)) * chartWidth;
  }

  function yForValue(value) {
    return paddingTop + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
  }

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (i / 4) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartWidth, y);
    ctx.stroke();

    const value = maxValue - (i / 4) * (maxValue - minValue);
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${value.toFixed(0)}%`, paddingLeft - 8, y);
  }

  const zeroY = yForValue(0);
  if (zeroY >= paddingTop && zeroY <= paddingTop + chartHeight) {
    ctx.beginPath();
    ctx.moveTo(paddingLeft, zeroY);
    ctx.lineTo(paddingLeft + chartWidth, zeroY);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.beginPath();
  curve.forEach((point, index) => {
    const x = xForIndex(index);
    const y = yForValue(Number(point.value));

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#10233f";
  ctx.lineWidth = 2.6;
  ctx.stroke();

  curve.forEach((point, index) => {
    const x = xForIndex(index);
    const y = yForValue(Number(point.value));

    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#c9a227";
    ctx.fill();
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  curve.forEach((point, index) => {
    const shouldLabel = curve.length <= 8 || index === 0 || index === curve.length - 1 || index % 2 === 0;
    if (!shouldLabel) return;

    ctx.fillText(String(years[index]), xForIndex(index), paddingTop + chartHeight + 12);
  });

  ctx.fillStyle = "#111827";
  ctx.font = "13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${ticker} cumulative seasonal path`, paddingLeft, 10);
}

function getMatrixCellClass(value) {
  if (!Number.isFinite(value)) return "matrix-neutral";
  if (value > 0) return "matrix-positive";
  if (value < 0) return "matrix-negative";
  return "matrix-neutral";
}


function updateProbabilityEngine() {
  const ticker = els.assetSelect.value;
  const spot = getNumber(els.spotPrice.value);
  const strike = getNumber(els.strikePrice.value);
  const dte = Math.max(1, Math.round(getNumber(els.daysToExpiry.value, 35)));

  if (!spot || !strike) {
    latestProbabilityState = null;
    resetProbabilityOutputs();
    clearProbabilityBellCurve();
    setText(els.probabilityReading, "Enter a valid spot, strike and expiration window to read the distribution.");
    return;
  }

  const requiredReturn = (strike / spot - 1) * 100;
  const distanceToStrike = requiredReturn;
  const nearestWindow = getNearestWindow(dte);
  const returns = getForwardReturns(ticker, nearestWindow);
  const realizedVol = getRealizedVol(ticker, nearestWindow);
  const impliedVol = getNumber(els.impliedVol.value, 0);
  const modelVol = realizedVol || impliedVol || null;
  const volatilitySource = realizedVol
    ? "historical"
    : impliedVol
      ? "implied"
      : "unavailable";
  const expectedMove = calculateExpectedMove(spot, modelVol, dte);

  if (!returns.length) {
    latestProbabilityState = {
      ticker,
      spot,
      strike,
      dte,
      nearestWindow,
      requiredReturn,
      distanceToStrike,
      realizedVol,
      impliedVol,
      modelVol,
      volatilitySource,
      expectedMove,
      probAbove: null,
      probBelow: null,
      p5: null,
      p1: null,
      worst: null,
      probabilityTouch: null
    };

    resetProbabilityOutputs();
    els.requiredReturn.textContent = formatPct(requiredReturn);
    els.expectedMove.textContent = expectedMove ? `± ${formatMoney(expectedMove)}` : "—";

    if (modelVol) {
      drawProbabilityBellCurve({ spot, strike, dte, volatilityPct: modelVol });
    } else {
      clearProbabilityBellCurve();
    }

    updateProbabilityReading();
    return;
  }

  const aboveCount = returns.filter(r => r >= requiredReturn).length;
  const belowCount = returns.length - aboveCount;

  const probAbove = (aboveCount / returns.length) * 100;
  const probBelow = (belowCount / returns.length) * 100;

  const p5 = percentile(returns, 5);
  const p1 = percentile(returns, 1);
  const worst = Math.min(...returns);
  const probabilityTouch = estimateProbabilityOfTouch(probBelow);

  els.requiredReturn.textContent = formatPct(requiredReturn);
  els.probAbove.textContent = formatPct(probAbove);
  els.probBelow.textContent = formatPct(probBelow);
  els.p5Move.textContent = formatPct(p5);
  els.p1Move.textContent = formatPct(p1);
  els.worstMove.textContent = formatPct(worst);
  els.expectedMove.textContent = expectedMove ? `± ${formatMoney(expectedMove)}` : "—";
  els.probTouch.textContent = formatPct(probabilityTouch);

  latestProbabilityState = {
    ticker,
    spot,
    strike,
    dte,
    nearestWindow,
    returns,
    requiredReturn,
    distanceToStrike,
    realizedVol,
    impliedVol,
    modelVol,
    volatilitySource,
    expectedMove,
    probAbove,
    probBelow,
    p5,
    p1,
    worst,
    probabilityTouch
  };

  drawProbabilityBellCurve({
    spot,
    strike,
    dte,
    volatilityPct: modelVol,
    requiredReturn,
    returns
  });

  updateProbabilityReading();
}

function updateProbabilityReading() {
  if (!els.probabilityReading) return;

  const state = latestProbabilityState;

  if (!state) {
    els.probabilityReading.textContent =
      "Enter a valid spot, strike and expiration window to read the distribution.";
    return;
  }

  if (state.probAbove === null || state.probBelow === null) {
    if (state.volatilitySource === "implied") {
      els.probabilityReading.textContent =
        `${state.ticker} does not yet have historical forward-return observations for the selected window. Historical probability is unavailable. The bell curve and expected move use the manually entered implied volatility only; no proxy asset is being substituted.`;
    } else if (state.volatilitySource === "historical") {
      els.probabilityReading.textContent =
        `${state.ticker} has a realised-volatility estimate but no historical forward-return observations for this window. The bell curve is available, while historical finish-above and finish-below probabilities remain unavailable.`;
    } else {
      els.probabilityReading.textContent =
        `${state.ticker} has no historical forward-return or volatility data for this window. Enter implied volatility to generate a model-based expected move.`;
    }
    return;
  }

  const optionType = els.optionType.value;
  const isStrikeBelowSpot = state.strike < state.spot;
  const distanceAbs = Math.abs(state.distanceToStrike);
  const tailBuffer = state.p5 !== null ? state.p5 - state.requiredReturn : null;

  let posture;
  if (distanceAbs >= 8) posture = "wide";
  else if (distanceAbs >= 4) posture = "moderate";
  else posture = "tight";

  if (optionType === "put") {
    const riskPhrase = state.probBelow <= 20
      ? "historical finish-below risk is low in this sample"
      : state.probBelow <= 35
        ? "historical finish-below risk is moderate"
        : "historical finish-below risk is elevated";

    const bufferPhrase = tailBuffer !== null && tailBuffer < 0
      ? "the 5th-percentile move is deeper than the strike threshold, so tail risk still matters"
      : "the 5th-percentile move remains above the strike threshold, which improves the statistical cushion";

    els.probabilityReading.textContent =
      `For a cash-secured put, this is a ${posture}-distance strike ${isStrikeBelowSpot ? "below" : "near/above"} spot. ${riskPhrase}: ${formatPct(state.probBelow)} below strike versus ${formatPct(state.probAbove)} above strike across the nearest ${state.nearestWindow}-day historical window. The expected-move model uses ${state.modelVol.toFixed(1)}% ${state.volatilitySource === "historical" ? "realised" : "implied"} volatility, and ${bufferPhrase}.`;
  } else {
    const callPhrase = state.probAbove <= 25
      ? "assignment risk appears contained in this sample"
      : state.probAbove <= 40
        ? "assignment risk is moderate"
        : "assignment risk is high";

    els.probabilityReading.textContent =
      `For a covered call, this is a ${posture}-distance strike ${state.strike > state.spot ? "above" : "at/below"} spot. ${callPhrase}: the historical probability of finishing above strike is ${formatPct(state.probAbove)} over the nearest ${state.nearestWindow}-day window. This is useful only if the strike matches a price where you are genuinely willing to sell.`;
  }
}

function drawProbabilityBellCurve({ spot, strike, dte, volatilityPct }) {
  const canvas = els.probabilityBellChart;
  if (!canvas || !spot || !strike || !dte || !volatilityPct) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const cssWidth = Math.max(320, rect.width || 720);
  const cssHeight = 320;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = cssWidth;
  const height = cssHeight;

  ctx.clearRect(0, 0, width, height);

  const paddingLeft = 44;
  const paddingRight = 28;
  const paddingTop = 38;
  const paddingBottom = 36;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const sigmaPrice = spot * (volatilityPct / 100) * Math.sqrt(dte / 252);

  if (!Number.isFinite(sigmaPrice) || sigmaPrice <= 0) return;

  const minPrice = Math.max(0.01, spot - sigmaPrice * 2.85);
  const maxPrice = spot + sigmaPrice * 2.85;

  function normalPdf(x, mean, sd) {
    return Math.exp(-0.5 * Math.pow((x - mean) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI));
  }

  function xForPrice(price) {
    return paddingLeft + ((price - minPrice) / (maxPrice - minPrice)) * chartWidth;
  }

  function yForPdf(pdf, maxPdf) {
    return paddingTop + chartHeight - (pdf / maxPdf) * chartHeight;
  }

  const maxPdf = normalPdf(spot, spot, sigmaPrice);
  const baselineY = paddingTop + chartHeight;
  const strikeX = clamp(xForPrice(strike), paddingLeft, paddingLeft + chartWidth);
  const spotX = clamp(xForPrice(spot), paddingLeft, paddingLeft + chartWidth);

  ctx.beginPath();
  ctx.moveTo(paddingLeft, baselineY);
  ctx.lineTo(paddingLeft + chartWidth, baselineY);
  ctx.strokeStyle = "#d8dee8";
  ctx.lineWidth = 1;
  ctx.stroke();

  const shadeLeft = strike < spot;
  const shadeStart = shadeLeft ? paddingLeft : strikeX;
  const shadeEnd = shadeLeft ? strikeX : paddingLeft + chartWidth;

  ctx.beginPath();
  ctx.moveTo(shadeStart, baselineY);

  const startI = Math.max(0, Math.floor(shadeStart - paddingLeft));
  const endI = Math.min(chartWidth, Math.ceil(shadeEnd - paddingLeft));

  for (let i = startI; i <= endI; i++) {
    const price = minPrice + (i / chartWidth) * (maxPrice - minPrice);
    const pdf = normalPdf(price, spot, sigmaPrice);
    const x = paddingLeft + i;
    const y = yForPdf(pdf, maxPdf);
    ctx.lineTo(x, y);
  }

  ctx.lineTo(shadeEnd, baselineY);
  ctx.closePath();
  ctx.fillStyle = "rgba(201, 162, 39, 0.15)";
  ctx.fill();

  ctx.beginPath();

  for (let i = 0; i <= chartWidth; i++) {
    const price = minPrice + (i / chartWidth) * (maxPrice - minPrice);
    const pdf = normalPdf(price, spot, sigmaPrice);
    const x = paddingLeft + i;
    const y = yForPdf(pdf, maxPdf);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#10233f";
  ctx.stroke();

  drawVerticalMarker(ctx, spotX, paddingTop, baselineY, "#6b7280", 1.5);
  drawVerticalMarker(ctx, strikeX, paddingTop, baselineY, "#c9a227", 2.2);

  ctx.fillStyle = "#111827";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textBaseline = "top";

  const spotLabelX = clamp(spotX + 7, paddingLeft, width - 104);
  const strikeLabelX = clamp(strikeX + 7, paddingLeft, width - 116);

  ctx.fillText(`Spot ${spot.toFixed(2)}`, spotLabelX, paddingTop + 4);
  ctx.fillText(`Strike ${strike.toFixed(2)}`, strikeLabelX, paddingTop + 23);

  ctx.fillStyle = "#6b7280";
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(minPrice.toFixed(0), paddingLeft, height - 10);
  ctx.fillText(spot.toFixed(0), clamp(spotX - 12, paddingLeft, width - 44), height - 10);
  ctx.fillText(maxPrice.toFixed(0), width - paddingRight - 36, height - 10);

  ctx.fillStyle = "#6b7280";
  ctx.textBaseline = "top";
  ctx.fillText(
    `Distribution uses ${volatilityPct.toFixed(1)}% realised vol over ${dte} days`,
    paddingLeft,
    14
  );
}

function drawVerticalMarker(ctx, x, topY, bottomY, color, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x, bottomY);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function clearProbabilityBellCurve() {
  const canvas = els.probabilityBellChart;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateOptionModel() {
  const spot = getNumber(els.spotPrice.value);
  const strike = getNumber(els.strikePrice.value);
  const dte = Math.max(1, getNumber(els.daysToExpiry.value, 35));
  const optionType = els.optionType.value;

  const iv = getNumber(els.impliedVol.value, 20) / 100;
  const rate = getNumber(els.riskFreeRate.value, 4.5) / 100;
  const dividendYield = getNumber(els.dividendYield.value, 0) / 100;

  const marketPremium = getNumber(els.marketPremium.value, 0);

  const scenarioSpot = getNumber(els.scenarioSpot.value, spot);
  const scenarioVol = getNumber(els.scenarioVol.value, iv * 100) / 100;
  const scenarioDaysLeft = Math.max(1, getNumber(els.scenarioDaysLeft.value, Math.max(1, dte - 10)));

  if (!spot || !strike || !iv) {
    latestPremiumState = null;
    els.theoreticalPremium.textContent = "—";
    els.scenarioPremium.textContent = "—";
    els.shortOptionPL.textContent = "—";
    setText(els.premiumReading, "Enter valid option assumptions to compare market premium, model value and scenario risk.");
    return;
  }

  const theoretical = blackScholes({
    optionType,
    spot,
    strike,
    daysToExpiry: dte,
    volatility: iv,
    riskFreeRate: rate,
    dividendYield
  });

  const scenario = blackScholes({
    optionType,
    spot: scenarioSpot,
    strike,
    daysToExpiry: scenarioDaysLeft,
    volatility: scenarioVol,
    riskFreeRate: rate,
    dividendYield
  });

  const shortPL = marketPremium - scenario.price;
  const richness = theoretical.price > 0
    ? ((marketPremium / theoretical.price) - 1) * 100
    : null;

  els.theoreticalPremium.textContent = formatMoney(theoretical.price);
  els.scenarioPremium.textContent = formatMoney(scenario.price);
  els.shortOptionPL.textContent = formatMoney(shortPL);

  els.shortOptionPL.style.color = shortPL >= 0 ? "#166534" : "#991b1b";

  latestPremiumState = {
    optionType,
    spot,
    strike,
    dte,
    iv: iv * 100,
    marketPremium,
    theoreticalPremium: theoretical.price,
    scenarioSpot,
    scenarioVol: scenarioVol * 100,
    scenarioDaysLeft,
    scenarioPremium: scenario.price,
    shortPL,
    richness,
    delta: theoretical.delta
  };

  updatePremiumReading();
}

function updatePremiumReading() {
  if (!els.premiumReading) return;

  const state = latestPremiumState;

  if (!state) {
    els.premiumReading.textContent =
      "Enter valid option assumptions to compare market premium, model value and scenario risk.";
    return;
  }

  let valuePhrase;
  if (state.richness === null) {
    valuePhrase = "the theoretical comparison is unavailable";
  } else if (state.richness >= 20) {
    valuePhrase = `the market premium appears rich versus this simplified model by ${formatPct(state.richness)}`;
  } else if (state.richness <= -20) {
    valuePhrase = `the market premium appears cheap versus this simplified model by ${formatPct(state.richness)}`;
  } else {
    valuePhrase = `the market premium is close to this simplified model value, with a difference of ${formatPct(state.richness)}`;
  }

  const pnlPhrase = state.shortPL >= 0
    ? `The scenario still leaves an estimated short-option gain of ${formatMoney(state.shortPL)}.`
    : `The scenario produces an estimated short-option loss of ${formatMoney(state.shortPL)}, mainly because price movement, IV change, or remaining time keeps the option expensive.`;

  els.premiumReading.textContent =
    `For this ${state.optionType}, ${valuePhrase}. The scenario reprices the contract at ${formatMoney(state.scenarioPremium)} with ${state.scenarioDaysLeft} days left and ${state.scenarioVol.toFixed(1)}% IV. ${pnlPhrase} This is a simplified pricing lens, not a brokerage quote from Mount Olympus.`;
}

function updateStrategyNote() {
  const ticker = els.assetSelect.value;
  const asset = getSelectedAsset();
  const spot = getNumber(els.spotPrice.value);
  const strike = getNumber(els.strikePrice.value);
  const dte = Math.max(1, getNumber(els.daysToExpiry.value, 35));
  const optionType = els.optionType.value;

  if (!spot || !strike || !asset) {
    els.strategyNote.textContent =
      "Enter asset, strike, duration and volatility assumptions to generate a probability-supported strategy context.";
    return;
  }

  const distance = (strike / spot - 1) * 100;
  const nearestWindow = getNearestWindow(dte);
  const returns = getForwardReturns(ticker, nearestWindow);

  if (!returns.length) {
    els.strategyNote.textContent =
      `${ticker} has no forward-return data loaded yet. Add historical data for this asset before using the probability engine seriously.`;
    els.strategyNote.dataset.tone = "cautious";
    return;
  }

  const requiredReturn = distance;
  const probAbove = returns.filter(r => r >= requiredReturn).length / returns.length * 100;
  const probBelow = 100 - probAbove;
  const p5 = percentile(returns, 5);

  let tone = "neutral";
  let message = "";

  if (optionType === "put") {
    if (probAbove >= 75 && requiredReturn < 0 && p5 < requiredReturn) {
      tone = "constructive";
      message = `${ticker} shows a constructive put-writing profile at this strike. The strike is below spot, historical probability above strike is strong, and the selected window appears statistically manageable. Premium quality still matters: a good probability setup can become mediocre if the market premium is too thin.`;
    } else if (probAbove >= 65 && requiredReturn < 0) {
      tone = "moderate";
      message = `${ticker} shows a moderate put-writing setup. The strike is below spot and historical probability is acceptable, but downside-tail risk should be checked before sizing aggressively.`;
    } else {
      tone = "cautious";
      message = `${ticker} does not show a clean put-writing setup at this strike and duration. Either the strike is too close, the historical probability is weak, or the downside window is not attractive enough. Waiting is also a strategy, despite humanity’s heroic resistance to patience.`;
    }
  } else {
    if (probBelow >= 65 && requiredReturn > 0) {
      tone = "constructive";
      message = `${ticker} shows a constructive covered-call context at this strike. The strike is above spot and historical probability of remaining below it appears reasonable. The trade-off is clear: you receive income, but you also define the price where upside stops belonging to you.`;
    } else if (requiredReturn > 0) {
      tone = "moderate";
      message = `${ticker} shows a moderate covered-call setup. The strike is above spot, but probability and upside trade-off should be reviewed against your exit objective.`;
    } else {
      tone = "cautious";
      message = `${ticker} call strike is not above spot. For covered calls, this is an aggressive income structure and may behave more like a planned exit than a passive yield trade.`;
    }
  }

  els.strategyNote.textContent = message;
  els.strategyNote.dataset.tone = tone;
}

function updateExecutionHint() {
  if (!els.executionHint) return;

  const asset = getSelectedAsset();
  const optionType = els.optionType.value;
  const state = latestProbabilityState;
  const premiumState = latestPremiumState;

  if (!asset || !state) {
    els.executionHint.textContent =
      "Check liquidity, bid-ask spread and position sizing before treating any probability reading as actionable.";
    return;
  }

  const liquidity = asset.optionLiquidity || "Unknown";
  const strategy = optionType === "put" ? "cash-secured put" : "covered call";

  let hint = `${asset.ticker} option liquidity is classified as ${liquidity}. Before using this as a ${strategy} candidate, confirm live bid-ask spread, open interest, volume and assignment exposure.`;

  if (state.probBelow !== null && optionType === "put" && state.probBelow > 35) {
    hint += " The finish-below probability is not trivial, so sizing should assume assignment can actually happen, because apparently contracts are real obligations.";
  }

  if (premiumState && premiumState.shortPL < 0) {
    hint += " The scenario engine also shows negative short-option P/L, which means the trade is sensitive to adverse spot movement, volatility expansion or insufficient time decay.";
  }

  els.executionHint.textContent = hint;
}

function getSelectedAsset() {
  return assets.find(asset => asset.ticker === els.assetSelect.value);
}

function getForwardReturns(ticker, window) {
  const directValues = historicalData?.[ticker]?.forwardReturns?.[String(window)];

  if (Array.isArray(directValues) && directValues.length) {
    return directValues.filter(value => Number.isFinite(Number(value))).map(Number);
  }

  return buildMatrixForwardReturns(ticker, window);
}

function buildMatrixForwardReturns(ticker, window) {
  const matrixRows = seasonalityMatrix?.[ticker]?.matrix10Y;

  if (!Array.isArray(matrixRows) || !matrixRows.length) {
    return [];
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  /*
    The matrix stores unavailable months as zero. Treat zero as missing
    rather than as a genuine flat month, otherwise young listings and the
    unfinished current year would manufacture false observations.
  */
  const monthlyByIndex = new Map();

  matrixRows.forEach(row => {
    const year = Number(row?.year);
    if (!Number.isFinite(year)) return;

    monthNames.forEach((monthName, monthIndex) => {
      const monthlyReturn = Number(row?.[monthName]);

      if (!Number.isFinite(monthlyReturn) || monthlyReturn === 0) {
        return;
      }

      monthlyByIndex.set(year * 12 + monthIndex, monthlyReturn);
    });
  });

  if (!monthlyByIndex.size) {
    return [];
  }

  const durationMonths = Math.max(0.1, Number(window) / 30);
  const fullMonths = Math.floor(durationMonths);
  const fractionalMonth = durationMonths - fullMonths;

  const monthIndexes = [...monthlyByIndex.keys()].sort((a, b) => a - b);
  const firstIndex = monthIndexes[0];
  const lastIndex = monthIndexes[monthIndexes.length - 1];

  const estimatedReturns = [];

  for (let startIndex = firstIndex; startIndex <= lastIndex; startIndex += 1) {
    let growthFactor = 1;
    let validObservation = true;

    for (let offset = 0; offset < fullMonths; offset += 1) {
      const monthlyReturn = monthlyByIndex.get(startIndex + offset);

      if (!Number.isFinite(monthlyReturn) || 1 + monthlyReturn / 100 <= 0) {
        validObservation = false;
        break;
      }

      growthFactor *= 1 + monthlyReturn / 100;
    }

    if (validObservation && fractionalMonth > 0.0001) {
      const partialMonthReturn = monthlyByIndex.get(startIndex + fullMonths);

      if (!Number.isFinite(partialMonthReturn) || 1 + partialMonthReturn / 100 <= 0) {
        validObservation = false;
      } else {
        growthFactor *= Math.pow(1 + partialMonthReturn / 100, fractionalMonth);
      }
    }

    if (!validObservation) {
      continue;
    }

    const estimatedReturn = (growthFactor - 1) * 100;

    if (Number.isFinite(estimatedReturn)) {
      estimatedReturns.push(estimatedReturn);
    }
  }

  return estimatedReturns;
}

function getRealizedVol(ticker, window) {
  const data = historicalData[ticker];
  const value = Number(data?.realizedVol?.[String(window)]);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function getNearestWindow(dte) {
  const windows = [21, 30, 45, 60, 90];

  return windows.reduce((nearest, current) => {
    return Math.abs(current - dte) < Math.abs(nearest - dte) ? current : nearest;
  }, windows[0]);
}

function calculateExpectedMove(spot, annualVolPct, dte) {
  if (!spot || !annualVolPct || !dte) return null;

  const annualVol = annualVolPct / 100;
  return spot * annualVol * Math.sqrt(dte / 252);
}

function estimateProbabilityOfTouch(probBelowAtExpiry) {
  if (probBelowAtExpiry === null || Number.isNaN(probBelowAtExpiry)) return null;
  return Math.min(95, probBelowAtExpiry * 1.85);
}

function resetProbabilityOutputs() {
  els.requiredReturn.textContent = "—";
  els.probAbove.textContent = "—";
  els.probBelow.textContent = "—";
  els.p5Move.textContent = "—";
  els.p1Move.textContent = "—";
  els.worstMove.textContent = "—";
  els.expectedMove.textContent = "—";
  els.probTouch.textContent = "—";
}

function getSeasonalityScore(avgReturn, positivePct) {
  if (avgReturn >= 2 && positivePct >= 70) return "Positive";
  if (avgReturn <= -0.5 || positivePct < 45) return "Negative";
  return "Neutral";
}

function getScoreClass(score) {
  if (score === "Positive") return "score-positive";
  if (score === "Negative") return "score-negative";
  return "score-neutral";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];


/* Black-Scholes simplified model */

function blackScholes({
  optionType,
  spot,
  strike,
  daysToExpiry,
  volatility,
  riskFreeRate,
  dividendYield
}) {
  const T = Math.max(daysToExpiry, 1) / 365;
  const sigma = Math.max(volatility, 0.0001);
  const r = riskFreeRate || 0;
  const q = dividendYield || 0;

  const sqrtT = Math.sqrt(T);

  const d1 =
    (Math.log(spot / strike) + (r - q + 0.5 * sigma * sigma) * T) /
    (sigma * sqrtT);

  const d2 = d1 - sigma * sqrtT;

  let price;

  if (optionType === "call") {
    price =
      spot * Math.exp(-q * T) * normalCDF(d1) -
      strike * Math.exp(-r * T) * normalCDF(d2);
  } else {
    price =
      strike * Math.exp(-r * T) * normalCDF(-d2) -
      spot * Math.exp(-q * T) * normalCDF(-d1);
  }

  return {
    price: Math.max(0, price),
    d1,
    d2,
    delta: optionType === "call" ? normalCDF(d1) : normalCDF(d1) - 1
  };
}

function normalCDF(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const t = 1 / (1 + 0.3275911 * absX);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const erf =
    1 -
    (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);

  return 0.5 * (1 + sign * erf);
}


/* =========================================================
   Premium Quality Rating integration
   ========================================================= */

function setupPremiumQualityUI() {
  if (!els.premiumQualitySection) return;

  syncObjectiveWithOptionType();

  const sourceFields = [
    "historicalVol",
    "ivRank",
    "optionDelta",
    "eventRisk",
    "qualityTargetPrice",
    "optionBid",
    "optionAsk",
    "openInterest",
    "optionVolume"
  ];

  sourceFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    const parent = field?.closest(".control-block");
    if (!field || !parent || parent.querySelector(`[data-quality-source-for="${fieldId}"]`)) return;

    const source = document.createElement("small");
    source.dataset.qualitySourceFor = fieldId;
    source.textContent = "Source: Unavailable";
    source.style.display = "block";
    source.style.marginTop = "6px";
    source.style.color = "#64748b";
    source.style.fontSize = "0.72rem";
    source.style.fontWeight = "700";
    source.style.letterSpacing = "0.01em";
    parent.appendChild(source);
  });

  const controls = els.premiumQualitySection.querySelector(".premium-quality-controls");
  if (controls && !document.getElementById("restorePremiumAutoData")) {
    const resetBlock = document.createElement("div");
    resetBlock.className = "control-block";

    const label = document.createElement("label");
    label.setAttribute("for", "restorePremiumAutoData");
    label.textContent = "Automatic Data";

    const button = document.createElement("button");
    button.id = "restorePremiumAutoData";
    button.type = "button";
    button.textContent = "Restore automatic data";
    button.style.width = "100%";
    button.style.padding = "10px 12px";
    button.style.border = "1px solid #c9a227";
    button.style.borderRadius = "10px";
    button.style.background = "#fffaf0";
    button.style.color = "#10233f";
    button.style.fontWeight = "800";

    button.addEventListener("click", () => {
      PREMIUM_AUTO_FIELDS.forEach(fieldId => premiumManualOverrides.delete(fieldId));
      fillPremiumAutomaticFields();
      updatePremiumSourceBadges();
      updatePremiumQualityRating();
    });

    resetBlock.appendChild(label);
    resetBlock.appendChild(button);
    controls.appendChild(resetBlock);
  }

  updatePremiumSourceBadges();
}

function resetPremiumInputsForNewContract() {
  premiumManualOverrides.clear();

  [
    els.ivRank,
    els.eventRisk,
    els.qualityTargetPrice,
    els.optionBid,
    els.optionAsk,
    els.openInterest,
    els.optionVolume
  ].forEach(field => {
    if (field) field.value = "";
  });

  syncObjectiveWithOptionType();
}

function syncObjectiveWithOptionType() {
  if (!els.qualityObjective || !els.optionType) return;

  const optionType = els.optionType.value;
  const callObjectives = new Set([
    "keep_shares",
    "balanced_income",
    "exit_at_target",
    "maximize_income"
  ]);
  const putObjectives = new Set([
    "avoid_assignment",
    "acquire_at_discount",
    "start_wheel",
    "maximize_yield",
    "aggressive_entry"
  ]);

  const allowed = optionType === "call" ? callObjectives : putObjectives;

  Array.from(els.qualityObjective.options).forEach(option => {
    option.disabled = !allowed.has(option.value);
  });

  if (!allowed.has(els.qualityObjective.value)) {
    els.qualityObjective.value = optionType === "call" ? "keep_shares" : "avoid_assignment";
  }
}

function fillPremiumAutomaticFields() {
  const autoHv = getAutomaticHistoricalVol();
  const autoDelta = getAutomaticOptionDelta();

  if (els.historicalVol && !premiumManualOverrides.has("historicalVol")) {
    els.historicalVol.value = Number.isFinite(autoHv.value) ? autoHv.value.toFixed(1) : "";
    els.historicalVol.dataset.autoSource = autoHv.source || "Unavailable";
  }

  if (els.optionDelta && !premiumManualOverrides.has("optionDelta")) {
    els.optionDelta.value = Number.isFinite(autoDelta.value) ? autoDelta.value.toFixed(3) : "";
    els.optionDelta.dataset.autoSource = autoDelta.source || "Unavailable";
  }
}

function getAutomaticHistoricalVol() {
  const ticker = els.assetSelect?.value;
  const dte = Math.max(1, getNumber(els.daysToExpiry?.value, 35));
  const nearestWindow = getNearestWindow(dte);
  const directVol = getRealizedVol(ticker, nearestWindow);

  if (Number.isFinite(directVol)) {
    return {
      value: directVol,
      source: `Auto · historical prices (${nearestWindow}D)`
    };
  }

  const matrixRows = seasonalityMatrix?.[ticker]?.matrix10Y;
  if (!Array.isArray(matrixRows)) {
    return { value: null, source: "Unavailable" };
  }

  const monthlyValues = [];
  matrixRows.forEach(row => {
    MONTHS.forEach(month => {
      const value = Number(row?.[month]);
      if (Number.isFinite(value) && value !== 0) monthlyValues.push(value);
    });
  });

  if (monthlyValues.length < 12) {
    return { value: null, source: "Unavailable" };
  }

  const mean = monthlyValues.reduce((sum, value) => sum + value, 0) / monthlyValues.length;
  const variance = monthlyValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, monthlyValues.length - 1);
  const annualizedVol = Math.sqrt(variance) * Math.sqrt(12);

  return Number.isFinite(annualizedVol) && annualizedVol > 0
    ? { value: annualizedVol, source: "Auto · seasonality estimate" }
    : { value: null, source: "Unavailable" };
}

function getAutomaticOptionDelta() {
  const spot = getNumber(els.spotPrice?.value, 0);
  const strike = getNumber(els.strikePrice?.value, 0);
  const dte = Math.max(1, getNumber(els.daysToExpiry?.value, 35));
  const iv = getNumber(els.impliedVol?.value, 0) / 100;
  const riskFreeRate = getNumber(els.riskFreeRate?.value, 0) / 100;
  const dividendYield = getNumber(els.dividendYield?.value, 0) / 100;
  const optionType = els.optionType?.value || "put";

  if (!spot || !strike || !iv) {
    return { value: null, source: "Unavailable" };
  }

  const model = blackScholes({
    optionType,
    spot,
    strike,
    daysToExpiry: dte,
    volatility: iv,
    riskFreeRate,
    dividendYield
  });

  return Number.isFinite(model.delta)
    ? { value: model.delta, source: "Auto · option model" }
    : { value: null, source: "Unavailable" };
}

function updatePremiumSourceBadges() {
  const manualOnlyFields = [
    "ivRank",
    "eventRisk",
    "qualityTargetPrice",
    "optionBid",
    "optionAsk",
    "openInterest",
    "optionVolume"
  ];

  PREMIUM_AUTO_FIELDS.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (!field) return;

    if (premiumManualOverrides.has(fieldId)) {
      setPremiumSourceBadge(
        fieldId,
        field.value.trim() ? "Manual" : "Unavailable · manual override"
      );
    } else {
      setPremiumSourceBadge(fieldId, field.dataset.autoSource || "Unavailable");
    }
  });

  manualOnlyFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    setPremiumSourceBadge(fieldId, field.value.trim() ? "Manual" : "Unavailable");
  });
}

function setPremiumSourceBadge(fieldId, sourceText) {
  const badge = document.querySelector(`[data-quality-source-for="${fieldId}"]`);
  if (!badge) return;

  badge.textContent = `Source: ${sourceText}`;

  if (sourceText.startsWith("Auto") || sourceText.startsWith("API")) {
    badge.style.color = "#166534";
  } else if (sourceText.startsWith("Manual")) {
    badge.style.color = "#9a6700";
  } else {
    badge.style.color = "#64748b";
  }
}

function updatePremiumQualityRating() {
  if (!els.premiumQualitySection) return;

  const engine = window.OptionsCraftedPremiumQuality;
  if (!engine || typeof engine.evaluate !== "function") {
    resetPremiumQualityOutputs("Premium Quality Engine is not loaded.");
    return;
  }

  fillPremiumAutomaticFields();
  updatePremiumSourceBadges();
  syncObjectiveWithOptionType();

  const optionType = els.optionType?.value || "put";
  const strategy = optionType === "call" ? "covered_call" : "cash_secured_put";
  const probabilityOTM = getProbabilityOTMForPremiumQuality(optionType);
  const assignmentProbability = getAssignmentProbabilityForPremiumQuality(optionType);

  const marketPremiumValue = getNullableNumber(els.marketPremium?.value);
  const bid = getNullableNumber(els.optionBid?.value);
  const ask = getNullableNumber(els.optionAsk?.value);
  const midpointPremium = bid !== null && ask !== null && ask >= bid ? (bid + ask) / 2 : null;
  const premium = marketPremiumValue !== null && marketPremiumValue > 0
    ? marketPremiumValue
    : midpointPremium;

  const targetValue = getNullableNumber(els.qualityTargetPrice?.value);

  const input = {
    strategy,
    objective: els.qualityObjective?.value || null,
    spot: getNullableNumber(els.spotPrice?.value),
    strike: getNullableNumber(els.strikePrice?.value),
    premium,
    dte: getNullableNumber(els.daysToExpiry?.value),
    iv: getNullableNumber(els.impliedVol?.value),
    hv: getNullableNumber(els.historicalVol?.value),
    ivRank: getNullableNumber(els.ivRank?.value),
    delta: getNullableNumber(els.optionDelta?.value),
    probabilityOTM,
    assignmentProbability,
    eventRisk: getNullableNumber(els.eventRisk?.value),
    bid,
    ask,
    openInterest: getNullableNumber(els.openInterest?.value),
    volume: getNullableNumber(els.optionVolume?.value),
    targetPrice: strategy === "covered_call" ? targetValue : null,
    desiredEntryPrice: strategy === "cash_secured_put" ? targetValue : null
  };

  const result = engine.evaluate(input);
  latestPremiumQualityState = result;
  renderPremiumQualityResult(result, input);
}

function getProbabilityOTMForPremiumQuality(optionType) {
  if (!latestProbabilityState) return null;
  return optionType === "call"
    ? latestProbabilityState.probBelow
    : latestProbabilityState.probAbove;
}

function getAssignmentProbabilityForPremiumQuality(optionType) {
  if (!latestProbabilityState) return null;
  return optionType === "call"
    ? latestProbabilityState.probAbove
    : latestProbabilityState.probBelow;
}

function renderPremiumQualityResult(result, input) {
  renderPremiumScore(
    els.marketQualityScore,
    els.marketQualityStatus,
    result.marketQuality,
    describeMarketQuality
  );

  renderPremiumScore(
    els.objectiveFitScore,
    els.objectiveFitStatus,
    result.objectiveFit,
    describeObjectiveFit
  );

  renderPremiumScore(
    els.riskExposureScore,
    els.riskExposureStatus,
    result.riskExposure,
    describeRiskExposure,
    true
  );

  renderPremiumScore(
    els.overallQualityScore,
    els.overallQualityStatus,
    result.overall,
    describeOverallQuality
  );

  const profileDescription = result.objectiveFit?.profile?.description ||
    "Select a supported objective for the current option type.";
  const strengths = translateQualityKeys(result.strengths);
  const weaknesses = translateQualityKeys(result.weaknesses);

  const readingParts = [profileDescription];
  if (strengths.length) readingParts.push(`Strengths: ${strengths.join(", ")}.`);
  if (weaknesses.length) readingParts.push(`Watch: ${weaknesses.join(", ")}.`);

  if (!strengths.length && !weaknesses.length) {
    readingParts.push("Add premium, volatility and execution inputs to make the diagnosis more specific.");
  }

  setText(els.premiumQualityReading, readingParts.join(" "));

  const confidence = calculateSourceAdjustedConfidence(result, input);
  const missing = describeMissingPremiumInputs(result.warnings);
  const sourceSummary = describePremiumSourceSummary();

  setText(
    els.premiumQualityConfidence,
    `Data confidence: ${Number.isFinite(confidence) ? confidence.toFixed(0) : 0}%. ${sourceSummary}${missing ? ` Missing or incomplete: ${missing}.` : ""}`
  );
}

function renderPremiumScore(scoreEl, statusEl, resultSection, descriptionFn, isRisk = false) {
  const score = resultSection?.score;
  const status = resultSection?.status || "insufficient_data";

  if (!Number.isFinite(score)) {
    setText(scoreEl, "—");
    setText(statusEl, descriptionFn("insufficient_data", null));
    if (scoreEl) scoreEl.style.color = "#2e4a8c";
    return;
  }

  setText(scoreEl, `${Math.round(score)}/100`);
  setText(statusEl, descriptionFn(status, score));

  if (!scoreEl) return;
  if (isRisk) {
    scoreEl.style.color = score < 25 ? "#166534" : score < 50 ? "#9a6700" : "#991b1b";
  } else {
    scoreEl.style.color = score >= 65 ? "#166534" : score >= 45 ? "#9a6700" : "#991b1b";
  }
}

function describeMarketQuality(status) {
  const messages = {
    strong: "Premium appears strongly compensated relative to volatility, probability and execution risk.",
    good: "Premium compensation is broadly attractive, with some inputs still worth checking.",
    mixed: "Premium compensation is mixed: the trade offers value, but not across all risk dimensions.",
    weak: "Premium appears insufficient for the measured volatility, probability or execution risk.",
    insufficient_data: "Add premium and volatility inputs to judge whether the market is paying enough."
  };
  return messages[status] || messages.insufficient_data;
}

function describeObjectiveFit(status) {
  const messages = {
    strong: "The selected contract is strongly aligned with the stated objective.",
    good: "The contract fits the objective reasonably well, with manageable compromises.",
    mixed: "The contract only partly fits the objective; assignment, distance or income may conflict.",
    weak: "The contract is poorly aligned with the stated objective.",
    objective_required: "Choose an objective compatible with the selected option type.",
    insufficient_data: "Add Delta, probability or target data to evaluate objective fit."
  };
  return messages[status] || messages.insufficient_data;
}

function describeRiskExposure(status) {
  const messages = {
    low: "Current measured exposure is low.",
    moderate: "Risk exposure is moderate and should be manageable with normal controls.",
    elevated: "Risk exposure is elevated, mainly through assignment, event, gamma or liquidity risk.",
    high: "Risk exposure is high and requires deliberate acceptance, not optimistic arithmetic.",
    insufficient_data: "Add Delta, event and execution inputs to measure the exposure."
  };
  return messages[status] || messages.insufficient_data;
}

function describeOverallQuality(status) {
  const messages = {
    strong: "Strong fit: market compensation and the selected objective are well aligned.",
    good: "Good fit: the trade is coherent, though not uniformly strong across every component.",
    mixed: "Mixed fit: useful for the stated purpose only if the highlighted compromises are accepted.",
    weak: "Weak fit: compensation or objective alignment does not justify the current exposure.",
    insufficient_data: "Waiting for enough market and objective data to produce an overall rating."
  };
  return messages[status] || messages.insufficient_data;
}

function translateQualityKeys(keys) {
  const labels = {
    volatilityEdge: "volatility edge",
    premiumEfficiency: "premium efficiency",
    probabilityQuality: "historical probability",
    strikeSafety: "strike safety",
    executionQuality: "execution quality",
    deltaFit: "Delta fit",
    assignmentFit: "assignment fit",
    distanceFit: "strike distance",
    incomeFit: "income yield",
    targetFit: "target alignment",
    assignmentRisk: "assignment risk",
    eventRisk: "event risk",
    directionalRisk: "directional exposure",
    gammaRisk: "short-DTE gamma risk",
    liquidityRisk: "liquidity risk",
    trendConflictRisk: "trend conflict",
    concentrationRisk: "position concentration"
  };

  return (keys || []).map(key => labels[key] || key);
}

function calculateSourceAdjustedConfidence(result, input) {
  const coverageScores = [
    result.marketQuality?.confidence,
    result.objectiveFit?.confidence,
    result.riskExposure?.confidence
  ].filter(Number.isFinite);

  const coverage = coverageScores.length
    ? coverageScores.reduce((sum, value) => sum + value, 0) / coverageScores.length
    : 0;

  const sourceValues = [];
  sourceValues.push(Number.isFinite(input.spot) ? 90 : 0);
  sourceValues.push(Number.isFinite(input.strike) ? 85 : 0);
  sourceValues.push(Number.isFinite(input.dte) ? 90 : 0);
  sourceValues.push(Number.isFinite(input.probabilityOTM) ? 90 : 0);
  sourceValues.push(Number.isFinite(input.iv) ? 75 : 0);
  sourceValues.push(Number.isFinite(input.premium) ? 80 : 0);

  const hvManual = premiumManualOverrides.has("historicalVol");
  const deltaManual = premiumManualOverrides.has("optionDelta");
  sourceValues.push(Number.isFinite(input.hv) ? (hvManual ? 75 : 90) : 0);
  sourceValues.push(Number.isFinite(input.delta) ? (deltaManual ? 75 : 85) : 0);

  if (Number.isFinite(input.ivRank)) sourceValues.push(80);
  if (Number.isFinite(input.eventRisk)) sourceValues.push(75);
  if (Number.isFinite(input.bid) || Number.isFinite(input.ask)) sourceValues.push(80);
  if (Number.isFinite(input.openInterest) || Number.isFinite(input.volume)) sourceValues.push(80);

  const sourceQuality = sourceValues.length
    ? sourceValues.reduce((sum, value) => sum + value, 0) / sourceValues.length
    : 0;

  return clamp(coverage * 0.70 + sourceQuality * 0.30, 0, 100);
}

function describePremiumSourceSummary() {
  const hvSource = premiumManualOverrides.has("historicalVol")
    ? "HV manual"
    : (els.historicalVol?.dataset.autoSource || "HV unavailable");
  const deltaSource = premiumManualOverrides.has("optionDelta")
    ? "Delta manual"
    : (els.optionDelta?.dataset.autoSource || "Delta unavailable");

  return `Sources: ${hvSource}; ${deltaSource}.`;
}

function describeMissingPremiumInputs(warnings) {
  const labels = {
    premium_data_missing: "premium",
    iv_hv_comparison_missing: "IV/HV comparison",
    probability_data_missing: "historical probability",
    objective_missing: "strategy objective",
    event_risk_missing: "event risk",
    market_quality_low_confidence: "market-quality coverage",
    objective_fit_low_confidence: "objective-fit coverage"
  };

  return [...new Set((warnings || []).map(warning => labels[warning]).filter(Boolean))].join(", ");
}

function getNullableNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resetPremiumQualityOutputs(message) {
  latestPremiumQualityState = null;
  [
    els.marketQualityScore,
    els.objectiveFitScore,
    els.riskExposureScore,
    els.overallQualityScore
  ].forEach(target => setText(target, "—"));

  setText(els.marketQualityStatus, message);
  setText(els.objectiveFitStatus, "Rating unavailable.");
  setText(els.riskExposureStatus, "Rating unavailable.");
  setText(els.overallQualityStatus, "Rating unavailable.");
  setText(els.premiumQualityReading, message);
  setText(els.premiumQualityConfidence, "Data confidence unavailable.");
}

/* Statistics helpers */

function percentile(values, percentileValue) {
  if (!values || !values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentileValue / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/* Formatting helpers */

function getNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatPct(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setText(el, text) {
  if (el) el.textContent = text;
}

function debounce(fn, delay = 100) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showDataError() {
  els.strategyNote.textContent =
    "Data files could not be loaded. Check that assets.json, monthly-returns.json, historical-prices.json and seasonality-matrix.json exist and contain valid JSON.";

  els.seasonalityTable.innerHTML = `
    <tr>
      <td colspan="7">Data loading error. The JSON files are missing or invalid.</td>
    </tr>
  `;

  setText(els.bestSeasonalMonth, "—");
  setText(els.bestSeasonalStats, "Data unavailable");
  setText(els.worstSeasonalMonth, "—");
  setText(els.worstSeasonalStats, "Data unavailable");
  setText(els.seasonalityReading, "Seasonality data could not be loaded.");
  setText(els.probabilityReading, "Probability data could not be loaded.");
  setText(els.premiumReading, "Option modelling remains unavailable until data loading is restored.");
  setText(els.executionHint, "Fix the data files first. Debugging broken JSON is unpleasant, but so is pretending it works.");

  clearProbabilityBellCurve();
}
