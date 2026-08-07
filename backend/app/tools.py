import json
import datetime
import logging
from pathlib import Path
import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


@tool
def get_climate_aqi_data(lat: float, lng: float) -> str:
    """Fetch current real-time air quality (AQI) and 5-year historical climate trends for a given latitude and longitude.
    Args:
        lat: Latitude coordinate of the location.
        lng: Longitude coordinate of the location.
    """
    summary = {
        "location": {"latitude": lat, "longitude": lng}
    }

    # 1. Air Quality Data
    try:
        aq_url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={lat}&longitude={lng}"
            f"&hourly=pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi"
            f"&current=pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi"
            f"&timezone=auto"
        )
        with httpx.Client(timeout=10.0, verify=False) as client:
            resp = client.get(aq_url)
            if resp.status_code == 200:
                aq_data = resp.json()
                curr = aq_data.get("current", {})
                hourly = aq_data.get("hourly", {})
                last_idx = len(hourly.get("time", [])) - 1 if hourly.get("time") else 0

                pm25_series = [v for v in hourly.get("pm2_5", []) if v is not None]
                avg_recent_pm25 = round(sum(pm25_series) / len(pm25_series), 1) if pm25_series else None

                summary["air_quality"] = {
                    "us_aqi": curr.get("us_aqi") if curr.get("us_aqi") is not None else (hourly.get("us_aqi", [0])[last_idx] if hourly.get("us_aqi") else 0),
                    "pm2_5_ug_m3": curr.get("pm2_5") if curr.get("pm2_5") is not None else (hourly.get("pm2_5", [0])[last_idx] if hourly.get("pm2_5") else 0),
                    "pm10_ug_m3": curr.get("pm10") if curr.get("pm10") is not None else (hourly.get("pm10", [0])[last_idx] if hourly.get("pm10") else 0),
                    "ozone_ug_m3": curr.get("ozone") if curr.get("ozone") is not None else (hourly.get("ozone", [0])[last_idx] if hourly.get("ozone") else 0),
                    "nitrogen_dioxide_ug_m3": curr.get("nitrogen_dioxide"),
                    "sulphur_dioxide_ug_m3": curr.get("sulphur_dioxide"),
                    "recent_pm2_5_avg": avg_recent_pm25,
                }
    except Exception as e:
        summary["air_quality_error"] = str(e)

    # 2. 5-Year Climate Archive
    try:
        end_date = datetime.date.today()
        try:
            start_date = end_date.replace(year=end_date.year - 5)
        except ValueError:
            # Handle Feb 29 leap day fallback
            start_date = end_date.replace(year=end_date.year - 5, day=28)

        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")

        archive_url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lng}"
            f"&start_date={start_str}&end_date={end_str}"
            f"&daily=temperature_2m_mean,precipitation_sum"
            f"&timezone=auto"
        )
        with httpx.Client(timeout=15.0, verify=False) as client:
            resp = client.get(archive_url)
            if resp.status_code == 200:
                arch_data = resp.json()
                daily = arch_data.get("daily", {})
                temps = [t for t in daily.get("temperature_2m_mean", []) if t is not None]
                precips = [p for p in daily.get("precipitation_sum", []) if p is not None]

                summary["climate_5yr_trends"] = {
                    "start_date": start_str,
                    "end_date": end_str,
                    "days_count": len(temps),
                    "mean_temperature_celsius": round(sum(temps) / len(temps), 1) if temps else None,
                    "max_daily_temp_celsius": round(max(temps), 1) if temps else None,
                    "min_daily_temp_celsius": round(min(temps), 1) if temps else None,
                    "total_precipitation_mm": round(sum(precips), 1) if precips else None,
                    "avg_daily_precipitation_mm": round(sum(precips) / len(precips), 2) if precips else None,
                }
    except Exception as e:
        summary["climate_trends_error"] = str(e)

    return json.dumps(summary, indent=2)


@tool
def get_environmental_knowledge(query: str) -> str:
    """Search reference documents for WHO/CPCB air quality thresholds, NCAP policies, crop pollution damage, or heat stress guidelines.
    Args:
        query: Specific search terms or question topic.
    """
    try:
        from app.rag import get_retriever

        retriever = get_retriever()
        nodes = retriever.retrieve(query)

        if not nodes:
            return "No relevant knowledge found in reference documents."

        parts = []
        for node in nodes:
            raw_path = node.metadata.get("file_name", "") or node.metadata.get("filename", "unknown")
            source_name = Path(raw_path).name
            content = node.get_content().strip()
            parts.append(f"[Source: {source_name}]\n{content}")

        return "\n\n---\n\n".join(parts)

    except Exception as e:
        logger.error("RAG retrieval error: %s", e, exc_info=True)
        return f"Knowledge retrieval failed: {str(e)}"
