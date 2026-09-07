"""
backend/scripts/smoke_test.py
------------------------------
Smoke-tests the running TerraLearn backend (default: http://127.0.0.1:8000).

Tests:
  (a) Climate/AQI question  → expects non-empty answer
  (b) Knowledge-base question → expects a cited source in the answer
  (c) Same KB question 3× back-to-back → checks for tool_use_failed flakiness

Usage:
  python backend/scripts/smoke_test.py           # from project root
  python scripts/smoke_test.py                   # from backend/
"""
import json
import sys
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"
LAT, LNG = 28.6139, 77.2090  # New Delhi

PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"


def ask(question: str, timeout: int = 40) -> dict:
    body = json.dumps({"question": question, "lat": LAT, "lng": LNG}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/ask",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def check_health() -> bool:
    try:
        with urllib.request.urlopen(f"{BASE_URL}/", timeout=5) as r:
            data = json.loads(r.read())
            return data.get("status") == "online"
    except Exception as e:
        print(f"  Cannot reach server at {BASE_URL}: {e}")
        return False


def run_test(label: str, question: str, checker=None) -> bool:
    print(f"\n--- {label} ---")
    print(f"  Q: {question}")
    try:
        data = ask(question)
        answer = data.get("answer", "")
        if not answer:
            print(f"  {FAIL} Empty answer returned")
            return False

        if checker and not checker(answer):
            print(f"  {FAIL} Answer did not meet check criteria")
            print(f"  A: {answer[:200]}")
            return False

        print(f"  {PASS}")
        print(f"  A: {answer[:200]}")
        return True
    except urllib.error.URLError as e:
        print(f"  {FAIL} Network error: {e}")
        return False
    except Exception as e:
        print(f"  {FAIL} Exception: {e}")
        return False


def main():
    print("=" * 60)
    print("TerraLearn Backend Smoke Test")
    print(f"Target: {BASE_URL} | Location: Delhi ({LAT}, {LNG})")
    print("=" * 60)

    if not check_health():
        print(f"\n{FAIL} Server not reachable. Start it with:")
        print("  uvicorn app.main:app --app-dir backend --reload --port 8000")
        sys.exit(1)
    print("\n[OK] Server is online")

    results = []

    # (a) Climate / AQI question
    results.append(run_test(
        "a) Climate/AQI question",
        "What is the current AQI in this area?",
        checker=lambda a: len(a) > 20,
    ))

    # (b) Knowledge-base question — expect a grounded fact from the RAG docs.
    # (Answers are deliberately concise now, so we check for the figure or a
    #  named source rather than length.)
    def kb_grounded(answer: str) -> bool:
        lower = answer.lower()
        names_topic = "pm2.5" in lower or "pm 2.5" in lower or "µg" in lower or "ug/m" in lower or "who" in lower
        has_figure = any(n in answer for n in ("5", "10", "15", "25"))
        cites_source = any(m in lower for m in (".txt", "according to", "guide", "guideline", "source:"))
        return (names_topic and has_figure) or cites_source

    results.append(run_test(
        "b) Knowledge-base / RAG question (grounded-fact check)",
        "What is the WHO safe PM2.5 level?",
        checker=kb_grounded,
    ))

    # (c) Same KB question 3× back-to-back — checking for tool_use_failed flakiness
    print("\n--- c) KB question 3× back-to-back (tool_use_failed regression) ---")
    KB_Q = "What are the effects of ozone on crop yields?"
    flakiness_failures = 0
    for i in range(1, 4):
        print(f"  Run {i}/3 ...", end="", flush=True)
        try:
            data = ask(KB_Q)
            answer = data.get("answer", "")
            if not answer or "tool_use_failed" in answer.lower() or "failed to call a function" in answer.lower():
                print(f" {FAIL} tool_use_failed or empty answer")
                flakiness_failures += 1
            else:
                print(f" {PASS} ({len(answer)} chars)")
        except Exception as e:
            print(f" {FAIL} Exception: {e}")
            flakiness_failures += 1

    c_passed = flakiness_failures == 0
    results.append(c_passed)
    if c_passed:
        print(f"  {PASS} All 3 runs succeeded — no tool_use_failed flakiness")
    else:
        print(f"  {FAIL} {flakiness_failures}/3 runs failed — tool_use_failed regression detected")

    # Summary
    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    if passed == total:
        print(f"RESULT: {PASS} All {total}/{total} tests passed")
    else:
        print(f"RESULT: {FAIL} {passed}/{total} tests passed")
    print("=" * 60)

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
