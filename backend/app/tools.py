import json
import datetime
import logging
import httpx
from langchain_core.tools import tool

from app.services.climate import fetch_air_quality

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

    # 1. Air Quality Data — shared with app/mcp/farmer_server.py's
    # get_farm_snapshot via app/services/climate.fetch_air_quality, so a
    # farmer sees the same AQI numbers whether asked by coordinate here or by
    # farmer_id there.
    summary.update(fetch_air_quality(lat, lng))

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
        from app.rag import retrieve

        rows = retrieve(query, k=3)
        if not rows:
            return "No relevant knowledge found in reference documents."

        parts = [f"[Source: {r['source_file']}]\n{r['content'].strip()}" for r in rows]
        return "\n\n---\n\n".join(parts)

    except Exception as e:
        logger.error("RAG retrieval error: %s", e, exc_info=True)
        return f"Knowledge retrieval failed: {str(e)}"
