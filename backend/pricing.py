"""Measured per-model token rates (USD per million tokens).

Why this module exists
----------------------
Hermes stores `estimated_cost_usd`, priced from the provider catalog's headline
rates. When a model is served through a cheaper pinned route, that estimate
overstates the bill — on this install the pinned deepseek route bills roughly
$0.10/$0.60 per M while the catalog says $0.30/$1.20.

A measured rate wins over the stored estimate; anything without a measured rate
keeps the estimate, and the UI labels those figures as estimated.

Adding a rate
-------------
Only add rates that were measured against a real invoice or a provider's usage
API for this install, and note where the number came from. Do not guess from
another user's pricing page.
"""

from __future__ import annotations

MEASURED_RATES: dict[str, dict[str, float]] = {
    # Cloudflare-served pinned route (measured 2026-10-20).
    "deepseek/deepseek-v4.1-flash-1017": {
        "input": 0.10,
        "output": 0.60,
        "cache_read": 0.003,
        "cache_write": 0.0,
    },
    # Same model family on the same pinned route; the un-pinned slug bills the
    # same per the audit's measurement.
    "deepseek/deepseek-v4.1-flash": {
        "input": 0.10,
        "output": 0.60,
        "cache_read": 0.003,
        "cache_write": 0.0,
    },
}

# DeepInfra-served variant of the same model, kept for reference so a future
# calibration can switch routes without editing code.
DEEPINFRA_RATES: dict[str, float] = {
    "input": 0.0784,
    "output": 0.2352,
    "cache_read": 0.002352,
}


def measured_cost(
    slug: str | None,
    *,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    cache_read_tokens: int | None = None,
    cache_write_tokens: int | None = None,
) -> float | None:
    """Cost from measured rates, or None when the model has no measured rate."""
    rates = MEASURED_RATES.get((slug or "").strip().lower())
    if rates is None:
        return None
    total = (
        (input_tokens or 0) * rates["input"]
        + (output_tokens or 0) * rates["output"]
        + (cache_read_tokens or 0) * rates["cache_read"]
        + (cache_write_tokens or 0) * rates["cache_write"]
    )
    return round(total / 1_000_000, 6)


def has_measured_rate(slug: str | None) -> bool:
    return (slug or "").strip().lower() in MEASURED_RATES
