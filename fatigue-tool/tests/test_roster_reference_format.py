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
