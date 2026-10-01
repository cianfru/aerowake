"""Crew size from the planned FDP when the roster does not print it (captains see no IR)."""
from datetime import datetime, timedelta

import pytz

from core.compliance import EASAComplianceValidator, determine_acclimatisation
from core.crew_inference import infer_crew
from core.extended_operations import AugmentedFDPParameters, QatarFTL718Parameters
from core.parameters import EASAFatigueFramework
from models.data_models import Airport, CrewComposition, Duty, FlightSegment, ULRCrewSet

Q = pytz.timezone('Asia/Qatar')
DOH, HND = Airport('DOH', 'Asia/Qatar'), Airport('HND', 'Asia/Tokyo')
JFK, AKL = Airport('JFK', 'America/New_York'), Airport('AKL', 'Pacific/Auckland')


def duty(dep, arr, report_doh, block, report_to_dep=1.0, did='D1'):
    """One sector; report given in Doha time (day, hour, minute); FDP ends on blocks."""
    rep = Q.localize(datetime(2026, 10, *report_doh)).astimezone(pytz.utc)
    off = rep + timedelta(hours=report_to_dep)
    seg = FlightSegment('1', dep, arr, off, off + timedelta(hours=block))
    return Duty(did, datetime(2026, 10, report_doh[0]), rep, seg.scheduled_arrival_utc + timedelta(minutes=30),
                [seg], 'Asia/Qatar')


def run(*duties):
    infer_crew(list(duties), determine_acclimatisation(list(duties), 'Asia/Qatar'),
               EASAComplianceValidator(EASAFatigueFramework()), AugmentedFDPParameters(),
               QatarFTL718Parameters())


def test_fdp_beyond_two_pilots_is_three_pilots():
    # Night report (basic 11:00): FDP 12:10 cannot be 2 pilots even with the planned +1 h.
    d = duty(DOH, HND, (24, 18, 35), 11 + 10 / 60)
    run(d)
    assert d.crew_composition == CrewComposition.AUGMENTED_3 and d.crew_source == 'fdp'
    assert not d.is_ulr and d.ulr_crew_set is None


def test_fdp_within_planned_extension_stays_two_pilots():
    d = duty(DOH, HND, (21, 6, 15), 10.5)  # FDP 11:30, basic 13:00
    run(d)
    assert d.crew_composition == CrewComposition.STANDARD
    d = duty(DOH, HND, (24, 18, 35), 10 + 50 / 60)  # FDP 11:50 vs 11:00 + 1 h extension
    run(d)
    assert d.crew_composition == CrewComposition.STANDARD


def test_three_or_four_pilots_by_the_augmented_limit():
    # 3 pilots class 1: 16 h + 1 h for one sector > 9 h (CS FTL.1.205(c)(2)).
    d = duty(DOH, JFK, (5, 8, 0), 15.5)  # FDP 16:30
    run(d)
    assert d.crew_composition == CrewComposition.AUGMENTED_3
    d = duty(DOH, JFK, (5, 8, 0), 16.5)  # FDP 17:30 > 17:00
    run(d)
    assert d.crew_composition == CrewComposition.AUGMENTED_4 and not d.is_ulr


def test_ulr_city_pair_is_four_pilots_crew_a_for_a_captain():
    d = duty(DOH, AKL, (5, 7, 0), 16 + 10 / 60)
    run(d)
    assert d.crew_composition == CrewComposition.AUGMENTED_4 and d.is_ulr
    assert d.ulr_crew_set == ULRCrewSet.CREW_A


def test_pilot_setting_and_short_sectors_are_left_alone():
    d = duty(DOH, HND, (24, 18, 35), 11 + 10 / 60)
    d.crew_stated = True
    run(d)
    assert d.crew_composition == CrewComposition.STANDARD
    short = duty(DOH, HND, (24, 18, 35), 6.0, report_to_dep=6.5)  # long FDP, short sector
    run(short)
    assert short.crew_composition == CrewComposition.STANDARD


def test_ir_duty_is_sized_by_its_fdp():
    d = duty(DOH, JFK, (5, 8, 0), 13.0)  # IR (first officer), FDP 14:00
    d.crew_composition, d.is_ulr, d.ulr_crew_set, d.crew_source = (
        CrewComposition.AUGMENTED_4, True, ULRCrewSet.CREW_B, 'roster_ir')
    run(d)
    assert d.crew_composition == CrewComposition.AUGMENTED_3 and not d.is_ulr and d.ulr_crew_set is None
    akl = duty(DOH, AKL, (5, 7, 0), 16 + 10 / 60)
    akl.crew_composition, akl.ulr_crew_set, akl.crew_source = CrewComposition.AUGMENTED_4, ULRCrewSet.CREW_B, 'roster_ir'
    run(akl)
    assert akl.crew_composition == CrewComposition.AUGMENTED_4 and akl.is_ulr
    assert akl.ulr_crew_set == ULRCrewSet.CREW_B and akl.crew_source == 'roster_ir'
