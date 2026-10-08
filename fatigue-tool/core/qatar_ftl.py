"""Configured operator FTL scheme, OM-A Chapter 7 (owner-supplied; current approval unverified), flight duty period tables.

Values are transcribed from the operator's OM-A Chapter 7 supplied by the owner (October
2026); the manual itself is not stored in the repository. Times are hours; start times
are minutes after midnight at the reference time (7.6.1).

* 7.6.3 Table 7-6  Maximum daily FDP, acclimatised crew members
* 7.6.3 Table 7-7  Unknown state of acclimatisation, under the supplied operator FRM scheme
* 7.6.5 Table 7-8  Maximum daily FDP with extension without in-flight rest
  (planned in advance, at most twice in any 7 consecutive days, not with in-flight rest)
* 7.6.6 Tables 7-9 / 7-10  in-flight rest: AugmentedFDPParameters (extended_operations)
* 7.7.1.2 Commander's discretion: +2 h, +3 h with an augmented crew, from the basic
  maximum (Table 7-6) even when a 7.6.5 extension was planned.
"""
from __future__ import annotations

from typing import Optional

MIN_FDP_HOURS = 9.0  # lowest cell of Tables 7-6 / 7-7

# Table 7-6, 1–2 sectors, by start of FDP at reference time; every further sector
# takes 30 minutes off, down to 09:00 (columns 3 … 10 sectors of the table).
_TABLE_7_6 = [  # (from_minute, to_minute exclusive, 1–2 sectors)
    (6 * 60, 13 * 60 + 30, 13.0),
    (13 * 60 + 30, 14 * 60, 12.75),
    (14 * 60, 14 * 60 + 30, 12.5),
    (14 * 60 + 30, 15 * 60, 12.25),
    (15 * 60, 15 * 60 + 30, 12.0),
    (15 * 60 + 30, 16 * 60, 11.75),
    (16 * 60, 16 * 60 + 30, 11.5),
    (16 * 60 + 30, 17 * 60, 11.25),
    (5 * 60, 5 * 60 + 15, 12.0),
    (5 * 60 + 15, 5 * 60 + 30, 12.25),
    (5 * 60 + 30, 5 * 60 + 45, 12.5),
    (5 * 60 + 45, 6 * 60, 12.75),
]  # 17:00–04:59: 11:00

# Table 7-7 (FRM): 1–2 sectors 12:00, then 30 minutes less per sector to 09:00 at 8.
_TABLE_7_7_ONE_TWO = 12.0

# Table 7-8: (from_minute, to_minute exclusive) -> limits for 1–2, 3, 4, 5 sectors
# (None = "Not allowed"). Rows not listed (19:00–06:14) are not allowed at all.
_TABLE_7_8 = [
    (6 * 60 + 15, 6 * 60 + 30, (13.25, 12.75, 12.25, 11.75)),
    (6 * 60 + 30, 6 * 60 + 45, (13.5, 13.0, 12.5, 12.0)),
    (6 * 60 + 45, 7 * 60, (13.75, 13.25, 12.75, 12.25)),
    (7 * 60, 13 * 60 + 30, (14.0, 13.5, 13.0, 12.5)),
    (13 * 60 + 30, 14 * 60, (13.75, 13.25, 12.75, None)),
    (14 * 60, 14 * 60 + 30, (13.5, 13.0, 12.5, None)),
    (14 * 60 + 30, 15 * 60, (13.25, 12.75, 12.25, None)),
    (15 * 60, 15 * 60 + 30, (13.0, 12.5, 12.0, None)),
    (15 * 60 + 30, 16 * 60, (12.75, None, None, None)),
    (16 * 60, 16 * 60 + 30, (12.5, None, None, None)),
    (16 * 60 + 30, 17 * 60, (12.25, None, None, None)),
    (17 * 60, 17 * 60 + 30, (12.0, None, None, None)),
    (17 * 60 + 30, 18 * 60, (11.75, None, None, None)),
    (18 * 60, 18 * 60 + 30, (11.5, None, None, None)),
    (18 * 60 + 30, 19 * 60, (11.25, None, None, None)),
]

DISCRETION_HOURS = 2.0            # 7.7.1.2(2)
DISCRETION_AUGMENTED_HOURS = 3.0  # 7.7.1.2(2), augmented flight crew
EXTENSIONS_PER_7_DAYS = 2         # 7.6.5(1)


def basic_max_fdp(start_minute: int, sectors: int, unknown_acclimatisation: bool = False) -> float:
    """7.6.3: Table 7-6 at reference time, or Table 7-7 in an unknown state (FRM)."""
    if unknown_acclimatisation:
        one_two = _TABLE_7_7_ONE_TWO
    else:
        one_two = next((v for lo, hi, v in _TABLE_7_6 if lo <= start_minute % 1440 < hi), 11.0)
    return max(MIN_FDP_HOURS, one_two - 0.5 * max(0, sectors - 2))


def extension_max_fdp(start_minute: int, sectors: int) -> Optional[float]:
    """7.6.5 Table 7-8: maximum FDP with a planned extension, or None when not allowed
    (start time, more than 5 sectors). Acclimatised crew members only."""
    if sectors < 1 or sectors > 5:
        return None
    row = next((v for lo, hi, v in _TABLE_7_8 if lo <= start_minute % 1440 < hi), None)
    if row is None:
        return None
    return row[0 if sectors <= 2 else sectors - 2]
