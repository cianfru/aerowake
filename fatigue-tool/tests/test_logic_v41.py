"""Engine aerowake-4.1-kss: sleep estimation, attribution and headline contract.

Synthetic rosters only (Doha base). Each test states the behaviour the
logic audit asked for; assertions, not prints, decide the outcome.
"""
import copy
import io
from datetime import datetime, timedelta

import pytest
import pytz

from core import BorbelyFatigueModel, ModelConfig
from core import alertness as aw
from core.parameters import PreDutyNapAssumptions, RiskThresholds
from core.sleep_attribution import block_key
from core.sleep_calculator import UnifiedSleepCalculator
from models.data_models import (AcclimatizationState, Airport, Duty, FlightSegment, Roster)

UTC = pytz.utc
DOHTZ = pytz.timezone('Asia/Qatar')
DOH = Airport('DOH', 'Asia/Qatar', 25.27, 51.61)
NJF = Airport('NJF', 'Asia/Baghdad', 31.99, 44.40)
RUH = Airport('RUH', 'Asia/Riyadh', 24.96, 46.70)
MNL = Airport('MNL', 'Asia/Manila', 14.51, 121.02)


def at(day, hour, month=10):
    return DOHTZ.localize(datetime(2026, month, day) + timedelta(hours=hour)).astimezone(UTC)


def njf_turn(did, day, report=17.25, month=10):
    """A 17:15–00:45 DOH–NJF–DOH late turn (home-base times)."""
    rep = at(day, report, month)
    s1 = FlightSegment('Q460', DOH, NJF, rep + timedelta(minutes=75), rep + timedelta(minutes=205))
    s2 = FlightSegment('Q461', NJF, DOH, rep + timedelta(minutes=265), rep + timedelta(minutes=400))
    return Duty(did, datetime(2026, month, day, tzinfo=UTC), rep, rep + timedelta(minutes=450),
                [s1, s2], 'Asia/Qatar')


def turn(did, day, report, dest=RUH, block=2.0, month=10):
    rep = at(day, report, month)
    s1 = FlightSegment('Q1', DOH, dest, rep + timedelta(hours=1), rep + timedelta(hours=1 + block))
    s2 = FlightSegment('Q2', dest, DOH, s1.scheduled_arrival_utc + timedelta(hours=1),
                       s1.scheduled_arrival_utc + timedelta(hours=1 + block))
    return Duty(did, datetime(2026, month, day, tzinfo=UTC), rep,
                s2.scheduled_arrival_utc + timedelta(minutes=30), [s1, s2], 'Asia/Qatar')


def roster(duties, month='2026-10'):
    return Roster('r', 'p', month, duties, 'Asia/Qatar', pilot_base='DOH')


def run(duties, month='2026-10', **config):
    model = BorbelyFatigueModel(ModelConfig.aerowake(**config))
    return model, model.simulate_roster(roster(duties, month))


def modelled_blocks(model, duties, month='2026-10', **config):
    captured = {}
    original = model._extract_sleep_from_roster

    def capture(*args, **kwargs):
        result = original(*args, **kwargs)
        captured['all'] = result[0]
        return result
    model._extract_sleep_from_roster = capture
    res = model.simulate_roster(roster(duties, month))
    return res, captured['all']


# ---------------------------------------------------------------- LOGIC-01
def test_rest_days_leave_no_phantom_debt_for_the_next_recovery_sleep(monkeypatch):
    seen = []
    original = UnifiedSleepCalculator.generate_inter_duty_sleep

    def spy(self, *args, **kwargs):
        seen.append(kwargs.get('cumulative_sleep_debt', 0.0))
        return original(self, *args, **kwargs)
    monkeypatch.setattr(UnifiedSleepCalculator, 'generate_inter_duty_sleep', spy)
    # A late turn, three days off at home (8 h nights), then three identical lates.
    duties = [njf_turn('A', 5), njf_turn('B', 10), njf_turn('C', 11), njf_turn('D', 12)]
    _, res = run(duties)
    # Debt handed to the recovery sleep after the days off is (near) zero.
    assert seen[1] < 0.5
    ledger = {t.duty_id: t.cumulative_sleep_debt for t in res.duty_timelines}
    assert ledger['B'] < 0.5
    kss = {t.duty_id: t.kss_peak_duty for t in res.duty_timelines}
    assert kss['C'] == pytest.approx(kss['D'], abs=0.1)


