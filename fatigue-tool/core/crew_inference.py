"""Crew size from the planned FDP, for rosters that do not print it.

CrewLink marks augmented sectors only for first officers (`IR`, In-flight Rest); a
captain's roster shows PIC and nothing else. The crew size is therefore inferred from
the FDP the duty needs:

* FDP above the 2-pilot maximum plus the planned extension (ORO.FTL.205(b), (d): +1 h)
  cannot be flown by 2 pilots;
* the smallest augmented crew whose maximum covers it is taken — 3 pilots up to the
  CS FTL.1.205(c)(2) limit, else 4 (rest facility class 1, the long-haul bunk);
* FDP > 18 h, or a Qatar ULR city pair, is ULR: 4 pilots (Qatar FTL 7.18).

Qatar's own augmented FDP table (OM-A Chapter 7) was not in the supplied excerpts, so
the 3/4-pilot limits are EASA-referenced (docs/QATAR_FTL.md). A duty between the
2-pilot maximum and maximum + 1 h may be a planned extension with 2 pilots: it stays
2 pilots and is flagged for the pilot (easa_checks.augmentation_likely).

The pilot's own crew setting always wins (duty.crew_stated). IR-marked duties keep the
roster's augmentation; their size (3 or 4) and ULR status come from the same rules.
"""
from __future__ import annotations

import copy
from typing import Dict, Optional

from models.data_models import CrewComposition, DutyType, RestFacilityClass, ULRCrewSet

# ORO.FTL.205(d): a planned FDP may be extended by up to 1 h (2-pilot crew).
PLANNED_EXTENSION_HOURS = 1.0
# Sectors this long can be augmented (frontend LONG_SECTOR_BLOCK_HOURS, src/lib/crew.ts).
LONG_SECTOR_BLOCK_HOURS = 7.0


def _is_ulr(duty, ulr_params) -> bool:
    if duty.fdp_hours > ulr_params.ulr_fdp_threshold_hours:
        return True
    pairs = {frozenset(p) for p in [*ulr_params.permanent_ulr_pairs, *ulr_params.seasonal_ulr_pairs]}
    return any(frozenset((s.departure_airport.code, s.arrival_airport.code)) in pairs
               for s in duty.segments if not s.is_deadhead)


def required_crew(duty, validator, augmented_params, ulr_params,
                  reference_timezone: Optional[str] = None) -> Optional[CrewComposition]:
    """Smallest crew the planned FDP needs, or None when 2 pilots may fly it."""
    if _is_ulr(duty, ulr_params):
        return CrewComposition.AUGMENTED_4
    standard = copy.copy(duty)
    standard.crew_composition, standard.is_ulr = CrewComposition.STANDARD, False
    basic = validator.calculate_fdp_limits(standard, reference_timezone=reference_timezone)['max_fdp']
    if not basic or duty.fdp_hours <= basic + PLANNED_EXTENSION_HOURS + 1e-6:
        return None
    three = augmented_params.get_max_fdp(CrewComposition.AUGMENTED_3, RestFacilityClass.CLASS_1, duty.segments)
    return CrewComposition.AUGMENTED_3 if duty.fdp_hours <= three + 1e-6 else CrewComposition.AUGMENTED_4


def infer_crew(duties, acclimatisation: Dict, validator, augmented_params, ulr_params) -> None:
    """Set crew size on long-haul flight duties whose crew the pilot has not stated."""
    for duty in duties:
        if (duty.duty_type != DutyType.FLIGHT or not duty.segments or getattr(duty, 'crew_stated', False)
                or not any(s.block_time_hours >= LONG_SECTOR_BLOCK_HOURS for s in duty.segments)):
            continue
        accl = acclimatisation.get(duty.duty_id) or {}
        if accl.get('state') is not None:
            duty.acclimatization_state = accl['state']
        from_roster = getattr(duty, 'crew_source', None) == 'roster_ir'
        if from_roster:
            # IR: augmented for certain; the FDP decides between 3 and 4 pilots.
            three = augmented_params.get_max_fdp(CrewComposition.AUGMENTED_3, RestFacilityClass.CLASS_1, duty.segments)
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
            # Crew A/B comes from the IR sector when the roster has one. A captain's roster
            # does not say: Crew A (operates the outbound from base, Qatar FTL 7.18.9.3)
            # for the whole pairing, which the pilot can switch.
            if duty.ulr_crew_set is None:
                duty.ulr_crew_set = ULRCrewSet.CREW_A
        else:
            duty.ulr_crew_set = None
        if not from_roster:
            duty.crew_source = 'fdp'
