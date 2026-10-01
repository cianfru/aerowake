"""Synthetic CrewLink cells matching the supplied format; no private roster is stored."""
from datetime import datetime
from parsers.qatar_crewlink_parser import CrewLinkRosterParser
from parsers.reconciliation import review
from models.data_models import Roster, DutyType

def test_utc_grid_continuation_and_month_clipping():
    parser=CrewLinkRosterParser(timezone_format='zulu')
    table=[['28Feb Sat','01Mar Sun'],
           ['RPT:21:00\n1100\nDOH\n22:00\nDMM\n23:15\n(320)',
            '1101\nDMM\n00:30\nDOH\n01:45\n(320)']]
    duties=parser._parse_grid_to_duties(table,2026)
    assert len(duties)==1 and len(duties[0].segments)==2
    assert duties[0].report_time_utc.isoformat()=='2026-02-28T21:00:00+00:00'
    assert duties[0].segments[-1].scheduled_arrival_utc.isoformat()=='2026-03-01T01:45:00+00:00'
    roster=Roster('reference','synthetic','2026-02',duties,'Asia/Qatar',pilot_base='DOH')
    parser.pilot_info={'block_hours':'01:15','duty_hours':'05:00'}
    result=review(roster,parser,'.pdf')
    assert result['whole_duty_block_hours']==2.5
    assert result['calendar_month_block_hours']==1.25
    assert result['block_total_matches_source'] is True
    assert any('inferred' in w for w in result['warnings'])

def test_explicit_next_day_and_standby_have_distinct_accounting():
    parser=CrewLinkRosterParser(timezone_format='zulu')
    duty=parser._parse_column_to_duty(datetime(2026,2,18),['RPT:21:00\n1102\nTRV\n22:00\nDOH\n02:30(+1)\n(320)'])
    assert duty.segments[0].scheduled_arrival_utc.isoformat()=='2026-02-19T02:30:00+00:00'
    standby=parser._parse_column_to_duty(datetime(2026,2,1),['RPT:03:00\nPSBY\nDOH\n03:00\n11:00'])
    assert standby.duty_type==DutyType.HOME_STANDBY
    assert standby.duty_hours==8


def _base_column(code, rpt='08:00', start='08:30', end='12:30', extra=()):
    return [f'RPT:{rpt}\n{code}\nDOH\n{start}\n{end}\nPA', *extra]


def test_qatar_simulator_ground_and_standby_codes():
    """Codes from the CrewLink legend: type-prefixed sims (32RC, 35LP), the instructor
    upgrade sim series (SIMI, SIMI2), ground/office (GTCT, GRND, AOFC), ISYU standby, CTC."""
    parser = CrewLinkRosterParser(timezone_format='local', home_base='DOH', home_timezone='Asia/Qatar')
    day = datetime(2026, 10, 16)
    for code in ('32RC', '35LP', 'SIMI', 'SIMI2', 'OPTR'):
        duty = parser._parse_column_to_duty(day, _base_column(code, extra=['07:00\n00:00']))
        assert duty.duty_type == DutyType.SIMULATOR and duty.training_code == code
        # The duty-hour totals printed below the session (07:00, 00:00) are not times.
        assert duty.duty_hours == 5.0
    for code in ('GTCT', 'GRND', 'AOFC'):
        assert parser._parse_column_to_duty(day, _base_column(code)).duty_type == DutyType.GROUND_TRAINING
    assert parser._parse_column_to_duty(day, _base_column('ISYU')).duty_type == DutyType.HOME_STANDBY
    assert parser._parse_column_to_duty(day, _base_column('CTC')) is None
    assert parser.unrecognised_codes == []


def test_two_activities_in_one_day_are_one_duty():
    parser = CrewLinkRosterParser(timezone_format='local', home_base='DOH', home_timezone='Asia/Qatar')
    duty = parser._parse_column_to_duty(datetime(2026, 10, 8), [
        'RPT:08:00\nGTCT\nDOH\n08:00\n12:00\nPA,LQ\nRPT:12:00\nGRND\nDOH\n12:00\n16:00\nPA,LQ', '08:00\n00:00'])
    assert duty.duty_hours == 8.5  # 08:00 to 16:00 + 30 min


def test_bled_report_digits_and_unknown_base_code():
    parser = CrewLinkRosterParser(timezone_format='local', home_base='DOH', home_timezone='Asia/Qatar')
    day = datetime(2026, 10, 31)
    duty = parser._parse_column_to_duty(day, ['0R PT:15:00\nSIMI2\nDOH\n16:30\n20:30\nPA,EQ'])
    assert duty.report_time_utc.hour == 12  # 15:00 Doha
    duty = parser._parse_column_to_duty(day, ['RPT:15:0\nSIMI\nDOH\n16:30\n20:30\nPA,EQ'])
    assert duty.report_time_utc.hour == 12
    duty = parser._parse_column_to_duty(day, _base_column('ZQX9'))
    assert duty.duty_type == DutyType.GROUND_TRAINING and parser.unrecognised_codes == ['ZQX9']
    roster = Roster('reference', 'synthetic', '2026-10', [duty], 'Asia/Qatar', pilot_base='DOH')
    assert any('ZQX9' in w for w in review(roster, parser, '.pdf')['warnings'])


def test_roster_status_markers_are_not_training_notes():
    """PA (pre-assigned: instructor duties rostered before the general roster), REQ and
    PIC describe how the duty was rostered, not the session."""
    parser = CrewLinkRosterParser(timezone_format='local', home_base='DOH', home_timezone='Asia/Qatar')
    day = datetime(2026, 10, 17)
    duty = parser._parse_column_to_duty(day, ['RPT:07:00\nOPTR\nDOH\n08:30\n12:30\nrhPA,op'])
    assert duty.training_annotations == ['op']
    duty = parser._parse_column_to_duty(day, ['RPT:07:00\n35LP\nDOH\n08:30\n12:30\nPA,aw,lpc,REQ'])
    assert duty.training_annotations == ['aw', 'lpc']
