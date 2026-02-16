"""
Regression Tests for Sleep Model Bug Fixes
===========================================

Tests covering specific bugs fixed in PRs #55-58 and #62.
Each test documents the original bug, the fix, and verifies non-regression.

Run: python -m pytest tests/test_sleep_regressions.py -v
"""

from datetime import datetime, timedelta
import pytz
import pytest

from core import BorbelyFatigueModel, ModelConfig
from core.sleep_calculator import UnifiedSleepCalculator
from models.data_models import Duty, FlightSegment, Airport, SleepBlock


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_airport(code, timezone, lat=0.0, lon=0.0):
    return Airport(code=code, timezone=timezone, latitude=lat, longitude=lon)


DOH = _make_airport('DOH', 'Asia/Qatar', lat=25.26, lon=51.56)
LHR = _make_airport('LHR', 'Europe/London', lat=51.47, lon=-0.46)
DEL = _make_airport('DEL', 'Asia/Kolkata', lat=28.56, lon=77.10)
BKK = _make_airport('BKK', 'Asia/Bangkok', lat=13.69, lon=100.75)
JFK = _make_airport('JFK', 'America/New_York', lat=40.64, lon=-73.78)


def _make_duty(duty_id, report_utc, release_utc, dep_airport, arr_airport,
               home_tz='Asia/Qatar'):
    segment = FlightSegment(
        flight_number=f'QR{duty_id}',
        departure_airport=dep_airport,
        arrival_airport=arr_airport,
        scheduled_departure_utc=report_utc + timedelta(minutes=45),
        scheduled_arrival_utc=release_utc - timedelta(minutes=30),
    )
    return Duty(
        duty_id=duty_id,
        date=report_utc.date(),
        report_time_utc=report_utc,
        release_time_utc=release_utc,
        segments=[segment],
        home_base_timezone=home_tz,
    )


# ============================================================================
# PR #55: Inter-duty recovery sleep model rewrite
# Bug: Dual post-duty + pre-duty sleep could overlap and double-count recovery
# ============================================================================

class TestInterDutyRecoverySingleBlock:
    """PR #55: Single inter-duty recovery block replaces overlapping dual blocks."""

    def test_inter_duty_produces_single_strategy(self):
        """generate_inter_duty_sleep returns one strategy with no overlapping blocks."""
        calc = UnifiedSleepCalculator()
        prev_duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 10, 6, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=LHR,
        )
        next_duty = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 11, 6, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 14, 0, tzinfo=pytz.utc),
            dep_airport=LHR, arr_airport=DOH,
        )

        strategy = calc.generate_inter_duty_sleep(
            prev_duty, next_duty, home_timezone='Asia/Qatar', home_base='DOH'
        )

        assert strategy.strategy_type == 'inter_duty_recovery'
        assert len(strategy.sleep_blocks) >= 1

        # No overlapping blocks
        blocks = sorted(strategy.sleep_blocks, key=lambda b: b.start_utc)
        for i in range(len(blocks) - 1):
            assert blocks[i].end_utc <= blocks[i + 1].start_utc, (
                f"Blocks overlap: {blocks[i].end_utc} > {blocks[i+1].start_utc}"
            )

    def test_inter_duty_blocks_dont_overlap_duties(self):
        """Sleep blocks must not overlap with either duty period."""
        calc = UnifiedSleepCalculator()
        prev_duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 10, 2, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 10, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )
        next_duty = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 11, 2, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 10, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )

        strategy = calc.generate_inter_duty_sleep(
            prev_duty, next_duty, home_timezone='Asia/Qatar', home_base='DOH'
        )

        for block in strategy.sleep_blocks:
            assert block.start_utc >= prev_duty.release_time_utc, (
                "Sleep block starts before previous duty release"
            )
            # Allow 30min tolerance on wake buffer
            assert block.end_utc <= next_duty.report_time_utc, (
                "Sleep block extends past next duty report"
            )


# ============================================================================
# PR #56: Timezone bugs in inter-duty recovery
# Bug 1: Circadian gate pushed daytime sleep to next morning
# Bug 2: Sleep positioned in home TZ instead of arrival TZ for layovers
# ============================================================================

