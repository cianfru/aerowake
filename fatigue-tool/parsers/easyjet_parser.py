# easyjet_parser.py - easyJet "Personal Crew Schedule" PDF Parser
"""
easyJet Roster Parser

Parses easyJet "Personal Crew Schedule" PDFs exported from easyJet's
crew management system.

Format characteristics:
  - Calendar grid layout with DD/MM date headers
  - "All times in Local Station" (each airport's local timezone)
  - Flight numbers prefixed with EJU (easyJet Europe IATA code)
  - Aircraft types in brackets: [319], [320]
  - Overnight arrival marked with ↓ arrow (U+2193)
  - Non-duty codes: D/O (day off), LVE (leave), OFC4/OFC8 (office), PSBL (standby)
  - Pilot header: "<ID> <FULL NAME>  <BASE>,<ROLE>,<AIRCRAFT>"
  - Zero-width spaces (U+200B) throughout extracted text
  - pdfplumber extract_table() works but returns many None cells

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
_NON_DUTY_CODES = {'D/O', 'LVE', 'OFC4', 'OFC8', 'PSBL', 'OFF', 'REST', 'DO'}

# Primary flight number pattern for easyJet (EJU + 4 digits)
_FLIGHT_NUM_RE = re.compile(r'^EJU\d{4}$')
# Broad fallback (any ICAO-prefix flight number)
_FLIGHT_NUM_BROAD_RE = re.compile(r'^[A-Z]{2,3}\d{3,5}$')
# IATA airport code
_AIRPORT_RE = re.compile(r'^[A-Z]{3}$')
# Time: optional A prefix (actual), then HH:MM
_TIME_RE = re.compile(r'^A?(\d{2}:\d{2})$')
# Aircraft in easyJet format: [319], [320], [321]
_AIRCRAFT_RE = re.compile(r'^\[(\d{3})\]$')
# Date header in grid: DD/MM
_DATE_HEADER_RE = re.compile(r'^(\d{2})/(\d{2})$')
# Pilot header line: "17715 PELATTI ANGEL  AGP,CP,319"
_PILOT_HEADER_RE = re.compile(
    r'^(\d{4,6})\s+([A-Z][A-Z\s]+?)\s{2,}([A-Z]{3}),([A-Z]{2}),(\d{2,3})',
    re.MULTILINE
)
# Period line: "01/09/2025 - 30/09/2025"
_PERIOD_RE = re.compile(r'(\d{2})/(\d{2})/(\d{4})\s*[-–]\s*\d{2}/\d{2}/\d{4}')
# Overnight arrow (U+2193 = ↓)
_OVERNIGHT_ARROW = '↓'


# ── Helpers ──────────────────────────────────────────────────────────────────

def _clean(s: Optional[str]) -> str:
    """Strip zero-width spaces and whitespace. Returns '' for None."""
    if s is None:
        return ''
    return s.replace('\u200b', '').replace('\u200c', '').strip()


def _get_airport(code: str) -> Airport:
    """Look up airport from IATA DB; fall back to UTC placeholder."""
    code = code.upper()
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
        duties = self._parse_grid_to_duties(table, year)
        print(f"   [easyJet] Parsed {len(duties)} flight duties")

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
            17715 PELATTI ANGEL  AGP,CP,319
            ...
            01/09/2025 - 30/09/2025 (All times in Local Station)
        """
        # Clean PDF artifacts
        text = re.sub(r'\(cid:\d+\)', ' ', raw_text)
        text = _clean(text)  # strip zero-width chars globally
        text = re.sub(r'[\x00-\x1F\x7F]', ' ', text)

        info: Dict = {}

        # Pilot header: ID + NAME + BASE,ROLE,AIRCRAFT
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
        Returns a List[List[str|None]] — a 2D table where row 0 contains
        the date headers and subsequent rows contain cell data.
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

    def _parse_grid_to_duties(self, table: List[List[Optional[str]]], year: int) -> List[Duty]:
        """
        Walk the calendar grid column by column, building Duty objects.

        Row 0 of the table contains date headers (DD/MM). Each subsequent
        row adds data to each date column. We collect all rows for a given
        column index into a flat list of non-empty tokens and pass it to
        _parse_column_to_duty().
        """
        if not table:
            return []

        header_row = table[0]
        date_columns: List[Dict] = []

        # Identify which column indices are date columns
        for col_idx, cell in enumerate(header_row):
            cleaned = _clean(cell)
            m = _DATE_HEADER_RE.match(cleaned)
            if m:
                day = int(m.group(1))
                month = int(m.group(2))
                # Handle year rollover: if roster starts in Dec and bleeds into Jan
                col_year = year
                if month == 1 and date_columns and date_columns[-1]['date'].month == 12:
                    col_year = year + 1
                try:
                    col_date = datetime(col_year, month, day)
                    date_columns.append({'col_idx': col_idx, 'date': col_date})
                except ValueError:
                    pass  # Invalid date — skip

        print(f"   [easyJet] Found {len(date_columns)} date columns in grid")

        duties: List[Duty] = []

        for dc in date_columns:
            col_idx = dc['col_idx']
            col_date = dc['date']

            # Collect all non-empty cells in this column (rows 1 onwards)
            raw_tokens: List[str] = []
            for row in table[1:]:
                if col_idx >= len(row):
                    continue
                cell = row[col_idx]
                cleaned = _clean(cell)
                if not cleaned:
                    continue
                # Split on newlines (multi-line cells from pdfplumber)
                for sub in cleaned.split('\n'):
                    sub = _clean(sub)
                    if sub:
                        raw_tokens.append(sub)

            duty = self._parse_column_to_duty(col_date, raw_tokens)

            if duty is not None:
                # Check for overnight continuation: if previous duty's last arrival
                # is the same as this duty's first departure airport → merge
                if (duties and duty.segments and duties[-1].segments and
                        duties[-1].segments[-1].arrival_airport.code ==
                        duty.segments[0].departure_airport.code and
                        not self._column_has_own_report_time(raw_tokens)):
                    # Extend the previous duty with these segments
                    prev = duties[-1]
                    prev.segments.extend(duty.segments)
                    prev.release_time_utc = duty.release_time_utc
                    print(f"   [easyJet] Merged continuation duty on {col_date.date()} into {prev.duty_id}")
                else:
                    duties.append(duty)

        return duties

    def _column_has_own_report_time(self, tokens: List[str]) -> bool:
        """
        Returns True if the column starts with a bare time (= has its own report time).
        A continuation column typically has ↓ or flight segments but no leading time.
        """
        for token in tokens:
            if _TIME_RE.match(token):
                return True
            if token == _OVERNIGHT_ARROW:
                continue
            # If we hit a flight number or non-duty code before any time, no report time
            if _FLIGHT_NUM_RE.match(token) or _FLIGHT_NUM_BROAD_RE.match(token):
                return False
            if token in _NON_DUTY_CODES:
                return False
        return False

    # ── Column → Duty ─────────────────────────────────────────────────────

    def _parse_column_to_duty(self, col_date: datetime, raw_tokens: List[str]) -> Optional[Duty]:
        """
        Convert a list of column tokens for a single date into a Duty object.

        Returns None for non-duty days (D/O, LVE, OFC4, OFC8, PSBL).
        """
        if not raw_tokens:
            return None

        # Check first meaningful token for non-duty codes
        first = raw_tokens[0].strip().upper()
        if first in _NON_DUTY_CODES:
            return None
        # Also check first token without case for common variants
        if raw_tokens[0].strip() in _NON_DUTY_CODES:
            return None

        # Pre-process: handle ↓ overnight arrows
        # Mark the time token IMMEDIATELY following a ↓ as +1 day offset
        tokens: List[Tuple[str, int]] = []  # (token, day_offset)
        advance_day = False
        for raw in raw_tokens:
            t = _clean(raw)
            if t == _OVERNIGHT_ARROW:
                advance_day = True
                continue
            offset = 1 if (advance_day and _TIME_RE.match(t)) else 0
            tokens.append((t, offset))
            if advance_day and _TIME_RE.match(t):
                advance_day = False  # consumed

        if not tokens:
            return None

        # Extract report time (first bare time token)
        report_time_str: Optional[str] = None
        report_idx: int = 0
        for i, (tok, _) in enumerate(tokens):
            ts = _parse_time_str(tok)
            if ts:
                report_time_str = ts
                report_idx = i
                break

        if not report_time_str:
            # No time found — this column may be a pure continuation/non-duty
            return None

        # Extract flight segments
        segments, seg_end_idx = self._extract_segments(tokens, col_date, start_idx=report_idx + 1)

        if not segments:
            # Has a time but no flights — could be a training/office day. Skip.
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

    # ── Segment extraction ────────────────────────────────────────────────

    def _extract_segments(
        self,
        tokens: List[Tuple[str, int]],
        col_date: datetime,
        start_idx: int = 0,
    ) -> Tuple[List[FlightSegment], int]:
        """
        Scan tokens from start_idx looking for flight segments.

        Each segment follows the pattern:
            FLIGHT_NUMBER  DEP_AIRPORT  STD  ARR_AIRPORT  STA  [AIRCRAFT]

        Returns (segments, end_idx) where end_idx is the index of the last
        token consumed as part of a segment.
        """
        segments: List[FlightSegment] = []
        i = start_idx
        last_seg_end = start_idx

        while i < len(tokens):
            tok, _ = tokens[i]

            # Is this a flight number?
            if not (_FLIGHT_NUM_RE.match(tok) or _FLIGHT_NUM_BROAD_RE.match(tok)):
                i += 1
                continue

            flight_num = tok
            # Need at least 4 more tokens: DEP, STD, ARR, STA
            if i + 4 >= len(tokens):
                i += 1
                continue

            dep_tok, _ = tokens[i + 1]
            std_tok, std_off = tokens[i + 2]
            arr_tok, _ = tokens[i + 3]
            sta_tok, sta_off = tokens[i + 4]

            # Validate pattern
            dep_time_str = _parse_time_str(std_tok)
            arr_time_str = _parse_time_str(sta_tok)

            if not (_AIRPORT_RE.match(dep_tok) and dep_time_str and
                    _AIRPORT_RE.match(arr_tok) and arr_time_str):
                i += 1
                continue

            dep_airport = _get_airport(dep_tok)
            arr_airport = _get_airport(arr_tok)

            if dep_airport.timezone == 'UTC' and dep_tok not in ('SEN', 'LTN'):
                self.unknown_airports.add(dep_tok)
            if arr_airport.timezone == 'UTC' and arr_tok not in ('SEN', 'LTN'):
                self.unknown_airports.add(arr_tok)

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
