"""
Tier-1 composer (Puppeteer MCP spec §6) — a fast Groq call that turns a tool's
raw JSON result into a short spoken line. Reuses app.agent's _get_llm() cache
directly (same provider config, same httpx.Client, same memoization) rather
than create_react_agent — no tool-calling is needed here, the tool has already
run; this is pure text generation from a fixed JSON blob.

Deliberately NOT a second LLM critiquing the first (spec §8 rejects that
pattern as a MAASH-style latency risk) — app/ivr/guard.py is the cheap,
deterministic check on this composer's output.
"""
import os
import json
import logging

from app.agent import _get_llm

logger = logging.getLogger(__name__)

_LANG_NAMES = {
    "kn": "Kannada", "hi": "Hindi", "en": "English", "ta": "Tamil",
    "te": "Telugu", "mr": "Marathi", "ml": "Malayalam",
}


def compose_reply(tool_name: str, tool_result, language: str = "kn") -> str | None:
    """Returns a short spoken line, or None if the LLM call itself fails
    (caller falls back to Tier-2 either way — a None here is treated the same
    as a guard failure)."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1")
    model = os.getenv("OPENAI_MODEL", "openai/gpt-oss-120b")
    if not api_key:
        return None

    lang = _LANG_NAMES.get((language or "").strip().lower(), "English")
    prompt = (
        f"You are composing a short spoken answer for a farmer on a phone call, in {lang}. "
        f"Tool: {tool_name}. Data (JSON): {json.dumps(tool_result)}\n\n"
        "Rules: under 40 words. Only state numbers that literally appear in the JSON above — "
        "never compute, round, or invent a number that isn't already there. No preamble."
    )

    try:
        llm = _get_llm(api_key, base_url, model)
        response = llm.invoke(prompt)
        text = str(response.content).strip()
        return text or None
    except Exception as e:
        logger.warning("IVR Tier-1 composer failed: %s", e)
        return None
