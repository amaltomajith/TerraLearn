import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CloudRain, ExternalLink, Info, Loader2, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { useIdentity } from '@/lib/identity/identity';
import { fetchRainfallForecast, fetchElevation } from '@/lib/api';
import type { RainfallForecastData } from '@/lib/api';

// ── IMD rainfall classification (mm/day) ─────────────────────────────────────
// https://www.imd.gov.in/pages/rainfall_criteria.php
type RainClass = 'none' | 'light' | 'moderate' | 'heavy' | 'very_heavy' | 'extreme';

function classifyRain(mm: number): RainClass {
  if (mm < 0.1)  return 'none';
  if (mm < 7.5)  return 'light';
  if (mm < 35.5) return 'moderate';
  if (mm < 64.5) return 'heavy';
  if (mm < 124.5) return 'very_heavy';
  return 'extreme';
}

const RAIN_COLORS: Record<RainClass, string> = {
  none:       '#374151',
  light:      '#22d3ee',
  moderate:   '#3b82f6',
  heavy:      '#f59e0b',
  very_heavy: '#ef4444',
  extreme:    '#a855f7',
};

const RAIN_LABELS: Record<RainClass, string> = {
  none:       'No rain',
  light:      'Light (<7.5 mm)',
  moderate:   'Moderate (7.5–35 mm)',
  heavy:      'Heavy (35–64 mm)',
  very_heavy: 'Very Heavy (64–124 mm)',
  extreme:    'Extreme (>124 mm)',
};

// ── Terrain flood susceptibility ─────────────────────────────────────────────
// A simple proxy: elevation relative to the Indian plains median.
// Sub-50 m → high; 50–200 m → medium; >200 m → low.
// This is a stated proxy — real HAND requires DEM processing.
type Susceptibility = 'low' | 'medium' | 'high';

function deriveSusceptibility(elevationM: number): Susceptibility {
  if (elevationM < 50)  return 'high';
  if (elevationM < 200) return 'medium';
  return 'low';
}

const SUSCEPT_COLORS: Record<Susceptibility, { bg: string; text: string; border: string }> = {
  high:   { bg: 'bg-red-500/10',    text: 'text-red-500',    border: 'border-red-500/30'    },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30' },
  low:    { bg: 'bg-emerald-500/10',text: 'text-emerald-500',border: 'border-emerald-500/30' },
};

const SUSCEPT_ICON: Record<Susceptibility, typeof CheckCircle2> = {
  high:   ShieldAlert,
  medium: AlertTriangle,
  low:    CheckCircle2,
};

