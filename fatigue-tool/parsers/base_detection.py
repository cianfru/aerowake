"""Home-base detection and resolution for roster uploads.

The home base decides how home-base times are read, where post-duty sleep is
taken (home or hotel), acclimatisation and the ORO.FTL.235 rest minimum at
home base. It is never assumed. It comes from, in order of authority:

1. the roster header (CrewLink ``(DOH CP-A320)``, easyJet ``AGP,CP,319``);
2. a base the pilot enters, or an explicit override of the header;
3. a duty pattern (CSV only) that the pilot must confirm.

Nothing here reads or returns the pilot's name or staff number.
"""
from collections import Counter
from dataclasses import dataclass
from typing import Optional, Tuple

ROSTER_HEADER = 'roster_header'
DUTY_PATTERN = 'duty_pattern'
ENTERED = 'entered'

# Share of duty start and end airports that must match before a CSV base is
# proposed. The pilot still confirms it; below this share they enter it.
CSV_BASE_SHARE = 0.6

SUPPORTED_FORMATS = ('Aerowake reads Qatar Airways CrewLink and easyJet roster PDFs, '
                     'and CSV files in the Aerowake template format.')


class RosterIntakeError(ValueError):
    """A roster that cannot be analysed as uploaded, with a stable code for clients."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code


def home_base_required() -> RosterIntakeError:
    return RosterIntakeError(
        'This roster does not state a home base. Enter the airport you are based at (3-letter IATA code).',
        'home_base_required')


def no_duties_found() -> RosterIntakeError:
    return RosterIntakeError(f"We couldn't find any duties in this file. {SUPPORTED_FORMATS}", 'no_duties')


def normalise_code(value) -> Optional[str]:
    """Upper-case IATA code, or None for an empty value."""
    if value is None:
        return None
    code = str(value).strip().upper()
    return code or None


def airport_known(code: Optional[str]) -> bool:
    from parsers.validation import known_airport
    if not code:
        return False
    try:
        known_airport(code)
    except ValueError:
        return False
    return True


def require_airport(code: str) -> str:
    """Validate an entered base; the message names the field the pilot typed."""
    from parsers.roster_parser import AirportDatabase, _IATA_DB
    if len(code) != 3 or not code.isalpha():
        raise RosterIntakeError('Enter the home base as a 3-letter IATA airport code, for example DOH.', 'invalid_home_base')
    if code not in _IATA_DB and code not in AirportDatabase._custom_airports:
        raise RosterIntakeError(f'{code} is not a known airport code. Check the home base.', 'unknown_airport')
    return code


def duty_endpoints(frame) -> list:
    """First departure and last arrival of each CSV duty (consecutive Date/Report rows)."""
    endpoints = []
    key = None
    first = last = None
    for _, row in frame.iterrows():
        row_key = (row['Date'], row['Report'])
        if row_key != key:
            if key is not None:
                endpoints += [first, last]
            key, first = row_key, normalise_code(row['Departure'])
        last = normalise_code(row['Arrival'])
    if key is not None:
        endpoints += [first, last]
    return [code for code in endpoints if code]


def infer_csv_base(frame) -> Optional[Tuple[str, float]]:
    """Propose a base when one known airport covers at least 60% of duty starts and ends.

    Sector times in the CSV are airport-local, so this needs no base. Returns
    ``(code, share)`` or None when no airport is dominant enough.
    """
    endpoints = duty_endpoints(frame)
    if not endpoints:
        return None
    counts = Counter(endpoints).most_common(2)
    code, hits = counts[0]
    if len(counts) > 1 and counts[1][1] == hits:
        return None  # a tie is not a pattern
    share = hits / len(endpoints)
    if share >= CSV_BASE_SHARE and airport_known(code):
        return code, share
    return None


@dataclass(frozen=True)
class BaseResolution:
    """The base used for analysis and how it was chosen."""

    base: str
    source: str                      # roster_header | duty_pattern | entered
    detected: Optional[str] = None   # what the roster itself indicates
    detected_source: Optional[str] = None
    entered: Optional[str] = None
    override: bool = False           # pilot replaced the header base on purpose
    conflict: bool = False           # entered and detected bases differ


def resolve_base(entered=None, detected=None, detected_source=None, override=False) -> BaseResolution:
    """Choose the analysis base. Header wins unless the pilot explicitly overrides it.

    A duty-pattern (CSV) proposal never beats a base the pilot typed, but the
    difference is reported. Raises ``home_base_required`` when nothing is known.
    """
    entered = normalise_code(entered)
    detected = normalise_code(detected)
    if entered:
        require_airport(entered)
    if detected and entered and detected != entered:
        if detected_source == ROSTER_HEADER and not override:
            return BaseResolution(detected, ROSTER_HEADER, detected, detected_source, entered, False, True)
        return BaseResolution(entered, ENTERED, detected, detected_source, entered,
                              detected_source == ROSTER_HEADER, True)
    if detected and entered:
        # Agreement: the header stays the stronger source; a typed base confirms a pattern.
        source = ROSTER_HEADER if detected_source == ROSTER_HEADER else ENTERED
        return BaseResolution(detected, source, detected, detected_source, entered)
    if detected:
        return BaseResolution(detected, detected_source or ROSTER_HEADER, detected, detected_source)
    if entered:
        return BaseResolution(entered, ENTERED, None, None, entered)
    raise home_base_required()
