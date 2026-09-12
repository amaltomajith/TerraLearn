"""
Service-role Supabase client for the refresh layer and any MCP tool that must
read/write RLS-locked, owner-scoped rows (farms, crop_cycles, farm_tasks, lots)
without a Clerk JWT.

Why a service-role key at all (new precedent for this backend): every RLS
policy on owner-scoped tables gates on current_farmer_id(), which resolves
from auth.jwt() ->> 'sub' (see supabase/20_helpers.sql). The backend refresh
job and MCP tools have no JWT — they run as a trusted internal process, not on
behalf of a signed-in browser. A security-definer RPC granted to `anon` (the
only role reachable without a JWT) would let any browser holding the public
anon key overwrite the shared cache or read another farmer's rows — a real
cache-poisoning / data-leak vector. SUPABASE_SERVICE_ROLE_KEY never leaves this
process (Render env only, `sync: false`, never under VITE_).

Mirrors the httpx-to-PostgREST pattern already established in app/rag.py —
no supabase-py SDK dependency, same reasoning (keep the Render free-tier
512MB worker's dependency footprint light).
"""
import os
import logging
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

_backend_dir = Path(__file__).resolve().parent.parent.parent
for _p in (_backend_dir / ".env.local", _backend_dir / ".env"):
    if _p.exists():
        load_dotenv(_p, override=(_p.name == ".env.local"))

_SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

_client: Optional[httpx.Client] = None


def _http() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(timeout=20.0, verify=False)
    return _client


def _headers(extra: Optional[dict] = None) -> dict:
    h = {
        "apikey": _SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def is_configured() -> bool:
    return bool(_SUPABASE_URL and _SERVICE_ROLE_KEY)


def select(table: str, params: Optional[dict] = None) -> list[dict]:
    """GET /rest/v1/<table>?<params> — service role bypasses RLS entirely, so
    callers MUST apply their own filters (e.g. farmer_id=eq.<id>) via `params`."""
    if not is_configured():
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured")
    r = _http().get(f"{_SUPABASE_URL}/rest/v1/{table}", headers=_headers(), params=params or {})
    r.raise_for_status()
    return r.json()


def rpc(fn_name: str, args: Optional[dict] = None) -> list[dict] | dict:
    """POST /rest/v1/rpc/<fn_name> — for service-role-only RPCs like
    distinct_farm_weather_buckets()."""
    if not is_configured():
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured")
    r = _http().post(f"{_SUPABASE_URL}/rest/v1/rpc/{fn_name}", headers=_headers(), json=args or {})
    r.raise_for_status()
    return r.json()


def insert(table: str, rows: list[dict]) -> None:
    """POST /rest/v1/<table> — a plain insert, for tables with no natural
    conflict key to upsert against (e.g. escalation_requests, where every row
    is its own new event)."""
    if not is_configured():
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured")
    if not rows:
        return
    r = _http().post(
        f"{_SUPABASE_URL}/rest/v1/{table}",
        headers=_headers({"Prefer": "return=minimal"}),
        json=rows,
    )
    r.raise_for_status()


def upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    """POST /rest/v1/<table> with Prefer: resolution=merge-duplicates.

    `on_conflict` must name the table's unique index columns (e.g.
    "commodity,state"). Writes nothing and raises on transport/HTTP error —
    callers (backend/app/refresh/*.py) are responsible for catching this so a
    refresh failure never propagates past its endpoint.
    """
    if not is_configured():
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured")
    if not rows:
        return
    r = _http().post(
        f"{_SUPABASE_URL}/rest/v1/{table}",
        headers=_headers({"Prefer": "resolution=merge-duplicates,return=minimal"}),
        params={"on_conflict": on_conflict},
        json=rows,
    )
    r.raise_for_status()
