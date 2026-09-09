import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets,
  Layers,
  TrendingDown,
  CloudLightning,
  Banknote,
  Zap,
  Users,
  Package,
  RefreshCw,
  Loader2,
  Info,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Leaf,
} from 'lucide-react';
import { useIdentity } from '@/lib/identity/identity';
import { useCascade } from '@/lib/cascade/useCascade';
import type { NodeScore, ViabilityBand, RiskLevel } from '@/lib/cascade/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ElementType> = {
  Droplets,
  Layers,
  TrendingDown,
  CloudLightning,
  Banknote,
  Zap,
  Users,
  Package,
};

const LEVEL_COLORS: Record<RiskLevel, string> = {
  low: 'text-emerald-500',
  moderate: 'text-amber-500',
  elevated: 'text-orange-500',
  high: 'text-red-500',
  critical: 'text-red-700',
  unknown: 'text-muted-foreground',
};

const LEVEL_BG: Record<RiskLevel, string> = {
  low: 'bg-emerald-500/10 border-emerald-500/30',
  moderate: 'bg-amber-500/10 border-amber-500/30',
  elevated: 'bg-orange-500/10 border-orange-500/30',
  high: 'bg-red-500/10 border-red-500/30',
  critical: 'bg-red-700/10 border-red-700/40',
  unknown: 'bg-muted/30 border-border/40',
};

const LEVEL_PILL: Record<RiskLevel, string> = {
  low: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  moderate: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  elevated: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  high: 'bg-red-500/15 text-red-600 dark:text-red-400',
  critical: 'bg-red-700/20 text-red-700 dark:text-red-300',
  unknown: 'bg-muted/50 text-muted-foreground',
};

const BAND_CONFIG: Record<
  ViabilityBand,
  { gradient: string; text: string; label: string; icon: React.ElementType }
> = {
  good: {
    gradient: 'from-emerald-600/20 via-emerald-500/10 to-transparent',
    text: 'text-emerald-500',
    label: 'Good Season Outlook',
    icon: CheckCircle2,
  },
  fair: {
    gradient: 'from-amber-600/20 via-amber-500/10 to-transparent',
    text: 'text-amber-500',
    label: 'Fair — Monitor Closely',
    icon: Info,
  },
  elevated: {
    gradient: 'from-orange-600/20 via-orange-500/10 to-transparent',
    text: 'text-orange-500',
    label: 'Elevated Risk',
    icon: AlertTriangle,
  },
  critical: {
    gradient: 'from-red-700/20 via-red-600/10 to-transparent',
    text: 'text-red-500',
    label: 'Critical — Act Now',
    icon: Flame,
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LevelPill({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        LEVEL_PILL[level],
      )}
    >
      {level === 'unknown' ? 'No data' : level}
    </span>
  );
}

function NodeCard({
  node,
  onClick,
}: {
  node: NodeScore;
  onClick: () => void;
}) {
  const Icon = ICON_MAP[node.icon] ?? Info;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'w-full text-left p-4 rounded-xl border backdrop-blur-sm transition-shadow hover:shadow-lg group',
        LEVEL_BG[node.level],
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 p-2 rounded-lg bg-background/60',
            LEVEL_COLORS[node.level],
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-foreground">{node.label}</span>
            <LevelPill level={node.level} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{node.detail}</p>
          {node.cascadeNote && (
            <p className="mt-1 text-xs text-orange-500 italic">↗ {node.cascadeNote}</p>
          )}
          {!node.dataAvailable && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
              <Info className="w-3 h-3" /> No data yet
            </span>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 shrink-0 transition-colors" />
      </div>
    </motion.button>
  );
}

function DriverCard({ node, rank }: { node: NodeScore; rank: number }) {
  const Icon = ICON_MAP[node.icon] ?? Info;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex-1 min-w-0 p-5 rounded-2xl border backdrop-blur-sm',
        LEVEL_BG[node.level],
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center bg-background/60',
            LEVEL_COLORS[node.level],
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Driver #{rank + 1}
          </p>
          <p className="text-sm font-bold text-foreground">{node.label}</p>
        </div>
      </div>
      <LevelPill level={node.level} />
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{node.detail}</p>
    </motion.div>
  );
}

