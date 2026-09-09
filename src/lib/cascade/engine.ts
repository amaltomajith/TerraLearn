// Cascade (FarmRisk) engine — pure functions, no React, no side-effects.
//
// Design principles (from terralearn_planned_features.md §1):
//   - Never ship a bare number. Output a band + named drivers.
//   - Credit node: district-level aggregate only — never per-farmer debt.
//   - Power node: skip rather than fake a proxy.
//   - Propagation is an explicit, auditable lookup table — not a black box.

import type {
  NodeId,
  NodeScore,
  RiskLevel,
  CascadeResult,
  CascadeInputs,
  ViabilityBand,
} from './types';

// ---------------------------------------------------------------------------
// Level helpers
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<RiskLevel, number> = {
  unknown: -1,
  low: 0,
  moderate: 1,
  elevated: 2,
  high: 3,
  critical: 4,
};

function levelScore(l: RiskLevel): number {
  return Math.max(0, LEVEL_ORDER[l]);
}

/** Bump a level up by `steps`, capped at critical. Ignores 'unknown'. */
function bumpLevel(l: RiskLevel, steps = 1): RiskLevel {
  if (l === 'unknown') return 'unknown';
  const order: RiskLevel[] = ['low', 'moderate', 'elevated', 'high', 'critical'];
  const idx = order.indexOf(l as Exclude<RiskLevel, 'unknown'>);
  return order[Math.min(idx + steps, 4)];
}

// ---------------------------------------------------------------------------
// Individual node scorers
// ---------------------------------------------------------------------------

/** Water: lightweight SPI-3 proxy from 90-day precipitation deficit. */
function scoreWaterNode(inputs: CascadeInputs): NodeScore {
  const base: Omit<NodeScore, 'level' | 'score' | 'detail' | 'dataAvailable'> = {
    nodeId: 'water',
    label: 'Water Stress',
    icon: 'Droplets',
    source: 'Open-Meteo Archive API (historical precipitation)',
  };

  const trends = inputs.climateTrends;
  if (!trends || trends.daily.precipitationSum.length < 90) {
    return {
      ...base,
      level: 'unknown',
      score: 0,
      detail: 'Insufficient climate history',
      dataAvailable: false,
    };
  }

  const precip = trends.daily.precipitationSum;
  // Last 90 days vs prior 90-day window
  const last90 = precip.slice(-90);
  const prior90 = precip.slice(-180, -90);

  const sumLast = last90.reduce((a, b) => a + b, 0);
  const sumPrior = prior90.length > 0 ? prior90.reduce((a, b) => a + b, 0) : sumLast;

  // Deficit fraction: how much below the reference window
  const deficit = prior90.length > 0 ? (sumPrior - sumLast) / Math.max(sumPrior, 1) : 0;

  // Count extreme-rain events (>50 mm/day) in last 90 days — flood signal
  const extremeDays = last90.filter((v) => v > 50).length;

  let level: RiskLevel;
  let detail: string;
  let score: number;

  if (extremeDays >= 5) {
    level = 'high';
    score = 0.8;
    detail = `${extremeDays} extreme-rain days (>50 mm) in 90 days — flood risk`;
  } else if (deficit > 0.5) {
    level = 'high';
    score = 0.75;
    detail = `Rainfall ${Math.round(deficit * 100)}% below 90-day reference — severe deficit`;
  } else if (deficit > 0.3) {
    level = 'elevated';
    score = 0.55;
    detail = `Rainfall ${Math.round(deficit * 100)}% below reference — moderate deficit`;
  } else if (deficit > 0.1) {
    level = 'moderate';
    score = 0.35;
    detail = `Slight rainfall deficit vs 90-day reference`;
  } else {
    level = 'low';
    score = 0.15;
    detail = `Rainfall near or above 90-day reference`;
  }

  return { ...base, level, score, detail, dataAvailable: true };
}

