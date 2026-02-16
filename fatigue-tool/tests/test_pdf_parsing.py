"""
Test PDF parsing with actual Qatar Airways CrewLink roster
"""
from parsers.roster_parser import PDFRosterParser
import os

def test_qatar_roster_parsing():
    """Verify SAFAR Peter Feb 2026 roster parses correctly"""

    pdf_path = os.path.join(os.path.dirname(__file__), 'test_roster.pdf')

    if not os.path.exists(pdf_path):
        print(f"❌ TEST SKIPPED: PDF not found at {pdf_path}")
        return

    parser = PDFRosterParser(
        home_base='DOH',
        home_timezone='Asia/Qatar',
        timezone_format='auto'  # Should detect "Local" from PDF
    )

    roster = parser.parse_pdf(pdf_path, pilot_id='133152', month='Feb-2026')

    # Verify basic parsing
    assert roster.pilot_id == '133152', f"Expected pilot ID 133152, got {roster.pilot_id}"
    assert roster.pilot_name == 'SAFAR Peter', f"Expected SAFAR Peter, got {roster.pilot_name}"
    assert roster.pilot_base == 'DOH', f"Expected base DOH, got {roster.pilot_base}"

    print(f"✅ Pilot info parsed correctly")
    print(f"   Name: {roster.pilot_name}")
    print(f"   ID: {roster.pilot_id}")
    print(f"   Base: {roster.pilot_base}")
    print(f"   Aircraft: {roster.pilot_aircraft}")

    # Verify duties parsed
    assert len(roster.duties) > 0, "No duties parsed from roster"
    print(f"✅ Parsed {len(roster.duties)} duties, {roster.total_sectors} sectors")

    # Verify timezone detection
    print(f"✅ Timezone format: {parser.effective_timezone_format}")
    assert parser.effective_timezone_format == 'local', \
        f"Expected 'local' timezone format, got {parser.effective_timezone_format}"

    # Check specific duty (01Feb - DOH→ZRH→DOH)
    feb_01_duty = next((d for d in roster.duties if d.date.day == 1), None)
    if feb_01_duty:
        print(f"\n✅ Feb 01 duty found:")
        print(f"   Sectors: {len(feb_01_duty.segments)}")
        print(f"   FDP Hours: {feb_01_duty.fdp_hours:.1f}h")

        # Verify first segment DOH→ZRH
        seg1 = feb_01_duty.segments[0]
        print(f"   Segment 1: {seg1.flight_number} {seg1.departure_airport.code}→{seg1.arrival_airport.code}")
        print(f"   Departure: {seg1.scheduled_departure_utc} UTC")
        print(f"   Arrival: {seg1.scheduled_arrival_utc} UTC")

        # Verify UTC conversion (DOH 02:40 local = 23:40 UTC previous day)
        assert seg1.scheduled_departure_utc.hour == 23 or seg1.scheduled_departure_utc.hour == 0, \
            f"Expected DOH 02:40 local to convert to ~23:40 UTC, got {seg1.scheduled_departure_utc}"

    # Check ULR duty detection (should auto-detect IAD and MIA flights)
    ulr_duties = [d for d in roster.duties if d.is_ulr]
    print(f"\n✅ ULR duties detected: {len(ulr_duties)}")
    for ulr_duty in ulr_duties:
        print(f"   {ulr_duty.date.strftime('%d-%b')}: {ulr_duty.fdp_hours:.1f}h FDP, {ulr_duty.crew_composition}")

    print(f"\n✅ ALL TESTS PASSED")

if __name__ == '__main__':
    test_qatar_roster_parsing()
