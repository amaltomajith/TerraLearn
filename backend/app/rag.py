"""
RAG for the TerraLearn assistant — Supabase pgvector + the `embed` edge function
(Supabase's built-in gte-small model, 384-dim).

Replaces the former local sentence-transformers + LlamaIndex index, which loaded
torch + an 80MB model into a 512MB Render free-tier worker and OOM-killed it on
the first knowledge lookup. This module has no heavy imports: a query is embedded
by the edge function and matched by the `match_knowledge` SQL RPC.

Requires SUPABASE_URL and SUPABASE_ANON_KEY (both public/safe on the backend).
Seed the corpus with backend/scripts/seed_knowledge.py.
"""
import os
import logging
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

_backend_dir = Path(__file__).resolve().parent.parent
for _p in (_backend_dir / ".env.local", _backend_dir / ".env"):
    if _p.exists():
        load_dotenv(_p, override=(_p.name == ".env.local"))

_SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
_SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or ""

_client: Optional[httpx.Client] = None


def _http() -> httpx.Client:
    global _client
    if _client is None:
        # verify=False matches the rest of the backend (ssl_patch); Supabase certs are valid.
        _client = httpx.Client(timeout=20.0, verify=False)
    return _client


def _headers() -> dict:
    return {
        "apikey": _SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {_SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return bool(_SUPABASE_URL and _SUPABASE_ANON_KEY)


def _embed(text: str) -> list[float]:
    r = _http().post(f"{_SUPABASE_URL}/functions/v1/embed", headers=_headers(), json={"input": text})
    r.raise_for_status()
    return r.json()["embedding"]


def retrieve(query: str, k: int = 3) -> list[dict]:
    """Up to k knowledge chunks most similar to `query`.

    Each item: {"source_file": str, "content": str, "similarity": float}.
    Raises on a config or transport error (the caller turns that into a
    graceful "knowledge lookup failed" message).
    """
    if not is_configured():
        raise RuntimeError("SUPABASE_URL / SUPABASE_ANON_KEY not configured")
    embedding = _embed(query)
    r = _http().post(
        f"{_SUPABASE_URL}/rest/v1/rpc/match_knowledge",
        headers=_headers(),
        json={"query_embedding": embedding, "match_count": k},
    )
    r.raise_for_status()
    return r.json()
