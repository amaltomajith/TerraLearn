import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Clock, AlertTriangle, ListChecks } from 'lucide-react';
import { format, isToday, isBefore, startOfDay, addDays, isAfter } from 'date-fns';
import { useIdentity } from '@/lib/identity/identity';
import { useAsync } from '@/lib/saath/useAsync';
import { listMyTasks, completeTask } from '@/lib/farm/queries';
import type { FarmTask } from '@/lib/farm/types';

interface Props {
  /** Compact variant hides the empty state detail for owners viewing their sidebar. */
  compact?: boolean;
}

type Group = 'overdue' | 'today' | 'upcoming' | 'no-date';

const GROUP_META: Record<Group, { label: string; icon: typeof Clock; color: string }> = {
  overdue: { label: 'Overdue', icon: AlertTriangle, color: 'text-destructive' },
  today: { label: 'Today', icon: Clock, color: 'text-amber-500' },
  upcoming: { label: 'Upcoming', icon: Circle, color: 'text-primary' },
  'no-date': { label: 'No due date', icon: ListChecks, color: 'text-muted-foreground' },
};

function groupTask(t: FarmTask): Group {
  if (!t.due_date) return 'no-date';
  const d = startOfDay(new Date(t.due_date));
  const now = startOfDay(new Date());
  if (isBefore(d, now)) return 'overdue';
  if (isToday(d)) return 'today';
  return 'upcoming';
}

export function MyTasksCard({ compact }: Props) {
  const { activeFarmerId } = useIdentity();
  const { data: tasks, reload } = useAsync(
    async () => (activeFarmerId ? listMyTasks(activeFarmerId) : []),
    [activeFarmerId],
  );

  const [completing, setCompleting] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m: Record<Group, FarmTask[]> = { overdue: [], today: [], upcoming: [], 'no-date': [] };
    for (const t of tasks ?? []) m[groupTask(t)].push(t);
    return m;
  }, [tasks]);

  const total = (tasks ?? []).length;

  async function handleComplete(id: string) {
    setCompleting(id);
    try {
      await completeTask(id);
      toast.success('Task done!');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCompleting(null);
    }
  }

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
        <h4 className="text-sm font-bold text-foreground">My tasks</h4>
        {total > 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          {compact ? 'No open tasks.' : 'Nothing assigned to you right now — check back later or ask your farm manager.'}
        </p>
      ) : (
        <div className="space-y-4">
          {(['overdue', 'today', 'upcoming', 'no-date'] as Group[]).map((g) => {
            const items = grouped[g];
            if (items.length === 0) return null;
            const M = GROUP_META[g];
            return (
              <div key={g}>
                <div className={`flex items-center gap-1.5 mb-2 ${M.color}`}>
                  <M.icon className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{M.label}</span>
                  <span className="text-[10px] font-semibold opacity-60">({items.length})</span>
                </div>
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleComplete(t.id)}
                        disabled={completing === t.id}
                        className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                        aria-label={`Complete task: ${t.title}`}
                      >
                        {completing === t.id ? (
                          <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground leading-snug">{t.title}</p>
                        {t.detail && (
                          <p className="text-xs text-foreground/70 leading-relaxed mt-0.5">{t.detail}</p>
                        )}
                        {t.due_date && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Due {format(new Date(t.due_date), 'd MMM yyyy')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
