import { cn } from '@/lib/utils';
import { Sparkles, Star } from 'lucide-react';
import type { CircularBadge as BadgeTier } from '@/lib/saath/types';

const BADGE_STYLE: Record<Exclude<BadgeTier, 'none'>, { ring: string; label: string }> = {
  bronze: { ring: 'bg-amber-700/15 text-amber-700 border-amber-700/30', label: 'Bronze' },
  silver: { ring: 'bg-slate-400/15 text-slate-500 border-slate-400/40', label: 'Silver' },
  gold: { ring: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/40', label: 'Gold' },
};

export function CircularBadge({ tier, className }: { tier: BadgeTier; className?: string }) {
  if (!tier || tier === 'none') return null;
  const s = BADGE_STYLE[tier];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        s.ring,
        className,
      )}
      title={`${s.label} circular contribution — completed IFS exchanges`}
    >
      <Sparkles className="w-3 h-3" />
      {s.label} circular
    </span>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'bg-card rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/60',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="font-serif text-lg font-bold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function StarRow({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={cn('p-0.5', !readOnly && 'hover:scale-110 transition-transform')}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              'w-5 h-5',
              n <= value ? 'fill-accent text-accent' : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
}
