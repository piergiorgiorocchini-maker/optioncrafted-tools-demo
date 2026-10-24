/*
 * OptionsCrafted Premium Quality Engine
 * Version 0.1.0
 *
 * Standalone scoring engine. No DOM dependencies.
 * It does not modify Probability Station by itself.
 */
(function attachPremiumQualityEngine(root) {
  'use strict';

  const VERSION = '0.1.0';

  const STRATEGIES = Object.freeze({
    COVERED_CALL: 'covered_call',
    CASH_SECURED_PUT: 'cash_secured_put'
  });

  const OBJECTIVES = Object.freeze({
    COVERED_CALL: Object.freeze({
      KEEP_SHARES: 'keep_shares',
      BALANCED_INCOME: 'balanced_income',
      EXIT_AT_TARGET: 'exit_at_target',
      MAXIMIZE_INCOME: 'maximize_income'
    }),
    CASH_SECURED_PUT: Object.freeze({
      AVOID_ASSIGNMENT: 'avoid_assignment',
      ACQUIRE_AT_DISCOUNT: 'acquire_at_discount',
      START_WHEEL: 'start_wheel',
      MAXIMIZE_YIELD: 'maximize_yield',
      AGGRESSIVE_ENTRY: 'aggressive_entry'
    })
  });

  const STATUS = Object.freeze({
    STRONG: 'strong',
    GOOD: 'good',
    MIXED: 'mixed',
    WEAK: 'weak',
    LOW: 'low',
    MODERATE: 'moderate',
    ELEVATED: 'elevated',
    HIGH: 'high'
  });

  const MARKET_COMPONENT_WEIGHTS = Object.freeze({
    volatilityEdge: 30,
    premiumEfficiency: 25,
    probabilityQuality: 20,
    strikeSafety: 15,
    executionQuality: 10
  });

  const OBJECTIVE_PROFILES = Object.freeze({
    covered_call: Object.freeze({
      keep_shares: Object.freeze({
        idealDelta: [0.10, 0.25],
        idealAssignmentProbability: [0, 22],
        idealDistancePct: [5, 20],
        yieldWeight: 0.15,
        safetyWeight: 0.55,
        targetWeight: 0,
        description: 'Generate cash flow while prioritising retention of the shares.'
      }),
      balanced_income: Object.freeze({
        idealDelta: [0.20, 0.35],
        idealAssignmentProbability: [15, 38],
        idealDistancePct: [3, 12],
        yieldWeight: 0.30,
        safetyWeight: 0.40,
        targetWeight: 0,
        description: 'Balance premium income and assignment protection.'
      }),
      exit_at_target: Object.freeze({
        idealDelta: [0.30, 0.60],
        idealAssignmentProbability: [30, 70],
        idealDistancePct: [0, 12],
        yieldWeight: 0.20,
        safetyWeight: 0.15,
        targetWeight: 0.45,
        description: 'Generate income while seeking an exit near the selected target price.'
      }),
      maximize_income: Object.freeze({
        idealDelta: [0.35, 0.60],
        idealAssignmentProbability: [35, 68],
        idealDistancePct: [0, 8],
        yieldWeight: 0.50,
        safetyWeight: 0.20,
        targetWeight: 0,
        description: 'Prioritise premium income while accepting a materially higher assignment risk.'
      })
    }),
    cash_secured_put: Object.freeze({
      avoid_assignment: Object.freeze({
        idealDelta: [0.10, 0.25],
        idealAssignmentProbability: [0, 22],
        idealDistancePct: [5, 20],
        yieldWeight: 0.15,
        safetyWeight: 0.55,
        targetWeight: 0,
        description: 'Generate put income while prioritising a low probability of assignment.'
      }),
      acquire_at_discount: Object.freeze({
        idealDelta: [0.30, 0.55],
        idealAssignmentProbability: [30, 68],
        idealDistancePct: [2, 15],
        yieldWeight: 0.20,
        safetyWeight: 0.20,
        targetWeight: 0.40,
        description: 'Seek assignment near a desired purchase price while receiving premium.'
      }),
      start_wheel: Object.freeze({
        idealDelta: [0.20, 0.35],
        idealAssignmentProbability: [18, 42],
        idealDistancePct: [3, 12],
        yieldWeight: 0.30,
        safetyWeight: 0.40,
        targetWeight: 0,
        description: 'Balance premium, entry quality and manageable assignment probability.'
      }),
      maximize_yield: Object.freeze({
        idealDelta: [0.35, 0.60],
        idealAssignmentProbability: [35, 68],
        idealDistancePct: [0, 8],
        yieldWeight: 0.50,
        safetyWeight: 0.20,
        targetWeight: 0,
        description: 'Prioritise premium yield while accepting elevated assignment risk.'
      }),
      aggressive_entry: Object.freeze({
        idealDelta: [0.45, 0.70],
        idealAssignmentProbability: [45, 82],
        idealDistancePct: [0, 8],
        yieldWeight: 0.25,
        safetyWeight: 0.10,
        targetWeight: 0.45,
        description: 'Seek a high-probability entry near a desired purchase price.'
      })
    })
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finiteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function round(value, digits = 1) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function normalisePercent(value) {
    const parsed = finiteNumber(value);
    if (parsed === null) return null;
    return parsed >= 0 && parsed <= 1 ? parsed * 100 : parsed;
  }

  function normaliseDelta(value) {
    const parsed = finiteNumber(value);
    if (parsed === null) return null;
    return clamp(Math.abs(parsed), 0, 1);
  }

  function linearScore(value, points) {
    if (!Number.isFinite(value)) return null;
    if (!Array.isArray(points) || points.length < 2) return null;

    const sorted = [...points].sort((a, b) => a[0] - b[0]);
    if (value <= sorted[0][0]) return sorted[0][1];
    if (value >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index];
      const right = sorted[index + 1];
      if (value >= left[0] && value <= right[0]) {
        const ratio = (value - left[0]) / (right[0] - left[0]);
        return left[1] + ratio * (right[1] - left[1]);
      }
    }

    return null;
  }

  function rangeScore(value, idealMin, idealMax, tolerance = null) {
    if (!Number.isFinite(value)) return null;
    if (value >= idealMin && value <= idealMax) return 100;

    const span = Math.max(idealMax - idealMin, 0.01);
    const allowed = tolerance === null ? span : Math.max(tolerance, 0.01);

    if (value < idealMin) {
      return clamp(100 - ((idealMin - value) / allowed) * 100, 0, 100);
    }

    return clamp(100 - ((value - idealMax) / allowed) * 100, 0, 100);
  }

  function weightedScore(components) {
    let weightedTotal = 0;
    let availableWeight = 0;
    let totalWeight = 0;

    components.forEach(component => {
      totalWeight += component.weight;
      if (Number.isFinite(component.score)) {
        weightedTotal += component.score * component.weight;
        availableWeight += component.weight;
      }
    });

    return {
      score: availableWeight > 0 ? weightedTotal / availableWeight : null,
      confidence: totalWeight > 0 ? (availableWeight / totalWeight) * 100 : 0,
      availableWeight,
      totalWeight
    };
  }

  function positiveStatus(score) {
    if (!Number.isFinite(score)) return 'insufficient_data';
    if (score >= 80) return STATUS.STRONG;
    if (score >= 65) return STATUS.GOOD;
    if (score >= 45) return STATUS.MIXED;
    return STATUS.WEAK;
  }

  function riskStatus(score) {
    if (!Number.isFinite(score)) return 'insufficient_data';
    if (score < 25) return STATUS.LOW;
    if (score < 50) return STATUS.MODERATE;
    if (score < 70) return STATUS.ELEVATED;
    return STATUS.HIGH;
  }

  function inferMetrics(rawInput) {
    const input = rawInput || {};
    const spot = finiteNumber(input.spot);
    const strike = finiteNumber(input.strike);
    const premium = finiteNumber(input.premium);
    const dte = finiteNumber(input.dte);
    const iv = normalisePercent(input.iv);
    const hv = normalisePercent(input.hv);
    const delta = normaliseDelta(input.delta);

    let distancePct = normalisePercent(input.distancePct);
    if (distancePct === null && spot && strike) {
      distancePct = Math.abs(strike - spot) / spot * 100;
    }

    let premiumYieldPct = normalisePercent(input.premiumYieldPct);
    if (premiumYieldPct === null && premium !== null && premium >= 0 && strike && spot) {
      const capitalBase = input.strategy === STRATEGIES.CASH_SECURED_PUT ? strike : spot;
      premiumYieldPct = capitalBase > 0 ? premium / capitalBase * 100 : null;
    }

    let annualizedPremiumYieldPct = normalisePercent(input.annualizedPremiumYieldPct);
    if (annualizedPremiumYieldPct === null && premiumYieldPct !== null && dte && dte > 0) {
      annualizedPremiumYieldPct = premiumYieldPct * (365 / dte);
    }

    let ivHvRatio = finiteNumber(input.ivHvRatio);
    if (ivHvRatio === null && iv !== null && hv !== null && hv > 0) {
      ivHvRatio = iv / hv;
    }

    let assignmentProbability = normalisePercent(input.assignmentProbability);
    const probabilityOTM = normalisePercent(input.probabilityOTM);
    if (assignmentProbability === null && probabilityOTM !== null) {
      assignmentProbability = 100 - probabilityOTM;
    }

    let expectedMovePct = normalisePercent(input.expectedMovePct);
    if (expectedMovePct === null && iv !== null && dte && dte > 0) {
      expectedMovePct = iv * Math.sqrt(dte / 365);
    }

    let distanceToExpectedMove = finiteNumber(input.distanceToExpectedMove);
    if (distanceToExpectedMove === null && distancePct !== null && expectedMovePct && expectedMovePct > 0) {
      distanceToExpectedMove = distancePct / expectedMovePct;
    }

    const bid = finiteNumber(input.bid);
    const ask = finiteNumber(input.ask);
    let spreadPct = normalisePercent(input.spreadPct);
    if (spreadPct === null && bid !== null && ask !== null && ask >= bid) {
      const mid = (bid + ask) / 2;
      spreadPct = mid > 0 ? (ask - bid) / mid * 100 : null;
    }

    return {
      strategy: input.strategy || null,
      objective: input.objective || null,
      spot,
      strike,
      premium,
      dte,
      iv,
      hv,
      ivRank: normalisePercent(input.ivRank),
      ivPercentile: normalisePercent(input.ivPercentile),
      ivHvRatio,
      delta,
      distancePct,
      premiumYieldPct,
      annualizedPremiumYieldPct,
      probabilityOTM,
      assignmentProbability,
      expectedMovePct,
      distanceToExpectedMove,
      spreadPct,
      openInterest: finiteNumber(input.openInterest),
      volume: finiteNumber(input.volume),
      eventRisk: normalisePercent(input.eventRisk),
      trendScore: finiteNumber(input.trendScore),
      seasonalityScore: finiteNumber(input.seasonalityScore),
      targetPrice: finiteNumber(input.targetPrice),
      desiredEntryPrice: finiteNumber(input.desiredEntryPrice),
      positionRiskPct: normalisePercent(input.positionRiskPct)
    };
  }

  function scoreVolatilityEdge(metrics) {
    const ratioScore = linearScore(metrics.ivHvRatio, [
      [0.70, 10],
      [0.90, 35],
      [1.00, 50],
      [1.20, 72],
      [1.50, 90],
      [2.00, 100]
    ]);

    const rankValue = metrics.ivRank !== null ? metrics.ivRank : metrics.ivPercentile;
    const rankScore = linearScore(rankValue, [
      [0, 15],
      [20, 35],
      [40, 55],
      [60, 72],
      [80, 90],
      [100, 100]
    ]);

    const result = weightedScore([
      { score: ratioScore, weight: 65 },
      { score: rankScore, weight: 35 }
    ]);

    return {
      score: result.score,
      confidence: result.confidence,
      details: {
        ivHvRatio: metrics.ivHvRatio,
        ivRankOrPercentile: rankValue,
        ratioScore: round(ratioScore),
        rankScore: round(rankScore)
      }
    };
  }

  function scorePremiumEfficiency(metrics) {
    const yieldScore = linearScore(metrics.annualizedPremiumYieldPct, [
      [0, 0],
      [5, 25],
      [10, 45],
      [20, 68],
      [35, 85],
      [60, 100]
    ]);

    let riskAdjustment = 0;
    if (metrics.eventRisk !== null) {
      riskAdjustment -= Math.max(0, metrics.eventRisk - 35) * 0.35;
    }
    if (metrics.spreadPct !== null) {
      riskAdjustment -= Math.max(0, metrics.spreadPct - 5) * 1.5;
    }

    return {
      score: yieldScore === null ? null : clamp(yieldScore + riskAdjustment, 0, 100),
      confidence: yieldScore === null ? 0 : 100,
      details: {
        premiumYieldPct: metrics.premiumYieldPct,
        annualizedPremiumYieldPct: metrics.annualizedPremiumYieldPct,
        riskAdjustment: round(riskAdjustment)
      }
    };
  }

  function scoreProbabilityQuality(metrics) {
    const probabilityScore = linearScore(metrics.probabilityOTM, [
      [35, 15],
      [50, 40],
      [60, 58],
      [70, 75],
      [80, 90],
      [90, 100]
    ]);

    return {
      score: probabilityScore,
      confidence: probabilityScore === null ? 0 : 100,
      details: {
        probabilityOTM: metrics.probabilityOTM,
        assignmentProbability: metrics.assignmentProbability
      }
    };
  }

  function scoreStrikeSafety(metrics) {
    const expectedMoveScore = linearScore(metrics.distanceToExpectedMove, [
      [0, 5],
      [0.50, 30],
      [0.80, 55],
      [1.00, 70],
      [1.25, 85],
      [1.60, 100]
    ]);

    const deltaScore = linearScore(metrics.delta, [
      [0.05, 100],
      [0.15, 90],
      [0.25, 72],
      [0.35, 52],
      [0.50, 25],
      [0.75, 0]
    ]);

    const result = weightedScore([
      { score: expectedMoveScore, weight: 55 },
      { score: deltaScore, weight: 45 }
    ]);

    return {
      score: result.score,
      confidence: result.confidence,
      details: {
        distancePct: metrics.distancePct,
        expectedMovePct: metrics.expectedMovePct,
        distanceToExpectedMove: metrics.distanceToExpectedMove,
        delta: metrics.delta
      }
    };
  }

  function scoreExecutionQuality(metrics) {
    const spreadScore = metrics.spreadPct === null ? null : linearScore(metrics.spreadPct, [
      [0, 100],
      [2, 95],
      [5, 80],
      [10, 55],
      [20, 20],
      [35, 0]
    ]);

    const openInterestScore = metrics.openInterest === null ? null : linearScore(metrics.openInterest, [
      [0, 0],
      [50, 30],
      [200, 55],
      [500, 75],
      [1000, 90],
      [5000, 100]
    ]);

    const volumeScore = metrics.volume === null ? null : linearScore(metrics.volume, [
      [0, 0],
      [10, 25],
      [50, 50],
      [200, 75],
      [500, 90],
      [2000, 100]
    ]);

    const result = weightedScore([
      { score: spreadScore, weight: 50 },
      { score: openInterestScore, weight: 30 },
      { score: volumeScore, weight: 20 }
    ]);

    return {
      score: result.score,
      confidence: result.confidence,
      details: {
        spreadPct: metrics.spreadPct,
        openInterest: metrics.openInterest,
        volume: metrics.volume
      }
    };
  }

  function calculateMarketQuality(metrics) {
    const volatilityEdge = scoreVolatilityEdge(metrics);
    const premiumEfficiency = scorePremiumEfficiency(metrics);
    const probabilityQuality = scoreProbabilityQuality(metrics);
    const strikeSafety = scoreStrikeSafety(metrics);
    const executionQuality = scoreExecutionQuality(metrics);

    const components = [
      { key: 'volatilityEdge', ...volatilityEdge, weight: MARKET_COMPONENT_WEIGHTS.volatilityEdge },
      { key: 'premiumEfficiency', ...premiumEfficiency, weight: MARKET_COMPONENT_WEIGHTS.premiumEfficiency },
      { key: 'probabilityQuality', ...probabilityQuality, weight: MARKET_COMPONENT_WEIGHTS.probabilityQuality },
      { key: 'strikeSafety', ...strikeSafety, weight: MARKET_COMPONENT_WEIGHTS.strikeSafety },
      { key: 'executionQuality', ...executionQuality, weight: MARKET_COMPONENT_WEIGHTS.executionQuality }
    ];

    const result = weightedScore(components.map(component => ({
      score: component.score,
      weight: component.weight
    })));

    let eventPenalty = 0;
    if (metrics.eventRisk !== null) {
      eventPenalty = Math.max(0, metrics.eventRisk - 50) * 0.20;
    }

    const score = result.score === null ? null : clamp(result.score - eventPenalty, 0, 100);

    return {
      score: round(score),
      status: positiveStatus(score),
      confidence: round(result.confidence),
      eventPenalty: round(eventPenalty),
      components: Object.fromEntries(components.map(component => [component.key, {
        score: round(component.score),
        weight: component.weight,
        confidence: round(component.confidence),
        details: component.details
      }]))
    };
  }

  function scoreTargetAlignment(metrics, profile) {
    if (!profile.targetWeight) return null;

    const target = metrics.strategy === STRATEGIES.COVERED_CALL
      ? metrics.targetPrice
      : metrics.desiredEntryPrice;

    if (!target || !metrics.strike) return null;

    const differencePct = Math.abs(metrics.strike - target) / target * 100;
    return linearScore(differencePct, [
      [0, 100],
      [1, 95],
      [2.5, 82],
      [5, 60],
      [10, 25],
      [20, 0]
    ]);
  }

  function calculateObjectiveFit(metrics) {
    const strategyProfiles = OBJECTIVE_PROFILES[metrics.strategy];
    const profile = strategyProfiles ? strategyProfiles[metrics.objective] : null;

    if (!profile) {
      return {
        score: null,
        status: 'objective_required',
        confidence: 0,
        profile: null,
        components: {},
        message: 'A supported strategy and objective are required.'
      };
    }

    const deltaScore = rangeScore(
      metrics.delta,
      profile.idealDelta[0],
      profile.idealDelta[1],
      0.20
    );

    const assignmentScore = rangeScore(
      metrics.assignmentProbability,
      profile.idealAssignmentProbability[0],
      profile.idealAssignmentProbability[1],
      30
    );

    const distanceScore = rangeScore(
      metrics.distancePct,
      profile.idealDistancePct[0],
      profile.idealDistancePct[1],
      10
    );

    const yieldScore = linearScore(metrics.annualizedPremiumYieldPct, [
      [0, 0],
      [5, 25],
      [10, 45],
      [20, 68],
      [35, 85],
      [60, 100]
    ]);

    const targetScore = scoreTargetAlignment(metrics, profile);

    const components = [
      { key: 'deltaFit', score: deltaScore, weight: 20 },
      { key: 'assignmentFit', score: assignmentScore, weight: profile.safetyWeight * 50 },
      { key: 'distanceFit', score: distanceScore, weight: profile.safetyWeight * 30 },
      { key: 'incomeFit', score: yieldScore, weight: profile.yieldWeight * 50 },
      { key: 'targetFit', score: targetScore, weight: profile.targetWeight * 50 }
    ].filter(component => component.weight > 0);

    const result = weightedScore(components);

    return {
      score: round(result.score),
      status: positiveStatus(result.score),
      confidence: round(result.confidence),
      profile: {
        strategy: metrics.strategy,
        objective: metrics.objective,
        description: profile.description
      },
      components: Object.fromEntries(components.map(component => [component.key, {
        score: round(component.score),
        weight: round(component.weight)
      }]))
    };
  }

  function calculateRiskExposure(metrics) {
    const assignmentRisk = metrics.assignmentProbability;
    const eventRisk = metrics.eventRisk;

    const deltaRisk = metrics.delta === null ? null : linearScore(metrics.delta, [
      [0.05, 5],
      [0.15, 15],
      [0.25, 30],
      [0.40, 55],
      [0.55, 75],
      [0.75, 100]
    ]);

    const gammaRisk = metrics.dte === null ? null : linearScore(metrics.dte, [
      [0, 100],
      [3, 95],
      [7, 82],
      [14, 62],
      [30, 40],
      [60, 25],
      [120, 15]
    ]);

    const liquidityRisk = metrics.spreadPct === null ? null : linearScore(metrics.spreadPct, [
      [0, 0],
      [2, 5],
      [5, 20],
      [10, 45],
      [20, 75],
      [35, 100]
    ]);

    const trendConflictRisk = metrics.trendScore === null ? null : linearScore(metrics.trendScore, [
      [-100, 100],
      [-50, 75],
      [0, 45],
      [50, 20],
      [100, 5]
    ]);

    const concentrationRisk = metrics.positionRiskPct === null ? null : linearScore(metrics.positionRiskPct, [
      [0, 0],
      [2, 10],
      [5, 30],
      [10, 55],
      [20, 80],
      [35, 100]
    ]);

    const components = [
      { key: 'assignmentRisk', score: assignmentRisk, weight: 25 },
      { key: 'eventRisk', score: eventRisk, weight: 20 },
      { key: 'directionalRisk', score: deltaRisk, weight: 20 },
      { key: 'gammaRisk', score: gammaRisk, weight: 15 },
      { key: 'liquidityRisk', score: liquidityRisk, weight: 10 },
      { key: 'trendConflictRisk', score: trendConflictRisk, weight: 5 },
      { key: 'concentrationRisk', score: concentrationRisk, weight: 5 }
    ];

    const result = weightedScore(components);

    return {
      score: round(result.score),
      status: riskStatus(result.score),
      confidence: round(result.confidence),
      components: Object.fromEntries(components.map(component => [component.key, {
        score: round(component.score),
        weight: component.weight
      }]))
    };
  }

  function deriveStrengthsAndWeaknesses(marketQuality, objectiveFit, riskExposure) {
    const strengths = [];
    const weaknesses = [];

    Object.entries(marketQuality.components || {}).forEach(([key, component]) => {
      if (!Number.isFinite(component.score)) return;
      if (component.score >= 75) strengths.push(key);
      if (component.score < 45) weaknesses.push(key);
    });

    Object.entries(objectiveFit.components || {}).forEach(([key, component]) => {
      if (!Number.isFinite(component.score)) return;
      if (component.score >= 75) strengths.push(key);
      if (component.score < 45) weaknesses.push(key);
    });

    Object.entries(riskExposure.components || {}).forEach(([key, component]) => {
      if (!Number.isFinite(component.score)) return;
      if (component.score >= 70) weaknesses.push(key);
    });

    return {
      strengths: [...new Set(strengths)].slice(0, 5),
      weaknesses: [...new Set(weaknesses)].slice(0, 5)
    };
  }

  function calculateOverall(marketQuality, objectiveFit, riskExposure) {
    if (!Number.isFinite(marketQuality.score) || !Number.isFinite(objectiveFit.score)) {
      return {
        score: null,
        status: 'insufficient_data',
        confidence: 0
      };
    }

    const riskControlScore = Number.isFinite(riskExposure.score)
      ? 100 - riskExposure.score
      : null;

    const result = weightedScore([
      { score: marketQuality.score, weight: 55 },
      { score: objectiveFit.score, weight: 35 },
      { score: riskControlScore, weight: 10 }
    ]);

    const confidence = weightedScore([
      { score: marketQuality.confidence, weight: 55 },
      { score: objectiveFit.confidence, weight: 35 },
      { score: riskExposure.confidence, weight: 10 }
    ]).score;

    return {
      score: round(result.score),
      status: positiveStatus(result.score),
      confidence: round(confidence)
    };
  }

  function buildWarnings(metrics, marketQuality, objectiveFit) {
    const warnings = [];

    if (metrics.premium === null && metrics.premiumYieldPct === null) {
      warnings.push('premium_data_missing');
    }
    if (metrics.ivHvRatio === null) {
      warnings.push('iv_hv_comparison_missing');
    }
    if (metrics.probabilityOTM === null && metrics.assignmentProbability === null) {
      warnings.push('probability_data_missing');
    }
    if (!metrics.strategy || !metrics.objective) {
      warnings.push('objective_missing');
    }
    if (metrics.eventRisk === null) {
      warnings.push('event_risk_missing');
    }
    if (marketQuality.confidence < 60) {
      warnings.push('market_quality_low_confidence');
    }
    if (objectiveFit.confidence < 60) {
      warnings.push('objective_fit_low_confidence');
    }

    return warnings;
  }

  function evaluate(rawInput) {
    const metrics = inferMetrics(rawInput);
    const marketQuality = calculateMarketQuality(metrics);
    const objectiveFit = calculateObjectiveFit(metrics);
    const riskExposure = calculateRiskExposure(metrics);
    const overall = calculateOverall(marketQuality, objectiveFit, riskExposure);
    const summary = deriveStrengthsAndWeaknesses(marketQuality, objectiveFit, riskExposure);
    const warnings = buildWarnings(metrics, marketQuality, objectiveFit);

    return {
      engineVersion: VERSION,
      metrics,
      marketQuality,
      objectiveFit,
      riskExposure,
      overall,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
      warnings
    };
  }

  const api = Object.freeze({
    VERSION,
    STRATEGIES,
    OBJECTIVES,
    STATUS,
    evaluate,
    calculateMarketQuality,
    calculateObjectiveFit,
    calculateRiskExposure
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.OptionsCraftedPremiumQuality = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
