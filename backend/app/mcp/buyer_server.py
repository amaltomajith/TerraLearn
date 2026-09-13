"""
Buyer MCP server (Puppeteer MCP spec §4, Phase 4). Mounted at /mcp/buyer in
app/main.py, streamable-HTTP transport, as a structurally separate tool set
from the Farmer MCP server (spec §1: a buyer-facing surface must never reach
a farmer-private tool, and vice versa — two mounted servers make that a
structural fact rather than a permission check that has to be gotten right).

CRITICAL TRUST-BOUNDARY NOTE — identical in shape to farmer_server.py's: every
tool takes buyer_id as a plain argument, and several use the service-role key
to write. This server is the trust boundary, not the database. Acceptable
only while this server stays internal/unwired (no real caller yet).

RESOLVED NOTE, confirm_make_offer (2026-09-13): originally built (Phase 4) as
a second MCP tool alongside propose_make_offer — an explicitly accepted risk
at the time, same as farmer_server.py's confirm_create_lot/
confirm_respond_to_offer. Resolved the same way: confirm_make_offer is no
longer an MCP tool. It's a plain function now, reachable for any external
caller only via POST /internal/offers/confirm-make in app/main.py — never as
a tool an LLM-driven agent could choose to call. propose_make_offer remains
an MCP tool since it's side-effect-free.

Never expose, from this server: a farmer's phone number, exact home address,
or any contact detail beyond what's needed for a transaction already in
progress (spec §4's consent-gate principle) — checked against every tool
below; none return farmer contact fields.
"""
import os
import re
import logging

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from app.mcp import supabase_owner as owner
from app.mcp import supabase_public as public
from app.refresh.supabase_admin import insert as service_insert

logger = logging.getLogger(__name__)

mcp = MCPServer("terralearn-buyer")


def _allowed_hosts() -> list[str]:
    raw = os.getenv("MCP_ALLOWED_HOSTS", "127.0.0.1:8000,localhost:8000")
    return [h.strip() for h in raw.split(",") if h.strip()]


def build_buyer_mcp_app():
    security = TransportSecuritySettings(allowed_hosts=_allowed_hosts())
    return mcp.streamable_http_app(stateless_http=True, json_response=True, transport_security=security)


# ---------------------------------------------------------------------------
# GSTIN format + checksum validation
#
# No free/public GSTN verification API exists — confirmed by research before
# building this (even GSTN's own "Public API" requires GST Suvidha Provider
# registration, not a self-serve key). This matches
# terralearn_planned_features.md's own prescribed fallback: ship an honest
# "unverified" state rather than fake a checkmark. government_verified is
# ALWAYS False here — this only checks that the GSTIN is well-formed.
#
# Checksum: 15-char GSTIN, Mod-36 style (ISO 7064 family). Algorithm verified
# against an authoritative step-by-step description and a known-real GSTIN
# before shipping, not assumed from a single unverified source.
# ---------------------------------------------------------------------------
_GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_GSTIN_FORMAT_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


