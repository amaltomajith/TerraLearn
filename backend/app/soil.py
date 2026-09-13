"""
Direct Python port of src/lib/api.ts's fetchSoilData + seededRandom
(lines 806-917). ISRIC SoilGrids first (free, no API key), falling back to the
SAME FNV-1a-hash-seeded PRNG the frontend uses — bit-for-bit, same hash
constants — so a given pin resolves to the same estimated soil profile whether
the browser or this backend computes it. A different hash algorithm here would
silently disagree with the frontend for identical coordinates, which is
exactly the kind of "the app told me X but the phone assistant told me Y"
inconsistency this platform's honesty discipline is built to avoid.

No DB cache table for soil in this pass — ISRIC is slow-moving data and the
frontend already caches it client-side for the session; adding a
server-side soil_cache table is a possible follow-up, not built now.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

_ISRIC_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"


@dataclass
class SoilData:
    ph: float
    nitrogen: float
    phosphorus: float
    potassium: float
    source: str  # 'isric' | 'estimated'
    fetched_at: str


def _seeded_random(lat: float, lng: float):
    """Deterministic hash-seeded PRNG — the same rounded coordinate always
    produces the same stream. Port of api.ts:809-823 (FNV-1a seed + a
    Mulberry32-style xorshift step), constants preserved exactly."""
    s = f"{round(lat * 1000)},{round(lng * 1000)}"
    h = 2166136261
    for ch in s:
        h = (h ^ ord(ch)) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF

    state = {"h": h}

    def _imul(a: int, b: int) -> int:
        return (a * b) & 0xFFFFFFFF

    def next_() -> float:
        state["h"] = (state["h"] + 0x6D2B79F5) & 0xFFFFFFFF
        t = state["h"]
        t = _imul(t ^ (t >> 15), t | 1)
        t = (t ^ (t + _imul(t ^ (t >> 7), t | 61))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_


def _estimate_soil(lat: float, lng: float) -> SoilData:
    abs_lat = abs(lat)
    rand = _seeded_random(lat, lng)

    if abs_lat < 10:
        ph = 5.2 + rand() * 0.8
        nitrogen = 45 + rand() * 30
        phosphorus = 10 + rand() * 15
        potassium = 80 + rand() * 60
    elif abs_lat < 30:
        ph = 5.8 + rand() * 1.0
        nitrogen = 35 + rand() * 25
        phosphorus = 15 + rand() * 20
        potassium = 120 + rand() * 80
    elif abs_lat < 50:
        ph = 6.2 + rand() * 1.2
        nitrogen = 50 + rand() * 40
        phosphorus = 25 + rand() * 25
        potassium = 150 + rand() * 100
    else:
        ph = 4.8 + rand() * 1.5
        nitrogen = 20 + rand() * 20
        phosphorus = 8 + rand() * 12
        potassium = 60 + rand() * 50

    return SoilData(
        ph=round(ph * 10) / 10,
        nitrogen=round(nitrogen),
        phosphorus=round(phosphorus),
        potassium=round(potassium),
        source="estimated",
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )


def get_soil_data(lat: float, lng: float) -> SoilData:
    try:
        with httpx.Client(timeout=10.0, verify=False) as client:
            resp = client.get(
                _ISRIC_URL,
                params={
                    "lon": lng,
                    "lat": lat,
                    "property": ["phh2o", "nitrogen", "soc"],
                    "depth": "0-5cm",
                    "value": "mean",
                },
            )
            if resp.status_code != 200:
                raise RuntimeError(f"SoilGrids HTTP {resp.status_code}")
            data = resp.json()
            layers = (data.get("properties") or {}).get("layers") or []

            ph, nitrogen, phosphorus = 6.5, 40.0, 25.0
            for layer in layers:
                depths = layer.get("depths") or []
                mean_value = depths[0].get("values", {}).get("mean") if depths else None
                if mean_value is None:
                    continue
                if layer.get("name") == "phh2o":
                    ph = round((mean_value / 10) * 10) / 10
                elif layer.get("name") == "nitrogen":
                    nitrogen = round(mean_value / 10)
                elif layer.get("name") == "soc":
                    phosphorus = round(mean_value / 20)

            potassium = round(100 + (nitrogen * 1.5) + (phosphorus * 2))
            return SoilData(
                ph=ph,
                nitrogen=nitrogen,
                phosphorus=phosphorus,
                potassium=potassium,
                source="isric",
                fetched_at=datetime.now(timezone.utc).isoformat(),
            )
    except Exception:
        return _estimate_soil(lat, lng)