/** Simplified causal chain arrows between the highest-stress available nodes. */
function CascadeFlowDiagram({ nodes }: { nodes: NodeScore[] }) {
  const stressed = nodes
    .filter((n) => n.dataAvailable && ['elevated', 'high', 'critical'].includes(n.level))
    .slice(0, 4);

  if (stressed.length < 2) return null;

  return (
    <div className="mt-6 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Cascade Chain
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {stressed.map((n, i) => {
          const Icon = ICON_MAP[n.icon] ?? Info;
          return (
            <div key={n.nodeId} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border',
                  LEVEL_BG[n.level],
                  LEVEL_COLORS[n.level],
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {n.label}
              </div>
              {i < stressed.length - 1 && (
                <ArrowRight className="w-4 h-4 text-orange-400/60 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground/70">
        Stress in earlier nodes amplifies risk in downstream nodes via causal edges.
      </p>
    </div>
  );
}

const COMMON_CROPS = [
  { id: 'wheat', name: 'Wheat' },
  { id: 'cotton', name: 'Cotton' },
  { id: 'rice', name: 'Rice (Paddy)' },
  { id: 'tomatoes', name: 'Tomato' },
  { id: 'potatoes', name: 'Potato' },
  { id: 'onions', name: 'Onion' },
  { id: 'soybeans', name: 'Soybean' },
  { id: 'sugarcane', name: 'Sugarcane' },
  { id: 'corn', name: 'Maize' },
  { id: 'grapes', name: 'Grapes' },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function OverviewPage() {
  const { primaryFarm } = useIdentity();
  const navigate = useNavigate();

  const lat = primaryFarm?.lat ?? null;
  const lng = primaryFarm?.lng ?? null;

  // Pick actual crop from primary farm crops or primary_crop, fallback to wheat
  const farmCrop = (primaryFarm?.crops?.[0] ?? primaryFarm?.primary_crop ?? 'wheat').toLowerCase();
  const [selectedCrop, setSelectedCrop] = useState<string>(farmCrop);

  // Sync when primaryFarm loads
  useEffect(() => {
    if (farmCrop) {
      setSelectedCrop(farmCrop);
    }
  }, [farmCrop]);

  const { result, status, error, refresh } = useCascade(lat, lng, selectedCrop);

  const bandCfg = result ? BAND_CONFIG[result.viabilityBand] : null;
  const BandIcon = bandCfg?.icon ?? Info;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">
            Cascade Risk Engine
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Propagating shocks across 8 farm nodes — water, soil, market, credit, power, labour, input, hazard
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card/60 text-xs shadow-sm">
            <Leaf className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">Crop:</span>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              {COMMON_CROPS.map((c) => (
                <option key={c.id} value={c.id} className="bg-popover text-popover-foreground">
                  {c.name}
                </option>
              ))}
              {!COMMON_CROPS.some((c) => c.id === selectedCrop) && (
                <option value={selectedCrop} className="bg-popover text-popover-foreground">
                  {selectedCrop.charAt(0).toUpperCase() + selectedCrop.slice(1)}
                </option>
              )}
            </select>
          </div>
          <button
            onClick={refresh}
            disabled={status === 'loading'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/60 bg-card/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-all disabled:opacity-50"
          >
            {status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Loading state */}
      <AnimatePresence mode="wait">
        {status === 'loading' && !result && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Computing cascade risk across all nodes…</p>
            <p className="text-xs opacity-60">Fetching climate trends, soil, and market data</p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 rounded-2xl border border-destructive/30 bg-destructive/5 text-center"
          >
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
            <p className="text-sm font-semibold text-destructive">Could not compute risk</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button
              onClick={refresh}
              className="mt-4 px-4 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}

        {result && bandCfg && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* ── Viability Band Header ── */}
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl border p-6',
                result.viabilityBand === 'good' && 'border-emerald-500/30',
                result.viabilityBand === 'fair' && 'border-amber-500/30',
                result.viabilityBand === 'elevated' && 'border-orange-500/30',
                result.viabilityBand === 'critical' && 'border-red-500/40',
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-br opacity-60',
                  bandCfg.gradient,
                )}
              />
              <div className="relative flex items-start gap-4">
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl bg-background/60 border flex items-center justify-center shrink-0',
                    result.viabilityBand === 'good' && 'border-emerald-500/30',
                    result.viabilityBand === 'fair' && 'border-amber-500/30',
                    result.viabilityBand === 'elevated' && 'border-orange-500/30',
                    result.viabilityBand === 'critical' && 'border-red-500/40',
                  )}
                >
                  <BandIcon className={cn('w-7 h-7', bandCfg.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
                    Season Viability Band
                  </p>
                  <h3 className={cn('text-3xl font-black tracking-tight', bandCfg.text)}>
                    {bandCfg.label}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
                    {result.viabilityExplain}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground/60">
                    Farm: {primaryFarm?.label ?? 'Primary'} · Crop:{' '}
                    <span className="font-semibold text-foreground/80 capitalize">{selectedCrop}</span> ·{' '}
                    Computed {new Date(result.computedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Top Drivers ── */}
            {result.topDrivers.length > 0 && (
              <section>
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                  Top Risk Drivers
                </h4>
                <div className="flex flex-col sm:flex-row gap-4">
                  {result.topDrivers.map((node, i) => (
                    <DriverCard key={node.nodeId} node={node} rank={i} />
                  ))}
                </div>
              </section>
            )}

            {/* ── No data message when all nodes are unknown ── */}
            {result.topDrivers.length === 0 && (
              <div className="p-5 rounded-xl border border-border/50 bg-muted/20 text-center text-sm text-muted-foreground">
                <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
                No risk drivers identified — most data nodes are unavailable. Add your farm location and crop to unlock scoring.
              </div>
            )}

            {/* ── Cascade flow ── */}
            <CascadeFlowDiagram nodes={result.allNodes} />

            {/* ── All 8 Nodes Grid ── */}
            <section>
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                All Risk Nodes
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                {result.allNodes.map((node) => (
                  <NodeCard
                    key={node.nodeId}
                    node={node}
                    onClick={() => navigate(`../nodes?node=${node.nodeId}`)}
                  />
                ))}
              </div>
            </section>

            {/* ── Honesty footer ── */}
            <div className="p-4 rounded-xl border border-border/40 bg-muted/20 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="font-semibold text-foreground/80">About this score</p>
                <p>
                  The viability band is a <strong>directional indicator</strong>, not a precise forecast.
                  Edge weights are not yet calibrated against historical outcomes — treat
                  the direction (improving/worsening) as reliable, the exact band as approximate.
                </p>
                <p>
                  Data sources: Open-Meteo Archive API (climate), ISRIC SoilGrids (soil),
                  Agmarknet via data.gov.in (market). Credit and power nodes use static
                  district-level estimates only — no per-farmer data is collected or stored.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
