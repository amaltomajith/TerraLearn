"""
Static keypress -> Farmer MCP tool dispatch table (Puppeteer MCP spec §6).

Static dispatch, by design — a keypress selects one fixed tool call, no
dynamic classification or agent routing. Calls the Farmer MCP tool functions
directly (imported from app.mcp.farmer_server, which the @mcp.tool() decorator
leaves as plain callables — verified before building this) rather than over
HTTP: the IVR path never needs the streamable-HTTP transport, only the
underlying Python function.

DTMF constraint: every arg_builder here must be satisfiable from a caller_id
(the farmer_id resolved from the calling number — resolution itself is out of
scope this pass, a real telephony integration isn't being built) plus at most
a couple of digit presses. No free-text arguments.
"""
from dataclasses import dataclass
from typing import Callable

from app.mcp.farmer_server import (
    get_farm_snapshot,
    get_crop_advisory,
    get_crop_calendar,
    get_mandi_price,
    get_my_tasks,
    get_nearby_ifs_matches,
    get_lot_status,
)


@dataclass
class DispatchEntry:
    keypress: str
    tool_name: str
    tool_fn: Callable
    arg_builder: Callable[[str], dict]
    label: str


def _crop_key_for(farmer_id: str) -> str | None:
    """get_mandi_price needs a crop_key, not a farmer_id — pull it from the
    farmer's own active crop cycle via get_crop_calendar (cheap: no extra
    network round trip beyond what get_crop_calendar already does)."""
    snapshot = get_farm_snapshot(farmer_id)
    crop = (snapshot.get("crop_cycle") or {}).get("crop") if snapshot.get("available") else None
    return str(crop).lower() if crop else None


# Keypress is a string, not an int, so "*" (Tier-3 escalation, spec §6) fits
# the same type as the digit keys — a real telephony DTMF decoder hands back
# strings for exactly this reason.
DISPATCH: dict[str, DispatchEntry] = {
    "1": DispatchEntry("1", "get_farm_snapshot", get_farm_snapshot, lambda fid: {"farmer_id": fid}, "Farm snapshot (soil, weather)"),
    "2": DispatchEntry("2", "get_crop_advisory", get_crop_advisory, lambda fid: {"farmer_id": fid}, "Today's crop advisory"),
    "3": DispatchEntry("3", "get_crop_calendar", get_crop_calendar, lambda fid: {"farmer_id": fid}, "Crop calendar / stage"),
    "4": DispatchEntry("4", "get_mandi_price", get_mandi_price, lambda fid: {"crop_key": _crop_key_for(fid) or ""}, "Mandi price"),
    "5": DispatchEntry("5", "get_my_tasks", get_my_tasks, lambda fid: {"farmer_id": fid}, "My open tasks"),
    "6": DispatchEntry("6", "get_nearby_ifs_matches", get_nearby_ifs_matches, lambda fid: {"farmer_id": fid}, "Nearby IFS matches"),
    "7": DispatchEntry("7", "get_lot_status", get_lot_status, lambda fid: {"farmer_id": fid}, "My lot status"),
    # "*" is Tier-3 human escalation (spec §6) — app/ivr/runner.py handles it
    # directly, not via this dispatch table, since there is no tool to call.
}

ESCALATION_KEYPRESS = "*"
