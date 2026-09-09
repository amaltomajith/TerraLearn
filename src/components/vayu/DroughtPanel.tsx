import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, Droplets, Sun, Info, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { useIdentity } from '@/lib/identity/identity';
import { fetchClimateTrends, fetchSoilMoisture } from '@/lib/api';
import { computeSPI, latestSPI } from '@/lib/vayu/spi';
import type { SPISeverity, SPIPoint } from '@/lib/vayu/spi';

// ── Severity colour map ───────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<SPISeverity, { bg: string; text: string; border: string; bar: string }> = {
  'near-normal':  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30', bar: '#10b981' },
  watch:          { bg: 'bg-yellow-500/10',  text: 'text-yellow-500',  border: 'border-yellow-500/30',  bar: '#eab308' },
  warning:        { bg: 'bg-orange-500/10',  text: 'text-orange-500',  border: 'border-orange-500/30',  bar: '#f97316' },
  emergency:      { bg: 'bg-red-500/10',     text: 'text-red-500',     border: 'border-red-500/30',     bar: '#ef4444' },
  catastrophic:   { bg: 'bg-purple-600/10',  text: 'text-purple-500',  border: 'border-purple-500/30',  bar: '#a855f7' },
};

const SEVERITY_ICON: Record<SPISeverity, typeof CheckCircle2> = {
  'near-normal': CheckCircle2,
  watch:         AlertTriangle,
  warning:       AlertTriangle,
  emergency:     ShieldAlert,
  catastrophic:  ShieldAlert,
};

// ── Dry-spell counter ─────────────────────────────────────────────────────────
function countDrySpellDays(dates: string[], precip: number[], dryThresholdMm = 1): number {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 5, 1); // June 1 — kharif start heuristic
  let count = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = new Date(dates[i]);
    if (d < seasonStart) break;
    if ((precip[i] ?? 0) < dryThresholdMm) count++;
  }
  return count;
}

// ── Translates SPI+stage into an action string ────────────────────────────────
function deriveAction(severity: SPISeverity, sm0: number): string {
  if (severity === 'near-normal') return 'Soil moisture adequate — continue normal irrigation schedule.';
  if (severity === 'watch') return 'Rainfall deficit building. Check irrigation schedule; conserve soil moisture with mulching.';
  if (severity === 'warning') {
    return sm0 < 0.15
      ? 'Surface moisture critically low. Irrigate now if possible; apply residue mulch to retain moisture.'
      : 'Moderate drought. Defer non-essential irrigation; prioritise critical growth-stage crops.';
  }
  if (severity === 'emergency') return 'Severe drought. Emergency irrigation for perennial crops. Consider short-season variety if re-sowing window is open.';
  return 'Catastrophic drought. All available water to highest-value standing crops. Contact district Krishi Vibhag for relief scheme eligibility.';
}

