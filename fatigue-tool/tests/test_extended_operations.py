#!/usr/bin/env python3
"""
test_extended_operations.py
===========================

Test suite for EASA Extended FDP + ULR Operations implementation:
- Part A: Acclimatization (Table 7-1)
- Part B: Augmented crew (3-pilot, CS FTL.1.205)
- Part C: ULR operations (4-pilot, Qatar FTL 7.18)
- Part D: Integration & backward compatibility

Run: python -m pytest test_extended_operations.py -v
"""

import pytest
from datetime import datetime, timedelta
from dataclasses import dataclass
import pytz

from models.data_models import (
    AcclimatizationState, CrewComposition, RestFacilityClass, ULRCrewSet,
    InFlightRestPeriod, InFlightRestPlan, ULRComplianceResult,
    Airport, FlightSegment, Duty, Roster, SleepBlock, DutyTimeline,
)
from core.extended_operations import (
    AcclimatizationCalculator,
    AugmentedFDPParameters, AugmentedCrewRestPlanner,
    ULRParameters, ULRRestPlanner, ULRComplianceValidator,
)
from core.parameters import ModelConfig
from core.fatigue_model import BorbelyFatigueModel


# ============================================================================
# HELPERS
# ============================================================================

DOH = Airport(code='DOH', timezone='Asia/Qatar')
AKL = Airport(code='AKL', timezone='Pacific/Auckland')
DFW = Airport(code='DFW', timezone='America/Chicago')
DXB = Airport(code='DXB', timezone='Asia/Dubai')
LHR = Airport(code='LHR', timezone='Europe/London')
SIN = Airport(code='SIN', timezone='Asia/Singapore')
MCT = Airport(code='MCT', timezone='Asia/Muscat')
UTC = pytz.utc
HOME_TZ = 'Asia/Qatar'


def make_segment(flt, dep_apt, arr_apt, dep_utc, arr_utc):
    """Helper to build a FlightSegment."""
    return FlightSegment(
        flight_number=flt,
        departure_airport=dep_apt,
        arrival_airport=arr_apt,
        scheduled_departure_utc=dep_utc,
        scheduled_arrival_utc=arr_utc,
    )


def make_duty(duty_id, date, report_utc, release_utc, segments,
              home_tz=HOME_TZ, crew_comp=CrewComposition.STANDARD,
              rest_facility=None, is_ulr=False, ulr_crew_set=None):
    """Helper to build a Duty with optional augmented/ULR fields."""
    return Duty(
        duty_id=duty_id,
        date=date,
        report_time_utc=report_utc,
        release_time_utc=release_utc,
        segments=segments,
        home_base_timezone=home_tz,
        crew_composition=crew_comp,
        rest_facility_class=rest_facility,
        is_ulr=is_ulr,
        ulr_crew_set=ulr_crew_set,
    )


def make_short_haul_duty(report_hour_utc=4, duration_hours=8):
    """Create a standard short-haul duty (DOH-DXB-DOH)."""
    base_date = datetime(2025, 6, 15, tzinfo=UTC)
    report = base_date.replace(hour=report_hour_utc)
    dep1 = report + timedelta(hours=1)
    arr1 = dep1 + timedelta(hours=1, minutes=30)
    dep2 = arr1 + timedelta(hours=1, minutes=15)
    arr2 = dep2 + timedelta(hours=1, minutes=30)
    release = report + timedelta(hours=duration_hours)

    seg1 = make_segment('QR100', DOH, DXB, dep1, arr1)
    seg2 = make_segment('QR101', DXB, DOH, dep2, arr2)

    return make_duty('short_haul', base_date, report, release, [seg1, seg2])


