// Types for the Cascade (FarmRisk) engine.
// The engine models a farm as a dependency graph across eight nodes and propagates
// shocks along causal edges, producing a Season Viability Band rather than a bare
// number — per the honesty constraint in terralearn_planned_features.md §1.

export type NodeId =
  | 'water'
  | 'soil'
  | 'market'
  | 'credit'
  | 'power'
  | 'labour'
  | 'input'
  | 'hazard';

/** Directional risk level. 'unknown' means no reliable data source is available. */
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical' | 'unknown';

export interface NodeScore {
  nodeId: NodeId;
  level: RiskLevel;
  /** 0–1 raw signal used for internal propagation ordering. */
  score: number;
  /** Human label for the node, e.g. "Water Stress". */
  label: string;
  /** Icon key — maps to a Lucide icon name in the UI layer. */
  icon: string;
  /** One-line explanation of the score, e.g. "SPI-3 deficit (−1.4 σ)". */
  detail: string;
  /** Data provenance, e.g. "Open-Meteo historical archive". */
  source: string;
  /** False when this node's data is unavailable; shown as "No data yet" in the UI. */
  dataAvailable: boolean;
  /** Causal note added by propagation (e.g. "Amplified by Water stress"). */
  cascadeNote?: string;
}

/** Colour band for the overall farm season viability. Never a bare number. */
export type ViabilityBand = 'good' | 'fair' | 'elevated' | 'critical';

export interface CascadeResult {
  viabilityBand: ViabilityBand;
  /** Plain-language explanation of what this band means for the farmer. */
  viabilityExplain: string;
  /** Top 2–3 drivers ordered by risk contribution. */
  topDrivers: NodeScore[];
  allNodes: NodeScore[];
  /** ISO timestamp of when this was computed. */
  computedAt: string;
}

/** Inputs the engine needs. Mirrors what's already fetched in home.tsx. */
export interface CascadeInputs {
  /** 5-year daily climate archive from Open-Meteo. */
  climateTrends: {
    daily: {
      time: string[];
      temperature2mMean: number[];
      precipitationSum: number[];
    };
  } | null;
  soil: {
    pH: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    source: 'isric' | 'estimated';
  } | null;
  /** Agmarknet mandi price series; null when API key is absent or fetch failed. */
  mandiPrices: {
    trendPct: number;
    latestPerTon: number;
  } | null;
  crop: string;
  lat: number;
  lng: number;
}