// ── Custom tooltip for the SPI chart ─────────────────────────────────────────
function SPITooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold">{p.name}: {p.value?.toFixed(2)}</p>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DroughtPanel() {
  const { t } = useTranslation();
  const { primaryFarm } = useIdentity();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spi3, setSpi3] = useState<SPIPoint[]>([]);
  const [spi6, setSpi6] = useState<SPIPoint[]>([]);
  const [sm0, setSm0] = useState<number>(0);
  const [sm7, setSm7] = useState<number>(0);
  const [drySpell, setDrySpell] = useState<number>(0);

  const lat = primaryFarm?.lat;
  const lng = primaryFarm?.lng;

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [trends, sm] = await Promise.all([
          fetchClimateTrends(lat!, lng!),
          fetchSoilMoisture(lat!, lng!),
        ]);
        if (cancelled) return;

        const { time, precipitationSum } = trends.daily;
        const s3 = computeSPI(time, precipitationSum, 3);
        const s6 = computeSPI(time, precipitationSum, 6);
        const dryDays = countDrySpellDays(time, precipitationSum);

        setSpi3(s3);
        setSpi6(s6);
        setSm0(sm.sm0_7cm);
        setSm7(sm.sm7_28cm);
        setDrySpell(dryDays);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lat, lng]);

  const latestS3 = useMemo(() => latestSPI(spi3), [spi3]);
  const latestS6 = useMemo(() => latestSPI(spi6), [spi6]);
  const dominant = latestS6 ?? latestS3;
  const colors = dominant ? SEVERITY_COLORS[dominant.severity] : SEVERITY_COLORS['near-normal'];
  const SeverityIcon = dominant ? SEVERITY_ICON[dominant.severity] : CheckCircle2;

  // Build chart data — last 24 months
  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; spi3?: number; spi6?: number }>();
    spi3.slice(-24).forEach((p) => {
      map.set(p.date, { date: p.date.slice(0, 7), spi3: p.spi });
    });
    spi6.slice(-24).forEach((p) => {
      const entry = map.get(p.date) ?? { date: p.date.slice(0, 7) };
      entry.spi6 = p.spi;
      map.set(p.date, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [spi3, spi6]);

  const severityLabel: Record<SPISeverity, string> = {
    'near-normal': t('vayu_severity_near_normal'),
    watch:         t('vayu_severity_watch'),
    warning:       t('vayu_severity_warning'),
    emergency:     t('vayu_severity_emergency'),
    catastrophic:  t('vayu_severity_catastrophic'),
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
        <h2 className="text-2xl font-bold text-foreground">{t('vayu_drought_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('vayu_drought_subtitle')}</p>
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

      {!loading && !error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-6">

          {/* Current severity card */}
          {dominant && (
            <div className={`rounded-2xl border p-6 ${colors.bg} ${colors.border}`}>
              <div className="flex items-start gap-4">
                <div className={`rounded-xl p-3 ${colors.bg} border ${colors.border}`}>
                  <SeverityIcon className={`w-7 h-7 ${colors.text}`} />
                </div>
                <div className="flex-1">
                  <div className={`text-xs font-semibold uppercase tracking-wider ${colors.text} mb-1`}>
                    {t('vayu_spi6_label')}
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {severityLabel[dominant.severity]}
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      SPI = {dominant.spi.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-4 rounded-xl bg-background/50 border border-border/40 p-4">
                <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${colors.text}`}>
                  {t('vayu_action_label')}
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {deriveAction(dominant.severity, sm0)}
                </p>
              </div>
            </div>
          )}

          {/* SPI gauge row — SPI3 vs SPI6 side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* SPI-3 */}
            {latestS3 && (
              <div className={`rounded-2xl border p-5 ${SEVERITY_COLORS[latestS3.severity].bg} ${SEVERITY_COLORS[latestS3.severity].border}`}>
                <div className="text-xs text-muted-foreground mb-1">{t('vayu_spi3_label')}</div>
                <div className={`text-3xl font-black ${SEVERITY_COLORS[latestS3.severity].text}`}>
                  {latestS3.spi.toFixed(2)}
                </div>
                <div className="text-xs mt-1 text-muted-foreground">{severityLabel[latestS3.severity]}</div>
              </div>
            )}

            {/* SPI-6 */}
            {latestS6 && (
              <div className={`rounded-2xl border p-5 ${SEVERITY_COLORS[latestS6.severity].bg} ${SEVERITY_COLORS[latestS6.severity].border}`}>
                <div className="text-xs text-muted-foreground mb-1">{t('vayu_spi6_label')}</div>
                <div className={`text-3xl font-black ${SEVERITY_COLORS[latestS6.severity].text}`}>
                  {latestS6.spi.toFixed(2)}
                </div>
                <div className="text-xs mt-1 text-muted-foreground">{severityLabel[latestS6.severity]}</div>
              </div>
            )}

            {/* Dry spell days */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">{t('vayu_dry_spell_days')}</span>
              </div>
              <div className="text-3xl font-black text-foreground">{drySpell}</div>
              <div className="text-xs text-muted-foreground mt-1">days &lt;1 mm rain</div>
            </div>
          </div>

          {/* Soil moisture */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: t('vayu_soil_moisture_surface'), value: sm0, icon: Droplets, depth: '0–7 cm' },
              { label: t('vayu_soil_moisture_root'),    value: sm7, icon: Droplets, depth: '7–28 cm' },
            ].map(({ label, value, icon: Icon, depth }) => {
              const pct = Math.round(Math.min(value / 0.5, 1) * 100);
              const barColor = pct > 60 ? '#10b981' : pct > 30 ? '#eab308' : '#ef4444';
              return (
                <div key={depth} className="rounded-2xl border border-border/50 bg-card/60 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-sky-400" />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-2">
                    {value.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">m³/m³</span>
                  </div>
                  <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: barColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{pct}% of field capacity proxy</div>
                </div>
              );
            })}
          </div>

          {/* SPI time-series chart */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">SPI Trend (last 24 months)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spi3g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="spi6g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} tickLine={false} domain={[-3, 3]} />
                  <Tooltip content={<SPITooltip />} />
                  {/* Severity bands */}
                  <ReferenceLine y={0}    stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                  <ReferenceLine y={-0.5} stroke="#eab308" strokeDasharray="2 4" strokeWidth={0.8} label={{ value: 'Watch', fontSize: 9, fill: '#eab308' }} />
                  <ReferenceLine y={-1.0} stroke="#f97316" strokeDasharray="2 4" strokeWidth={0.8} label={{ value: 'Warning', fontSize: 9, fill: '#f97316' }} />
                  <ReferenceLine y={-1.5} stroke="#ef4444" strokeDasharray="2 4" strokeWidth={0.8} label={{ value: 'Emergency', fontSize: 9, fill: '#ef4444' }} />
                  <Area type="monotone" dataKey="spi3" name="SPI-3" stroke="#f97316" fill="url(#spi3g)" strokeWidth={1.5} dot={false} connectNulls />
                  <Area type="monotone" dataKey="spi6" name="SPI-6" stroke="#a855f7" fill="url(#spi6g)" strokeWidth={1.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex gap-3">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">{t('vayu_disclaimer')}</p>
          </div>

          {/* Provenance */}
          <div className="text-xs text-muted-foreground/60">
            <span className="font-semibold">{t('vayu_provenance')}: </span>
            SPI from Open-Meteo Historical Archive API · Soil moisture from Open-Meteo Forecast API ·
            Methodology: MoA Manual for Drought Management (2016)
          </div>
        </motion.div>
      )}
    </div>
  );
}
