"""Cost derivation for log entries.

A LogEntry's spend is its explicit cost_usd when the user logged one;
otherwise, if the model has per-million-token prices configured and the
entry recorded token counts, cost is derived from those. Otherwise it is
unknown (None) — never guessed.
"""
from backend.models import LogEntry, Model


def derive_cost(entry: LogEntry, model: Model | None) -> float | None:
    """Return the entry's USD cost: explicit > derived > None.

    Explicit always wins, even if it disagrees with token math — the user may
    have copied a price from a provider invoice that includes cache discounts
    we cannot model here. Derivation requires BOTH price fields AND both token
    counts; a missing piece means unknown rather than a partial estimate.
    """
    if entry.cost_usd is not None:
        return entry.cost_usd

    if model is None:
        return None
    if model.input_price_per_mtok is None or model.output_price_per_mtok is None:
        return None
    if entry.input_tokens is None or entry.output_tokens is None:
        return None

    cost = (
        entry.input_tokens / 1_000_000 * model.input_price_per_mtok
        + entry.output_tokens / 1_000_000 * model.output_price_per_mtok
    )
    # Guard against float dust from the mtok division (e.g. 1e-17).
    return round(cost, 10)