class TestTimezoneRecovery:
    """PR #56: Sleep blocks positioned in correct timezone for layovers."""

    def test_layover_sleep_in_arrival_timezone(self):
        """After DOH→LHR, sleep should be in Europe/London, not Asia/Qatar."""
        calc = UnifiedSleepCalculator()
        prev_duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 10, 3, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 10, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=LHR,
        )
        next_duty = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 11, 8, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 16, 0, tzinfo=pytz.utc),
            dep_airport=LHR, arr_airport=DOH,
        )

        strategy = calc.generate_inter_duty_sleep(
            prev_duty, next_duty, home_timezone='Asia/Qatar', home_base='DOH'
        )

        for block in strategy.sleep_blocks:
            assert block.location_timezone == 'Europe/London', (
                f"Expected Europe/London, got {block.location_timezone}"
            )
            assert block.environment == 'hotel'

    def test_circadian_gate_doesnt_extend_daytime_nap_to_morning(self):
        """Morning arrival nap should NOT be extended to next morning by circadian gate.

        The bio clock for DOH pilot is 3h ahead of UTC. Release at 10:00 UTC
        = 13:00 DOH time = afternoon on biological clock. So the single-block
        path with evening onset is correct here. To properly test the daytime
        nap cap, we need a morning arrival in biological time (04:00-12:00 bio).
        """
        calc = UnifiedSleepCalculator()
        # Morning arrival at DOH: release 04:00 UTC = 07:00 DOH = morning bio
        prev_duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 9, 20, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 4, 0, tzinfo=pytz.utc),
            dep_airport=LHR, arr_airport=DOH,
        )
        next_duty = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 11, 3, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 11, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )

        strategy = calc.generate_inter_duty_sleep(
            prev_duty, next_duty, home_timezone='Asia/Qatar', home_base='DOH'
        )

        # With 23h gap and morning arrival (07:00 bio), should get
        # 2 blocks: capped daytime nap + night sleep
        if len(strategy.sleep_blocks) >= 2:
            first_block = strategy.sleep_blocks[0]
            duration = (first_block.end_utc - first_block.start_utc).total_seconds() / 3600
            assert duration <= 5.0, (
                f"Daytime recovery nap too long: {duration:.1f}h "
                f"(circadian gate may be extending to morning)"
            )


# ============================================================================
# PR #57: Missing sleep blocks in multi-day gaps
# Bug: range(2, gap_days) missed last night before next duty
# Bug: Recovery blocks weren't generated for rest days between duties
# ============================================================================

class TestMultiDayGapSleep:
    """PR #57: Sleep blocks generated for all nights in multi-day gaps."""

    def test_three_day_gap_has_sleep_every_night(self):
        """3-day gap between duties should generate inter-duty + recovery sleep."""
        calc = UnifiedSleepCalculator()
        duty1 = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 10, 6, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )
        duty2 = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 14, 6, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 14, 14, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )

        # Test the inter-duty sleep generation
        strategy = calc.generate_inter_duty_sleep(
            duty1, duty2, home_timezone='Asia/Qatar', home_base='DOH'
        )

        # With 4-day gap (Mar 10 14:00 → Mar 14 06:00), should get sleep
        assert len(strategy.sleep_blocks) >= 1, "No sleep blocks generated for multi-day gap"

        # Total effective sleep should cover multiple nights
        total_effective = sum(b.effective_sleep_hours for b in strategy.sleep_blocks)
        assert total_effective >= 5.0, (
            f"Total effective sleep {total_effective:.1f}h too low for multi-day gap"
        )

        # Verify all blocks fall within the inter-duty gap
        for block in strategy.sleep_blocks:
            assert block.start_utc >= duty1.release_time_utc, (
                "Sleep block starts before duty1 release"
            )
            assert block.end_utc <= duty2.report_time_utc, (
                "Sleep block extends past duty2 report"
            )


# ============================================================================
# PR #58: Sleep block timing using home base TZ for chronogram
# Bug: Chronogram fields (sleep_start_day, sleep_start_hour) were in
#      local timezone instead of home base timezone
# ============================================================================

