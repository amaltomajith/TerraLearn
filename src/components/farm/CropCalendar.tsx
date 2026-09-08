import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Sprout, CheckCircle2, Circle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { CropTimeline, Stage } from '@/lib/cropCalendar';
import { stageLabel } from '@/lib/cropCalendar';
import type { FarmEvent } from '@/lib/farm/types';

const STAGE_TINT: Record<Stage, string> = {
  establishment: 'bg-sky-500/70',
  vegetative: 'bg-emerald-500/70',
  reproductive: 'bg-amber-500/70',
  maturity: 'bg-orange-600/70',
};

const EVENT_LABEL: Record<FarmEvent['kind'], string> = {
  irrigation: 'Irrigation',
  spray: 'Spray',
  fertiliser: 'Fertiliser',
  observation: 'Note',
  sowing: 'Sowing',
  harvest: 'Harvest',
  other: 'Log',
};

interface Props {
  timeline: CropTimeline;
  events: FarmEvent[];
  /** Opens the quick-log form (owner / manager / worker). Omit for a pure read-only view. */
  onLogEvent?: () => void;
  readOnly?: boolean;
}

export function CropCalendar({ timeline, events, onLogEvent, readOnly }: Props) {
  const { crop, sowingDate, growingDays, expectedHarvest, daysSinceSowing, currentPhase, segments, milestones } =
    timeline;

  const totalDays = Math.max(growingDays, 1);
  const todayPct = Math.min(100, Math.max(0, (daysSinceSowing / totalDays) * 100));

  const cycleEvents = useMemo(
    () =>
      events
        .map((e) => {
          const day = Math.floor(
            (new Date(e.occurred_on).getTime() - sowingDate.getTime()) / 86_400_000,
          );
          return { ...e, day, pct: Math.min(100, Math.max(0, (day / totalDays) * 100)) };
        })
        .filter((e) => e.day >= -3 && e.day <= totalDays + 14),
    [events, sowingDate, totalDays],
  );

  const currentStage = segments.find((s) => s.stage === currentPhase);
  const phaseHeading =
    currentPhase === 'pre-sowing'
      ? 'Not sown yet'
      : currentPhase === 'post-harvest'
        ? 'Past expected harvest'
        : `${stageLabel(currentPhase as Stage)} · day ${Math.max(0, daysSinceSowing)} of ${growingDays}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
            <Sprout className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{crop} — this season</h3>
            <p className="text-[11px] text-muted-foreground">{phaseHeading}</p>
          </div>
        </div>
        {onLogEvent && !readOnly && (
          <button
            type="button"
            onClick={onLogEvent}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 shrink-0"
          >
            <Plus className="w-3 h-3" /> Log
          </button>
        )}
      </div>

      {/* Stage bar */}
      <div className="relative">
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {segments.map((s) => {
            const w = ((s.endDay - s.startDay) / totalDays) * 100;
            return (
              <div
                key={s.stage}
                className={STAGE_TINT[s.stage]}
                style={{ width: `${w}%` }}
                title={`${s.label} · day ${s.startDay}–${s.endDay}`}
              />
            );
          })}
        </div>

        {/* event dots */}
        {cycleEvents.map((e) => (
          <span
            key={e.id}
            className="absolute -top-1 w-2 h-2 rounded-full bg-foreground/70 ring-2 ring-card"
            style={{ left: `calc(${e.pct}% - 4px)` }}
            title={`${EVENT_LABEL[e.kind]}${e.note ? ` — ${e.note}` : ''} · ${format(new Date(e.occurred_on), 'd MMM')}`}
          />
        ))}

        {/* today marker */}
        {daysSinceSowing >= 0 && daysSinceSowing <= totalDays + 14 && (
          <span
            className="absolute -bottom-1 h-5 w-0.5 bg-primary"
            style={{ left: `calc(${todayPct}% - 1px)` }}
            title={`Today · day ${daysSinceSowing}`}
          />
        )}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{format(sowingDate, 'd MMM')}</span>
        <span className="flex items-center gap-1">
          <CalendarClock className="w-3 h-3" />
          harvest ≈ {format(expectedHarvest, 'd MMM yyyy')}
        </span>
      </div>

      {/* Current-stage actions */}
      {currentStage && (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-semibold text-foreground mb-1.5">
            {currentStage.label} — worth doing now
          </p>
          <ul className="space-y-1">
            {currentStage.actions.map((a) => (
              <li key={a} className="text-[11px] text-foreground/80 leading-snug flex gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Milestones */}
      <ul className="mt-4 space-y-2">
        {milestones.map((m, i) => (
          <li key={`${m.day}-${i}`} className="flex items-start gap-2 text-xs">
            {m.done ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
            )}
            <span className={m.done ? 'text-muted-foreground' : 'text-foreground'}>
              {m.label}
              <span className="text-muted-foreground/70"> · {format(m.date, 'd MMM')}</span>
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
