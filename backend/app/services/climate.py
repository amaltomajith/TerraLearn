"""
Air-quality fetch, extracted out of app/tools.py's get_climate_aqi_data so
the Farmer MCP server (app/mcp/farmer_server.py) can reuse the exact same
Open-Meteo call for a farmer's coordinates instead of requiring the LLM to
already have lat/lng in hand. get_climate_aqi_data itself becomes a thin
wrapper around fetch_air_quality — no behavior change for that existing
native tool.
"""
import httpx

_AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"


def fetch_air_quality(lat: float, lng: float) -> dict:
    """Current AQI + pollutant levels for a coordinate. Returns
    {"air_quality": {...}} on success or {"air_quality_error": str} on
    failure — same shape app/tools.py's get_climate_aqi_data already used,
    preserved so that refactor is behavior-neutral."""
    try:
        with httpx.Client(timeout=10.0, verify=False) as client:
            resp = client.get(
                _AQI_URL,
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "hourly": "pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi",
                    "current": "pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi",
                    "timezone": "auto",
                },
            )
            if resp.status_code != 200:
                return {"air_quality_error": f"Open-Meteo air-quality HTTP {resp.status_code}"}

            aq_data = resp.json()
            curr = aq_data.get("current", {})
            hourly = aq_data.get("hourly", {})
            last_idx = len(hourly.get("time", [])) - 1 if hourly.get("time") else 0

            def _current(field: str):
                if curr.get(field) is not None:
                    return curr.get(field)
                series = hourly.get(field)
                return series[last_idx] if series else 0

            pm25_series = [v for v in hourly.get("pm2_5", []) if v is not None]
            avg_recent_pm25 = round(sum(pm25_series) / len(pm25_series), 1) if pm25_series else None

            return {
                "air_quality": {
                    "us_aqi": _current("us_aqi"),
                    "pm2_5_ug_m3": _current("pm2_5"),
                    "pm10_ug_m3": _current("pm10"),
                    "ozone_ug_m3": _current("ozone"),
                    "nitrogen_dioxide_ug_m3": curr.get("nitrogen_dioxide"),
                    "sulphur_dioxide_ug_m3": curr.get("sulphur_dioxide"),
                    "recent_pm2_5_avg": avg_recent_pm25,
                }
            }
    except Exception as e:
        return {"air_quality_error": str(e)}
