import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Loader2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

export interface RiskBriefContext {
  lat: number;
  lng: number;
  crop: string;
  plantingDate: string;
  yieldEstimate: number;
  viabilityScore: number;
  profit: number;
}

interface EnvironmentalOutlookProps {
  context: RiskBriefContext | null;
}

type BriefState = 'idle' | 'loading' | 'success' | 'error';

async function fetchRiskBrief(ctx: RiskBriefContext, baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/risk-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.brief as string;
}

export function EnvironmentalOutlook({ context }: EnvironmentalOutlookProps) {
  const [brief, setBrief] = useState<string>('');
  const [state, setState] = useState<BriefState>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const lastContextRef = useRef<string>('');

  const load = (ctx: RiskBriefContext) => {
    // Prevent duplicate fetches for identical context
    const key = JSON.stringify(ctx);
    if (key === lastContextRef.current && state === 'success') return;
    lastContextRef.current = key;

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState('loading');
    setBrief('');

    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';

    fetchRiskBrief(ctx, baseUrl)
      .then((text) => {
        if (abortRef.current?.signal.aborted) return;
        const isError =
          !text ||
          text.startsWith('Error') ||
          text.toLowerCase().includes('unavailable') ||
          text.toLowerCase().includes('rate-limited');
        if (isError) {
          setState('error');
        } else {
          setBrief(text);
          setState('success');
        }
      })
      .catch(() => {
        if (abortRef.current?.signal.aborted) return;
        setState('error');
      });
  };

  useEffect(() => {
    if (!context) {
      setState('idle');
      setBrief('');
      lastContextRef.current = '';
      return;
    }
    load(context);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  // Don't render anything until a simulation has run
  if (!context) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="env-outlook"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="bg-card rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary" />
            </div>
            <h4 className="text-sm font-bold text-foreground">Environmental Outlook</h4>
          </div>

          {state === 'error' && (
            <button
              type="button"
              onClick={() => context && load(context)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              title="Retry"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}

          {state === 'success' && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              AI Grounded
            </span>
          )}
        </div>

        {/* Content */}
        {state === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span>Analysing environmental conditions for {context.crop}…</span>
          </div>
        )}

        {state === 'success' && (
          <p className="text-sm text-foreground/85 leading-relaxed">{brief}</p>
        )}

        {state === 'error' && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground py-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>Environmental insights unavailable — backend may be offline or rate-limited.</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
