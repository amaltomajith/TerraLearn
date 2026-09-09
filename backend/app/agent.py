import os
import re
import json
import time
import logging
from typing import Optional
import httpx
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from app.tools import get_climate_aqi_data, get_environmental_knowledge

logger = logging.getLogger(__name__)

# Load .env.local and .env from backend/
backend_dir = Path(__file__).resolve().parent.parent
env_local_path = backend_dir / ".env.local"
env_path = backend_dir / ".env"

if env_local_path.exists():
    load_dotenv(env_local_path, override=True)
load_dotenv(env_path, override=False)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_LANG_NAMES = {
    "kn": "Kannada",
    "hi": "Hindi",
    "en": "English",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "ml": "Malayalam",
    "bn": "Bengali",
    "pa": "Punjabi",
    "gu": "Gujarati",
}


def build_system_prompt(language=None, name=None, village=None, enterprises=None) -> str:
    """Farmer-facing system prompt. Language defaults to Kannada (the Saath default)."""
    lang = _LANG_NAMES.get((language or "").strip().lower(), "English")

    who = []
    if name:
        who.append(f"The farmer's name is {name}.")
    if village:
        who.append(f"Their village is {village}.")
    if enterprises:
        who.append("They farm: " + ", ".join(enterprises) + ".")
    who_line = (" " + " ".join(who)) if who else ""

    return (
        f"You are TerraLearn's assistant for small farmers in India.{who_line}\n\n"
        f"ALWAYS reply in {lang}. Keep names, numbers and place names as they are; "
        f"never switch language in the middle of an answer.\n\n"
        "HOW TO ANSWER:\n"
        "- Put the answer in the very first sentence. No preamble like 'Based on the data'.\n"
        "- Stay under 60 words unless the farmer asks you to explain in detail.\n"
        "- Use simple everyday words and short sentences (class-6 reading level).\n"
        "- Mention only the one or two numbers that matter for the question. Never list every metric.\n"
        "- Never invent a number. If a value is not in the context and no tool gives it, say you don't have it.\n"
        "- Never repeat a previous answer word-for-word. If the farmer just says 'ok', 'hi', "
        "'thanks' or similar, reply in one short line - don't re-explain.\n"
        "- If you are unsure, say so briefly and say what would help.\n\n"
        "CONTEXT & TOOLS:\n"
        "- The user prompt already carries the current pin's weather, soil, air quality and "
        "market numbers. Answer from those first.\n"
        "- Only call get_climate_aqi_data when the farmer asks about multi-year history or live "
        "readings that are not already in the prompt.\n"
        "- Call get_environmental_knowledge for questions about safe limits, pollution effects on "
        "crops, government schemes, or health thresholds. Name the source in plain words "
        "(e.g. 'the WHO guide says') — a formal citation is optional.\n"
        "- If a crop-simulation result is in the prompt, use its numbers.\n"
        "- If a 'Leaf scan' line is in the prompt, fold it into the answer together with the "
        "soil and weather numbers (e.g. disease + humidity + leaf-wetness), not as a "
        "standalone plant-ID. A 'low confidence' or 'not covered' scan is NOT a confirmed "
        "diagnosis — say what it might be and that it needs confirmation, don't prescribe a "
        "treatment for it.\n\n"
        "PESTICIDE & CHEMICAL SAFETY (planned_features.md sec.5 — wrong dosage is a safety "
        "problem, not a UX detail):\n"
        "- Give non-chemical and preventive steps first: remove and destroy affected leaves, "
        "improve spacing and airflow, avoid overhead watering, rotate crops, choose resistant "
        "varieties, act on timing.\n"
        "- Only after that, if you name a pesticide / fungicide / insecticide or an active "
        "ingredient, name it as an example only. Do NOT give a dose, spray concentration or "
        "mixing ratio unless the farmer already stated one. Say the exact product and dose "
        "must be confirmed against the label and the local KVK or agri-officer before "
        "spraying.\n"
        "- Never present a specific chemical + dose as a direct instruction to follow now.\n\n"
        "MESSAGING OTHER FARMERS:\n"
        "- If the farmer asks you to message / tell / reply to / ask / connect with someone who "
        "appears in the Saath block, DO NOT say you sent it and DO NOT show the JSON to them. "
        "Write ONE short sentence like 'I've drafted a message to <name> - check it below and "
        "tap Send', then on the next line append ONLY this fenced block (the app hides it and "
        "shows a card):\n"
        "```terralearn-action\n"
        '{"type":"send_message","recipientName":"<their exact name from the Saath block>","body":"<the message, in the farmer\'s language>"}\n'
        "```\n"
        "- Put nothing after the closing ```. Use only a name that appears in the Saath block. "
        "If you cannot tell who they mean, ask them - do not append a block. Never append a "
        "block unless they clearly asked to send/connect.\n\n"
        "YOUR SAATH NETWORK:\n"
        "- If a '== Your Saath network right now ==' block is in the prompt, it lists the "
        "farmer's real inbox, nearby farmers, circular-farming (IFS) loops, their own listings, "
        "and nearby buyers. Use it to answer things like 'what's in my inbox?', 'who near me "
        "needs cow dung?', or 'who messaged me about the tractor?'.\n"
        "- Refer to people by name. Use only what is in that block; if it is absent or a "
        "section is empty, say you can't see that Saath info right now.\n"
        "- 'looks unread' is a guess — phrase it as 'looks unread', not a certainty."
    )