def make_long_haul_duty(fdp_hours=15.0, block_hours=12.0):
    """
    Create a single-sector long-haul duty (DOH-SIN) for augmented crew testing.

    fdp_hours controls the *computed* FDP (arrival + 30min - report).
    block_hours controls the actual block time of the single segment.
    """
    base_date = datetime(2025, 6, 15, tzinfo=UTC)
    report = base_date.replace(hour=20, minute=0)  # 20:00Z = 23:00 DOH
    dep = report + timedelta(hours=1)
    arr = dep + timedelta(hours=block_hours)
    # Ensure release >= arrival + 30min (so fdp_hours is consistent)
    release = report + timedelta(hours=fdp_hours + 1)

    seg = make_segment('QR844', DOH, SIN, dep, arr)

    return make_duty(
        'long_haul', base_date, report, release, [seg],
        crew_comp=CrewComposition.AUGMENTED_3,
        rest_facility=RestFacilityClass.CLASS_1,
    )


def make_ulr_duty(fdp_hours=17.5, crew_set=ULRCrewSet.CREW_B):
    """
    Create a ULR duty (DOH-AKL).

    fdp_hours controls the *computed* FDP (arrival + 30min - report).
    So arrival = report + fdp_hours - 30min - 1h (report-to-dep gap).
    """
    base_date = datetime(2025, 6, 15, tzinfo=UTC)
    report = base_date.replace(hour=18, minute=30)  # 18:30Z = 21:30 DOH
    dep = report + timedelta(hours=1)
    # fdp_hours = (arrival + 30min - report) => arrival = report + fdp_hours - 30min
    arr = report + timedelta(hours=fdp_hours, minutes=-30)
    release = arr + timedelta(hours=1)  # 1h post-flight

    seg = make_segment('QR920', DOH, AKL, dep, arr)

    return make_duty(
        'ulr_doh_akl', base_date, report, release, [seg],
        crew_comp=CrewComposition.AUGMENTED_4,
        rest_facility=RestFacilityClass.CLASS_1,
        is_ulr=True,
        ulr_crew_set=crew_set,
    )


# ============================================================================
# PART A: ACCLIMATIZATION TABLE 7-1
# ============================================================================