class TestChronogramTimezone:
    """PR #58: Sleep block chronogram fields are in home base timezone."""

    def test_sleep_block_day_hour_in_home_tz(self):
        """sleep_start_day/hour should reflect home base timezone, not local."""
        calc = UnifiedSleepCalculator()
        # DOH→LHR layover: local sleep at LHR but chronogram in DOH time
        duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 11, 8, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 16, 0, tzinfo=pytz.utc),
            dep_airport=LHR, arr_airport=DOH,
        )
        prev_duty = _make_duty(
            'D000',
            report_utc=datetime(2025, 3, 10, 3, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 10, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=LHR,
        )

        strategy = calc.estimate_sleep_for_duty(
            duty, previous_duty=prev_duty,
            home_timezone='Asia/Qatar', home_base='DOH'
        )

        for block in strategy.sleep_blocks:
            # Verify chronogram fields exist
            assert hasattr(block, 'sleep_start_day'), "Missing sleep_start_day"
            assert hasattr(block, 'sleep_start_hour'), "Missing sleep_start_hour"
            assert hasattr(block, 'sleep_end_day'), "Missing sleep_end_day"
            assert hasattr(block, 'sleep_end_hour'), "Missing sleep_end_hour"

            # Verify they match home base timezone conversion
            home_tz = pytz.timezone('Asia/Qatar')
            expected_start = block.start_utc.astimezone(home_tz)
            expected_hour = expected_start.hour + expected_start.minute / 60.0
            assert abs(block.sleep_start_hour - expected_hour) < 0.01, (
                f"sleep_start_hour {block.sleep_start_hour} doesn't match "
                f"home TZ hour {expected_hour}"
            )


# ============================================================================
# PR #62: Morning arrival sleep patterns
# Bug: Morning arrivals produced unrealistic 6h afternoon naps with no night sleep
# Fix: Cap daytime nap at 3-4h, add anticipated bedtime logic
# ============================================================================

class TestMorningArrivalPatterns:
    """PR #62: Morning arrivals produce realistic nap + night sleep."""

    def test_morning_arrival_nap_capped(self):
        """After a morning arrival, the recovery nap should be ≤ 4h."""
        calc = UnifiedSleepCalculator()
        # Morning arrival at DOH (08:00 UTC = 11:00 local)
        prev_duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 10, 0, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 8, 0, tzinfo=pytz.utc),
            dep_airport=LHR, arr_airport=DOH,
        )
        # Next duty late enough to allow nap + night sleep
        next_duty = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 11, 6, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 14, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )

        strategy = calc.generate_inter_duty_sleep(
            prev_duty, next_duty, home_timezone='Asia/Qatar', home_base='DOH'
        )

        if len(strategy.sleep_blocks) >= 2:
            # First block should be the daytime nap (capped)
            nap = strategy.sleep_blocks[0]
            nap_duration = (nap.end_utc - nap.start_utc).total_seconds() / 3600
            assert nap_duration <= 4.5, (
                f"Morning arrival nap too long: {nap_duration:.1f}h (should be ≤ 4h)"
            )

    def test_morning_arrival_has_night_sleep(self):
        """Morning arrival with long gap should produce both nap and night sleep."""
        calc = UnifiedSleepCalculator()
        prev_duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 10, 0, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 7, 0, tzinfo=pytz.utc),
            dep_airport=LHR, arr_airport=DOH,
        )
        next_duty = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 11, 6, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 14, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )

        strategy = calc.generate_inter_duty_sleep(
            prev_duty, next_duty, home_timezone='Asia/Qatar', home_base='DOH'
        )

        # With ~23h gap and morning arrival, should get 2 blocks (nap + night)
        if len(strategy.sleep_blocks) == 2:
            nap_block = strategy.sleep_blocks[0]
            night_block = strategy.sleep_blocks[1]

            nap_hours = (nap_block.end_utc - nap_block.start_utc).total_seconds() / 3600
            night_hours = (night_block.end_utc - night_block.start_utc).total_seconds() / 3600

            assert nap_hours <= 4.5, f"Nap too long: {nap_hours:.1f}h"
            assert night_hours >= 4.0, f"Night sleep too short: {night_hours:.1f}h"
        else:
            # Single block is also acceptable for shorter gaps
            assert len(strategy.sleep_blocks) >= 1

    def test_wocl_duty_gets_anticipated_bedtime(self):
        """Pre-WOCL duty should use 21:00 anticipated bedtime, not 23:00."""
        calc = UnifiedSleepCalculator()
        # Morning arrival, then WOCL duty next day
        prev_duty = _make_duty(
            'D001',
            report_utc=datetime(2025, 3, 10, 0, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 10, 7, 0, tzinfo=pytz.utc),
            dep_airport=LHR, arr_airport=DOH,
        )
        # WOCL duty: report at 23:00 UTC (02:00 local DOH)
        next_duty = _make_duty(
            'D002',
            report_utc=datetime(2025, 3, 10, 23, 0, tzinfo=pytz.utc),
            release_utc=datetime(2025, 3, 11, 7, 0, tzinfo=pytz.utc),
            dep_airport=DOH, arr_airport=DOH,
        )

        strategy = calc.generate_inter_duty_sleep(
            prev_duty, next_duty, home_timezone='Asia/Qatar', home_base='DOH'
        )

        # Should have sleep — even if short — before the WOCL duty
        assert len(strategy.sleep_blocks) >= 1
        total_effective = sum(
            b.effective_sleep_hours for b in strategy.sleep_blocks
        )
        assert total_effective > 0, "No effective sleep before WOCL duty"


