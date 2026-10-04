"""Qatar OM-A Chapter 7 FDP tables, pinned cell by cell (core/qatar_ftl.py)."""
import pytest

from core.qatar_ftl import basic_max_fdp, extension_max_fdp


def m(h, mm=0):
    return h * 60 + mm


@pytest.mark.parametrize('start,sectors,limit', [
    (m(6), 1, 13.0), (m(13, 29), 2, 13.0), (m(6), 10, 9.0), (m(6), 3, 12.5),
    (m(13, 30), 1, 12.75), (m(14), 4, 11.5), (m(16, 30), 2, 11.25), (m(16, 59), 6, 9.25),
    (m(17), 1, 11.0), (m(23), 5, 9.5), (m(4, 59), 2, 11.0),
    (m(5), 2, 12.0), (m(5, 15), 3, 11.75), (m(5, 30), 2, 12.5), (m(5, 45), 9, 9.25),
])
def test_table_7_6(start, sectors, limit):
    assert basic_max_fdp(start, sectors) == limit


@pytest.mark.parametrize('sectors,limit', [(1, 12.0), (2, 12.0), (3, 11.5), (5, 10.5), (8, 9.0), (9, 9.0)])
def test_table_7_7_unknown_acclimatisation_under_frm(sectors, limit):
    assert basic_max_fdp(m(3), sectors, unknown_acclimatisation=True) == limit


@pytest.mark.parametrize('start,sectors,limit', [
    (m(6), 1, None), (m(6, 14), 2, None), (m(6, 15), 1, 13.25), (m(6, 30), 4, 12.5),
    (m(6, 45), 5, 12.25), (m(7), 2, 14.0), (m(13, 29), 5, 12.5), (m(13, 30), 5, None),
    (m(15), 4, 12.0), (m(15, 30), 3, None), (m(15, 30), 2, 12.75), (m(18, 30), 1, 11.25),
    (m(18, 59), 2, 11.25), (m(19), 1, None), (m(2), 1, None), (m(5, 59), 1, None), (m(10), 6, None),
])
def test_table_7_8_planned_extension(start, sectors, limit):
    assert extension_max_fdp(start, sectors) == limit