# Module default (used by /api/risk-brief and as the fallback).
SYSTEM_PROMPT = build_system_prompt()


_OPEN_FENCE_RE = re.compile(r"```[a-zA-Z0-9_-]*[ \t]*\n?\s*$")
_CLOSE_FENCE_RE = re.compile(r"^\s*```")


def _find_send_message_object(text: str):
    """Locate a brace-balanced JSON object declaring a send_message action.

    Tolerates the model fencing it (```terralearn-action / ```json / ```) or
    dropping it in raw. Returns (start, end, obj) or None.
    """
    search_from = 0
    while True:
        marker = text.find('"type"', search_from)
        if marker == -1:
            return None
        search_from = marker + 6
        start = text.rfind("{", 0, marker)
        if start == -1:
            continue
        depth = 0
        end = None
        for i in range(start, len(text)):
            ch = text[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end is None:
            continue
        try:
            obj = json.loads(text[start:end])
        except Exception:
            continue
        if isinstance(obj, dict) and obj.get("type") == "send_message":
            return start, end, obj


def extract_action(text: str):
    """Pull a send_message action block out of the answer.

    Returns (cleaned_text, action_dict | None). Fails soft: any parse/shape
    problem returns the block stripped and action=None. Robust to whichever
    model emits the JSON fenced, bare, or with a stray language tag.
    """
    if not text:
        return text, None
    hit = _find_send_message_object(text)
    if not hit:
        return text, None
    start, end, obj = hit

    # Swallow an enclosing code fence + surrounding blank lines so the bubble
    # isn't left with a dangling ``` or an empty "```json" line.
    head, tail = text[:start], text[end:]
    m = _OPEN_FENCE_RE.search(head)
    if m:
        head = head[: m.start()]
    m = _CLOSE_FENCE_RE.match(tail)
    if m:
        tail = tail[m.end():]
    cleaned = re.sub(r"\n{3,}", "\n\n", (head + tail)).strip()

    name = str(obj.get("recipientName") or "").strip()
    body = str(obj.get("body") or "").strip()
    if not name or not body:
        return cleaned, None
    return cleaned, {"type": "send_message", "recipientName": name, "body": body}


def log_provider_config():
    """Log masked runtime LLM provider configuration at startup for debugging."""
    primary_key = os.getenv("OPENAI_API_KEY", "")
    primary_model = os.getenv("OPENAI_MODEL", "llama-3.3-70b-versatile")
    fallback_key = os.getenv("FALLBACK_API_KEY", "").strip()
    fallback_url = os.getenv("FALLBACK_BASE_URL", "https://openrouter.ai/api/v1").strip()
    fallback_model = os.getenv("FALLBACK_MODEL", "meta-llama/llama-3.3-70b-instruct").strip()

    masked_p_key = f"{primary_key[:6]}...{primary_key[-4:]}" if len(primary_key) > 10 else "(unset)"
    masked_f_key = f"{fallback_key[:6]}...{fallback_key[-4:]}" if len(fallback_key) > 10 else "(unset)"

    logger.info("Primary Provider (Groq): model=%s, key=%s", primary_model, masked_p_key)
    logger.info("Fallback Provider (OpenRouter): model=%s, url=%s, key=%s", fallback_model, fallback_url, masked_f_key)


# Log config on module import
log_provider_config()


# ---------------------------------------------------------------------------
# Cached LLM / agent — rebuilt only when the provider config changes, so a warm
# request skips ChatOpenAI + create_react_agent + httpx.Client construction.
# ---------------------------------------------------------------------------

_TOOLS = [get_climate_aqi_data, get_environmental_knowledge]
_HTTP_CLIENT: Optional[httpx.Client] = None
_LLM_CACHE: dict = {}
_AGENT_CACHE: dict = {}


def _http_client() -> httpx.Client:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        _HTTP_CLIENT = httpx.Client(verify=False)
    return _HTTP_CLIENT


def _get_llm(api_key: str, base_url: str, model: str) -> ChatOpenAI:
    key = (api_key, base_url, model)
    if key not in _LLM_CACHE:
        _LLM_CACHE[key] = ChatOpenAI(
            api_key=api_key,
            base_url=base_url,
            model=model,
            temperature=0.3,
            http_client=_http_client(),
        )
    return _LLM_CACHE[key]


def _get_agent(api_key: str, base_url: str, model: str):
    key = (api_key, base_url, model)
    if key not in _AGENT_CACHE:
        # No prompt= — the SystemMessage is prepended per request so the reply
        # language can change from one farmer to the next.
        _AGENT_CACHE[key] = create_react_agent(_get_llm(api_key, base_url, model), _TOOLS)
    return _AGENT_CACHE[key]


def _to_messages(user_input: str, history, system_prompt: Optional[str]) -> list:
    """[SystemMessage, *prior turns, HumanMessage(current)]."""
    msgs: list = [SystemMessage(content=system_prompt or SYSTEM_PROMPT)]
    for turn in (history or []):
        if not isinstance(turn, dict):
            continue
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        if turn.get("role") == "assistant":
            msgs.append(AIMessage(content=content))
        else:
            msgs.append(HumanMessage(content=content))
    msgs.append(HumanMessage(content=user_input))
    return msgs


def _last_answer(messages: list) -> Optional[str]:
    """The last assistant (AI) message with real text and no pending tool call.
    Never returns the echoed system/human/tool messages we passed in."""
    for msg in reversed(messages):
        if getattr(msg, "type", None) != "ai":
            continue
        content = getattr(msg, "content", None)
        tool_calls = getattr(msg, "tool_calls", None)
        if content and not tool_calls:
            return str(content).strip()
    return None


def _try_fallback(api_key: str, base_url: str, model_name: str, msgs: list) -> Optional[str]:
    """Attempt execution via the fallback provider (OpenRouter)."""
    try:
        fallback_agent = _get_agent(api_key, base_url, model_name)
        result = fallback_agent.invoke({"messages": msgs})
        answer = _last_answer(result.get("messages", []))
        if answer:
            logger.info("served by: openrouter_fallback")
            return answer
    except Exception as fb_err:
        logger.error("Fallback provider (OpenRouter) invocation failed: %s", fb_err)
    return None


def run_agent(user_input: str, history=None, system_prompt: Optional[str] = None) -> str:
    """Run a LangGraph ReAct agent with primary (Groq) and fallback (OpenRouter) providers.

    `history` is a list of {"role": "user"|"assistant", "content": str} prior turns
    (the backend stays stateless — the client sends recent history each call).
    """
    # Ensure fresh env values on each request
    if env_local_path.exists():
        load_dotenv(env_local_path, override=True)
    load_dotenv(env_path, override=False)

    # Primary config
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1")
    model_name = os.getenv("OPENAI_MODEL", "llama-3.3-70b-versatile")

    # Fallback config (OpenRouter)
    fallback_api_key = os.getenv("FALLBACK_API_KEY", "").strip()
    fallback_base_url = os.getenv("FALLBACK_BASE_URL", "https://openrouter.ai/api/v1")
    fallback_model = os.getenv("FALLBACK_MODEL", "meta-llama/llama-3.3-70b-instruct")

    if not api_key:
        return "API key is not configured. Please set OPENAI_API_KEY in backend/.env."

    msgs = _to_messages(user_input, history, system_prompt)
    agent = _get_agent(api_key, base_url, model_name)

    has_retried_429 = False
    max_tool_attempts = 2

    tool_attempt = 1
    while tool_attempt <= max_tool_attempts:
        try:
            result = agent.invoke({"messages": msgs})
            answer = _last_answer(result.get("messages", []))
            if answer:
                logger.info("served by: groq")
                return answer
            return "The assistant did not produce a response. Please try rephrasing your question."

        except Exception as e:
            err_str = str(e)
            is_429 = "429" in err_str or "rate_limit" in err_str.lower()
            is_conn_error = (
                isinstance(e, (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError))
                or "connection" in err_str.lower()
                or "connect" in err_str.lower()
                or "timeout" in err_str.lower()
            )
            is_tool_use_failed = (
                "tool_use_failed" in err_str
                or "Failed to call a function" in err_str
                or ("400" in err_str and not is_429)
            )
            # A decommissioned / unavailable primary model (e.g. Groq retiring a
            # Llama snapshot) comes back as a 404 model_not_found. Treat it like a
            # connection failure: fail over to OpenRouter instead of surfacing the
            # raw provider error to the farmer.
            is_model_not_found = (
                "model_not_found" in err_str
                or "model_decommissioned" in err_str
                or "404" in err_str
                or "does not exist or you do not have access" in err_str.lower()
            )

            # 1. Handle 429 Rate Limit with single retry on primary
            if is_429:
                if not has_retried_429:
                    logger.warning("Groq 429 rate limit hit. Waiting 3 seconds before retrying primary...")
                    has_retried_429 = True
                    time.sleep(3)
                    continue  # Single retry on Groq

                # If 429 persists after single retry, attempt fallback if FALLBACK_API_KEY is configured
                if fallback_api_key:
                    logger.warning("Groq 429 rate limit persisted after retry. Attempting fallback to OpenRouter...")
                    fallback_result = _try_fallback(
                        fallback_api_key, fallback_base_url, fallback_model, msgs
                    )
                    if fallback_result:
                        return fallback_result
                    return "Both primary and fallback AI providers are currently unavailable. Please try again shortly."

                logger.error("Groq 429 rate limit persisted and no fallback API key configured.")
                return "The assistant is briefly rate-limited. Please wait a few seconds and try your question again."

            # 2. Handle Connection / Timeout errors, or a decommissioned/unavailable
            #    primary model (404 model_not_found), on primary
            if (is_conn_error or is_model_not_found) and not is_tool_use_failed:
                if fallback_api_key:
                    reason = "model-not-found" if is_model_not_found else "connection/timeout"
                    logger.warning("Groq %s error. Attempting fallback to OpenRouter...", reason)
                    fallback_result = _try_fallback(
                        fallback_api_key, fallback_base_url, fallback_model, msgs
                    )
                    if fallback_result:
                        return fallback_result
                    return "Both primary and fallback AI providers are currently unavailable. Please try again shortly."

            # 3. Handle 400 Tool-use syntax failure separately (do NOT fall back on 400)
            if is_tool_use_failed:
                if tool_attempt < max_tool_attempts:
                    logger.warning(
                        "Groq tool call syntax error on attempt %d. Retrying agent invocation...",
                        tool_attempt,
                    )
                    tool_attempt += 1
                    continue
                else:
                    logger.warning(
                        "Groq tool call failed after %d attempts. Executing direct LLM fallback.",
                        max_tool_attempts,
                    )
                    try:
                        fallback_response = _get_llm(api_key, base_url, model_name).invoke(msgs)
                        fallback_text = str(fallback_response.content).strip()
                        logger.info("served by: groq")
                        return (
                            f"{fallback_text}\n\n"
                            "*(Note: This answer was generated from model general knowledge as "
                            "the reference document lookup encountered a temporary service issue.)*"
                        )
                    except Exception as fallback_err:
                        fallback_err_str = str(fallback_err)
                        if "429" in fallback_err_str or "rate_limit" in fallback_err_str.lower():
                            return "The assistant is briefly rate-limited. Please wait a few seconds and try your question again."
                        return f"Error running environmental assistant: {fallback_err_str}"

            # 4. Handle authentication errors
            if "401" in err_str or "authentication" in err_str.lower() or "invalid_api_key" in err_str.lower():
                return "Invalid API key. Please check OPENAI_API_KEY in backend/.env."

            # General error fallback
            return f"Error running environmental assistant: {err_str}"

    return "No response generated."
