"""
Airline Grid Roster Parser
============================

Parses grid/table layout rosters commonly used by airlines (CrewLink, etc.) where:
- Each date is a column header
- Data for that day is stacked vertically below it (RPT, flights, times)
- Multi-sector days have multiple flight entries stacked

Design: Pattern-based recognition, works with ANY airline using similar grid layout
Supports: Qatar Airways, Emirates, Etihad, and other airlines with CrewLink-style rosters
"""

import re
import pdfplumber
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import pytz
import airportsdata

from models.data_models import Airport, FlightSegment, Duty, DutyType


# Load global IATA airport database (~7,800 airports with timezones and coordinates)
# This replaces the old hardcoded KNOWN_AIRPORTS dict
_IATA_DB = airportsdata.load('IATA')


# ============================================================================
# TRAINING DUTY CODE CLASSIFICATION
# ============================================================================
# Simulator codes: Full Flight Simulator (FFS), OPC training (OPTR), etc.
# These are high-cognitive-load sessions in a motion simulator.
_SIMULATOR_CODES = {'OPTR', 'FFS', 'FS1', 'AFTD', '77LP', 'AW8'}

# Ground training codes: Classroom, meetings, assessments.
# Lower cognitive intensity than simulator, but still constrain sleep.
_GROUND_TRAINING_CODES = {'EBTGR', 'TMTG', 'INAS', '6ESEC', '6EVS', 'EVNT'}

# Combined set for quick membership testing
_ALL_TRAINING_CODES = _SIMULATOR_CODES | _GROUND_TRAINING_CODES

# Line training annotations that appear on actual flight segments.
# These are metadata — the flight is still a normal flight duty.
_LINE_TRAINING_CODES = {'X', 'U', 'UL', 'L', 'E', 'ZFT'}


def _lookup_airport(iata_code: str) -> Optional[Airport]:
    """
    Look up an airport by IATA code from the airportsdata database.

    Returns Airport object with timezone and coordinates, or None if not found.
    """
    entry = _IATA_DB.get(iata_code.upper())
    if entry:
        return Airport(
            code=entry['iata'],
            timezone=entry['tz'],
            latitude=entry['lat'],
            longitude=entry['lon']
        )
    return None


