"""
Tier-2 fixed-template fallback (Puppeteer MCP spec §6) — used when Tier-1's
composed answer fails the numeric guard, or the Tier-1 LLM call times out.
No LLM involved: every string here is built directly from the tool's own JSON
fields, so it is definitionally guard-safe (nothing to fabricate).
"""
from typing import Callable

TIER2_TEMPLATES: dict[str, Callable[[dict], str]] = {
    "get_farm_snapshot": lambda d: (
        "No farm data available for this number."
        if not d.get("available")
        else (
            f"Your farm: {(d.get('crop_cycle') or {}).get('crop', 'no active crop')}. "
            f"Weather: {d.get('weather', {}).get('temperature', 'unknown')} degrees, "
            f"{d.get('weather', {}).get('precipitation', 0)} mm rain."
        )
    ),
    "get_crop_advisory": lambda d: (
        "No crop advisory available right now."
        if not d.get("available") or not d.get("advisories")
        else f"{len(d['advisories'])} advisory for {d.get('crop', 'your crop')}: {d['advisories'][0]['title']}."
    ),
    "get_crop_calendar": lambda d: (
        "No crop calendar available right now."
        if not d.get("available")
        else f"Your {d.get('crop', 'crop')} is in the {d.get('current_phase', 'unknown')} stage, "
        f"{d.get('days_since_sowing', '?')} days since sowing."
    ),
    "get_mandi_price": lambda d: (
        f"No cached price available for {d.get('reason', 'this crop')}."
        if not d.get("available")
        else f"{d['commodity']} price: {d['latest_price']} rupees per {d['unit']}. "
        f"Trend: {d['trend_pct']} percent."
    ),
    "get_my_tasks": lambda d: (
        "You have no open tasks." if not d else f"You have {len(d)} open tasks. First: {d[0]['title']}."
    ),
    "get_nearby_ifs_matches": lambda d: (
        "No nearby matches found." if not d else f"{len(d)} nearby matches found. First: {d[0].get('their_farmer_name', 'a farmer nearby')}."
    ),
    "get_lot_status": lambda d: (
        "No lot status available."
        if (isinstance(d, dict) and not d.get("available")) or (isinstance(d, list) and not d)
        else (
            f"Lot status: {d['lot']['status']}." if isinstance(d, dict)
            else f"You have {len(d)} lots. First: {d[0]['status']}."
        )
    ),
}


def render_tier2(tool_name: str, tool_result) -> str:
    fn = TIER2_TEMPLATES.get(tool_name)
    if not fn:
        return "That information isn't available right now."
    try:
        return fn(tool_result)
    except Exception:
        return "That information isn't available right now."
