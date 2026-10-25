/* =========================================================
   OptionsCrafted Premium Tools v15 stabilization
   Live input engine + no-refresh form guard

   OptionsCrafted Premium Tools
   Initial module: Cash-Secured Put Calculator
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  window.OptionsCraftedToolsVersion = "v15-stabilization";

  safeInitTool("Global No-Refresh Guard", installGlobalToolEventGuard);
  safeInitTool("Tool Tabs", initToolTabs);
  safeInitTool("Fair Value Calculator", initFairValueCalculator);
  safeInitTool("Dividend Value Calculator", initDividendValueCalculator);
  safeInitTool("Graham–Lynch Calculator", initGrahamLynchCalculator);
  safeInitTool("Cash-Secured Put Calculator", initCashSecuredPutCalculator);
  safeInitTool("Covered Call Calculator", initCoveredCallCalculator);
  safeInitTool("Wheel Strategy Calculator", initWheelStrategyCalculator);
  safeInitTool("Portfolio Income Planner", initPortfolioIncomePlanner);
  safeInitTool("Native Form Submit Guard", preventNativeToolFormSubmits);
  safeInitTool("Initial Active Tool Refresh", refreshActiveTool);
});

function safeInitTool(name, initializer) {
  try {
    if (typeof initializer === "function") initializer();
  } catch (error) {
    console.error("OptionsCrafted tool init failed:", name, error);
  }
}

/* -----------------------------
   Live Tool Update Registry
----------------------------- */

const OptionsCraftedToolUpdaters = {};

function registerToolUpdater(toolName, updater) {
  if (!toolName || typeof updater !== "function") return;
  OptionsCraftedToolUpdaters[toolName] = updater;
}

function runToolUpdate(toolName) {
  const updater = OptionsCraftedToolUpdaters[toolName];
  if (typeof updater !== "function") return;

  try {
    updater();
  } catch (error) {
    console.error("OptionsCrafted tool update failed:", toolName, error);
  }
}

function preventNativeToolFormSubmits() {
  document.querySelectorAll(".tool-form").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopPropagation();
      const activePanel = form.closest(".tool-panel");

      if (!activePanel || !activePanel.id) return;

      const toolName = activePanel.id.replace("tool-", "");
      runToolUpdate(toolName);
    });
  });
}

function bindLiveToolInputs(form, updater) {
  if (!form || typeof updater !== "function") return;

  form.querySelectorAll("input, select, textarea").forEach(function (input) {
    input.addEventListener("input", updater);
    input.addEventListener("change", updater);
  });
}

function getToolNameFromElement(element) {
  if (!element || typeof element.closest !== "function") return "";

  const panel = element.closest(".tool-panel");
  if (!panel || !panel.id) return "";

  return panel.id.replace("tool-", "");
}

function refreshActiveTool() {
  const activePanel = document.querySelector(".tool-panel.active");
  if (!activePanel || !activePanel.id) return;

  runToolUpdate(activePanel.id.replace("tool-", ""));
}

function installGlobalToolEventGuard() {
  document.addEventListener(
    "submit",
    function (event) {
      const form = event.target;
      if (!form || !form.classList || !form.classList.contains("tool-form")) return;

      event.preventDefault();
      event.stopPropagation();
      runToolUpdate(getToolNameFromElement(form));
    },
    true
  );

  document.addEventListener(
    "keydown",
    function (event) {
      if (event.key !== "Enter") return;

      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (!target.closest(".tool-form")) return;

      event.preventDefault();
      event.stopPropagation();
      runToolUpdate(getToolNameFromElement(target));
    },
    true
  );

  document.addEventListener("click", function (event) {
    const button = event.target && event.target.closest ? event.target.closest(".tool-calculate-btn") : null;
    if (!button) return;

    event.preventDefault();
    runToolUpdate(getToolNameFromElement(button));
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    if (!target.closest(".tool-form")) return;

    runToolUpdate(getToolNameFromElement(target));
  });

  document.addEventListener("change", function (event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    if (!target.closest(".tool-form")) return;

    runToolUpdate(getToolNameFromElement(target));
  });
}
/* -----------------------------
   Tool Tabs
----------------------------- */

function initToolTabs() {
  const tabs = document.querySelectorAll(".tool-tab");
  const panels = document.querySelectorAll(".tool-panel");

  if (!tabs.length || !panels.length) return;

  function activateTool(selectedTool) {
    if (!selectedTool) return;

    tabs.forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-tool") === selectedTool);
    });

    panels.forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "tool-" + selectedTool);
    });

    try {
      window.sessionStorage.setItem("optionscrafted-active-tool", selectedTool);
    } catch (error) {
      // Session storage can be unavailable in some browser contexts. Ignore silently.
    }

    window.setTimeout(function () {
      runToolUpdate(selectedTool);
    }, 0);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activateTool(tab.getAttribute("data-tool"));
    });
  });

  let storedTool = null;

  try {
    storedTool = window.sessionStorage.getItem("optionscrafted-active-tool");
  } catch (error) {
    storedTool = null;
  }

  const defaultTool = document.querySelector(".tool-tab.active")?.getAttribute("data-tool") || "fair-value";
  const initialTool = storedTool && document.querySelector('[data-tool="' + storedTool + '"]') ? storedTool : defaultTool;

  activateTool(initialTool);
}
/* -----------------------------
   Fair Value Calculator
----------------------------- */

function initFairValueCalculator() {
  const form = document.getElementById("fv-form");

  if (!form) return;

  const inputs = {
    currentEps: document.getElementById("fv-current-eps"),
    growthStageOne: document.getElementById("fv-growth-stage-one"),
    growthStageTwo: document.getElementById("fv-growth-stage-two"),
    currentDividend: document.getElementById("fv-current-dividend"),
    dividendGrowthStageOne: document.getElementById("fv-dividend-growth-stage-one"),
    dividendGrowthStageTwo: document.getElementById("fv-dividend-growth-stage-two"),
    targetReturn: document.getElementById("fv-target-return"),
    exitMultiple: document.getElementById("fv-exit-multiple")
  };

  const outputs = {
    salePrice: document.getElementById("fv-sale-price"),
    dividendYieldAtSale: document.getElementById("fv-dividend-yield-at-sale"),
    dividendValue: document.getElementById("fv-dividend-value"),
    totalValue: document.getElementById("fv-total-value"),
    buyBelow: document.getElementById("fv-buy-below"),
    projectionBody: document.getElementById("fv-projection-body"),
    chart: document.getElementById("fv-growth-chart"),
    interpretation: document.getElementById("fv-interpretation")
  };

  const update = function () {
    calculateFairValue(inputs, outputs);
  };

  registerToolUpdater("fair-value", update);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    update();
  });

  bindLiveToolInputs(form, update);

  update();
}

function calculateFairValue(inputs, outputs) {
  const currentEps = readPositiveNumber(inputs.currentEps);
  const growthStageOne = readPositiveNumber(inputs.growthStageOne) / 100;
  const growthStageTwo = readPositiveNumber(inputs.growthStageTwo) / 100;
  const currentDividend = readPositiveNumber(inputs.currentDividend);
  const dividendGrowthStageOne = readPositiveNumber(inputs.dividendGrowthStageOne) / 100;
  const dividendGrowthStageTwo = readPositiveNumber(inputs.dividendGrowthStageTwo) / 100;
  const targetReturn = readPositiveNumber(inputs.targetReturn) / 100;
  const exitMultiple = readPositiveNumber(inputs.exitMultiple);

  if (
    currentEps <= 0 ||
    growthStageOne < -0.99 ||
    growthStageTwo < -0.99 ||
    currentDividend < 0 ||
    dividendGrowthStageOne < -0.99 ||
    dividendGrowthStageTwo < -0.99 ||
    targetReturn <= 0 ||
    exitMultiple <= 0
  ) {
    setInvalidFairValue(outputs);
    return;
  }

  const projection = buildFairValueProjection({
    currentEps,
    currentDividend,
    growthStageOne,
    growthStageTwo,
    dividendGrowthStageOne,
    dividendGrowthStageTwo,
    targetReturn,
    exitMultiple
  });

  const yearTen = projection[projection.length - 1];
  const estimatedSalePrice = yearTen.eps * exitMultiple;
  const dividendYieldAtSale = estimatedSalePrice > 0 ? yearTen.dividend / estimatedSalePrice : 0;

  // Compound each projected dividend forward to year 10 at the target return.
  const futureValueOfDividends = projection.reduce(function (sum, row) {
    return sum + row.futureValueDividend;
  }, 0);

  const totalFutureValue = estimatedSalePrice + futureValueOfDividends;
  const buyBelowPrice = totalFutureValue / Math.pow(1 + targetReturn, 10);

  if (outputs.salePrice) outputs.salePrice.textContent = formatCurrency(estimatedSalePrice);
  if (outputs.dividendYieldAtSale) outputs.dividendYieldAtSale.textContent = formatPercent(dividendYieldAtSale);
  if (outputs.dividendValue) outputs.dividendValue.textContent = formatCurrency(futureValueOfDividends);
  if (outputs.totalValue) outputs.totalValue.textContent = formatCurrency(totalFutureValue);
  if (outputs.buyBelow) outputs.buyBelow.textContent = formatCurrency(buyBelowPrice);

  renderFairValueProjectionTable(outputs.projectionBody, projection);
  drawFairValueBarChart(outputs.chart, projection);

  if (outputs.interpretation) {
    outputs.interpretation.textContent = buildFairValueInterpretation({
      currentEps,
      currentDividend,
      growthStageOne,
      growthStageTwo,
      dividendGrowthStageOne,
      dividendGrowthStageTwo,
      targetReturn,
      exitMultiple,
      yearTenEps: yearTen.eps,
      yearTenDividend: yearTen.dividend,
      dividendYieldAtSale,
      estimatedSalePrice,
      futureValueOfDividends,
      totalFutureValue,
      buyBelowPrice
    });
  }
}

function buildFairValueProjection(data) {
  const projection = [];
  let projectedEps = data.currentEps;
  let projectedDividend = data.currentDividend;

  for (let year = 1; year <= 10; year += 1) {
    const epsGrowthRate = year <= 5 ? data.growthStageOne : data.growthStageTwo;
    const dividendGrowthRate =
      year <= 5 ? data.dividendGrowthStageOne : data.dividendGrowthStageTwo;

    projectedEps = projectedEps * (1 + epsGrowthRate);
    projectedDividend = projectedDividend * (1 + dividendGrowthRate);

    const yearsToCompound = 10 - year;
    const futureValueDividend =
      projectedDividend * Math.pow(1 + data.targetReturn, yearsToCompound);

    projection.push({
      year,
      eps: projectedEps,
      dividend: projectedDividend,
      futureValueDividend
    });
  }

  return projection;
}

function setInvalidFairValue(outputs) {
  if (outputs.salePrice) outputs.salePrice.textContent = "—";
  if (outputs.dividendYieldAtSale) outputs.dividendYieldAtSale.textContent = "—";
  if (outputs.dividendValue) outputs.dividendValue.textContent = "—";
  if (outputs.totalValue) outputs.totalValue.textContent = "—";
  if (outputs.buyBelow) outputs.buyBelow.textContent = "—";

  if (outputs.projectionBody) outputs.projectionBody.innerHTML = "";
  if (outputs.chart) outputs.chart.innerHTML = "";

  if (outputs.interpretation) {
    outputs.interpretation.textContent =
      "Enter valid values to calculate fair value. EPS or FCF, target return, and expected P/E at sale must be positive.";
  }
}

function buildFairValueInterpretation(data) {
  const buyBelowText = formatCurrency(data.buyBelowPrice);
  const yearTenEpsText = formatCurrency(data.yearTenEps);
  const salePriceText = formatCurrency(data.estimatedSalePrice);
  const dividendValueText = formatCurrency(data.futureValueOfDividends);
  const totalValueText = formatCurrency(data.totalFutureValue);
  const targetReturnText = formatPercent(data.targetReturn);
  const dividendYieldText = formatPercent(data.dividendYieldAtSale);

  let qualityNote = "";

  if (data.growthStageOne > 0.15 || data.growthStageTwo > 0.10) {
    qualityNote +=
      " The EPS or FCF growth assumptions are aggressive, so the result should be checked against business quality, margins, reinvestment capacity, and the durability of the underlying moat.";
  }

  if (data.dividendGrowthStageOne > 0.12 || data.dividendGrowthStageTwo > 0.08) {
    qualityNote +=
      " The dividend growth assumptions are also demanding and should be checked against payout ratio, free cash flow coverage, and balance sheet strength.";
  }

  if (data.exitMultiple > 25) {
    qualityNote +=
      " The expected P/E at sale is high, so the valuation depends heavily on market optimism remaining intact.";
  }

  return (
    "Based on these assumptions, year 10 EPS or FCF per share reaches " +
    yearTenEpsText +
    ". Applying the expected P/E at sale gives an estimated sale price of " +
    salePriceText +
    ". The projected dividend yield at sale is " +
    dividendYieldText +
    ". Reinvested dividends add an estimated future value of " +
    dividendValueText +
    ", bringing total value at sale to " +
    totalValueText +
    ". To target a " +
    targetReturnText +
    " annual return, the primary output is the buy-now-below price: " +
    buyBelowText +
    "." +
    qualityNote
  );
}