class TestAcclimatization:
    """Test AcclimatizationCalculator — Table 7-1 lookup."""

    def test_first_48h_always_acclimatized(self):
        """Crew remains acclimatized (B) to departure for first 47h59m."""
        calc = AcclimatizationCalculator
        # Any time zone diff, <48h elapsed → B
        assert calc.determine_state(3.0, 0.0) == AcclimatizationState.ACCLIMATIZED
        assert calc.determine_state(6.0, 24.0) == AcclimatizationState.ACCLIMATIZED
        assert calc.determine_state(12.0, 47.0) == AcclimatizationState.ACCLIMATIZED

    def test_small_tz_diff_always_acclimatized(self):
        """Time zone diff <= 2h → always acclimatized regardless of time."""
        calc = AcclimatizationCalculator
        assert calc.determine_state(1.0, 0.0) == AcclimatizationState.ACCLIMATIZED
        assert calc.determine_state(2.0, 100.0) == AcclimatizationState.ACCLIMATIZED

    def test_moderate_tz_diff_48_to_72h(self):
        """2-4h diff, 48-72h elapsed → D (departed)."""
        calc = AcclimatizationCalculator
        assert calc.determine_state(3.0, 50.0) == AcclimatizationState.DEPARTED

    def test_large_tz_diff_unknown_state(self):
        """>=4h diff, 48-72h elapsed → X (unknown)."""
        calc = AcclimatizationCalculator
        assert calc.determine_state(5.0, 50.0) == AcclimatizationState.UNKNOWN
        assert calc.determine_state(8.0, 60.0) == AcclimatizationState.UNKNOWN

    def test_very_large_tz_diff_slow_acclim(self):
        """>9h diff: remains X until 120h+ elapsed."""
        calc = AcclimatizationCalculator
        assert calc.determine_state(10.0, 50.0) == AcclimatizationState.UNKNOWN
        assert calc.determine_state(10.0, 80.0) == AcclimatizationState.UNKNOWN
        assert calc.determine_state(10.0, 100.0) == AcclimatizationState.UNKNOWN
        # At 120h+ → D
        assert calc.determine_state(10.0, 125.0) == AcclimatizationState.DEPARTED

    def test_full_table_grid(self):
        """Test all Table 7-1 cells: (diff, elapsed) → state."""
        calc = AcclimatizationCalculator
        # >2 and <4h diff
        assert calc.determine_state(3.0, 50.0) == AcclimatizationState.DEPARTED   # 48-72h
        assert calc.determine_state(3.0, 80.0) == AcclimatizationState.DEPARTED   # 72-96h
        assert calc.determine_state(3.0, 100.0) == AcclimatizationState.DEPARTED  # 96-120h
        assert calc.determine_state(3.0, 130.0) == AcclimatizationState.DEPARTED  # >=120h

        # >=4 and <=6h diff
        assert calc.determine_state(5.0, 50.0) == AcclimatizationState.UNKNOWN    # 48-72h
        assert calc.determine_state(5.0, 80.0) == AcclimatizationState.DEPARTED   # 72-96h
        assert calc.determine_state(5.0, 100.0) == AcclimatizationState.DEPARTED  # 96-120h
        assert calc.determine_state(5.0, 130.0) == AcclimatizationState.DEPARTED  # >=120h

        # >6 and <=9h diff
        assert calc.determine_state(7.0, 50.0) == AcclimatizationState.UNKNOWN    # 48-72h
        assert calc.determine_state(7.0, 80.0) == AcclimatizationState.UNKNOWN    # 72-96h
        assert calc.determine_state(7.0, 100.0) == AcclimatizationState.DEPARTED  # 96-120h
        assert calc.determine_state(7.0, 130.0) == AcclimatizationState.DEPARTED  # >=120h

        # >9 and <=12h diff
        assert calc.determine_state(11.0, 50.0) == AcclimatizationState.UNKNOWN   # 48-72h
        assert calc.determine_state(11.0, 80.0) == AcclimatizationState.UNKNOWN   # 72-96h
        assert calc.determine_state(11.0, 100.0) == AcclimatizationState.UNKNOWN  # 96-120h
        assert calc.determine_state(11.0, 130.0) == AcclimatizationState.DEPARTED # >=120h

    def test_reference_timezone_acclimatized(self):
        """B state → home timezone as reference."""
        tz = AcclimatizationCalculator.get_reference_timezone(
            AcclimatizationState.ACCLIMATIZED, 'Asia/Qatar', 'Pacific/Auckland'
        )
        assert tz == 'Asia/Qatar'

    def test_reference_timezone_departed(self):
        """D state → current (destination) timezone as reference."""
        tz = AcclimatizationCalculator.get_reference_timezone(
            AcclimatizationState.DEPARTED, 'Asia/Qatar', 'Pacific/Auckland'
        )
        assert tz == 'Pacific/Auckland'

    def test_reference_timezone_unknown(self):
        """X state → home timezone as reference (conservative)."""
        tz = AcclimatizationCalculator.get_reference_timezone(
            AcclimatizationState.UNKNOWN, 'Asia/Qatar', 'Pacific/Auckland'
        )
        assert tz == 'Asia/Qatar'


# ============================================================================
# PART B: AUGMENTED CREW (3-PILOT) FDP LIMITS
# ============================================================================

