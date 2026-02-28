# easyjet_parser.py - easyJet "Personal Crew Schedule" PDF Parser
"""
easyJet Roster Parser

Parses easyJet "Personal Crew Schedule" PDFs exported from easyJet's
crew management system.

Format characteristics (from real PDF analysis):
  - Calendar grid layout: row 0 = pilot info, row 1 = DD/MM date headers,
    row 2 = ALL duty data per date in ONE multi-line cell
  - "All times in Local Station" (each airport's local timezone)
  - Flight numbers prefixed with EJU (easyJet Europe IATA code)
  - Also bare numeric flight numbers (e.g. "8072" for positioning)
  - Aircraft types in brackets: [319], [320]
  - Overnight arrival marked with ↓ arrow (U+2193)
  - Cross-column overnight: → in col N (departure), ↓ in col N+1 (arrival)
  - Segment token order: FLIGHT → STD → DEP → ARR → STA → [AIRCRAFT]
  - Airport codes sometimes prefixed with * (e.g. *AGP, *LGW)
  - M (memo) markers and Delay tokens scattered in cells
  - Multi-duty columns: OFC4 + flight in same cell
  - Non-duty codes: D/O (day off), LVE (leave), PSBL (standby)
  - Office duty codes: OFC4, OFC8 (real duty — ground training)
  - Pilot header: "<ID> <FULL NAME> <BASE>,<ROLE>,<AIRCRAFT>"
  - Zero-width spaces (U+200B) throughout extracted text
  - Time tokens may be prefixed with 'A' (actual time)

Returns the same dict structure as CrewLinkRosterParser for drop-in compatibility
with PDFRosterParser routing.
"""

import re
import pdfplumber
import airportsdata
import pytz

from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Tuple

from models.data_models import (
    Airport, FlightSegment, Duty, DutyType
)

# ── Module-level airport DB (cached, ~7,800 IATA airports) ──────────────────
_IATA_DB = airportsdata.load('IATA')

# ── Constants ────────────────────────────────────────────────────────────────

# easyJet non-duty activity codes → skip (return None from column parser)
_NON_DUTY_CODES = {'D/O', 'LVE', 'PSBL', 'OFF', 'REST', 'DO'}

# Office/ground duty codes → create a ground-training Duty with start/end times
_OFFICE_CODES = {'OFC4', 'OFC8'}

# Tokens to ignore completely when scanning duty cells
_SKIP_TOKENS = {'M', 'Delay', 'F', 'D', ''}

# Primary flight number pattern for easyJet (EJU + 4 digits)
_FLIGHT_NUM_RE = re.compile(r'^EJU\d{4}$')
# Broad fallback: bare numeric flight number (e.g. 8072, 073 for positioning)
_FLIGHT_NUM_BROAD_RE = re.compile(r'^\d{3,5}$')
# IATA airport code (with optional * prefix stripped before matching)
_AIRPORT_RE = re.compile(r'^[A-Z]{3}$')
# Time: optional A prefix (actual), then HH:MM
_TIME_RE = re.compile(r'^A?(\d{2}:\d{2})$')
# Aircraft in easyJet format: [319], [320], [321]
_AIRCRAFT_RE = re.compile(r'^\[(\d{3})\]$')
# Date header in grid: DD/MM (possibly followed by newline + day name)
_DATE_HEADER_RE = re.compile(r'^(\d{2})/(\d{2})')
# Pilot header line: "17715 PELATTI ANGEL AGP,CP,319" (anchored to start of line)
_PILOT_HEADER_RE = re.compile(
    r'^(\d{4,6})\s+([A-Z][A-Za-z\s]+?)\s+([A-Z]{3}),\s*([A-Z]{2}),\s*(\d{2,3})',
    re.MULTILINE
)
# Period line: "01/09/2025 - 30/09/2025"
_PERIOD_RE = re.compile(r'(\d{2})/(\d{2})/(\d{4})\s*[-–]\s*\d{2}/\d{2}/\d{4}')
# Overnight arrow (U+2193 = ↓)
_OVERNIGHT_ARROW = '↓'
# Continuation arrow (→ = U+2192) — duty continues into next column
_CONTINUATION_ARROW = '→'


# ── Helpers ──────────────────────────────────────────────────────────────────

def _clean(s: Optional[str]) -> str:
    """Strip zero-width spaces and whitespace. Returns '' for None."""
    if s is None:
        return ''
    return s.replace('\u200b', '').replace('\u200c', '').strip()


def _clean_airport(code: str) -> str:
    """Strip * prefix from airport codes (e.g. *AGP → AGP)."""
    code = _clean(code)
    if code.startswith('*'):
        code = code[1:]
    return code.upper()


