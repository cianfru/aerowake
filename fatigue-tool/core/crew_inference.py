"""Crew size from the planned FDP, for rosters that do not print it.

CrewLink marks an augmented sector with `IR` (In-flight Rest). IR is treated as IR whatever
the pilot's rank; a duty without IR is not known to be augmented, so its crew size is an
estimate from the FDP the duty needs (flagged `crew_source` 'fdp', the pilot can choose):

* FDP above the most a 2-pilot crew may be planned for — Operator OM-A 7.6.5 Table 7-8 (planned
  extension) where an extension is allowed at that start time, else 7.6.3 Table 7-6 / 7-7 —
  cannot be flown by 2 pilots;
* the smallest augmented crew whose maximum covers it is taken — 3 pilots up to the
  OM-A 7.6.6 Table 7-9 / 7-10 limit, else 4 (rest facility class 1, the long-haul bunk);
* FDP > 18 h, or a flight to or from AKL, is ULR: 4 pilots (Operator OM-A 7.18.1, 7.18.3; DFW
  and MIA are ULR only in the season their scheduled FDP exceeds 18 h).

A duty between the basic maximum and the Table 7-8 extension may be a planned extension
with 2 pilots: it stays 2 pilots and is flagged for the pilot (easa_checks.augmentation_likely).

The pilot's own crew setting always wins (duty.crew_stated). IR-marked duties keep the
roster's augmentation; their size (3 or 4) and ULR status come from the same rules.
"""
from __future__ import annotations

import copy
from typing import Dict, Optional

from models.data_models import CrewComposition, DutyType, RestFacilityClass, ULRCrewSet

# Sectors this long can be augmented (frontend LONG_SECTOR_BLOCK_HOURS, src/lib/crew.ts).
LONG_SECTOR_BLOCK_HOURS = 7.0


def _is_ulr(duty, ulr_params) -> bool:
    """Operator OM-A 7.18.1/7.18.3: ULR = an approved city pair with a scheduled FDP over 18 h.
    Flights to and from AKL are always planned as ULR; DFW and MIA only in the season when
    the scheduled FDP exceeds 18 h, so for them (and any other pair) the FDP decides."""
    if duty.fdp_hours > ulr_params.ulr_fdp_threshold_hours:
        return True
    always = {frozenset(p) for p in ulr_params.permanent_ulr_pairs}
    return any(frozenset((s.departure_airport.code, s.arrival_airport.code)) in always
               for s in duty.segments if not s.is_deadhead)


def required_crew(duty, validator, augmented_params, ulr_params,
                  reference_timezone: Optional[str] = None) -> Optional[CrewComposition]:
    """Smallest crew the planned FDP needs, or None when 2 pilots may fly it."""
    if _is_ulr(duty, ulr_params):
        return CrewComposition.AUGMENTED_4
    standard = copy.copy(duty)
    standard.crew_composition, standard.is_ulr = CrewComposition.STANDARD, False
    limits = validator.calculate_fdp_limits(standard, reference_timezone=reference_timezone)
    two_pilot = limits.get('planned_extension_fdp') or limits['max_fdp']
    if not two_pilot or duty.fdp_hours <= two_pilot + 1e-6:
        return None
    three = augmented_params.get_max_fdp(CrewComposition.AUGMENTED_3, duty.rest_facility_class or RestFacilityClass.CLASS_1, duty.segments)
    return CrewComposition.AUGMENTED_3 if duty.fdp_hours <= three + 1e-6 else CrewComposition.AUGMENTED_4


def infer_crew(duties, acclimatisation: Dict, validator, augmented_params, ulr_params) -> None:
    """Set crew size on long-haul flight duties whose crew the pilot has not stated."""
    for duty in duties:
        if duty.duty_type == DutyType.FLIGHT and duty.segments and getattr(duty, 'crew_stated', False):
            # The pilot's crew stands; a stated 4-pilot crew still gets its ULR status and Crew A/B.
            if duty.crew_composition == CrewComposition.AUGMENTED_4:
                duty.is_ulr = _is_ulr(duty, ulr_params)
                duty.ulr_crew_set = duty.ulr_crew_set or ULRCrewSet.CREW_A
            continue
        if (duty.duty_type != DutyType.FLIGHT or not duty.segments
                or not any(s.block_time_hours >= LONG_SECTOR_BLOCK_HOURS for s in duty.segments)):
            continue
        accl = acclimatisation.get(duty.duty_id) or {}
        if accl.get('state') is not None:
            duty.acclimatization_state = accl['state']
        from_roster = getattr(duty, 'crew_source', None) == 'roster_ir'
        if from_roster:
            # IR: augmented for certain; the FDP decides between 3 and 4 pilots.
            three = augmented_params.get_max_fdp(CrewComposition.AUGMENTED_3, duty.rest_facility_class or RestFacilityClass.CLASS_1, duty.segments)
            need = (CrewComposition.AUGMENTED_4 if _is_ulr(duty, ulr_params) or duty.fdp_hours > three + 1e-6
                    else CrewComposition.AUGMENTED_3)
        elif accl.get('basis') == 'unknown' and not _is_ulr(duty, ulr_params):
            need = None  # no 2-pilot maximum without the acclimatisation state
        else:
            need = required_crew(duty, validator, augmented_params, ulr_params, accl.get('reference_timezone'))
        if need is None:
            continue
        duty.crew_composition = need
        duty.is_ulr = _is_ulr(duty, ulr_params)
        duty.rest_facility_class = duty.rest_facility_class or RestFacilityClass.CLASS_1
        if need == CrewComposition.AUGMENTED_4:
            # Crew A/B comes from the IR sector when the roster has one. Without IR it is
            # not known: Crew A (operates the outbound from base, Operator OM-A 7.18.9.3)
            # for the whole pairing, which the pilot can switch.
            if duty.ulr_crew_set is None:
                duty.ulr_crew_set = ULRCrewSet.CREW_A
        else:
            duty.ulr_crew_set = None
        if not from_roster:
            duty.crew_source = 'fdp'
