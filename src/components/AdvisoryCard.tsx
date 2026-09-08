import { motion } from 'framer-motion';
import { ListChecks, ClipboardList } from 'lucide-react';
import type { Advisory } from '@/lib/advisories';
import type { AqiSeverity } from '@/lib/aqi';

interface AdvisoryCardProps {
  advisories: Advisory[];
  /** When provided, renders an "Add to tasks" button per advisory (owner/manager only). */
  onMakeTask?: (advisory: Advisory) => void;
}

const DOT: Record<AqiSeverity, string> = {
  good: 'bg-emerald-500',
  moderate: 'bg-amber-500',
  unhealthy: 'bg-rose-500',
};

export function AdvisoryCard({ advisories, onMakeTask }: AdvisoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <ListChecks className="w-4 h-4 text-primary" />
        </div>
        <h4 className="text-sm font-bold text-foreground">What to do now</h4>
        {advisories.length > 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
            {advisories.length}
          </span>
        )}
      </div>

      {advisories.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          No time-sensitive actions for your crop right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {advisories.map((a) => (
            <li key={a.id} className="flex gap-2.5">
              <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT[a.severity]}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-snug">{a.title}</p>
                <p className="text-xs text-foreground/80 leading-relaxed mt-0.5">{a.detail}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{a.basis}</p>
              </div>
              {onMakeTask && (
                <button
                  type="button"
                  onClick={() => onMakeTask(a)}
                  className="shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  title="Add to farm tasks"
                >
                  <ClipboardList className="w-3 h-3" />
                  Task
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground/80 leading-snug mt-3 pt-3 border-t border-border/20">
        Guidance from your pin's regional weather and soil estimate — check your field before
        acting.
      </p>
    </motion.div>
  );
}
