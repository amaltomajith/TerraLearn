"""
Direct Python port of src/lib/advisories.ts (lines 1-301).

Deliberately NOT a daily checklist — it surfaces only the marginal, data-backed
calls the app can already make: don't spray in high wind, hold fertiliser
before heavy rain, top-dress N when soil N is low and rain is coming, fix pH
before the crop settles, drain before a wet harvest. Everything here is
derived from data already fetched elsewhere — no new endpoints, no agronomy
knowledge base.

`crop_advisories()` works for any CROP_DATABASE crop (stage from
crop_calendar.generic_stage). Paddy gets a few genuinely paddy-specific extras
on top (`paddy_deep_advisories`). Every advisory's `basis` field cites the raw
number that triggered it — this doubles as the numeric guard's source of
truth in the IVR harness (app/ivr/guard.py).
"""
from dataclasses import dataclass
from datetime import date
from typing import Optional

from app.rules.crop_calendar import Stage, generic_stage
from app.rules.crop_database import CropInfo

_DAY = 1  # days, for clarity where the TS source used DAY_MS


@dataclass
class Advisory:
    id: str
    severity: str  # reuses the AQI severity scale: 'good' | 'moderate' | 'unhealthy'
    title: str
    detail: str
    basis: str  # what in the data triggered this — kept visible so the farmer can judge it


@dataclass
class ClimateInput:
    temperature: Optional[float] = None
    precipitation: Optional[float] = None
    wind_speed: Optional[float] = None
    humidity: Optional[float] = None


@dataclass
class SoilInput:
    ph: Optional[float] = None
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None


@dataclass
class AdvisoryInput:
    crop_name: str  # CROP_DATABASE display name, e.g. "Rice"
    crop: CropInfo
    sowing_date: date
    climate: Optional[ClimateInput]
    soil: Optional[SoilInput]
    yield_warnings: list[str]


def crop_advisories(input: AdvisoryInput) -> list[Advisory]:
    crop_name, crop, sowing_date = input.crop_name, input.crop, input.sowing_date
    climate, soil, yield_warnings = input.climate, input.soil, input.yield_warnings
    out: list[Advisory] = []

    days_since = max(0, (date.today() - sowing_date).days)
    stage: Stage = generic_stage(days_since, crop.growing_days)

    # 1. High wind — spraying advisory (any stage).
    if climate and climate.wind_speed is not None and climate.wind_speed >= 20:
        out.append(Advisory(
            id="wind-spray",
            severity="unhealthy" if climate.wind_speed >= 30 else "moderate",
            title="Hold off on spraying today",
            detail=(
                f"Wind is around {climate.wind_speed} km/h — spray drift and patchy coverage are "
                "likely. Wait for a calmer window, usually early morning."
            ),
            basis=f"wind {climate.wind_speed} km/h · nearest grid",
        ))

    # 2. Heavy rain about — hold broadcast fertiliser (vegetative / reproductive).
    if (
        stage in ("vegetative", "reproductive")
        and climate and climate.precipitation is not None
        and climate.precipitation >= 15
    ):
        out.append(Advisory(
            id="rain-fertiliser",
            severity="moderate",
            title="Rain coming — hold broadcast fertiliser",
            detail=(
                f"The grid shows about {climate.precipitation} mm of rain. A broadcast dose now "
                "is likely to wash off or leach past the roots. Wait for it to pass, then apply "
                "onto a moist (not flooded) field. Clear the drains on low spots."
            ),
            basis=f"rain {climate.precipitation} mm · nearest grid",
        ))

    # 3. Heat spike — irrigate at the cool end of the day.
    if climate and climate.temperature is not None and climate.temperature >= max(crop.optimal_temp_max + 3, 36):
        out.append(Advisory(
            id="heat-irrigate",
            severity="unhealthy" if climate.temperature >= crop.optimal_temp_max + 8 else "moderate",
            title="Heat stress — water at dawn or dusk",
            detail=(
                f"It's around {climate.temperature}°C, above the comfortable range for {crop_name} "
                f"(up to ~{crop.optimal_temp_max}°C). Irrigate early morning or after sunset so the "
                "water actually reaches the roots, and avoid working the crop in the afternoon."
            ),
            basis=f"temp {climate.temperature}°C vs optimum {crop.optimal_temp_max}°C",
        ))

    # 4. Frost risk.
    if climate and climate.temperature is not None and climate.temperature <= 3:
        out.append(Advisory(
            id="frost-risk",
            severity="unhealthy" if climate.temperature <= 0 else "moderate",
            title="Frost risk tonight",
            detail=(
                f"Grid temperature is about {climate.temperature}°C. Run sprinklers before dawn if "
                "you have them, cover a nursery, and delay any planned sowing until it warms."
            ),
            basis=f"temp {climate.temperature}°C · nearest grid",
        ))

    # 5. pH out of range — only really actionable early, before the crop settles.
    if (
        stage == "establishment" and soil and soil.ph is not None
        and (soil.ph < crop.optimal_ph_min or soil.ph > crop.optimal_ph_max)
    ):
        low = soil.ph < crop.optimal_ph_min
        out.append(Advisory(
            id="ph-range",
            severity="moderate",
            title=f"Soil pH {soil.ph} is outside the range for {crop_name}",
            detail=(
                f"{crop_name} does best at pH {crop.optimal_ph_min}–{crop.optimal_ph_max}. If a field "
                f"test agrees, work in {'lime' if low else 'gypsum or extra organic matter'} now — it "
                "is much harder to correct once the crop is established."
            ),
            basis=f"soil pH {soil.ph} · regional model",
        ))

    # 6. Nitrogen top-dress window — vegetative stage, low soil N, rain about.
    if (
        stage == "vegetative" and soil and soil.nitrogen is not None and soil.nitrogen < 30
        and climate and climate.precipitation is not None and climate.precipitation > 0
    ):
        out.append(Advisory(
            id="n-window",
            severity="moderate",
            title="Good window to top-dress nitrogen",
            detail=(
                f"Soil nitrogen reads low ({soil.nitrogen} ppm, regional model) and there's rain "
                "about — splitting a dose now carries it into the root zone instead of losing it "
                "to a dry topsoil."
            ),
            basis=f"soil N {soil.nitrogen} ppm · rain {climate.precipitation} mm",
        ))

    # 7. Season mismatch — surface the yield model's own wording.
    for w in yield_warnings:
        if "season" in w.lower():
            out.append(Advisory(
                id="season",
                severity="moderate",
                title="Check your planting window",
                detail=w,
                basis="from the yield model",
            ))
            break

    # 8. Wet harvest — maturity stage with rain on the grid.
    if stage == "maturity" and climate and climate.precipitation is not None and climate.precipitation >= 10:
        out.append(Advisory(
            id="wet-harvest",
            severity="moderate",
            title="Rain near harvest — plan draining",
            detail=(
                "You're near the end of the season and the grid shows wet conditions. Drain the "
                "field early and line up labour so you can cut in a dry window."
            ),
            basis=f"rain {climate.precipitation} mm · nearest grid",
        ))

    # Paddy-specific extras on top of the generic set.
    if crop_name == "Rice":
        seen = {a.id for a in out}
        for a in paddy_deep_advisories(input):
            if a.id not in seen:
                out.append(a)

    return out