class TestAugmentedFDPParameters:
    """Test CS FTL.1.205(c)(2) FDP limit table."""

    def setup_method(self):
        self.params = AugmentedFDPParameters()

    def test_3_pilot_class_1_base_limit(self):
        """3 pilots + Class 1 bunk → 16h max FDP."""
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_3, RestFacilityClass.CLASS_1
        )
        assert limit == 16.0

    def test_3_pilot_class_2_base_limit(self):
        """3 pilots + Class 2 seat → 15h max FDP."""
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_3, RestFacilityClass.CLASS_2
        )
        assert limit == 15.0

    def test_3_pilot_class_3_base_limit(self):
        """3 pilots + Class 3 seat → 14h max FDP."""
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_3, RestFacilityClass.CLASS_3
        )
        assert limit == 14.0

    def test_4_pilot_class_1_base_limit(self):
        """4 pilots + Class 1 bunk → 17h max FDP."""
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_4, RestFacilityClass.CLASS_1
        )
        assert limit == 17.0

    def test_4_pilot_class_2_base_limit(self):
        """4 pilots + Class 2 seat → 16h max FDP."""
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_4, RestFacilityClass.CLASS_2
        )
        assert limit == 16.0

    def test_4_pilot_class_3_base_limit(self):
        """4 pilots + Class 3 seat → 15h max FDP."""
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_4, RestFacilityClass.CLASS_3
        )
        assert limit == 15.0

    def test_long_sector_bonus(self):
        """Single sector >9h with max 2 sectors → +1h bonus."""
        # Create a segment list with one long segment
        long_seg = make_segment('QR844', DOH, SIN,
                                datetime(2025, 6, 15, 21, 0, tzinfo=UTC),
                                datetime(2025, 6, 16, 7, 30, tzinfo=UTC))  # 10.5h
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_3, RestFacilityClass.CLASS_1,
            segments=[long_seg]
        )
        assert limit == 17.0  # 16 + 1

    def test_no_bonus_with_3_sectors(self):
        """3 sectors → no long-sector bonus even if one is >9h."""
        t0 = datetime(2025, 6, 15, 20, 0, tzinfo=UTC)
        segs = [
            make_segment('QR1', DOH, DXB, t0, t0 + timedelta(hours=10)),
            make_segment('QR2', DXB, SIN, t0 + timedelta(hours=11), t0 + timedelta(hours=13)),
            make_segment('QR3', SIN, DOH, t0 + timedelta(hours=14), t0 + timedelta(hours=16)),
        ]
        limit = self.params.get_max_fdp(
            CrewComposition.AUGMENTED_3, RestFacilityClass.CLASS_1,
            segments=segs
        )
        assert limit == 16.0  # No bonus — 3 sectors

    def test_standard_crew_returns_base_fdp(self):
        """Standard crew → 13h fallback (Table 1 base, not augmented table)."""
        limit = self.params.get_max_fdp(
            CrewComposition.STANDARD, RestFacilityClass.CLASS_1
        )
        assert limit == 13.0  # Standard FDP base from Table 1


class TestAugmentedCrewRestPlanner:
    """Test 3-pilot in-flight rest plan generation."""

    def setup_method(self):
        self.planner = AugmentedCrewRestPlanner()

    def test_generates_rest_plan(self):
        """Rest plan is generated for augmented crew duty."""
        duty = make_long_haul_duty(fdp_hours=15.0, block_hours=12.0)
        plan = self.planner.generate_rest_plan(
            duty, RestFacilityClass.CLASS_1, HOME_TZ
        )
        assert plan is not None
        assert plan.crew_composition == CrewComposition.AUGMENTED_3
        assert plan.rest_facility_class == RestFacilityClass.CLASS_1
        assert len(plan.rest_periods) > 0

    def test_rest_periods_not_during_takeoff_landing(self):
        """Rest periods must avoid first 45min and last 45min of FDP."""
        duty = make_long_haul_duty(fdp_hours=15.0, block_hours=12.0)
        plan = self.planner.generate_rest_plan(
            duty, RestFacilityClass.CLASS_1, HOME_TZ
        )
        for period in plan.rest_periods:
            if period.start_utc and period.end_utc:
                # Rest must not start within 45min of takeoff
                earliest_rest = duty.segments[0].scheduled_departure_utc + timedelta(minutes=45)
                assert period.start_utc >= earliest_rest, \
                    f"Rest starts too early: {period.start_utc} vs takeoff+45min {earliest_rest}"
                # Rest must end before last 45min before landing
                latest_rest = duty.segments[-1].scheduled_arrival_utc - timedelta(minutes=45)
                assert period.end_utc <= latest_rest, \
                    f"Rest ends too late: {period.end_utc} vs landing-45min {latest_rest}"

    def test_total_rest_hours_reasonable(self):
        """Total rest hours should be a meaningful portion of cruise."""
        duty = make_long_haul_duty(fdp_hours=15.0, block_hours=12.0)
        plan = self.planner.generate_rest_plan(
            duty, RestFacilityClass.CLASS_1, HOME_TZ
        )
        # At least 2h of rest for a 12h block flight
        assert plan.total_rest_hours >= 2.0
        # Not more than half the block time
        assert plan.total_rest_hours <= 6.0

    def test_rest_quality_by_facility_class(self):
        """Rest facility quality varies by class."""
        duty = make_long_haul_duty(fdp_hours=15.0, block_hours=12.0)

        plan_c1 = self.planner.generate_rest_plan(duty, RestFacilityClass.CLASS_1, HOME_TZ)
        plan_c2 = self.planner.generate_rest_plan(duty, RestFacilityClass.CLASS_2, HOME_TZ)
        plan_c3 = self.planner.generate_rest_plan(duty, RestFacilityClass.CLASS_3, HOME_TZ)

        assert plan_c1.rest_facility_quality > plan_c2.rest_facility_quality
        assert plan_c2.rest_facility_quality > plan_c3.rest_facility_quality
        assert plan_c1.rest_facility_quality == pytest.approx(0.70, abs=0.01)
        assert plan_c2.rest_facility_quality == pytest.approx(0.55, abs=0.01)
        assert plan_c3.rest_facility_quality == pytest.approx(0.45, abs=0.01)