def _get_airport(code: str) -> Airport:
    """Look up airport from IATA DB; fall back to UTC placeholder."""
    code = _clean_airport(code)
    entry = _IATA_DB.get(code)
    if entry:
        return Airport(
            code=entry['iata'],
            timezone=entry['tz'],
            latitude=entry['lat'],
            longitude=entry['lon']
        )
    print(f"   ⚠️  Airport '{code}' not found in airportsdata — using UTC")
    return Airport(code=code, timezone='UTC', latitude=0.0, longitude=0.0)


def _parse_time_str(raw: str) -> Optional[str]:
    """
    Extract HH:MM from a raw token. Strips leading 'A' (actual time marker).
    Returns None if not a valid time token.
    """
    m = _TIME_RE.match(_clean(raw))
    return m.group(1) if m else None


def _is_flight_number(tok: str) -> bool:
    """Check if a token is a flight number (EJU#### or bare ####)."""
    return bool(_FLIGHT_NUM_RE.match(tok) or _FLIGHT_NUM_BROAD_RE.match(tok))


def _localize_to_utc(time_str: str, col_date: datetime, airport_tz: str, day_offset: int = 0) -> datetime:
    """
    Convert a local time string (HH:MM) on a given date + optional day offset
    to UTC, using the airport's IANA timezone.
    """
    t = datetime.strptime(time_str, '%H:%M').time()
    naive = datetime.combine(col_date.date(), t) + timedelta(days=day_offset)
    tz = pytz.timezone(airport_tz)
    local = tz.localize(naive, is_dst=None)
    return local.astimezone(pytz.utc)


def _tokenize_cell(cell_text: str) -> List[str]:
    """
    Split a multi-line cell into cleaned, non-empty tokens.
    Filters out known skip tokens (M, Delay, F, D, empty).
    """
    if not cell_text:
        return []
    tokens = []
    for line in cell_text.split('\n'):
        cleaned = _clean(line)
        if not cleaned:
            continue
        if cleaned in _SKIP_TOKENS:
            continue
        tokens.append(cleaned)
    return tokens


# ── Main parser class ─────────────────────────────────────────────────────────

