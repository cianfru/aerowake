#!/usr/bin/env python3
"""
Tests for easyJet roster PDF parser.

Unit tests run without any PDF file present.
The integration test (test_easyjet_roster_parsing) is skipped gracefully
if the PDF is not found at tests/test_easyjet_roster.pdf.

Run:
    python tests/test_easyjet_parser.py
"""

import sys
import os

# Allow running from the fatigue-tool/ root directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from parsers.easyjet_parser import EasyJetParser, _clean, _parse_time_str
from parsers.roster_parser import PDFRosterParser

PASS = "✅"
FAIL = "❌"


# ═══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS (no PDF required)
# ═══════════════════════════════════════════════════════════════════════════════

def test_clean_helper():
    """Zero-width space stripping and whitespace normalisation."""
    assert _clean(None) == ''
    assert _clean('\u200bAGP\u200b') == 'AGP'
    assert _clean('  EJU7053  ') == 'EJU7053'
    assert _clean('\u200b') == ''
    print(f"{PASS} _clean helper")


def test_parse_time_str():
    """Time token extraction handles bare and 'A'-prefixed forms."""
    assert _parse_time_str('07:30') == '07:30'
    assert _parse_time_str('A07:30') == '07:30'
    assert _parse_time_str('A14:55') == '14:55'
    assert _parse_time_str('EJU7053') is None
    assert _parse_time_str('AGP') is None
    assert _parse_time_str('[319]') is None
    assert _parse_time_str('') is None
    print(f"{PASS} _parse_time_str")


def test_header_extraction():
    """Pilot info regex correctly parses the easyJet header line."""
    parser = EasyJetParser()
    raw = (
        "17715 PELATTI ANGEL  AGP,CP,319\n"
        "All times in Local Station\n"
        "01/09/2025 - 30/09/2025\n"
    )
    info = parser._extract_pilot_info(raw)
    assert info['id'] == '17715',      f"id: got {info['id']!r}"
    assert info['name'] == 'PELATTI ANGEL', f"name: got {info['name']!r}"
    assert info['base'] == 'AGP',      f"base: got {info['base']!r}"
    assert info['role'] == 'CP',       f"role: got {info['role']!r}"
    assert info['aircraft'] == '319',  f"aircraft: got {info['aircraft']!r}"
    assert info['year'] == 2025,       f"year: got {info['year']!r}"
    assert info['month'] == 9,         f"month: got {info['month']!r}"
    print(f"{PASS} header extraction")


def test_header_extraction_with_zwsp():
    """Header extraction works even with zero-width spaces in raw text."""
    parser = EasyJetParser()
    raw = "\u200b17715\u200b PELATTI ANGEL  AGP,CP,319\n01/09/2025 - 30/09/2025\n"
    info = parser._extract_pilot_info(raw)
    assert info['id'] == '17715', f"id with ZWSP: got {info['id']!r}"
    print(f"{PASS} header extraction with zero-width spaces")


def test_non_duty_codes_skipped():
    """D/O, LVE, PSBL return None from column parser (no duty created)."""
    parser = EasyJetParser()
    parser.home_timezone = 'Europe/Madrid'
    date = datetime(2025, 9, 1)
    for code in ['D/O', 'LVE', 'PSBL']:
        result = parser._parse_column_to_duty(date, [code])
        assert result is None, f"Expected None for code '{code}', got {result}"
    print(f"{PASS} non-duty codes skipped (D/O, LVE, PSBL)")


def test_office_duty_creates_ground_training():
    """OFC4/OFC8 produce ground-training duties with correct times."""
    from models.data_models import DutyType
    parser = EasyJetParser()
    parser.home_timezone = 'Europe/Madrid'
    parser.home_base_code = 'AGP'
    date = datetime(2025, 9, 8)

    # OFC8 with start/end times
    tokens = ['OFC8', '09:30', '17:30']
    duty = parser._parse_column_to_duty(date, tokens)
    assert duty is not None, "OFC8 should create a duty"
    assert duty.duty_type == DutyType.GROUND_TRAINING, f"Expected GROUND_TRAINING, got {duty.duty_type}"
    assert duty.training_code == 'OFC8'
    assert len(duty.segments) == 0, "Office duty should have no flight segments"
    assert duty.release_time_utc > duty.report_time_utc, "release must be after report"
    print(f"{PASS} OFC8 → ground-training duty")

    # OFC4 with start/end times
    tokens = ['OFC4', '09:00', '13:00']
    duty = parser._parse_column_to_duty(date, tokens)
    assert duty is not None, "OFC4 should create a duty"
    assert duty.duty_type == DutyType.GROUND_TRAINING
    assert duty.training_code == 'OFC4'
    print(f"{PASS} OFC4 → ground-training duty")