/** Soil: pH and nutrient levels from ISRIC / estimated pipeline. */
function scoreSoilNode(inputs: CascadeInputs): NodeScore {
  const base: Omit<NodeScore, 'level' | 'score' | 'detail' | 'dataAvailable'> = {
    nodeId: 'soil',
    label: 'Soil Health',
    icon: 'Layers',
    source:
      inputs.soil?.source === 'isric'
        ? 'ISRIC SoilGrids (~250 m regional model)'
        : 'Estimated (coordinate heuristic)',
  };

  const soil = inputs.soil;
  if (!soil) {
    return {
      ...base,
      level: 'unknown',
      score: 0,
      detail: 'Soil data unavailable',
      dataAvailable: false,
    };
  }

  // pH risk: 6.0–7.0 optimal for most crops
  const phRisk =
    soil.pH < 4.5 || soil.pH > 8.5 ? 3 : soil.pH < 5.5 || soil.pH > 7.5 ? 2 : soil.pH < 6.0 || soil.pH > 7.0 ? 1 : 0;

  // Nitrogen risk: < 40 cg/kg is low
  const nRisk = soil.nitrogen < 20 ? 3 : soil.nitrogen < 40 ? 2 : soil.nitrogen < 60 ? 1 : 0;

  const totalRisk = phRisk + nRisk;

  let level: RiskLevel;
  let score: number;
  let detail: string;

  if (totalRisk >= 5) {
    level = 'high';
    score = 0.75;
    detail = `pH ${soil.pH}, N ${Math.round(soil.nitrogen)} cg/kg — poor for most crops`;
  } else if (totalRisk >= 3) {
    level = 'elevated';
    score = 0.55;
    detail = `pH ${soil.pH}, N ${Math.round(soil.nitrogen)} cg/kg — moderate deficiencies`;
  } else if (totalRisk >= 1) {
    level = 'moderate';
    score = 0.3;
    detail = `pH ${soil.pH} — minor deviation from optimal`;
  } else {
    level = 'low';
    score = 0.1;
    detail = `pH ${soil.pH}, N ${Math.round(soil.nitrogen)} cg/kg — healthy range`;
  }

  return { ...base, level, score, detail, dataAvailable: true };
}

/** Market: recent mandi price trend from Agmarknet, with seasonal baseline fallback. */
function scoreMarketNode(inputs: CascadeInputs): NodeScore {
  const mandi = inputs.mandiPrices;

  if (mandi) {
    const base: Omit<NodeScore, 'level' | 'score' | 'detail' | 'dataAvailable'> = {
      nodeId: 'market',
      label: 'Market Pressure',
      icon: 'TrendingDown',
      source: 'Agmarknet (data.gov.in)',
    };

    const trend = mandi.trendPct;
    let level: RiskLevel;
    let score: number;
    let detail: string;

    if (trend <= -30) {
      level = 'high';
      score = 0.8;
      detail = `Mandi price down ${Math.abs(trend)}% vs trailing avg — sharp decline`;
    } else if (trend <= -15) {
      level = 'elevated';
      score = 0.6;
      detail = `Mandi price down ${Math.abs(trend)}% vs trailing avg`;
    } else if (trend <= -5) {
      level = 'moderate';
      score = 0.35;
      detail = `Mandi price slightly below trailing avg (${trend}%)`;
    } else if (trend >= 10) {
      level = 'low';
      score = 0.05;
      detail = `Mandi price up ${trend}% — favourable market`;
    } else {
      level = 'low';
      score = 0.1;
      detail = `Mandi price stable (${trend > 0 ? '+' : ''}${trend}% vs trailing avg)`;
    }

    return { ...base, level, score, detail, dataAvailable: true };
  }

  // Graceful fallback: seasonal price baseline (same heuristic used in MarketSignal)
  // Autumn (Sep–Nov) experiences post-monsoon harvest arrival glut; spring/summer is leaner.
  const currentMonth = new Date().getMonth(); // 0-11
  const isHarvestGlut = currentMonth >= 8 && currentMonth <= 10;
  const estimatedTrend = isHarvestGlut ? -12 : 5;

  return {
    nodeId: 'market',
    label: 'Market Pressure',
    icon: 'TrendingDown',
    source: 'Seasonal price baseline (set VITE_AGMARKNET_API_KEY for live mandi)',
    level: isHarvestGlut ? 'moderate' : 'low',
    score: isHarvestGlut ? 0.35 : 0.1,
    detail: isHarvestGlut
      ? `Seasonal post-monsoon harvest window — ${Math.abs(estimatedTrend)}% arrival pressure`
      : `Off-peak season — commodity prices historically steady (+${estimatedTrend}%)`,
    dataAvailable: true,
  };
}

