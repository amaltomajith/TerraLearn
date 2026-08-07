import os
import time
import logging
from typing import Optional
import httpx
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
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

SYSTEM_PROMPT = (
    "You are TerraLearn's precision agriculture environmental assistant for farmers.\n"
    "Your goal is to answer natural-language questions about climate, weather trends, "
    "air quality, and crop viability for a specific location.\n\n"
    "Available tools:\n"
    "1. get_climate_aqi_data(lat, lng): Use for real-time weather, current AQI, "
    "temperature trends, or rainfall history at specific coordinates.\n"
    "2. get_environmental_knowledge(query): Use for questions about health standards "
    "(WHO, CPCB), policy (NCAP), pollutant effects on crops (ozone, PM, heat stress), "
    "stubble burning, or farm management guidelines. You MUST cite source files "
    "(e.g., 'According to [source_file]...') when using this tool.\n\n"
    "Instructions:\n"
    "- Select the appropriate tool for the question.\n"
    "- Keep answers concise, practical, and farmer-friendly.\n"
    "- If pre-calculated crop yield context is provided in the user prompt, include it."
)


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


def _try_fallback(
    api_key: str,
    base_url: str,
    model_name: str,
    tools: list,
    user_input: str,
    http_client: httpx.Client,
) -> Optional[str]:
    """Attempt execution via fallback provider (OpenRouter)."""
    try:
        fallback_llm = ChatOpenAI(
            api_key=api_key,
            base_url=base_url,
            model=model_name,
            temperature=0.3,
            http_client=http_client,
        )
        fallback_agent = create_react_agent(fallback_llm, tools, prompt=SYSTEM_PROMPT)
        result = fallback_agent.invoke({"messages": [HumanMessage(content=user_input)]})
        messages = result.get("messages", [])

        for msg in reversed(messages):
            content = getattr(msg, "content", None)
            tool_calls = getattr(msg, "tool_calls", None)
            if content and not tool_calls:
                logger.info("served by: openrouter_fallback")
                return str(content)
    except Exception as fb_err:
        logger.error("Fallback provider (OpenRouter) invocation failed: %s", fb_err)
    return None


def run_agent(user_input: str) -> str:
    """Run a LangGraph ReAct agent with primary (Groq) and fallback (OpenRouter) providers."""
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

    http_client = httpx.Client(verify=False)

    llm = ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model_name,
        temperature=0.3,
        http_client=http_client,
    )

    tools = [get_climate_aqi_data, get_environmental_knowledge]
    agent = create_react_agent(llm, tools, prompt=SYSTEM_PROMPT)

    has_retried_429 = False
    max_tool_attempts = 2

    tool_attempt = 1
    while tool_attempt <= max_tool_attempts:
        try:
            result = agent.invoke({"messages": [HumanMessage(content=user_input)]})
            messages = result.get("messages", [])

            # Extract the last non-tool AI message
            for msg in reversed(messages):
                content = getattr(msg, "content", None)
                tool_calls = getattr(msg, "tool_calls", None)
                if content and not tool_calls:
                    logger.info("served by: groq")
                    return str(content)

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
                        fallback_api_key, fallback_base_url, fallback_model, tools, user_input, http_client
                    )
                    if fallback_result:
                        return fallback_result
                    return "Both primary and fallback AI providers are currently unavailable. Please try again shortly."

                logger.error("Groq 429 rate limit persisted and no fallback API key configured.")
                return "The assistant is briefly rate-limited. Please wait a few seconds and try your question again."

            # 2. Handle Connection / Timeout errors on primary
            if is_conn_error and not is_tool_use_failed:
                if fallback_api_key:
                    logger.warning("Groq connection/timeout error. Attempting fallback to OpenRouter...")
                    fallback_result = _try_fallback(
                        fallback_api_key, fallback_base_url, fallback_model, tools, user_input, http_client
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
                        fallback_response = llm.invoke(
                            [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_input)]
                        )
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