function renderFairValueProjectionTable(tbody, projection) {
  if (!tbody || !projection || !projection.length) return;

  const rows = projection.map(function (row) {
    return (
      "<tr>" +
      "<td>" +
      row.year +
      "</td>" +
      "<td>" +
      escapeHtml(formatCurrency(row.eps)) +
      "</td>" +
      "<td>" +
      escapeHtml(formatCurrency(row.dividend)) +
      "</td>" +
      "</tr>"
    );
  });

  tbody.innerHTML = rows.join("");
}

function drawFairValueBarChart(container, projection) {
  if (!container || !projection || !projection.length) return;

  const width = 900;
  const height = 390;
  const padding = {
    top: 32,
    right: 34,
    bottom: 58,
    left: 78
  };

  let maxValue = 0;

  projection.forEach(function (row) {
    maxValue = Math.max(maxValue, row.eps, row.dividend);
  });

  const safeMax = maxValue > 0 ? maxValue * 1.18 : 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const groupWidth = plotWidth / projection.length;
  const barWidth = Math.min(26, groupWidth * 0.28);
  const gap = Math.min(8, groupWidth * 0.08);

  function xGroup(index) {
    return padding.left + index * groupWidth + groupWidth / 2;
  }

  function yScale(value) {
    return padding.top + ((safeMax - value) / safeMax) * plotHeight;
  }

  function barHeight(value) {
    return Math.max(0, height - padding.bottom - yScale(value));
  }

  const yTicks = [0, safeMax / 2, safeMax];
  let grid = "";

  yTicks.forEach(function (tick) {
    const y = yScale(tick);

    grid +=
      '<line x1="' +
      padding.left +
      '" y1="' +
      y.toFixed(2) +
      '" x2="' +
      (width - padding.right) +
      '" y2="' +
      y.toFixed(2) +
      '" stroke="#e5e7eb" stroke-width="1" />';

    grid +=
      '<text x="' +
      (padding.left - 12) +
      '" y="' +
      (y + 4).toFixed(2) +
      '" text-anchor="end" font-size="12" fill="#64748b">' +
      escapeHtml(formatCurrency(tick)) +
      "</text>";
  });

  let bars = "";
  let labels = "";

  projection.forEach(function (row, index) {
    const center = xGroup(index);
    const epsX = center - barWidth - gap / 2;
    const dividendX = center + gap / 2;
    const epsY = yScale(row.eps);
    const dividendY = yScale(row.dividend);
    const epsHeight = barHeight(row.eps);
    const dividendHeight = barHeight(row.dividend);

    bars +=
      '<rect x="' +
      epsX.toFixed(2) +
      '" y="' +
      epsY.toFixed(2) +
      '" width="' +
      barWidth.toFixed(2) +
      '" height="' +
      epsHeight.toFixed(2) +
      '" rx="5" fill="#10233f" />';

    bars +=
      '<rect x="' +
      dividendX.toFixed(2) +
      '" y="' +
      dividendY.toFixed(2) +
      '" width="' +
      barWidth.toFixed(2) +
      '" height="' +
      dividendHeight.toFixed(2) +
      '" rx="5" fill="#c9a227" />';

    labels +=
      '<text x="' +
      center.toFixed(2) +
      '" y="' +
      (height - 22) +
      '" text-anchor="middle" font-size="12" fill="#64748b">Y' +
      row.year +
      "</text>";
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" role="img" aria-label="Expected EPS or free cash flow and dividend growth bar chart">' +
    '<rect x="0" y="0" width="' +
    width +
    '" height="' +
    height +
    '" fill="#ffffff" />' +
    grid +
    '<line x1="' +
    padding.left +
    '" y1="' +
    (height - padding.bottom) +
    '" x2="' +
    (width - padding.right) +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1" />' +
    '<line x1="' +
    padding.left +
    '" y1="' +
    padding.top +
    '" x2="' +
    padding.left +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1" />' +
    bars +
    labels +
    "</svg>";
}


/* -----------------------------
   Dividend Value Calculator
----------------------------- */

function initDividendValueCalculator() {
  const form = document.getElementById("dv-form");

  if (!form) return;

  const inputs = {
    currentDividend: document.getElementById("dv-current-dividend"),
    growthRate: document.getElementById("dv-growth-rate"),
    perpetualGrowth: document.getElementById("dv-perpetual-growth"),
    discountRate: document.getElementById("dv-discount-rate")
  };

  const outputs = {
    buyNowBelow: document.getElementById("dv-buy-now-below"),
    targetDividendYield: document.getElementById("dv-target-dividend-yield"),
    pvDividends: document.getElementById("dv-pv-dividends"),
    terminalValue: document.getElementById("dv-terminal-value"),
    pvTerminalValue: document.getElementById("dv-pv-terminal-value"),
    yearThirtyDividend: document.getElementById("dv-year-thirty-dividend"),
    interpretation: document.getElementById("dv-interpretation"),
    chart: document.getElementById("dv-bar-chart"),
    projectionBody: document.getElementById("dv-projection-body")
  };

  const update = function () {
    calculateDividendValue(inputs, outputs);
  };

  registerToolUpdater("dividend-value", update);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    update();
  });

  bindLiveToolInputs(form, update);

  update();
}

function calculateDividendValue(inputs, outputs) {
  const currentDividend = readPositiveNumber(inputs.currentDividend);
  const growthRate = readPositiveNumber(inputs.growthRate) / 100;
  const perpetualGrowth = readPositiveNumber(inputs.perpetualGrowth) / 100;
  const discountRate = readPositiveNumber(inputs.discountRate) / 100;

  if (
    currentDividend <= 0 ||
    growthRate <= -0.99 ||
    perpetualGrowth <= -0.99 ||
    discountRate <= 0 ||
    discountRate <= perpetualGrowth
  ) {
    setInvalidDividendValue(outputs);
    return;
  }

  const schedule = [];
  let dividend = currentDividend;
  let presentValueOfDividends = 0;

  for (let year = 1; year <= 30; year++) {
    const applicableGrowth = year <= 10 ? growthRate : perpetualGrowth;
    dividend = dividend * (1 + applicableGrowth);
    const presentValue = dividend / Math.pow(1 + discountRate, year);
    presentValueOfDividends += presentValue;

    schedule.push({
      year: year,
      dividend: dividend,
      presentValue: presentValue
    });
  }

  const yearThirtyDividend = schedule[schedule.length - 1].dividend;
  const terminalDividend = yearThirtyDividend * (1 + perpetualGrowth);
  const terminalValue = terminalDividend / (discountRate - perpetualGrowth);
  const presentValueOfTerminalValue = terminalValue / Math.pow(1 + discountRate, 30);
  const buyNowBelow = presentValueOfDividends + presentValueOfTerminalValue;
  const targetDividendYield = currentDividend / buyNowBelow;

  outputs.buyNowBelow.textContent = formatCurrency(buyNowBelow);
  outputs.targetDividendYield.textContent = formatPercent(targetDividendYield);
  outputs.pvDividends.textContent = formatCurrency(presentValueOfDividends);
  outputs.terminalValue.textContent = formatCurrency(terminalValue);
  outputs.pvTerminalValue.textContent = formatCurrency(presentValueOfTerminalValue);
  outputs.yearThirtyDividend.textContent = formatCurrency(yearThirtyDividend);

  renderDividendDiscountSchedule(outputs, schedule, terminalValue, presentValueOfTerminalValue);
  drawDividendValueBarChart(outputs.chart, schedule);

  outputs.interpretation.textContent = buildDividendValueInterpretation({
    currentDividend: currentDividend,
    growthRate: growthRate,
    perpetualGrowth: perpetualGrowth,
    discountRate: discountRate,
    presentValueOfDividends: presentValueOfDividends,
    terminalValue: terminalValue,
    presentValueOfTerminalValue: presentValueOfTerminalValue,
    buyNowBelow: buyNowBelow,
    targetDividendYield: targetDividendYield
  });
}

function setInvalidDividendValue(outputs) {
  outputs.buyNowBelow.textContent = "—";
  outputs.targetDividendYield.textContent = "—";
  outputs.pvDividends.textContent = "—";
  outputs.terminalValue.textContent = "—";
  outputs.pvTerminalValue.textContent = "—";
  outputs.yearThirtyDividend.textContent = "—";

  if (outputs.chart) outputs.chart.innerHTML = "";
  if (outputs.projectionBody) outputs.projectionBody.innerHTML = "";

  outputs.interpretation.textContent =
    "Check the inputs. The target return must be positive and higher than the perpetual growth rate. Otherwise the terminal value becomes mathematically unstable, because apparently infinity still refuses to behave politely.";
}

function buildDividendValueInterpretation(data) {
  const buyNowText = formatCurrency(data.buyNowBelow);
  const targetYieldText = formatPercent(data.targetDividendYield);
  const pvDividendsText = formatCurrency(data.presentValueOfDividends);
  const pvTerminalText = formatCurrency(data.presentValueOfTerminalValue);
  const growthText = formatPercent(data.growthRate);
  const perpetualText = formatPercent(data.perpetualGrowth);
  const discountText = formatPercent(data.discountRate);

  const spread = data.discountRate - data.perpetualGrowth;
  let qualityNote = "";

  if (spread < 0.025) {
    qualityNote = " The discount-rate spread is narrow, so the terminal value dominates the result. This can be useful, but it is also fragile: a tiny change in perpetual growth can move the valuation sharply.";
  } else if (data.perpetualGrowth > 0.04) {
    qualityNote = " The perpetual growth assumption is ambitious. It should be reserved for unusually durable businesses with strong reinvestment economics and dividend capacity.";
  } else {
    qualityNote = " The assumptions are mechanically stable because the target return remains meaningfully above perpetual growth.";
  }

  return (
    "At a current annual dividend of " +
    formatCurrency(data.currentDividend) +
    ", with 0–10 year growth of " +
    growthText +
    ", perpetual growth of " +
    perpetualText +
    ", and a required return of " +
    discountText +
    ", the dividend model estimates a Buy Now Below value of " +
    buyNowText +
    ". The implied target dividend yield is " +
    targetYieldText +
    ". Present value from the 30 explicit dividends contributes " +
    pvDividendsText +
    ", while the discounted terminal value contributes " +
    pvTerminalText +
    "." +
    qualityNote
  );
}

function renderDividendDiscountSchedule(outputs, schedule, terminalValue, presentValueOfTerminalValue) {
  if (!outputs.projectionBody) return;

  const rows = schedule
    .map(function (row) {
      return (
        "<tr>" +
        "<td>" +
        row.year +
        "</td>" +
        "<td>" +
        formatCurrency(row.dividend) +
        "</td>" +
        "<td>" +
        formatCurrency(row.presentValue) +
        "</td>" +
        "<td>—</td>" +
        "</tr>"
      );
    })
    .join("");

  outputs.projectionBody.innerHTML =
    rows +
    "<tr class=\"dv-terminal-row\">" +
    "<td>Terminal Value</td>" +
    "<td>" +
    formatCurrency(terminalValue) +
    "</td>" +
    "<td>" +
    formatCurrency(presentValueOfTerminalValue) +
    "</td>" +
    "<td>" +
    formatCurrency(terminalValue) +
    "</td>" +
    "</tr>";
}

