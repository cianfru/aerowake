"""CSV roster parsing: duty grouping and overnight times."""
import csv
import pytz
from parsers.roster_parser import CSVRosterParser as RosterParser


def write(tmp_path, rows):
    p = tmp_path / 'r.csv'
    with open(p, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['Date', 'Flight', 'Departure', 'Arrival', 'STD', 'STA', 'Report', 'Release'])
        w.writeheader(); w.writerows(rows)
    return str(p)


def row(date, flt, dep, arr, std, sta, rep, rel):
    return dict(Date=date, Flight=flt, Departure=dep, Arrival=arr, STD=std, STA=sta, Report=rep, Release=rel)


def test_same_report_time_on_consecutive_days_are_separate_duties(tmp_path):
    rows = [row(f'2026-09-{d:02d}', f, a, b, s, e, '14:00', '21:30')
            for d in (10, 11, 12) for f, a, b, s, e in (('X1', 'LGW', 'FCO', '15:00', '18:25'), ('X2', 'FCO', 'LGW', '19:15', '20:55'))]
    roster = RosterParser(home_base='LGW', home_timezone='Europe/London').parse_csv(write(tmp_path, rows), 'p', '2026-09')
    assert len(roster.duties) == 3
    assert all(len(d.segments) == 2 for d in roster.duties)


def test_overnight_arrival_and_release_roll_to_next_day(tmp_path):
    rows = [row('2026-09-12', 'X1', 'LGW', 'TFS', '15:00', '19:30', '14:00', '02:15'),
            row('2026-09-12', 'X2', 'TFS', 'LGW', '20:30', '01:45', '14:00', '02:15')]
    duty = RosterParser(home_base='LGW', home_timezone='Europe/London').parse_csv(write(tmp_path, rows), 'p', '2026-09').duties[0]
    assert duty.segments[1].scheduled_arrival_utc > duty.segments[1].scheduled_departure_utc
    assert duty.release_time_utc > duty.segments[1].scheduled_arrival_utc
    assert duty.release_time_utc.astimezone(pytz.timezone('Europe/London')).day == 13
    assert 11 < duty.duty_hours < 13


def test_row_order_does_not_change_scores(tmp_path):
    """Sleep is chained duty to duty, so a CSV listed out of date order must score the same."""
    from core import BorbelyFatigueModel, ModelConfig
    lates = [row(f'2026-10-{d:02d}', f, a, b, s, e, '17:15', '00:45')
             for d in (5, 6, 20) for f, a, b, s, e in (('QR460', 'DOH', 'NJF', '18:30', '20:40'), ('QR461', 'NJF', 'DOH', '21:40', '23:55'))]
    earlies = [row(f'2026-10-{d:02d}', f, a, b, s, e, '06:15', '14:10')
               for d in (15, 16) for f, a, b, s, e in (('QR1052', 'DOH', 'MCT', '07:30', '10:00'), ('QR1053', 'MCT', 'DOH', '11:00', '11:45'))]

    def scores(rows, name):
        p = tmp_path / name
        p.mkdir()
        roster = RosterParser(home_base='DOH').parse_csv(write(p, rows), 'p', '2026-10')
        res = BorbelyFatigueModel(ModelConfig.aerowake()).simulate_roster(roster)
        assert [d.report_time_utc for d in roster.duties] == sorted(d.report_time_utc for d in roster.duties)
        return {d.report_time_utc: round(t.max_kss, 3) for d, t in zip(roster.duties, res.duty_timelines)}

    assert scores(lates + earlies, 'unsorted') == scores(sorted(lates + earlies, key=lambda r: (r['Date'], r['STD'])), 'sorted')