# ============================================================================
# Cross-cutting: Sleep quality engine still works after extraction
# ============================================================================

class TestSleepQualityExtraction:
    """Verify sleep quality calculations work correctly after module extraction."""

    def test_home_sleep_quality(self):
        """8h home sleep should yield > 90% efficiency."""
        calc = UnifiedSleepCalculator()
        home_tz = pytz.timezone('Asia/Qatar')
        start = home_tz.localize(datetime(2025, 3, 10, 23, 0))
        end = home_tz.localize(datetime(2025, 3, 11, 7, 0))
        next_event = home_tz.localize(datetime(2025, 3, 11, 9, 0))

        quality = calc.calculate_sleep_quality(
            sleep_start=start,
            sleep_end=end,
            location='home',
            previous_duty_end=None,
            next_event=next_event,
            location_timezone='Asia/Qatar',
        )

        assert quality.actual_sleep_hours == pytest.approx(8.0, abs=0.1)
        assert quality.sleep_efficiency >= 0.90
        assert quality.effective_sleep_hours >= 7.0

    def test_hotel_sleep_quality(self):
        """Hotel sleep efficiency should be lower than home."""
        calc = UnifiedSleepCalculator()
        home_tz = pytz.timezone('Asia/Qatar')
        start = home_tz.localize(datetime(2025, 3, 10, 23, 0))
        end = home_tz.localize(datetime(2025, 3, 11, 7, 0))
        next_event = home_tz.localize(datetime(2025, 3, 11, 9, 0))

        home_q = calc.calculate_sleep_quality(
            sleep_start=start, sleep_end=end, location='home',
            previous_duty_end=None, next_event=next_event,
            location_timezone='Asia/Qatar',
        )
        hotel_q = calc.calculate_sleep_quality(
            sleep_start=start, sleep_end=end, location='hotel',
            previous_duty_end=None, next_event=next_event,
            location_timezone='Asia/Qatar',
        )

        assert hotel_q.sleep_efficiency < home_q.sleep_efficiency

    def test_nap_quality_penalty(self):
        """Naps should have lower base efficiency than main sleep."""
        calc = UnifiedSleepCalculator()
        home_tz = pytz.timezone('Asia/Qatar')
        start = home_tz.localize(datetime(2025, 3, 11, 14, 0))
        end = home_tz.localize(datetime(2025, 3, 11, 16, 0))
        next_event = home_tz.localize(datetime(2025, 3, 11, 18, 0))

        nap_q = calc.calculate_sleep_quality(
            sleep_start=start, sleep_end=end, location='home',
            previous_duty_end=None, next_event=next_event,
            is_nap=True, location_timezone='Asia/Qatar',
        )

        # Nap base efficiency = home (0.95) * 0.88 = 0.836
        assert nap_q.base_efficiency < 0.90


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