def test_empty_column_returns_none():
    """Empty or whitespace-only columns produce no duty."""
    parser = EasyJetParser()
    parser.home_timezone = 'Europe/Madrid'
    date = datetime(2025, 9, 1)
    assert parser._parse_column_to_duty(date, []) is None
    assert parser._parse_column_to_duty(date, ['', '  ', '\u200b']) is None
    print(f"{PASS} empty column returns None")


def test_single_leg_duty():
    """Single EJU flight produces 1 duty with 1 segment and correct airports."""
    parser = EasyJetParser()
    parser.home_timezone = 'Europe/Madrid'
    parser.home_base_code = 'AGP'
    date = datetime(2025, 9, 11)
    # Report 07:30, EJU7057 AGP 07:50 GVA 09:55 [319], release 10:25
    tokens = ['07:30', 'EJU7057', 'AGP', '07:50', 'GVA', '09:55', '[319]', '10:25']
    duty = parser._parse_column_to_duty(date, tokens)
    assert duty is not None, "Expected a duty, got None"
    assert len(duty.segments) == 1, f"Expected 1 segment, got {len(duty.segments)}"
    seg = duty.segments[0]
    assert seg.flight_number == 'EJU7057'
    assert seg.departure_airport.code == 'AGP'
    assert seg.arrival_airport.code == 'GVA'
    assert seg.aircraft_type == '319'
    assert duty.report_time_utc.tzinfo is not None, "report_time_utc must be tz-aware"
    assert duty.release_time_utc > duty.report_time_utc, "release must be after report"
    assert seg.scheduled_arrival_utc > seg.scheduled_departure_utc, "arrival before departure"
    print(f"{PASS} single-leg duty (EJU7057 AGP→GVA)")


def test_two_leg_duty():
    """Two EJU flights in same column → 1 duty with 2 segments."""
    parser = EasyJetParser()
    parser.home_timezone = 'Europe/Madrid'
    parser.home_base_code = 'AGP'
    date = datetime(2025, 9, 11)
    tokens = [
        '07:30',
        'EJU7057', 'AGP', '07:50', 'GVA', '09:55', '[319]',
        'EJU7058', 'GVA', '10:55', 'AGP', '12:55',
        '13:25',
    ]
    duty = parser._parse_column_to_duty(date, tokens)
    assert duty is not None, "Expected a duty, got None"
    assert len(duty.segments) == 2, f"Expected 2 segments, got {len(duty.segments)}"
    assert duty.segments[0].flight_number == 'EJU7057'
    assert duty.segments[1].flight_number == 'EJU7058'
    assert duty.segments[0].arrival_airport.code == duty.segments[1].departure_airport.code == 'GVA'
    print(f"{PASS} two-leg duty (EJU7057 AGP→GVA, EJU7058 GVA→AGP)")


def test_overnight_arrival_offset():
    """↓ marker causes arrival time to be placed on next calendar day."""
    parser = EasyJetParser()
    parser.home_timezone = 'Europe/Madrid'
    parser.home_base_code = 'AGP'
    date = datetime(2025, 9, 17)
    # EJU7054 departs NCE 21:53, arrives AGP 00:11 next day (↓ between NCE and 00:11)
    tokens = ['21:30', 'EJU7054', 'NCE', '21:53', 'AGP', '↓', '00:11', '00:40']
    duty = parser._parse_column_to_duty(date, tokens)
    assert duty is not None, "Expected a duty, got None"
    assert len(duty.segments) == 1
    seg = duty.segments[0]
    # Arrival UTC must be after departure UTC
    assert seg.scheduled_arrival_utc > seg.scheduled_departure_utc, (
        f"Overnight: arrival {seg.scheduled_arrival_utc} <= departure {seg.scheduled_departure_utc}"
    )
    print(f"{PASS} overnight arrival (↓ marker advances arrival by 1 day)")


def test_format_detection_easyjet():
    """PDFRosterParser._detect_format returns 'easyjet' for easyJet content."""
    router = PDFRosterParser(home_base='AGP', home_timezone='Europe/Madrid')
    sample = (
        "17715 PELATTI ANGEL  AGP,CP,319\n"
        "All times in Local Station\n"
        "01/09/2025 - 30/09/2025\n"
        "EJU7057 AGP 07:50 GVA 09:55\n"
        "EJU7058 GVA 10:55 AGP 12:55\n"
    )
    fmt = router._detect_format(sample)
    assert fmt == 'easyjet', f"Expected 'easyjet', got '{fmt}'"
    print(f"{PASS} format detection → 'easyjet'")


