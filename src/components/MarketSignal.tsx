import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { getSeason, getSeasonName, type MandiPriceSeries } from '@/lib/api';

interface MarketSignalProps {
  crop: string;
  harvestDate: Date;
  lat: number;
  priceSource: 'buyer' | 'agmarknet' | 'reference';
  pricePerUnit: number;
  referencePricePerUnit: number;
  mandiTrendPct?: number;
  mandiSeries?: MandiPriceSeries | null;
  currencySymbol?: string;
  show: boolean;
}

type Tone = 'up' | 'down' | 'flat';

function toneFor(pct: number): Tone {
  if (pct > 3) return 'up';
  if (pct < -3) return 'down';
  return 'flat';
}

function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === 'up') return <TrendingUp className={className} />;
  if (tone === 'down') return <TrendingDown className={className} />;
  return <Minus className={className} />;
}

const TONE_TEXT: Record<Tone, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

export function MarketSignal({
  crop,
  harvestDate,
  lat,
  priceSource,
  pricePerUnit,
  referencePricePerUnit,
  mandiTrendPct,
  mandiSeries,
  currencySymbol = '₹',
  show,
}: MarketSignalProps) {
  const harvestMonth = harvestDate.getMonth();
  const glut = harvestMonth >= 8 && harvestMonth <= 10;
  const seasonPct = glut ? -18 : 8;

  const buyerDeltaPct = useMemo(() => {
    if (priceSource !== 'buyer' || !referencePricePerUnit) return null;
    return Math.round(((pricePerUnit - referencePricePerUnit) / referencePricePerUnit) * 100);
  }, [priceSource, pricePerUnit, referencePricePerUnit]);

  const verdict = useMemo(() => {
    const parts: number[] = [seasonPct];
    if (mandiTrendPct != null) parts.push(mandiTrendPct);
    if (buyerDeltaPct != null) parts.push(buyerDeltaPct);
    const avg = parts.reduce((s, p) => s + p, 0) / parts.length;
    if (avg > 5) return { label: 'Bullish', tone: 'up' as Tone };
    if (avg < -5) return { label: 'Bearish', tone: 'down' as Tone };
    return { label: 'Neutral', tone: 'flat' as Tone };
  }, [seasonPct, mandiTrendPct, buyerDeltaPct]);

  if (!show) return null;

  const hasLiveFeed = mandiTrendPct != null;
  const seasonName = getSeasonName(getSeason(harvestDate, lat));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <h4 className="text-sm font-bold text-foreground">Market signal</h4>
        </div>
        <span
          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            verdict.tone === 'up'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : verdict.tone === 'down'
                ? 'text-destructive bg-destructive/10 border-destructive/20'
                : 'text-muted-foreground bg-muted/40 border-border/50'
          }`}
        >
          <ToneIcon tone={verdict.tone} className="w-3 h-3" />
          {verdict.label}
        </span>
      </div>

      <div className="space-y-2.5">
        {/* Live mandi trend */}
        {hasLiveFeed && (
          <div className="flex items-start gap-2">
            <ToneIcon
              tone={toneFor(mandiTrendPct!)}
              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${TONE_TEXT[toneFor(mandiTrendPct!)]}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground/85">
                Mandi price for {crop.toLowerCase()} is{' '}
                <span className={`font-semibold ${TONE_TEXT[toneFor(mandiTrendPct!)]}`}>
                  {mandiTrendPct! > 0 ? '+' : ''}
                  {mandiTrendPct}%
                </span>{' '}
                vs the last {mandiSeries?.points.length ?? 0}-day average
                {mandiSeries?.latestPerTon
                  ? ` (${currencySymbol}${mandiSeries.latestPerTon.toLocaleString()}/t now)`
                  : ''}
                .
              </p>
              {mandiSeries && mandiSeries.points.length > 2 && (
                <div className="h-10 mt-1.5">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mandiSeries.points}>
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <Line
                        type="monotone"
                        dataKey="modalPricePerTon"
                        stroke="currentColor"
                        className={TONE_TEXT[toneFor(mandiTrendPct!)]}
                        strokeWidth={1.75}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Harvest seasonality */}
        <div className="flex items-start gap-2">
          <ToneIcon
            tone={toneFor(seasonPct)}
            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${TONE_TEXT[toneFor(seasonPct)]}`}
          />
          <p className="text-sm text-foreground/85">
            Harvest lands in {seasonName} —{' '}
            {glut
              ? 'peak-supply window, prices usually soften'
              : 'off-peak, prices usually hold firmer'}
            .
          </p>
        </div>

        {/* Buyer vs reference */}
        {buyerDeltaPct != null && (
          <div className="flex items-start gap-2">
            <ToneIcon
              tone={toneFor(buyerDeltaPct)}
              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${TONE_TEXT[toneFor(buyerDeltaPct)]}`}
            />
            <p className="text-sm text-foreground/85">
              The nearest live buyer is{' '}
              <span className={`font-semibold ${TONE_TEXT[toneFor(buyerDeltaPct)]}`}>
                {Math.abs(buyerDeltaPct)}% {buyerDeltaPct >= 0 ? 'above' : 'below'}
              </span>{' '}
              the reference price.
            </p>
          </div>
        )}

        {priceSource === 'reference' && !hasLiveFeed && (
          <p className="text-xs text-muted-foreground">
            No live buyer or mandi price in range — signal is harvest-timing only.
          </p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-3 pt-3 border-t border-border/30">
        {hasLiveFeed
          ? 'Live mandi data · data.gov.in Agmarknet'
          : 'Derived from harvest timing + nearby Saath demand — not a market feed.'}
      </p>
    </motion.div>
  );
}
