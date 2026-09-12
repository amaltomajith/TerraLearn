"""
Tier-3 human escalation (Puppeteer MCP spec §6) — independent of whichever
tier was active. Writes to escalation_requests via the service-role client
(same credential as the refresh layer and the owner-scoped MCP reads).
"""
import logging

from app.refresh import supabase_admin as db

logger = logging.getLogger(__name__)


def escalate(farmer_id: str | None, reason: str, tool_name: str | None, raw_query: str) -> bool:
    """Returns True if the escalation was recorded. Never raises — a failure
    to log an escalation must not prevent the farmer from being told a human
    will help; it's logged server-side for visibility instead."""
    try:
        db.insert(
            "escalation_requests",
            [{
                "farmer_id": farmer_id,
                "channel": "ivr",
                "reason": reason,
                "tool_name": tool_name,
                "raw_query": raw_query,
            }],
        )
        return True
    except Exception as e:
        logger.error("Failed to write escalation_requests row: %s", e)
        return False