# ============================================================================
# PART C: ULR OPERATIONS (4-PILOT)
# ============================================================================

class TestULRParameters:
    """Test ULR parameter defaults."""

    def test_fdp_threshold(self):
        params = ULRParameters()
        assert params.ulr_fdp_threshold_hours == 18.0

    def test_max_planned_fdp(self):
        params = ULRParameters()
        assert params.ulr_max_planned_fdp_hours == 20.0

    def test_monthly_limit(self):
        params = ULRParameters()
        assert params.max_ulr_per_calendar_month == 2


class TestULRRestPlanner:
    """Test ULR rest plan generation with Crew A/B patterns."""

    def setup_method(self):
        self.planner = ULRRestPlanner()

    def test_generates_crew_b_outbound_plan(self):
        """Crew B outbound: rests earlier in flight."""
        duty = make_ulr_duty(crew_set=ULRCrewSet.CREW_B)
        plan = self.planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_B, HOME_TZ, sector="outbound"
        )
        assert plan is not None
        assert plan.crew_composition == CrewComposition.AUGMENTED_4
        assert len(plan.rest_periods) >= 2

    def test_generates_crew_a_outbound_plan(self):
        """Crew A outbound: rests later in flight (after operating takeoff)."""
        duty = make_ulr_duty(crew_set=ULRCrewSet.CREW_A)
        plan = self.planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_A, HOME_TZ, sector="outbound"
        )
        assert plan is not None
        assert len(plan.rest_periods) >= 2

    def test_at_least_one_4h_rest_period(self):
        """ULR requires at least one rest period >= 4h."""
        duty = make_ulr_duty()
        plan = self.planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_B, HOME_TZ, sector="outbound"
        )
        max_period = max(p.duration_hours for p in plan.rest_periods)
        assert max_period >= 4.0, f"Longest rest period is {max_period}h, need >= 4h"

    def test_rest_avoids_takeoff_landing_window(self):
        """ULR rest avoids first 90min and last 90min."""
        duty = make_ulr_duty()
        plan = self.planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_B, HOME_TZ, sector="outbound"
        )
        for period in plan.rest_periods:
            if period.start_utc and period.end_utc:
                earliest = duty.segments[0].scheduled_departure_utc + timedelta(minutes=90)
                latest = duty.segments[-1].scheduled_arrival_utc - timedelta(minutes=90)
                assert period.start_utc >= earliest, \
                    f"ULR rest starts before takeoff+90min window"
                assert period.end_utc <= latest, \
                    f"ULR rest extends into landing-90min window"

    def test_crew_a_vs_crew_b_different_timing(self):
        """Crew A and B should have different rest timing on same outbound flight."""
        duty = make_ulr_duty()
        plan_a = self.planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_A, HOME_TZ, sector="outbound"
        )
        plan_b = self.planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_B, HOME_TZ, sector="outbound"
        )
        # First rest start should differ between crews
        a_first_start = plan_a.rest_periods[0].start_offset_hours
        b_first_start = plan_b.rest_periods[0].start_offset_hours
        assert a_first_start != b_first_start, \
            f"Crew A and B have identical first rest start: {a_first_start}h"

    def test_total_rest_reasonable_for_ulr(self):
        """Total rest should be 6-10h for a ~17.5h ULR duty."""
        duty = make_ulr_duty()
        plan = self.planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_B, HOME_TZ, sector="outbound"
        )
        assert plan.total_rest_hours >= 5.0, \
            f"Total ULR rest {plan.total_rest_hours}h too short"
        assert plan.total_rest_hours <= 12.0, \
            f"Total ULR rest {plan.total_rest_hours}h too long"


