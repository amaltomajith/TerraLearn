"""
Refreshes weather_cache from Open-Meteo's current-weather endpoint (the same
shape already used by src/lib/api.ts:564 and backend/app/tools.py's climate
call). One request per distinct farm-location bucket (see targets.py);
`fetched_at` is always set at write time, never copied from Open-Meteo's own
timestamp — that's the field every caller uses to judge staleness.

Every exception is caught here — a refresh failure must never raise past the
/internal/refresh/weather endpoint that calls this.
"""
import logging
from dataclasses import dataclass, field

import httpx

from app.refresh import supabase_admin as db
from app.refresh.targets import weather_targets

logger = logging.getLogger(__name__)

_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


@dataclass
class RefreshResult:
    ok: bool
    refreshed: int = 0
    errors: list[str] = field(default_factory=list)


def _fetch_one(client: httpx.Client, lat: float, lng: float) -> dict:
    resp = client.get(
        _FORECAST_URL,
        params={
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
            "wind_speed_unit": "kmh",
            "temperature_unit": "celsius",
        },
        timeout=15.0,
    )
    resp.raise_for_status()
    data = resp.json()
    current = data.get("current", {})
    return {
        "lat_bucket": lat,
        "lng_bucket": lng,
        "temperature_c": current.get("temperature_2m"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "precipitation_mm": current.get("precipitation"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "payload": current,
    }


def refresh_weather() -> RefreshResult:
    try:
        targets = weather_targets()
    except Exception as e:
        logger.exception("weather_targets() failed")
        return RefreshResult(ok=False, errors=[f"weather_targets failed: {e}"])

    if not targets:
        return RefreshResult(ok=True, refreshed=0, errors=["no farm locations to refresh"])

    rows_to_upsert = []
    errors = []
    with httpx.Client(verify=False) as client:
        for lat, lng in targets:
            try:
                rows_to_upsert.append(_fetch_one(client, lat, lng))
            except Exception as e:
                logger.warning("Open-Meteo fetch failed for (%s, %s): %s", lat, lng, e)
                errors.append(f"({lat},{lng}): {e}")

    try:
        db.upsert("weather_cache", rows_to_upsert, on_conflict="lat_bucket,lng_bucket")
    except Exception as e:
        logger.exception("weather_cache upsert failed")
        return RefreshResult(ok=False, refreshed=0, errors=errors + [f"upsert failed: {e}"])

    return RefreshResult(ok=True, refreshed=len(rows_to_upsert), errors=errors)