class EasyJetParser:
    """
    Parser for easyJet "Personal Crew Schedule" PDF rosters.

    Returns the same dict shape as CrewLinkRosterParser.parse_roster() so that
    PDFRosterParser can delegate to this class transparently.

    Usage:
        parser = EasyJetParser()
        result = parser.parse_roster('/path/to/roster.pdf')
        # result = {'pilot_info': {...}, 'duties': [...], 'unknown_airports': [...]}
    """

    def __init__(self):
        self.home_base_code: str = 'AGP'       # updated from PDF header
        self.home_timezone: str = 'Europe/Madrid'  # updated from PDF header
        self.unknown_airports: set = set()

    # ── Public entry point ────────────────────────────────────────────────

    def parse_roster(self, pdf_path: str) -> Dict:
        """
        Parse an easyJet PDF roster.

        Returns:
            {
                'pilot_info': {id, name, base, role, aircraft, year, month},
                'duties':     [Duty, ...],
                'unknown_airports': ['XXX', ...]
            }
        """
        print(f"   [easyJet] Opening PDF: {pdf_path}")

        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[0]
            raw_text = page.extract_text() or ''
            pilot_info = self._extract_pilot_info(raw_text)

            # Set instance state from extracted info
            self.home_base_code = pilot_info.get('base', 'AGP')
            base_airport = _get_airport(self.home_base_code)
            if base_airport.timezone != 'UTC':
                self.home_timezone = base_airport.timezone

            print(f"   [easyJet] Pilot: {pilot_info.get('name')} | Base: {self.home_base_code} | TZ: {self.home_timezone}")

            table = self._extract_schedule_table(page)

        year = pilot_info.get('year', datetime.now().year)
        month = pilot_info.get('month', datetime.now().month)
        duties = self._parse_grid_to_duties(table, year, month)
        print(f"   [easyJet] Parsed {len(duties)} duties")

        return {
            'pilot_info': pilot_info,
            'duties': duties,
            'unknown_airports': sorted(self.unknown_airports),
        }

    # ── Header extraction ─────────────────────────────────────────────────

    def _extract_pilot_info(self, raw_text: str) -> Dict:
        """
        Extract pilot metadata from the easyJet PDF header.

        Expected header format:
            17715 PELATTI ANGEL AGP,CP,319
            ...
            01/09/2025 - 30/09/2025 (All times in Local Station)
        """
        # Clean PDF artifacts (preserve newlines for multiline regex matching)
        text = re.sub(r'\(cid:\d+\)', ' ', raw_text)
        text = text.replace('\u200b', '').replace('\u200c', '')
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1F\x7F]', ' ', text)  # keep \n and \r

        info: Dict = {}

        # Pilot header: ID + NAME + BASE,ROLE,AIRCRAFT
        # Must be at start of a line (MULTILINE flag handles ^)
        m = _PILOT_HEADER_RE.search(text)
        if m:
            info['id'] = m.group(1).strip()
            info['name'] = m.group(2).strip()
            info['base'] = m.group(3).strip()
            info['role'] = m.group(4).strip()
            info['aircraft'] = m.group(5).strip()  # e.g. "319"
        else:
            print("   [easyJet] ⚠️  Could not extract pilot header line")
            info = {'id': 'UNKNOWN', 'name': 'UNKNOWN', 'base': 'AGP', 'role': 'CP', 'aircraft': '319'}

        # Period: extract year and month from start date
        pm = _PERIOD_RE.search(text)
        if pm:
            day = int(pm.group(1))
            month = int(pm.group(2))
            year = int(pm.group(3))
            info['year'] = year
            info['month'] = month   # integer, unlike CrewLink which uses 3-letter abbrev
        else:
            print("   [easyJet] ⚠️  Could not extract period; defaulting to current year/month")
            now = datetime.now()
            info['year'] = now.year
            info['month'] = now.month

        return info

    # ── Table extraction ──────────────────────────────────────────────────

    def _extract_schedule_table(self, page) -> List[List[Optional[str]]]:
        """
        Extract the monthly schedule grid from pdfplumber page.

        Tries line-based strategy first, falls back to text-based.
        Returns a List[List[str|None]] — a 2D table.

        Real table structure:
          Row 0: Pilot info header (e.g. "17715 PELATTI ANGEL AGP,CP,319")
          Row 1: Date headers ("01/09\nMon", "02/09\nTue", ...)
          Row 2: Duty data — one multi-line cell per date column
          Row 3: "F" (flight hours summary)
          Row 4: "D" (duty hours summary)
        """
        # Primary: line-based table detection
        table = page.extract_table({
            'vertical_strategy': 'lines',
            'horizontal_strategy': 'lines',
            'snap_tolerance': 5,
            'join_tolerance': 3,
            'edge_min_length': 10,
        })

        if table and len(table) >= 2:
            print(f"   [easyJet] Table extracted (lines strategy): {len(table)} rows × {len(table[0])} cols")
            return table

        # Fallback: text-based grouping
        print("   [easyJet] Lines strategy produced no table — trying text strategy")
        table = page.extract_table({
            'vertical_strategy': 'text',
            'horizontal_strategy': 'text',
            'snap_tolerance': 5,
            'join_tolerance': 3,
        })

        if table and len(table) >= 2:
            print(f"   [easyJet] Table extracted (text strategy): {len(table)} rows × {len(table[0])} cols")
            return table

        print("   [easyJet] ⚠️  Both table strategies failed — returning empty table")
        return []

    # ── Grid parsing ──────────────────────────────────────────────────────

    def _find_date_row(self, table: List[List[Optional[str]]]) -> int:
        """
        Find which row contains the DD/MM date headers.
        Searches all rows for the one with the most DD/MM matches.
        """
        best_row = -1
        best_count = 0
        for row_idx, row in enumerate(table):
            count = 0
            for cell in row:
                if cell is None:
                    continue
                first_line = _clean(cell.split('\n')[0]) if cell else ''
                if _DATE_HEADER_RE.match(first_line):
                    count += 1
            if count > best_count:
                best_count = count
                best_row = row_idx
        return best_row

    def _parse_grid_to_duties(self, table: List[List[Optional[str]]], year: int, month: int) -> List[Duty]:
        """
        Walk the calendar grid column by column, building Duty objects.

        The date headers are in a dynamically-detected row (usually row 1).
        All duty data for a date lives in a single multi-line cell in the
        row directly below the date header row.
        """
        if not table:
            return []

        # Find the row containing date headers
        date_row_idx = self._find_date_row(table)
        if date_row_idx < 0:
            print("   [easyJet] ⚠️  No date header row found in table")
            return []

        data_row_idx = date_row_idx + 1  # duty data is in the row below dates

        header_row = table[date_row_idx]
        date_columns: List[Dict] = []

        # Identify which column indices are date columns
        for col_idx, cell in enumerate(header_row):
            if cell is None:
                continue
            # Date cells can be "01/09\nMon" — take only first line
            first_line = _clean(cell.split('\n')[0])
            m = _DATE_HEADER_RE.match(first_line)
            if m:
                day = int(m.group(1))
                col_month = int(m.group(2))
                # Handle year rollover: if roster starts in Dec and bleeds into Jan
                col_year = year
                if col_month == 1 and date_columns and date_columns[-1]['date'].month == 12:
                    col_year = year + 1
                try:
                    col_date = datetime(col_year, col_month, day)
                    date_columns.append({'col_idx': col_idx, 'date': col_date})
                except ValueError:
                    pass  # Invalid date — skip

        print(f"   [easyJet] Found {len(date_columns)} date columns (date row: {date_row_idx}, data row: {data_row_idx})")

        duties: List[Duty] = []
        # Track cross-column overnight: col N has →, col N+1 starts with ↓
        pending_continuation: Optional[Dict] = None  # {'duty': Duty, 'last_arr': str}

        for dc_idx, dc in enumerate(date_columns):
            col_idx = dc['col_idx']
            col_date = dc['date']

            # Get the duty cell for this date from the data row
            if data_row_idx >= len(table):
                continue
            data_row = table[data_row_idx]
            if col_idx >= len(data_row):
                continue

            cell_text = data_row[col_idx]
            raw_tokens = _tokenize_cell(cell_text)

            if not raw_tokens:
                pending_continuation = None  # no continuation possible
                continue

            # Check for cross-column overnight continuation from previous column
            if raw_tokens[0] == _OVERNIGHT_ARROW and pending_continuation:
                # This column continues the previous duty (arrival + possibly more)
                continuation_duties = self._parse_continuation_column(
                    col_date, raw_tokens, pending_continuation
                )
                duties.extend(continuation_duties)
                pending_continuation = None
                continue

            # Parse this column into one or more duties
            column_duties, has_continuation = self._parse_column_to_duties(col_date, raw_tokens)

            for d in column_duties:
                if d is not None:
                    duties.append(d)

            # Check if last duty in this column ends with → (cross-column overnight)
            if has_continuation and duties:
                # Extract incomplete segment info from tokens after → removal
                # In col 17: ... EJU7054 A21:53 NCE → (flight_num, STD, DEP are before →)
                incomplete_seg = self._extract_incomplete_segment(raw_tokens)
                pending_continuation = {
                    'duty': duties[-1],
                    'col_date': col_date,
                    'incomplete_segment': incomplete_seg,
                }
            else:
                pending_continuation = None

        return duties

    # ── Column → Duties ───────────────────────────────────────────────────

    def _parse_column_to_duties(self, col_date: datetime, raw_tokens: List[str]) -> Tuple[List[Optional[Duty]], bool]:
        """
        Convert a list of column tokens for a single date into one or more Duty objects.

        Multi-duty columns (e.g. OFC4 + flight in same cell) return multiple duties.

        Returns:
            (duties_list, has_continuation) where has_continuation is True if
            the column ends with → (cross-column overnight to next day).
        """
        if not raw_tokens:
            return [], False

        # Check for → continuation marker
        has_continuation = _CONTINUATION_ARROW in raw_tokens
        # Remove → from tokens for parsing
        tokens_clean = [t for t in raw_tokens if t != _CONTINUATION_ARROW]

        if not tokens_clean:
            return [], has_continuation

        # Check first meaningful token for non-duty codes (skip entire column)
        first = tokens_clean[0].strip().upper()
        if first in _NON_DUTY_CODES:
            return [], False

        # Split multi-duty columns: find boundaries
        # A multi-duty column can have: OFC4 + times + flight_duty, or multiple flights
        duty_groups = self._split_duty_groups(tokens_clean)

        duties = []
        for group in duty_groups:
            if not group:
                continue
            first_tok = group[0].strip().upper()
            if first_tok in _NON_DUTY_CODES:
                continue
            if first_tok in _OFFICE_CODES:
                d = self._parse_office_duty(col_date, group, first_tok)
            else:
                d = self._parse_flight_duty(col_date, group)
            if d is not None:
                duties.append(d)

        return duties, has_continuation

    def _split_duty_groups(self, tokens: List[str]) -> List[List[str]]:
        """
        Split tokens into separate duty groups when a column contains
        multiple duties (e.g. OFC4 + flight in same cell).

        Heuristic: A new group starts when we see an office code or a flight
        number that follows completed segment(s) or office times.
        """
        if not tokens:
            return []

        groups: List[List[str]] = [[]]

        # Track state: are we inside an office duty or flight sequence?
        first_tok = tokens[0].upper()
        in_office = first_tok in _OFFICE_CODES

        for i, tok in enumerate(tokens):
            cleaned_upper = tok.strip().upper()

            # Check if this starts a new duty group
            if i > 0:
                # Office code after flight segments → new group
                if cleaned_upper in _OFFICE_CODES and not in_office:
                    groups.append([])
                    in_office = True
                # Flight number after office duty times → new group
                elif _is_flight_number(tok) and in_office:
                    # Check if previous group had at least times (completed office)
                    prev_group = groups[-1]
                    time_count = sum(1 for t in prev_group if _parse_time_str(t) is not None)
                    if time_count >= 2:  # office has start+end times
                        groups.append([])
                        in_office = False

            groups[-1].append(tok)

        return groups

    # ── Flight duty parsing ────────────────────────────────────────────────

    def _parse_flight_duty(self, col_date: datetime, raw_tokens: List[str]) -> Optional[Duty]:
        """
        Parse a set of tokens into a flight Duty.

        Token order in real PDF (per segment):
            REPORT_TIME
            FLIGHT_NUM  STD  DEP_AIRPORT  ARR_AIRPORT  STA  [AIRCRAFT]
            FLIGHT_NUM  STD  DEP_AIRPORT  ARR_AIRPORT  STA  [AIRCRAFT]
            ...
            RELEASE_TIME
        """
        if not raw_tokens:
            return None

        # Pre-process: handle ↓ overnight arrows
        # Mark the time token IMMEDIATELY following a ↓ as +1 day offset
        tokens: List[Tuple[str, int]] = []  # (token, day_offset)
        advance_day = False
        for raw in raw_tokens:
            t = _clean(raw)
            if not t or t in _SKIP_TOKENS:
                continue
            if t == _OVERNIGHT_ARROW:
                advance_day = True
                continue
            offset = 1 if (advance_day and _TIME_RE.match(t)) else 0
            tokens.append((t, offset))
            if advance_day and _TIME_RE.match(t):
                advance_day = False  # consumed

        if not tokens:
            return None

        # Check if first token is a flight number (no explicit report time)
        # This happens in multi-duty columns where the flight group
        # starts directly with the flight number
        first_tok, _ = tokens[0]
        no_explicit_report = _is_flight_number(first_tok)

        if no_explicit_report:
            # Parse segments from the beginning
            segments, seg_end_idx = self._extract_segments(tokens, col_date, start_idx=0)
            if not segments:
                return None

            # Use first departure as report time
            report_time_utc = segments[0].scheduled_departure_utc

            # Find release time (last time token after segments)
            release_time_utc = segments[-1].scheduled_arrival_utc + timedelta(minutes=30)
            for tok, day_off in reversed(tokens[seg_end_idx:]):
                ts = _parse_time_str(tok)
                if ts:
                    arr_tz = segments[-1].arrival_airport.timezone
                    try:
                        release_time_utc = _localize_to_utc(ts, col_date, arr_tz, day_off)
                        if release_time_utc < segments[-1].scheduled_arrival_utc:
                            release_time_utc = segments[-1].scheduled_arrival_utc + timedelta(minutes=30)
                    except Exception:
                        pass
                    break

            if release_time_utc <= report_time_utc:
                release_time_utc = report_time_utc + timedelta(hours=1)

            duty_id = f"D{col_date.strftime('%Y%m%d')}_{segments[0].flight_number}"
            return Duty(
                duty_id=duty_id,
                date=col_date,
                report_time_utc=report_time_utc,
                release_time_utc=release_time_utc,
                segments=segments,
                home_base_timezone=self.home_timezone,
                duty_type=DutyType.FLIGHT,
            )

        # Extract report time (first bare time token BEFORE any flight number)
        report_time_str: Optional[str] = None
        report_idx: int = 0
        for i, (tok, _) in enumerate(tokens):
            if _is_flight_number(tok):
                break  # stop looking — anything after is part of segments
            ts = _parse_time_str(tok)
            if ts:
                report_time_str = ts
                report_idx = i
                break

        if not report_time_str:
            return None

        # Extract flight segments
        segments, seg_end_idx = self._extract_segments(tokens, col_date, start_idx=report_idx + 1)

        if not segments:
            # Has a time but no flights — might be something unexpected. Skip.
            return None

        # Extract release time (last bare time token after last segment)
        release_time_str: Optional[str] = None
        release_day_offset: int = 0
        for tok, day_off in reversed(tokens[seg_end_idx:]):
            ts = _parse_time_str(tok)
            if ts:
                release_time_str = ts
                release_day_offset = day_off
                break

        # Build UTC datetimes
        dep_tz = segments[0].departure_airport.timezone
        arr_tz = segments[-1].arrival_airport.timezone

        try:
            report_time_utc = _localize_to_utc(report_time_str, col_date, dep_tz, 0)
        except Exception as e:
            print(f"   [easyJet] ⚠️  Could not localize report time on {col_date.date()}: {e}")
            return None

        if release_time_str:
            try:
                release_time_utc = _localize_to_utc(release_time_str, col_date, arr_tz, release_day_offset)
                # Safety: release must be after last arrival
                last_arrival_utc = segments[-1].scheduled_arrival_utc
                if release_time_utc < last_arrival_utc:
                    release_time_utc = last_arrival_utc + timedelta(minutes=30)
            except Exception:
                release_time_utc = segments[-1].scheduled_arrival_utc + timedelta(minutes=30)
        else:
            # Fallback: 30 min after last landing
            release_time_utc = segments[-1].scheduled_arrival_utc + timedelta(minutes=30)

        # Safety: release must be after report
        if release_time_utc <= report_time_utc:
            release_time_utc = report_time_utc + timedelta(hours=1)

        duty_id = f"D{col_date.strftime('%Y%m%d')}_{segments[0].flight_number}"

        duty = Duty(
            duty_id=duty_id,
            date=col_date,
            report_time_utc=report_time_utc,
            release_time_utc=release_time_utc,
            segments=segments,
            home_base_timezone=self.home_timezone,
            duty_type=DutyType.FLIGHT,
        )

        return duty

    # ── Office duty parsing ────────────────────────────────────────────────

    def _parse_office_duty(self, col_date: datetime, raw_tokens: List[str], code: str) -> Optional[Duty]:
        """
        Parse OFC4/OFC8 (office duty 4h/8h) into a ground-training Duty.

        Column tokens typically:
            OFC4  or  OFC8
            09:30      (start time)
            13:30      (end time) — or 17:30 for OFC8
        """
        # Collect time tokens from the column
        times = []
        for tok in raw_tokens:
            ts = _parse_time_str(tok)
            if ts:
                times.append(ts)

        if len(times) < 2:
            # Fallback: use default durations based on code
            default_hours = 4 if code == 'OFC4' else 8
            if times:
                start = times[0]
            else:
                start = '09:00'
            start_t = datetime.strptime(start, '%H:%M').time()
            start_naive = datetime.combine(col_date.date(), start_t)
            end_naive = start_naive + timedelta(hours=default_hours)
            report_str = start
            release_str = end_naive.strftime('%H:%M')
        else:
            report_str = times[0]
            release_str = times[-1]

        home_tz = self.home_timezone
        try:
            report_utc = _localize_to_utc(report_str, col_date, home_tz)
            release_utc = _localize_to_utc(release_str, col_date, home_tz)
            if release_utc <= report_utc:
                release_utc += timedelta(days=1)
        except Exception as e:
            print(f"   [easyJet] ⚠️  Could not parse office duty times on {col_date.date()}: {e}")
            return None

        duty_id = f"D{col_date.strftime('%Y%m%d')}_{code}"
        return Duty(
            duty_id=duty_id,
            date=col_date,
            report_time_utc=report_utc,
            release_time_utc=release_utc,
            segments=[],
            home_base_timezone=self.home_timezone,
            duty_type=DutyType.GROUND_TRAINING,
            training_code=code,
        )

    # ── Cross-column overnight helpers ────────────────────────────────────

    def _extract_incomplete_segment(self, raw_tokens: List[str]) -> Optional[Dict]:
        """
        Extract incomplete segment info from tokens that end with → (continuation).

        In real data, the pattern before → is:
            ... EJU7054 A21:53 NCE →
        (flight_number, STD, departure_airport, then →)

        Returns dict with: flight_num, std_str, dep_airport_code, col_date_offset
        or None if no incomplete segment found.
        """
        # Find the → position
        arrow_idx = None
        for i, tok in enumerate(raw_tokens):
            if tok == _CONTINUATION_ARROW:
                arrow_idx = i
                break
        if arrow_idx is None or arrow_idx < 2:
            return None

        # Walk backwards from → to find: DEP_AIRPORT, STD, FLIGHT_NUM
        # Pattern: FLIGHT_NUM STD DEP_AIRPORT →
        dep_code = None
        std_str = None
        flight_num = None

        # Token right before → should be departure airport
        for j in range(arrow_idx - 1, max(arrow_idx - 4, -1), -1):
            tok = _clean(raw_tokens[j])
            cleaned_code = _clean_airport(tok)

            if _AIRPORT_RE.match(cleaned_code) and dep_code is None:
                dep_code = cleaned_code
            elif _parse_time_str(tok) and std_str is None:
                std_str = _parse_time_str(tok)
            elif _is_flight_number(tok) and flight_num is None:
                flight_num = tok
                break

        if flight_num and std_str and dep_code:
            return {
                'flight_num': flight_num,
                'std_str': std_str,
                'dep_airport_code': dep_code,
            }
        return None

    def _parse_continuation_column(
        self,
        col_date: datetime,
        raw_tokens: List[str],
        continuation: Dict,
    ) -> List[Duty]:
        """
        Parse a column that starts with ↓ (overnight arrival from previous column).

        The column may contain:
          ↓ ARR_AIRPORT STA [AIRCRAFT] ... (arrival of overnight segment)
          Delay 00:10 00:41              (delay info — ignored)
          OFC8 13:30 21:30               (separate office duty on same day)

        This method:
        1. Completes the incomplete overnight segment on the previous duty
        2. Parses any additional duties in the same column
        """
        prev_duty = continuation['duty']
        prev_col_date = continuation['col_date']
        incomplete_seg = continuation.get('incomplete_segment')
        result_duties: List[Duty] = []

        # Skip the ↓ token
        tokens = [t for t in raw_tokens if t != _OVERNIGHT_ARROW]

        if not tokens:
            return result_duties

        # Find the arrival info: airport, time, optional aircraft
        # Pattern: ARR_AIRPORT  STA  [AIRCRAFT]
        arr_airport_code = None
        arr_time_str = None
        arr_aircraft = None
        consumed = 0

        for i, tok in enumerate(tokens):
            cleaned = _clean_airport(tok)
            if _AIRPORT_RE.match(cleaned) and arr_airport_code is None:
                arr_airport_code = cleaned
                consumed = i + 1
                continue
            ts = _parse_time_str(tok)
            if ts and arr_airport_code and arr_time_str is None:
                arr_time_str = ts
                consumed = i + 1
                continue
            am = _AIRCRAFT_RE.match(tok)
            if am and arr_airport_code:
                arr_aircraft = am.group(1)
                consumed = i + 1
                continue
            # If we found airport+time, stop looking for arrival info
            if arr_airport_code and arr_time_str:
                break

        # Complete the overnight segment
        if arr_airport_code and arr_time_str:
            arr_airport = _get_airport(arr_airport_code)
            try:
                arr_utc = _localize_to_utc(arr_time_str, col_date, arr_airport.timezone, 0)

                if incomplete_seg:
                    # Build the complete segment from incomplete info + arrival
                    dep_airport = _get_airport(incomplete_seg['dep_airport_code'])
                    dep_utc = _localize_to_utc(
                        incomplete_seg['std_str'], prev_col_date,
                        dep_airport.timezone, 0
                    )

                    new_seg = FlightSegment(
                        flight_number=incomplete_seg['flight_num'],
                        departure_airport=dep_airport,
                        arrival_airport=arr_airport,
                        scheduled_departure_utc=dep_utc,
                        scheduled_arrival_utc=arr_utc,
                        aircraft_type=arr_aircraft,
                    )
                    prev_duty.segments.append(new_seg)
                    print(f"   [easyJet] Completed overnight segment: {new_seg.flight_number} {dep_airport.code}→{arr_airport.code}")
                else:
                    # No incomplete segment info — update last segment's arrival
                    if prev_duty.segments:
                        last_seg = prev_duty.segments[-1]
                        last_seg.arrival_airport = arr_airport
                        last_seg.scheduled_arrival_utc = arr_utc
                        if arr_aircraft:
                            last_seg.aircraft_type = arr_aircraft

                # Find release time from continuation tokens
                release_time_str = None
                for tok in tokens[consumed:]:
                    ts = _parse_time_str(tok)
                    if ts:
                        # Stop if we hit an office duty code (those times belong to OFC)
                        remaining_after = tokens[consumed:]
                        has_office_ahead = any(t.upper() in _OFFICE_CODES for t in remaining_after)
                        if has_office_ahead:
                            break
                        release_time_str = ts
                        break

                if release_time_str:
                    try:
                        prev_duty.release_time_utc = _localize_to_utc(
                            release_time_str, col_date, arr_airport.timezone, 0
                        )
                    except Exception:
                        prev_duty.release_time_utc = arr_utc + timedelta(minutes=30)
                else:
                    prev_duty.release_time_utc = arr_utc + timedelta(minutes=30)

                # Ensure release > report
                if prev_duty.release_time_utc <= prev_duty.report_time_utc:
                    prev_duty.release_time_utc = prev_duty.report_time_utc + timedelta(hours=1)

            except Exception as e:
                print(f"   [easyJet] ⚠️  Could not complete overnight arrival on {col_date.date()}: {e}")

        # Check for additional duties after the continuation (e.g. OFC8 on same day)
        remaining_tokens = tokens[consumed:]
        # Filter out Delay + time pairs
        remaining_filtered = self._filter_delay_tokens(remaining_tokens)

        if remaining_filtered:
            additional_duties, _ = self._parse_column_to_duties(col_date, remaining_filtered)
            for d in additional_duties:
                if d is not None:
                    result_duties.append(d)

        return result_duties

    def _filter_delay_tokens(self, tokens: List[str]) -> List[str]:
        """Remove 'Delay' token and the time value following it."""
        result = []
        skip_next = False
        for tok in tokens:
            if skip_next:
                skip_next = False
                continue
            if _clean(tok).upper() == 'DELAY':
                skip_next = True  # skip the Delay and its time value
                continue
            result.append(tok)
        return result

    # ── Segment extraction ────────────────────────────────────────────────

    def _extract_segments(
        self,
        tokens: List[Tuple[str, int]],
        col_date: datetime,
        start_idx: int = 0,
    ) -> Tuple[List[FlightSegment], int]:
        """
        Scan tokens from start_idx looking for flight segments.

        Each segment follows the REAL easyJet pattern:
            FLIGHT_NUMBER  STD  DEP_AIRPORT  ARR_AIRPORT  STA  [AIRCRAFT]

        Note: token order is FLIGHT→STD→DEP→ARR→STA (time before airports),
        NOT FLIGHT→DEP→STD→ARR→STA.

        Returns (segments, end_idx) where end_idx is the index of the last
        token consumed as part of a segment.
        """
        segments: List[FlightSegment] = []
        i = start_idx
        last_seg_end = start_idx

        while i < len(tokens):
            tok, _ = tokens[i]

            # Is this a flight number?
            if not _is_flight_number(tok):
                i += 1
                continue

            flight_num = tok
            # Need at least 4 more tokens: STD, DEP, ARR, STA
            if i + 4 >= len(tokens):
                i += 1
                continue

            # easyJet token order: FLIGHT → STD → DEP → ARR → STA
            std_tok, std_off = tokens[i + 1]
            dep_tok, _ = tokens[i + 2]
            arr_tok, _ = tokens[i + 3]
            sta_tok, sta_off = tokens[i + 4]

            # Clean airport codes (strip * prefix)
            dep_code = _clean_airport(dep_tok)
            arr_code = _clean_airport(arr_tok)

            # Validate pattern
            dep_time_str = _parse_time_str(std_tok)
            arr_time_str = _parse_time_str(sta_tok)

            if not (_AIRPORT_RE.match(dep_code) and dep_time_str and
                    _AIRPORT_RE.match(arr_code) and arr_time_str):
                i += 1
                continue

            dep_airport = _get_airport(dep_code)
            arr_airport = _get_airport(arr_code)

            if dep_airport.timezone == 'UTC' and dep_code not in ('SEN', 'LTN'):
                self.unknown_airports.add(dep_code)
            if arr_airport.timezone == 'UTC' and arr_code not in ('SEN', 'LTN'):
                self.unknown_airports.add(arr_code)

            try:
                dep_utc = _localize_to_utc(dep_time_str, col_date, dep_airport.timezone, std_off)
                arr_utc = _localize_to_utc(arr_time_str, col_date, arr_airport.timezone, sta_off)

                # Safety net: if arrival still before departure, add 1 day
                if arr_utc <= dep_utc:
                    arr_utc = _localize_to_utc(arr_time_str, col_date, arr_airport.timezone, sta_off + 1)
            except Exception as e:
                print(f"   [easyJet] ⚠️  Time conversion failed for {flight_num}: {e}")
                i += 1
                continue

            # Optional: aircraft type in next token
            aircraft_type: Optional[str] = None
            consumed = 5
            if i + 5 < len(tokens):
                next_tok, _ = tokens[i + 5]
                am = _AIRCRAFT_RE.match(next_tok)
                if am:
                    aircraft_type = am.group(1)  # e.g. "319"
                    consumed = 6

            seg = FlightSegment(
                flight_number=flight_num,
                departure_airport=dep_airport,
                arrival_airport=arr_airport,
                scheduled_departure_utc=dep_utc,
                scheduled_arrival_utc=arr_utc,
                aircraft_type=aircraft_type,
            )
            segments.append(seg)
            last_seg_end = i + consumed
            i += consumed

        return segments, last_seg_end

    # ── Legacy compatibility method ────────────────────────────────────────

    def _parse_column_to_duty(self, col_date: datetime, raw_tokens: List[str]) -> Optional[Duty]:
        """
        Single-duty compatibility wrapper for _parse_column_to_duties().
        Used by unit tests that expect a single Duty back.
        """
        duties, _ = self._parse_column_to_duties(col_date, raw_tokens)
        return duties[0] if duties else None
