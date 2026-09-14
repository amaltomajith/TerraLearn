"""
Direct Python port of src/lib/cascade/engine.ts's computeCascade — the Cascade
(FarmRisk) viability engine. Pure functions, no side effects, same thresholds
and causal-propagation table as the frontend, so a farmer sees the same
viability band whether the dashboard or a Farmer MCP tool (get_farm_risk_assessment
in app/mcp/farmer_server.py) computed it.

Design principles (from engine.ts, itself citing terralearn_planned_features.md
section 1) — preserved here unchanged:
  - Never ship a bare number. Output a band + named drivers.
  - Credit node: district-level aggregate only — never per-farmer debt.
  - Power node: skip rather than fake a proxy.
  - Propagation is an explicit, auditable lookup table — not a black box.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

LEVEL_ORDER = {"unknown": -1, "low": 0, "moderate": 1, "elevated": 2, "high": 3, "critical": 4}
_LEVEL_STEPS = ["low", "moderate", "elevated", "high", "critical"]


def _level_score(level: str) -> float:
    return max(0, LEVEL_ORDER[level])


def _bump_level(level: str, steps: int = 1) -> str:
    if level == "unknown":
        return "unknown"
    idx = _LEVEL_STEPS.index(level)
    return _LEVEL_STEPS[min(idx + steps, 4)]


@dataclass
class NodeScore:
    node_id: str
    label: str
    icon: str
    source: str
    level: str
    score: float
    detail: str
    data_available: bool
    cascade_note: Optional[str] = None


@dataclass
class ClimateTrends:
    time: list
    temperature_2m_mean: list
    precipitation_sum: list


@dataclass
class SoilInputs:
    ph: float
    nitrogen: float
    source: str  # 'isric' | 'estimated'


@dataclass
class MandiInputs:
    trend_pct: float
    latest_per_ton: float


@dataclass
class CascadeInputs:
    climate_trends: Optional[ClimateTrends]
    soil: Optional[SoilInputs]
    mandi: Optional[MandiInputs]


def _score_water_node(inputs: CascadeInputs) -> NodeScore:
    base = dict(node_id="water", label="Water Stress", icon="Droplets",
                source="Open-Meteo Archive API (historical precipitation)")

    trends = inputs.climate_trends
    if not trends or len(trends.precipitation_sum) < 90:
        return NodeScore(**base, level="unknown", score=0, detail="Insufficient climate history", data_available=False)

    precip = trends.precipitation_sum
    last90 = precip[-90:]
    prior90 = precip[-180:-90]

    sum_last = sum(last90)
    sum_prior = sum(prior90) if prior90 else sum_last

    deficit = (sum_prior - sum_last) / max(sum_prior, 1) if prior90 else 0
    extreme_days = sum(1 for v in last90 if v > 50)

    if extreme_days >= 5:
        level, score = "high", 0.8
        detail = f"{extreme_days} extreme-rain days (>50 mm) in 90 days — flood risk"
    elif deficit > 0.5:
        level, score = "high", 0.75
        detail = f"Rainfall {round(deficit * 100)}% below 90-day reference — severe deficit"
    elif deficit > 0.3:
        level, score = "elevated", 0.55
        detail = f"Rainfall {round(deficit * 100)}% below reference — moderate deficit"
    elif deficit > 0.1:
        level, score = "moderate", 0.35
        detail = "Slight rainfall deficit vs 90-day reference"
    else:
        level, score = "low", 0.15
        detail = "Rainfall near or above 90-day reference"

    return NodeScore(**base, level=level, score=score, detail=detail, data_available=True)


def _score_soil_node(inputs: CascadeInputs) -> NodeScore:
    soil = inputs.soil
    source = "ISRIC SoilGrids (~250 m regional model)" if soil and soil.source == "isric" else "Estimated (coordinate heuristic)"
    base = dict(node_id="soil", label="Soil Health", icon="Layers", source=source)

    if not soil:
        return NodeScore(**base, level="unknown", score=0, detail="Soil data unavailable", data_available=False)

    ph_risk = 3 if (soil.ph < 4.5 or soil.ph > 8.5) else 2 if (soil.ph < 5.5 or soil.ph > 7.5) else 1 if (soil.ph < 6.0 or soil.ph > 7.0) else 0
    n_risk = 3 if soil.nitrogen < 20 else 2 if soil.nitrogen < 40 else 1 if soil.nitrogen < 60 else 0
    total_risk = ph_risk + n_risk

    if total_risk >= 5:
        level, score = "high", 0.75
        detail = f"pH {soil.ph}, N {round(soil.nitrogen)} cg/kg — poor for most crops"
    elif total_risk >= 3:
        level, score = "elevated", 0.55
        detail = f"pH {soil.ph}, N {round(soil.nitrogen)} cg/kg — moderate deficiencies"
    elif total_risk >= 1:
        level, score = "moderate", 0.3
        detail = f"pH {soil.ph} — minor deviation from optimal"
    else:
        level, score = "low", 0.1
        detail = f"pH {soil.ph}, N {round(soil.nitrogen)} cg/kg — healthy range"

    return NodeScore(**base, level=level, score=score, detail=detail, data_available=True)


def _score_market_node(inputs: CascadeInputs) -> NodeScore:
    mandi = inputs.mandi
    if mandi:
        base = dict(node_id="market", label="Market Pressure", icon="TrendingDown", source="Agmarknet (data.gov.in)")
        trend = mandi.trend_pct

        if trend <= -30:
            level, score = "high", 0.8
            detail = f"Mandi price down {abs(trend)}% vs trailing avg — sharp decline"
        elif trend <= -15:
            level, score = "elevated", 0.6
            detail = f"Mandi price down {abs(trend)}% vs trailing avg"
        elif trend <= -5:
            level, score = "moderate", 0.35
            detail = f"Mandi price slightly below trailing avg ({trend}%)"
        elif trend >= 10:
            level, score = "low", 0.05
            detail = f"Mandi price up {trend}% — favourable market"
        else:
            sign = "+" if trend > 0 else ""
            level, score = "low", 0.1
            detail = f"Mandi price stable ({sign}{trend}% vs trailing avg)"

        return NodeScore(**base, level=level, score=score, detail=detail, data_available=True)

    # Graceful fallback: seasonal price baseline (same heuristic as the frontend's MarketSignal).
    current_month = datetime.now(timezone.utc).month - 1  # 0-11
    is_harvest_glut = 8 <= current_month <= 10
    estimated_trend = -12 if is_harvest_glut else 5

    return NodeScore(
        node_id="market", label="Market Pressure", icon="TrendingDown",
        source="Seasonal price baseline (no cached mandi price for this crop)",
        level="moderate" if is_harvest_glut else "low",
        score=0.35 if is_harvest_glut else 0.1,
        detail=(f"Seasonal post-monsoon harvest window — {abs(estimated_trend)}% arrival pressure"
                if is_harvest_glut else f"Off-peak season — commodity prices historically steady (+{estimated_trend}%)"),
        data_available=True,
    )


def _score_hazard_node(inputs: CascadeInputs) -> NodeScore:
    base = dict(node_id="hazard", label="Hazard Exposure", icon="CloudLightning",
                source="Open-Meteo Archive API (daily precipitation)")

    trends = inputs.climate_trends
    if not trends or len(trends.precipitation_sum) < 30:
        return NodeScore(**base, level="unknown", score=0, detail="Insufficient data", data_available=False)

    last30 = trends.precipitation_sum[-30:]
    extreme_days = sum(1 for v in last30 if v > 50)
    very_extreme_days = sum(1 for v in last30 if v > 100)

    if very_extreme_days >= 2:
        level, score = "critical", 0.95
        detail = f"{very_extreme_days} days >100 mm rain in last 30 days — severe flood risk"
    elif extreme_days >= 5:
        level, score = "high", 0.75
        detail = f"{extreme_days} extreme-rain days (>50 mm) in last 30 days"
    elif extreme_days >= 2:
        level, score = "elevated", 0.5
        detail = f"{extreme_days} extreme-rain events in last 30 days"
    elif extreme_days == 1:
        level, score = "moderate", 0.3
        detail = "1 extreme-rain event in last 30 days"
    else:
        level, score = "low", 0.05
        detail = "No extreme-rain events in last 30 days"

    return NodeScore(**base, level=level, score=score, detail=detail, data_available=True)


def _score_credit_node() -> NodeScore:
    return NodeScore(
        node_id="credit", label="Credit Stress", icon="Banknote",
        level="moderate", score=0.35,
        detail="District-level aggregate indicator (no per-farmer data collected)",
        source="Static district aggregate — see data-ethics note", data_available=False,
    )


def _score_power_node() -> NodeScore:
    return NodeScore(
        node_id="power", label="Power Reliability", icon="Zap",
        level="unknown", score=0,
        detail="No reliable state-EB outage data source available",
        source="Not integrated — state electricity board data pending", data_available=False,
    )


def _score_labour_node() -> NodeScore:
    return NodeScore(
        node_id="labour", label="Labour Availability", icon="Users",
        level="unknown", score=0,
        detail="Regional demand curve needs real farmer density data",
        source="Not integrated — requires Saath harvest-window aggregates", data_available=False,
    )


def _score_input_node() -> NodeScore:
    return NodeScore(
        node_id="input", label="Input Costs", icon="Package",
        level="unknown", score=0,
        detail="Seed, fertiliser, and pesticide cost data not yet integrated",
        source="Not integrated — future IFS seasonal calendar", data_available=False,
    )


_CAUSAL_EDGES = [
    dict(from_="water", to="hazard", trigger_level="high", bump_steps=1,
         note="High water deficit amplifies hazard (drought stress)"),
    dict(from_="hazard", to="water", trigger_level="elevated", bump_steps=1,
         note="Flood events cascade to irrigation failure"),
    dict(from_="market", to="credit", trigger_level="elevated", bump_steps=1,
         note="Declining prices reduce debt-servicing capacity"),
    dict(from_="soil", to="input", trigger_level="elevated", bump_steps=1,
         note="Poor soil forces higher fertiliser input costs"),
]


def _propagate_cascade(nodes: list[NodeScore]) -> list[NodeScore]:
    by_id = {n.node_id: n for n in nodes}

    for edge in _CAUSAL_EDGES:
        upstream = by_id.get(edge["from_"])
        downstream = by_id.get(edge["to"])
        if not upstream or not downstream or not upstream.data_available:
            continue
        if LEVEL_ORDER[upstream.level] >= LEVEL_ORDER[edge["trigger_level"]]:
            bumped = _bump_level(downstream.level, edge["bump_steps"])
            if LEVEL_ORDER[bumped] > LEVEL_ORDER[downstream.level]:
                downstream.level = bumped
                downstream.score = min(1, downstream.score + 0.2)
                downstream.cascade_note = edge["note"]

    return list(by_id.values())


_VIABILITY_EXPLAINS = {
    "good": "Conditions look favourable. No major risk factors detected across water, soil, and market nodes.",
    "fair": "Some caution warranted. One or more nodes show moderate stress — monitor closely but no immediate action required.",
    "elevated": "Multiple risk factors active. Plan contingencies now: consider irrigation backup, market alternatives, or crop insurance enrollment.",
    "critical": "Severe compounding risk detected. Immediate intervention likely required — consult a KVK extension officer and review your insurance coverage.",
}


def _compute_viability_band(nodes: list[NodeScore]) -> tuple[str, str]:
    data_nodes = [n for n in nodes if n.data_available]
    if not data_nodes:
        return "fair", _VIABILITY_EXPLAINS["fair"]

    def count_at(level: str) -> int:
        return sum(1 for n in data_nodes if n.level == level)

    critical, high, elevated = count_at("critical"), count_at("high"), count_at("elevated")

    if critical >= 1 or high >= 2:
        band = "critical"
    elif high >= 1 or elevated >= 3:
        band = "elevated"
    elif elevated >= 1 or count_at("moderate") >= 2:
        band = "fair"
    else:
        band = "good"

    return band, _VIABILITY_EXPLAINS[band]


def compute_cascade(inputs: CascadeInputs) -> dict:
    """Compute the full Cascade result from the provided farm inputs."""
    raw_nodes = [
        _score_water_node(inputs),
        _score_soil_node(inputs),
        _score_market_node(inputs),
        _score_hazard_node(inputs),
        _score_credit_node(),
        _score_power_node(),
        _score_labour_node(),
        _score_input_node(),
    ]

    propagated = _propagate_cascade(raw_nodes)
    band, explain = _compute_viability_band(propagated)

    top_drivers = sorted(
        (n for n in propagated if n.data_available and _level_score(n.level) >= _level_score("moderate")),
        key=lambda n: n.score, reverse=True,
    )[:3]

    def _node_dict(n: NodeScore) -> dict:
        return {
            "node_id": n.node_id, "label": n.label, "icon": n.icon, "source": n.source,
            "level": n.level, "score": n.score, "detail": n.detail,
            "data_available": n.data_available, "cascade_note": n.cascade_note,
        }

    return {
        "viability_band": band,
        "viability_explain": explain,
        "top_drivers": [_node_dict(n) for n in top_drivers],
        "all_nodes": [_node_dict(n) for n in propagated],
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
