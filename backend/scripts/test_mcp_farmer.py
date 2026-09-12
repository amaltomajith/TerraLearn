"""
backend/scripts/test_mcp_farmer.py
------------------------------------
Exercises the Farmer MCP server as a real external caller would: via the
official `mcp` SDK's own streamable-HTTP client, against a running backend
(default http://127.0.0.1:8000/mcp/farmer/mcp) — not an in-process TestClient.
Per the spec's own §9 guidance: test each tool directly before wiring any
caller to it.

Usage (with the backend already running, e.g. `python run_backend.py`):
  python backend/scripts/test_mcp_farmer.py --farmer-id <uuid>
  python backend/scripts/test_mcp_farmer.py --farmer-id <uuid> --url http://127.0.0.1:8000/mcp/farmer/mcp
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


async def run(url: str, farmer_id: str) -> int:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    async with streamable_http_client(url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = (await session.list_tools()).tools
            print(f"[list_tools] {len(tools)} tools: {[t.name for t in tools]}")
            expected = {
                "get_farm_snapshot", "get_crop_advisory", "get_crop_calendar",
                "get_nearby_ifs_matches", "get_nearby_listings", "get_mandi_price",
                "get_my_tasks", "get_lot_status",
            }
            missing = expected - {t.name for t in tools}
            print("[PASS]" if not missing else "[FAIL]", "all 8 expected tools present" if not missing else f"missing: {missing}")

            print()
            print("[call get_mandi_price] (cheapest, no farmer-scoped RLS complexity)")
            result = await session.call_tool("get_mandi_price", {"crop_key": "rice"})
            print(" ->", result.content[0].text if result.content else result)

            print()
            print(f"[call get_nearby_ifs_matches] farmer_id={farmer_id}")
            result = await session.call_tool("get_nearby_ifs_matches", {"farmer_id": farmer_id})
            print(" ->", (result.content[0].text[:200] + "...") if result.content else result)

            print()
            print("[adversarial check] a DIFFERENT farmer_id should not see this farmer's owner-scoped rows")
            other_id = "00000000-0000-0000-0000-000000000000"
            result = await session.call_tool("get_my_tasks", {"farmer_id": other_id})
            print(" -> get_my_tasks(other_id) =", result.content[0].text if result.content else result)
            result2 = await session.call_tool("get_my_tasks", {"farmer_id": farmer_id})
            print(" -> get_my_tasks(farmer_id) =", result2.content[0].text if result2.content else result2)

    return 0 if not missing else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--farmer-id", required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8000/mcp/farmer/mcp")
    args = parser.parse_args()
    return asyncio.run(run(args.url, args.farmer_id))


if __name__ == "__main__":
    raise SystemExit(main())