function drawDividendValueBarChart(container, schedule) {
  if (!container || !schedule.length) return;

  const width = 980;
  const height = 430;
  const padding = {
    top: 34,
    right: 28,
    bottom: 54,
    left: 76
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max.apply(
    null,
    schedule.flatMap(function (row) {
      return [row.dividend, row.presentValue];
    })
  );

  const safeMax = maxValue > 0 ? maxValue * 1.16 : 1;
  const groupWidth = chartWidth / schedule.length;
  const barWidth = Math.max(5, Math.min(10, groupWidth * 0.26));

  function xFor(index, offset) {
    return padding.left + index * groupWidth + groupWidth * 0.5 + offset;
  }

  function yFor(value) {
    return padding.top + chartHeight - (value / safeMax) * chartHeight;
  }

  function barHeight(value) {
    return (value / safeMax) * chartHeight;
  }

  const axisColor = "#94a3b8";
  const gridColor = "#e5e7eb";
  const textColor = "#64748b";
  const blue = "#10233f";
  const gold = "#c9a227";

  let svg =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" role="img" aria-label="Dividend projection and discounted dividend bar chart">' +
    '<rect x="0" y="0" width="' +
    width +
    '" height="' +
    height +
    '" fill="#ffffff"></rect>';

  [0, 0.5, 1].forEach(function (tick) {
    const value = safeMax * tick;
    const y = yFor(value);
    svg +=
      '<line x1="' +
      padding.left +
      '" y1="' +
      y.toFixed(2) +
      '" x2="' +
      (width - padding.right) +
      '" y2="' +
      y.toFixed(2) +
      '" stroke="' +
      gridColor +
      '" stroke-width="1"></line>' +
      '<text x="' +
      (padding.left - 12) +
      '" y="' +
      (y + 4).toFixed(2) +
      '" text-anchor="end" font-size="12" fill="' +
      textColor +
      '">' +
      formatCurrency(value) +
      "</text>";
  });

  svg +=
    '<line x1="' +
    padding.left +
    '" y1="' +
    (padding.top + chartHeight) +
    '" x2="' +
    (width - padding.right) +
    '" y2="' +
    (padding.top + chartHeight) +
    '" stroke="' +
    axisColor +
    '" stroke-width="1"></line>' +
    '<line x1="' +
    padding.left +
    '" y1="' +
    padding.top +
    '" x2="' +
    padding.left +
    '" y2="' +
    (padding.top + chartHeight) +
    '" stroke="' +
    axisColor +
    '" stroke-width="1"></line>';

  schedule.forEach(function (row, index) {
    const xDividend = xFor(index, -barWidth - 2);
    const xPv = xFor(index, 2);
    const yDividend = yFor(row.dividend);
    const yPv = yFor(row.presentValue);
    const hDividend = barHeight(row.dividend);
    const hPv = barHeight(row.presentValue);

    svg +=
      '<rect x="' +
      xDividend.toFixed(2) +
      '" y="' +
      yDividend.toFixed(2) +
      '" width="' +
      barWidth.toFixed(2) +
      '" height="' +
      hDividend.toFixed(2) +
      '" rx="4" fill="' +
      blue +
      '"></rect>' +
      '<rect x="' +
      xPv.toFixed(2) +
      '" y="' +
      yPv.toFixed(2) +
      '" width="' +
      barWidth.toFixed(2) +
      '" height="' +
      hPv.toFixed(2) +
      '" rx="4" fill="' +
      gold +
      '"></rect>';

    if (row.year === 1 || row.year % 5 === 0 || row.year === 30) {
      svg +=
        '<text x="' +
        xFor(index, 0).toFixed(2) +
        '" y="' +
        (height - 22) +
        '" text-anchor="middle" font-size="11" fill="' +
        textColor +
        '">Y' +
        row.year +
        "</text>";
    }
  });

  svg += "</svg>";
  container.innerHTML = svg;
}


/* -----------------------------
   Graham-Lynch Calculator
----------------------------- */

function initGrahamLynchCalculator() {
  const form = document.getElementById("gl-form");

  if (!form) return;

  registerToolUpdater("graham-lynch", calculateGrahamLynchValue);
  bindLiveToolInputs(form, calculateGrahamLynchValue);
  calculateGrahamLynchValue();
}

function calculateGrahamLynchValue() {
  const tickerInput = document.getElementById("gl-ticker");
  const price = readFlexibleNumber("gl-current-price", 0);
  const eps = readFlexibleNumber("gl-eps", 0);
  const growthRate = readFlexibleNumber("gl-growth-rate", 0);
  const dividendYield = Math.max(readFlexibleNumber("gl-dividend-yield", 0), 0);
  const aaaYield = readFlexibleNumber("gl-aaa-yield", 0);

  let pe = readFlexibleNumber("gl-current-pe", 0);

  if ((!Number.isFinite(pe) || pe <= 0) && price > 0 && eps > 0) {
    pe = price / eps;
  }

  const grahamValue = eps > 0
    ? eps * (8.5 + 2 * growthRate)
    : NaN;

  const adjustedGrahamValue = Number.isFinite(grahamValue) && aaaYield > 0
    ? grahamValue * (4.4 / aaaYield)
    : NaN;

  const upsideDownside = price > 0 && Number.isFinite(adjustedGrahamValue)
    ? adjustedGrahamValue / price - 1
    : NaN;

  const peg = pe > 0 && growthRate > 0
    ? pe / growthRate
    : NaN;

  const dividendAdjustedPeg = pe > 0 && growthRate + dividendYield > 0
    ? pe / (growthRate + dividendYield)
    : NaN;

  const verdict = getGrahamLynchVerdict(upsideDownside, dividendAdjustedPeg);
  const interpretation = buildGrahamLynchInterpretation(verdict, upsideDownside, dividendAdjustedPeg, growthRate, dividendYield, aaaYield);

  setText("gl-graham-value", formatCurrency(grahamValue));
  setText("gl-adjusted-graham-value", formatCurrency(adjustedGrahamValue));
  setText("gl-upside-downside", formatPercent(upsideDownside));
  setText("gl-peg", formatMultiple(peg));
  setText("gl-dividend-adjusted-peg", formatMultiple(dividendAdjustedPeg));
  setText("gl-verdict", verdict);
  setText("gl-interpretation", interpretation);

  updateGrahamLynchSourceLinks(tickerInput ? tickerInput.value : "");
}

function getGrahamLynchVerdict(upsideDownside, dividendAdjustedPeg) {
  if (!Number.isFinite(upsideDownside) && !Number.isFinite(dividendAdjustedPeg)) {
    return "Insufficient data";
  }

  if (Number.isFinite(upsideDownside) && upsideDownside >= 0.25 && Number.isFinite(dividendAdjustedPeg) && dividendAdjustedPeg <= 1.5) {
    return "Attractive";
  }

  if (Number.isFinite(upsideDownside) && upsideDownside >= 0.1 && (!Number.isFinite(dividendAdjustedPeg) || dividendAdjustedPeg <= 2)) {
    return "Reasonable";
  }

  if (Number.isFinite(upsideDownside) && upsideDownside < -0.1 && Number.isFinite(dividendAdjustedPeg) && dividendAdjustedPeg > 2) {
    return "Expensive";
  }

  if (Number.isFinite(dividendAdjustedPeg) && dividendAdjustedPeg <= 1.2) {
    return "PEG attractive";
  }

  if (Number.isFinite(dividendAdjustedPeg) && dividendAdjustedPeg > 2.2) {
    return "PEG stretched";
  }

  return "Fair / neutral";
}

function buildGrahamLynchInterpretation(verdict, upsideDownside, dividendAdjustedPeg, growthRate, dividendYield, aaaYield) {
  if (verdict === "Insufficient data") {
    return "Add current price, diluted LTM / TTM EPS, expected EPS growth, P/E, dividend yield, and AAA corporate yield to generate a Graham-Lynch reading.";
  }

  const upsideText = Number.isFinite(upsideDownside)
    ? "The interest-adjusted Graham value implies " + formatPercent(upsideDownside) + " upside/downside versus the current price."
    : "The interest-adjusted Graham value cannot be calculated without a valid price and AAA yield.";

  const pegText = Number.isFinite(dividendAdjustedPeg)
    ? "The dividend-adjusted PEG is " + formatMultiple(dividendAdjustedPeg) + ", using " + formatPlainPercent(growthRate) + " EPS growth plus " + formatPlainPercent(dividendYield) + " dividend yield."
    : "The dividend-adjusted PEG cannot be calculated unless growth plus dividend yield is above zero.";

  const rateText = aaaYield > 0
    ? "The Graham rate adjustment uses a " + formatPlainPercent(aaaYield) + " AAA corporate yield."
    : "Enter a current AAA corporate yield to activate the interest-rate adjustment.";

  return verdict + ". " + upsideText + " " + pegText + " " + rateText + " This is a rough valuation anchor, not a substitute for a full business-quality and cash-flow model.";
}

function updateGrahamLynchSourceLinks(rawTicker) {
  const ticker = String(rawTicker || "").trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  const tickerLower = ticker.toLowerCase();

  const yahooLink = document.getElementById("gl-yahoo-link");
  const stockAnalysisLink = document.getElementById("gl-stockanalysis-link");
  const secLink = document.getElementById("gl-sec-link");

  if (yahooLink) {
    yahooLink.href = ticker
      ? "https://finance.yahoo.com/quote/" + encodeURIComponent(ticker) + "/key-statistics/"
      : "https://finance.yahoo.com/";
  }

  if (stockAnalysisLink) {
    stockAnalysisLink.href = tickerLower
      ? "https://stockanalysis.com/stocks/" + encodeURIComponent(tickerLower) + "/statistics/"
      : "https://stockanalysis.com/stocks/";
  }

  if (secLink) {
    secLink.href = ticker
      ? "https://www.sec.gov/edgar/search/#/q=" + encodeURIComponent(ticker)
      : "https://www.sec.gov/edgar/search/";
  }
}

function readFlexibleNumber(id, fallback) {
  const input = document.getElementById(id);

  if (!input) return fallback;

  const value = Number(input.value);

  if (!Number.isFinite(value)) return fallback;

  return value;
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent = value;
}

function formatMultiple(value) {
  if (!Number.isFinite(value)) return "—";

  return value.toFixed(2);
}

function formatPlainPercent(value) {
  if (!Number.isFinite(value)) return "—";

  return value.toFixed(1) + "%";
}


/* -----------------------------
   Cash-Secured Put Calculator
----------------------------- */

function initCashSecuredPutCalculator() {
  const form = document.getElementById("csp-form");

  if (!form) return;

  const inputs = {
    stockPrice: document.getElementById("csp-stock-price"),
    strikePrice: document.getElementById("csp-strike-price"),
    premium: document.getElementById("csp-premium"),
    months: document.getElementById("csp-months"),
    dividend: document.getElementById("csp-dividend"),
    contracts: document.getElementById("csp-contracts")
  };

  const outputs = {
    capitalSecured: document.getElementById("csp-capital-secured"),
    totalPremium: document.getElementById("csp-total-premium"),
    breakeven: document.getElementById("csp-breakeven"),
    returnOnCash: document.getElementById("csp-return"),
    annualisedYield: document.getElementById("csp-annualised"),
    discountToCurrent: document.getElementById("csp-discount"),
    distanceToStrike: document.getElementById("csp-distance"),
    matrixBody: document.getElementById("csp-matrix-body"),
    chart: document.getElementById("csp-ror-chart"),
    interpretation: document.getElementById("csp-interpretation")
  };

  const update = function () {
    calculateCashSecuredPut(inputs, outputs);
  };

  registerToolUpdater("cash-secured-put", update);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    update();
  });

  bindLiveToolInputs(form, update);

  update();
}

function calculateCashSecuredPut(inputs, outputs) {
  const stockPrice = readPositiveNumber(inputs.stockPrice);
  const strikePrice = readPositiveNumber(inputs.strikePrice);
  const premium = readPositiveNumber(inputs.premium);
  const months = readPositiveNumber(inputs.months);
  const dividend = readPositiveNumber(inputs.dividend);
  const contracts = readPositiveInteger(inputs.contracts);

  if (
    stockPrice <= 0 ||
    strikePrice <= 0 ||
    premium < 0 ||
    months <= 0 ||
    contracts <= 0 ||
    premium >= strikePrice
  ) {
    setInvalidCashSecuredPut(outputs);
    return;
  }

  const contractSize = 100;
  const sharesControlled = contracts * contractSize;
  const capitalSecured = strikePrice * sharesControlled;
  const totalPremium = premium * sharesControlled;
  const purchaseCostBasis = strikePrice - premium;

  const periodReturn = purchaseCostBasis > 0 ? premium / purchaseCostBasis : 0;
  const annualisedReturn = months > 0 ? Math.pow(1 + periodReturn, 12 / months) - 1 : 0;
  const discountToCurrent = stockPrice > 0 ? (stockPrice - purchaseCostBasis) / stockPrice : 0;
  const distanceToStrike = stockPrice > 0 ? (stockPrice - strikePrice) / stockPrice : 0;
  const matrix = buildCashSecuredPutMatrix({
    stockPrice,
    strikePrice,
    premium,
    dividend,
    purchaseCostBasis
  });

  outputs.capitalSecured.textContent = formatCurrency(capitalSecured);
  outputs.totalPremium.textContent = formatCurrency(totalPremium);
  outputs.breakeven.textContent = formatCurrency(purchaseCostBasis);
  outputs.returnOnCash.textContent = formatPercent(periodReturn);
  outputs.annualisedYield.textContent = formatPercent(annualisedReturn);
  outputs.discountToCurrent.textContent = formatPercent(discountToCurrent);
  outputs.distanceToStrike.textContent = formatPercent(distanceToStrike);

  renderCashSecuredPutMatrix(outputs.matrixBody, matrix, strikePrice);
  drawCashSecuredPutReturnChart(outputs.chart, matrix, strikePrice);

  outputs.interpretation.textContent = buildCashSecuredPutInterpretation({
    stockPrice,
    strikePrice,
    premium,
    dividend,
    purchaseCostBasis,
    totalPremium,
    capitalSecured,
    periodReturn,
    annualisedReturn,
    discountToCurrent,
    distanceToStrike,
    months,
    contracts
  });
}