class CrewLinkRosterParser:
    """
    Generic pattern-based parser for airline grid-format rosters (CrewLink-style)
    
    KEY DESIGN: Pattern recognition, not airline-specific
    - Detects RPT:HH:MM pattern (reporting time)
    - Detects flight pattern: [prefix]NNNN AAA HH:MM AAA HH:MM
      (prefix = optional airline code like 6E, QR, EK)
    - Handles unknown airports gracefully (auto-creates with UTC)
    - Works with ANY airline using similar grid layout
    
    Supported: Qatar Airways, Emirates, Etihad, and other airlines with CrewLink rosters
    """
    
    def __init__(self, auto_create_airports: bool = True, timezone_format: str = 'auto'):
        """
        Initialize parser

        Args:
            auto_create_airports: Create placeholder for unknown airports not in airportsdata
            timezone_format: 'auto', 'local', 'zulu', or 'homebase'
                - 'auto': Detect from PDF header (default, recommended)
                - 'local': Times in roster are in local timezone of each airport
                - 'zulu': Times in roster are in UTC/Zulu (all times are UTC)
                - 'homebase': Times are in home base timezone (DOH)
        """
        self.airport_cache = {}  # Runtime cache for resolved Airport objects
        self.auto_create_airports = auto_create_airports
        self.timezone_format = timezone_format.lower()
        self.unknown_airports = set()  # Track codes not found in airportsdata

        if self.timezone_format not in ['auto', 'local', 'zulu', 'homebase']:
            raise ValueError(f"timezone_format must be 'auto', 'local', 'zulu', or 'homebase', got '{timezone_format}'")

        self.home_timezone = 'Asia/Qatar'  # Default DOH, will be updated from pilot_info
        self.home_base_code = 'DOH'  # Default, will be updated from pilot_info

    def _get_or_create_airport(self, code: str) -> Optional[Airport]:
        """
        Look up airport from airportsdata (~7,800 IATA airports).
        Falls back to UTC placeholder only if the code is truly unknown.
        """
        if code in self.airport_cache:
            return self.airport_cache[code]

        # Primary lookup: airportsdata (covers ~7,800 airports)
        airport = _lookup_airport(code)
        if airport:
            self.airport_cache[code] = airport
            return airport

        # Code not in airportsdata
        if not self.auto_create_airports:
            self.unknown_airports.add(code)
            return None

        # Create UTC placeholder as last resort
        placeholder = Airport(
            code=code,
            timezone='UTC',
            latitude=0.0,
            longitude=0.0
        )

        self.airport_cache[code] = placeholder
        self.unknown_airports.add(code)

        print(f"⚠️  Airport {code} not found in airportsdata ({len(_IATA_DB)} entries). Using UTC placeholder.")
        print(f"    Fatigue/circadian calculations for sectors involving {code} may be inaccurate.")

        return placeholder
    
    def _get_home_base_code(self) -> str:
        """Return the pilot's home base IATA code (e.g. 'DOH')."""
        return self.home_base_code

    def parse_roster(self, pdf_path: str) -> Dict:
        """
        Main entry point - parses airline grid-format roster PDF
        
        Returns:
            Dict with pilot info and parsed duties
        """
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[0]
            
            # Auto-detect timezone format if set to 'auto'
            if self.timezone_format == 'auto':
                detected_format = self._detect_timezone_format(page)
                self.timezone_format = detected_format
                print(f"   ℹ️  Detected timezone format: {detected_format.upper()}")
            
            # Extract pilot info from header
            pilot_info = self._extract_pilot_info(page)
            
            # FIXED: Update home timezone and base code from pilot base
            if pilot_info.get('base'):
                self.home_base_code = pilot_info['base']
                base_airport = self._get_or_create_airport(pilot_info['base'])
                if base_airport:
                    self.home_timezone = base_airport.timezone
            
            pilot_info['timezone_format'] = self.timezone_format
            
            # Extract the main schedule table
            table = self._extract_schedule_table(page)
            
            # Parse the grid into duties
            duties = self._parse_grid_to_duties(table, pilot_info['year'])
            
            return {
                'pilot_info': pilot_info,
                'duties': duties,
                'statistics': self._extract_statistics(page),
                'unknown_airports': list(self.unknown_airports)
            }
    
    def _detect_timezone_format(self, page) -> str:
        """
        Auto-detect timezone format from PDF header.

        Uses regex with flexible whitespace to handle pdfplumber extraction
        artifacts (extra spaces, newlines between words, reordered columns).

        Looks for phrases like:
        - "All times are in Local" -> 'local'
        - "All times are in UTC" -> 'zulu'
        - "All times are Home Base" -> 'homebase'

        Returns:
            'local', 'zulu', or 'homebase'
        """
        text = page.extract_text() or ''

        # Clean PDF artifacts
        text_clean = re.sub(r'\(cid:\d+\)', ' ', text)
        text_clean = re.sub(r'[\x00-\x1F\x7F]', ' ', text_clean)
        # Collapse multiple whitespace (spaces, tabs) into single space
        text_clean = re.sub(r'[ \t]+', ' ', text_clean)
        text_lower = text_clean.lower()

        # Debug: print any line containing "time" for troubleshooting
        for line in text_lower.split('\n'):
            if 'time' in line:
                print(f"   [TZ-DETECT] Found line with 'time': {repr(line.strip())}")

        # Pattern 1: UTC/Zulu format
        # Matches: "all times are in utc", "times utc", "times: utc", etc.
        if re.search(r'(?:all\s+)?times?\s*(?:are\s+)?(?:in\s+)?[:\-–]?\s*(?:utc|zulu)', text_lower):
            print("   📍 Timezone format detected: UTC/ZULU")
            return 'zulu'

        # Pattern 2: Local time format
        # Matches: "all times are in local", "times are local", "times: local", etc.
        if re.search(r'(?:all\s+)?times?\s*(?:are\s+)?(?:in\s+)?[:\-–]?\s*local', text_lower):
            print("   📍 Timezone format detected: LOCAL TIME")
            return 'local'

        # Pattern 3: Home base format
        # Matches: "all times are base", "all times are home base", "times in home base", "home base time"
        if re.search(r'(?:all\s+)?times?\s*(?:are\s+)?(?:in\s+)?[:\-–]?\s*(?:home\s*)?base(?:\s|$)', text_lower) or \
           re.search(r'home\s*base\s+time', text_lower):
            print("   📍 Timezone format detected: HOME BASE")
            return 'homebase'

        # Default to local
        print("   ⚠️  Could not detect timezone format from PDF header, defaulting to LOCAL")
        return 'local'
    
    def _extract_pilot_info(self, page) -> Dict:
        """
        Extract pilot and roster metadata from PDF header
        
        Extracts:
        - Pilot name
        - Pilot ID
        - Pilot base
        - Aircraft type
        - Roster period (start and end dates)
        - Block hours and duty hours statistics
        - Timezone format (local vs UTC)
        
        Returns:
            Dict with keys: name, id, base, aircraft, period_start, period_end,
            block_hours, duty_hours, year, month
        """
        text = page.extract_text()
        
        # CRITICAL FIX: Clean PDF extraction artifacts
        # pdfplumber may include (cid:X) markers for special characters like tabs
        # These MUST be removed before regex matching
        text_clean = re.sub(r'\(cid:\d+\)', ' ', text)
        
        # Debug: Print first 500 chars of cleaned text
        print(f"\n   [DEBUG] First 500 chars of cleaned PDF text:")
        print(f"   {repr(text_clean[:500])}\n")
        
        # Initialize with defaults
        info = {
            'name': None,
            'id': None,
            'base': 'DOH',  # Default
            'aircraft': 'A320',  # Default
            'year': None,
            'month': None,
            'period_start': None,
            'period_end': None,
            'block_hours': '00:00',
            'duty_hours': '00:00'
        }
        
        # ----
        # 1. EXTRACT PILOT NAME
        # ----
        # Pattern handles extra whitespace and stops at "All times"
        # Improved to handle PDF artifacts and various formatting
        name_match = re.search(r'Name\s+:\s*(.+?)(?:\n|All times|ID\s+:)', text_clean, re.DOTALL)
        if name_match:
            info['name'] = name_match.group(1).strip()
            print(f"   ✓ Extracted pilot name: {info['name']}")
        else:
            # Fallback: Try without requiring whitespace after colon
            name_match = re.search(r'Name\s*:\s*(.+?)(?:\n|$)', text_clean)
            if name_match:
                info['name'] = name_match.group(1).strip()
                print(f"   ✓ Extracted pilot name (fallback): {info['name']}")
            else:
                print(f"   ⚠️  Could not extract pilot name from PDF header")
                print(f"   [DEBUG] Text around 'Name': {repr(text_clean[:200])}")
        
        # ----
        # 2. EXTRACT ID, BASE, AIRCRAFT
        # ----
        # Format in PDF: "ID    :134614 (DOH CP-A320)" or "ID :134811 (DOH FO-A350)"
        # Role prefix can be CP (Captain), FO (First Officer), or other 2-letter codes.
        # Improved pattern with flexible spacing and generic role prefix.
        id_pattern = r'ID\s+:\s*(\d+)\s*\(\s*([A-Z]{3})\s+([A-Z]{2})-(\w+)\)'
        id_match = re.search(id_pattern, text_clean)

        if id_match:
            info['id'] = id_match.group(1)
            info['base'] = id_match.group(2)
            info['role'] = id_match.group(3)   # CP, FO, etc.
            info['aircraft'] = id_match.group(4)
            print(f"   ✓ Extracted pilot ID: {info['id']} | Base: {info['base']} | Role: {info['role']} | Aircraft: {info['aircraft']}")
        else:
            # Try simpler pattern without role prefix
            id_match_simple = re.search(r'ID\s*:\s*(\d+)', text_clean)
            if id_match_simple:
                info['id'] = id_match_simple.group(1)
                print(f"   ✓ Extracted pilot ID: {info['id']} (base/aircraft not found)")
            else:
                print(f"   ⚠️  Could not extract pilot ID from PDF header")
        
        # ----
        # 3. EXTRACT ROSTER PERIOD (ENHANCED)
        # ----
        # Format: "Period: 01-Feb-2026 - 28-Feb-2026 | Published"
        # This is ESSENTIAL for determining the month being analyzed
        period_match = re.search(
            r'Period:\s*(\d{2}-\w{3}-\d{4})\s*-\s*(\d{2}-\w{3}-\d{4})',
            text_clean
        )
        
        if period_match:
            info['period_start'] = period_match.group(1)
            info['period_end'] = period_match.group(2)
            
            # Also extract month and year from period_start
            date_parts = re.search(r'\d+-(\w{3})-(\d{4})', info['period_start'])
            if date_parts:
                info['month'] = date_parts.group(1)
                info['year'] = int(date_parts.group(2))
            
            print(f"   ✓ Period: {info['period_start']} to {info['period_end']}")
            print(f"   ✓ Extracted period: {info['month']} {info['year']}")
        else:
            # Fallback to simpler pattern
            period_match_simple = re.search(r'Period:\s*\d+-([A-Za-z]+)-(\d{4})', text_clean)
            if period_match_simple:
                info['month'] = period_match_simple.group(1)
                info['year'] = int(period_match_simple.group(2))
                print(f"   ✓ Extracted period: {info['month']} {info['year']}")
            else:
                print(f"   ⚠️  Period extraction failed")
        
        # ----
        # 4. EXTRACT STATISTICS (BLOCK HOURS, DUTY HOURS)
        # ----
        # Format: "VALUE 71:45 114:30 0 24 00:00 0 0 0 17"
        #         (block hrs, duty hrs, ...)
        stats_match = re.search(r'VALUE\s+([\d:]+)\s+([\d:]+)', text_clean)
        
        if stats_match:
            info['block_hours'] = stats_match.group(1)
            info['duty_hours'] = stats_match.group(2)
            print(f"   ✓ Statistics: {info['block_hours']} block hours, {info['duty_hours']} duty hours")
        else:
            print(f"   ⚠️  Statistics extraction failed")
        
        # ----
        # 5. DETECT TIMEZONE FORMAT
        # ----
        # This determines how to interpret all times in the duty details
        if "All times are in Local" in text_clean:
            print(f"   ✓ Timezone: LOCAL TIMES")
        elif "All times are in UTC" in text_clean or "Zulu" in text_clean:
            print(f"   ✓ Timezone: UTC/ZULU TIMES")
        else:
            print(f"   ℹ️  Timezone not explicitly stated, assuming LOCAL")
        
        return info
    
    def _extract_schedule_table(self, page) -> List[List[str]]:
        """
        Extract the main schedule grid using pdfplumber table detection
        """
        # Use aggressive table detection for complex grid
        table = page.extract_table({
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "snap_tolerance": 5,
            "join_tolerance": 3,
            "edge_min_length": 10,
        })
        
        if not table:
            # Fallback: try text strategy
            table = page.extract_table({
                "vertical_strategy": "text",
                "horizontal_strategy": "text",
                "snap_tolerance": 5,
            })
        
        return table if table else []
    
    def _parse_grid_to_duties(self, table: List[List[str]], year: int) -> List[Duty]:
        """
        Parse the grid table into Duty objects
        
        Grid structure:
        Row 0: Date headers (e.g., "01Feb Sun", "02Feb Mon", ...)
        Row 1+: Data rows (RPT, flights, times, block/duty hours)
        """
        if not table or len(table) < 2:
            return []
        
        duties = []
        
        # First row = date headers
        date_headers = table[0]
        
        # Identify which columns are dates (skip empty/label columns)
        date_columns = []
        for col_idx, header in enumerate(date_headers):
            if header and re.match(r'\d{2}[A-Z][a-z]{2}', header):
                # Parse date like "01Feb" -> datetime
                date_str = header.split('\n')[0].split()[0]  # Get "01Feb"
                day = int(date_str[:2])
                month_str = date_str[2:]
                month = datetime.strptime(month_str, '%b').month
                date = datetime(year, month, day)
                
                date_columns.append({
                    'col_idx': col_idx,
                    'date': date,
                    'date_str': date_str
                })
        
        # For each date column, extract vertical stack of data
        for date_col in date_columns:
            col_idx = date_col['col_idx']
            date = date_col['date']

            # Collect all non-empty cells in this column
            column_data = []
            for row_idx in range(1, len(table)):
                cell = table[row_idx][col_idx]
                if cell and cell.strip():
                    column_data.append(cell.strip())

            # Parse this column's data into a duty (if any)
            duty = self._parse_column_to_duty(date, column_data)
            if duty:
                # Check if this is a TRUE continuation of the previous duty:
                # A continuation means the pilot is at an outstation (layover)
                # and the next day's flights depart FROM that outstation back home,
                # with no separate RPT because it's the same duty period.
                #
                # Conditions (ALL must be true):
                # 1. No RPT line in this column (used departure-1h fallback)
                # 2. Previous duty's last arrival is NOT the home base
                #    (home base departures are always new duties, not continuations)
                # 3. Previous duty's last arrival matches this duty's first departure
                #    (pilot is at the outstation)
                # 4. Previous duty exists and both have segments
                has_rpt = any(
                    re.match(r'R\s*P\s*T\s*:', line)
                    for item in column_data
                    for line in item.split('\n')
                )
                prev_ended_at_outstation = (
                    duties
                    and duties[-1].segments
                    and duties[-1].segments[-1].arrival_airport.code != self._get_home_base_code()
                )
                is_continuation = (
                    not has_rpt
                    and prev_ended_at_outstation
                    and duty.segments
                    and duties[-1].segments[-1].arrival_airport.code == duty.segments[0].departure_airport.code
                )
                if is_continuation:
                    # Merge: append segments to previous duty, update release time
                    prev_duty = duties[-1]
                    prev_duty.segments.extend(duty.segments)
                    prev_duty.release_time_utc = duty.release_time_utc
                    print(f"  ✓ Merged {date.strftime('%d%b')} segments into previous duty "
                          f"({prev_duty.date.strftime('%d%b')}) — layover continuation, no RPT")
                else:
                    duties.append(duty)

        return duties
    
    def _parse_column_to_duty(self, date: datetime, column_data: List[str]) -> Optional[Duty]:
        """
        Parse a single date column vertical data stack into a Duty
        Enhanced to validate times against segment data
        """
        if not column_data:
            return None
        
        # Combine all data and split by newlines
        full_text = '\n'.join(column_data)
        lines = [line.strip() for line in full_text.split('\n') if line.strip()]
        
        if not lines:
            return None
        
        # Check if non-flying day (OFF, standby, leave, sick, rest)
        # These activity codes mean the pilot has no operating duty on this date.
        # NOTE: Training codes (6ESEC, EBTGR, etc.) are no longer skipped here —
        # they are now parsed as training duties below.
        first_item = lines[0].upper()
        _NON_FLYING_CODES = {
            'OFF', 'GOFF', 'DOFF',          # Days off
            'SBY', 'PSBY', 'STANDBY',       # Standby (home or phone)
            'PISY',                          # Instructor standby (kept as non-duty)
            'LVE', 'LEAVE',                  # Annual/other leave
            'SICK', 'REST', 'SR',            # Sick, rest, special rest
            'ROFF', 'POFF',                  # Requested/privileged off
        }
        if any(code in first_item for code in _NON_FLYING_CODES):
            return None  # Non-flying day, no duty

        # Check if this is a training duty (SIM session, ground class, meeting)
        # Training columns have: RPT:HH:MM, training code, DOH, start_time, end_time, annotations
        training_code = self._detect_training_code(lines)
        if training_code:
            return self._parse_training_duty(lines, date, training_code)

        # Extract report time (RPT) and flight segments first
        # We need to know the departure airport to properly localize report time
        report_time = None
        report_hour = None
        report_minute = None

        for line in lines:
            # Tolerate OCR artifacts that insert spaces inside "RPT"
            # (e.g., "R PT:05:55" or "RP T:05:55" from pdfplumber)
            rpt_match = re.match(r'R\s*P\s*T\s*:\s*(\d{2})\s*:\s*(\d{2})', line)
            if rpt_match:
                report_hour = int(rpt_match.group(1))
                report_minute = int(rpt_match.group(2))
                break

        # Extract flight segments first to determine departure airport
        segments = self._extract_segments_from_lines(lines, date)

        if not segments:
            return None
        
        # Now create report time using proper timezone conversion
        if report_hour is not None:
            report_time_naive = datetime(date.year, date.month, date.day, report_hour, report_minute)
            
            # Get timezone from departure airport (first segment's departure)
            dep_airport = segments[0].departure_airport
            
            # FIXED: Added 'homebase' format conversion
            if self.timezone_format == 'local':
                # Report time is in LOCAL timezone of departure airport
                dep_tz = pytz.timezone(dep_airport.timezone)
                report_time = dep_tz.localize(report_time_naive)
            elif self.timezone_format == 'homebase':
                # Report time is in HOME BASE timezone
                home_tz = pytz.timezone(self.home_timezone)
                report_time = home_tz.localize(report_time_naive)
            else:  # zulu
                # Report time is already in UTC
                report_time = pytz.utc.localize(report_time_naive)
            
            # Validate report time against first departure
            first_departure = segments[0].scheduled_departure_utc
            if report_time > first_departure:
                # Report is after departure - move to previous day
                if self.timezone_format == 'local':
                    dep_tz = pytz.timezone(dep_airport.timezone)
                    report_time_naive_prev = report_time_naive - timedelta(days=1)
                    report_time = dep_tz.localize(report_time_naive_prev)
                elif self.timezone_format == 'homebase':
                    home_tz = pytz.timezone(self.home_timezone)
                    report_time_naive_prev = report_time_naive - timedelta(days=1)
                    report_time = home_tz.localize(report_time_naive_prev)
                print(f"  ⚠️  Report time adjusted to previous day (was after first departure)")
        else:
            # Fallback: report time = departure time - 1 hour
            report_time = segments[0].scheduled_departure_utc - timedelta(hours=1)
            print(f"  ⚠️  No RPT line found for {date.strftime('%d%b')} — using departure-1h as fallback")
        
        if not report_time:
            return None  # No valid duty
        
        # Calculate release time: last landing + 30 minutes post-flight duty per EASA FTL
        # EASA defines FDP as report time to END OF LAST LANDING (not +1 hour)
        last_landing = segments[-1].scheduled_arrival_utc
        release_time = last_landing + timedelta(minutes=30)
        # Ensure release_time is in UTC
        if release_time.tzinfo and release_time.utcoffset() != timedelta(0):
            release_time = release_time.astimezone(pytz.utc)
        
        # Final validation: ensure report < release
        if report_time >= release_time:
            print(f"  ⚠️  Invalid duty: report >= release, adjusting release time")
            release_time = report_time + timedelta(hours=1)  # Minimum 1h duty
        
        # Derive duty date from report_time in home base timezone.
        # Using the PDF column date directly is wrong for layover duties where
        # the departure airport is in a different timezone (e.g. GRU UTC-3):
        # a 00:10 GRU report on "03Jan" column = 06:10 DOH, still 03 Jan in DOH —
        # but a very early local report could cross the home-base date boundary.
        # Anchoring to home TZ ensures the chronogram row always matches.
        home_tz_parser = pytz.timezone(self.home_timezone)
        report_in_home_tz = report_time.astimezone(home_tz_parser)
        duty_date = datetime(
            report_in_home_tz.year,
            report_in_home_tz.month,
            report_in_home_tz.day
        )

        # Create duty.
        # IMPORTANT: home_base_timezone is the PILOT'S home base (e.g. Asia/Qatar for DOH),
        # NOT the departure airport's timezone.  For layover departures (e.g. QR730 departing
        # DFW) the departure airport timezone is America/Chicago — using that here would cause
        # _build_ulr_data() to compute IR block day/hour values in Chicago time instead of DOH
        # time, placing the bars on the wrong chronogram row.
        duty = Duty(
            duty_id=f"D{duty_date.strftime('%Y%m%d')}",
            date=duty_date,
            report_time_utc=report_time.astimezone(pytz.utc),
            release_time_utc=release_time,
            segments=segments,
            home_base_timezone=self.home_timezone
        )
        
        return duty

    # ========================================================================
    # TRAINING DUTY PARSING
    # ========================================================================

    def _detect_training_code(self, lines: List[str]) -> Optional[str]:
        """
        Check if this column represents a training duty.

        Training columns in Qatar CrewLink PDF have the pattern:
            RPT:HH:MM
            <TRAINING_CODE>    (e.g. OPTR, FFS, EBTGR, AFTD)
            DOH                (always at home base)
            HH:MM              (start time)
            HH:MM or HH:MM(+1)(end time)
            PA,annotations     (trailing codes)

        Returns the matched training code, or None if not a training duty.
        """
        for line in lines:
            token = line.strip().upper()
            # Direct match against known training codes
            if token in _ALL_TRAINING_CODES:
                return token
            # Some codes may appear with prefix/suffix in PDF
            # (e.g. "6ESEC" could be embedded in a longer string)
            for code in _ALL_TRAINING_CODES:
                if code in token and len(token) <= len(code) + 2:
                    return code
        return None

    def _parse_training_duty(
        self,
        lines: List[str],
        date: datetime,
        training_code: str
    ) -> Optional[Duty]:
        """
        Parse a training duty column into a Duty object.

        Training duties have no flight segments. They constrain sleep windows
        and contribute to homeostatic pressure in the fatigue model (BAM-aligned:
        same S/C/W equations, different workload multiplier).

        Column pattern:
            RPT:HH:MM           → report time
            <CODE>               → training code (e.g. OPTR, EBTGR)
            DOH                  → location (always home base)
            HH:MM                → activity start time
            HH:MM or HH:MM(+1)  → activity end time
            PA,annotations       → trailing codes (ea, FS, op, aw, lpc, etc.)
        """
        # 1. Extract report time
        report_hour = None
        report_minute = None
        for line in lines:
            rpt_match = re.match(r'R\s*P\s*T\s*:\s*(\d{2})\s*:\s*(\d{2})', line)
            if rpt_match:
                report_hour = int(rpt_match.group(1))
                report_minute = int(rpt_match.group(2))
                break

        # 2. Extract start and end times from the column
        # After the training code and location (DOH), there are two time entries
        times_found = []
        code_seen = False
        for line in lines:
            token = line.strip().upper()
            if token == training_code or training_code in token:
                code_seen = True
                continue
            if code_seen and re.search(r'\d{2}:\d{2}', line):
                parsed_time = self._parse_time(line.strip(), date)
                if parsed_time:
                    times_found.append((parsed_time, line.strip()))
                if len(times_found) >= 2:
                    break

        if len(times_found) < 2:
            # Couldn't find start/end times — try fallback from RPT
            if report_hour is not None:
                print(f"  ⚠️  Training {training_code} on {date.strftime('%d%b')}: "
                      f"could not find start/end times, using RPT + 8h fallback")
                start_naive = datetime(date.year, date.month, date.day,
                                       report_hour, report_minute)
                end_naive = start_naive + timedelta(hours=8)
                times_found = [(start_naive, f"{report_hour:02d}:{report_minute:02d}"),
                               (end_naive, "")]
            else:
                print(f"  ⚠️  Skipping training {training_code} on {date.strftime('%d%b')}: "
                      f"no RPT or times found")
                return None

        start_time_naive, _ = times_found[0]
        end_time_naive, _ = times_found[1]

        # 3. Localize times to UTC (training always at home base)
        home_tz = pytz.timezone(self.home_timezone)
        try:
            if self.timezone_format == 'local' or self.timezone_format == 'homebase':
                # Training at home base — local == home base timezone
                report_naive = datetime(date.year, date.month, date.day,
                                        report_hour, report_minute) if report_hour is not None else start_time_naive
                report_time = home_tz.localize(report_naive)
                start_time_utc = home_tz.localize(start_time_naive).astimezone(pytz.utc)
                end_time_utc = home_tz.localize(end_time_naive).astimezone(pytz.utc)
                report_time_utc = report_time.astimezone(pytz.utc)
            else:  # zulu
                report_naive = datetime(date.year, date.month, date.day,
                                        report_hour, report_minute) if report_hour is not None else start_time_naive
                report_time_utc = pytz.utc.localize(report_naive)
                start_time_utc = pytz.utc.localize(start_time_naive)
                end_time_utc = pytz.utc.localize(end_time_naive)
        except Exception as e:
            print(f"  ⚠️  Error localizing training {training_code} on {date.strftime('%d%b')}: {e}")
            return None

        # Handle overnight: if end is before start, it crosses midnight
        if end_time_utc <= start_time_utc:
            end_time_utc += timedelta(days=1)

        # Handle report time before midnight for next-day activity
        if report_time_utc > start_time_utc:
            report_time_utc -= timedelta(days=1)

        # Release time = end of activity + 30 min commute/debrief buffer
        release_time_utc = end_time_utc + timedelta(minutes=30)

        # 4. Extract trailing annotations (lowercase and uppercase codes after times)
        # e.g. "PA,ea" → ["PA", "ea"], "PA,FS" → ["PA", "FS"],
        # "PA,aw,lpc,rh" → ["PA", "aw", "lpc", "rh"]
        annotations = []
        past_times = 0
        for line in lines:
            if re.search(r'\d{2}:\d{2}', line):
                past_times += 1
                continue
            if past_times >= 2:
                # Everything after the second time is annotations
                # Split by comma and clean
                for part in line.strip().split(','):
                    part = part.strip()
                    if part and part.upper() not in {'DOH', training_code}:
                        annotations.append(part)

        # 5. Determine duty type
        if training_code in _SIMULATOR_CODES:
            duty_type = DutyType.SIMULATOR
        else:
            duty_type = DutyType.GROUND_TRAINING

        # 6. Derive duty date from report time in home base timezone
        report_in_home_tz = report_time_utc.astimezone(home_tz)
        duty_date = datetime(
            report_in_home_tz.year,
            report_in_home_tz.month,
            report_in_home_tz.day
        )

        duty = Duty(
            duty_id=f"D{duty_date.strftime('%Y%m%d')}",
            date=duty_date,
            report_time_utc=report_time_utc,
            release_time_utc=release_time_utc,
            segments=[],
            home_base_timezone=self.home_timezone,
            duty_type=duty_type,
            training_code=training_code,
            training_annotations=annotations if annotations else None,
        )

        print(f"  ✓ Training duty: {training_code} ({duty_type.value}) on "
              f"{duty_date.strftime('%d%b')} — "
              f"RPT {report_in_home_tz.strftime('%H:%M')}, "
              f"duty {start_time_utc.astimezone(home_tz).strftime('%H:%M')}-"
              f"{end_time_utc.astimezone(home_tz).strftime('%H:%M')} "
              f"({duty.duty_hours:.1f}h)")

        return duty

    def _extract_segments_from_lines(
        self, 
        lines: List[str], 
        date: datetime
    ) -> List[FlightSegment]:
        """
        Extract flight segments using PATTERN DETECTION
        
        Pattern recognition (works with any flights):
        - Flight number: 3-4 digits OR airline prefix + digits (e.g., 6E1306, QR490)
        - Airport code: 3 uppercase letters
        - Time: HH:MM format
        - Sequence: FlightNum to Airport to Time to Airport to Time
        """
        segments = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # PATTERN 1: Look for flight number
            # Case A: Pure numeric (490, 1060) - 3 to 4 digits
            # Case B: Airline-prefixed (6E1306, QR490, EK231) - 1-3 alphanumeric prefix + digits
            # Must NOT be a time (contains ':'), airport code (exactly 3 uppercase letters),
            # or annotation like (320), PIC, REQ, SR, etc.
            is_flight_number = (
                ':' not in line
                and not re.match(r'^[A-Z]{3}$', line)
                and not re.match(r'^\(', line)
                and (
                    re.match(r'^\d{3,4}$', line)  # Pure numeric: 490, 1060
                    or re.match(r'^[A-Z0-9]{2}[A-Z]?\d{1,5}$', line)  # Prefixed: 6E1306, QR490
                )
            )
            if is_flight_number:
                flight_num = line
                
                # Look ahead for: AIRPORT TIME AIRPORT TIME
                if i + 4 >= len(lines):
                    i += 1
                    continue
                
                # PATTERN 2: Departure airport (3 letters)
                dep_code = lines[i + 1]
                if not re.match(r'^[A-Z]{3}$', dep_code):
                    i += 1
                    continue
                
                # PATTERN 3: Departure time (HH:MM)
                dep_time_str = lines[i + 2]
                if not re.search(r'\d{2}:\d{2}', dep_time_str):
                    i += 1
                    continue
                
                # PATTERN 4: Arrival airport (3 letters)
                arr_code = lines[i + 3]
                if not re.match(r'^[A-Z]{3}$', arr_code):
                    i += 1
                    continue
                
                # PATTERN 5: Arrival time (HH:MM)
                arr_time_str = lines[i + 4]
                if not re.search(r'\d{2}:\d{2}', arr_time_str):
                    i += 1
                    continue
                
                # VALID FLIGHT PATTERN DETECTED!
                dep_airport = self._get_or_create_airport(dep_code)
                arr_airport = self._get_or_create_airport(arr_code)
                
                # Skip if airports couldn't be created
                if not dep_airport or not arr_airport:
                    i += 5
                    continue
                
                # Parse times
                dep_time = self._parse_time(dep_time_str, date)
                arr_time = self._parse_time(arr_time_str, date)
                
                if not dep_time or not arr_time:
                    i += 5
                    continue
                
                # FIXED: Convert to UTC based on timezone format
                try:
                    if self.timezone_format == 'local':
                        # Times are in LOCAL timezone of each airport
                        dep_tz = pytz.timezone(dep_airport.timezone)
                        arr_tz = pytz.timezone(arr_airport.timezone)
                        
                        dep_utc = dep_tz.localize(dep_time).astimezone(pytz.utc)
                        arr_utc = arr_tz.localize(arr_time).astimezone(pytz.utc)
                    
                    elif self.timezone_format == 'homebase':
                        # NEW: Times are in HOME BASE timezone (DOH)
                        home_tz = pytz.timezone(self.home_timezone)
                        
                        dep_utc = home_tz.localize(dep_time).astimezone(pytz.utc)
                        arr_utc = home_tz.localize(arr_time).astimezone(pytz.utc)
                    
                    else:  # timezone_format == 'zulu'
                        # Times are already in UTC/Zulu
                        dep_utc = pytz.utc.localize(dep_time)
                        arr_utc = pytz.utc.localize(arr_time)
                    
                    # Safety: if arrival is before departure, the flight crosses midnight
                    # This handles cases where (+1) marker was missing or stripped
                    if arr_utc <= dep_utc:
                        arr_utc += timedelta(days=1)

                    segment = FlightSegment(
                        flight_number=flight_num,  # Keep as-is from PDF
                        departure_airport=dep_airport,
                        arrival_airport=arr_airport,
                        scheduled_departure_utc=dep_utc,
                        scheduled_arrival_utc=arr_utc
                    )

                    segments.append(segment)

                except Exception as e:
                    print(f"⚠️  Error creating segment for flight {flight_num}: {e}")

                # Skip past the 5 standard elements
                i += 5

                # Scan trailing lines for activity codes (IR, DH), line training
                # annotations, and aircraft type.
                # These appear AFTER the arrival time in Qatar CrewLink PDF columns.
                # Known activity codes with operational meaning:
                #   IR = Inflight Rest (pilot is relief crew, always 4-pilot augmented)
                #   DH = Deadhead (pilot as passenger, not operating)
                # Line training codes (metadata only, stored on segment):
                #   X = Line Training (TRE-TRI REQD), U/UL = Final Line Check
                #   L = Line Training, E = ETOPS Training, ZFT = Zero Flight Time
                # Ignored codes (no fatigue relevance):
                #   REQ = Requested duty (bidding metadata)
                #   PIC, SR, CB, SIM, GND = other annotations
                _ACTIVITY_CODES = {'IR', 'DH'}
                _IGNORED_CODES = {'REQ', 'PIC', 'SR', 'CB', 'SIM', 'GND', 'DOFF', 'PA'}

                scan_limit = min(i + 3, len(lines))
                while i < scan_limit:
                    token = lines[i].strip()
                    token_upper = token.upper()
                    clean = token_upper.strip('()')  # "(359)" -> "359"

                    # Check for comma-separated annotation strings first
                    # e.g. "PA,PIC,ZFT" or "PA,E,L,PIC,REQ" or "PIC,REQ,X"
                    if ',' in token:
                        parts = [p.strip() for p in token.split(',')]
                        for part in parts:
                            part_upper = part.upper()
                            if part_upper in _ACTIVITY_CODES:
                                segment.activity_code = part_upper
                            elif part_upper in _LINE_TRAINING_CODES:
                                if segment.line_training_codes is None:
                                    segment.line_training_codes = []
                                segment.line_training_codes.append(part_upper)
                            # else: ignored (PA, PIC, REQ, etc.)
                        i += 1
                    elif token_upper in _ACTIVITY_CODES:
                        segment.activity_code = token_upper
                        i += 1
                    elif token_upper in _LINE_TRAINING_CODES:
                        if segment.line_training_codes is None:
                            segment.line_training_codes = []
                        segment.line_training_codes.append(token_upper)
                        i += 1
                    elif token_upper in _IGNORED_CODES:
                        i += 1  # Skip irrelevant codes
                    elif re.match(r'^\(\w{2,3}\)$', token_upper):
                        # Parenthesized aircraft type e.g. (359), (351), (77W)
                        segment.aircraft_type = clean  # Store on segment
                        i += 1
                    elif re.match(r'^[A-Z0-9]{2,3}$', clean) and not re.match(r'^[A-Z]{3}$', token_upper):
                        # Bare aircraft type code e.g. 359, 77W (not an airport).
                        # IMPORTANT: do NOT consume if the token looks like a flight number
                        # followed by airport + time (i.e. it is the START of the next segment).
                        # Flight number pattern: 3-4 pure digits OR 2-letter prefix + digits.
                        looks_like_flight_num = bool(
                            re.match(r'^\d{3,4}$', token_upper)
                            or re.match(r'^[A-Z0-9]{2}[A-Z]?\d{1,5}$', token_upper)
                        )
                        next_is_airport = (
                            i + 1 < len(lines)
                            and re.match(r'^[A-Z]{3}$', lines[i + 1].strip().upper())
                        )
                        next_is_time = (
                            i + 2 < len(lines)
                            and re.search(r'\d{2}:\d{2}', lines[i + 2])
                        )
                        if looks_like_flight_num and next_is_airport and next_is_time:
                            break  # Next segment starts here — stop consuming trailing tokens
                        segment.aircraft_type = clean  # Store on segment
                        i += 1
                    else:
                        break  # Unknown token — likely start of next segment

                continue
            
            i += 1
        
        return segments
    
    def _parse_time(self, time_str: str, date: datetime) -> Optional[datetime]:
        """Parse time string like "07:45" or "02:25(+1)" into datetime.

        The (+N) marker indicates the time is N days after the base date.
        """
        # Extract (+N) day offset before removing it
        day_offset = 0
        offset_match = re.search(r'\(\+(\d+)\)', time_str)
        if offset_match:
            day_offset = int(offset_match.group(1))

        # Remove (+N) marker for time parsing
        time_str = re.sub(r'\(\+\d+\)', '', time_str).strip()

        # Parse HH:MM
        match = re.match(r'(\d{2}):(\d{2})', time_str)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            return datetime(date.year, date.month, date.day, hour, minute) + timedelta(days=day_offset)

        return None
    
    def _extract_statistics(self, page) -> Dict:
        """Extract summary statistics from bottom of page"""
        text = page.extract_text()
        
        stats = {}
        
        # Look for statistics table
        stats_match = re.search(
            r'BLOCK\s+HOURS.*?VALUE\s+([\d:]+)\s+([\d:]+)',
            text,
            re.DOTALL
        )
        
        if stats_match:
            stats['block_hours'] = stats_match.group(1)
            stats['duty_hours'] = stats_match.group(2)
        
        return stats
