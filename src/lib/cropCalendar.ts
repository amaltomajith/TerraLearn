// Turns a crop + sowing date into a stage timeline for ANY crop, generalizing
// the paddy-only `paddyStage` in src/lib/advisories.ts. Driven by
// CROP_DATABASE[crop].growingDays and calculateHarvestDate (both in api.ts) —
// no agronomy knowledge base, no new endpoints. The dashboard's CropCalendar
// renders this; advisories.ts keys its stage-specific rules off `genericStage`.

import { CROP_DATABASE, calculateHarvestDate, type CropInfo } from './api';

export type Stage = 'establishment' | 'vegetative' | 'reproductive' | 'maturity';

export type Phase = Stage | 'pre-sowing' | 'post-harvest';

/**
 * Fractions of the growing period at which each stage ENDS. Chosen so that at
 * growingDays ≈ 150 (paddy) the boundaries land close to paddy's hand-tuned
 * thresholds (establishment ≤ day 14, vegetative ≤ 55, maturity ≥ gd − 20).
 */
const STAGE_END_FRACTION: Record<Stage, number> = {
  establishment: 0.12,
  vegetative: 0.45,
  reproductive: 0.8,
  maturity: 1,
};

const STAGE_ORDER: Stage[] = ['establishment', 'vegetative', 'reproductive', 'maturity'];

const STAGE_LABEL: Record<Stage, string> = {
  establishment: 'Establishment',
  vegetative: 'Vegetative growth',
  reproductive: 'Flowering & fruiting',
  maturity: 'Maturity & harvest',
};

/** Crop-agnostic things worth doing in each stage. Deliberately short. */
const STAGE_ACTIONS: Record<Stage, string[]> = {
  establishment: [
    'Keep moisture even — young roots are shallow',
    'Gap-fill or thin to an even stand',
    'First weeding before weeds get ahead',
  ],
  vegetative: [
    'Split the nitrogen dose rather than one heavy application',
    'Weed and earth-up while you still can walk the rows',
    'Scout for early pests and leaf disease',
  ],
  reproductive: [
    "Don't let the crop dry out at flowering — this sets your yield",
    'Avoid spraying during flowering hours to protect pollinators',
    'Watch for flower / boll / grain pests',
  ],
  maturity: [
    'Taper off irrigation as the crop ripens',
    'Line up harvest labour and storage now',
    'Check grain / produce moisture before you cut',
  ],
};

const DAY_MS = 86_400_000;

export interface StageSegment {
  stage: Stage;
  label: string;
  startDay: number;
  endDay: number;
  startDate: Date;
  endDate: Date;
  actions: string[];
}

export interface Milestone {
  day: number;
  date: Date;
  label: string;
  done: boolean;
}

export interface CropTimeline {
  crop: string;
  sowingDate: Date;
  growingDays: number;
  expectedHarvest: Date;
  daysSinceSowing: number;
  currentPhase: Phase;
  segments: StageSegment[];
  milestones: Milestone[];
}

/** Which growth stage a crop is in, `daysSince` days after sowing. */
export function genericStage(daysSince: number, growingDays: number): Stage {
  const frac = growingDays > 0 ? daysSince / growingDays : 0;
  for (const s of STAGE_ORDER) {
    if (frac <= STAGE_END_FRACTION[s]) return s;
  }
  return 'maturity';
}

/** Extra, crop-specific calendar notes overlaid onto the milestone list. */
export const CROP_CALENDAR_NOTES: Record<string, { day: number; label: string }[]> = {
  rice: [
    { day: 21, label: 'Transplant seedlings (if raised in a nursery)' },
    { day: 40, label: 'Tillering — first top-dress of nitrogen' },
    { day: 60, label: 'Panicle initiation — second nitrogen split' },
    { day: 95, label: 'Flowering — keep 5 cm standing water' },
  ],
};

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/**
 * Build the full timeline for a crop cycle. `crop` is a CROP_DATABASE display
 * name (case-insensitive); unknown crops fall back to a 100-day period.
 */
export function buildCropTimeline(
  crop: string,
  sowingDate: Date,
  opts?: { harvestDate?: Date | null; now?: Date },
): CropTimeline {
  const info: CropInfo | undefined = CROP_DATABASE[crop.toLowerCase()];
  const growingDays = info?.growingDays ?? 100;
  const now = opts?.now ?? new Date();
  const expectedHarvest =
    opts?.harvestDate ?? calculateHarvestDate(sowingDate, crop);

  const daysSinceSowing = Math.floor((now.getTime() - sowingDate.getTime()) / DAY_MS);

  let currentPhase: Phase;
  if (daysSinceSowing < 0) currentPhase = 'pre-sowing';
  else if (now.getTime() > expectedHarvest.getTime()) currentPhase = 'post-harvest';
  else currentPhase = genericStage(daysSinceSowing, growingDays);

  const segments: StageSegment[] = [];
  let prevFrac = 0;
  for (const stage of STAGE_ORDER) {
    const startDay = Math.round(prevFrac * growingDays);
    const endDay = Math.round(STAGE_END_FRACTION[stage] * growingDays);
    segments.push({
      stage,
      label: STAGE_LABEL[stage],
      startDay,
      endDay,
      startDate: addDays(sowingDate, startDay),
      endDate: addDays(sowingDate, endDay),
      actions: STAGE_ACTIONS[stage],
    });
    prevFrac = STAGE_END_FRACTION[stage];
  }

  const milestones: Milestone[] = [
    { day: 0, date: new Date(sowingDate), label: 'Sowing', done: daysSinceSowing >= 0 },
  ];
  for (const seg of segments.slice(1)) {
    milestones.push({
      day: seg.startDay,
      date: seg.startDate,
      label: `${seg.label} begins`,
      done: now.getTime() >= seg.startDate.getTime(),
    });
  }
  for (const note of CROP_CALENDAR_NOTES[crop.toLowerCase()] ?? []) {
    const date = addDays(sowingDate, note.day);
    milestones.push({ day: note.day, date, label: note.label, done: now.getTime() >= date.getTime() });
  }
  milestones.push({
    day: growingDays,
    date: expectedHarvest,
    label: 'Expected harvest',
    done: now.getTime() >= expectedHarvest.getTime(),
  });
  milestones.sort((a, b) => a.day - b.day || a.date.getTime() - b.date.getTime());

  return {
    crop,
    sowingDate,
    growingDays,
    expectedHarvest,
    daysSinceSowing,
    currentPhase,
    segments,
    milestones,
  };
}

export function stageLabel(stage: Stage): string {
  return STAGE_LABEL[stage];
}