class TestULRComplianceValidator:
    """Test ULR compliance checks per Qatar FTL 7.18."""

    def setup_method(self):
        self.validator = ULRComplianceValidator()

    def test_valid_ulr_duty(self):
        """A properly constructed ULR duty should be compliant."""
        duty = make_ulr_duty(fdp_hours=17.5)
        result = self.validator.validate_ulr_duty(duty)
        assert result.is_ulr
        assert result.fdp_within_limit

    def test_fdp_over_20h_but_within_discretion(self):
        """FDP 20-23h: within discretion, fdp_within_limit=True but with warnings."""
        duty = make_ulr_duty(fdp_hours=21.0)
        result = self.validator.validate_ulr_duty(duty)
        assert result.is_ulr
        # 21h is within 20h + 3h discretion, so fdp_within_limit is True
        assert result.fdp_within_limit
        assert len(result.warnings) > 0  # Should warn about discretion

    def test_fdp_over_max_discretion_violation(self):
        """FDP > 23h (max + discretion): real violation."""
        duty = make_ulr_duty(fdp_hours=24.0)
        result = self.validator.validate_ulr_duty(duty)
        assert result.is_ulr
        assert not result.fdp_within_limit
        assert len(result.violations) > 0

    def test_non_ulr_duty_detected_by_property(self):
        """Short duty is_ulr_operation property is False."""
        duty = make_short_haul_duty()
        # Note: validate_ulr_duty always returns is_ulr=True (it's meant
        # to be called only on ULR duties). Use is_ulr_operation property
        # for detection.
        assert not duty.is_ulr_operation


# ============================================================================
# PART D: DATA MODEL PROPERTIES AND INTEGRATION
# ============================================================================

class TestDutyProperties:
    """Test Duty augmented/ULR properties."""

    def test_is_ulr_operation_true(self):
        """FDP > 18h → is_ulr_operation."""
        duty = make_ulr_duty(fdp_hours=19.0)
        assert duty.is_ulr_operation

    def test_is_ulr_operation_false(self):
        """FDP <= 18h → not ULR."""
        duty = make_short_haul_duty(duration_hours=8)
        assert not duty.is_ulr_operation

    def test_is_augmented_crew_3(self):
        """AUGMENTED_3 → is_augmented_crew."""
        duty = make_long_haul_duty()
        assert duty.is_augmented_crew

    def test_is_augmented_crew_standard(self):
        """STANDARD → not augmented."""
        duty = make_short_haul_duty()
        assert not duty.is_augmented_crew


class TestInFlightRestPlan:
    """Test InFlightRestPlan dataclass behavior."""

    def test_auto_calculates_total_hours(self):
        """total_rest_hours is auto-computed from rest periods."""
        periods = [
            InFlightRestPeriod(start_offset_hours=2.0, duration_hours=3.0),
            InFlightRestPeriod(start_offset_hours=8.0, duration_hours=2.5),
        ]
        plan = InFlightRestPlan(
            rest_periods=periods,
            crew_composition=CrewComposition.AUGMENTED_3,
        )
        assert plan.total_rest_hours == pytest.approx(5.5)

    def test_quality_set_by_facility_class(self):
        """Quality factor is set based on rest facility class."""
        plan_c1 = InFlightRestPlan(
            rest_periods=[],
            crew_composition=CrewComposition.AUGMENTED_3,
            rest_facility_class=RestFacilityClass.CLASS_1,
        )
        plan_c3 = InFlightRestPlan(
            rest_periods=[],
            crew_composition=CrewComposition.AUGMENTED_3,
            rest_facility_class=RestFacilityClass.CLASS_3,
        )
        assert plan_c1.rest_facility_quality == pytest.approx(0.70, abs=0.01)
        assert plan_c3.rest_facility_quality == pytest.approx(0.45, abs=0.01)


