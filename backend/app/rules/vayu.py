"""
Direct Python port of src/lib/vayu/spi.ts (Standardised Precipitation Index)
plus the small pure derivation functions from FloodPanel.tsx/DroughtPanel.tsx
(rain classification, terrain flood susceptibility, drought/flood action
text, dry-spell counting). Used by get_flood_drought_outlook in
app/mcp/farmer_server.py so a farmer gets the same flood/drought read
whichever caller (dashboard, web assistant, IVR) asks.

SPI reference: McKee et al. (1993); MoA Manual for Drought Management (2016).
Severity classes follow the Manual for Drought Management 2016 (Table 3-1).
"""
import math
from collections import OrderedDict
from typing import Optional

_SPI_SEVERITY_BOUNDS = [
    (-0.5, "near-normal"),
    (-1.0, "watch"),
    (-1.5, "warning"),
    (-2.0, "emergency"),
]


def classify_spi(spi: float) -> str:
    for bound, severity in _SPI_SEVERITY_BOUNDS:
        if spi >= bound:
            return severity
    return "catastrophic"


def _to_monthly_totals(dates: list[str], daily: list[float]) -> list[tuple[str, float]]:
    totals: "OrderedDict[str, float]" = OrderedDict()
    for i, d in enumerate(dates):
        ym = d[:7]
        totals[ym] = totals.get(ym, 0.0) + (daily[i] if i < len(daily) else 0.0)
    return sorted(totals.items(), key=lambda kv: kv[0])


def _rolling_sum(monthly: list[float], window: int) -> list[Optional[float]]:
    out = []
    for i in range(len(monthly)):
        if i < window - 1:
            out.append(None)
            continue
        out.append(sum(monthly[i - window + 1:i + 1]))
    return out


def _fit_gamma(values: list[float]) -> tuple[float, float, float]:
    n = len(values)
    if n == 0:
        return 1.0, 1.0, 0.0
    zeros = sum(1 for v in values if v == 0)
    nonzero = [v for v in values if v > 0]
    p_zero = zeros / n
    if len(nonzero) < 4:
        return 1.0, 1.0, p_zero
    mean = sum(nonzero) / len(nonzero)
    variance = sum((v - mean) ** 2 for v in nonzero) / (len(nonzero) - 1)
    if variance == 0 or mean == 0:
        return 1.0, (mean or 1.0), p_zero
    beta = variance / mean
    return mean / beta, beta, p_zero


_LOG_GAMMA_C = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
]


def _log_gamma(x: float) -> float:
    if x <= 0:
        return 0.0
    z = x - 1
    s = _LOG_GAMMA_C[0]
    for i in range(1, 9):
        s += _LOG_GAMMA_C[i] / (z + i)
    t = z + 7.5
    return 0.5 * math.log(2 * math.pi) + (z + 0.5) * math.log(t) - t + math.log(s)


def _gamma_cdf(x: float, alpha: float, beta: float) -> float:
    if x <= 0:
        return 0.0
    t = x / beta
    term = 1 / alpha
    total = term
    for k in range(1, 301):
        term *= t / (alpha + k)
        total += term
        if term < 1e-10 * total:
            break
    value = math.exp(-t + alpha * math.log(t) - _log_gamma(alpha) + math.log(total))
    return min(max(value, 0.0), 1.0)


def _normal_quantile(p: float) -> float:
    if p <= 0:
        return -4.0
    if p >= 1:
        return 4.0
    sign = -1 if p < 0.5 else 1
    q = min(p, 1 - p)
    t = math.sqrt(-2 * math.log(q))
    num = 2.515517 + 0.802853 * t + 0.010328 * t * t
    den = 1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t
    return sign * (t - num / den)


