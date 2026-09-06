// Display-only mirror of the `ifs_matrix` table (the DB copy is authoritative
// for matching). Used for labels, icons and "how the loop closes" hints in the UI.

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
