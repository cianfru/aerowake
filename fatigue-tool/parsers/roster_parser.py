# roster_parser.py - PDF/CSV Roster Parser

"""
Roster Parser - Extract duty data from airline PDF/CSV rosters

Supports:
- Qatar Airways CrewLink (Grid & Text formats)
- Generic CSV exports
- Robust Pilot ID and Report Time extraction

Scientific Note: Parser outputs standardized Roster objects
for biomathematical analysis (Borbély model)
"""

import pdfplumber
import pandas as pd
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import pytz
import airportsdata

# Ensure you have these models defined in your project
from models.data_models import Airport, FlightSegment, Duty, Roster, CrewComposition, RestFacilityClass, ULRCrewSet
from parsers.qatar_crewlink_parser import CrewLinkRosterParser


# ============================================================================
# AUTO-DETECTION: Crew Augmentation & ULR
# ============================================================================

def auto_detect_crew_augmentation(roster: Roster) -> None:
    """
    Post-parse pass: detect augmented (4-pilot ULR) crew duties from IR activity codes.

    The ONLY reliable signal in the PDF for 4-pilot augmented crew is the `IR`
    (Inflight Rest) activity code on a flight segment.  This means the pilot is
    in the bunk — definitively 4-pilot.

    From a single IR-marked duty we can infer TWO duties are 4-pilot:
      • The duty containing IR → pilot is Crew B (resting) on this sector.
      • The paired outbound duty that arrived at the same layover station
        → pilot was Crew A (operating) on that leg; the aircraft still had 4 pilots.

    3-pilot augmented crew CANNOT be reliably auto-detected from the PDF.
    The roster has no code for it.  If the operator nominates 3-pilot crew it will
    show no differently to a 2-pilot duty in CrewLink.  Rather than guess wrong
    and apply incorrect FDP limits, we leave unlabelled long duties as STANDARD and
    let the user (or API caller) override via the crew_composition parameter.

    Rules (all derived from PDF IR codes — no city-pair lists, no FDP heuristics):
      1. Duty has IR segment → AUGMENTED_4, Crew B
         (pilot is in bunk; aircraft is definitively 4-pilot)
      2. Duty arrives at the layover station of an IR duty → AUGMENTED_4, Crew A
         (pilot operated this outbound leg; same 4-pilot aircraft)
      3. Duty departs from the layover station of an IR duty → AUGMENTED_4, Crew A
         (return leg, paired with the IR inbound; same 4-pilot aircraft)

    Everything else stays STANDARD.  No FDP thresholds, no city-pair lists.

    DH (Deadhead): pilot is a passenger, not operating.  Does not change crew
    composition — a DH sector within a STANDARD duty remains STANDARD.

    All classifications are defaults; API callers can override per-duty.
    """
    import logging
    logger = logging.getLogger(__name__)

    # ------------------------------------------------------------------
    # PRE-PASS: build the set of layover stations from IR-marked duties.
    #
    # An IR duty either departs from OR arrives at a layover airport:
    #   • Crew B on return leg (e.g. QR774 GRU→DOH): departs from GRU
    #   • Crew B on outbound leg (e.g. QR729 DOH→DFW): arrives at DFW
    #
    # We collect BOTH departure and arrival airports of IR-marked duties
    # (excluding home base) so the paired operating leg is always found:
    #   • QR773 DOH→GRU (arrives GRU) → tagged via Rule 2
    #   • QR730 DFW→DOH (departs DFW) → tagged via Rule 3
    #
    # Exclude the pilot's home base: in the normal outbound-then-return pattern
    # the home base is never a layover station for IR purposes.  Including it
    # would incorrectly tag every homebound flight as AUGMENTED_4.
    # ------------------------------------------------------------------
    home_base = roster.pilot_base or 'DOH'
    ir_layover_stations: set = set()   # non-home airports linked to IR duties
    for duty in roster.duties:
        if duty.segments and duty.has_inflight_rest_segments:
            dep = duty.segments[0].departure_airport.code
            arr = duty.segments[-1].arrival_airport.code
            if dep != home_base:
                ir_layover_stations.add(dep)
            if arr != home_base:
                ir_layover_stations.add(arr)

    # ------------------------------------------------------------------
    # MAIN PASS
    # ------------------------------------------------------------------
    for duty in roster.duties:
        if not duty.segments:
            continue

        # --- Rule 1: IR segment present → Crew B on this duty ---
        if duty.has_inflight_rest_segments:
            duty.crew_composition = CrewComposition.AUGMENTED_4
            duty.is_ulr = True
            duty.ulr_crew_set = ULRCrewSet.CREW_B
            duty.rest_facility_class = RestFacilityClass.CLASS_1
            logger.info(
                f"Duty {duty.duty_id}: IR code detected → AUGMENTED_4 / CREW_B"
            )
            continue

        # --- Rule 2: This duty arrives at an IR layover station → Crew A outbound ---
        arr_code = duty.segments[-1].arrival_airport.code
        if arr_code in ir_layover_stations:
            duty.crew_composition = CrewComposition.AUGMENTED_4
            duty.is_ulr = True
            duty.ulr_crew_set = ULRCrewSet.CREW_A
            duty.rest_facility_class = RestFacilityClass.CLASS_1
            logger.info(
                f"Duty {duty.duty_id}: arrives at IR layover {arr_code} "
                f"→ AUGMENTED_4 / CREW_A (outbound operating leg)"
            )
            continue

        # --- Rule 3: This duty departs from an IR layover station → Crew A return ---
        dep_code = duty.segments[0].departure_airport.code
        if dep_code in ir_layover_stations:
            duty.crew_composition = CrewComposition.AUGMENTED_4
            duty.is_ulr = True
            duty.ulr_crew_set = ULRCrewSet.CREW_A
            duty.rest_facility_class = RestFacilityClass.CLASS_1
            logger.info(
                f"Duty {duty.duty_id}: departs IR layover {dep_code} "
                f"→ AUGMENTED_4 / CREW_A (return operating leg)"
            )
            continue

        # --- Everything else: leave as STANDARD ---
        # 3-pilot augmented cannot be reliably detected from the PDF.
        # The user can override via the API crew_composition parameter if needed.

        # DH segments: logged for information only, no crew composition change
        if duty.has_deadhead_segments:
            dh_segs = [s.flight_number for s in duty.segments if s.is_deadhead]
            logger.info(
                f"Duty {duty.duty_id}: deadhead segment(s) {dh_segs} "
                f"→ counts toward duty time, no cockpit workload"
            )


