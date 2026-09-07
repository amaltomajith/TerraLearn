// Display-only mirror of the `ifs_matrix` table (the DB copy is authoritative
// for matching). Used for labels, icons and "how the loop closes" hints in the UI.

import type { IfsMatchRow } from './types';

export interface EnterpriseInfo {
  key: string;
  label: string;
  emoji: string;
  outputs: string[];
  inputs: string[];
}

export const ENTERPRISES: Record<string, EnterpriseInfo> = {
  paddy: {
    key: 'paddy',
    label: 'Paddy',
    emoji: '🌾',
    outputs: ['paddy straw', 'rice bran'],
    inputs: ['farmyard manure', 'vermicompost', 'bioslurry', 'pond silt'],
  },
  cattle: {
    key: 'cattle',
    label: 'Dairy cattle',
    emoji: '🐄',
    outputs: ['cattle dung', 'farmyard manure'],
    inputs: ['paddy straw', 'sugarcane tops', 'ragi straw', 'green fodder'],
  },
  poultry: {
    key: 'poultry',
    label: 'Poultry',
    emoji: '🐔',
    outputs: ['poultry manure'],
    inputs: ['rice bran', 'broken rice', 'vegetable waste'],
  },
  mushroom: {
    key: 'mushroom',
    label: 'Mushroom',
    emoji: '🍄',
    outputs: ['spent mushroom substrate'],
    inputs: ['paddy straw'],
  },
  vermicompost: {
    key: 'vermicompost',
    label: 'Vermicompost',
    emoji: '🪱',
    outputs: ['vermicompost'],
    inputs: ['cattle dung', 'spent mushroom substrate', 'vegetable waste'],
  },
  biogas: {
    key: 'biogas',
    label: 'Biogas',
    emoji: '🔥',
    outputs: ['bioslurry'],
    inputs: ['cattle dung', 'poultry manure'],
  },
  fishpond: {
    key: 'fishpond',
    label: 'Fishpond',
    emoji: '🐟',
    outputs: ['pond silt', 'pond water'],
    inputs: ['poultry manure', 'cattle dung'],
  },
  horticulture: {
    key: 'horticulture',
    label: 'Horticulture',
    emoji: '🍅',
    outputs: ['vegetable waste'],
    inputs: ['vermicompost', 'bioslurry', 'poultry manure', 'pond silt', 'pond water'],
  },
  sericulture: {
    key: 'sericulture',
    label: 'Sericulture',
    emoji: '🐛',
    outputs: ['mulberry prunings'],
    inputs: ['farmyard manure', 'vermicompost'],
  },
  sugarcane: {
    key: 'sugarcane',
    label: 'Sugarcane',
    emoji: '🎋',
    outputs: ['sugarcane tops', 'sugarcane trash'],
    inputs: ['bioslurry', 'farmyard manure'],
  },
  ragi: {
    key: 'ragi',
    label: 'Ragi',
    emoji: '🌱',
    outputs: ['ragi straw'],
    inputs: ['farmyard manure', 'vermicompost'],
  },
};

export function enterpriseLabel(key: string): string {
  return ENTERPRISES[key]?.label ?? key;
}

export function enterpriseEmoji(key: string): string {
  return ENTERPRISES[key]?.emoji ?? '🌿';
}

export function describeEnterprises(keys: string[] | null | undefined): string {
  if (!keys || keys.length === 0) return 'No enterprises listed';
  return keys.map(enterpriseLabel).join(' · ');
}

// --- bidirectional IFS-match merge --------------------------------------------
// `nearby_ifs_matches` emits one row per (nearby farmer, resource, direction).
// A farmer you both supply AND buy from therefore shows up as several rows.
// mergeIfsMatches() collapses those into one entry per farmer, keeping the two
// directions separate so the UI can render a single "you send / you receive" card.

export interface MergedIfsLoopLeg {
  resource: string;
  my_enterprise: string;
  their_enterprise: string;
}

export interface MergedIfsLoop {
  their_farmer_id: string;
  their_farmer_name: string;
  their_village: string | null;
  distance_m: number | null;
  has_active_listing: boolean;
  supply: MergedIfsLoopLeg[]; // resources you send them
  need: MergedIfsLoopLeg[]; // resources you receive from them
}

export function mergeIfsMatches(rows: IfsMatchRow[]): MergedIfsLoop[] {
  const byFarmer = new Map<string, MergedIfsLoop>();
  const order: string[] = [];

  for (const r of rows) {
    let loop = byFarmer.get(r.their_farmer_id);
    if (!loop) {
      loop = {
        their_farmer_id: r.their_farmer_id,
        their_farmer_name: r.their_farmer_name,
        their_village: r.their_village,
        distance_m: r.distance_m,
        has_active_listing: r.has_active_listing,
        supply: [],
        need: [],
      };
      byFarmer.set(r.their_farmer_id, loop);
      order.push(r.their_farmer_id);
    }

    if (r.distance_m != null) {
      loop.distance_m = loop.distance_m == null ? r.distance_m : Math.min(loop.distance_m, r.distance_m);
    }
    loop.has_active_listing = loop.has_active_listing || r.has_active_listing;

    const leg = loop[r.direction === 'i_supply' ? 'supply' : 'need'];
    if (!leg.some((l) => l.resource === r.resource)) {
      leg.push({
        resource: r.resource,
        my_enterprise: r.my_enterprise,
        their_enterprise: r.their_enterprise,
      });
    }
  }

  return order.map((id) => byFarmer.get(id)!);
}
