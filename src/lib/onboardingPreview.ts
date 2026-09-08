// Pure helpers for the "what we can already see" panel in onboarding step 1.
//
// The panel shows the same soil / weather numbers the dashboard does, fetched
// the moment a pin exists — so a farmer sees real data before committing to the
// full profile. Kept framing-honest: soil is a regional model, weather is the
// nearest grid cell.

import type { SoilData, ClimateData } from './api';

export type PreviewProvenance = 'when-where' | 'regional-estimate' | 'weather-grid';

export interface PreviewMetric {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  /** How the value should be captioned/badged by the panel. */
  provenance: PreviewProvenance;
}

/** Soil + temperature rows for the preview grid. `null` inputs render as "—". */
export function previewMetrics(
  soil: SoilData | null,
  climate: ClimateData | null,
): PreviewMetric[] {
  return [
    {
      key: 'ph',
      label: 'Soil pH',
      value: soil?.pH ?? '—',
      provenance: 'when-where',
    },
    {
      key: 'nitrogen',
      label: 'Nitrogen',
      value: soil?.nitrogen ?? '—',
      unit: 'ppm',
      provenance: 'regional-estimate',
    },
    {
      key: 'phosphorus',
      label: 'Phosphorus',
      value: soil?.phosphorus ?? '—',
      unit: 'ppm',
      provenance: 'regional-estimate',
    },
    {
      key: 'potassium',
      label: 'Potassium',
      value: soil?.potassium ?? '—',
      unit: 'ppm',
      provenance: 'regional-estimate',
    },
    {
      key: 'temp',
      label: 'Temp',
      value: climate?.temperature ?? '—',
      unit: '°C',
      provenance: 'weather-grid',
    },
  ];
}

/** "Paddy · Ragi" — short read-back of the chosen enterprises for the step-2 summary. */
export function enterpriseSummary(labels: string[]): string {
  return labels.length ? labels.join(' · ') : 'none selected';
}

/** "12.5223° N, 76.8954° E" — pin read-back for the step-2 summary. */
export function pinSummary(pos: { lat: number; lng: number } | null): string {
  if (!pos) return 'not set';
  const ns = pos.lat >= 0 ? 'N' : 'S';
  const ew = pos.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(pos.lat).toFixed(4)}° ${ns}, ${Math.abs(pos.lng).toFixed(4)}° ${ew}`;
}