# ============================================================================
# AIRPORT DATABASE (backed by airportsdata ~7,800 IATA airports)
# ============================================================================

# Module-level load (cached)
_IATA_DB = airportsdata.load('IATA')


class AirportDatabase:
    """
    IATA airport database backed by airportsdata package.

    Provides timezone, latitude, and longitude for ~7,800 airports worldwide.
    Falls back to UTC placeholder for codes not in the database.
    """

    # Runtime overrides (e.g. for military/private airfields not in airportsdata)
    _custom_airports: Dict[str, dict] = {}

    @classmethod
    def get_airport(cls, iata_code: str) -> Airport:
        """Get Airport object from IATA code using airportsdata."""
        code = iata_code.upper()

        # Check custom overrides first
        if code in cls._custom_airports:
            data = cls._custom_airports[code]
            return Airport(
                code=code,
                timezone=data['timezone'],
                latitude=data['lat'],
                longitude=data['lon']
            )

        # Primary lookup: airportsdata
        entry = _IATA_DB.get(code)
        if entry:
            return Airport(
                code=entry['iata'],
                timezone=entry['tz'],
                latitude=entry['lat'],
                longitude=entry['lon']
            )

        # Fallback for unknown airports to prevent crash
        print(f"⚠️ Airport '{code}' not found in airportsdata ({len(_IATA_DB)} entries). Using UTC default.")
        return Airport(
            code=code,
            timezone='UTC',
            latitude=0.0,
            longitude=0.0
        )

    @classmethod
    def add_custom_airport(cls, iata: str, name: str, timezone: str, lat: float, lon: float):
        """Add/override airport at runtime (for codes not in airportsdata)."""
        cls._custom_airports[iata.upper()] = {
            'name': name,
            'timezone': timezone,
            'lat': lat,
            'lon': lon
        }
        print(f"✓ Added custom airport {iata} ({name})")