# ---------------------------------------------------------------- LOGIC-03 / 06
def test_every_modelled_sleep_block_is_exposed_exactly_once():
    from api.api_server import _build_rest_days_sleep, _build_sleep_quality
    duties = [turn('E', 3, 6.5), njf_turn('L1', 8), turn('N', 11, 22.5), njf_turn('L2', 12), turn('M', 17, 13.0)]
    model = BorbelyFatigueModel(ModelConfig.aerowake(nap_habit='usually'))
    res, blocks = modelled_blocks(model, duties)
    exposed = []
    for tl in res.duty_timelines:
        sq = _build_sleep_quality(tl)
        exposed += [(b.sleep_start_utc, b.sleep_end_utc) for b in (sq.sleep_blocks if sq else [])]
    for day in _build_rest_days_sleep(model.sleep_strategies):
        exposed += [(b.sleep_start_utc, b.sleep_end_utc) for b in day.sleep_blocks]
    norm = lambda pair: tuple(datetime.fromisoformat(x).astimezone(UTC) for x in pair)
    assert sorted(map(norm, exposed)) == sorted((b.start_utc, b.end_utc) for b in blocks)
    # The night-report nap is in the duty's own sleep panel, typed as a nap.
    night = next(t for t in res.duty_timelines if t.duty_id == 'N')
    types = [b['sleep_type'] for b in night.sleep_quality_data['sleep_blocks']]
    assert 'nap' in types and night.assumed_nap_hours
    assert 'nap habit: usually' in night.sleep_quality_data['explanation']


def test_first_duty_after_days_off_shows_its_last_night_not_older_recovery():
    duties = [turn('A', 3, 7.0), njf_turn('B', 9)]
    _, res = run(duties)
    b = next(t for t in res.duty_timelines if t.duty_id == 'B')
    blocks = b.sleep_quality_data['sleep_blocks']
    main = [x for x in blocks if x['sleep_type'] == 'main'][-1]
    end = datetime.fromisoformat(main['sleep_end_utc'])
    assert timedelta(0) < duties[1].report_time_utc - end < timedelta(hours=14)


# ---------------------------------------------------------------- LOGIC-05 + owner decision (2)
def test_nap_ramp_and_habits():
    naps = PreDutyNapAssumptions()
    # Ramp from 14:00 (late-report afternoon nap) to the full nap at 20:00.
    assert naps.nap_hours(13.9, 12, 'usually') == 0
    assert naps.nap_hours(17.0, 12, 'usually') == pytest.approx(1.25)
    assert naps.nap_hours(20.0, 12, 'usually') == pytest.approx(2.5)
    assert naps.nap_hours(22.0, 12, 'usually') == pytest.approx(2.5)
    assert naps.nap_hours(1.0, 12, 'usually') == pytest.approx(2.5)
    # 'sometimes' = population average: 54 % of crews nap (Signal et al. 2014).
    assert naps.nap_hours(20.0, 12, 'sometimes') == pytest.approx(2.5 * 0.54, abs=1 / 60)
    assert naps.nap_hours(17.0, 12, 'sometimes') == pytest.approx(1.25 * 0.54, abs=1 / 60)
    assert naps.nap_hours(14.5, 12, 'sometimes') == 0  # below the shortest modelled nap
    # Continuous: no step larger than the ramp slope between adjacent quarter hours.
    steps = [naps.nap_hours(14 + q / 4, 12, h) for h in ('usually', 'sometimes') for q in range(25)]
    assert max(abs(a - b) for a, b in zip(steps, steps[1:]) if a and b) < 0.2
    assert naps.nap_hours(23.0, 12, 'rarely') == 0
    # Window-limited: little time since waking means little or no nap.
    assert naps.nap_hours(23.0, 6.5, 'usually') == pytest.approx(0.5)
    assert naps.nap_hours(23.0, 5.0, 'usually') == 0