def _gstin_checksum_valid(gstin: str) -> bool:
    body, given = gstin[:14], gstin[14]
    factor = 1
    total = 0
    for ch in body:
        value = _GSTIN_ALPHABET.index(ch)
        product = value * factor
        total += (product // 36) + (product % 36)
        factor = 2 if factor == 1 else 1
    checksum_value = (36 - (total % 36)) % 36
    return _GSTIN_ALPHABET[checksum_value] == given


@mcp.tool()
def verify_gstin(gstin: str) -> dict:
    """Format + checksum validation only — see this module's GSTIN section
    above for why no live government check is made. government_verified is
    always False."""
    g = (gstin or "").strip().upper()
    format_ok = bool(_GSTIN_FORMAT_RE.match(g))
    checksum_ok = format_ok and _gstin_checksum_valid(g)
    return {
        "valid_format": checksum_ok,
        "state_code": g[:2] if format_ok else None,
        "government_verified": False,
        "message": (
            "GSTIN format and checksum are valid, but this has NOT been checked against "
            "the government registry — no free/public GSTN verification API exists. "
            "Show an 'unverified' badge, not a checkmark."
            if checksum_ok else
            "GSTIN format or checksum is invalid."
        ),
    }


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def get_buyer_profile(buyer_id: str) -> dict:
    """Verification status + reliability score. payment_reliability() RPC
    (40_functions.sql:305-317) was already built for Saath's farmer-to-farmer
    exchanges and works identically for a buyer's farmers.id — no new schema."""
    farmer = owner.get_farmer(buyer_id)
    if not farmer:
        return {"available": False, "reason": "buyer not found"}
    try:
        reliability = public.rpc("payment_reliability", {"p_farmer_id": buyer_id})
        reliability = reliability[0] if reliability else {}
    except Exception as e:
        logger.warning("payment_reliability lookup failed: %s", e)
        reliability = {}
    return {
        "available": True,
        "name": farmer.get("name"),
        "role": farmer.get("role"),
        "gstin": farmer.get("gstin"),
        "gstin_verified": farmer.get("gstin_verified", False),
        "reliability": reliability,
    }


@mcp.tool()
def post_demand(buyer_id: str, commodity: str, quantity: float, grade: str, target_price: float | None = None) -> dict:
    """Creates a demand listing directly — not propose-gated (spec's own
    tool table only drafts propose_make_offer; a demand posting isn't a
    binding commitment the way an offer or a lot is)."""
    if not owner.farmer_exists(buyer_id):
        return {"available": False, "reason": "buyer not found"}
    try:
        rows = service_insert("listings", [{
            "farmer_id": buyer_id,
            "type": "demand",
            "category": commodity,
            "title": f"Demand: {quantity} of {commodity} (grade {grade})",
            "description": f"Looking for {quantity} of {commodity}, grade {grade}."
                            + (f" Target price: {target_price}." if target_price else ""),
            "quantity": quantity,
            "rate": target_price,
            "ifs_resource_type": commodity,
        }])
    except Exception as e:
        logger.error("post_demand insert failed: %s", e)
        return {"available": False, "reason": "could not create demand listing"}
    return {"available": True, "message": f"Demand posted for {quantity} of {commodity}."}


@mcp.tool()
def search_lots(buyer_id: str, commodity: str, grade: str | None = None, radius_km: float = 50, min_qty: float | None = None) -> list[dict]:
    """Finds open farmer lots near the buyer — search_lots_nearby RPC
    (public/anon-key path, security definer, same pattern as
    nearby_ifs_matches: a deliberate, controlled hole through lots' own
    buyer/seller-only RLS for browsing OPEN lots)."""
    return public.rpc("search_lots_nearby", {
        "p_buyer_id": buyer_id, "p_commodity": commodity, "p_grade": grade,
        "p_radius_m": int(radius_km * 1000), "p_min_qty": min_qty,
    })


@mcp.tool()
def propose_make_offer(buyer_id: str, lot_id: str, price: float, quantity: float) -> dict:
    """Drafts an offer — does NOT create it. No write happens here."""
    if not owner.farmer_exists(buyer_id):
        return {"available": False, "reason": "buyer not found"}
    lot = owner.get_lot(lot_id)
    if not lot:
        return {"available": False, "reason": "lot not found"}
    if lot["status"] != "open":
        return {"available": False, "reason": f"lot is '{lot['status']}', not open for offers"}
    return {
        "available": True,
        "requires_confirmation": True,
        "draft": {"lot_id": lot_id, "buyer_id": buyer_id, "price": price, "quantity": quantity, "status": "pending"},
        "message": f"Draft offer: {price} for {quantity} {lot['unit']} of {lot['crop']}. Not sent yet — confirm to send it.",
    }


def confirm_make_offer(buyer_id: str, lot_id: str, price: float, quantity: float) -> dict:
    """Creates the offer for real — deliberately NOT an MCP tool (see this
    module's RESOLVED NOTE above), only callable in-process or via
    /internal/offers/confirm-make."""
    if not owner.farmer_exists(buyer_id):
        return {"available": False, "reason": "buyer not found"}
    lot = owner.get_lot(lot_id)
    if not lot:
        return {"available": False, "reason": "lot not found"}
    if lot["status"] != "open":
        return {"available": False, "reason": f"lot is '{lot['status']}', not open for offers"}

    try:
        offer = owner.insert_lot_offer(lot_id=lot_id, buyer_id=buyer_id, price=price, quantity=quantity)
    except Exception as e:
        logger.error("confirm_make_offer insert failed: %s", e)
        return {"available": False, "reason": "could not create offer"}

    try:
        owner.insert_lot_event(lot_id=lot_id, event_type="offer_received", actor_id=buyer_id,
                                detail={"offer_id": offer["id"], "price": price, "quantity": quantity})
    except Exception as e:
        logger.error("lot_events insert failed for offer %s: %s", offer["id"], e)

    return {
        "available": True,
        "offer": {k: offer[k] for k in ("id", "lot_id", "price", "quantity", "status")},
        "message": f"Offer sent: {price} for {quantity}.",
    }


@mcp.tool()
def get_lot_provenance(lot_id: str) -> dict:
    """Full state-transition history for a lot — the transparent transaction
    record the PS asks for. Unrestricted by buyer/seller identity: a buyer
    browsing lots should be able to see a lot's history before offering on
    it, same as get_lot_status's own farmer-facing equivalent."""
    lot = owner.get_lot(lot_id)
    if not lot:
        return {"available": False, "reason": "lot not found"}
    events = owner.lot_events(lot_id)
    return {
        "available": True,
        "lot": {k: lot[k] for k in ("id", "crop", "quantity", "unit", "grade", "status")},
        "events": [{"event_type": e["event_type"], "detail": e.get("detail"), "created_at": e["created_at"]} for e in events],
    }


@mcp.tool()
def track_payment_status(lot_id: str) -> dict:
    """Read-only — no confirm_payment write tool exists this pass (not in
    the spec's Buyer MCP tool list). Reports honestly if nothing is recorded
    yet rather than implying a default state."""
    lot = owner.get_lot(lot_id)
    if not lot:
        return {"available": False, "reason": "lot not found"}
    events = [e for e in owner.lot_events(lot_id) if e["event_type"] == "payment_confirmed"]
    if not events:
        return {"available": True, "status": "no_payment_recorded", "message": "No payment has been recorded for this lot yet."}
    return {"available": True, "status": "payment_confirmed", "confirmed_at": events[-1]["created_at"], "detail": events[-1].get("detail")}


@mcp.tool()
def raise_dispute(lot_id: str, reason: str, buyer_id: str) -> dict:
    """Reuses lots.status='disputed' + a dispute_raised lot_events row rather
    than a dedicated disputes table (the existing `disputes` table requires a
    non-null exchange_id, which lot-based disputes don't have — same gap
    Phase 1-2 hit with escalation_requests). The event's own id serves as
    dispute_id."""
    lot = owner.get_lot(lot_id)
    if not lot:
        return {"available": False, "reason": "lot not found"}
    try:
        owner.update_lot_status(lot_id, "disputed")
    except Exception as e:
        logger.error("raise_dispute status update failed: %s", e)
        return {"available": False, "reason": "could not raise dispute"}

    try:
        event = owner.insert_returning_lot_event(lot_id=lot_id, event_type="dispute_raised", actor_id=buyer_id, detail={"reason": reason})
        dispute_id = event["id"]
    except Exception as e:
        logger.error("dispute_raised event insert failed: %s", e)
        return {"available": False, "reason": "lot marked disputed, but could not record the dispute event"}

    return {"available": True, "dispute_id": dispute_id, "message": "Dispute raised. A person will review it."}


@mcp.tool()
def get_dispute_status(dispute_id: str) -> dict:
    """dispute_id is a lot_events row id (from raise_dispute). Resolved if a
    later dispute_resolved event exists for the same lot."""
    event = owner.get_lot_event(dispute_id)
    if not event or event["event_type"] != "dispute_raised":
        return {"available": False, "reason": "dispute not found"}
    later_events = owner.lot_events(event["lot_id"])
    resolved = next(
        (e for e in later_events if e["event_type"] == "dispute_resolved" and e["created_at"] > event["created_at"]),
        None,
    )
    if resolved:
        return {"available": True, "status": "resolved", "resolved_at": resolved["created_at"], "detail": resolved.get("detail")}
    return {"available": True, "status": "open", "raised_at": event["created_at"], "detail": event.get("detail")}