class TestULRComplianceResult:
    """Test ULRComplianceResult defaults."""

    def test_default_compliant(self):
        result = ULRComplianceResult(is_ulr=True)
        assert result.is_ulr
        assert result.pre_ulr_rest_compliant
        assert result.post_ulr_rest_compliant
        assert result.monthly_ulr_compliant
        assert result.violations == []
        assert result.warnings == []


# ============================================================================
# PART E: BACKWARD COMPATIBILITY
# ============================================================================

class TestBackwardCompatibility:
    """Ensure standard duties produce same results as before."""

    def test_standard_duty_default_fields(self):
        """Standard short-haul duty should have default augmented fields."""
        duty = make_short_haul_duty()
        assert duty.crew_composition == CrewComposition.STANDARD
        assert duty.rest_facility_class is None
        assert duty.is_ulr is False
        assert duty.ulr_crew_set is None
        assert duty.inflight_rest_plan is None

    def test_augmented_fdp_standard_returns_base(self):
        """AugmentedFDPParameters.get_max_fdp returns 13h base for standard crew."""
        params = AugmentedFDPParameters()
        limit = params.get_max_fdp(CrewComposition.STANDARD, RestFacilityClass.CLASS_1)
        assert limit == 13.0  # Standard Table 1 fallback

    def test_standard_duty_not_ulr_by_property(self):
        """Standard short-haul duty → is_ulr_operation is False."""
        duty = make_short_haul_duty()
        assert not duty.is_ulr_operation
        assert not duty.is_augmented_crew


# ============================================================================
# PART F: ROSTER AUTO-DETECTION
# ============================================================================

class TestAutoDetection:
    """Test roster_parser auto_detect_crew_augmentation logic."""

    def test_ulr_duty_auto_detected(self):
        """FDP > 18h → AUGMENTED_4, is_ulr=True."""
        from parsers.roster_parser import auto_detect_crew_augmentation
        duty = make_ulr_duty(fdp_hours=19.0, crew_set=None)
        # Reset to standard to test auto-detection
        duty.crew_composition = CrewComposition.STANDARD
        duty.rest_facility_class = None
        duty.is_ulr = False

        roster = Roster(
            roster_id='test_roster',
            pilot_id='TEST001',
            month='2025-06',
            duties=[duty],
            home_base_timezone=HOME_TZ,
        )
        auto_detect_crew_augmentation(roster)
        assert duty.is_ulr is True
        assert duty.crew_composition == CrewComposition.AUGMENTED_4
        assert duty.rest_facility_class == RestFacilityClass.CLASS_1

    def test_long_haul_augmented_3_auto_detected(self):
        """FDP > 13h with single segment >9h → AUGMENTED_3."""
        from parsers.roster_parser import auto_detect_crew_augmentation
        # Need block_hours > 12h so fdp_hours = block + 1.5h > 13h
        duty = make_long_haul_duty(fdp_hours=14.5, block_hours=12.5)
        duty.crew_composition = CrewComposition.STANDARD
        duty.rest_facility_class = None

        roster = Roster(
            roster_id='test_roster',
            pilot_id='TEST001',
            month='2025-06',
            duties=[duty],
            home_base_timezone=HOME_TZ,
        )
        auto_detect_crew_augmentation(roster)
        assert duty.crew_composition == CrewComposition.AUGMENTED_3
        assert duty.rest_facility_class == RestFacilityClass.CLASS_1

    def test_short_haul_stays_standard(self):
        """Short-haul duty remains STANDARD after auto-detection."""
        from parsers.roster_parser import auto_detect_crew_augmentation
        duty = make_short_haul_duty()

        roster = Roster(
            roster_id='test_roster',
            pilot_id='TEST001',
            month='2025-06',
            duties=[duty],
            home_base_timezone=HOME_TZ,
        )
        auto_detect_crew_augmentation(roster)
        assert duty.crew_composition == CrewComposition.STANDARD
        assert duty.rest_facility_class is None