function buildCashSecuredPutMatrix(data) {
  const matrix = [];

  for (let step = 82; step <= 118; step += 2) {
    const expirationPrice = data.strikePrice * (step / 100);
    const buyAndHoldReturn =
      data.stockPrice > 0
        ? (expirationPrice - data.stockPrice + data.dividend) / data.stockPrice
        : 0;

    const putReturn =
      expirationPrice >= data.strikePrice
        ? data.premium / data.purchaseCostBasis
        : (expirationPrice - data.purchaseCostBasis) / data.purchaseCostBasis;

    matrix.push({
      expirationPrice,
      buyAndHoldReturn,
      putReturn
    });
  }

  return matrix;
}

function renderCashSecuredPutMatrix(container, matrix, strikePrice) {
  if (!container) return;

  container.innerHTML = matrix
    .map(function (row) {
      const isStrikeRow = Math.abs(row.expirationPrice - strikePrice) < 0.005;
      const rowClass = isStrikeRow ? " class=\"csp-strike-row\"" : "";
      const priceLabel = isStrikeRow
        ? formatCurrency(row.expirationPrice) + " <span class=\"csp-strike-badge\">Strike</span>"
        : formatCurrency(row.expirationPrice);

      return (
        "<tr" + rowClass + ">" +
        "<td>" +
        priceLabel +
        "</td>" +
        "<td>" +
        formatPercent(row.buyAndHoldReturn) +
        "</td>" +
        "<td>" +
        formatPercent(row.putReturn) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function drawCashSecuredPutReturnChart(container, matrix, strikePrice) {
  if (!container || !matrix.length) return;

  const width = 900;
  const height = 390;
  const padding = {
    top: 34,
    right: 34,
    bottom: 54,
    left: 78
  };

  const values = [];
  matrix.forEach(function (row) {
    values.push(row.buyAndHoldReturn);
    values.push(row.putReturn);
  });

  let minValue = Math.min.apply(null, values);
  let maxValue = Math.max.apply(null, values);
  const range = maxValue - minValue || 1;
  minValue = Math.min(0, minValue - range * 0.12);
  maxValue = Math.max(0, maxValue + range * 0.12);

  const firstPrice = matrix[0].expirationPrice;
  const lastPrice = matrix[matrix.length - 1].expirationPrice;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  function xScale(price) {
    if (lastPrice === firstPrice) return padding.left;
    return padding.left + ((price - firstPrice) / (lastPrice - firstPrice)) * plotWidth;
  }

  function yScale(value) {
    if (maxValue === minValue) return padding.top + plotHeight / 2;
    return padding.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  }

  function buildPath(selector) {
    let path = "";

    matrix.forEach(function (row, index) {
      path +=
        (index === 0 ? "M" : " L") +
        xScale(row.expirationPrice).toFixed(2) +
        "," +
        yScale(selector(row)).toFixed(2);
    });

    return path;
  }

  const buyAndHoldPath = buildPath(function (row) {
    return row.buyAndHoldReturn;
  });

  const putPath = buildPath(function (row) {
    return row.putReturn;
  });

  const yTicks = [minValue, (minValue + maxValue) / 2, maxValue];
  let grid = "";

  yTicks.forEach(function (tick) {
    const y = yScale(tick);

    grid +=
      '<line x1="' +
      padding.left +
      '" y1="' +
      y.toFixed(2) +
      '" x2="' +
      (width - padding.right) +
      '" y2="' +
      y.toFixed(2) +
      '" stroke="#e5e7eb" stroke-width="1"></line>' +
      '<text x="' +
      (padding.left - 12) +
      '" y="' +
      (y + 4).toFixed(2) +
      '" text-anchor="end" font-size="12" fill="#64748b">' +
      escapeHtml(formatPercent(tick)) +
      "</text>";
  });

  const zeroY = yScale(0);
  const strikeX = xScale(strikePrice);

  let xLabels = "";
  [firstPrice, strikePrice, lastPrice].forEach(function (price) {
    const label = price === strikePrice ? "Strike" : formatCurrency(price);

    xLabels +=
      '<text x="' +
      xScale(price).toFixed(2) +
      '" y="' +
      (height - 18) +
      '" text-anchor="middle" font-size="12" fill="#64748b">' +
      escapeHtml(label) +
      "</text>";
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" role="img" aria-label="Cash-secured put return comparison line chart">' +
    '<rect x="0" y="0" width="' +
    width +
    '" height="' +
    height +
    '" fill="#ffffff"></rect>' +
    grid +
    '<line x1="' +
    padding.left +
    '" y1="' +
    (height - padding.bottom) +
    '" x2="' +
    (width - padding.right) +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1"></line>' +
    '<line x1="' +
    padding.left +
    '" y1="' +
    padding.top +
    '" x2="' +
    padding.left +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1"></line>' +
    '<line x1="' +
    padding.left +
    '" y1="' +
    zeroY.toFixed(2) +
    '" x2="' +
    (width - padding.right) +
    '" y2="' +
    zeroY.toFixed(2) +
    '" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="5 5"></line>' +
    '<line x1="' +
    strikeX.toFixed(2) +
    '" y1="' +
    padding.top +
    '" x2="' +
    strikeX.toFixed(2) +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#10233f" stroke-width="1.5" stroke-dasharray="6 5"></line>' +
    '<text x="' +
    strikeX.toFixed(2) +
    '" y="' +
    (padding.top + 14) +
    '" text-anchor="middle" font-size="12" fill="#10233f">Strike</text>' +
    '<path d="' +
    buyAndHoldPath +
    '" fill="none" stroke="#10233f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<path d="' +
    putPath +
    '" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>' +
    xLabels +
    "</svg>";
}

function setInvalidCashSecuredPut(outputs) {
  outputs.capitalSecured.textContent = "—";
  outputs.totalPremium.textContent = "—";
  outputs.breakeven.textContent = "—";
  outputs.returnOnCash.textContent = "—";
  outputs.annualisedYield.textContent = "—";
  outputs.discountToCurrent.textContent = "—";
  outputs.distanceToStrike.textContent = "—";

  if (outputs.matrixBody) outputs.matrixBody.innerHTML = "";
  if (outputs.chart) outputs.chart.innerHTML = "";

  outputs.interpretation.textContent =
    "Enter valid positive values. The premium must be lower than the strike price.";
}

function buildCashSecuredPutInterpretation(data) {
  const premiumText = formatCurrency(data.totalPremium);
  const capitalText = formatCurrency(data.capitalSecured);
  const basisText = formatCurrency(data.purchaseCostBasis);
  const periodText = formatPercent(data.periodReturn);
  const annualisedText = formatPercent(data.annualisedReturn);
  const discountText = formatPercent(data.discountToCurrent);
  const distanceText = formatPercent(data.distanceToStrike);

  if (data.strikePrice >= data.stockPrice) {
    return (
      "This cash-secured put is at-the-money or in-the-money. You would reserve " +
      capitalText +
      " and collect " +
      premiumText +
      " upfront. If assigned, your effective purchase cost basis would be " +
      basisText +
      ". If the put expires worthless, the period return is " +
      periodText +
      ", or " +
      annualisedText +
      " annualized. Assignment risk is higher because the strike is close to or above the current stock price."
    );
  }

  return (
    "This cash-secured put strike is " +
    distanceText +
    " below the current stock price. You would reserve " +
    capitalText +
    " and collect " +
    premiumText +
    " upfront. If assigned, your effective purchase cost basis becomes " +
    basisText +
    ", a " +
    discountText +
    " discount to the current stock price. If the put expires worthless, the period return is " +
    periodText +
    ", or " +
    annualisedText +
    " annualized."
  );
}
/* -----------------------------
   Covered Call Calculator
----------------------------- */

function initCoveredCallCalculator() {
  const form = document.getElementById("cc-form");

  if (!form) return;

  const inputs = {
    stockPrice: document.getElementById("cc-stock-price"),
    strikePrice: document.getElementById("cc-strike-price"),
    premium: document.getElementById("cc-premium"),
    months: document.getElementById("cc-months"),
    dividend: document.getElementById("cc-dividend"),
    contracts: document.getElementById("cc-contracts")
  };

  const outputs = {
    sharesValue: document.getElementById("cc-shares-value"),
    totalPremium: document.getElementById("cc-total-premium"),
    dividendIncome: document.getElementById("cc-dividend-income"),
    breakeven: document.getElementById("cc-breakeven"),
    periodBonus: document.getElementById("cc-period-bonus"),
    annualisedBonus: document.getElementById("cc-annualised-bonus"),
    returnCalled: document.getElementById("cc-return-called"),
    annualisedCalled: document.getElementById("cc-annualised-called"),
    maxProfit: document.getElementById("cc-max-profit"),
    upsideToStrike: document.getElementById("cc-upside"),
    matrixBody: document.getElementById("cc-matrix-body"),
    chart: document.getElementById("cc-ror-chart"),
    interpretation: document.getElementById("cc-interpretation")
  };

  const update = function () {
    calculateCoveredCall(inputs, outputs);
  };

  registerToolUpdater("covered-call", update);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    update();
  });

  bindLiveToolInputs(form, update);

  update();
}

function calculateCoveredCall(inputs, outputs) {
  const stockPrice = readPositiveNumber(inputs.stockPrice);
  const strikePrice = readPositiveNumber(inputs.strikePrice);
  const premium = readPositiveNumber(inputs.premium);
  const months = readPositiveNumber(inputs.months);
  const dividend = readPositiveNumber(inputs.dividend);
  const contracts = readPositiveInteger(inputs.contracts);

  if (
    stockPrice <= 0 ||
    strikePrice <= 0 ||
    premium < 0 ||
    months <= 0 ||
    dividend < 0 ||
    contracts <= 0
  ) {
    setInvalidCoveredCall(outputs);
    return;
  }

  const contractSize = 100;
  const sharesControlled = contracts * contractSize;
  const sharesValue = stockPrice * sharesControlled;
  const totalPremium = premium * sharesControlled;
  const dividendIncome = dividend * sharesControlled;
  const breakevenPrice = stockPrice - premium - dividend;

  const periodBonus = stockPrice > 0 ? premium / stockPrice : 0;
  const annualisedBonus =
    months > 0 ? Math.pow(1 + periodBonus, 12 / months) - 1 : 0;

  const periodReturnIfCalled =
    stockPrice > 0 ? (strikePrice + premium + dividend) / stockPrice - 1 : 0;

  const annualisedReturnIfCalled =
    months > 0 ? Math.pow(1 + periodReturnIfCalled, 12 / months) - 1 : 0;

  const maxProfitIfCalled =
    (strikePrice - stockPrice + premium + dividend) * sharesControlled;

  const upsideToStrike =
    stockPrice > 0 ? (strikePrice - stockPrice) / stockPrice : 0;

  const matrix = buildCoveredCallMatrix({
    stockPrice,
    strikePrice,
    premium,
    dividend
  });

  outputs.sharesValue.textContent = formatCurrency(sharesValue);
  outputs.totalPremium.textContent = formatCurrency(totalPremium);
  outputs.dividendIncome.textContent = formatCurrency(dividendIncome);
  outputs.breakeven.textContent = formatCurrency(breakevenPrice);
  outputs.periodBonus.textContent = formatPercent(periodBonus);
  outputs.annualisedBonus.textContent = formatPercent(annualisedBonus);
  outputs.returnCalled.textContent = formatPercent(periodReturnIfCalled);
  outputs.annualisedCalled.textContent = formatPercent(annualisedReturnIfCalled);
  outputs.maxProfit.textContent = formatCurrency(maxProfitIfCalled);
  outputs.upsideToStrike.textContent = formatPercent(upsideToStrike);

  renderCoveredCallMatrix(outputs.matrixBody, matrix, strikePrice);
  drawCoveredCallReturnChart(outputs.chart, matrix, strikePrice);

  outputs.interpretation.textContent = buildCoveredCallInterpretation({
    stockPrice,
    strikePrice,
    premium,
    dividend,
    totalPremium,
    dividendIncome,
    breakevenPrice,
    periodBonus,
    annualisedBonus,
    periodReturnIfCalled,
    annualisedReturnIfCalled,
    maxProfitIfCalled,
    upsideToStrike,
    months,
    contracts
  });
}

function buildCoveredCallMatrix(data) {
  const matrix = [];

  for (let step = 82; step <= 118; step += 3) {
    const expirationPrice = data.strikePrice * (step / 100);
    const buyAndHoldReturn =
      data.stockPrice > 0
        ? (expirationPrice + data.dividend) / data.stockPrice - 1
        : 0;

    const callReturn =
      data.stockPrice > 0
        ? (Math.min(expirationPrice, data.strikePrice) + data.premium + data.dividend) / data.stockPrice - 1
        : 0;

    matrix.push({
      expirationPrice,
      buyAndHoldReturn,
      callReturn
    });
  }

  return matrix;
}

function renderCoveredCallMatrix(container, matrix, strikePrice) {
  if (!container) return;

  container.innerHTML = matrix
    .map(function (row) {
      const isStrikeRow = Math.abs(row.expirationPrice - strikePrice) < 0.005;
      const rowClass = isStrikeRow ? " class=\"cc-strike-row\"" : "";
      const priceLabel = isStrikeRow
        ? formatCurrency(row.expirationPrice) + " <span class=\"cc-strike-badge\">Strike</span>"
        : formatCurrency(row.expirationPrice);

      return (
        "<tr" + rowClass + ">" +
        "<td>" +
        priceLabel +
        "</td>" +
        "<td>" +
        formatPercent(row.buyAndHoldReturn) +
        "</td>" +
        "<td>" +
        formatPercent(row.callReturn) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function drawCoveredCallReturnChart(container, matrix, strikePrice) {
  if (!container || !matrix.length) return;

  const width = 900;
  const height = 390;
  const padding = {
    top: 34,
    right: 34,
    bottom: 54,
    left: 78
  };

  const values = [];
  matrix.forEach(function (row) {
    values.push(row.buyAndHoldReturn);
    values.push(row.callReturn);
  });

  let minValue = Math.min.apply(null, values);
  let maxValue = Math.max.apply(null, values);
  const range = maxValue - minValue || 1;
  minValue = Math.min(0, minValue - range * 0.12);
  maxValue = Math.max(0, maxValue + range * 0.12);

  const firstPrice = matrix[0].expirationPrice;
  const lastPrice = matrix[matrix.length - 1].expirationPrice;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  function xScale(price) {
    if (lastPrice === firstPrice) return padding.left;
    return padding.left + ((price - firstPrice) / (lastPrice - firstPrice)) * plotWidth;
  }

  function yScale(value) {
    if (maxValue === minValue) return padding.top + plotHeight / 2;
    return padding.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  }

  function buildPath(selector) {
    let path = "";

    matrix.forEach(function (row, index) {
      path +=
        (index === 0 ? "M" : " L") +
        xScale(row.expirationPrice).toFixed(2) +
        "," +
        yScale(selector(row)).toFixed(2);
    });

    return path;
  }

  const buyAndHoldPath = buildPath(function (row) {
    return row.buyAndHoldReturn;
  });

  const callPath = buildPath(function (row) {
    return row.callReturn;
  });

  const yTicks = [minValue, (minValue + maxValue) / 2, maxValue];
  let grid = "";

  yTicks.forEach(function (tick) {
    const y = yScale(tick);

    grid +=
      '<line x1="' +
      padding.left +
      '" y1="' +
      y.toFixed(2) +
      '" x2="' +
      (width - padding.right) +
      '" y2="' +
      y.toFixed(2) +
      '" stroke="#e5e7eb" stroke-width="1"></line>' +
      '<text x="' +
      (padding.left - 12) +
      '" y="' +
      (y + 4).toFixed(2) +
      '" text-anchor="end" font-size="12" fill="#64748b">' +
      escapeHtml(formatPercent(tick)) +
      "</text>";
  });

  const zeroY = yScale(0);
  const strikeX = xScale(strikePrice);

  let xLabels = "";
  [firstPrice, strikePrice, lastPrice].forEach(function (price) {
    const label = price === strikePrice ? "Strike" : formatCurrency(price);

    xLabels +=
      '<text x="' +
      xScale(price).toFixed(2) +
      '" y="' +
      (height - 18) +
      '" text-anchor="middle" font-size="12" fill="#64748b">' +
      escapeHtml(label) +
      "</text>";
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" role="img" aria-label="Covered call return comparison line chart">' +
    '<rect x="0" y="0" width="' +
    width +
    '" height="' +
    height +
    '" fill="#ffffff"></rect>' +
    grid +
    '<line x1="' +
    padding.left +
    '" y1="' +
    (height - padding.bottom) +
    '" x2="' +
    (width - padding.right) +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1"></line>' +
    '<line x1="' +
    padding.left +
    '" y1="' +
    padding.top +
    '" x2="' +
    padding.left +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1"></line>' +
    '<line x1="' +
    padding.left +
    '" y1="' +
    zeroY.toFixed(2) +
    '" x2="' +
    (width - padding.right) +
    '" y2="' +
    zeroY.toFixed(2) +
    '" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="5 5"></line>' +
    '<line x1="' +
    strikeX.toFixed(2) +
    '" y1="' +
    padding.top +
    '" x2="' +
    strikeX.toFixed(2) +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#10233f" stroke-width="1.5" stroke-dasharray="6 5"></line>' +
    '<text x="' +
    strikeX.toFixed(2) +
    '" y="' +
    (padding.top + 14) +
    '" text-anchor="middle" font-size="12" fill="#10233f">Strike</text>' +
    '<path d="' +
    buyAndHoldPath +
    '" fill="none" stroke="#10233f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<path d="' +
    callPath +
    '" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>' +
    xLabels +
    "</svg>";
}

function setInvalidCoveredCall(outputs) {
  outputs.sharesValue.textContent = "—";
  outputs.totalPremium.textContent = "—";
  outputs.dividendIncome.textContent = "—";
  outputs.breakeven.textContent = "—";
  outputs.periodBonus.textContent = "—";
  outputs.annualisedBonus.textContent = "—";
  outputs.returnCalled.textContent = "—";
  outputs.annualisedCalled.textContent = "—";
  outputs.maxProfit.textContent = "—";
  outputs.upsideToStrike.textContent = "—";

  if (outputs.matrixBody) outputs.matrixBody.innerHTML = "";
  if (outputs.chart) outputs.chart.innerHTML = "";

  outputs.interpretation.textContent =
    "Enter valid positive values to calculate the covered call position.";
}

function buildCoveredCallInterpretation(data) {
  const premiumText = formatCurrency(data.totalPremium);
  const dividendText = formatCurrency(data.dividendIncome);
  const breakevenText = formatCurrency(data.breakevenPrice);
  const maxProfitText = formatCurrency(data.maxProfitIfCalled);
  const periodBonusText = formatPercent(data.periodBonus);
  const annualisedBonusText = formatPercent(data.annualisedBonus);
  const calledReturnText = formatPercent(data.periodReturnIfCalled);
  const annualisedCalledText = formatPercent(data.annualisedReturnIfCalled);
  const upsideText = formatPercent(data.upsideToStrike);

  if (data.strikePrice < data.stockPrice) {
    return (
      "This covered call is in-the-money because the strike is below the current stock price. " +
      "You would collect " +
      premiumText +
      " in premium and " +
      dividendText +
      " in expected dividends, but assignment risk is higher and the strategy behaves more like an intentional exit. " +
      "The capped period return if called away is " +
      calledReturnText +
      ", or " +
      annualisedCalledText +
      " annualized. Breakeven after premium and dividends is " +
      breakevenText +
      "."
    );
  }

  return (
    "This covered call strike is " +
    upsideText +
    " above the current stock price. You would collect " +
    premiumText +
    " in premium and " +
    dividendText +
    " in expected dividends. If the call expires worthless, the period bonus is " +
    periodBonusText +
    ", or " +
    annualisedBonusText +
    " annualized. If called away, the capped profit is " +
    maxProfitText +
    ", equal to a period return of " +
    calledReturnText +
    " or " +
    annualisedCalledText +
    " annualized. Breakeven after premium and dividends is " +
    breakevenText +
    "."
  );
}


function initWheelStrategyCalculator() {
  const form = document.getElementById("wheel-strategy-form");

  if (!form) return;

  registerToolUpdater("wheel-strategy", updateWheelStrategy);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    updateWheelStrategy();
  });

  bindLiveToolInputs(form, updateWheelStrategy);

  updateWheelStrategy();
}

function updateWheelStrategy() {
  const inputs = readWheelInputs();

  if (!inputs.valid) {
    setInvalidWheelStrategy(inputs.message);
    return;
  }

  const model = buildWheelModel(inputs);
  const matrix = buildWheelMatrix(model);
  const scenario = calculateWheelScenario(model, inputs.scenario, inputs.finalPrice);

  renderWheelScenarioOutputs(scenario, model);
  renderWheelComponents(model);
  renderWheelSummary(model, inputs.scenario);
  renderWheelInterpretation(scenario, model);
  renderWheelMatrix(document.getElementById("wheel-matrix-body"), matrix, model);
  drawWheelChart(document.getElementById("wheel-cycle-chart"), matrix, model);
}

function readWheelInputs() {
  const currentPrice = readPositiveNumber(document.getElementById("wheel-current-price"));
  const contracts = readPositiveInteger(document.getElementById("wheel-contracts"));
  const putStrike = readPositiveNumber(document.getElementById("wheel-put-strike"));
  const putPremium = readNumberAllowZero("wheel-put-premium");
  const putDays = readPositiveNumber(document.getElementById("wheel-put-days"));
  const dividend = readNumberAllowZero("wheel-dividend");
  const callStrike = readPositiveNumber(document.getElementById("wheel-call-strike"));
  const callPremium = readNumberAllowZero("wheel-call-premium");
  const callDays = readPositiveNumber(document.getElementById("wheel-call-days"));
  const finalPrice = readPositiveNumber(document.getElementById("wheel-final-price"));
  const scenarioSelect = document.getElementById("wheel-scenario");
  const scenario = scenarioSelect ? scenarioSelect.value : "put-expires";

  const values = [
    currentPrice,
    contracts,
    putStrike,
    putPremium,
    putDays,
    dividend,
    callStrike,
    callPremium,
    callDays,
    finalPrice
  ];

  if (values.some(function (value) { return value === null || !Number.isFinite(value); })) {
    return {
      valid: false,
      message: "Please enter valid numeric values for all Wheel inputs."
    };
  }

  if (
    currentPrice <= 0 ||
    contracts <= 0 ||
    putStrike <= 0 ||
    putPremium < 0 ||
    putDays <= 0 ||
    dividend < 0 ||
    callStrike <= 0 ||
    callPremium < 0 ||
    callDays <= 0 ||
    finalPrice <= 0
  ) {
    return {
      valid: false,
      message: "Prices, days, contracts and final price must be positive. Premiums and dividends may be zero."
    };
  }

  return {
    valid: true,
    currentPrice,
    contracts,
    putStrike,
    putPremium,
    putDays,
    dividend,
    callStrike,
    callPremium,
    callDays,
    finalPrice,
    scenario
  };
}

function buildWheelModel(inputs) {
  const shares = inputs.contracts * 100;
  const cashSecured = inputs.putStrike * shares;
  const stockOnlyCapital = inputs.currentPrice * shares;
  const assignedCapital = inputs.putStrike * shares;
  const fullCycleDays = inputs.putDays + inputs.callDays;

  const putPremiumIncome = inputs.putPremium * shares;
  const callPremiumIncome = inputs.callPremium * shares;
  const dividendIncome = inputs.dividend * shares;
  const totalPremiumIncome = putPremiumIncome + callPremiumIncome;
  const fullCycleIncome = totalPremiumIncome + dividendIncome;

  const netBasisAfterPut = inputs.putStrike - inputs.putPremium;
  const fullIncomeBreakeven = inputs.putStrike - inputs.putPremium - inputs.callPremium - inputs.dividend;
  const putPeriodReturn = putPremiumIncome / cashSecured;
  const putAnnualizedReturn = annualizeReturn(putPeriodReturn, inputs.putDays);

  const calledAwaySharePnl = (inputs.callStrike - inputs.putStrike) * shares;
  const calledAwayPnl = calledAwaySharePnl + fullCycleIncome;
  const calledAwayReturn = calledAwayPnl / cashSecured;
  const calledAwayAnnualizedReturn = annualizeReturn(calledAwayReturn, fullCycleDays);

  return Object.assign({}, inputs, {
    shares,
    cashSecured,
    stockOnlyCapital,
    assignedCapital,
    fullCycleDays,
    putPremiumIncome,
    callPremiumIncome,
    dividendIncome,
    totalPremiumIncome,
    fullCycleIncome,
    netBasisAfterPut,
    fullIncomeBreakeven,
    putPeriodReturn,
    putAnnualizedReturn,
    calledAwaySharePnl,
    calledAwayPnl,
    calledAwayReturn,
    calledAwayAnnualizedReturn,
    distanceToPutStrike: (inputs.currentPrice - inputs.putStrike) / inputs.currentPrice,
    upsideToCallStrike: (inputs.callStrike - inputs.currentPrice) / inputs.currentPrice
  });
}

function calculateWheelScenario(model, selectedScenario, finalPrice) {
  if (selectedScenario === "assigned-holding") {
    const stockPnl = (finalPrice - model.putStrike) * model.shares;
    const pnl = stockPnl + model.fullCycleIncome;
    const ror = pnl / model.cashSecured;

    return {
      key: "assigned-holding",
      title: "Assigned + Holding Shares",
      primaryLabel: "Open Net P/L at Final Price",
      primaryValue: pnl,
      pnl,
      ror,
      annualized: annualizeReturn(ror, model.fullCycleDays),
      stockPnl,
      finalPrice,
      state: finalPrice >= model.callStrike ? "Above call strike, but selected scenario assumes not called yet" : "Open stock position"
    };
  }

  if (selectedScenario === "assigned-called") {
    return {
      key: "assigned-called",
      title: "Assigned + Called Away",
      primaryLabel: "Total Cycle Profit",
      primaryValue: model.calledAwayPnl,
      pnl: model.calledAwayPnl,
      ror: model.calledAwayReturn,
      annualized: model.calledAwayAnnualizedReturn,
      stockPnl: model.calledAwaySharePnl,
      finalPrice: model.callStrike,
      state: "Cycle closed at call strike"
    };
  }

  return {
    key: "put-expires",
    title: "Put Expires Worthless",
    primaryLabel: "Put Premium Received",
    primaryValue: model.putPremiumIncome,
    pnl: model.putPremiumIncome,
    ror: model.putPeriodReturn,
    annualized: model.putAnnualizedReturn,
    stockPnl: 0,
    finalPrice: model.finalPrice,
    state: "No assignment, no shares owned"
  };
}

function buildWheelMatrix(model) {
  const anchors = [
    model.currentPrice,
    model.putStrike,
    model.callStrike,
    model.fullIncomeBreakeven,
    model.finalPrice,
    model.currentPrice * 0.8,
    model.currentPrice * 0.9,
    model.currentPrice * 1.1,
    model.currentPrice * 1.2
  ];

  const low = Math.max(0.01, Math.min.apply(null, anchors.filter(isFiniteNumber)) * 0.92);
  const high = Math.max.apply(null, anchors.filter(isFiniteNumber)) * 1.08;
  const steps = 14;
  const prices = [];

  for (let i = 0; i <= steps; i += 1) {
    prices.push(low + ((high - low) / steps) * i);
  }

  prices.push(model.currentPrice, model.putStrike, model.callStrike, model.fullIncomeBreakeven, model.finalPrice);

  return prices
    .filter(function (price) { return Number.isFinite(price) && price > 0; })
    .map(function (price) { return Math.round(price * 100) / 100; })
    .sort(function (a, b) { return a - b; })
    .filter(function (price, index, array) {
      return index === 0 || Math.abs(price - array[index - 1]) >= 0.01;
    })
    .map(function (price) {
      const stockOnlyPnl = (price - model.currentPrice + model.dividend) * model.shares;
      const stockOnlyReturn = stockOnlyPnl / model.stockOnlyCapital;
      const wheelPnl = calculateWheelPnlAtPrice(model, price);
      const wheelReturn = wheelPnl / model.cashSecured;
      const outcome = describeWheelOutcomeAtPrice(model, price);

      return {
        price,
        outcome,
        stockOnlyPnl,
        stockOnlyReturn,
        wheelPnl,
        wheelReturn
      };
    });
}

function calculateWheelPnlAtPrice(model, price) {
  if (price < model.callStrike) {
    return (price - model.putStrike) * model.shares + model.fullCycleIncome;
  }

  return model.calledAwayPnl;
}

function describeWheelOutcomeAtPrice(model, price) {
  if (Math.abs(price - model.fullIncomeBreakeven) < 0.01) return "Income Breakeven";
  if (Math.abs(price - model.currentPrice) < 0.01) return "Current Price";
  if (Math.abs(price - model.putStrike) < 0.01) return "Put Strike / Assignment Zone";
  if (Math.abs(price - model.callStrike) < 0.01) return "Call Strike / Exit Zone";
  if (price < model.fullIncomeBreakeven) return "Assigned + Loss Zone";
  if (price < model.putStrike) return "Assigned + Recovery Zone";
  if (price < model.callStrike) return "Assigned + Holding Zone";
  return "Called Away / Capped Upside";
}

function renderWheelScenarioOutputs(scenario, model) {
  const container = document.getElementById("wheel-results");
  if (!container) return;

  let extraCards = "";

  if (scenario.key === "put-expires") {
    extraCards = `
      ${wheelResultCard("Capital Secured", formatCurrency(model.cashSecured))}
      ${wheelResultCard("Return on Secured Cash", formatPercent(scenario.ror))}
      ${wheelResultCard("Annualised Put Return", formatPercent(scenario.annualized))}
      ${wheelResultCard("Distance to Put Strike", formatPercent(model.distanceToPutStrike))}
      ${wheelResultCard("Effective Entry If Assigned", formatCurrency(model.netBasisAfterPut))}
    `;
  } else if (scenario.key === "assigned-holding") {
    extraCards = `
      ${wheelResultCard("Final Stock Price", formatCurrency(scenario.finalPrice))}
      ${wheelResultCard("Stock Mark-to-Market P/L", formatCurrency(scenario.stockPnl))}
      ${wheelResultCard("Total Income Collected", formatCurrency(model.fullCycleIncome))}
      ${wheelResultCard("Income-Adjusted Breakeven", formatCurrency(model.fullIncomeBreakeven))}
      ${wheelResultCard("Open Return", formatPercent(scenario.ror))}
      ${wheelResultCard("Annualised Open Return", formatPercent(scenario.annualized))}
    `;
  } else {
    extraCards = `
      ${wheelResultCard("Share Gain / Loss", formatCurrency(model.calledAwaySharePnl))}
      ${wheelResultCard("Total Income Collected", formatCurrency(model.fullCycleIncome))}
      ${wheelResultCard("Period RoR If Called", formatPercent(scenario.ror))}
      ${wheelResultCard("Annualised RoR If Called", formatPercent(scenario.annualized))}
      ${wheelResultCard("Upside to Call Strike", formatPercent(model.upsideToCallStrike))}
    `;
  }

  container.innerHTML = `
    <div class="tool-result-card wheel-selected-scenario-card">
      <span>Selected Scenario</span>
      <strong>${escapeHtmlSafe(scenario.title)}</strong>
    </div>
    <div class="tool-result-card tool-result-card-primary wheel-primary-card">
      <span>${escapeHtmlSafe(scenario.primaryLabel)}</span>
      <strong>${formatCurrency(scenario.primaryValue)}</strong>
    </div>
    ${extraCards}
  `;
}

function renderWheelComponents(model) {
  const container = document.getElementById("wheel-cycle-components");
  if (!container) return;

  container.innerHTML = `
    ${wheelSummaryCard("Put Premium", formatCurrency(model.putPremiumIncome), "Earned only if the initial put is sold.")}
    ${wheelSummaryCard("Call Premium", formatCurrency(model.callPremiumIncome), "Earned only after assignment, when shares are owned.")}
    ${wheelSummaryCard("Dividend Income", formatCurrency(model.dividendIncome), "Included during the stock ownership phase.")}
    ${wheelSummaryCard("Total Full-Cycle Income", formatCurrency(model.fullCycleIncome), "Put premium + call premium + expected dividend.")}
    ${wheelSummaryCard("Cash Secured", formatCurrency(model.cashSecured), "Capital reserved for assignment.")}
    ${wheelSummaryCard("Full Income Breakeven", formatCurrency(model.fullIncomeBreakeven), "Put strike minus put premium, call premium and dividend.")}
  `;
}

function renderWheelSummary(model, selectedScenario) {
  const container = document.getElementById("wheel-summary");
  if (!container) return;

  const putExpiresClass = selectedScenario === "put-expires" ? " tool-summary-card-active" : "";
  const assignedClass = selectedScenario === "assigned-holding" ? " tool-summary-card-active" : "";
  const calledClass = selectedScenario === "assigned-called" ? " tool-summary-card-active" : "";

  const assignedAtFinal = calculateWheelScenario(model, "assigned-holding", model.finalPrice);

  container.innerHTML = `
    <div class="tool-summary-card${putExpiresClass}">
      <span class="tool-summary-label">Scenario 1</span>
      <strong>Put Expires Worthless</strong>
      <p>P/L: ${formatCurrency(model.putPremiumIncome)}</p>
      <p>Return: ${formatPercent(model.putPeriodReturn)}</p>
      <p>Annualised: ${formatPercent(model.putAnnualizedReturn)}</p>
    </div>

    <div class="tool-summary-card${assignedClass}">
      <span class="tool-summary-label">Scenario 2</span>
      <strong>Assigned + Holding</strong>
      <p>P/L at final price: ${formatCurrency(assignedAtFinal.pnl)}</p>
      <p>Breakeven: ${formatCurrency(model.fullIncomeBreakeven)}</p>
      <p>Return: ${formatPercent(assignedAtFinal.ror)}</p>
    </div>

    <div class="tool-summary-card${calledClass}">
      <span class="tool-summary-label">Scenario 3</span>
      <strong>Assigned + Called Away</strong>
      <p>Total profit: ${formatCurrency(model.calledAwayPnl)}</p>
      <p>Return: ${formatPercent(model.calledAwayReturn)}</p>
      <p>Annualised: ${formatPercent(model.calledAwayAnnualizedReturn)}</p>
    </div>
  `;
}

function renderWheelInterpretation(scenario, model) {
  const interpretation = document.getElementById("wheel-interpretation");
  if (!interpretation) return;

  if (scenario.key === "put-expires") {
    interpretation.innerHTML = `
      The put expires worthless, so the only realised income is the put premium: <strong>${formatCurrency(model.putPremiumIncome)}</strong>.
      No call premium or dividend is included because no shares were assigned. The return on secured cash is <strong>${formatPercent(model.putPeriodReturn)}</strong>.
    `;
    return;
  }

  if (scenario.key === "assigned-holding") {
    interpretation.innerHTML = `
      The put is assigned and the position remains open at the selected final price of <strong>${formatCurrency(model.finalPrice)}</strong>.
      The model includes stock mark-to-market P/L plus put premium, call premium and dividend.
      Full-cycle income reduces breakeven to <strong>${formatCurrency(model.fullIncomeBreakeven)}</strong>, but downside risk remains if the stock falls below that level.
    `;
    return;
  }

  interpretation.innerHTML = `
    The full Wheel cycle closes because the shares are called away at the call strike.
    Total profit includes share gain or loss, put premium, call premium and dividend.
    The estimated cycle profit is <strong>${formatCurrency(model.calledAwayPnl)}</strong>, or <strong>${formatPercent(model.calledAwayReturn)}</strong> on secured capital.
  `;
}

function renderWheelMatrix(container, matrix, model) {
  if (!container) return;

  container.innerHTML = matrix.map(function (row) {
    const classes = [];
    const badges = [];

    if (Math.abs(row.price - model.currentPrice) < 0.01) {
      classes.push("wheel-current-row");
      badges.push("Current");
    }

    if (Math.abs(row.price - model.putStrike) < 0.01) {
      classes.push("wheel-put-row");
      badges.push("Put Strike");
    }

    if (Math.abs(row.price - model.fullIncomeBreakeven) < 0.01) {
      classes.push("wheel-breakeven-row");
      badges.push("Breakeven");
    }

    if (Math.abs(row.price - model.callStrike) < 0.01) {
      classes.push("wheel-call-row");
      badges.push("Call Strike");
    }

    const badgeMarkup = badges.map(function (badge) {
      return ' <span class="wheel-strike-badge">' + escapeHtmlSafe(badge) + '</span>';
    }).join("");

    const rowClass = classes.length ? ' class="' + classes.join(" ") + '"' : "";

    return (
      "<tr" + rowClass + ">" +
      "<td>" + formatCurrency(row.price) + badgeMarkup + "</td>" +
      "<td>" + escapeHtmlSafe(row.outcome) + "</td>" +
      "<td>" + formatCurrency(row.stockOnlyPnl) + "</td>" +
      "<td>" + formatPercent(row.stockOnlyReturn) + "</td>" +
      "<td>" + formatCurrency(row.wheelPnl) + "</td>" +
      "<td>" + formatPercent(row.wheelReturn) + "</td>" +
      "</tr>"
    );
  }).join("");
}

function drawWheelChart(container, matrix, model) {
  if (!container || !matrix || !matrix.length) return;

  const width = 900;
  const height = 390;
  const padding = { top: 38, right: 38, bottom: 58, left: 92 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = [];
  matrix.forEach(function (row) {
    values.push(row.stockOnlyPnl, row.wheelPnl);
  });

  let minValue = Math.min.apply(null, values);
  let maxValue = Math.max.apply(null, values);
  const valueRange = maxValue - minValue || 1;
  minValue = Math.min(0, minValue - valueRange * 0.14);
  maxValue = Math.max(0, maxValue + valueRange * 0.14);

  const firstPrice = matrix[0].price;
  const lastPrice = matrix[matrix.length - 1].price;

  function xScale(price) {
    if (lastPrice === firstPrice) return padding.left;
    return padding.left + ((price - firstPrice) / (lastPrice - firstPrice)) * plotWidth;
  }

  function yScale(value) {
    if (maxValue === minValue) return padding.top + plotHeight / 2;
    return padding.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  }

  function pathFor(key) {
    return matrix.map(function (row, index) {
      return (index === 0 ? "M" : "L") + xScale(row.price).toFixed(2) + "," + yScale(row[key]).toFixed(2);
    }).join(" ");
  }

  const yTicks = [minValue, 0, maxValue];
  let grid = "";

  yTicks.forEach(function (tick) {
    const y = yScale(tick);
    grid +=
      '<line x1="' + padding.left + '" y1="' + y.toFixed(2) + '" x2="' + (width - padding.right) + '" y2="' + y.toFixed(2) + '" stroke="#e5e7eb" stroke-width="1"></line>' +
      '<text x="' + (padding.left - 12) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end" font-size="12" fill="#64748b">' +
      escapeHtmlSafe(formatCurrency(tick)) +
      '</text>';
  });

  function verticalMarker(price, label, yOffset) {
    if (!Number.isFinite(price) || price < firstPrice || price > lastPrice) return "";
    const x = xScale(price);
    return (
      '<line x1="' + x.toFixed(2) + '" y1="' + padding.top + '" x2="' + x.toFixed(2) + '" y2="' + (height - padding.bottom) + '" stroke="#10233f" stroke-width="1.4" stroke-dasharray="6 5"></line>' +
      '<text x="' + x.toFixed(2) + '" y="' + (padding.top + yOffset) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#10233f">' +
      escapeHtmlSafe(label) +
      '</text>'
    );
  }

  let xLabels = "";
  [firstPrice, model.currentPrice, model.putStrike, model.callStrike, lastPrice].forEach(function (price) {
    if (!Number.isFinite(price) || price < firstPrice || price > lastPrice) return;
    let label = formatCurrency(price);
    if (Math.abs(price - model.currentPrice) < 0.01) label = "Current";
    if (Math.abs(price - model.putStrike) < 0.01) label = "Put";
    if (Math.abs(price - model.callStrike) < 0.01) label = "Call";

    xLabels += '<text x="' + xScale(price).toFixed(2) + '" y="' + (height - 20) + '" text-anchor="middle" font-size="12" fill="#64748b">' + escapeHtmlSafe(label) + '</text>';
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Wheel cycle profit and loss comparison line chart">' +
    '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#ffffff"></rect>' +
    grid +
    '<line x1="' + padding.left + '" y1="' + (height - padding.bottom) + '" x2="' + (width - padding.right) + '" y2="' + (height - padding.bottom) + '" stroke="#94a3b8" stroke-width="1"></line>' +
    '<line x1="' + padding.left + '" y1="' + padding.top + '" x2="' + padding.left + '" y2="' + (height - padding.bottom) + '" stroke="#94a3b8" stroke-width="1"></line>' +
    verticalMarker(model.currentPrice, "Current", 14) +
    verticalMarker(model.putStrike, "Put", 32) +
    verticalMarker(model.fullIncomeBreakeven, "B/E", 50) +
    verticalMarker(model.callStrike, "Call", 68) +
    '<path d="' + pathFor("stockOnlyPnl") + '" fill="none" stroke="#10233f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<path d="' + pathFor("wheelPnl") + '" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>' +
    xLabels +
    '</svg>';
}

function setInvalidWheelStrategy(message) {
  const resultContainer = document.getElementById("wheel-results");
  const components = document.getElementById("wheel-cycle-components");
  const summary = document.getElementById("wheel-summary");
  const interpretation = document.getElementById("wheel-interpretation");
  const matrixBody = document.getElementById("wheel-matrix-body");
  const chart = document.getElementById("wheel-cycle-chart");

  const card = `
    <div class="tool-result-card">
      <span>Invalid Input</span>
      <strong>${escapeHtmlSafe(message || "Please check the Wheel inputs.")}</strong>
    </div>
  `;

  if (resultContainer) resultContainer.innerHTML = card;
  if (components) components.innerHTML = "";
  if (summary) summary.innerHTML = "";
  if (interpretation) interpretation.innerHTML = escapeHtmlSafe(message || "Please check the Wheel inputs.");
  if (matrixBody) matrixBody.innerHTML = "";
  if (chart) chart.innerHTML = "";
}

function annualizeReturn(periodReturn, days) {
  if (!Number.isFinite(periodReturn) || !Number.isFinite(days) || days <= 0) return 0;
  if (periodReturn <= -1) return -1;

  return Math.pow(1 + periodReturn, 365 / days) - 1;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function wheelResultCard(label, value) {
  return `
    <div class="tool-result-card">
      <span>${escapeHtmlSafe(label)}</span>
      <strong>${escapeHtmlSafe(value)}</strong>
    </div>
  `;
}

function wheelSummaryCard(label, value, note) {
  return `
    <div class="tool-summary-card">
      <span class="tool-summary-label">${escapeHtmlSafe(label)}</span>
      <strong>${escapeHtmlSafe(value)}</strong>
      <p>${escapeHtmlSafe(note)}</p>
    </div>
  `;
}

function escapeHtmlSafe(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (typeof escapeHtml !== "function") {
  var escapeHtml = escapeHtmlSafe;
}

function readNumberAllowZero(id) {
  const input = document.getElementById(id);
  if (!input) return null;

  const value = parseFloat(input.value);

  if (Number.isNaN(value)) return null;

  return value;
}

/* -----------------------------
   Portfolio Income Planner
----------------------------- */

function initPortfolioIncomePlanner() {
  const form = document.getElementById("portfolio-income-form");

  if (!form) return;

  registerToolUpdater("portfolio-income", calculatePortfolioIncomePlanner);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    calculatePortfolioIncomePlanner();
  });

  bindLiveToolInputs(form, calculatePortfolioIncomePlanner);

  calculatePortfolioIncomePlanner();
}

function calculatePortfolioIncomePlanner() {
  const resultContainer = document.getElementById("pi-results");
  const riskContainer = document.getElementById("pi-risk-snapshot");
  const compoundingContainer = document.getElementById("pi-compounding-results");
  const chartContainer = document.getElementById("pi-capital-projection-chart");
  const interpretation = document.getElementById("pi-interpretation");

  if (!resultContainer || !riskContainer || !compoundingContainer || !interpretation) return;

  const rows = [];

  for (let index = 1; index <= 5; index++) {
    const row = readPortfolioIncomeRow(index);

    if (row) {
      rows.push(row);
    }
  }

  if (!rows.length) {
    setInvalidPortfolioIncomePlanner();
    return;
  }

  const totalCapitalAllocated = rows.reduce(function (sum, row) {
    return sum + row.capitalAllocated;
  }, 0);

  const totalPremiumIncome = rows.reduce(function (sum, row) {
    return sum + row.premiumIncome;
  }, 0);

  const totalDividendIncome = rows.reduce(function (sum, row) {
    return sum + row.dividendIncome;
  }, 0);

  const totalExpectedIncome = totalPremiumIncome + totalDividendIncome;

  const totalAnnualisedIncome = rows.reduce(function (sum, row) {
    return sum + row.income * (365 / row.days);
  }, 0);

  const assignmentExposure = rows.reduce(function (sum, row) {
    return sum + (row.strategy === "cash-secured-put" ? row.capitalAllocated : 0);
  }, 0);

  const largestPosition = rows.reduce(function (max, row) {
    return Math.max(max, row.capitalAllocated);
  }, 0);

  const currentCycleYield = totalCapitalAllocated > 0 ? totalExpectedIncome / totalCapitalAllocated : 0;
  const annualisedPortfolioYield = totalCapitalAllocated > 0 ? totalAnnualisedIncome / totalCapitalAllocated : 0;
  const assignmentExposureRatio = totalCapitalAllocated > 0 ? assignmentExposure / totalCapitalAllocated : 0;
  const largestPositionWeight = totalCapitalAllocated > 0 ? largestPosition / totalCapitalAllocated : 0;
  const premiumMix = totalExpectedIncome > 0 ? totalPremiumIncome / totalExpectedIncome : 0;
  const dividendMix = totalExpectedIncome > 0 ? totalDividendIncome / totalExpectedIncome : 0;

  const reinvestmentRate = readPercentageInput("pi-reinvestment-rate", 70);
  const cyclesPerYear = readPositiveNumberWithDefault("pi-cycles-per-year", 12);
  const projectionYears = readPositiveNumberWithDefault("pi-projection-years", 5);

  const totalCycles = cyclesPerYear * projectionYears;
  const reinvestedIncomePerCycle = totalExpectedIncome * reinvestmentRate;
  const withdrawnIncomePerCycle = totalExpectedIncome * (1 - reinvestmentRate);
  const projectedCapital = totalCapitalAllocated * Math.pow(1 + currentCycleYield * reinvestmentRate, totalCycles);
  const projectedCycleIncome = projectedCapital * currentCycleYield;
  const projectedAnnualIncome = projectedCycleIncome * cyclesPerYear;
  const projectedCapitalGainFromReinvestment = projectedCapital - totalCapitalAllocated;
  const capitalProjectionSchedule = buildCapitalProjectionSchedule(
    totalCapitalAllocated,
    currentCycleYield,
    reinvestmentRate,
    cyclesPerYear,
    projectionYears
  );

  const data = {
    rows,
    totalCapitalAllocated,
    totalPremiumIncome,
    totalDividendIncome,
    totalExpectedIncome,
    totalAnnualisedIncome,
    assignmentExposure,
    largestPosition,
    currentCycleYield,
    annualisedPortfolioYield,
    assignmentExposureRatio,
    largestPositionWeight,
    premiumMix,
    dividendMix,
    reinvestmentRate,
    cyclesPerYear,
    projectionYears,
    totalCycles,
    reinvestedIncomePerCycle,
    withdrawnIncomePerCycle,
    projectedCapital,
    projectedCycleIncome,
    projectedAnnualIncome,
    projectedCapitalGainFromReinvestment,
    capitalProjectionSchedule
  };

  resultContainer.innerHTML = buildPortfolioIncomeResults(data);
  riskContainer.innerHTML = buildPortfolioRiskMap(data);
  compoundingContainer.innerHTML = buildPortfolioCompoundingResults(data);
  drawPortfolioCapitalProjectionChart(chartContainer, data.capitalProjectionSchedule);
  interpretation.innerHTML = buildPortfolioIncomeInterpretation(data);
}

function readPortfolioIncomeRow(index) {
  const strategyInput = document.getElementById("pi-strategy-" + index);
  const tickerInput = document.getElementById("pi-ticker-" + index);
  const currentPriceInput = document.getElementById("pi-current-price-" + index);
  const strikeInput = document.getElementById("pi-strike-" + index);
  const premiumInput = document.getElementById("pi-premium-" + index);
  const daysInput = document.getElementById("pi-days-" + index);
  const contractsInput = document.getElementById("pi-contracts-" + index);
  const sharesInput = document.getElementById("pi-shares-" + index);
  const dividendInput = document.getElementById("pi-dividend-" + index);

  if (!strategyInput) return null;

  const strategy = strategyInput.value;
  const ticker = tickerInput ? tickerInput.value.trim().toUpperCase() : "";
  const currentPrice = readNumberFromInput(currentPriceInput);
  const strike = readNumberFromInput(strikeInput);
  const premium = readNumberFromInput(premiumInput);
  const days = readPositiveNumberFromInput(daysInput, strategy === "dividend-only" ? 365 : 30);
  const contracts = readPositiveIntegerFromInput(contractsInput, 0);
  const sharesInputValue = readPositiveIntegerFromInput(sharesInput, 0);
  const dividend = readNumberFromInput(dividendInput);

  if (strategy === "cash-secured-put") {
    if (strike <= 0 || contracts <= 0 || days <= 0 || premium < 0) return null;

    const sharesControlled = contracts * 100;
    const capitalAllocated = strike * sharesControlled;
    const premiumIncome = premium * sharesControlled;
    const dividendIncome = 0;
    const income = premiumIncome;

    return {
      index,
      strategy,
      ticker,
      currentPrice,
      strike,
      premium,
      days,
      contracts,
      shares: sharesControlled,
      dividend,
      capitalAllocated,
      premiumIncome,
      dividendIncome,
      income
    };
  }

  if (strategy === "covered-call") {
    if (currentPrice <= 0 || contracts <= 0 || days <= 0 || premium < 0 || dividend < 0) return null;

    const sharesControlled = contracts * 100;
    const capitalAllocated = currentPrice * sharesControlled;
    const premiumIncome = premium * sharesControlled;
    const dividendIncome = dividend * sharesControlled;
    const income = premiumIncome + dividendIncome;

    return {
      index,
      strategy,
      ticker,
      currentPrice,
      strike,
      premium,
      days,
      contracts,
      shares: sharesControlled,
      dividend,
      capitalAllocated,
      premiumIncome,
      dividendIncome,
      income
    };
  }

  if (strategy === "dividend-only") {
    if (currentPrice <= 0 || sharesInputValue <= 0 || days <= 0 || dividend < 0) return null;

    const capitalAllocated = currentPrice * sharesInputValue;
    const premiumIncome = 0;
    const dividendIncome = dividend * sharesInputValue;
    const income = dividendIncome;

    return {
      index,
      strategy,
      ticker,
      currentPrice,
      strike,
      premium,
      days,
      contracts: 0,
      shares: sharesInputValue,
      dividend,
      capitalAllocated,
      premiumIncome,
      dividendIncome,
      income
    };
  }

  return null;
}

function setInvalidPortfolioIncomePlanner() {
  const resultContainer = document.getElementById("pi-results");
  const riskContainer = document.getElementById("pi-risk-snapshot");
  const compoundingContainer = document.getElementById("pi-compounding-results");
  const chartContainer = document.getElementById("pi-capital-projection-chart");
  const interpretation = document.getElementById("pi-interpretation");

  if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="tool-result-card">
        <span class="tool-result-label">No Active Positions</span>
        <strong>Enter at least one valid row.</strong>
      </div>
    `;
  }

  if (riskContainer) riskContainer.innerHTML = "";
  if (compoundingContainer) compoundingContainer.innerHTML = "";
  if (chartContainer) chartContainer.innerHTML = "";

  if (interpretation) {
    interpretation.innerHTML = "Enter at least one valid income position to calculate portfolio income, assignment exposure, concentration, and compounding estimates.";
  }
}

function buildPortfolioIncomeResults(data) {
  return `
    <div class="tool-result-card">
      <span class="tool-result-label">Capital Allocated</span>
      <strong>${formatCurrency(data.totalCapitalAllocated)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Premium Income</span>
      <strong>${formatCurrency(data.totalPremiumIncome)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Dividend Income</span>
      <strong>${formatCurrency(data.totalDividendIncome)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Total Expected Income</span>
      <strong>${formatCurrency(data.totalExpectedIncome)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Current Cycle Yield</span>
      <strong>${formatPercent(data.currentCycleYield)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Annualised Income Yield</span>
      <strong>${formatPercent(data.annualisedPortfolioYield)}</strong>
    </div>
  `;
}

function buildPortfolioRiskMap(data) {
  const concentrationLabel = data.largestPositionWeight > 0.25 ? "High" : data.largestPositionWeight > 0.15 ? "Moderate" : "Balanced";
  const assignmentLabel = data.assignmentExposureRatio > 0.50 ? "High" : data.assignmentExposureRatio > 0.25 ? "Moderate" : "Low";
  const incomeMixLabel = data.premiumMix > 0.70 ? "Premium-heavy" : data.dividendMix > 0.50 ? "Dividend-heavy" : "Balanced";

  return `
    <div class="tool-summary-card">
      <span class="tool-summary-label">Concentration</span>
      <strong>${escapeHtml(concentrationLabel)}</strong>
      <p>Largest position: ${formatPercent(data.largestPositionWeight)}</p>
      <p>Largest capital block: ${formatCurrency(data.largestPosition)}</p>
    </div>

    <div class="tool-summary-card">
      <span class="tool-summary-label">Assignment Exposure</span>
      <strong>${escapeHtml(assignmentLabel)}</strong>
      <p>Cash-secured put exposure: ${formatCurrency(data.assignmentExposure)}</p>
      <p>Portfolio share: ${formatPercent(data.assignmentExposureRatio)}</p>
    </div>

    <div class="tool-summary-card">
      <span class="tool-summary-label">Income Mix</span>
      <strong>${escapeHtml(incomeMixLabel)}</strong>
      <p>Premium mix: ${formatPercent(data.premiumMix)}</p>
      <p>Dividend mix: ${formatPercent(data.dividendMix)}</p>
    </div>
  `;
}

function buildPortfolioCompoundingResults(data) {
  return `
    <div class="tool-result-card">
      <span class="tool-result-label">Income Reinvested per Cycle</span>
      <strong>${formatCurrency(data.reinvestedIncomePerCycle)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Income Withdrawn per Cycle</span>
      <strong>${formatCurrency(data.withdrawnIncomePerCycle)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Projected Capital</span>
      <strong>${formatCurrency(data.projectedCapital)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Capital Growth from Reinvestment</span>
      <strong>${formatCurrency(data.projectedCapitalGainFromReinvestment)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Projected Cycle Income</span>
      <strong>${formatCurrency(data.projectedCycleIncome)}</strong>
    </div>

    <div class="tool-result-card">
      <span class="tool-result-label">Projected Annual Income</span>
      <strong>${formatCurrency(data.projectedAnnualIncome)}</strong>
    </div>
  `;
}

function buildPortfolioIncomeInterpretation(data) {
  const incomeMixSentence = data.premiumMix > 0.70
    ? "The portfolio is mainly premium-driven, so income depends heavily on option pricing, volatility, and repeatable opportunities."
    : data.dividendMix > 0.50
      ? "The portfolio is mainly dividend-driven, so the income stream is less dependent on option premiums but still depends on dividend sustainability."
      : "The portfolio has a balanced income mix between option premiums and dividends.";

  const assignmentSentence = data.assignmentExposureRatio > 0.50
    ? "Assignment exposure is high, meaning a large portion of allocated capital may convert into stock ownership if puts are assigned."
    : data.assignmentExposureRatio > 0.25
      ? "Assignment exposure is moderate and should be monitored alongside available cash and portfolio concentration."
      : "Assignment exposure is relatively contained based on the current inputs.";

  const concentrationSentence = data.largestPositionWeight > 0.25
    ? "Position concentration is high: one line represents more than 25% of allocated capital."
    : data.largestPositionWeight > 0.15
      ? "Position concentration is moderate: one line carries meaningful weight but does not dominate the portfolio."
      : "Position concentration appears balanced across the active rows.";

  return `
    ${incomeMixSentence}
    ${assignmentSentence}
    ${concentrationSentence}
    Compounding is modelled with a reinvestment rate of <strong>${formatPercent(data.reinvestmentRate)}</strong>,
    <strong>${data.cyclesPerYear.toFixed(1)}</strong> cycles per year, and a <strong>${data.projectionYears.toFixed(1)}</strong>-year projection.
    These figures are simplified planning estimates, not forecasts.
  `;
}

function buildCapitalProjectionSchedule(startingCapital, cycleYield, reinvestmentRate, cyclesPerYear, projectionYears) {
  const schedule = [];

  if (
    !Number.isFinite(startingCapital) ||
    !Number.isFinite(cycleYield) ||
    !Number.isFinite(reinvestmentRate) ||
    !Number.isFinite(cyclesPerYear) ||
    !Number.isFinite(projectionYears) ||
    startingCapital <= 0 ||
    cyclesPerYear <= 0 ||
    projectionYears <= 0
  ) {
    return schedule;
  }

  const fullYears = Math.floor(projectionYears);

  for (let year = 0; year <= fullYears; year++) {
    const cycles = year * cyclesPerYear;

    schedule.push({
      year,
      noReinvestmentCapital: startingCapital,
      reinvestedCapital: startingCapital * Math.pow(1 + cycleYield * reinvestmentRate, cycles)
    });
  }

  if (projectionYears > fullYears) {
    const cycles = projectionYears * cyclesPerYear;

    schedule.push({
      year: projectionYears,
      noReinvestmentCapital: startingCapital,
      reinvestedCapital: startingCapital * Math.pow(1 + cycleYield * reinvestmentRate, cycles)
    });
  }

  if (schedule.length === 1) {
    const cycles = projectionYears * cyclesPerYear;

    schedule.push({
      year: projectionYears,
      noReinvestmentCapital: startingCapital,
      reinvestedCapital: startingCapital * Math.pow(1 + cycleYield * reinvestmentRate, cycles)
    });
  }

  return schedule;
}

function drawPortfolioCapitalProjectionChart(container, schedule) {
  if (!container || !schedule.length) return;

  const width = 900;
  const height = 360;

  const padding = {
    top: 28,
    right: 34,
    bottom: 54,
    left: 82
  };

  const values = [];

  schedule.forEach(function (row) {
    values.push(row.noReinvestmentCapital);
    values.push(row.reinvestedCapital);
  });

  const maxValue = Math.max.apply(null, values) * 1.08;
  const minValue = Math.min.apply(null, values) * 0.96;

  const lastYear = schedule[schedule.length - 1].year || 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  function xScale(year) {
    if (lastYear === 0) return padding.left;
    return padding.left + (year / lastYear) * plotWidth;
  }

  function yScale(value) {
    if (maxValue === minValue) return padding.top + plotHeight / 2;
    return padding.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  }

  const noReinvestmentPath = buildLinePath(
    schedule,
    function (row) {
      return xScale(row.year);
    },
    function (row) {
      return yScale(row.noReinvestmentCapital);
    }
  );

  const reinvestedPath = buildLinePath(
    schedule,
    function (row) {
      return xScale(row.year);
    },
    function (row) {
      return yScale(row.reinvestedCapital);
    }
  );

  const yTicks = [minValue, (minValue + maxValue) / 2, maxValue];
  let grid = "";

  yTicks.forEach(function (tick) {
    const y = yScale(tick);

    grid +=
      '<line x1="' +
      padding.left +
      '" y1="' +
      y.toFixed(2) +
      '" x2="' +
      (width - padding.right) +
      '" y2="' +
      y.toFixed(2) +
      '" stroke="#e5e7eb" stroke-width="1" />';

    grid +=
      '<text x="' +
      (padding.left - 12) +
      '" y="' +
      (y + 4).toFixed(2) +
      '" text-anchor="end" font-size="12" fill="#64748b">' +
      escapeHtml(formatCurrency(tick)) +
      "</text>";
  });

  let xLabels = "";

  schedule.forEach(function (row, index) {
    const isFirst = index === 0;
    const isLast = index === schedule.length - 1;
    const isMiddle = Math.abs(row.year - lastYear / 2) < 0.51;

    if (isFirst || isMiddle || isLast) {
      xLabels +=
        '<text x="' +
        xScale(row.year).toFixed(2) +
        '" y="' +
        (height - 18) +
        '" text-anchor="middle" font-size="12" fill="#64748b">Y' +
        escapeHtml(formatProjectionYear(row.year)) +
        "</text>";
    }
  });

  let dots = "";

  schedule.forEach(function (row) {
    dots +=
      '<circle cx="' +
      xScale(row.year).toFixed(2) +
      '" cy="' +
      yScale(row.noReinvestmentCapital).toFixed(2) +
      '" r="4" fill="#c9a227" />';

    dots +=
      '<circle cx="' +
      xScale(row.year).toFixed(2) +
      '" cy="' +
      yScale(row.reinvestedCapital).toFixed(2) +
      '" r="4" fill="#2e4a8c" />';
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" role="img" aria-label="Projected capital with and without reinvestment">' +
    '<rect x="0" y="0" width="' +
    width +
    '" height="' +
    height +
    '" fill="#f8fafc" />' +
    grid +
    '<line x1="' +
    padding.left +
    '" y1="' +
    (height - padding.bottom) +
    '" x2="' +
    (width - padding.right) +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1" />' +
    '<line x1="' +
    padding.left +
    '" y1="' +
    padding.top +
    '" x2="' +
    padding.left +
    '" y2="' +
    (height - padding.bottom) +
    '" stroke="#94a3b8" stroke-width="1" />' +
    '<path d="' +
    noReinvestmentPath +
    '" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />' +
    '<path d="' +
    reinvestedPath +
    '" fill="none" stroke="#2e4a8c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />' +
    dots +
    xLabels +
    "</svg>";
}

function formatProjectionYear(value) {
  if (Number.isInteger(value)) return String(value);

  return value.toFixed(1);
}

function readNumberFromInput(input) {
  if (!input) return 0;

  const value = Number(input.value);

  if (!Number.isFinite(value)) return 0;

  return value;
}

function readPositiveNumberFromInput(input, fallback) {
  if (!input) return fallback;

  const value = Number(input.value);

  if (!Number.isFinite(value) || value <= 0) return fallback;

  return value;
}

function readPositiveIntegerFromInput(input, fallback) {
  if (!input) return fallback;

  const value = parseInt(input.value, 10);

  if (!Number.isFinite(value) || value < 0) return fallback;

  return value;
}

function readPositiveNumberWithDefault(id, fallback) {
  const input = document.getElementById(id);

  if (!input) return fallback;

  const value = Number(input.value);

  if (!Number.isFinite(value) || value <= 0) return fallback;

  return value;
}

function readPercentageInput(id, fallbackPercent) {
  const input = document.getElementById(id);

  if (!input) return fallbackPercent / 100;

  const value = Number(input.value);

  if (!Number.isFinite(value)) return fallbackPercent / 100;

  return Math.min(Math.max(value / 100, 0), 1);
}

/* -----------------------------
   Helpers
----------------------------- */

function readPositiveNumber(input) {
  if (!input) return 0;

  const value = Number(input.value);

  if (!Number.isFinite(value)) return 0;

  return value;
}

function readPositiveInteger(input) {
  if (!input) return 0;

  const value = parseInt(input.value, 10);

  if (!Number.isFinite(value)) return 0;

  return value;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}