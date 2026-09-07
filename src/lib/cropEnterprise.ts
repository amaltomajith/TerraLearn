// Bridges the crop-yield simulator (CROP_DATABASE crops) to the Saath slice:
// which IFS enterprise a crop belongs to (for circular-agriculture weighting),
// which demand category it sells under (for live buyer-price lookup), and which
// Agmarknet commodity name it maps to (for mandi price trends).
//
// These maps are deliberately partial — most of the 20 CROP_DATABASE crops have
// no IFS enterprise or no nearby buyer, and that's fine: callers treat "no entry"
// as "no signal" and say nothing.

import { ENTERPRISES, enterpriseLabel } from './saath/ifsMatrix';
import type { MapPointRow } from './saath/types';
import { suggestCrops, type ClimateData, type SoilData, type CropInfo } from './api';

// CROP_DATABASE key (lowercase crop name) -> ifs_matrix enterprise key.
export const CROP_TO_ENTERPRISE: Record<string, string> = {
  rice: 'paddy',
  sugarcane: 'sugarcane',
  tomatoes: 'horticulture',
  peppers: 'horticulture',
  cucumbers: 'horticulture',
  lettuce: 'horticulture',
  carrots: 'horticulture',
  onions: 'horticulture',
  cabbage: 'horticulture',
  spinach: 'horticulture',
  strawberries: 'horticulture',
  // wheat / corn / soybeans / barley / oats / cotton / potatoes / sorghum / grapes
  //   -> no IFS enterprise in the matrix
};

// CROP_DATABASE key -> demand-listing category (free text in `listings.category`).
export const CROP_TO_SALE_CATEGORY: Record<string, string> = {
  tomatoes: 'tomatoes',
  onions: 'onions',
  potatoes: 'potatoes',
};

// NOTE: CROP_DATABASE key -> Agmarknet commodity name lives in src/lib/api.ts
// (CROP_TO_AGMARKNET_COMMODITY), next to fetchMandiPrices, to avoid a circular
// import between this module and api.ts.

const UNIT_TO_TON: Record<string, number> = {
  ton: 1,
  tonne: 1,
  t: 1,
  quintal: 10,
  q: 10,
  kg: 1000,
  kilogram: 1000,
};

/** Convert a demand-listing rate (INR per `unit`) to INR per tonne, or null when
 *  the unit isn't a mass we can normalise (crate, bag, cartload, …). */
export function demandRatePerTon(rate: number | null, unit: string | null): number | null {
  if (rate == null || rate <= 0) return null;
  const f = UNIT_TO_TON[(unit ?? '').toLowerCase().trim()];
  return f ? rate * f : null;
}

export interface CircularOpportunity {
  resource: string;
  theirEnterpriseLabel: string;
  count: number;
  nearestKm: number;
}

/** Does growing `cropName` produce a byproduct that a nearby farmer's enterprise
 *  consumes? Returns the strongest such match (most consumers) or null. */
export function circularOpportunity(
  cropName: string,
  neighbours: MapPointRow[],
  radiusM = 15000,
): CircularOpportunity | null {
  const ent = CROP_TO_ENTERPRISE[cropName.toLowerCase()];
  if (!ent) return null;
  const outputs = new Set(ENTERPRISES[ent]?.outputs ?? []);
  if (!outputs.size) return null;

  const hits = new Map<
    string,
    { resource: string; their: string; count: number; nearest: number }
  >();
  for (const n of neighbours) {
    if (n.distance_m != null && n.distance_m > radiusM) continue;
    for (const e of n.enterprises ?? []) {
      for (const r of ENTERPRISES[e]?.inputs ?? []) {
        if (!outputs.has(r)) continue;
        const k = `${r}|${e}`;
        const c = hits.get(k) ?? { resource: r, their: e, count: 0, nearest: Infinity };
        c.count++;
        if (n.distance_m != null) c.nearest = Math.min(c.nearest, n.distance_m);
        hits.set(k, c);
      }
    }
  }
  if (!hits.size) return null;

  const b = [...hits.values()].sort((x, y) => y.count - x.count)[0];
  return {
    resource: b.resource,
    theirEnterpriseLabel: enterpriseLabel(b.their),
    count: b.count,
    nearestKm:
      b.nearest === Infinity ? radiusM / 1000 : Math.round((b.nearest / 1000) * 10) / 10,
  };
}

/** EXTENDS suggestCrops() — same scoring, plus a small circular-agriculture boost
 *  (capped at +8, never enough to override a poor soil/climate fit) and the
 *  matching opportunity attached to each suggestion. */
export function suggestCropsWithCircular(
  climate: ClimateData,
  soil: SoilData,
  plantingDate: Date,
  lat: number,
  neighbours: MapPointRow[],
): { crop: CropInfo; score: number; reasons: string[]; circular?: CircularOpportunity }[] {
  return suggestCrops(climate, soil, plantingDate, lat)
    .map((s) => {
      const circular = circularOpportunity(s.crop.name, neighbours) ?? undefined;
      const boost = circular ? Math.min(8, circular.count * 4) : 0;
      return { ...s, score: Math.min(100, s.score + boost), circular };
    })
    .sort((a, b) => b.score - a.score);
}