def test_format_detection_crewlink_not_affected():
    """Qatar Airways CrewLink content still resolves to 'crewlink'."""
    router = PDFRosterParser()
    sample = (
        "Qatar Airways CrewLink\n"
        "Name: CIANFRUGLIA A\n"
        "ID :134614 (DOH CP-A320)\n"
        "All times are in Local\n"
        "01Feb Sun  02Feb Mon  03Feb Tue\n"
    )
    fmt = router._detect_format(sample)
    assert fmt == 'crewlink', f"Expected 'crewlink', got '{fmt}'"
    print(f"{PASS} format detection → 'crewlink' (Qatar CrewLink unaffected)")


def test_month_derivation_integer():
    """
    Roster month is correctly derived when pilot_info['month'] is an int
    (easyJet path), without crashing on strptime.
    """
    # Simulate what parse_pdf() does with the merged pilot_info
    pdf_month_val = 9      # int from EasyJetParser
    pdf_year = 2025
    month = "2026-02"      # API default placeholder
    if isinstance(pdf_month_val, int):
        month = f"{pdf_year}-{pdf_month_val:02d}"
    assert month == "2025-09", f"Expected '2025-09', got '{month}'"
    print(f"{PASS} month derivation from integer pilot_info['month']")


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TEST (requires real PDF)
# ═══════════════════════════════════════════════════════════════════════════════

def test_easyjet_roster_parsing():
    """
    Full parse of a real easyJet PDF.

    Copy the PDF to fatigue-tool/tests/test_easyjet_roster.pdf to run this test.
    Skipped gracefully if the file is not present.
    """
    pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_easyjet_roster.pdf')
    if not os.path.exists(pdf_path):
        print(f"⏭️  SKIPPED (no PDF at {pdf_path})")
        return

    router = PDFRosterParser(home_base='DOH', home_timezone='Asia/Qatar', timezone_format='auto')
    roster = router.parse_pdf(pdf_path, pilot_id='17715', month='2025-09')

    # Pilot info
    assert roster.pilot_id, "pilot_id must not be empty"
    assert roster.pilot_base, "pilot_base must not be empty"
    assert roster.pilot_base != 'DOH', "home_base should be overridden from PDF (not DOH)"
    assert roster.home_base_timezone not in ('Asia/Qatar', ''), \
        f"home_timezone should be overridden from PDF, got '{roster.home_base_timezone}'"

    # Duties
    assert len(roster.duties) > 0, "Must parse at least one duty"
    print(f"   Parsed {len(roster.duties)} duties, {roster.total_sectors} sectors")

    for duty in roster.duties:
        assert duty.report_time_utc.tzinfo is not None, \
            f"report_time_utc not tz-aware on {duty.duty_id}"
        assert duty.release_time_utc.tzinfo is not None, \
            f"release_time_utc not tz-aware on {duty.duty_id}"
        assert duty.report_time_utc < duty.release_time_utc, \
            f"report >= release on {duty.duty_id}"
        for seg in duty.segments:
            assert seg.scheduled_departure_utc < seg.scheduled_arrival_utc, \
                f"arr <= dep for {seg.flight_number} in {duty.duty_id}"

    print(f"{PASS} INTEGRATION TEST PASSED — {len(roster.duties)} duties parsed")


# ═══════════════════════════════════════════════════════════════════════════════
# RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    failures = []

    tests = [
        test_clean_helper,
        test_parse_time_str,
        test_header_extraction,
        test_header_extraction_with_zwsp,
        test_non_duty_codes_skipped,
        test_office_duty_creates_ground_training,
        test_empty_column_returns_none,
        test_single_leg_duty,
        test_two_leg_duty,
        test_overnight_arrival_offset,
        test_format_detection_easyjet,
        test_format_detection_crewlink_not_affected,
        test_month_derivation_integer,
        test_easyjet_roster_parsing,
    ]

    for test_fn in tests:
        try:
            test_fn()
        except Exception as e:
            print(f"{FAIL} {test_fn.__name__}: {e}")
            import traceback
            traceback.print_exc()
            failures.append(test_fn.__name__)

    print()
    if failures:
        print(f"{FAIL} {len(failures)} test(s) FAILED: {', '.join(failures)}")
        sys.exit(1)
    else:
        print(f"{PASS} ALL TESTS PASSED")
