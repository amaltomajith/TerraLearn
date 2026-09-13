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
from app.refresh.supabase_admin import select, rpc, insert, insert_returning, patch, is_configured  # noqa: F401


def farmer_exists(farmer_id: str) -> bool:
    """Used by write tools (confirm_create_lot) to fail cleanly on a bad
    farmer_id instead of surfacing a raw FK-violation exception."""
    rows = select("farmers", params={"id": f"eq.{farmer_id}", "select": "id", "limit": "1"})
    return bool(rows)


def get_farmer(farmer_id: str) -> dict | None:
    """Used by get_buyer_profile — farmers.gstin/gstin_verified/role/name."""
    rows = select("farmers", params={"id": f"eq.{farmer_id}", "limit": "1"})
    return rows[0] if rows else None


def get_lot(lot_id: str) -> dict | None:
    """Any lot by id, unscoped by party — used by tools where either side
    (or a browsing buyer) needs the lot's current state: confirm_make_offer,
    propose/confirm_respond_to_offer, raise_dispute, get_dispute_status."""
    rows = select("lots", params={"id": f"eq.{lot_id}", "limit": "1"})
    return rows[0] if rows else None


def update_lot_status(lot_id: str, status: str, buyer_id: str | None = None, price_per_unit: float | None = None) -> dict:
    data = {"status": status}
    if buyer_id is not None:
        data["buyer_id"] = buyer_id
    if price_per_unit is not None:
        data["price_per_unit"] = price_per_unit
    rows = patch("lots", params={"id": f"eq.{lot_id}"}, data=data)
    return rows[0]


def insert_lot_offer(lot_id: str, buyer_id: str, price: float, quantity: float) -> dict:
    rows = insert_returning("lot_offers", [{
        "lot_id": lot_id, "buyer_id": buyer_id, "price": price, "quantity": quantity, "status": "pending",
    }])
    return rows[0]


def get_lot_offer(offer_id: str) -> dict | None:
    rows = select("lot_offers", params={"id": f"eq.{offer_id}", "limit": "1"})
    return rows[0] if rows else None


def update_lot_offer_status(offer_id: str, status: str) -> dict:
    rows = patch("lot_offers", params={"id": f"eq.{offer_id}"}, data={"status": status})
    return rows[0]


def insert_lot(seller_id: str, crop: str, quantity: float, unit: str, grade: str) -> dict:
    """The actual write behind confirm_create_lot. Returns the created row
    (including its server-generated id) via Prefer: return=representation."""
    rows = insert_returning("lots", [{
        "seller_id": seller_id,
        "crop": crop,
        "quantity": quantity,
        "unit": unit,
        "grade": grade,
        "status": "open",
    }])
    return rows[0]


def insert_lot_event(lot_id: str, event_type: str, actor_id: str | None, detail: dict | None = None) -> None:
    insert("lot_events", [{
        "lot_id": lot_id,
        "event_type": event_type,
        "actor_id": actor_id,
        "detail": detail or {},
    }])


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


def insert_returning_lot_event(lot_id: str, event_type: str, actor_id: str | None, detail: dict | None = None) -> dict:
    """Like insert_lot_event, but returns the created row (its id doubles as
    dispute_id for raise_dispute/get_dispute_status)."""
    rows = insert_returning("lot_events", [{
        "lot_id": lot_id, "event_type": event_type, "actor_id": actor_id, "detail": detail or {},
    }])
    return rows[0]


def get_lot_event(event_id: str) -> dict | None:
    rows = select("lot_events", params={"id": f"eq.{event_id}", "limit": "1"})
    return rows[0] if rows else None
