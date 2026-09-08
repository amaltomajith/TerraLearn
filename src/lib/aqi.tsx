// Single source of truth for air-quality severity banding.
//
// Moved verbatim out of `home.tsx` so the dashboard, the onboarding live
// preview and the weekly advisories all classify the same value the same way.
// Bands: US AQI 50/100 (EPA), PM2.5 12.0/35.4 µg/m³ (24-h), PM10 54/154,
// ozone 100/180 µg/m³.

import { Badge } from '@/components/ui/badge';

export type AqiMetric = 'us_aqi' | 'pm2_5' | 'pm10' | 'ozone';
export type AqiSeverity = 'good' | 'moderate' | 'unhealthy';

/** Tailwind classes per severity — reused for the advisory severity dots. */
export const AQI_SEVERITY_CLASS: Record<AqiSeverity, string> = {
  good: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  moderate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  unhealthy: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

export function aqiSeverity(type: AqiMetric, value: number): AqiSeverity {
  switch (type) {
    case 'us_aqi':
      return value > 100 ? 'unhealthy' : value > 50 ? 'moderate' : 'good';
    case 'pm2_5':
      return value > 35.4 ? 'unhealthy' : value > 12.0 ? 'moderate' : 'good';
    case 'pm10':
      return value > 154 ? 'unhealthy' : value > 54 ? 'moderate' : 'good';
    case 'ozone':
      return value > 180 ? 'unhealthy' : value > 100 ? 'moderate' : 'good';
  }
}

export function aqiLabel(type: AqiMetric, value: number): string {
  const s = aqiSeverity(type, value);
  return s === 'unhealthy' ? 'Unhealthy' : s === 'moderate' ? 'Moderate' : 'Good';
}

export function getAqiSeverityBadge(type: AqiMetric, value: number) {
  const severity = aqiSeverity(type, value);
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-semibold border ${AQI_SEVERITY_CLASS[severity]}`}
    >
      {aqiLabel(type, value)}
    </Badge>
  );
}
