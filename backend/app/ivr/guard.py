"""
The programmatic guard (Puppeteer MCP spec §6) — cheap, deterministic, NOT a
second LLM call (a second model critiquing the first is exactly the latency
risk the whole cascade design is built to avoid; see spec §8). Every number in
the Tier-1 composed answer is checked against the tool's own returned data.

Documented limitation, not an oversight: this checks "does this number appear
somewhere in the tool's raw output," not "is it attached to the right field."
A composer that states the trailing average as if it were the latest price
would pass undetected — a positional/semantic check would need the composer to
tag each number with the JSON key it came from, which is real complexity this
pass doesn't build. Fails closed: any unmatched number means the guard fails
and the caller must drop to Tier-2, never surface unverified text on a call a
farmer can't double-check against a screen.
"""
import re
from dataclasses import dataclass, field

_NUMBER_RE = re.compile(r"[-+]?\d[\d,]*\.?\d*")


@dataclass
class GuardResult:
    ok: bool
    checked: list[float] = field(default_factory=list)
    unmatched: list[float] = field(default_factory=list)


def _normalize(raw: str) -> float | None:
    cleaned = raw.replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _extract_numbers(text: str) -> list[float]:
    out = []
    for m in _NUMBER_RE.finditer(text):
        v = _normalize(m.group())
        if v is not None:
            out.append(v)
    return out


def _collect_reference_numbers(data) -> list[float]:
    """Recursively walk a dict/list, collecting every numeric leaf value."""
    out: list[float] = []
    if isinstance(data, bool):
        return out  # bool is a subclass of int in Python — never treat as a number
    if isinstance(data, (int, float)):
        out.append(float(data))
    elif isinstance(data, dict):
        for v in data.values():
            out.extend(_collect_reference_numbers(v))
    elif isinstance(data, (list, tuple)):
        for v in data:
            out.extend(_collect_reference_numbers(v))
    elif isinstance(data, str):
        # A tool's own JSON sometimes carries a number as a string (e.g. a date
        # component) — extracting from strings too is deliberately permissive,
        # since the guard's job is "was this number fabricated," not strict typing.
        out.extend(_extract_numbers(data))
    return out


def _matches_any(value: float, references: list[float], tolerance_pct: float, tolerance_abs: float) -> bool:
    for ref in references:
        if abs(value - ref) <= tolerance_abs:
            return True
        if ref != 0 and abs(value - ref) / abs(ref) * 100 <= tolerance_pct:
            return True
    return False


def check_numbers(
    composed_text: str,
    tool_result: dict,
    tolerance_pct: float = 1.0,
    tolerance_abs: float = 0.5,
) -> GuardResult:
    extracted = _extract_numbers(composed_text)
    references = _collect_reference_numbers(tool_result)

    unmatched = [v for v in extracted if not _matches_any(v, references, tolerance_pct, tolerance_abs)]
    return GuardResult(ok=not unmatched, checked=extracted, unmatched=unmatched)
