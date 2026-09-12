"""
Farmer MCP server (Puppeteer MCP spec §3, Phase 2: read-only tools only).
Mounted at /mcp/farmer in app/main.py, streamable-HTTP transport.

CRITICAL TRUST-BOUNDARY NOTE — read before wiring any new caller to this
server: every tool below takes farmer_id as a plain argument rather than
deriving identity from a Clerk JWT, and several use the service-role key
(app/mcp/supabase_owner.py) to see RLS-locked rows at all. That means the MCP
TOOL LAYER ITSELF is the trust boundary here, not the database — whatever
calls these tools is implicitly trusted to pass the correct farmer_id. This is
acceptable ONLY because this server is kept internal/unwired this pass (no
live IVR, no Buyer MCP, no web client pointed at it). Before connecting any
real caller (Phase 3+), this server needs its own authn/z layer — e.g.
verifying a phone-number-to-farmer_id mapping for IVR, or a signed session for
the web client. Do not skip this when Phase 3 work starts.

DTMF constraint (spec §3): every tool's arguments are shaped for a short
sequence of keypad digits where relevant (e.g. listing_type as a small enum,
never free text) — the same tool contract serves the (future) IVR path and the
richer web assistant.
"""
import os
import logging
from datetime import date, datetime

import httpx
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from app.mcp import supabase_owner as owner
from app.mcp import supabase_public as public
from app.rules.crop_database import CROP_DATABASE
from app.rules.crop_calendar import build_crop_timeline
from app.rules.advisories import crop_advisories, AdvisoryInput, ClimateInput, SoilInput
from app.soil import get_soil_data

logger = logging.getLogger(__name__)

mcp = MCPServer("terralearn-farmer")


def _allowed_hosts() -> list[str]:
    raw = os.getenv("MCP_ALLOWED_HOSTS", "127.0.0.1:8000,localhost:8000")
    return [h.strip() for h in raw.split(",") if h.strip()]


def build_farmer_mcp_app():
    """Returns the mounted ASGI app + the lifespan context to share with the
    parent FastAPI app (see app/main.py — mounting without sharing the
    lifespan fails at request time with "Task group is not initialized",
    confirmed against the installed mcp SDK version before writing this)."""
    security = TransportSecuritySettings(allowed_hosts=_allowed_hosts())
    return mcp.streamable_http_app(stateless_http=True, json_response=True, transport_security=security)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _round_bucket(v: float) -> float:
    return round(v, 1)


def _weather_for(lat: float, lng: float) -> dict:
    """Bucketed weather_cache lookup, falling back to a live Open-Meteo call
    on a cache miss (mirrors app/tools.py's existing fallback shape). Always
    tags the response with weather_source + fetched_at — never presents a
    live-looking number without saying how fresh it is."""
    lat_b, lng_b = _round_bucket(lat), _round_bucket(lng)
    try:
        rows = public.select(
            "weather_cache",
            params={"lat_bucket": f"eq.{lat_b}", "lng_bucket": f"eq.{lng_b}", "limit": "1"},
        )
    except Exception as e:
        logger.warning("weather_cache lookup failed: %s", e)
        rows = []

    if rows:
        r = rows[0]
        return {
            "temperature": r.get("temperature_c"),
            "precipitation": r.get("precipitation_mm"),
            "humidity": r.get("humidity_pct"),
            "windSpeed": r.get("wind_speed_kmh"),
            "weather_source": "cache",
            "fetched_at": r.get("fetched_at"),
        }

    try:
        with httpx.Client(timeout=10.0, verify=False) as client:
            resp = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lng,
                    "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
                    "wind_speed_unit": "kmh", "temperature_unit": "celsius",
                },
            )
            resp.raise_for_status()
            current = resp.json().get("current", {})
            return {
                "temperature": current.get("temperature_2m"),
                "precipitation": current.get("precipitation"),
                "humidity": current.get("relative_humidity_2m"),
                "windSpeed": current.get("wind_speed_10m"),
                "weather_source": "live",
                "fetched_at": datetime.utcnow().isoformat() + "Z",
            }
    except Exception as e:
        logger.warning("live weather fallback failed: %s", e)
        return {"weather_source": "unavailable", "fetched_at": None}


