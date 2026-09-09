// Honest framing for the environmental data the app shows.
//
// None of the soil / weather numbers on the dashboard are a per-farm
// measurement: weather/AQI are the nearest Open-Meteo grid cell, soil chemistry
// is a ~250 m regional interpolation from ISRIC SoilGrids (or, when SoilGrids is
// unavailable, a coordinate-seeded heuristic). These helpers turn a fetch
// timestamp + provenance tag into the short captions the UI puts under a value
// so a farmer never reads "Nitrogen 42 ppm" as an exact soil test for their plot.

import type { SoilData } from './api';

/** "just now" / "4m ago" / "2h ago" / "3d ago" — "" when the timestamp is missing or unparseable. */
export function relativeAge(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Short calendar date ("7 Sep 2026") for a "checked" label. Falls back to "" on bad input. */
export function checkedOn(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * One-line caption describing where a soil reading came from and when it was
 * fetched. Kept deliberately blunt about the "regional model, not a field test"
 * distinction.
 */
export function soilProvenanceLabel(
  soil: Pick<SoilData, 'source' | 'fetchedAt'> | null | undefined,
): string {
  if (!soil) return '';
  const when = checkedOn(soil.fetchedAt);
  if (soil.source === 'isric') {
    return `Regional soil model (SoilGrids ~250 m)${when ? ` · checked ${when}` : ''}`;
  }
  return `Estimated — SoilGrids unavailable here${when ? ` · ${when}` : ''}`;
}

/**
 * Caption for a weather / temperature reading. Open-Meteo gives us the nearest
 * grid cell, not the farm itself. Pass the fetch time (ms) to append a freshness
 * hint; omit it (e.g. just-fetched during onboarding) for the bare source line.
 */
export function climateProvenanceLabel(fetchedAtMs?: number | null): string {
  const age = fetchedAtMs ? relativeAge(new Date(fetchedAtMs).toISOString()) : '';
  return age ? `nearest weather grid · updated ${age}` : 'nearest weather grid';
}

/**
 * Why N/P/K on the dashboard are a guide, not a soil report. SoilGrids exposes
 * pH and total nitrogen but no plant-available P or K layer, so `phosphorus` is
 * derived from organic carbon and `potassium` is a formula.
 */
export const SOIL_PK_DISCLAIMER =
  'Phosphorus is derived from organic carbon and potassium is an estimate — treat N/P/K as a regional guide, not a soil test.';

/**
 * Caption for a leaf-scan result. Extends this file's existing
 * verified/estimated/no-coverage vocabulary to a model output instead of a
 * sensor reading — same discipline, new source (feature_status.md sec.2: "no
 * silent fallback", applied here to a classifier instead of a soil reading).
 * `coverage` distinguishes a real diagnosis from a "healthy" result that
 * can't mean much because the model has no disease class for that crop at
 * all (src/lib/leafScan/coverage.ts's `healthy-only`).
 */
export function leafScanProvenanceLabel(
  coverage: 'full' | 'healthy_only',
  outcome: 'diagnosed' | 'low_confidence',
): string {
  if (coverage === 'healthy_only') {
    return 'No disease detected — but this model has no disease class for this crop, so that is not evidence of health.';
  }
  const base = 'On-device model, trained on lab-condition photographs — not a lab diagnosis.';
  return outcome === 'low_confidence'
    ? `${base} Confidence was too low to trust; treat as a possibility, not a finding.`
    : base;
}