def paddy_stage(days_since_planting: int, growing_days: int) -> Stage:
    if days_since_planting <= 14:
        return "establishment"
    if days_since_planting >= growing_days - 20:
        return "maturity"
    if days_since_planting <= 55:
        return "vegetative"
    return "reproductive"


def paddy_deep_advisories(input: AdvisoryInput) -> list[Advisory]:
    """Only what is genuinely paddy-specific."""
    crop, sowing_date, climate = input.crop, input.sowing_date, input.climate
    out: list[Advisory] = []
    days_since = (date.today() - sowing_date).days
    stage = paddy_stage(days_since, crop.growing_days)

    # Transplanting window.
    if stage == "establishment" and 18 <= days_since <= 30:
        out.append(Advisory(
            id="paddy-transplant",
            severity="moderate",
            title="Transplanting window",
            detail=(
                "If you raised a nursery, 21–25 day seedlings transplant best — older seedlings "
                "tiller poorly. Puddle well and keep 2–3 cm of water for the first week."
            ),
            basis=f"day {days_since} since sowing",
        ))

    # Standing-water depth by stage.
    if stage in ("vegetative", "reproductive"):
        out.append(Advisory(
            id="paddy-water-depth",
            severity="good",
            title=(
                "Keep 5 cm standing water through flowering"
                if stage == "reproductive"
                else "Shallow water (2–3 cm) during tillering"
            ),
            detail=(
                "Water stress from panicle initiation to grain fill is the single biggest yield "
                "loss in paddy. Do not let the field dry now."
                if stage == "reproductive"
                else "A shallow layer during tillering encourages more productive tillers than a "
                "deep flood. Drain briefly mid-tillering if the crop is very lush."
            ),
            basis=f"paddy stage: {stage}",
        ))

    # Panicle-initiation top-dress.
    if stage == "reproductive" and days_since <= crop.growing_days - 45:
        out.append(Advisory(
            id="paddy-pi-nitrogen",
            severity="moderate",
            title="Panicle initiation — second nitrogen split",
            detail=(
                "The top-dress around panicle initiation feeds grain number. Apply onto a drained "
                "field, then re-flood after a day."
            ),
            basis=f"day {days_since} since sowing",
        ))

    # Drift is worse over a flooded field near sensitive neighbours (any stage).
    if climate and climate.wind_speed is not None and 15 <= climate.wind_speed < 20:
        out.append(Advisory(
            id="paddy-wind-mild",
            severity="good",
            title="Breezy — spray low and early over the flood",
            detail=(
                f"Wind is {climate.wind_speed} km/h. It is sprayable, but keep the boom low and go "
                "early; drift carries further off a water surface."
            ),
            basis=f"wind {climate.wind_speed} km/h",
        ))

    return out