/** Hazard: extreme-event signal from climate trends. Partially overlaps water. */
function scoreHazardNode(inputs: CascadeInputs): NodeScore {
  const base: Omit<NodeScore, 'level' | 'score' | 'detail' | 'dataAvailable'> = {
    nodeId: 'hazard',
    label: 'Hazard Exposure',
    icon: 'CloudLightning',
    source: 'Open-Meteo Archive API (daily precipitation)',
  };

  const trends = inputs.climateTrends;
  if (!trends || trends.daily.precipitationSum.length < 30) {
    return {
      ...base,
      level: 'unknown',
      score: 0,
      detail: 'Insufficient data',
      dataAvailable: false,
    };
  }

  const last30 = trends.daily.precipitationSum.slice(-30);
  const extremeDays = last30.filter((v) => v > 50).length;
  const veryExtremeDays = last30.filter((v) => v > 100).length;

  let level: RiskLevel;
  let score: number;
  let detail: string;

  if (veryExtremeDays >= 2) {
    level = 'critical';
    score = 0.95;
    detail = `${veryExtremeDays} days >100 mm rain in last 30 days — severe flood risk`;
  } else if (extremeDays >= 5) {
    level = 'high';
    score = 0.75;
    detail = `${extremeDays} extreme-rain days (>50 mm) in last 30 days`;
  } else if (extremeDays >= 2) {
    level = 'elevated';
    score = 0.5;
    detail = `${extremeDays} extreme-rain events in last 30 days`;
  } else if (extremeDays === 1) {
    level = 'moderate';
    score = 0.3;
    detail = `1 extreme-rain event in last 30 days`;
  } else {
    level = 'low';
    score = 0.05;
    detail = `No extreme-rain events in last 30 days`;
  }

  return { ...base, level, score, detail, dataAvailable: true };
}

/**
 * Credit node — district-level aggregate only.
 * Ethics constraint (terralearn_planned_features.md §1): never store or display
 * per-farmer debt data. Vidarbha district is the epicenter of India's farmer
 * debt crisis. Always return a static 'moderate' band with a disclaimer.
 */
function scoreCreditNode(): NodeScore {
  return {
    nodeId: 'credit',
    label: 'Credit Stress',
    icon: 'Banknote',
    level: 'moderate',
    score: 0.35,
    detail: 'District-level aggregate indicator (no per-farmer data collected)',
    source: 'Static district aggregate — see data-ethics note',
    dataAvailable: false,
  };
}

/**
 * Power node — no reliable public outage API available yet.
 * Planned features doc: skip the node rather than fabricate a proxy.
 */
function scorePowerNode(): NodeScore {
  return {
    nodeId: 'power',
    label: 'Power Reliability',
    icon: 'Zap',
    level: 'unknown',
    score: 0,
    detail: 'No reliable state-EB outage data source available',
    source: 'Not integrated — state electricity board data pending',
    dataAvailable: false,
  };
}

/** Labour — static placeholder until network has critical mass. */
function scoreLabourNode(): NodeScore {
  return {
    nodeId: 'labour',
    label: 'Labour Availability',
    icon: 'Users',
    level: 'unknown',
    score: 0,
    detail: 'Regional demand curve needs real farmer density data',
    source: 'Not integrated — requires Saath harvest-window aggregates',
    dataAvailable: false,
  };
}

/** Input — static placeholder. */
function scoreInputNode(): NodeScore {
  return {
    nodeId: 'input',
    label: 'Input Costs',
    icon: 'Package',
    level: 'unknown',
    score: 0,
    detail: 'Seed, fertiliser, and pesticide cost data not yet integrated',
    source: 'Not integrated — future IFS seasonal calendar',
    dataAvailable: false,
  };
}

// ---------------------------------------------------------------------------
// Cascade propagation
// ---------------------------------------------------------------------------

/**
 * Explicit causal amplification table. Maps upstream node → downstream node
 * with minimum level trigger and bump steps.
 * This is an auditable lookup, not a black-box model.
 */
