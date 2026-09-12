"""
backend/scripts/ivr_harness.py
--------------------------------
Exercises the IVR tier/guard/escalation logic directly (no phone, no HTTP
server needed — imports app.ivr.runner in-process). Run from backend/ or the
project root; both work since it inserts backend/ onto sys.path itself.

Usage:
  python backend/scripts/ivr_harness.py --farmer-id <uuid> --keypress 4
  python backend/scripts/ivr_harness.py --farmer-id <uuid> --keypress 4 --inject-wrong-number
  python backend/scripts/ivr_harness.py --farmer-id <uuid> --keypress "*"      # Tier-3 escalation
  python backend/scripts/ivr_harness.py --farmer-id <uuid> --keypress 0       # unmapped -> Tier-3

--inject-wrong-number deliberately corrupts the Tier-1 composed text (splices
in a number that does not appear in the tool's data) to prove the guard
catches it and falls through to Tier 2 — the one behavior worth testing
hardest per the spec (§6).
"""
import sys
import argparse
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend_dir))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Exercise the IVR tier/guard/escalation logic directly.")
    parser.add_argument("--farmer-id", required=True)
    parser.add_argument("--keypress", required=True, help="1-7 for a tool, '*' for escalation, anything else for unmapped/Tier-3")
    parser.add_argument("--language", default="kn")
    parser.add_argument("--inject-wrong-number", action="store_true",
                         help="Corrupt the Tier-1 composed text with a fabricated number, to prove the guard rejects it.")
    args = parser.parse_args()

    import app.ssl_patch  # noqa: F401
    from app.ivr import runner as runner_mod
    from app.ivr import escalation as escalation_mod

    escalations_written = []
    original_escalate = escalation_mod.escalate

    def _spy_escalate(farmer_id, reason, tool_name, raw_query):
        escalations_written.append({"farmer_id": farmer_id, "reason": reason, "tool_name": tool_name})
        return original_escalate(farmer_id, reason, tool_name, raw_query)

    runner_mod.escalate = _spy_escalate

    if args.inject_wrong_number:
        from app.ivr.templates import render_tier2
        original_compose = runner_mod.compose_reply

        def _corrupted_compose(tool_name, tool_result, language="kn"):
            # Falls back to the Tier-2 template's own text as a stand-in
            # "Tier-1 answer" when no live Groq key is configured (compose_reply
            # would otherwise return None and skip the guard entirely, making
            # this test pass without ever exercising it). Either way, splice in
            # a number that cannot appear in the tool's real data.
            real = original_compose(tool_name, tool_result, language=language) or render_tier2(tool_name, tool_result)
            return real + " Exactly 8675309 units, guaranteed."

        runner_mod.compose_reply = _corrupted_compose

    result = runner_mod.handle_ivr_turn(args.farmer_id, args.keypress, language=args.language)

    print(f"tier: {result.tier}")
    print(f"tool: {result.tool_name}")
    print(f"text: {result.text}")
    if result.guard_unmatched:
        print(f"guard_unmatched: {result.guard_unmatched}")
    print(f"escalations_written: {escalations_written}")

    if args.inject_wrong_number:
        ok = result.tier == "tier2" and not escalations_written
        print()
        print("[PASS]" if ok else "[FAIL]",
              "guard caught the injected number and fell through to Tier 2 without escalating"
              if ok else "expected tier2 + no escalation, got tier=%s escalations=%s" % (result.tier, escalations_written))
        return 0 if ok else 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