@pytest.mark.parametrize('habit', ['usually', 'sometimes', 'rarely'])
def test_no_cliff_in_risk_around_twenty_hundred(habit):
    """Same sector after days off: 15 minutes of report time cannot flip the score."""
    peaks = []
    for minutes in range(18 * 60, 22 * 60 + 1, 15):
        _, res = run([turn('A', 3, 7.0), turn('B', 7, minutes / 60, block=1.5)], nap_habit=habit)
        peaks.append(res.duty_timelines[-1].kss_peak_duty)
    steps = [abs(b - a) for a, b in zip(peaks, peaks[1:])]
    assert max(steps) < 0.3, list(zip(range(18 * 60, 22 * 60 + 1, 15), peaks))


def test_rarely_assumes_no_pre_duty_nap_and_usually_scores_lower():
    duties = [turn('A', 3, 7.0), turn('N', 7, 23.0)]
    _, rarely = run(duties, nap_habit='rarely')
    _, usually = run(copy.deepcopy(duties), nap_habit='usually')
    n_rarely, n_usually = rarely.duty_timelines[-1], usually.duty_timelines[-1]
    assert n_rarely.assumed_nap_hours is None
    assert n_usually.assumed_nap_hours == pytest.approx(2.5, abs=0.05)
    assert n_usually.max_kss < n_rarely.max_kss


# ---------------------------------------------------------------- LOGIC-04
def test_afternoon_release_never_models_a_long_afternoon_sleep():
    peaks = []
    for minutes in range(22 * 60, 27 * 60 + 1, 15):
        early = turn('E', 3, 5.0, block=2.5)          # released about 13:30
        night = turn('N', 3, minutes / 60, block=1.5)  # report the same night
        model = BorbelyFatigueModel(ModelConfig.aerowake())
        res, blocks = modelled_blocks(model, [early, night])
        for b in blocks:
            start = b.start_utc.astimezone(DOHTZ)
            if 12 <= start.hour < 18:
                assert b.duration_hours <= 4.0, (minutes, start, b.duration_hours)
        peaks.append(res.duty_timelines[-1].kss_peak_duty)
    steps = [abs(b - a) for a, b in zip(peaks, peaks[1:])]
    assert max(steps) < 0.5, peaks


# ---------------------------------------------------------------- headline window (owner decision 1)
@pytest.mark.parametrize('window', ['fdp', 'duty'])
def test_headline_window_paths(window):
    _, res = run([njf_turn('A', 5)], headline_risk_window=window)
    tl = res.duty_timelines[0]
    assert tl.headline_window == window
    assert tl.kss_peak_fdp <= tl.kss_peak_duty
    expected = tl.kss_peak_fdp if window == 'fdp' else tl.kss_peak_duty
    assert tl.max_kss == expected
    assert tl.min_performance == pytest.approx(aw.kss_to_index(tl.max_kss), abs=0.06)
    last_on_blocks = res.roster.duties[0].segments[-1].scheduled_arrival_utc
    if window == 'fdp':
        assert tl.peak_time_utc <= last_on_blocks


def test_default_headline_window_is_fdp():
    assert ModelConfig.aerowake().headline_risk_window == 'fdp'
    assert ModelConfig.aerowake().nap_assumptions.habit == 'sometimes'
    with pytest.raises(ValueError):
        ModelConfig.aerowake(nap_habit='never')


def test_segment_kss_comes_from_the_duty_timeline():
    _, res = run([njf_turn('A', 5)], headline_risk_window='duty')
    tl, duty = res.duty_timelines[0], res.roster.duties[0]
    assert len(tl.segment_kss) == len(duty.segments)
    for seg, kss in zip(duty.segments, tl.segment_kss):
        inside = [p.kss for p in tl.timeline if p.kss is not None
                  and seg.scheduled_departure_utc <= p.timestamp_utc <= seg.scheduled_arrival_utc]
        assert kss['kss_peak'] == max(inside)
        assert kss['kss_peak'] <= tl.kss_peak_duty
        assert kss['kss_at_arrival'] in inside