# ============================================================================
# PDF PARSER (CrewLink, Generic Airline Rosters)
# ============================================================================

class PDFRosterParser:
    """
    Parse PDF rosters from airline crew management systems
    
    Supports multiple formats:
    - Qatar Airways CrewLink
    - Generic tabular PDF
    - Text-based duty listings
    """
    
    def __init__(self, home_base: str = 'DOH', home_timezone: str = 'Asia/Qatar',
                 timezone_format: str = 'auto'):
        """
        Args:
            home_base: Home base airport code (e.g., 'DOH')
            home_timezone: Home base IANA timezone (e.g., 'Asia/Qatar')
            timezone_format: How times in the roster should be interpreted.
                'auto' - detect from PDF header (default)
                'local' - times are in each airport's local timezone
                'homebase' - times are in home base timezone
                'zulu' - times are in UTC
        """
        self.home_base = home_base
        self.home_timezone = home_timezone
        self.timezone_format = timezone_format
        self.airport_db = AirportDatabase()
        self.roster_year = datetime.now().year  # Default, will be updated from PDF
    
    def parse_pdf(self, pdf_path: str, pilot_id: str, month: str) -> Roster:
        """
        Main entry point - extract roster from PDF
        """
        print(f"📄 Parsing PDF roster: {pdf_path}")
        
        # Extract text from PDF
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() + "\n"
        
        # Extract the Roster Period Year
        self._extract_roster_year(full_text)

        # Pre-extract Header Info (Robust Regex for ID/Name)
        header_info = self._extract_header_info(full_text)
        
        # Detect roster format
        roster_format = self._detect_format(full_text)
        print(f"   Detected format: {roster_format}")
        
        pilot_info = {} 
        duties = []

        if roster_format == 'crewlink' or roster_format == 'generic':
            # Try specialized CrewLink-style grid parser first
            try:
                print("   Attempting CrewLink grid-format parser...")
                grid_parser = CrewLinkRosterParser(timezone_format=self.timezone_format)
                result = grid_parser.parse_roster(pdf_path)
                duties = result['duties']
                pilot_info = result.get('pilot_info', {})
                # Capture the effective timezone format (may differ from input
                # if 'auto' was specified — the grid parser auto-detects it)
                self.effective_timezone_format = grid_parser.timezone_format

                # Report unknown airports if any
                if result.get('unknown_airports'):
                    print(f"   ⚠️  Found {len(result['unknown_airports'])} unknown airports:")
                    for code in sorted(result['unknown_airports']):
                        print(f"      - {code}")

                if duties:
                    print(f"   ✅ Grid parser succeeded")
                else:
                    print(f"   ℹ️  Grid parser found no duties - Switching to Line Parser")
                    raise ValueError("Grid parser returned empty duties")

            except Exception as e:
                print(f"   ⚠️  Grid parser: {e}")

                # Fall back to line-based parser (Handles the messy "text soup")
                # Line parser always treats times as home base timezone
                print("   Trying line-based CrewLink parser (Stateful)...")
                duties = self._parse_crewlink_format(full_text)
                self.effective_timezone_format = 'homebase'
        
        elif roster_format == 'tabular':
            duties = self._parse_tabular_format(full_text)
        
        else:
            duties = self._parse_generic_format(full_text)
       
        # MERGE LOGIC: Prioritize the Header Extraction for ID/Name
        final_pilot_id = header_info.get('id') or pilot_info.get('id') or pilot_id
        final_pilot_name = header_info.get('name') or pilot_info.get('name')
        final_base = header_info.get('base') or pilot_info.get('base') or self.home_base
        final_aircraft = header_info.get('aircraft') or pilot_info.get('aircraft')

        # Auto-derive roster month from PDF period (e.g. "Mar" + 2026 → "2026-03").
        # The API default month param is a placeholder; the PDF is authoritative.
        pdf_month_abbr = pilot_info.get('month')  # e.g. "Mar"
        pdf_year = pilot_info.get('year')          # e.g. 2026
        if pdf_month_abbr and pdf_year:
            try:
                pdf_month_num = datetime.strptime(pdf_month_abbr, '%b').month
                month = f"{pdf_year}-{pdf_month_num:02d}"
            except ValueError:
                pass  # Keep API-supplied month if parsing fails

        print(f"   Found Pilot: {final_pilot_name} (ID: {final_pilot_id})")
        print(f"   Base: {final_base} | Aircraft: {final_aircraft}")

        roster = Roster(
            roster_id=f"R_{final_pilot_id}_{month}",
            pilot_id=final_pilot_id,
            pilot_name=final_pilot_name,
            pilot_base=final_base,
            pilot_aircraft=final_aircraft,
            month=month,
            duties=duties,
            home_base_timezone=self.home_timezone
        )

        # Auto-detect augmented crew / ULR duties
        auto_detect_crew_augmentation(roster)

        print(f"✓ Parsed {len(duties)} duties, {roster.total_sectors} sectors")
        return roster
    
    def _extract_roster_year(self, text: str):
        """Extract year from 'Period: 01-Aug-2025' line"""
        match = re.search(r'Period:.*(\d{4})', text)
        if match:
            self.roster_year = int(match.group(1))
            print(f"   Confirmed Roster Year: {self.roster_year}")

    def _extract_header_info(self, text: str) -> Dict[str, str]:
        """
        Robustly extract Pilot Header details using Regex
        Matches format: Name: XXXX \n ID:134614 (DOH CP-A320)
        """
        # AGGRESSIVE cleaning of PDF artifacts
        text = re.sub(r'\(cid:\d+\)', '', text)  # Remove (cid:X) markers
        text = re.sub(r'[\x00-\x1F\x7F]', ' ', text)  # Remove control characters
        
        info = {}
        
        # DEBUG: Show what we're working with
        if 'ID' in text:
            id_context = text[text.find('ID'):text.find('ID')+100]
            print(f"   [DEBUG] Text around ID: {repr(id_context)}")
        else:
            print(f"   [DEBUG] 'ID' keyword not found in text")
        
        # 1. Extract ID - MORE FLEXIBLE pattern
        # Match ID followed by digits, allowing for spaces/junk between digits
        id_match = re.search(r'ID\s*[:]\s*([\d\s]+)', text, re.IGNORECASE)
        if id_match:
            # Clean up the captured digits (remove spaces)
            raw_id = id_match.group(1)
            clean_id = re.sub(r'\D', '', raw_id)  # Keep only digits
            if clean_id:
                info['id'] = clean_id
                print(f"   [DEBUG] Extracted ID: '{clean_id}' (raw: '{raw_id.strip()}')")
        else:
            print(f"   [DEBUG] ID extraction FAILED")

        # 2. Extract Name - Stop at "All times", "ID", or newline
        name_match = re.search(r'Name\s*[:]\s*(.+?)(?=\s+All times|\s+ID|\n|$)', text, re.IGNORECASE)
        if name_match:
            info['name'] = name_match.group(1).strip()
            print(f"   [DEBUG] Extracted Name: '{info['name']}'")

        # 3. Extract Base and Aircraft from parens
        # Looks for patterns like (DOH CP-A320) or (DOH FO-A320)
        details_match = re.search(r'\(([A-Z]{3})\s+[A-Z]{2}-([A-Z0-9\-]+)\)', text)
        if details_match:
            info['base'] = details_match.group(1)      # e.g. DOH
            info['aircraft'] = details_match.group(2)  # e.g. A320
            print(f"   [DEBUG] Extracted Base: {info['base']}, Aircraft: {info['aircraft']}")
            
        return info

    def _detect_format(self, text: str) -> str:
        """Auto-detect roster format from content"""
        text_lower = text.lower()
        
        # Explicit Qatar Airways CrewLink indicators
        if 'crewlink' in text_lower or 'qatar airways' in text_lower or 'qatar' in text_lower:
            return 'crewlink'
        
        # Grid format indicators
        date_pattern_count = len(re.findall(r'\d{2}[A-Z][a-z]{2}', text))
        if date_pattern_count >= 5: 
            return 'crewlink'
        
        return 'generic'
    
    def _parse_crewlink_format(self, text: str) -> List[Duty]:
        """
        Parse Qatar Airways CrewLink PDF format (Stateful "Soup" Parser)
        
        Handles fragmented text where RPT (Report/Sign-in) appears 
        before the flight details, distinct from the flight row.
        """
        duties = []
        lines = text.split('\n')
        
        current_duty_flights = []
        current_date = None
        current_report_time = None  # Store RPT when found
        current_release_time = None
        
        # Regex for "RPT:HH:MM" tag
        rpt_pattern = re.compile(r'RPT:(\d{2}:\d{2})')
        
        # Regex for date headers like "01Aug" or "01Aug Fri"
        date_pattern = re.compile(r'(\d{2}[A-Z][a-z]{2})')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 1. Capture Date (e.g., "01Aug")
            # We need this to anchor the duty
            date_match = date_pattern.search(line)
            if date_match:
                try:
                    date_str = date_match.group(1)
                    current_date = self._parse_partial_date(date_str)
                except ValueError:
                    pass

            # 2. Capture Report Time (RPT)
            # Looks for "RPT:07:30" anywhere in the line
            rpt_match = rpt_pattern.search(line)
            if rpt_match:
                # If we find a NEW report time, finalize previous duty
                if current_duty_flights:
                    # Use date of first flight for the previous duty
                    duty_date = current_duty_flights[0].date_obj if hasattr(current_duty_flights[0], 'date_obj') else current_date
                    duty = self._build_duty_from_flights(
                        current_duty_flights,
                        duty_date,
                        current_report_time,
                        "00:00"  # fallback release if not captured
                    )
                    duties.append(duty)
                    current_duty_flights = []
                
                current_report_time = rpt_match.group(1)
                
            # 3. Capture Flight Info
            # Matches: 1044 DOH 08:45 AUH 09:55
            flight_match = self._extract_flight_data_loose(line)
            
            if flight_match and current_date:
                flight_num, dep, std, arr, sta = flight_match
                
                # Parse the segment
                segment = self._parse_flight_segment(
                    flight_num, dep, arr, 
                    current_date.strftime('%d-%b-%Y'),
                    std, sta
                )
                segment.date_obj = current_date  # Store for reference
                
                current_duty_flights.append(segment)

        # 4. Save any remaining duty at end of file
        if current_duty_flights and current_report_time:
            duty_date = current_duty_flights[0].date_obj if hasattr(current_duty_flights[0], 'date_obj') else current_date
            duty = self._build_duty_from_flights(
                current_duty_flights,
                duty_date,
                current_report_time,
                "00:00"
            )
            duties.append(duty)
            
        return duties

    def _extract_flight_data_loose(self, line: str) -> Optional[Tuple]:
        """
        Regex for raw flight strings
        Matches: "1044 DOH 08:45 AUH 09:55"
        """
        pattern = r'(\d{3,4})\s+([A-Z]{3})\s+(\d{2}:\d{2})\s+([A-Z]{3})\s+(\d{2}:\d{2}(?:\+\d)?)'
        match = re.search(pattern, line)
        if match:
            return match.groups()
        return None

    def _parse_partial_date(self, date_str: str) -> datetime:
        """Handle '01Aug' -> datetime object with correct year"""
        dt = datetime.strptime(date_str, '%d%b')
        return dt.replace(year=self.roster_year)

    def _parse_flight_segment(self, flight_num: str, dep_code: str, arr_code: str, date_str: str, std_str: str, sta_str: str) -> FlightSegment:
        dep_airport = self.airport_db.get_airport(dep_code)
        arr_airport = self.airport_db.get_airport(arr_code)
        
        try:
            date = datetime.strptime(date_str, '%d-%b-%Y')
        except ValueError:
             date = datetime.strptime(date_str, '%d-%b-%y')

        std_time = datetime.strptime(std_str, '%H:%M').time()
        
        if '+' in sta_str:
            sta_str_clean = sta_str.split('+')[0]
            days_offset = int(sta_str.split('+')[1])
        else:
            sta_str_clean = sta_str
            days_offset = 0
        
        sta_time = datetime.strptime(sta_str_clean, '%H:%M').time()
        
        dep_tz = pytz.timezone(dep_airport.timezone)
        arr_tz = pytz.timezone(arr_airport.timezone)
        
        std_local = dep_tz.localize(datetime.combine(date, std_time))
        sta_local = arr_tz.localize(datetime.combine(date + timedelta(days=days_offset), sta_time))
        
        std_utc = std_local.astimezone(pytz.utc)
        sta_utc = sta_local.astimezone(pytz.utc)
        
        return FlightSegment(
            flight_number=flight_num,
            departure_airport=dep_airport,
            arrival_airport=arr_airport,
            scheduled_departure_utc=std_utc,
            scheduled_arrival_utc=sta_utc
        )
    
    def _validate_duty_times(self, report_utc: datetime, release_utc: datetime, 
                            segments: List[FlightSegment], date: datetime) -> Tuple[datetime, datetime, List[str]]:
        """
        Validate and correct duty times to ensure chronological consistency.
        
        Returns:
            Tuple of (corrected_report_utc, corrected_release_utc, warnings)
        """
        warnings = []
        corrected_report = report_utc
        corrected_release = release_utc
        
        if not segments:
            return corrected_report, corrected_release, warnings
        
        first_departure = segments[0].scheduled_departure_utc
        last_arrival = segments[-1].scheduled_arrival_utc
        
        # Check if report time is after first departure (likely wrong day)
        if corrected_report > first_departure:
            # Move report to previous day
            corrected_report = corrected_report - timedelta(days=1)
            warnings.append(f"Report time moved to previous day (was after first departure)")
        
        # Validate report is before first departure (with reasonable buffer)
        time_before_departure = (first_departure - corrected_report).total_seconds() / 3600
        if time_before_departure < 0.5:  # Less than 30 minutes before departure
            warnings.append(f"Warning: Report time only {time_before_departure*60:.0f}min before departure")
        elif time_before_departure > 4:  # More than 4 hours before departure
            warnings.append(f"Note: Report time {time_before_departure:.1f}h before departure (long pre-flight)")
        
        # Validate release time is after last arrival
        if corrected_release < last_arrival:
            # Release must be at least 30 min after landing
            corrected_release = last_arrival + timedelta(minutes=30)
            warnings.append(f"Release time adjusted to 30min after last landing")
        
        # Final check: ensure report < release
        if corrected_report >= corrected_release:
            warnings.append(f"ERROR: Invalid duty - report time >= release time")
        
        return corrected_report, corrected_release, warnings

    def _build_duty_from_flights(self, segments: List[FlightSegment], date: datetime, report_str: str, release_str: str) -> Duty:
        report_time_obj = datetime.strptime(report_str, '%H:%M').time()
        
        if '+' in release_str:
            release_str_clean = release_str.split('+')[0]
            days_offset = int(release_str.split('+')[1])
        else:
            release_str_clean = release_str
            days_offset = 0
        
        release_time_obj = datetime.strptime(release_str_clean, '%H:%M').time()
        
        home_tz = pytz.timezone(self.home_timezone)

        report_local = home_tz.localize(datetime.combine(date, report_time_obj))
        release_local = home_tz.localize(datetime.combine(date + timedelta(days=days_offset), release_time_obj))
        
        report_utc = report_local.astimezone(pytz.utc)
        release_utc = release_local.astimezone(pytz.utc)
        
        # Validate and correct times
        report_utc, release_utc, validation_warnings = self._validate_duty_times(
            report_utc, release_utc, segments, date
        )
        
        # Log any warnings
        for warning in validation_warnings:
            print(f"  ⚠️  {warning}")
        
        duty_id = f"D_{date.strftime('%Y%m%d')}_{segments[0].flight_number}"
        
        return Duty(
            duty_id=duty_id,
            date=date,
            report_time_utc=report_utc,
            release_time_utc=release_utc,
            segments=segments,
            home_base_timezone=self.home_timezone
        )
    
    def _parse_tabular_format(self, text: str) -> List[Duty]:
        raise NotImplementedError("Tabular PDF format parser not yet implemented.")
    
    def _parse_generic_format(self, text: str) -> List[Duty]:
        raise NotImplementedError("Generic format parser failed to identify roster structure.")