def _farm_and_cycle(farmer_id: str) -> tuple[dict | None, dict | None]:
    farm = owner.primary_farm(farmer_id)
    if not farm:
        return None, None
    cycle = owner.active_crop_cycle(farm["id"])
    return farm, cycle


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def get_farm_snapshot(farmer_id: str) -> dict:
    """Soil, climate and the active crop cycle for a farmer's primary farm."""
    farm, cycle = _farm_and_cycle(farmer_id)
    if not farm:
        return {"available": False, "reason": "no farm found for this farmer_id"}

    coords = owner.farm_location(farm["id"])
    weather = _weather_for(*coords) if coords else {"weather_source": "unavailable", "fetched_at": None}
    soil = get_soil_data(*coords) if coords else None

    return {
        "available": True,
        "farm": {
            "id": farm["id"],
            "label": farm.get("label"),
            "primary_crop": farm.get("primary_crop"),
            "enterprises": farm.get("enterprises"),
        },
        "crop_cycle": cycle and {
            "crop": cycle.get("crop"),
            "sowing_date": cycle.get("sowing_date"),
            "status": cycle.get("status"),
            "area_hectares": cycle.get("area_hectares"),
        },
        "weather": weather,
        "soil": soil and {
            "pH": soil.ph, "nitrogen": soil.nitrogen, "phosphorus": soil.phosphorus,
            "potassium": soil.potassium, "source": soil.source, "fetched_at": soil.fetched_at,
        },
    }


@mcp.tool()
def get_crop_advisory(farmer_id: str) -> dict:
    """Weather/soil-triggered advisories for the farmer's active crop cycle."""
    farm, cycle = _farm_and_cycle(farmer_id)
    if not farm or not cycle:
        return {"available": False, "reason": "no active crop cycle for this farmer_id"}

    crop_key = str(cycle["crop"]).lower()
    info = CROP_DATABASE.get(crop_key)
    if not info:
        return {"available": False, "reason": f"'{cycle['crop']}' is not in CROP_DATABASE"}

    coords = owner.farm_location(farm["id"])
    weather = _weather_for(*coords) if coords else {}
    soil = get_soil_data(*coords) if coords else None
    sowing_date = _parse_date(cycle.get("sowing_date"))
    if not sowing_date:
        return {"available": False, "reason": "crop cycle has no sowing_date"}

    advisories = crop_advisories(AdvisoryInput(
        crop_name=info.name,
        crop=info,
        sowing_date=sowing_date,
        climate=ClimateInput(
            temperature=weather.get("temperature"),
            precipitation=weather.get("precipitation"),
            wind_speed=weather.get("windSpeed"),
            humidity=weather.get("humidity"),
        ) if weather.get("weather_source") != "unavailable" else None,
        soil=SoilInput(ph=soil.ph, nitrogen=soil.nitrogen, phosphorus=soil.phosphorus, potassium=soil.potassium) if soil else None,
        yield_warnings=[],
    ))

    return {
        "available": True,
        "crop": info.name,
        "advisories": [a.__dict__ for a in advisories],
        "weather_source": weather.get("weather_source"),
        "soil_source": soil.source if soil else None,
        "fetched_at": weather.get("fetched_at"),
    }


@mcp.tool()
def get_crop_calendar(farmer_id: str) -> dict:
    """Stage timeline (segments + milestones) for the farmer's active crop cycle."""
    farm, cycle = _farm_and_cycle(farmer_id)
    if not farm or not cycle:
        return {"available": False, "reason": "no active crop cycle for this farmer_id"}

    sowing_date = _parse_date(cycle.get("sowing_date"))
    if not sowing_date:
        return {"available": False, "reason": "crop cycle has no sowing_date"}

    harvest_date = _parse_date(cycle.get("actual_harvest_date"))
    timeline = build_crop_timeline(cycle["crop"], sowing_date, harvest_date=harvest_date)

    return {
        "available": True,
        "crop": timeline.crop,
        "current_phase": timeline.current_phase,
        "days_since_sowing": timeline.days_since_sowing,
        "expected_harvest": timeline.expected_harvest.isoformat(),
        "segments": [
            {"stage": s.stage, "label": s.label, "start_day": s.start_day, "end_day": s.end_day,
             "start_date": s.start_date.isoformat(), "end_date": s.end_date.isoformat(), "actions": s.actions}
            for s in timeline.segments
        ],
        "milestones": [
            {"day": m.day, "date": m.date.isoformat(), "label": m.label, "done": m.done}
            for m in timeline.milestones
        ],
    }


