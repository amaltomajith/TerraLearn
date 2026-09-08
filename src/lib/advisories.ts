// Time-sensitive advisories for a growing crop.
//
// This is deliberately NOT a daily checklist ("feed the chickens") — a farmer
// already knows the routine. It surfaces only the marginal, data-backed calls
// the app can already make: don't spray in high wind, hold fertiliser before
// heavy rain, top-dress N when soil N is low and rain is coming, fix pH before
// the crop settles, drain before a wet harvest. Everything here is derived from
// data the dashboard has already fetched — no new endpoints, no agronomy
// knowledge base.
//
// `cropAdvisories()` works for any CROP_DATABASE crop (stage from
// cropCalendar.genericStage). Paddy gets a few genuinely paddy-specific extras
// on top (`paddyDeepAdvisories`). The old paddy-only `paddyAdvisories` /
// `paddyStage` exports are kept for back-compat.

import type { AqiSeverity } from './aqi';
import type { AirQualityData, ClimateData, CropInfo, SoilData } from './api';
import { genericStage, type Stage } from './cropCalendar';

export interface Advisory {
  id: string;
  /** Reuses the AQI severity scale for a consistent colour language. */
  severity: AqiSeverity;
  title: string;
  detail: string;
  /** What in the data triggered this — kept visible so the farmer can judge it. */
  basis: string;
}

const DAY_MS = 86_400_000;

// ===========================================================================
// Generic, crop-agnostic advisories
// ===========================================================================

export interface AdvisoryInput {
  /** CROP_DATABASE display name, e.g. "Rice". */
  cropName: string;
  /** CROP_DATABASE[key] for that crop. */
  crop: CropInfo;
  sowingDate: Date;
  climate: ClimateData | null;
  soil: SoilData | null;
  airQuality: AirQualityData | null;
  /** `warnings` from the yield calculation, surfaced selectively. */
  yieldWarnings: string[];
}

export function cropAdvisories(input: AdvisoryInput): Advisory[] {
  const { cropName, crop, sowingDate, climate, soil, yieldWarnings } = input;
  const out: Advisory[] = [];

  const daysSince = Math.floor((Date.now() - sowingDate.getTime()) / DAY_MS);
  const stage: Stage = genericStage(Math.max(0, daysSince), crop.growingDays);

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

  // 2. Heavy rain about — hold broadcast fertiliser (vegetative / reproductive).
  if (
    (stage === 'vegetative' || stage === 'reproductive') &&
    climate?.precipitation != null &&
    climate.precipitation >= 15
  ) {
    out.push({
      id: 'rain-fertiliser',
      severity: 'moderate',
      title: 'Rain coming — hold broadcast fertiliser',
      detail:
        `The grid shows about ${climate.precipitation} mm of rain. A broadcast dose now ` +
        'is likely to wash off or leach past the roots. Wait for it to pass, then apply ' +
        'onto a moist (not flooded) field. Clear the drains on low spots.',
      basis: `rain ${climate.precipitation} mm · nearest grid`,
    });
  }

  // 3. Heat spike — irrigate at the cool end of the day.
  if (
    climate?.temperature != null &&
    climate.temperature >= Math.max(crop.optimalTempMax + 3, 36)
  ) {
    out.push({
      id: 'heat-irrigate',
      severity: climate.temperature >= crop.optimalTempMax + 8 ? 'unhealthy' : 'moderate',
      title: 'Heat stress — water at dawn or dusk',
      detail:
        `It's around ${climate.temperature}°C, above the comfortable range for ${cropName} ` +
        `(up to ~${crop.optimalTempMax}°C). Irrigate early morning or after sunset so the ` +
        'water actually reaches the roots, and avoid working the crop in the afternoon.',
      basis: `temp ${climate.temperature}°C vs optimum ${crop.optimalTempMax}°C`,
    });
  }

  // 4. Frost risk.
  if (climate?.temperature != null && climate.temperature <= 3) {
    out.push({
      id: 'frost-risk',
      severity: climate.temperature <= 0 ? 'unhealthy' : 'moderate',
      title: 'Frost risk tonight',
      detail:
        `Grid temperature is about ${climate.temperature}°C. Run sprinklers before dawn if ` +
        'you have them, cover a nursery, and delay any planned sowing until it warms.',
      basis: `temp ${climate.temperature}°C · nearest grid`,
    });
  }

  // 5. pH out of range — only really actionable early, before the crop settles.
  if (
    stage === 'establishment' &&
    soil?.pH != null &&
    (soil.pH < crop.optimalPHMin || soil.pH > crop.optimalPHMax)
  ) {
    const low = soil.pH < crop.optimalPHMin;
    out.push({
      id: 'ph-range',
      severity: 'moderate',
      title: `Soil pH ${soil.pH} is outside the range for ${cropName}`,
      detail:
        `${cropName} does best at pH ${crop.optimalPHMin}–${crop.optimalPHMax}. If a field ` +
        `test agrees, work in ${low ? 'lime' : 'gypsum or extra organic matter'} now — it ` +
        'is much harder to correct once the crop is established.',
      basis: `soil pH ${soil.pH} · regional model`,
    });
  }

  // 6. Nitrogen top-dress window — vegetative stage, low soil N, rain about.
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
        'about — splitting a dose now carries it into the root zone instead of losing it ' +
        'to a dry topsoil.',
      basis: `soil N ${soil.nitrogen} ppm · rain ${climate.precipitation} mm`,
    });
  }

  // 7. Season mismatch — surface the yield model's own wording.
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

  // 8. Wet harvest — maturity stage with rain on the grid.
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
        "You're near the end of the season and the grid shows wet conditions. Drain the " +
        'field early and line up labour so you can cut in a dry window.',
      basis: `rain ${climate.precipitation} mm · nearest grid`,
    });
  }

  // Paddy-specific extras on top of the generic set.
  if (cropName === 'Rice') {
    const seen = new Set(out.map((a) => a.id));
    for (const a of paddyDeepAdvisories(input)) {
      if (!seen.has(a.id)) out.push(a);
    }
  }

  return out;
}

