// Indicative (not live) prices for the crop-bearing enterprises shown during
// onboarding.
//
// At pin-drop time the only price signal available is a hand-set USD constant
// per crop times a hard-coded exchange rate. Live mandi prices need an API key,
// a commodity map and only run inside the simulator. So onboarding shows this
// national-ballpark figure, always explicitly labelled, and only for enterprises
// that actually sell a crop (paddy, sugarcane, horticulture, ragi). Livestock
// enterprises get no price line.

import { CROP_DATABASE } from './api';

/** Enterprise key -> a `CROP_DATABASE` key to borrow a reference price from. */
export const ENTERPRISE_REFERENCE_CROP: Record<string, string> = {
  paddy: 'rice',
  sugarcane: 'sugarcane',
  horticulture: 'tomatoes',
};

/**
 * Reference USD/ton for enterprises with no matching `CROP_DATABASE` entry.
 * Kept here rather than added to `CROP_DATABASE` so ragi does not leak into the
 * simulator's crop-suggestion ranking.
 */
export const ENTERPRISE_REFERENCE_PRICE_USD: Record<string, number> = {
  ragi: 320,
};

export const INDICATIVE_PRICE_NOTE = 'indicative — national ballpark, not a live quote';

export interface IndicativePrice {
  enterpriseKey: string;
  label: string;
  /** Price per ton in the pin's local currency, rounded. */
  perTonLocal: number;
  currencySymbol: string;
}

function referenceUsdPerTon(enterpriseKey: string): number | null {
  const cropKey = ENTERPRISE_REFERENCE_CROP[enterpriseKey];
  if (cropKey && CROP_DATABASE[cropKey]) return CROP_DATABASE[cropKey].basePrice;
  if (enterpriseKey in ENTERPRISE_REFERENCE_PRICE_USD) {
    return ENTERPRISE_REFERENCE_PRICE_USD[enterpriseKey];
  }
  return null;
}

/**
 * One row per selected enterprise that sells a crop. Enterprises with no
 * reference price (cattle, poultry, biogas, …) are omitted.
 */
export function indicativePrices(
  enterprises: string[],
  exchangeRate: number,
  currencySymbol: string,
  labelFor: (key: string) => string,
): IndicativePrice[] {
  const rate = Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1;
  const out: IndicativePrice[] = [];
  for (const key of enterprises) {
    const usd = referenceUsdPerTon(key);
    if (usd == null) continue;
    out.push({
      enterpriseKey: key,
      label: labelFor(key),
      perTonLocal: Math.round(usd * rate),
      currencySymbol,
    });
  }
  return out;
}
