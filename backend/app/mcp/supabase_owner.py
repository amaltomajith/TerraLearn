"""
Service-role Supabase access for Farmer MCP tools that read RLS-locked,
owner-scoped rows (farms, crop_cycles, farm_tasks, lots) with no Clerk JWT.

Re-exports app.refresh.supabase_admin's select()/rpc() rather than duplicating
the httpx client — same credential, same reasoning (see that module's
docstring). This module only adds the query shapes the MCP tools need.

Critical trust-boundary note (see backend/app/mcp/farmer_server.py's module
docstring): because these reads bypass RLS, EVERY function here takes a
farmer_id and applies the ownership filter itself. There is no database-level
safety net in this path — the caller of an MCP tool is trusted to pass the
correct farmer_id.
"""
from app.refresh.supabase_admin import select, rpc, is_configured  # noqa: F401


def farms_for_farmer(farmer_id: str) -> list[dict]:
    return select("farms", params={"farmer_id": f"eq.{farmer_id}"})


def farm_location(farm_id: str) -> tuple[float, float] | None:
    """(lat, lng) for one farm via the farm_location() RPC — a raw REST select
    of farms.location returns EWKB hex, not usable coordinates."""
    rows = rpc("farm_location", {"p_farm_id": farm_id})
    if isinstance(rows, list) and rows and rows[0].get("lat") is not None:
        return float(rows[0]["lat"]), float(rows[0]["lng"])
    return None


def primary_farm(farmer_id: str) -> dict | None:
    rows = select(
        "farms",
        params={"farmer_id": f"eq.{farmer_id}", "is_primary": "eq.true", "limit": "1"},
    )
    if rows:
        return rows[0]
    # Fall back to the newest farm if no primary is set (shouldn't happen given
    # the farms_one_primary trigger, but don't silently return nothing).
    rows = select(
        "farms",
        params={"farmer_id": f"eq.{farmer_id}", "order": "created_at.desc", "limit": "1"},
    )
    return rows[0] if rows else None


def active_crop_cycle(farm_id: str) -> dict | None:
    rows = select(
        "crop_cycles",
        params={"farm_id": f"eq.{farm_id}", "status": "eq.active", "limit": "1"},
    )
    return rows[0] if rows else None


def open_tasks_for_farmer(farmer_id: str) -> list[dict]:
    farm_ids = [f["id"] for f in farms_for_farmer(farmer_id)]
    if not farm_ids:
        return []
    ids_filter = "(" + ",".join(farm_ids) + ")"
    return select(
        "farm_tasks",
        params={"farm_id": f"in.{ids_filter}", "status": "eq.open", "order": "due_date.asc.nullslast"},
    )


def lots_for_farmer(farmer_id: str, lot_id: str | None = None) -> list[dict]:
    if lot_id:
        return select(
            "lots",
            params={"id": f"eq.{lot_id}", "or": f"(seller_id.eq.{farmer_id},buyer_id.eq.{farmer_id})"},
        )
    return select(
        "lots",
        params={"or": f"(seller_id.eq.{farmer_id},buyer_id.eq.{farmer_id})", "order": "created_at.desc"},
    )


def lot_events(lot_id: str) -> list[dict]:
    return select("lot_events", params={"lot_id": f"eq.{lot_id}", "order": "created_at.asc"})