def compute_spi(dates: list[str], daily_mm: list[float], window_months: int) -> list[dict]:
    """Compute SPI-3 or SPI-6 from a daily precipitation series. Returns a
    list of {date, spi, severity} points (date = first day of the window's
    end month)."""
    monthly = _to_monthly_totals(dates, daily_mm)
    year_months = [ym for ym, _ in monthly]
    totals = [total for _, total in monthly]
    rolling = _rolling_sum(totals, window_months)
    calibration = [v for v in rolling if v is not None]
    alpha, beta, p_zero = _fit_gamma(calibration)

    points = []
    for i, r in enumerate(rolling):
        if r is None:
            continue
        if r == 0:
            h = p_zero
        else:
            h = p_zero + (1 - p_zero) * _gamma_cdf(r, alpha, beta)
        h = min(max(h, 0.0005), 0.9995)
        spi = round(_normal_quantile(h) * 100) / 100
        points.append({"date": f"{year_months[i]}-01", "spi": spi, "severity": classify_spi(spi)})
    return points


def latest_spi(points: list[dict]) -> Optional[dict]:
    return points[-1] if points else None


def count_dry_spell_days(dates: list[str], precip: list[float], dry_threshold_mm: float = 1) -> int:
    """Consecutive dry days counting back from the most recent date, capped
    at the current kharif season start (June 1 heuristic — matches the
    frontend's DroughtPanel)."""
    from datetime import date as _date, datetime as _datetime

    now = _datetime.utcnow()
    season_start = _date(now.year, 6, 1)
    count = 0
    for i in range(len(dates) - 1, -1, -1):
        d = _date.fromisoformat(dates[i][:10])
        if d < season_start:
            break
        if (precip[i] if i < len(precip) else 0) < dry_threshold_mm:
            count += 1
    return count


def derive_drought_action(severity: str, sm0: float) -> str:
    if severity == "near-normal":
        return "Soil moisture adequate — continue normal irrigation schedule."
    if severity == "watch":
        return "Rainfall deficit building. Check irrigation schedule; conserve soil moisture with mulching."
    if severity == "warning":
        return ("Surface moisture critically low. Irrigate now if possible; apply residue mulch to retain moisture."
                if sm0 < 0.15 else
                "Moderate drought. Defer non-essential irrigation; prioritise critical growth-stage crops.")
    if severity == "emergency":
        return "Severe drought. Emergency irrigation for perennial crops. Consider short-season variety if re-sowing window is open."
    return "Catastrophic drought. All available water to highest-value standing crops. Contact district Krishi Vibhag for relief scheme eligibility."


# ── IMD rainfall classification (mm/day) — https://www.imd.gov.in/pages/rainfall_criteria.php
def classify_rain(mm: float) -> str:
    if mm < 0.1:
        return "none"
    if mm < 7.5:
        return "light"
    if mm < 35.5:
        return "moderate"
    if mm < 64.5:
        return "heavy"
    if mm < 124.5:
        return "very_heavy"
    return "extreme"


def derive_susceptibility(elevation_m: float) -> str:
    """Terrain flood susceptibility — a stated proxy (elevation vs. the
    Indian plains median), not a real HAND index."""
    if elevation_m < 50:
        return "high"
    if elevation_m < 200:
        return "medium"
    return "low"


def derive_flood_action(susceptibility: str, max_mm: float, max_class: str) -> str:
    if max_class in ("none", "light"):
        return "No significant rain forecast. Normal operations."
    if susceptibility == "low":
        if max_class == "moderate":
            return "Moderate rain ahead. Ensure drainage channels clear."
        return "Heavy rain expected even in low-risk terrain. Secure equipment and check field drains."
    if susceptibility == "medium":
        if max_class == "moderate":
            return "Moderate rain + medium flood zone. Clear drainage channels and hold off on harvesting low-lying crops."
        if max_class == "heavy":
            return "Heavy rain + medium risk. Move harvested produce to higher ground. Delay field work."
        return f"Very heavy to extreme rain ({max_mm:.0f} mm) + medium risk. Move livestock and stored inputs to safety. Document standing crop for insurance."
    # high susceptibility
    if max_class == "moderate":
        return "Moderate rain in HIGH flood zone. Move all moveable assets to higher ground now."
    if max_class == "heavy":
        return "HEAVY RAIN + HIGH FLOOD RISK. Early harvest if crop is near maturity. File pre-emptive crop insurance claim."
    return f"EXTREME RAIN FORECAST ({max_mm:.0f} mm) + HIGH FLOOD ZONE. Evacuate livestock immediately. Contact local disaster management. Document everything for insurance."
