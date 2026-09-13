"""
Refreshes market_prices_cache from Agmarknet (data.gov.in resource
9ef84268-d588-465a-a308-a864a43d0070). Ports src/lib/api.ts's fetchMandiPrices
(lines 739-804) line-for-line: same endpoint, same INR/quintal -> INR/tonne
conversion, same trailing-window trend calculation — the only difference is
the destination (a Postgres table instead of an in-memory browser-tab cache).

Every exception is caught here — a refresh failure must never raise past the
/internal/refresh/prices endpoint that calls this.
"""
import os
import logging
from dataclasses import dataclass, field

import httpx

from app.refresh import supabase_admin as db
from app.refresh.targets import commodity_targets

logger = logging.getLogger(__name__)

_AGMARKNET_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"
_AGMARKNET_URL = f"https://api.data.gov.in/resource/{_AGMARKNET_RESOURCE}"


@dataclass
class RefreshResult:
    ok: bool
    refreshed: int = 0
    errors: list[str] = field(default_factory=list)


def _fetch_one(client: httpx.Client, api_key: str, crop_key: str, commodity: str, state: str) -> dict | None:
    """One Agmarknet call for a single (commodity, state) pair. Returns a row
    dict ready to upsert, or None if there is genuinely no data (not an error —
    Agmarknet frequently has no rows for a given commodity).

    api_key (the Agmarknet/data.gov.in key) and crop_key (the CROP_DATABASE
    key, e.g. 'rice') were previously collapsed into one `key` parameter —
    every real request silently sent the crop_key as the api-key and got a
    403, caught only by testing against the live endpoint with a real key."""
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": "400",
        "filters[commodity]": commodity,
        "filters[state]": state,
    }
    # data.gov.in silently hangs (read-timeout, not an error response) on
    # httpx's default "python-httpx/x.x" User-Agent — confirmed by direct
    # testing: identical request succeeds in <1s with a curl-like UA and
    # times out every time without one. Without this header the refresh job
    # would fail closed correctly (no crash) but NEVER actually succeed.
    resp = client.get(
        _AGMARKNET_URL, params=params, timeout=15.0,
        headers={"User-Agent": "curl/8.12.1", "Accept": "*/*"},
    )
    resp.raise_for_status()
    data = resp.json()
    rows = data.get("records") or []

    points = []
    for r in rows:
        date = str(r.get("arrival_date") or "").strip()
        # arrival_date is "DD/MM/YYYY" -> "YYYY-MM-DD"
        parts = date.split("/")
        iso = "-".join(reversed(parts)) if len(parts) == 3 else ""
        try:
            price_per_ton = float(r.get("modal_price") or 0) * 10  # INR/quintal -> INR/tonne
        except (TypeError, ValueError):
            price_per_ton = 0.0
        if len(iso) == 10 and price_per_ton > 0:
            points.append({"date": iso, "price": price_per_ton, "market": r.get("market") or ""})

    if not points:
        return None

    points.sort(key=lambda p: p["date"])
    window = points[-30:]
    latest = window[-1]["price"]
    prior = window[:-1]
    trailing_avg = (sum(p["price"] for p in prior) / len(prior)) if prior else latest
    trend_pct = round(((latest - trailing_avg) / trailing_avg) * 100) if trailing_avg else 0

    return {
        "commodity": commodity,
        "crop_key": crop_key,
        "state": state,
        "market": window[-1]["market"],
        "unit": "ton",
        "latest_price": round(latest),
        "trailing_avg_price": round(trailing_avg),
        "trend_pct": trend_pct,
        "sample_size": len(window),
        "source": "agmarknet",
    }


def refresh_market_prices() -> RefreshResult:
    api_key = os.getenv("AGMARKNET_API_KEY", "")
    if not api_key:
        return RefreshResult(ok=False, errors=["AGMARKNET_API_KEY not configured"])

    try:
        targets = commodity_targets()
    except Exception as e:
        logger.exception("commodity_targets() failed")
        return RefreshResult(ok=False, errors=[f"commodity_targets failed: {e}"])

    if not targets:
        return RefreshResult(ok=True, refreshed=0, errors=["no active crop_cycles to refresh"])

    rows_to_upsert = []
    errors = []
    with httpx.Client(verify=False) as client:
        for crop_key, commodity, state in targets:
            try:
                row = _fetch_one(client, api_key, crop_key, commodity, state)
                if row:
                    rows_to_upsert.append(row)
                else:
                    errors.append(f"{commodity}/{state}: no rows returned")
            except Exception as e:
                logger.warning("Agmarknet fetch failed for %s/%s: %s", commodity, state, e)
                errors.append(f"{commodity}/{state}: {e}")

    try:
        db.upsert("market_prices_cache", rows_to_upsert, on_conflict="commodity,state")
    except Exception as e:
        logger.exception("market_prices_cache upsert failed")
        return RefreshResult(ok=False, refreshed=0, errors=errors + [f"upsert failed: {e}"])

    return RefreshResult(ok=True, refreshed=len(rows_to_upsert), errors=errors)
