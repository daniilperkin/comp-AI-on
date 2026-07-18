"""Tests for scheduler helpers — parse_time and tz logic."""
from backend.scheduler import parse_time


def test_parse_time_valid():
    assert parse_time("18:00") == (18, 0)
    assert parse_time("09:30") == (9, 30)
    assert parse_time("23:59") == (23, 59)
    assert parse_time("00:00") == (0, 0)


def test_parse_time_invalid_format():
    assert parse_time("invalid") == (18, 0)
    assert parse_time("6pm") == (18, 0)
    assert parse_time("") == (18, 0)


def test_parse_time_with_spaces():
    assert parse_time("  18:00  ") == (18, 0)
    assert parse_time(" 09:30 ") == (9, 30)
