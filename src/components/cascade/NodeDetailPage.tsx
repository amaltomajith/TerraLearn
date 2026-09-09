import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Droplets,
  Layers,
  TrendingDown,
  CloudLightning,
  Banknote,
  Zap,
  Users,
  Package,
  Info,
  ArrowLeft,
  Database,
  GitBranch,
  AlertCircle,
} from 'lucide-react';
import { useIdentity } from '@/lib/identity/identity';
import { useCascade } from '@/lib/cascade/useCascade';
import type { NodeScore, NodeId, RiskLevel } from '@/lib/cascade/types';
import { cn } from '@/lib/utils';

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

const LEVEL_BG: Record<RiskLevel, string> = {
  low: 'bg-emerald-500/10 border-emerald-500/30',
  moderate: 'bg-amber-500/10 border-amber-500/30',
  elevated: 'bg-orange-500/10 border-orange-500/30',
  high: 'bg-red-500/10 border-red-500/30',
  critical: 'bg-red-700/10 border-red-700/40',
  unknown: 'bg-muted/30 border-border/40',
};

const LEVEL_COLORS: Record<RiskLevel, string> = {
  low: 'text-emerald-500',
  moderate: 'text-amber-500',
  elevated: 'text-orange-500',
  high: 'text-red-500',
  critical: 'text-red-700',
  unknown: 'text-muted-foreground',
};

const NODE_DESCRIPTIONS: Record<NodeId, string> = {
  water:
    'Water availability is computed from the last 90-day precipitation deficit relative to the prior 90-day window, using daily rainfall totals from the Open-Meteo historical archive. Extreme-rain events (>50 mm/day) count toward flood risk, not just drought. This node is the Hazard node\'s most direct upstream driver.',
  soil:
    'Soil health is derived from ISRIC SoilGrids (~250 m resolution regional model) at your farm pin. The score weights pH deviation from the 6.0–7.0 optimal band and available nitrogen (cg/kg). Phosphorus and potassium are estimated derivations, not direct SoilGrids measurements — see the source flag.',
  market:
    'Market pressure is the recent mandi trend from Agmarknet (data.gov.in): the percentage difference between the latest modal price and the 30-day trailing average for your primary crop. A declining price trend reduces the farm\'s ability to service debt, which is why this node has a causal edge to the Credit node.',
  hazard:
    'Hazard exposure focuses on short-horizon extreme events: days with >50 mm or >100 mm of rainfall in the last 30 days, from Open-Meteo. Unlike the Water node\'s 90-day window, this tracks acute shocks rather than cumulative deficit. Elevated hazard bumps the Water node by one level via cascade propagation.',
  credit:
    'Credit stress is a static district-level indicator only. No per-farmer debt data is collected or stored — this is a non-negotiable ethics constraint (see terralearn_planned_features.md §1, "Ethics constraint"). Vidarbha, a major reference geography for this platform, is the real-world epicenter of India\'s farmer debt crisis, making individual debt collection a genuine misuse risk.',
  power:
    'Power reliability has no data source integrated yet. State electricity board outage data is the identified source, but API access is inconsistent across states. The planned features doc explicitly says to skip this node rather than fabricate a proxy — it shows as "unknown" rather than a guess.',
  labour:
    'Labour availability needs real critical mass of registered farmers before it can be honest — the planned features doc calls out that a harvest-window demand curve with only three data points is worse than no curve at all. This node will activate once Saath has sufficient density of sowing declarations.',
  input:
    'Input costs (seed, fertiliser, pesticide) are planned to come from the IFS seasonal calendar, which will surface what resources are available at what cost across a region. Not yet integrated.',
};

const CAUSAL_OUTGOING: Partial<Record<NodeId, string[]>> = {
  water: ['Hazard — drought deficit amplifies hazard node by 1 level'],
  hazard: ['Water — flood events cascade to irrigation failure'],
  market: ['Credit — declining prices reduce debt-servicing capacity'],
  soil: ['Input — poor soil forces higher fertiliser cost'],
};

function NodeDetail({ node }: { node: NodeScore }) {
  const Icon = ICON_MAP[node.icon] ?? Info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      {/* Header */}
      <div className={cn('p-6 rounded-2xl border', LEVEL_BG[node.level])}>
        <div className="flex items-center gap-4">
          <div className={cn('w-14 h-14 rounded-2xl bg-background/60 border flex items-center justify-center', LEVEL_BG[node.level])}>
            <Icon className={cn('w-7 h-7', LEVEL_COLORS[node.level])} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Risk Node</p>
            <h3 className="text-2xl font-black text-foreground">{node.label}</h3>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide mt-1',
                node.level === 'unknown'
                  ? 'bg-muted/50 text-muted-foreground'
                  : LEVEL_BG[node.level],
                LEVEL_COLORS[node.level],
              )}
            >
              {node.level === 'unknown' ? 'No data' : node.level}
            </span>
          </div>
        </div>
      </div>

      {/* Current reading */}
      <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Reading</p>
        <p className="text-sm text-foreground">{node.detail}</p>
        {node.cascadeNote && (
          <div className="mt-2 flex items-start gap-2 text-xs text-orange-500">
            <GitBranch className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{node.cascadeNote}</span>
          </div>
        )}
      </div>

      {/* Data source */}
      <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground/60" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Source</p>
        </div>
        <p className="text-sm text-foreground">{node.source}</p>
        {!node.dataAvailable && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-500">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Data not yet available — this node is excluded from the viability band calculation.</span>
          </div>
        )}
      </div>

      {/* Causal edges */}
      {CAUSAL_OUTGOING[node.nodeId] && (
        <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground/60" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Causal Edges</p>
          </div>
          <ul className="space-y-1">
            {CAUSAL_OUTGOING[node.nodeId]!.map((edge) => (
              <li key={edge} className="text-sm text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                {edge}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Context */}
      <div className="p-5 rounded-xl border border-border/50 bg-muted/20 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">About This Node</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {NODE_DESCRIPTIONS[node.nodeId]}
        </p>
      </div>
    </motion.div>
  );
}

export function NodeDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { primaryFarm } = useIdentity();

  const lat = primaryFarm?.lat ?? null;
  const lng = primaryFarm?.lng ?? null;
  const crop = (primaryFarm?.crops?.[0] ?? primaryFarm?.primary_crop ?? 'wheat').toLowerCase();

  const { result, status } = useCascade(lat, lng, crop);

  const requestedNode = params.get('node') as NodeId | null;
  const node = result?.allNodes.find((n) => n.nodeId === requestedNode) ?? result?.allNodes[0] ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back link */}
      <button
        onClick={() => navigate('../overview')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Overview
      </button>

      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Node Detail</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Drill into any node to see its raw signal, data source, and causal edges.
        </p>
      </div>

      {/* Node selector pills */}
      {result && (
        <div className="flex flex-wrap gap-2">
          {result.allNodes.map((n) => {
            const Icon = ICON_MAP[n.icon] ?? Info;
            return (
              <button
                key={n.nodeId}
                onClick={() => navigate(`?node=${n.nodeId}`)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                  requestedNode === n.nodeId || (!requestedNode && n === result.allNodes[0])
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/80',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {n.label}
              </button>
            );
          })}
        </div>
      )}

      {status === 'loading' && !result && (
        <div className="py-16 text-center text-sm text-muted-foreground">Computing nodes…</div>
      )}

      {node && <NodeDetail node={node} />}
    </div>
  );
}
