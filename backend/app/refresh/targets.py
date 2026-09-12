"""
What the refresh job actually fetches: which (commodity, state) pairs for
Agmarknet, which (lat_bucket, lng_bucket) pairs for Open-Meteo weather.

Derived from real farm/crop data via the service-role client (bypassing RLS is
fine here — this never returns farmer-identifying data, only aggregated
commodity names and coordinate buckets).

State targeting is a stated assumption, not a derivation: there is no
district/state column anywhere in the schema (only free-text `farmers.village`),
and Agmarknet only filters by state, so every commodity target is paired with
a single fixed MARKET_REFRESH_STATE rather than trying to infer a farmer's
state from village text.
"""
import os
from app.refresh import supabase_admin as db

# CROP_DATABASE key -> Agmarknet commodity name. Mirrors
# src/lib/api.ts:702-723 (CROP_TO_AGMARKNET_COMMODITY) exactly — keep in sync.
CROP_TO_AGMARKNET_COMMODITY: dict[str, str] = {
    "wheat": "Wheat",
    "rice": "Paddy(Dhan)(Common)",
    "corn": "Maize",
    "soybeans": "Soyabean",
    "barley": "Barley",
    "cotton": "Cotton",
    "potatoes": "Potato",
    "tomatoes": "Tomato",
    "onions": "Onion",
    "sorghum": "Jowar(Sorghum)",
    "sugarcane": "Sugarcane",
    "cabbage": "Cabbage",
    "carrots": "Carrot",
    "spinach": "Spinach",
    "peppers": "Green Chilli",
    "cucumbers": "Cucumbar(Kheera)",
    "grapes": "Grapes",
    "lettuce": "Lettuce",
    "strawberries": "Strawberry",
    "oats": "Oats",
}


def market_refresh_state() -> str:
    return os.getenv("MARKET_REFRESH_STATE", "Karnataka")


def commodity_targets() -> list[tuple[str, str, str]]:
    """[(crop_key, commodity, state), ...] for every distinct crop currently
    being grown (crop_cycles.crop), mapped through CROP_TO_AGMARKNET_COMMODITY.
    A crop with no Agmarknet mapping is skipped, not guessed at."""
    rows = db.select("crop_cycles", params={"select": "crop", "status": "in.(planned,active)"})
    seen_crops = {str(r["crop"]).strip().lower() for r in rows if r.get("crop")}
    state = market_refresh_state()
    out: list[tuple[str, str, str]] = []
    for crop_key in seen_crops:
        commodity = CROP_TO_AGMARKNET_COMMODITY.get(crop_key)
        if commodity:
            out.append((crop_key, commodity, state))
    return out


def weather_targets() -> list[tuple[float, float]]:
    """[(lat_bucket, lng_bucket), ...] for every farm's location, rounded to
    the 0.1-degree weather grid by the distinct_farm_weather_buckets() RPC
    (service-role-only; PostgREST can't run st_y/st_x inline via REST filters)."""
    rows = db.rpc("distinct_farm_weather_buckets")
    if not isinstance(rows, list):
        return []
    out = []
    for r in rows:
        lat = r.get("lat_bucket")
        lng = r.get("lng_bucket")
        if lat is not None and lng is not None:
            out.append((float(lat), float(lng)))
    return out