# ---------------------------------------------------------------- LOGIC-09
@pytest.mark.parametrize('kss, band', [
    (5.44, 'low'), (5.4499, 'moderate'), (5.45, 'moderate'), (6.44, 'moderate'), (6.45, 'high'),
    (6.4999, 'high'), (7.4999, 'critical'), (8.44, 'critical'), (8.45, 'extreme'), (8.4999, 'extreme'),
])
def test_bands_use_kss_rounded_to_one_decimal(kss, band):
    assert aw.classify_kss(kss) == band
    assert RiskThresholds().classify(aw.kss_to_index(kss)) == band


def test_round_half_up_matches_javascript_math_round():
    assert aw.round_half_up(6.45, 1) == 6.5
    assert aw.round_half_up(6.449, 1) == 6.4
    assert aw.band_kss(6.4496) == 6.5   # 6.45 after two decimals, as the API sends it


# ---------------------------------------------------------------- LOGIC-07 / 12 / 14
def test_average_sleep_covers_only_estimated_days():
    _, res = run([turn('A', 3, 7.0), turn('B', 6, 7.0), turn('C', 9, 7.0)])
    assert 6.5 < res.average_sleep_per_night < 9.5
    assert 7 < res.sleep_coverage_days < 10


def test_prior_sleep_counts_all_sleep_in_the_24h_before_report():
    duties = [turn('A', 4, 6.0, block=1.0), turn('B', 4, 20.0, block=1.0)]
    model = BorbelyFatigueModel(ModelConfig.aerowake())
    res, blocks = modelled_blocks(model, duties)
    b = res.duty_timelines[1]
    start, end = duties[1].report_time_utc - timedelta(hours=24), duties[1].report_time_utc
    expected = sum(max(0, (min(end, x.end_utc) - max(start, x.start_utc)).total_seconds()) for x in blocks) / 3600
    assert b.prior_sleep_hours == pytest.approx(expected, abs=0.01)


def test_monthly_curve_carries_each_duty_peak():
    _, res = run([njf_turn('A', 5), turn('B', 8, 9.0)])
    curve = res.roster.alertness_timeline
    for tl, duty in zip(res.duty_timelines, res.roster.duties):
        on = [p['kss'] for p in curve if p['kss'] is not None and
              duty.report_time_utc.isoformat() <= p['t'] <= duty.release_time_utc.isoformat()]
        assert tl.max_kss in on and tl.kss_peak_duty in on


# ---------------------------------------------------------------- LOGIC-08
def _mnl_trip(return_hours_after):
    out_rep = at(3, 1.0)
    out = FlightSegment('Q928', DOH, MNL, out_rep + timedelta(hours=1), out_rep + timedelta(hours=10))
    d1 = Duty('OUT', datetime(2026, 10, 3, tzinfo=UTC), out_rep, out.scheduled_arrival_utc + timedelta(minutes=30),
              [out], 'Asia/Qatar')
    back_rep = out_rep + timedelta(hours=return_hours_after)
    back = FlightSegment('Q929', MNL, DOH, back_rep + timedelta(hours=1), back_rep + timedelta(hours=10.25))
    d2 = Duty('BACK', datetime(2026, 10, 5, tzinfo=UTC), back_rep, back.scheduled_arrival_utc + timedelta(minutes=30),
              [back], 'Asia/Qatar')
    return [d1, d2]


def test_acclimatisation_unknown_state_uses_qatar_table_7_7():
    # MNL is +5 h from DOH; reporting 56 h after leaving base is state X. Qatar Airways
    # has an approved FRM: OM-A 7.6.3 Table 7-7, 12:00 for 1-2 sectors (EASA Table 3: 11:00).
    _, res = run(_mnl_trip(56))
    back = res.roster.duties[1]
    assert back.acclimatization_state == AcclimatizationState.UNKNOWN
    assert back.max_fdp_hours == 12.0
    assert back.fdp_limit_reference == 'OM-A 7.6.3 Table 7-7'
    assert back.planned_extension_fdp_hours is None  # 7.6.5 is for acclimatised crew only
    tl = res.duty_timelines[1]
    assert tl.acclimatization_basis == 'determined'


