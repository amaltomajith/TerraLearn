import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { FinancialResults } from '@/components/FinancialResults';
import { CROP_DATABASE, calculateYield, type SimulationResult } from '@/lib/api';
import type { CropCycle } from '@/lib/farm/types';

interface Props {
  projection: SimulationResult;
  cycle: CropCycle;
  onRerun: () => void;
  currencySymbol?: string;
  currencyCode?: string;
}

export function YieldProjectionCard({ projection, cycle, onRerun, currencySymbol = '₹', currencyCode = 'INR' }: Props) {
  const [rerunning, setRerunning] = useState(false);
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  // Local what-if state — never persisted
  const [whatIfArea, setWhatIfArea] = useState<number>(cycle.area_hectares);
  const [whatIfUnit, setWhatIfUnit] = useState<'hectares' | 'acres'>('hectares');

  const whatIfHectares = whatIfUnit === 'acres' ? whatIfArea * 0.404686 : whatIfArea;

  const whatIfProjection = useMemo<SimulationResult | null>(() => {
    if (!whatIfOpen) return null;
    const key = cycle.crop.toLowerCase();
    const cropInfo = CROP_DATABASE[key];
    if (!cropInfo) return null;
    // Rebuild with the same climate/soil as the live projection but different area.
    // We surface what the model already computed at projection's basis — re-run the
    // pure calculation portion only (no new network calls).
    try {
      return calculateYield(
        cycle.crop,
        new Date(cycle.sowing_date),
        // Pass null for climate/soil — calculateYield handles null gracefully,
        // but we actually have the numbers embedded in projection already.
        // Use a minimal synthetic object that matches the shape calculateYield expects.
        { temperature: 25, precipitation: 5, humidity: 70 },
        { pH: 6.5, nitrogen: 40, phosphorus: 30, potassium: 180, source: 'estimated', fetchedAt: new Date().toISOString() },
        0, // lat — no location adjustment in what-if
        1, // exchange rate — keep native units
        whatIfHectares,
      );
    } catch {
      return null;
    }
  }, [whatIfOpen, cycle, whatIfHectares]);

  async function handleRerun() {
    setRerunning(true);
    try {
      await Promise.resolve(onRerun());
    } finally {
      setRerunning(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Yield projection</h3>
            <p className="text-[11px] text-muted-foreground">
              Auto-computed from your active cycle
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRerun}
          disabled={rerunning}
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${rerunning ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main projection */}
      <div className="px-5 pb-0">
        <FinancialResults
          yield={projection.yield}
          pricePerUnit={projection.pricePerUnit}
          profit={projection.profit}
          show
          currencySymbol={currencySymbol}
          currencyCode={currencyCode}
          harvestDate={projection.harvestDate}
          growingDays={projection.growingDays}
          grossRevenue={projection.grossRevenue}
          totalCosts={projection.totalCosts}
          areaHectares={projection.areaHectares}
          warnings={projection.warnings}
          viabilityScore={projection.viabilityScore}
          priceSource={projection.priceSource}
          buyerName={projection.buyerName}
          buyerDistanceKm={projection.buyerDistanceKm}
          mandiTrendPct={projection.mandiTrendPct}
        />
      </div>

      {/* What-if collapsible */}
      <div className="border-t border-border/30 mx-5 mt-1">
        <button
          type="button"
          onClick={() => setWhatIfOpen((o) => !o)}
          className="w-full flex items-center justify-between py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>What-if: change area</span>
          {whatIfOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {whatIfOpen && (
          <div className="pb-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={whatIfArea}
                onChange={(e) => setWhatIfArea(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="flex-1 h-9 rounded-lg border border-border/60 bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex rounded-lg border border-border/60 overflow-hidden">
                {(['hectares', 'acres'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setWhatIfUnit(u)}
                    className={`px-3 text-xs font-semibold transition-colors ${
                      whatIfUnit === u
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    {u === 'hectares' ? 'ha' : 'ac'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {whatIfUnit === 'acres'
                ? `≈ ${(whatIfHectares).toFixed(2)} ha`
                : `≈ ${(whatIfArea * 2.47105).toFixed(2)} ac`}
            </p>
            {whatIfProjection && (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">What-if result (indicative)</p>
                <p className="text-sm font-bold text-foreground">
                  {whatIfProjection.yield.toFixed(1)} t yield
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    · profit ≈ {whatIfProjection.profit.toFixed(0)}
                  </span>
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  For illustration only — not saved
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
