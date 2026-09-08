import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Droplets,
  SprayCan,
  Leaf,
  Eye,
  Sprout,
  Scissors,
  StickyNote,
  Trash2,
  ListChecks,
} from 'lucide-react';
import { format } from 'date-fns';
import { useIdentity } from '@/lib/identity/identity';
import { createFarmEvent, deleteFarmEvent } from '@/lib/farm/queries';
import type { FarmEvent, FarmEventKind } from '@/lib/farm/types';

const KIND_META: Record<FarmEventKind, { label: string; icon: typeof Droplets }> = {
  irrigation: { label: 'Irrigation', icon: Droplets },
  spray: { label: 'Spray', icon: SprayCan },
  fertiliser: { label: 'Fertiliser', icon: Leaf },
  observation: { label: 'Note', icon: Eye },
  sowing: { label: 'Sowing', icon: Sprout },
  harvest: { label: 'Harvest', icon: Scissors },
  other: { label: 'Other', icon: StickyNote },
};

const QUICK_KINDS: FarmEventKind[] = ['irrigation', 'spray', 'fertiliser', 'observation', 'other'];

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface Props {
  farmId: string;
  cycleId?: string | null;
  events: FarmEvent[];
  onChange: () => void;
  readOnly?: boolean;
}

export function FarmLog({ farmId, cycleId, events, onChange, readOnly }: Props) {
  const { activeFarmerId } = useIdentity();
  const [kind, setKind] = useState<FarmEventKind>('irrigation');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(isoDate(new Date()));
  const [busy, setBusy] = useState(false);

  // Show a short identifier for each non-self logger
  function loggerLabel(loggerId: string) {
    if (loggerId === activeFarmerId) return 'You';
    return `Farmer …${loggerId.slice(-4)}`;
  }

  async function add() {
    if (!activeFarmerId) return;
    setBusy(true);
    try {
      await createFarmEvent({
        farmId,
        cycleId: cycleId ?? null,
        kind,
        note: note.trim() || null,
        occurredOn: day,
        loggedBy: activeFarmerId,
      });
      setNote('');
      onChange();
    } catch (e) {
      toast.error(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteFarmEvent(id);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <ListChecks className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Farm log</h3>
        {events.length > 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
            {events.length}
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 mb-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_KINDS.map((k) => {
              const M = KIND_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    kind === k
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <M.icon className="w-3 h-3" />
                  {M.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was done? (optional)"
              className="flex-1 h-9 rounded-lg border border-border/60 bg-background px-3 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && !busy && add()}
            />
            <input
              type="date"
              value={day}
              max={isoDate(new Date())}
              onChange={(e) => setDay(e.target.value)}
              className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy}
              className="rounded-lg bg-primary px-3 h-9 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Log
            </button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          {readOnly ? 'Nothing logged yet.' : 'No entries yet — log irrigation, spraying or a note above.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const M = KIND_META[e.kind];
            const who = loggerLabel(e.logged_by);
            const mine = e.logged_by === activeFarmerId;
            return (
              <li key={e.id} className="flex items-start gap-2.5 text-xs">
                <M.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">
                    <span className="font-semibold">{M.label}</span>
                    {e.note ? <span className="text-foreground/80"> — {e.note}</span> : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(e.occurred_on), 'd MMM yyyy')} · {who}
                  </p>
                </div>
                {!readOnly && mine && (
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="text-muted-foreground/60 hover:text-destructive shrink-0"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