def test_acclimatisation_within_48h_keeps_base_reference():
    _, res = run(_mnl_trip(30))
    assert res.roster.duties[1].acclimatization_state == AcclimatizationState.ACCLIMATIZED


def test_fdp_not_assessed_when_acclimatisation_cannot_be_determined():
    from core.easa_checks import run_checks
    trip = _mnl_trip(56)[1:]   # roster starts at the outstation
    _, res = run(trip)
    assert res.roster.duties[0].max_fdp_hours is None
    coverage = run_checks(res.roster)['summary']['coverage']['fdp_max']
    assert coverage['status'] == 'not_assessed'


# ---------------------------------------------------------------- LOGIC-13
def test_high_duties_always_have_a_reason():
    from api.api_server import _build_duty_response
    _, res = run([njf_turn('A', 5), njf_turn('B', 6), njf_turn('C', 7)], headline_risk_window='duty')
    for tl, duty in zip(res.duty_timelines, res.roster.duties):
        out = _build_duty_response(tl, duty, res.roster)
        assert out.risk_level == aw.classify_kss(out.max_kss)
        if out.risk_level in ('high', 'critical', 'extreme'):
            assert out.risk_reasons
        assert [s.kss_peak for s in out.segments] == [x['kss_peak'] for x in tl.segment_kss]


# ---------------------------------------------------------------- API contract
def _csv(rows):
    head = 'Date,Flight,Departure,Arrival,STD,STA,Report,Release,DepartureDate\n'
    return (head + '\n'.join(rows) + '\n').encode()


LATES = [f'2026-10-{d:02d},QR46{i},{a},{b},{std},{sta},17:15,00:45,'
         for d in (5, 6, 12) for i, (a, b, std, sta) in enumerate([('DOH', 'NJF', '18:30', '20:40'),
                                                                   ('NJF', 'DOH', '21:40', '23:55')])]
NIGHT = ['2026-10-14,QR1238,DOH,RUH,22:45,00:45,21:30,04:15,', '2026-10-14,QR1239,RUH,DOH,01:45,03:45,21:30,04:15,2026-10-15']


@pytest.fixture(scope='module')
def client():
    from fastapi.testclient import TestClient
    from api.api_server import app
    with TestClient(app) as c:
        yield c


H = {'X-Guest-Session': 'g' * 40}


def _analyze(client, **data):
    files = {'file': ('roster.csv', io.BytesIO(_csv(LATES + NIGHT)), 'text/csv')}
    return client.post('/api/analyze', headers=H, files=files, data={'home_base': 'DOH', 'month': '2026-10', **data})


def test_analyze_echoes_assumptions_and_new_duty_fields(client):
    r = _analyze(client, nap_habit='usually')
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['assumptions'] == {'nap_habit': 'usually', 'headline_risk_window': 'fdp',
                                   'usual_bedtime': '23:00', 'usual_wake_time': '07:00'}
    assert body['engine_version'] == 'aerowake-4.1-kss'
    for d in body['duties']:
        assert d['model_version'] == 'aerowake-4.1-kss'
        assert d['headline_window'] == 'fdp' and d['kss_peak_fdp'] == d['max_kss']
        assert d['risk_level'] == aw.classify_kss(d['max_kss'])
        assert d['peak_time_utc']
        for s in d['segments']:
            assert s['kss_peak'] is not None and s['risk_level'] == aw.classify_kss(s['kss_peak'])
    naps = [b for d in body['duties'] for b in (d['sleep_quality'] or {}).get('sleep_blocks', [])
            if b['sleep_type'] == 'nap']
    assert naps, 'the night duty should show its assumed nap'


def test_analyze_rejects_unknown_nap_habit(client):
    assert _analyze(client, nap_habit='always').status_code == 422


