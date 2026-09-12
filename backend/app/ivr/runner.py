"""
IVR turn orchestrator (Puppeteer MCP spec §6):

  Keypress -> fixed Farmer MCP tool call -> context returned
           -> Tier 1: fast LLM call composes a short spoken answer
           -> guard: every number in the composed answer is checked against
              the tool's returned data
           -> guard passes -> speak it
           -> guard fails or Tier 1 unavailable -> Tier 2: fixed template
           -> "*" at any point, or an unmapped keypress, or a tool exception
              -> Tier 3: human escalation

No real telephony this pass (see spec decisions) — this is exercised via
backend/scripts/ivr_harness.py and, optionally, an internal HTTP endpoint.
"""
import logging
from dataclasses import dataclass

from app.ivr.dispatch import DISPATCH, ESCALATION_KEYPRESS
from app.ivr.composer import compose_reply
from app.ivr.guard import check_numbers
from app.ivr.templates import render_tier2
from app.ivr.escalation import escalate

logger = logging.getLogger(__name__)


@dataclass
class IVRResult:
    tier: str  # 'tier1' | 'tier2' | 'tier3'
    text: str
    tool_name: str | None = None
    tool_result: object = None
    guard_unmatched: list | None = None


def handle_ivr_turn(farmer_id: str, keypress: str, language: str = "kn") -> IVRResult:
    if keypress == ESCALATION_KEYPRESS:
        escalate(farmer_id, reason="farmer_requested", tool_name=None, raw_query=keypress)
        return IVRResult(tier="tier3", text="Connecting you to a person now.")

    entry = DISPATCH.get(keypress)
    if entry is None:
        escalate(farmer_id, reason="no_match", tool_name=None, raw_query=keypress)
        return IVRResult(tier="tier3", text="I didn't understand that. Connecting you to a person now.")

    try:
        args = entry.arg_builder(farmer_id)
        tool_result = entry.tool_fn(**args)
    except Exception as e:
        logger.error("IVR tool %s raised: %s", entry.tool_name, e)
        escalate(farmer_id, reason="tool_error", tool_name=entry.tool_name, raw_query=keypress)
        return IVRResult(tier="tier3", text="Something went wrong. Connecting you to a person now.",
                          tool_name=entry.tool_name)

    composed = compose_reply(entry.tool_name, tool_result, language=language)
    if composed is not None:
        guard_result = check_numbers(composed, tool_result)
        if guard_result.ok:
            return IVRResult(tier="tier1", text=composed, tool_name=entry.tool_name, tool_result=tool_result)
        logger.warning(
            "IVR guard failed for %s: unmatched=%s", entry.tool_name, guard_result.unmatched
        )

    # Tier-1 unavailable or the guard failed — a guard failure is a controlled
    # fallback, NOT itself an escalation (see backend/scripts/ivr_harness.py's
    # verification: a wrong number should fall through to Tier 2 quietly).
    fallback_text = render_tier2(entry.tool_name, tool_result)
    return IVRResult(
        tier="tier2", text=fallback_text, tool_name=entry.tool_name, tool_result=tool_result,
        guard_unmatched=(guard_result.unmatched if composed is not None else None),
    )
