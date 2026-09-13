"""
Direct Python port of src/lib/cropCalendar.ts (lines 1-188). Turns a crop +
sowing date into a stage timeline, generalizing the paddy-only stage logic in
advisories.py. Driven only by CROP_DATABASE[crop].growing_days and
calculate_harvest_date — no agronomy knowledge base, no new endpoints.
advisories.py keys its stage-specific rules off generic_stage().
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal, Optional

from app.rules.crop_database import CROP_DATABASE, calculate_harvest_date

Stage = Literal["establishment", "vegetative", "reproductive", "maturity"]
Phase = str  # Stage | "pre-sowing" | "post-harvest"

# Fractions of the growing period at which each stage ENDS. Chosen so that at
# growing_days ~= 150 (paddy) the boundaries land close to paddy's hand-tuned
# thresholds (establishment <= day 14, vegetative <= 55, maturity >= gd - 20).
_STAGE_END_FRACTION: dict[Stage, float] = {
    "establishment": 0.12,
    "vegetative": 0.45,
    "reproductive": 0.8,
    "maturity": 1.0,
}

_STAGE_ORDER: list[Stage] = ["establishment", "vegetative", "reproductive", "maturity"]

_STAGE_LABEL: dict[Stage, str] = {
    "establishment": "Establishment",
    "vegetative": "Vegetative growth",
    "reproductive": "Flowering & fruiting",
    "maturity": "Maturity & harvest",
}

# Crop-agnostic things worth doing in each stage. Deliberately short.
_STAGE_ACTIONS: dict[Stage, list[str]] = {
    "establishment": [
        "Keep moisture even — young roots are shallow",
        "Gap-fill or thin to an even stand",
        "First weeding before weeds get ahead",
    ],
    "vegetative": [
        "Split the nitrogen dose rather than one heavy application",
        "Weed and earth-up while you still can walk the rows",
        "Scout for early pests and leaf disease",
    ],
    "reproductive": [
        "Don't let the crop dry out at flowering — this sets your yield",
        "Avoid spraying during flowering hours to protect pollinators",
        "Watch for flower / boll / grain pests",
    ],
    "maturity": [
        "Taper off irrigation as the crop ripens",
        "Line up harvest labour and storage now",
        "Check grain / produce moisture before you cut",
    ],
}

# Extra, crop-specific calendar notes overlaid onto the milestone list.
CROP_CALENDAR_NOTES: dict[str, list[dict]] = {
    "rice": [
        {"day": 21, "label": "Transplant seedlings (if raised in a nursery)"},
        {"day": 40, "label": "Tillering — first top-dress of nitrogen"},
        {"day": 60, "label": "Panicle initiation — second nitrogen split"},
        {"day": 95, "label": "Flowering — keep 5 cm standing water"},
    ],
}


def generic_stage(days_since: int, growing_days: int) -> Stage:
    """Which growth stage a crop is in, `days_since` days after sowing."""
    frac = days_since / growing_days if growing_days > 0 else 0
    for s in _STAGE_ORDER:
        if frac <= _STAGE_END_FRACTION[s]:
            return s
    return "maturity"


@dataclass
class StageSegment:
    stage: Stage
    label: str
    start_day: int
    end_day: int
    start_date: date
    end_date: date
    actions: list[str]


@dataclass
class Milestone:
    day: int
    date: date
    label: str
    done: bool


@dataclass
class CropTimeline:
    crop: str
    sowing_date: date
    growing_days: int
    expected_harvest: date
    days_since_sowing: int
    current_phase: Phase
    segments: list[StageSegment] = field(default_factory=list)
    milestones: list[Milestone] = field(default_factory=list)


def build_crop_timeline(
    crop: str,
    sowing_date: date,
    harvest_date: Optional[date] = None,
    now: Optional[date] = None,
) -> CropTimeline:
    """Build the full timeline for a crop cycle. `crop` is a CROP_DATABASE
    display name or key (case-insensitive); unknown crops fall back to a
    100-day period."""
    info = CROP_DATABASE.get(crop.lower())
    growing_days = info.growing_days if info else 100
    today = now or date.today()
    expected_harvest = harvest_date or calculate_harvest_date(sowing_date, crop)

    days_since_sowing = (today - sowing_date).days

    if days_since_sowing < 0:
        current_phase: Phase = "pre-sowing"
    elif today > expected_harvest:
        current_phase = "post-harvest"
    else:
        current_phase = generic_stage(days_since_sowing, growing_days)

    segments: list[StageSegment] = []
    prev_frac = 0.0
    for stage in _STAGE_ORDER:
        start_day = round(prev_frac * growing_days)
        end_day = round(_STAGE_END_FRACTION[stage] * growing_days)
        segments.append(
            StageSegment(
                stage=stage,
                label=_STAGE_LABEL[stage],
                start_day=start_day,
                end_day=end_day,
                start_date=sowing_date + timedelta(days=start_day),
                end_date=sowing_date + timedelta(days=end_day),
                actions=_STAGE_ACTIONS[stage],
            )
        )
        prev_frac = _STAGE_END_FRACTION[stage]

    milestones: list[Milestone] = [
        Milestone(day=0, date=sowing_date, label="Sowing", done=days_since_sowing >= 0)
    ]
    for seg in segments[1:]:
        milestones.append(
            Milestone(
                day=seg.start_day,
                date=seg.start_date,
                label=f"{seg.label} begins",
                done=today >= seg.start_date,
            )
        )
    for note in CROP_CALENDAR_NOTES.get(crop.lower(), []):
        d = sowing_date + timedelta(days=note["day"])
        milestones.append(Milestone(day=note["day"], date=d, label=note["label"], done=today >= d))
    milestones.append(
        Milestone(
            day=growing_days,
            date=expected_harvest,
            label="Expected harvest",
            done=today >= expected_harvest,
        )
    )
    milestones.sort(key=lambda m: (m.day, m.date))

    return CropTimeline(
        crop=crop,
        sowing_date=sowing_date,
        growing_days=growing_days,
        expected_harvest=expected_harvest,
        days_since_sowing=days_since_sowing,
        current_phase=current_phase,
        segments=segments,
        milestones=milestones,
    )


def stage_label(stage: Stage) -> str:
    return _STAGE_LABEL[stage]