@mcp.tool()
def get_nearby_ifs_matches(farmer_id: str, radius_m: int = 20000) -> list[dict]:
    """Circular-agriculture (IFS) matches within radius — passthrough to the
    existing nearby_ifs_matches RPC, already granted to anon/authenticated."""
    return public.rpc("nearby_ifs_matches", {"p_farmer_id": farmer_id, "p_radius_m": radius_m})


@mcp.tool()
def get_nearby_listings(farmer_id: str, listing_type: str | None = None, radius_m: int = 20000) -> list[dict]:
    """Saath feed (equipment/labour/resource/demand) near the farmer.
    listing_type: one of 'equipment'|'labour'|'resource'|'demand', or omit for all
    (keypad-friendly: a DTMF caller presses 1-4, or 0 for all)."""
    args = {"p_farmer_id": farmer_id, "p_radius_m": radius_m}
    if listing_type:
        args["p_type"] = listing_type
    return public.rpc("nearby_listings", args)


@mcp.tool()
def get_mandi_price(crop_key: str, state: str | None = None) -> dict:
    """Latest refreshed mandi price for a crop — reads market_prices_cache,
    never a live Agmarknet call. crop_key is a CROP_DATABASE key (e.g. 'rice')."""
    from app.refresh.targets import CROP_TO_AGMARKNET_COMMODITY, market_refresh_state

    commodity = CROP_TO_AGMARKNET_COMMODITY.get(crop_key.lower())
    if not commodity:
        return {"available": False, "reason": f"no Agmarknet mapping for crop_key '{crop_key}'"}
    target_state = state or market_refresh_state()

    rows = public.select(
        "market_prices_cache",
        params={"commodity": f"eq.{commodity}", "state": f"eq.{target_state}", "limit": "1"},
    )
    if not rows:
        return {"available": False, "reason": f"no cached price for {commodity}/{target_state}"}

    r = rows[0]
    return {
        "available": True,
        "commodity": r["commodity"],
        "state": r["state"],
        "unit": r["unit"],
        "latest_price": r["latest_price"],
        "trailing_avg_price": r["trailing_avg_price"],
        "trend_pct": r["trend_pct"],
        "fetched_at": r["fetched_at"],
    }


@mcp.tool()
def get_my_tasks(farmer_id: str) -> list[dict]:
    """Open tasks assigned across the farmer's farm(s)."""
    rows = owner.open_tasks_for_farmer(farmer_id)
    return [
        {"title": t["title"], "detail": t.get("detail"), "due_date": t.get("due_date"),
         "status": t["status"], "source": t.get("source")}
        for t in rows
    ]


@mcp.tool()
def get_lot_status(farmer_id: str, lot_id: str | None = None) -> dict | list[dict]:
    """One lot's status + event history (lot_id given), or every open/matched
    lot the farmer is a party to (lot_id omitted). Read-only — propose_create_lot
    / propose_respond_to_offer (the write tools that populate this table from a
    farmer action) are out of scope this pass; lots are seeded or written by a
    future pass."""
    lots = owner.lots_for_farmer(farmer_id, lot_id)
    if lot_id:
        if not lots:
            return {"available": False, "reason": "lot not found, or this farmer is not a party to it"}
        lot = lots[0]
        events = owner.lot_events(lot["id"])
        return {
            "available": True,
            "lot": {k: lot[k] for k in ("id", "crop", "quantity", "unit", "price_per_unit", "status", "seller_id", "buyer_id")},
            "events": [{"event_type": e["event_type"], "detail": e.get("detail"), "created_at": e["created_at"]} for e in events],
        }
    return [
        {"id": l["id"], "crop": l["crop"], "quantity": l["quantity"], "unit": l["unit"], "status": l["status"]}
        for l in lots
    ]