def test_what_if_on_first_duty_after_days_off(client):
    # No assumed pre-duty nap, so awake time at report runs from the main sleep.
    body = _analyze(client, nap_habit='rarely').json()
    duty = next(d for d in body['duties'] if d['date'] == '2026-10-12')
    sq = duty['sleep_quality']
    start = datetime.fromisoformat(sq['sleep_start_utc'])
    end = datetime.fromisoformat(sq['sleep_end_utc'])
    mod = {'duty_id': duty['duty_id'], 'sleep_start_utc': start.isoformat(),
           'sleep_end_utc': (end + timedelta(hours=2)).isoformat()}
    r = client.post('/api/what-if', headers=H, json={'analysis_id': body['analysis_id'], 'sleep_modifications': [mod]})
    assert r.status_code == 200, r.text
    after = next(d for d in r.json()['duties'] if d['duty_id'] == duty['duty_id'])
    assert after['pre_duty_awake_hours'] == pytest.approx(duty['pre_duty_awake_hours'] - 2, abs=0.1)
    assert r.json()['assumptions']['nap_habit'] == 'rarely'


def test_what_if_can_target_any_block(client):
    body = _analyze(client).json()
    rest = next(day for day in body['rest_days_sleep'] if day['date'] == '2026-10-09')
    block = rest['sleep_blocks'][0]
    start = datetime.fromisoformat(block['sleep_start_utc'])
    target_duty = next(d for d in body['duties'] if d['date'] == '2026-10-12')
    mod = {'duty_id': target_duty['duty_id'], 'block_start_utc': block['sleep_start_utc'],
           'sleep_start_utc': (start + timedelta(hours=1)).isoformat(),
           'sleep_end_utc': (start + timedelta(hours=6)).isoformat()}
    r = client.post('/api/what-if', headers=H, json={'analysis_id': body['analysis_id'], 'sleep_modifications': [mod]})
    assert r.status_code == 200, r.text
    starts = [b['sleep_start_utc'] for day in r.json()['rest_days_sleep'] for b in day['sleep_blocks']]
    starts += [b['sleep_start_utc'] for d in r.json()['duties'] for b in (d['sleep_quality'] or {}).get('sleep_blocks', [])]
    assert block['sleep_start_utc'] not in starts
    assert any(datetime.fromisoformat(s) == start + timedelta(hours=1) for s in starts)


def test_airport_batch_includes_name_city_country(client):
    r = client.post('/api/airports/batch', json={'codes': ['DOH', 'LHR']})
    doh = next(a for a in r.json() if a['code'] == 'DOH')
    assert doh['city'] == 'Doha' and doh['country'] == 'QA' and 'Hamad' in doh['name']


def test_replay_accepts_snapshots_from_both_kss_engines():
    from api.replay import restore, snapshot
    snap = snapshot(roster([njf_turn('A', 5)]))
    assert restore(snap).duties[0].duty_id == 'A'
    snap['engine'] = 'aerowake-4.0-kss'
    assert restore(snap).duties[0].duty_id == 'A'
    snap['engine'] = 'aerowake-3.2'
    with pytest.raises(Exception):
        restore(snap)


def test_curve_duty_peak_points_never_exceed_headline():
    """A 'duty_peak' sample is the headline peak; later post-flight maxima are 'release_peak'."""
    _, res = run([njf_turn('A', 10), njf_turn('B', 11), njf_turn('C', 12)])
    timeline = res.roster.alertness_timeline
    for tl in res.duty_timelines:
        tagged = [p for p in timeline if p.get('duty_peak') == tl.duty_id]
        assert tagged, tl.duty_id
        assert all(p['kss'] <= tl.max_kss + 1e-9 for p in tagged)


@pytest.mark.parametrize('habit', ['usually', 'sometimes', 'rarely'])
def test_no_cliff_when_previous_release_moves_across_midday(habit):
    """Moving the previous release in 15-min steps must not jump the next night duty's risk."""
    peaks = []
    for q in range(0, 25):  # previous report 04:00..10:00 -> release about 09:30..15:30
        r = 4.0 + q / 4
        _, res = run([turn('P', 9, 8.0), turn('A', 10, r), turn('X', 10, 26.5)], nap_habit=habit)
        peaks.append(res.duty_timelines[-1].kss_peak_fdp)
    jumps = [abs(a - b) for a, b in zip(peaks, peaks[1:])]
    assert max(jumps) < 0.3, list(zip([4.0 + q / 4 for q in range(25)], peaks))