// ===========================================================================
// Paddy-specific deep advisories (only what is genuinely paddy-specific)
// ===========================================================================

export function paddyDeepAdvisories(input: AdvisoryInput): Advisory[] {
  const { crop, sowingDate, climate } = input;
  const out: Advisory[] = [];
  const daysSince = Math.floor((Date.now() - sowingDate.getTime()) / DAY_MS);
  const stage = paddyStage(daysSince, crop.growingDays);

  // Transplanting window.
  if (stage === 'establishment' && daysSince >= 18 && daysSince <= 30) {
    out.push({
      id: 'paddy-transplant',
      severity: 'moderate',
      title: 'Transplanting window',
      detail:
        'If you raised a nursery, 21–25 day seedlings transplant best — older seedlings ' +
        'tiller poorly. Puddle well and keep 2–3 cm of water for the first week.',
      basis: `day ${daysSince} since sowing`,
    });
  }

  // Standing-water depth by stage.
  if (stage === 'vegetative' || stage === 'reproductive') {
    out.push({
      id: 'paddy-water-depth',
      severity: 'good',
      title:
        stage === 'reproductive'
          ? 'Keep 5 cm standing water through flowering'
          : 'Shallow water (2–3 cm) during tillering',
      detail:
        stage === 'reproductive'
          ? 'Water stress from panicle initiation to grain fill is the single biggest yield loss in paddy. Do not let the field dry now.'
          : 'A shallow layer during tillering encourages more productive tillers than a deep flood. Drain briefly mid-tillering if the crop is very lush.',
      basis: `paddy stage: ${stage}`,
    });
  }

  // Panicle-initiation top-dress.
  if (stage === 'reproductive' && daysSince <= crop.growingDays - 45) {
    out.push({
      id: 'paddy-pi-nitrogen',
      severity: 'moderate',
      title: 'Panicle initiation — second nitrogen split',
      detail:
        'The top-dress around panicle initiation feeds grain number. Apply onto a drained ' +
        'field, then re-flood after a day.',
      basis: `day ${daysSince} since sowing`,
    });
  }

  // Drift is worse over a flooded field near sensitive neighbours (any stage).
  if (climate?.windSpeed != null && climate.windSpeed >= 15 && climate.windSpeed < 20) {
    out.push({
      id: 'paddy-wind-mild',
      severity: 'good',
      title: 'Breezy — spray low and early over the flood',
      detail:
        `Wind is ${climate.windSpeed} km/h. It is sprayable, but keep the boom low and go ` +
        'early; drift carries further off a water surface.',
      basis: `wind ${climate.windSpeed} km/h`,
    });
  }

  return out;
}

// ===========================================================================
// Back-compat: the original paddy-only API
// ===========================================================================

export type PaddyStage = 'establishment' | 'vegetative' | 'reproductive' | 'maturity';

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
  yieldWarnings: string[];
}

/** @deprecated use `cropAdvisories` — kept so older call sites keep compiling. */
export function paddyAdvisories(input: PaddyAdvisoryInput): Advisory[] {
  return cropAdvisories({
    cropName: 'Rice',
    crop: input.crop,
    sowingDate: input.plantingDate,
    climate: input.climate,
    soil: input.soil,
    airQuality: input.airQuality,
    yieldWarnings: input.yieldWarnings,
  });
}
