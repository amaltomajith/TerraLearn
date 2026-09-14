"""
Direct Python ports of src/lib/api.ts's Open-Meteo helpers that, until now,
only existed client-side — used by the Cascade risk engine (app/rules/cascade.py)
and Vayu flood/drought outlook (app/rules/vayu.py). Same endpoints, same query
params, same rounding as the frontend, so a farmer gets the same numbers
whether the browser or an MCP tool computed them (see app/soil.py's docstring
for why bit-for-bit parity with the frontend matters here).
"""
import datetime

import httpx


def fetch_climate_archive(lat: float, lng: float, years: int = 5) -> dict:
    """5-year (or `years`) daily temperature/precipitation history. Port of
    api.ts's fetchClimateTrends — same archive endpoint, same null-to-0
    fallback, same 1-decimal rounding, so this can feed the same math as the
    frontend's Cascade/Vayu computations without disagreeing on inputs."""
    end_date = datetime.date.today()
    try:
        start_date = end_date.replace(year=end_date.year - years)
    except ValueError:
        start_date = end_date.replace(year=end_date.year - years, day=28)

    try:
        with httpx.Client(timeout=15.0, verify=False) as client:
            resp = client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "daily": "temperature_2m_mean,precipitation_sum",
                    "timezone": "auto",
                },
            )
            resp.raise_for_status()
            daily = resp.json().get("daily", {})
            return {
                "time": daily.get("time") or [],
                "temperature_2m_mean": [
                    round(v * 10) / 10 if v is not None else 0 for v in (daily.get("temperature_2m_mean") or [])
                ],
                "precipitation_sum": [
                    round(v * 10) / 10 if v is not None else 0 for v in (daily.get("precipitation_sum") or [])
                ],
            }
    except Exception:
        return {"time": [], "temperature_2m_mean": [], "precipitation_sum": []}


def fetch_rainfall_forecast(lat: float, lng: float) -> dict:
    """7-day daily rainfall forecast + precipitation probability. Port of
    api.ts's fetchRainfallForecast."""
    try:
        with httpx.Client(timeout=10.0, verify=False) as client:
            resp = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "daily": "precipitation_sum,precipitation_probability_max",
                    "forecast_days": 7,
                    "timezone": "auto",
                },
            )
            resp.raise_for_status()
            daily = resp.json().get("daily", {})
            return {
                "time": daily.get("time") or [],
                "precipitation_sum": [
                    round(v * 10) / 10 if v is not None else 0 for v in (daily.get("precipitation_sum") or [])
                ],
                "precipitation_probability_max": [
                    round(v) if v is not None else 0 for v in (daily.get("precipitation_probability_max") or [])
                ],
            }
    except Exception:
        return {"time": [], "precipitation_sum": [], "precipitation_probability_max": []}


def fetch_elevation(lat: float, lng: float) -> float:
    """Terrain elevation (metres). Port of api.ts's fetchElevation."""
    try:
        with httpx.Client(timeout=10.0, verify=False) as client:
            resp = client.get(
                "https://api.open-meteo.com/v1/elevation",
                params={"latitude": lat, "longitude": lng},
            )
            resp.raise_for_status()
            elevation = resp.json().get("elevation")
            return round(elevation[0]) if elevation else 0
    except Exception:
        return 0


def fetch_soil_moisture(lat: float, lng: float) -> dict:
    """Surface (0-7cm) and shallow-root (7-28cm) soil moisture, averaged
    over the returned hourly values. Port of api.ts's fetchSoilMoisture."""
    try:
        with httpx.Client(timeout=10.0, verify=False) as client:
            resp = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "hourly": "soil_moisture_0_to_7cm,soil_moisture_7_to_28cm",
                    "forecast_days": 1,
                    "timezone": "auto",
                },
            )
            resp.raise_for_status()
            hourly = resp.json().get("hourly", {})

            def _avg(values):
                valid = [v for v in values if v is not None]
                return sum(valid) / len(valid) if valid else 0.0

            return {
                "sm0_7cm": _avg(hourly.get("soil_moisture_0_to_7cm") or []),
                "sm7_28cm": _avg(hourly.get("soil_moisture_7_to_28cm") or []),
            }
    except Exception:
        return {"sm0_7cm": 0.0, "sm7_28cm": 0.0}
