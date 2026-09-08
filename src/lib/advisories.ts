// Time-sensitive advisories for a growing paddy crop.
//
// This is deliberately NOT a daily checklist ("feed the chickens") — a farmer
// already knows the routine. It surfaces only the marginal, data-backed calls
// the app can already make: don't spray in high wind, top-dress N when soil N is
// low and rain is coming, fix pH before transplanting, drain before a wet
// harvest. Everything here is derived from data the dashboard has already
// fetched — no new endpoints, no agronomy knowledge base.
//
// v1 scope: paddy only. Other enterprises are stage-less (dairy/poultry) or
// cadence-based (biogas/vermicompost) and need their own rule shapes.

import type { AqiSeverity } from './aqi';
import type { AirQualityData, ClimateData, CropInfo, SoilData } from './api';

export interface Advisory {
  id: string;
  /** Reuses the AQI severity scale for a consistent colour language. */
  severity: AqiSeverity;
  title: string;
  detail: string;
  /** What in the data triggered this — kept visible so the farmer can judge it. */
  basis: string;
}

export type PaddyStage =
  | 'establishment'
  | 'vegetative'
  | 'reproductive'
  | 'maturity';

export function paddyStage(daysSincePlanting: number, growingDays: number): PaddyStage {
  if (daysSincePlanting <= 14) return 'establishment';
  if (daysSincePlanting >= growingDays - 20) return 'maturity';
  if (daysSincePlanting <= 55) return 'vegetative';
  return 'reproductive';
}

export interface PaddyAdvisoryInput {
  plantingDate: Date;
  crop: CropInfo; // CROP_DATABASE.rice
  climate: ClimateData | null;
  soil: SoilData | null;
  airQuality: AirQualityData | null;
  /** `warnings` from the yield calculation, surfaced selectively. */
  yieldWarnings: string[];
}

const DAY_MS = 86_400_000;

export function paddyAdvisories(input: PaddyAdvisoryInput): Advisory[] {
  const { plantingDate, crop, climate, soil, yieldWarnings } = input;
  const out: Advisory[] = [];

  const daysSince = Math.floor((Date.now() - plantingDate.getTime()) / DAY_MS);
  const stage = paddyStage(daysSince, crop.growingDays);

  // 1. High wind — spraying advisory (any stage).
  if (climate?.windSpeed != null && climate.windSpeed >= 20) {
    out.push({
      id: 'wind-spray',
      severity: climate.windSpeed >= 30 ? 'unhealthy' : 'moderate',
      title: 'Hold off on spraying today',
      detail:
        `Wind is around ${climate.windSpeed} km/h — spray drift and patchy coverage are ` +
        'likely. Wait for a calmer window, usually early morning.',
      basis: `wind ${climate.windSpeed} km/h · nearest grid`,
    });
  }

  // 2. Nitrogen top-dress window — vegetative stage, low soil N, rain about.
  if (
    stage === 'vegetative' &&
    soil?.nitrogen != null &&
    soil.nitrogen < 30 &&
    climate?.precipitation != null &&
    climate.precipitation > 0
  ) {
    out.push({
      id: 'n-window',
      severity: 'moderate',
      title: 'Good window to top-dress nitrogen',
      detail:
        `Soil nitrogen reads low (${soil.nitrogen} ppm, regional model) and there's rain ` +
        'about — splitting a urea dose now carries it into the root zone instead of ' +
        'losing it to a dry topsoil.',
      basis: `soil N ${soil.nitrogen} ppm · rain ${climate.precipitation} mm`,
    });
  }

  // 3. pH out of range — only actionable before transplanting.
  if (
    stage === 'establishment' &&
    soil?.pH != null &&
    (soil.pH < crop.optimalPHMin || soil.pH > crop.optimalPHMax)
  ) {
    const low = soil.pH < crop.optimalPHMin;
    out.push({
      id: 'ph-range',
      severity: 'moderate',
      title: `Soil pH ${soil.pH} is outside the paddy range`,
      detail:
        `Paddy does best at pH ${crop.optimalPHMin}–${crop.optimalPHMax}. If a field test ` +
        `agrees, work in ${low ? 'lime' : 'gypsum or extra organic matter'} before ` +
        'transplanting — it is much harder to correct once the crop is in.',
      basis: `soil pH ${soil.pH} · regional model`,
    });
  }

  // 4. Season mismatch — surface the yield model's own wording.
  for (const w of yieldWarnings) {
    if (/season/i.test(w)) {
      out.push({
        id: 'season',
        severity: 'moderate',
        title: 'Check your planting window',
        detail: w,
        basis: 'from the yield model',
      });
      break;
    }
  }

  // 5. Wet harvest — maturity stage with rain on the grid.
  if (
    stage === 'maturity' &&
    climate?.precipitation != null &&
    climate.precipitation >= 10
  ) {
    out.push({
      id: 'wet-harvest',
      severity: 'moderate',
      title: 'Rain near harvest — plan draining',
      detail:
        "You're within about three weeks of harvest and the grid shows wet conditions. " +
        'Drain the field early and line up labour so you can cut in a dry window.',
      basis: `rain ${climate.precipitation} mm · nearest grid`,
    });
  }

  return out;
}
