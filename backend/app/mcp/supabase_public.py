"""
Anon-key Supabase access for Farmer MCP tools that only need already-public
data: the nearby_ifs_matches / nearby_listings RPCs (granted to
anon/authenticated and designed to be public-safe) and the world-readable
market_prices_cache / weather_cache tables. Mirrors app/rag.py's httpx
pattern exactly — same credential (SUPABASE_ANON_KEY), same reasoning.
"""
import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parent.parent.parent
for _p in (_backend_dir / ".env.local", _backend_dir / ".env"):
    if _p.exists():
        load_dotenv(_p, override=(_p.name == ".env.local"))

_SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or ""

_client: Optional[httpx.Client] = None


def _http() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(timeout=20.0, verify=False)
    return _client


def _headers() -> dict:
    return {
        "apikey": _ANON_KEY,
        "Authorization": f"Bearer {_ANON_KEY}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return bool(_SUPABASE_URL and _ANON_KEY)


def rpc(fn_name: str, args: dict) -> list[dict]:
    if not is_configured():
        raise RuntimeError("SUPABASE_URL / SUPABASE_ANON_KEY not configured")
    r = _http().post(f"{_SUPABASE_URL}/rest/v1/rpc/{fn_name}", headers=_headers(), json=args)
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else [data]


def select(table: str, params: dict) -> list[dict]:
    if not is_configured():
        raise RuntimeError("SUPABASE_URL / SUPABASE_ANON_KEY not configured")
    r = _http().get(f"{_SUPABASE_URL}/rest/v1/{table}", headers=_headers(), params=params)
    r.raise_for_status()
    return r.json()
