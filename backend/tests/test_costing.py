"""Unit tests for backend.costing.derive_cost (pure, no DB)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.costing import derive_cost
from backend.models import LogEntry, Model


def make_model(**overrides) -> Model:
    defaults: dict = {
        "id": 1,
        "name": "gpt-4o-mini",
        "input_price_per_mtok": 0.15,
        "output_price_per_mtok": 0.60,
    }
    defaults.update(overrides)
    return Model(**defaults)


def make_entry(**overrides) -> LogEntry:
    defaults: dict = {
        "id": 1,
        "model_id": 1,
        "input_tokens": 1_000_000,
        "output_tokens": 100_000,
    }
    defaults.update(overrides)
    return LogEntry(**defaults)


class TestExplicitCostWins:
    def test_explicit_cost_used_even_if_prices_present(self):
        entry = make_entry(cost_usd=0.02)
        assert derive_cost(entry, make_model()) == 0.02

    def test_explicit_cost_used_without_any_model(self):
        entry = make_entry(cost_usd=0.02)
        assert derive_cost(entry, None) == 0.02

    def test_zero_cost_is_respected_not_treated_as_missing(self):
        entry = make_entry(cost_usd=0.0)
        assert derive_cost(entry, make_model()) == 0.0


class TestDerivedCost:
    def test_derived_from_token_counts_and_prices(self):
        # 1M input * $0.15/MTok + 0.1M output * $0.60/MTok = 0.15 + 0.06
        entry = make_entry()
        assert derive_cost(entry, make_model()) == 0.21

    def test_zero_tokens_yield_zero_cost(self):
        entry = make_entry(input_tokens=0, output_tokens=0)
        assert derive_cost(entry, make_model()) == 0.0

    def test_fractional_result_rounded_clean(self):
        entry = make_entry(input_tokens=333_333, output_tokens=77_777)
        cost = derive_cost(entry, make_model())
        expected = round(333_333 / 1e6 * 0.15 + 77_777 / 1e6 * 0.60, 10)
        assert cost == expected


class TestUnknownCost:
    def test_no_model_returns_none(self):
        assert derive_cost(make_entry(), None) is None

    def test_missing_input_price_returns_none(self):
        model = make_model(input_price_per_mtok=None)
        assert derive_cost(make_entry(), model) is None

    def test_missing_output_price_returns_none(self):
        model = make_model(output_price_per_mtok=None)
        assert derive_cost(make_entry(), model) is None

    def test_missing_input_tokens_returns_none(self):
        entry = make_entry(input_tokens=None)
        assert derive_cost(entry, make_model()) is None

    def test_missing_output_tokens_returns_none(self):
        entry = make_entry(output_tokens=None)
        assert derive_cost(entry, make_model()) is None

    def test_unpriced_model_with_tokens_returns_none_not_zero(self):
        model = make_model(input_price_per_mtok=None, output_price_per_mtok=None)
        assert derive_cost(make_entry(), model) is None
