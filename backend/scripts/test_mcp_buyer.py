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
                "propose_make_offer", "get_lot_provenance",
                "track_payment_status", "raise_dispute", "get_dispute_status",
            }
            # confirm_make_offer is deliberately NOT an MCP tool (see
            # buyer_server.py's RESOLVED NOTE) — only reachable in-process or
            # via /internal/offers/confirm-make. Its absence is the point.
            not_expected = {"confirm_make_offer"}
            present_names = {t.name for t in tools}
            missing = expected - present_names
            leaked = not_expected & present_names
            ok = not missing and not leaked
            print("[PASS]" if ok else "[FAIL]",
                  f"all {len(expected)} expected tools present, confirm_make_offer correctly absent" if ok
                  else f"missing: {missing}, unexpectedly present: {leaked}")

            print()
            print("[call verify_gstin] pure format+checksum, no external call")
            result = await session.call_tool("verify_gstin", {"gstin": "27AAPFU0939F1ZV"})
            print(" ->", result.content[0].text if result.content else result)

            print()
            print(f"[call get_buyer_profile] buyer_id={buyer_id}")
            result = await session.call_tool("get_buyer_profile", {"buyer_id": buyer_id})
            print(" ->", result.content[0].text if result.content else result)

    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--buyer-id", required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8000/mcp/buyer/mcp")
    args = parser.parse_args()
    return asyncio.run(run(args.url, args.buyer_id))


if __name__ == "__main__":
    raise SystemExit(main())
