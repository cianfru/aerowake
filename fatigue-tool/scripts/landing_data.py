"""Regenerate the illustrative engine outputs shown on the public landing page.

Run from fatigue-tool:  python scripts/landing_data.py
It prints TypeScript literals for
  fatigue-insight-hub/src/components/landing/tourData.ts   (TOUR_DUTIES, TOUR_TOTALS, TOUR_WEEK.kss)
  fatigue-insight-hub/src/components/landing/scienceData.ts (SCIENCE_SCENARIO series)

Inputs are synthetic only: TOUR_ROSTER_CSV below uses generic XY flight
numbers and no real pilot or schedule. It lives in this file rather than as a
.csv because roster files are git-ignored to keep real rosters out of the
repo. tests/test_landing_data.py recomputes the same values, so a model change that moves a published figure
fails CI until the literals are regenerated here and pasted back.
"""
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TOUR_ROSTER_CSV = """\
Date,Flight,Departure,Arrival,DepartureDate,ArrivalDate,STD,STA,Report,Release
2026-10-01,XY101,DOH,MCT,2026-10-01,2026-10-01,07:30,10:00,06:15,12:15
2026-10-01,XY102,MCT,DOH,2026-10-01,2026-10-01,11:00,11:45,06:15,12:15
2026-10-03,XY201,DOH,LHR,2026-10-03,2026-10-03,09:15,14:15,08:00,16:45
2026-10-05,XY202,LHR,DOH,2026-10-05,2026-10-06,21:30,06:00,22:15,06:30
2026-10-07,XY301,DOH,BKK,2026-10-07,2026-10-07,01:55,12:10,00:40,08:40
2026-10-09,XY302,BKK,DOH,2026-10-09,2026-10-09,19:20,22:05,14:05,22:35
2026-10-12,XY401,DOH,NJF,2026-10-12,2026-10-12,18:30,20:40,17:15,00:45
2026-10-12,XY402,NJF,DOH,2026-10-12,2026-10-12,21:40,23:55,17:15,00:45
2026-10-13,XY401,DOH,NJF,2026-10-13,2026-10-13,18:30,20:40,17:15,00:45
2026-10-13,XY402,NJF,DOH,2026-10-13,2026-10-13,21:40,23:55,17:15,00:45
2026-10-15,XY101,DOH,MCT,2026-10-15,2026-10-15,07:30,10:00,06:15,12:15
2026-10-15,XY102,MCT,DOH,2026-10-15,2026-10-15,11:00,11:45,06:15,12:15
2026-10-18,XY501,DOH,IST,2026-10-18,2026-10-18,08:30,12:50,07:15,13:20
2026-10-19,XY502,IST,DOH,2026-10-19,2026-10-19,14:00,18:10,12:45,18:40
2026-10-21,XY601,DOH,CDG,2026-10-21,2026-10-21,01:50,07:35,00:35,09:05
2026-10-22,XY602,CDG,DOH,2026-10-22,2026-10-22,11:30,18:30,11:15,19:00
2026-10-27,XY401,DOH,NJF,2026-10-27,2026-10-27,18:30,20:40,17:15,00:45
2026-10-27,XY402,NJF,DOH,2026-10-27,2026-10-27,21:40,23:55,17:15,00:45
"""
HOME = timezone(timedelta(hours=3))  # DOH, UTC+3, no DST
HOME_OFFSET_HOURS = 3.0


def analyse_tour() -> dict:
    """Run the synthetic October roster through /api/analyze in-process (guest, not persisted)."""
    from fastapi.testclient import TestClient
    from api.api_server import app

    client = TestClient(app)
    response = client.post(
        '/api/analyze',
        files={'file': ('landing_tour_roster.csv', TOUR_ROSTER_CSV.encode(), 'text/csv')},
        data={'month': '2026-10', 'home_base': 'DOH', 'pilot_id': 'SAMPLE'},
        headers={'X-Guest-Session': 'landing-data-' + uuid.uuid4().hex + uuid.uuid4().hex},
    )
    response.raise_for_status()
    return response.json()


def tour_duties(analysis: dict) -> list[dict]:
    duties = []
    for duty in analysis['duties']:
        segments = duty['segments']
        duties.append({
            'date': duty['date'],
            'route': [segments[0]['departure']] + [s['arrival'] for s in segments],
            'report': duty['report_time_local'],
            'release': duty['release_time_local'],
            'peakKss': round(duty['max_kss'], 2),
            'wocl': duty['wocl_hours'] > 0,
            'reasons': list(duty.get('risk_reasons') or []),
        })
    return duties


def tour_week_kss(analysis: dict) -> list[float | None]:
    """Model KSS every 30 min for Mon 5 to Sun 11 Oct (home time), None while asleep."""
    start = datetime(2026, 10, 5, tzinfo=HOME)
    end = start + timedelta(days=7)
    out: list[float | None] = []
    for point in analysis['alertness_timeline']:
        t = datetime.fromisoformat(point['t']).astimezone(HOME)
        if start <= t < end:
            out.append(None if point['asleep'] else round(point['kss'], 2))
    return out


def _local(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=HOME)


def science_series(nap: bool) -> list[float | None]:
    """KSS every 15 min from 08:00 on 7 Oct to 10:00 on 8 Oct (home time).

    Usual sleep 23:00-07:00 on the preceding nights; duty 01:00-09:00.
    The nap variant adds 15:00-17:00. Values are None while asleep and for the
    first hour after a nap, because sleep inertia is not modelled.
    """
    from core import published_tpm as tpm

    nights = [(_local(d, 23), _local(d + 1, 7)) for d in range(3, 7)]
    extra = [(_local(7, 15), _local(7, 17))] if nap else []
    sleeps = sorted(nights + extra)
    out: list[float | None] = []
    t = _local(7, 8)
    while t <= _local(8, 10):
        if any(start <= t < end + timedelta(hours=1) for start, end in extra):
            out.append(None)
        else:
            kss = tpm.predict(t, [s for s in sleeps if s[1] <= t], HOME_OFFSET_HOURS)['kss']
            out.append(round(kss, 2))
        t += timedelta(minutes=15)
    return out


def _ts_number(value: float | None) -> str:
    return 'null' if value is None else f'{value:.2f}'.rstrip('0').rstrip('.')


def main() -> None:
    analysis = analyse_tour()
    print('// TOUR_DUTIES (peakKss, wocl, route, times); engine reasons listed for reference')
    for d in tour_duties(analysis):
        print(
            f"  {{ date: '{d['date']}', route: {json.dumps(d['route'])}, report: '{d['report']}', "
            f"release: '{d['release']}', peakKss: {_ts_number(d['peakKss'])}, wocl: {str(d['wocl']).lower()} }},"
            f"  // {d['reasons']}"
        )
    print(f"// TOUR_TOTALS = {{ duties: {analysis['total_duties']}, sectors: {analysis['total_sectors']} }}")
    print('// TOUR_WEEK.kss')
    print('[' + ', '.join(_ts_number(v) for v in tour_week_kss(analysis)) + ']')
    for key, nap in (('noNap', False), ('nap2h', True)):
        print(f'// SCIENCE_SCENARIO.{key}')
        print('[' + ', '.join(_ts_number(v) for v in science_series(nap)) + ']')


if __name__ == '__main__':
    main()