# ============================================================================
# PART G: SIMULATION INTEGRATION (smoke tests)
# ============================================================================

class TestSimulationSmoke:
    """Smoke tests: model can simulate augmented/ULR duties without crashing."""

    def setup_method(self):
        self.config = ModelConfig.default_easa_config()
        self.model = BorbelyFatigueModel(self.config)

    def test_standard_duty_simulates(self):
        """Standard duty simulation works unchanged."""
        duty = make_short_haul_duty()
        sleep = SleepBlock(
            start_utc=duty.report_time_utc - timedelta(hours=9),
            end_utc=duty.report_time_utc - timedelta(hours=2),
            location_timezone=HOME_TZ,
            duration_hours=7.0,
            quality_factor=0.90,
            effective_sleep_hours=6.3,
        )
        timeline = self.model.simulate_duty(duty, [sleep])
        assert timeline is not None
        assert timeline.min_performance > 0
        assert timeline.min_performance < 100

    def test_augmented_duty_with_rest_plan_simulates(self):
        """Augmented duty with in-flight rest plan can be simulated."""
        duty = make_long_haul_duty(fdp_hours=15.0, block_hours=12.0)

        # Generate rest plan
        planner = AugmentedCrewRestPlanner()
        rest_plan = planner.generate_rest_plan(
            duty, RestFacilityClass.CLASS_1, HOME_TZ
        )
        duty.inflight_rest_plan = rest_plan

        sleep = SleepBlock(
            start_utc=duty.report_time_utc - timedelta(hours=9),
            end_utc=duty.report_time_utc - timedelta(hours=2),
            location_timezone=HOME_TZ,
            duration_hours=7.0,
            quality_factor=0.90,
            effective_sleep_hours=6.3,
        )
        timeline = self.model.simulate_duty(duty, [sleep])
        assert timeline is not None
        assert timeline.min_performance > 0

    def test_augmented_duty_rest_plan_attached(self):
        """Augmented duty with rest plan has the plan attached to timeline.

        Note: Full in-flight rest integration into the simulation loop
        (Process S decay during rest, sleep inertia on wake) is pending.
        This test validates the rest plan is correctly attached and the
        simulation completes without error.
        """
        duty_with_rest = make_long_haul_duty(fdp_hours=15.0, block_hours=12.0)

        # Add rest plan
        planner = AugmentedCrewRestPlanner()
        rest_plan = planner.generate_rest_plan(
            duty_with_rest, RestFacilityClass.CLASS_1, HOME_TZ
        )
        duty_with_rest.inflight_rest_plan = rest_plan

        sleep = SleepBlock(
            start_utc=duty_with_rest.report_time_utc - timedelta(hours=9),
            end_utc=duty_with_rest.report_time_utc - timedelta(hours=2),
            location_timezone=HOME_TZ,
            duration_hours=7.0,
            quality_factor=0.90,
            effective_sleep_hours=6.3,
        )

        timeline = self.model.simulate_duty(duty_with_rest, [sleep])
        assert timeline is not None
        assert timeline.min_performance > 0
        # Rest plan is attached to the duty
        assert duty_with_rest.inflight_rest_plan is not None
        assert len(duty_with_rest.inflight_rest_plan.rest_periods) > 0

    def test_ulr_duty_simulates(self):
        """ULR duty with rest plan can be simulated."""
        duty = make_ulr_duty(fdp_hours=19.0)

        # Generate ULR rest plan
        planner = ULRRestPlanner()
        rest_plan = planner.generate_rest_plan(
            duty, ULRCrewSet.CREW_B, HOME_TZ, sector="outbound"
        )
        duty.inflight_rest_plan = rest_plan

        sleep = SleepBlock(
            start_utc=duty.report_time_utc - timedelta(hours=9),
            end_utc=duty.report_time_utc - timedelta(hours=2),
            location_timezone=HOME_TZ,
            duration_hours=7.0,
            quality_factor=0.90,
            effective_sleep_hours=6.3,
        )
        timeline = self.model.simulate_duty(duty, [sleep])
        assert timeline is not None
        assert timeline.min_performance > 0


# ============================================================================
# RUN
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