# ============================================================================
# CSV PARSER
# ============================================================================

class CSVRosterParser:
    """Parse CSV exports from crew management systems"""
    
    def __init__(self, home_base: str = 'DOH', home_timezone: str = 'Asia/Qatar'):
        self.home_base = home_base
        self.home_timezone = home_timezone
        self.airport_db = AirportDatabase()
    
    def parse_csv(self, csv_path: str, pilot_id: str, month: str) -> Roster:
        """Parse CSV roster file"""
        print(f"📊 Parsing CSV roster: {csv_path}")
        df = pd.read_csv(csv_path)
        
        if 'Flight' in df.columns:
            duties = self._parse_simple_csv(df)
        else:
            raise NotImplementedError("Multi-sector CSV parser not yet implemented")
        
        roster = Roster(
            roster_id=f"R_{pilot_id}_{month}",
            pilot_id=pilot_id,
            month=month,
            duties=duties,
            home_base_timezone=self.home_timezone
        )

        # Auto-detect augmented crew / ULR duties
        auto_detect_crew_augmentation(roster)

        print(f"✓ Parsed {len(duties)} duties, {roster.total_sectors} sectors")
        return roster
    
    def _parse_simple_csv(self, df: pd.DataFrame) -> List[Duty]:
        duties = []
        current_duty_flights = []
        last_report = None
        last_date = None
        last_release = None
        
        for _, row in df.iterrows():
            segment = self._parse_csv_flight(row)
            
            if last_report and row['Report'] != last_report:
                duty = self._build_csv_duty(
                    current_duty_flights,
                    last_date,
                    last_report,
                    last_release
                )
                duties.append(duty)
                current_duty_flights = []
            
            current_duty_flights.append(segment)
            last_report = row['Report']
            last_release = row['Release']
            last_date = row['Date']
        
        if current_duty_flights:
            duty = self._build_csv_duty(
                current_duty_flights,
                last_date,
                last_report,
                last_release
            )
            duties.append(duty)
        
        return duties
    
    def _parse_csv_flight(self, row: pd.Series) -> FlightSegment:
        dep = self.airport_db.get_airport(row['Departure'])
        arr = self.airport_db.get_airport(row['Arrival'])
        
        date = pd.to_datetime(row['Date'])
        std_time = pd.to_datetime(row['STD'], format='%H:%M').time()
        sta_time = pd.to_datetime(row['STA'], format='%H:%M').time()
        
        dep_tz = pytz.timezone(dep.timezone)
        arr_tz = pytz.timezone(arr.timezone)
        
        std_utc = dep_tz.localize(datetime.combine(date, std_time)).astimezone(pytz.utc)
        sta_utc = arr_tz.localize(datetime.combine(date, sta_time)).astimezone(pytz.utc)
        
        return FlightSegment(
            flight_number=row['Flight'],
            departure_airport=dep,
            arrival_airport=arr,
            scheduled_departure_utc=std_utc,
            scheduled_arrival_utc=sta_utc
        )
    
    def _build_csv_duty(self, segments: List[FlightSegment], date: str, report: str, release: str) -> Duty:
        date_obj = pd.to_datetime(date)
        report_time = pd.to_datetime(report, format='%H:%M').time()
        release_time = pd.to_datetime(release, format='%H:%M').time()
        
        home_tz = pytz.timezone(self.home_timezone)
        
        report_utc = home_tz.localize(datetime.combine(date_obj, report_time)).astimezone(pytz.utc)
        release_utc = home_tz.localize(datetime.combine(date_obj, release_time)).astimezone(pytz.utc)
        
        duty_id = f"D_{date_obj.strftime('%Y%m%d')}_{segments[0].flight_number}"
        
        return Duty(
            duty_id=duty_id,
            date=date_obj,
            report_time_utc=report_utc,
            release_time_utc=release_utc,
            segments=segments,
            home_base_timezone=self.home_timezone
        )
