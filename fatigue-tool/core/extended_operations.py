"""
Extended Operations: Augmented Crew & ULR
==========================================

EASA CS FTL.1.205 augmented crew FDP limits (3-pilot and 4-pilot)
Qatar FTL Chapter 7.18 Ultra Long Range operations
Qatar FTL Section 7.6.1 Table 7-1 Acclimatization

Classes:
    AugmentedFDPParameters: CS FTL.1.205(c)(2) FDP limit table
    ULRParameters: Qatar FTL 7.18 regulatory parameters
    AcclimatizationCalculator: Table 7-1 acclimatization state
    AugmentedCrewRestPlanner: 3-pilot in-flight rest planning
    ULRRestPlanner: 4-pilot Crew A/B rest rotation
    ULRComplianceValidator: ULR-specific compliance checks

Scientific Foundation:
    Signal et al. (2013) Sleep 36(1):109-118
    Signal et al. (2014) Aviat Space Environ Med 85:1199-1208
    Gander et al. (2013) Accid Anal Prev 53:89-94
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import pytz

from models.data_models import (
    AcclimatizationState, CrewComposition, RestFacilityClass, ULRCrewSet,
    InFlightRestPeriod, InFlightRestPlan, ULRComplianceResult,
    Duty, Roster, SleepBlock,
)


# ============================================================================
# PARAMETER DATACLASSES
# ============================================================================

@dataclass
class AugmentedFDPParameters:
    """
    EASA CS FTL.1.205(c)(2) — Maximum FDP with in-flight rest for augmented crews.

    FDP limits depend on rest facility class and number of additional crew.
    A +1h bonus applies for FDPs with max 2 sectors where one sector >9h flight time.

    References:
        EASA CS FTL.1.205(c)(2) — Extended FDP with In-Flight Rest
        EuroCockpit FTL Calculator — in-flight rest tables
    """
    # Maximum FDP (hours) by crew composition and rest facility class
    # Key: (extra_pilots, facility_class) -> max_fdp_hours
    fdp_table: Dict[Tuple[int, str], float] = field(default_factory=lambda: {
        (1, 'class_1'): 16.0,  # 3 pilots, Class 1 (bunk)
        (1, 'class_2'): 15.0,  # 3 pilots, Class 2 (seat 45deg)
        (1, 'class_3'): 14.0,  # 3 pilots, Class 3 (seat 40deg)
        (2, 'class_1'): 17.0,  # 4 pilots, Class 1 (bunk)
        (2, 'class_2'): 16.0,  # 4 pilots, Class 2 (seat 45deg)
        (2, 'class_3'): 15.0,  # 4 pilots, Class 3 (seat 40deg)
    })

    # +1h bonus conditions
    long_sector_bonus_hours: float = 1.0
    long_sector_min_flight_hours: float = 9.0  # Sector must exceed 9h flight time
    long_sector_max_sectors: int = 2  # Max 2 sectors in the FDP for bonus to apply

    # Sector limits for augmented operations
    max_sectors_augmented: int = 3

    # Commander's discretion for augmented crew
    augmented_discretion_hours: float = 3.0  # vs 2h for standard

    # Minimum in-flight rest per crew member
    min_rest_landing_crew_hours: float = 2.0     # Pilots at controls during landing
    min_rest_augmenting_crew_hours: float = 1.5  # Other augmenting pilots (90 min)

    def get_max_fdp(
        self,
        crew_composition: CrewComposition,
        rest_facility_class: RestFacilityClass,
        segments: list = None
    ) -> float:
        """Get maximum FDP for given crew composition and facility class."""
        extra_pilots = {
            CrewComposition.AUGMENTED_3: 1,
            CrewComposition.AUGMENTED_4: 2,
        }.get(crew_composition, 0)

        if extra_pilots == 0:
            return 13.0  # Standard FDP — should use Table 1 instead

        facility_key = rest_facility_class.value if rest_facility_class else 'class_1'
        base_fdp = self.fdp_table.get((extra_pilots, facility_key), 16.0)

        # Check long-sector bonus
        if segments and len(segments) <= self.long_sector_max_sectors:
            has_long_sector = any(
                seg.block_time_hours > self.long_sector_min_flight_hours
                for seg in segments
            )
            if has_long_sector:
                base_fdp += self.long_sector_bonus_hours

        return base_fdp


@dataclass
class ULRParameters:
    """
    ULR regulatory parameters per Qatar Airways FTL Chapter 7.18.
    """
    # FDP limits
    ulr_fdp_threshold_hours: float = 18.0     # FDP > 18h = ULR
    ulr_max_planned_fdp_hours: float = 20.0   # Max planned FDP
    ulr_discretion_max_hours: float = 3.0     # Commander's extension
    ulr_discretion_report_threshold: float = 2.0  # >2h must be reported to QCAA

    # Crew requirements
    ulr_min_pilots: int = 4  # 2 Captains + 2 First Officers

    # Rest requirements
    ulr_min_rest_periods: int = 2        # At least 2 in-flight rest periods
    ulr_min_long_rest_hours: float = 4.0 # One rest period must be >= 4h

    # Pre/Post ULR rest
    pre_ulr_duty_free_hours: float = 48.0
    pre_ulr_local_nights: int = 2
    post_ulr_base_local_nights: int = 4
    post_ulr_away_duty_free_hours: float = 48.0
    post_ulr_away_local_nights: int = 2

    # Monthly limits
    max_ulr_per_calendar_month: int = 2

    # Known ULR city pairs
    permanent_ulr_pairs: List[Tuple[str, str]] = field(default_factory=lambda: [
        ("DOH", "AKL"),
    ])
    seasonal_ulr_pairs: List[Tuple[str, str]] = field(default_factory=lambda: [
        ("DOH", "DFW"),
        ("DOH", "MIA"),
    ])


# ============================================================================
# ACCLIMATIZATION CALCULATOR (Table 7-1)
# ============================================================================

class AcclimatizationCalculator:
    """
    Determines crew acclimatization state per Qatar FTL Section 7.6.1.

    Table 7-1 maps (time_zone_difference, time_elapsed_since_arrival) to state:
        B = acclimatized to departure (base) time zone
        X = unknown state of acclimatisation
        D = acclimatized to destination time zone

    The crew member is considered acclimatized to the local time of a 2-hour
    wide time zone band encompassing the reference point.
    """

    # Table 7-1: rows = time zone diff bands, cols = elapsed time bands
    # Values: 'B' (base), 'X' (unknown), 'D' (departed/destination)
    TABLE_7_1 = {
        # (min_tz_diff, max_tz_diff): [<48h, 48-71:59, 72-95:59, 96-119:59, >=120h]
        (2, 4):   ['B', 'D', 'D', 'D', 'D'],
        (4, 6):   ['B', 'X', 'D', 'D', 'D'],
        (6, 9):   ['B', 'X', 'X', 'D', 'D'],
        (9, 12):  ['B', 'X', 'X', 'X', 'D'],
    }

    @classmethod
    def determine_state(
        cls,
        time_zone_diff_hours: float,
        time_elapsed_hours: float
    ) -> AcclimatizationState:
        """
        Determine acclimatization state from Table 7-1.

        Args:
            time_zone_diff_hours: Absolute time zone difference (hours)
            time_elapsed_hours: Hours since arrival at location

        Returns:
            AcclimatizationState (ACCLIMATIZED, UNKNOWN, or DEPARTED)
        """
        abs_diff = abs(time_zone_diff_hours)

        # Within 2h band — always acclimatized (no shift)
        if abs_diff <= 2:
            return AcclimatizationState.ACCLIMATIZED

        # Find the row in Table 7-1
        row_key = None
        for (min_diff, max_diff) in cls.TABLE_7_1:
            if min_diff < abs_diff <= max_diff:
                row_key = (min_diff, max_diff)
                break

        if row_key is None:
            # > 12h difference — same as 9-12h row (most conservative)
            row_key = (9, 12)

        row = cls.TABLE_7_1[row_key]

        # Determine column from elapsed time
        if time_elapsed_hours < 48:
            col = 0
        elif time_elapsed_hours < 72:
            col = 1
        elif time_elapsed_hours < 96:
            col = 2
        elif time_elapsed_hours < 120:
            col = 3
        else:
            col = 4

        state_code = row[col]
        return {
            'B': AcclimatizationState.ACCLIMATIZED,
            'X': AcclimatizationState.UNKNOWN,
            'D': AcclimatizationState.DEPARTED,
        }[state_code]

    @classmethod
    def get_reference_timezone(
        cls,
        state: AcclimatizationState,
        home_timezone: str,
        current_timezone: str
    ) -> str:
        """
        Get the timezone the crew is acclimatized to.

        B state -> home timezone (reference for FDP table lookup)
        D state -> current (destination) timezone
        X state -> home timezone (conservative — use base reference)
        """
        if state == AcclimatizationState.DEPARTED:
            return current_timezone
        return home_timezone


# ============================================================================
# AUGMENTED CREW REST PLANNER (3-pilot)
# ============================================================================

class AugmentedCrewRestPlanner:
    """
    Generates in-flight rest plans for 3-pilot augmented crew operations.

    Per EASA CS FTL.1.205:
    - 2 pilots fly while 1 rests, then rotate
    - Pilots at controls during landing must get >= 2h rest
    - Other augmenting pilots must get >= 90min rest
    - Max 3 sectors per FDP

    References:
        EASA CS FTL.1.205(c)(2)
        Signal et al. (2013) Sleep 36(1):109-118
    """

    def __init__(self, params: AugmentedFDPParameters = None):
        self.params = params or AugmentedFDPParameters()

    def generate_rest_plan(
        self,
        duty: Duty,
        rest_facility_class: RestFacilityClass = RestFacilityClass.CLASS_1,
        home_timezone: str = "Asia/Qatar"
    ) -> InFlightRestPlan:
        """
        Generate in-flight rest plan for the analyzed pilot (3-pilot crew).

        The analyzed pilot gets one rest period during cruise.
        Rest is placed during WOCL when possible for better sleep quality.
        """
        if not duty.segments:
            return InFlightRestPlan(
                rest_periods=[],
                crew_composition=CrewComposition.AUGMENTED_3,
                rest_facility_class=rest_facility_class,
            )

        # Find the longest segment for rest allocation
        longest_seg = max(duty.segments, key=lambda s: s.block_time_hours)
        cruise_start = longest_seg.scheduled_departure_utc + timedelta(minutes=45)
        cruise_end = longest_seg.scheduled_arrival_utc - timedelta(minutes=45)
        cruise_hours = (cruise_end - cruise_start).total_seconds() / 3600

        if cruise_hours < 3:
            return InFlightRestPlan(
                rest_periods=[],
                crew_composition=CrewComposition.AUGMENTED_3,
                rest_facility_class=rest_facility_class,
            )

        # For the analyzed pilot (assumed to be at controls during landing):
        # they rest in the first third of cruise, ensuring >=2h rest
        rest_duration = min(
            max(self.params.min_rest_landing_crew_hours, cruise_hours / 3),
            cruise_hours * 0.45  # Don't rest more than 45% of cruise
        )

        # Place rest starting 1/6 into cruise (allow time to settle after takeoff)
        rest_start_offset = (cruise_start - duty.report_time_utc).total_seconds() / 3600
        rest_start_offset += cruise_hours / 6

        rest_start_utc = duty.report_time_utc + timedelta(hours=rest_start_offset)
        rest_end_utc = rest_start_utc + timedelta(hours=rest_duration)

        # Check WOCL overlap
        home_tz = pytz.timezone(home_timezone)
        rest_start_local = rest_start_utc.astimezone(home_tz)
        is_wocl = 0 <= rest_start_local.hour < 6 or rest_start_local.hour >= 22

        period = InFlightRestPeriod(
            start_offset_hours=rest_start_offset,
            duration_hours=rest_duration,
            start_utc=rest_start_utc,
            end_utc=rest_end_utc,
            is_during_wocl=is_wocl,
            crew_member_id="analyzed_pilot",
        )

        return InFlightRestPlan(
            rest_periods=[period],
            crew_composition=CrewComposition.AUGMENTED_3,
            rest_facility_class=rest_facility_class,
        )


# ============================================================================
# ULR REST PLANNER (4-pilot, Crew A/B)
# ============================================================================

class ULRRestPlanner:
    """
    Generates in-flight rest rotation plans for ULR operations (4-pilot).

    Per Qatar FTL 7.18.9:
    - Crew B stays on DOH time
    - Crew A adjusts slightly toward destination time
    - Rest allocated during WOCL windows when possible
    - Main WOCL: 00:00-07:00 body clock time
    - Secondary window: 14:00-17:00 body clock time
    - At least 2 rest periods, one >= 4h

    The analyzed pilot selects Crew A or Crew B since it is assigned per rotation.

    References:
        Qatar FTL 7.18.9.3, 7.18.11
        Signal et al. (2014) Aviat Space Environ Med 85:1199-1208
    """

    def __init__(self, ulr_params: ULRParameters = None):
        self.params = ulr_params or ULRParameters()

    def generate_rest_plan(
        self,
        duty: Duty,
        crew_set: ULRCrewSet = ULRCrewSet.CREW_B,
        home_timezone: str = "Asia/Qatar",
        sector: str = "outbound"
    ) -> InFlightRestPlan:
        """
        Generate in-flight rest plan for a specific crew set on ULR duty.

        Args:
            duty: The ULR duty
            crew_set: CREW_A or CREW_B
            home_timezone: Base timezone (DOH = Asia/Qatar)
            sector: "outbound" or "return"

        Returns:
            InFlightRestPlan with 2 rest periods for the analyzed pilot
        """
        if not duty.segments:
            return InFlightRestPlan(
                rest_periods=[],
                crew_composition=duty.crew_composition,  # Use duty's actual composition
                rest_facility_class=RestFacilityClass.CLASS_1,
            )

        # ULR typically single-sector
        seg = max(duty.segments, key=lambda s: s.block_time_hours)
        flight_hours = seg.block_time_hours

        # Protect first 90min and last 90min (all pilots on deck)
        protect_start_hours = 1.5
        protect_end_hours = 1.5
        available_start = seg.scheduled_departure_utc + timedelta(hours=protect_start_hours)
        available_end = seg.scheduled_arrival_utc - timedelta(hours=protect_end_hours)
        available_hours = (available_end - available_start).total_seconds() / 3600

        if available_hours < 4:
            return InFlightRestPlan(
                rest_periods=[],
                crew_composition=duty.crew_composition,  # Use duty's actual composition
                rest_facility_class=RestFacilityClass.CLASS_1,
            )

        home_tz = pytz.timezone(home_timezone)

        if crew_set == ULRCrewSet.CREW_B:
            if sector == "outbound":
                periods = self._crew_b_outbound(
                    available_start, available_end, available_hours, home_tz,
                    duty.report_time_utc
                )
            else:
                periods = self._crew_b_return(
                    available_start, available_end, available_hours, home_tz,
                    duty.report_time_utc
                )
        else:
            if sector == "outbound":
                periods = self._crew_a_outbound(
                    available_start, available_end, available_hours, home_tz,
                    duty.report_time_utc
                )
            else:
                periods = self._crew_a_return(
                    available_start, available_end, available_hours, home_tz,
                    duty.report_time_utc
                )

        return InFlightRestPlan(
            rest_periods=periods,
            crew_composition=duty.crew_composition,  # Use duty's actual composition
            rest_facility_class=RestFacilityClass.CLASS_1,
        )

    def _crew_b_outbound(self, avail_start, avail_end, avail_hours, home_tz, report_utc):
        """Crew B outbound: relief crew, rests earlier in flight."""
        long_rest_hours = min(5.0, avail_hours * 0.35)
        long_rest_hours = max(self.params.ulr_min_long_rest_hours, long_rest_hours)
        short_rest_hours = min(3.0, avail_hours * 0.20)
        short_rest_hours = max(1.5, short_rest_hours)

        long_start = avail_start + timedelta(minutes=30)
        long_end = long_start + timedelta(hours=long_rest_hours)

        gap = max(2.0, (avail_hours - long_rest_hours - short_rest_hours) / 2)
        short_start = long_end + timedelta(hours=gap)
        short_end = short_start + timedelta(hours=short_rest_hours)

        if short_end > avail_end:
            short_end = avail_end
            short_start = short_end - timedelta(hours=short_rest_hours)

        return self._build_periods(long_start, long_end, short_start, short_end, home_tz, report_utc, "B")

    def _crew_b_return(self, avail_start, avail_end, avail_hours, home_tz, report_utc):
        """Crew B return: operates landing at DOH, rests later."""
        long_rest_hours = min(5.0, avail_hours * 0.35)
        long_rest_hours = max(self.params.ulr_min_long_rest_hours, long_rest_hours)
        short_rest_hours = min(3.0, avail_hours * 0.20)
        short_rest_hours = max(1.5, short_rest_hours)

        short_start = avail_start + timedelta(minutes=30)
        short_end = short_start + timedelta(hours=short_rest_hours)

        gap = max(2.0, (avail_hours - long_rest_hours - short_rest_hours) / 3)
        long_start = short_end + timedelta(hours=gap)
        long_end = long_start + timedelta(hours=long_rest_hours)

        if long_end > avail_end - timedelta(hours=2):
            long_end = avail_end - timedelta(hours=2)
            long_start = long_end - timedelta(hours=long_rest_hours)

        return self._build_periods(long_start, long_end, short_start, short_end, home_tz, report_utc, "B")

    def _crew_a_outbound(self, avail_start, avail_end, avail_hours, home_tz, report_utc):
        """Crew A outbound: operates takeoff, rests later in flight."""
        long_rest_hours = min(5.0, avail_hours * 0.35)
        long_rest_hours = max(self.params.ulr_min_long_rest_hours, long_rest_hours)
        short_rest_hours = min(3.0, avail_hours * 0.20)
        short_rest_hours = max(1.5, short_rest_hours)

        gap_from_start = avail_hours * 0.30
        short_start = avail_start + timedelta(hours=gap_from_start)
        short_end = short_start + timedelta(hours=short_rest_hours)

        gap = max(2.0, avail_hours * 0.15)
        long_start = short_end + timedelta(hours=gap)
        long_end = long_start + timedelta(hours=long_rest_hours)

        if long_end > avail_end:
            long_end = avail_end
            long_start = long_end - timedelta(hours=long_rest_hours)

        return self._build_periods(long_start, long_end, short_start, short_end, home_tz, report_utc, "A")

    def _crew_a_return(self, avail_start, avail_end, avail_hours, home_tz, report_utc):
        """Crew A return: relief crew, rests earlier to be alert for DOH landing."""
        long_rest_hours = min(5.0, avail_hours * 0.35)
        long_rest_hours = max(self.params.ulr_min_long_rest_hours, long_rest_hours)
        short_rest_hours = min(3.0, avail_hours * 0.20)
        short_rest_hours = max(1.5, short_rest_hours)

        long_start = avail_start + timedelta(minutes=30)
        long_end = long_start + timedelta(hours=long_rest_hours)

        gap = max(2.0, (avail_hours - long_rest_hours - short_rest_hours) / 2)
        short_start = long_end + timedelta(hours=gap)
        short_end = short_start + timedelta(hours=short_rest_hours)

        if short_end > avail_end:
            short_end = avail_end
            short_start = short_end - timedelta(hours=short_rest_hours)

        return self._build_periods(long_start, long_end, short_start, short_end, home_tz, report_utc, "A")

    def _build_periods(self, long_start, long_end, short_start, short_end, home_tz, report_utc, crew_set_label):
        """Build InFlightRestPeriod objects from computed times."""
        periods = []
        for start, end, label in [
            (long_start, long_end, "long"),
            (short_start, short_end, "short"),
        ]:
            start_local = start.astimezone(home_tz)
            is_wocl = 0 <= start_local.hour < 7 or start_local.hour >= 22
            offset = (start - report_utc).total_seconds() / 3600
            duration = (end - start).total_seconds() / 3600

            periods.append(InFlightRestPeriod(
                start_offset_hours=offset,
                duration_hours=duration,
                start_utc=start,
                end_utc=end,
                is_during_wocl=is_wocl,
                crew_member_id=f"analyzed_pilot_{label}",
                crew_set=crew_set_label,
            ))

        periods.sort(key=lambda p: p.start_utc)
        return periods


# ============================================================================
# ULR COMPLIANCE VALIDATOR
# ============================================================================

class ULRComplianceValidator:
    """
    Validates ULR-specific requirements per Qatar FTL 7.18.
    """

    def __init__(self, ulr_params: ULRParameters = None):
        self.params = ulr_params or ULRParameters()

    def validate_ulr_duty(
        self,
        duty: Duty,
        roster: Roster = None,
        duty_index: int = None
    ) -> ULRComplianceResult:
        """Validate all ULR-specific compliance requirements."""
        violations = []
        warnings = []

        # 1. FDP limit check
        fdp = duty.fdp_hours
        fdp_ok = fdp <= self.params.ulr_max_planned_fdp_hours
        if not fdp_ok:
            if fdp <= self.params.ulr_max_planned_fdp_hours + self.params.ulr_discretion_max_hours:
                warnings.append(
                    f"ULR FDP {fdp:.1f}h exceeds planned limit of "
                    f"{self.params.ulr_max_planned_fdp_hours}h — commander's discretion required"
                )
                if fdp > self.params.ulr_max_planned_fdp_hours + self.params.ulr_discretion_report_threshold:
                    warnings.append(
                        f"ULR discretion >{self.params.ulr_discretion_report_threshold}h — "
                        "must be reported to QCAA"
                    )
                fdp_ok = True  # Within discretion
            else:
                violations.append(
                    f"ULR FDP {fdp:.1f}h exceeds maximum with discretion "
                    f"({self.params.ulr_max_planned_fdp_hours + self.params.ulr_discretion_max_hours}h)"
                )

        # 2. Rest period validity
        rest_ok = True
        if duty.inflight_rest_plan:
            periods = duty.inflight_rest_plan.rest_periods
            if len(periods) < self.params.ulr_min_rest_periods:
                violations.append(
                    f"ULR requires >= {self.params.ulr_min_rest_periods} rest periods, "
                    f"found {len(periods)}"
                )
                rest_ok = False
            max_period = max((p.duration_hours for p in periods), default=0)
            if max_period < self.params.ulr_min_long_rest_hours:
                violations.append(
                    f"ULR requires at least one rest period >= {self.params.ulr_min_long_rest_hours}h, "
                    f"longest is {max_period:.1f}h"
                )
                rest_ok = False
        else:
            violations.append("ULR duty has no in-flight rest plan assigned")
            rest_ok = False

        # 3. Pre-ULR rest check (requires roster context)
        pre_ok = True
        acclimatized = True
        monthly_count = 0
        monthly_ok = True
        post_ok = True

        if roster and duty_index is not None:
            # Pre-ULR: 48h duty-free + 2 local nights
            if duty_index > 0:
                prev_duty = roster.duties[duty_index - 1]
                gap_hours = (duty.report_time_utc - prev_duty.release_time_utc).total_seconds() / 3600
                if gap_hours < self.params.pre_ulr_duty_free_hours:
                    violations.append(
                        f"Pre-ULR rest {gap_hours:.1f}h < required {self.params.pre_ulr_duty_free_hours}h"
                    )
                    pre_ok = False

            # Monthly count
            duty_month = duty.date.strftime('%Y-%m')
            monthly_count = sum(
                1 for d in roster.duties
                if d.date.strftime('%Y-%m') == duty_month and d.fdp_hours > self.params.ulr_fdp_threshold_hours
            )
            if monthly_count > self.params.max_ulr_per_calendar_month:
                violations.append(
                    f"{monthly_count} ULR duties in {duty_month}, max allowed is "
                    f"{self.params.max_ulr_per_calendar_month}"
                )
                monthly_ok = False

            # Post-ULR rest check
            if duty_index < len(roster.duties) - 1:
                next_duty = roster.duties[duty_index + 1]
                post_gap = (next_duty.report_time_utc - duty.release_time_utc).total_seconds() / 3600
                arrival = duty.segments[-1].arrival_airport.code if duty.segments else None
                if arrival == roster.pilot_base:
                    required_hours = self.params.post_ulr_base_local_nights * 24
                    if post_gap < required_hours:
                        warnings.append(
                            f"Post-ULR rest at base {post_gap:.0f}h may not include "
                            f"{self.params.post_ulr_base_local_nights} local nights"
                        )
                        post_ok = False
                else:
                    if post_gap < self.params.post_ulr_away_duty_free_hours:
                        violations.append(
                            f"Post-ULR rest away from base {post_gap:.1f}h < required "
                            f"{self.params.post_ulr_away_duty_free_hours}h"
                        )
                        post_ok = False

        return ULRComplianceResult(
            is_ulr=True,
            pre_ulr_rest_compliant=pre_ok,
            post_ulr_rest_compliant=post_ok,
            monthly_ulr_count=monthly_count,
            monthly_ulr_compliant=monthly_ok,
            crew_acclimatized=acclimatized,
            fdp_within_limit=fdp_ok,
            rest_periods_valid=rest_ok,
            violations=violations,
            warnings=warnings,
        )
