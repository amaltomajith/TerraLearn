"""
backend/scripts/test_mcp_buyer.py
------------------------------------
Exercises the Buyer MCP server as a real external caller would: via the
official `mcp` SDK's own streamable-HTTP client, against a running backend
(default http://127.0.0.1:8000/mcp/buyer/mcp) — not an in-process TestClient.
Mirrors test_mcp_farmer.py's shape.

Usage (with the backend already running, e.g. `python run_backend.py`):
  python backend/scripts/test_mcp_buyer.py --buyer-id <uuid>
"""
import sys
import asyncio
import argparse
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend_dir))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


async def run(url: str, buyer_id: str) -> int:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    async with streamable_http_client(url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = (await session.list_tools()).tools
            print(f"[list_tools] {len(tools)} tools: {[t.name for t in tools]}")
            expected = {
                "get_buyer_profile", "verify_gstin", "post_demand", "search_lots",
                "propose_make_offer", "confirm_make_offer", "get_lot_provenance",
                "track_payment_status", "raise_dispute", "get_dispute_status",
            }
            missing = expected - {t.name for t in tools}
            print("[PASS]" if not missing else "[FAIL]", f"all {len(expected)} expected tools present" if not missing else f"missing: {missing}")

            print()
            print("[call verify_gstin] pure format+checksum, no external call")
            result = await session.call_tool("verify_gstin", {"gstin": "27AAPFU0939F1ZV"})
            print(" ->", result.content[0].text if result.content else result)

            print()
            print(f"[call get_buyer_profile] buyer_id={buyer_id}")
            result = await session.call_tool("get_buyer_profile", {"buyer_id": buyer_id})
            print(" ->", result.content[0].text if result.content else result)

    return 0 if not missing else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--buyer-id", required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8000/mcp/buyer/mcp")
    args = parser.parse_args()
    return asyncio.run(run(args.url, args.buyer_id))


if __name__ == "__main__":
    raise SystemExit(main())