// ── Derive flood action from susceptibility + forecast ────────────────────────
function deriveFloodAction(
  susceptibility: Susceptibility,
  maxMm: number,
  maxClass: RainClass,
): string {
  if (maxClass === 'none' || maxClass === 'light') return 'No significant rain forecast. Normal operations.';
  if (susceptibility === 'low') {
    if (maxClass === 'moderate') return 'Moderate rain ahead. Ensure drainage channels clear.';
    return 'Heavy rain expected even in low-risk terrain. Secure equipment and check field drains.';
  }
  if (susceptibility === 'medium') {
    if (maxClass === 'moderate') return 'Moderate rain + medium flood zone. Clear drainage channels and hold off on harvesting low-lying crops.';
    if (maxClass === 'heavy') return 'Heavy rain + medium risk. Move harvested produce to higher ground. Delay field work.';
    return `Very heavy to extreme rain (${maxMm.toFixed(0)} mm) + medium risk. Move livestock and stored inputs to safety. Document standing crop for insurance.`;
  }
  // high susceptibility
  if (maxClass === 'moderate') return 'Moderate rain in HIGH flood zone. Move all moveable assets to higher ground now.';
  if (maxClass === 'heavy') return 'HEAVY RAIN + HIGH FLOOD RISK. Early harvest if crop is near maturity. File pre-emptive crop insurance claim.';
  return `EXTREME RAIN FORECAST (${maxMm.toFixed(0)} mm) + HIGH FLOOD ZONE. Evacuate livestock immediately. Contact local disaster management. Document everything for insurance.`;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const mm = payload[0]?.value ?? 0;
  const cls = classifyRain(mm);
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold" style={{ color: RAIN_COLORS[cls] }}>{mm.toFixed(1)} mm — {RAIN_LABELS[cls]}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function FloodPanel() {
  const { t } = useTranslation();
  const { primaryFarm } = useIdentity();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<RainfallForecastData | null>(null);
  const [elevation, setElevation] = useState<number>(0);

  const lat = primaryFarm?.lat;
  const lng = primaryFarm?.lng;

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [fc, elev] = await Promise.all([
          fetchRainfallForecast(lat!, lng!),
          fetchElevation(lat!, lng!),
        ]);
        if (cancelled) return;
        setForecast(fc);
        setElevation(elev.elevationM);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lat, lng]);

  const susceptibility = useMemo(() => deriveSusceptibility(elevation), [elevation]);

  const chartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.daily.time.map((date, i) => ({
      date: date.slice(5), // MM-DD
      mm: forecast.daily.precipitationSum[i],
      prob: forecast.daily.precipitationProb[i],
      cls: classifyRain(forecast.daily.precipitationSum[i]),
    }));
  }, [forecast]);

  const maxMm = useMemo(() => Math.max(...(chartData.map((d) => d.mm) || [0])), [chartData]);
  const maxClass = useMemo(() => classifyRain(maxMm), [maxMm]);
  const cumulativeMm = useMemo(() => chartData.reduce((s, d) => s + d.mm, 0), [chartData]);

  const susceptColors = SUSCEPT_COLORS[susceptibility];
  const SusceptIcon = SUSCEPT_ICON[susceptibility];
  const susceptLabel: Record<Susceptibility, string> = {
    low:    t('vayu_susceptibility_low'),
    medium: t('vayu_susceptibility_medium'),
    high:   t('vayu_susceptibility_high'),
  };

  if (!primaryFarm) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        No farm selected.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">{t('vayu_flood_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('vayu_flood_subtitle')}</p>
      </motion.div>

      {loading && (
        <div className="flex items-center gap-3 text-muted-foreground py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('vayu_loading')}</span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && forecast && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-6">

          {/* Terrain susceptibility + action */}
          <div className={`rounded-2xl border p-6 ${susceptColors.bg} ${susceptColors.border}`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-xl p-3 ${susceptColors.bg} border ${susceptColors.border}`}>
                <SusceptIcon className={`w-7 h-7 ${susceptColors.text}`} />
              </div>
              <div className="flex-1">
                <div className={`text-xs font-semibold uppercase tracking-wider ${susceptColors.text} mb-1`}>
                  {t('vayu_flood_susceptibility')} · {elevation} m elevation
                </div>
                <div className="text-xl font-bold text-foreground">
                  {susceptLabel[susceptibility]} Flood Risk
                  <span className="ml-2 text-sm font-normal text-muted-foreground">(terrain proxy)</span>
                </div>
              </div>
            </div>

            {/* 7-day summary pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="rounded-lg bg-background/50 border border-border/40 px-3 py-1.5 text-xs">
                Max: <strong>{maxMm.toFixed(1)} mm</strong>
              </div>
              <div className="rounded-lg bg-background/50 border border-border/40 px-3 py-1.5 text-xs">
                Total 7-day: <strong>{cumulativeMm.toFixed(1)} mm</strong>
              </div>
              <div className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                   style={{ borderColor: RAIN_COLORS[maxClass], color: RAIN_COLORS[maxClass], background: RAIN_COLORS[maxClass] + '18' }}>
                {RAIN_LABELS[maxClass]}
              </div>
            </div>

            {/* Action */}
            <div className="mt-4 rounded-xl bg-background/50 border border-border/40 p-4">
              <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${susceptColors.text}`}>
                {t('vayu_action_label')}
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {deriveFloodAction(susceptibility, maxMm, maxClass)}
              </p>
            </div>
          </div>

          {/* 7-day bar chart */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CloudRain className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-foreground">{t('vayu_7day_forecast')}</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} tickLine={false} unit=" mm" />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="mm" name="Rain" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={RAIN_COLORS[entry.cls]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Probability row */}
            <div className="flex justify-around mt-3">
              {chartData.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground">{d.prob}%</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400" style={{ opacity: d.prob / 100 }} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/60 text-center mt-1">% = precipitation probability</p>
          </div>

          {/* IMD scale legend */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">IMD Rainfall Scale</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(RAIN_LABELS) as [RainClass, string][]).map(([cls, label]) => (
                <div key={cls} className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: RAIN_COLORS[cls] }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* External links */}
          <div className="flex flex-wrap gap-3">
            <a
              href="https://mausam.imd.gov.in/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('vayu_external_imd')}
            </a>
            <a
              href="https://sites.research.google/floods/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('vayu_external_flood_hub')}
            </a>
          </div>

          {/* Disclaimer */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex gap-3">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">{t('vayu_disclaimer')}</p>
          </div>

          {/* Provenance */}
          <div className="text-xs text-muted-foreground/60">
            <span className="font-semibold">{t('vayu_provenance')}: </span>
            7-day rainfall forecast from Open-Meteo Forecast API ·
            Elevation from SRTM via Open-Meteo Elevation API ·
            Flood susceptibility is a terrain proxy, not a HAND index ·
            IMD rainfall class thresholds per official classification
          </div>
        </motion.div>
      )}
    </div>
  );
}