const CAUSAL_EDGES: Array<{
  from: NodeId;
  to: NodeId;
  triggerLevel: RiskLevel;
  bumpSteps: number;
  note: string;
}> = [
  {
    from: 'water',
    to: 'hazard',
    triggerLevel: 'high',
    bumpSteps: 1,
    note: 'High water deficit amplifies hazard (drought stress)',
  },
  {
    from: 'hazard',
    to: 'water',
    triggerLevel: 'elevated',
    bumpSteps: 1,
    note: 'Flood events cascade to irrigation failure',
  },
  {
    from: 'market',
    to: 'credit',
    triggerLevel: 'elevated',
    bumpSteps: 1,
    note: 'Declining prices reduce debt-servicing capacity',
  },
  {
    from: 'soil',
    to: 'input',
    triggerLevel: 'elevated',
    bumpSteps: 1,
    note: 'Poor soil forces higher fertiliser input costs',
  },
];

function propagateCascade(nodes: NodeScore[]): NodeScore[] {
  const map = new Map<NodeId, NodeScore>(nodes.map((n) => [n.nodeId, { ...n }]));

  for (const edge of CAUSAL_EDGES) {
    const upstream = map.get(edge.from);
    const downstream = map.get(edge.to);
    if (!upstream || !downstream) continue;
    if (!upstream.dataAvailable) continue; // don't propagate from no-data nodes
    if (LEVEL_ORDER[upstream.level] >= LEVEL_ORDER[edge.triggerLevel]) {
      const bumped = bumpLevel(downstream.level, edge.bumpSteps);
      if (LEVEL_ORDER[bumped] > LEVEL_ORDER[downstream.level]) {
        map.set(edge.to, {
          ...downstream,
          level: bumped,
          score: Math.min(1, downstream.score + 0.2),
          cascadeNote: edge.note,
        });
      }
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Viability band aggregation
// ---------------------------------------------------------------------------

const VIABILITY_EXPLAINS: Record<string, string> = {
  good: 'Conditions look favourable. No major risk factors detected across water, soil, and market nodes.',
  fair: 'Some caution warranted. One or more nodes show moderate stress — monitor closely but no immediate action required.',
  elevated:
    'Multiple risk factors active. Plan contingencies now: consider irrigation backup, market alternatives, or crop insurance enrollment.',
  critical:
    'Severe compounding risk detected. Immediate intervention likely required — consult a KVK extension officer and review your insurance coverage.',
};

function computeViabilityBand(nodes: NodeScore[]): { band: ViabilityBand; explain: string } {
  const dataNodes = nodes.filter((n) => n.dataAvailable);
  if (dataNodes.length === 0) {
    return { band: 'fair', explain: VIABILITY_EXPLAINS.fair };
  }

  const countAtLevel = (l: RiskLevel) => dataNodes.filter((n) => n.level === l).length;

  const critical = countAtLevel('critical');
  const high = countAtLevel('high');
  const elevated = countAtLevel('elevated');

  let band: ViabilityBand;
  if (critical >= 1 || high >= 2) {
    band = 'critical';
  } else if (high >= 1 || elevated >= 3) {
    band = 'elevated';
  } else if (elevated >= 1 || countAtLevel('moderate') >= 2) {
    band = 'fair';
  } else {
    band = 'good';
  }

  return { band, explain: VIABILITY_EXPLAINS[band] };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Compute the full Cascade result from the provided farm inputs. Pure function. */
export function computeCascade(inputs: CascadeInputs): CascadeResult {
  const rawNodes: NodeScore[] = [
    scoreWaterNode(inputs),
    scoreSoilNode(inputs),
    scoreMarketNode(inputs),
    scoreHazardNode(inputs),
    scoreCreditNode(),
    scorePowerNode(),
    scoreLabourNode(),
    scoreInputNode(),
  ];

  const propagated = propagateCascade(rawNodes);

  const { band, explain } = computeViabilityBand(propagated);

  // Top drivers: data-available nodes, sorted by score desc, top 3
  const topDrivers = [...propagated]
    .filter((n) => n.dataAvailable && levelScore(n.level) >= levelScore('moderate'))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    viabilityBand: band,
    viabilityExplain: explain,
    topDrivers,
    allNodes: propagated,
    computedAt: new Date().toISOString(),
  };
}
