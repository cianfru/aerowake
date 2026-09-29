"""Cross-cutting regressions found during the launch audit (synthetic data only)."""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from api.analysis_access import Principal, analysis_store, remember, authorize, evict_roster
from api.replay import snapshot, restore
from auth.jwt import create_refresh_token
from auth.password import hash_password, verify_password
from core.alertness import classify_kss
from core.parameters import RiskThresholds
from core.compliance import EASAComplianceValidator
from models.data_models import Duty, Roster, FlightSegment, Airport
from reports.engine import SleepIn, _efficiency
from parsers.validation import resolve_home_timezone
from tests.test_fatigue_report import base_request, t, sleep, client as report_client

@pytest.mark.parametrize('value', [5.49,5.5,5.51,6.49,6.5,6.51,7.49,7.5,7.51,8.49,8.5,8.51])
def test_kss_and_index_policy_agree(value):
    assert RiskThresholds().classify(110-10*value) == classify_kss(value)

@pytest.mark.parametrize('base,zone',[('LGW','Europe/London'),('FCO','Europe/Rome'),('DOH','Asia/Qatar')])
def test_home_timezone_is_resolved(base,zone):
    assert resolve_home_timezone(base) == zone

def test_unknown_or_conflicting_base_rejected():
    for base, zone in [('ZZZ',None),('LGW','Asia/Qatar')]:
        with pytest.raises(ValueError): resolve_home_timezone(base,zone)

def test_refresh_tokens_unique_and_unicode_passwords_supported():
    assert create_refresh_token('a') != create_refresh_token('a')
    value='é'*80
    hashed=hash_password(value)
    assert verify_password(value,hashed)
    assert not verify_password(value+'x',hashed)

def test_cache_ownership_and_deletion():
    analysis_store.clear()
    a,b=Principal('user:a','a'),Principal('user:b','b')
    remember('test',(1,2,3),a,'roster-1')
    assert asyncio.run(authorize('test',a,None)) is None
    for caller in [b,Principal('guest:other')]:
        with pytest.raises(HTTPException) as exc: asyncio.run(authorize('test',caller,None))
        assert exc.value.status_code==404
    evict_roster('roster-1')
    with pytest.raises(HTTPException): asyncio.run(authorize('test',a,None))

def test_cold_lookup_scopes_sql_to_owner():
    analysis_store.clear()
    class DB:
        async def execute(self, statement):
            self.sql=str(statement);self.params=statement.compile().params
            return SimpleNamespace(scalar_one_or_none=lambda:None)
    db=DB()
    with pytest.raises(HTTPException): asyncio.run(authorize('missing',Principal('user:a','a'),db))
    assert 'JOIN rosters' in db.sql and 'rosters.user_id =' in db.sql
    assert 'a' in db.params.values()

def make_duty(hour=6,minute=0):
    report=datetime(2026,9,2,hour,minute,tzinfo=timezone.utc)
    seg=FlightSegment('TEST',Airport('LGW','Europe/London'),Airport('FCO','Europe/Rome'),report+timedelta(hours=1),report+timedelta(hours=3))
    return Duty('D',report,report,report+timedelta(hours=4),[seg], 'UTC')

@pytest.mark.parametrize('hour,minute,expected',[(6,0,13),(13,29,13),(13,30,12.75),(14,0,12.5),(16,59,11.25),(17,0,11),(4,59,11),(5,0,12),(5,15,12.25),(5,45,12.75)])
def test_fdp_reference_table_boundaries(hour,minute,expected):
    duty=make_duty(hour,minute)
    limits=EASAComplianceValidator().calculate_fdp_limits(duty)
    assert duty.fdp_hours==3  # one post-flight hour is duty, not FDP
    assert limits['max_fdp']==expected

def test_replay_preserves_timezones_initial_conditions_and_type():
    roster=Roster('R','TEST','2026-09',[make_duty()], 'Europe/London',pilot_base='LGW',initial_sleep_debt=2.5)
    decoded=restore(json.loads(json.dumps(snapshot(roster))))
    assert decoded==roster
    assert isinstance(decoded.duties[0],Duty)
    assert decoded.duties[0].segments[0].scheduled_departure_utc.tzinfo is not None

def test_actual_sleep_is_not_discounted_twice():
    start=datetime(2026,9,1,tzinfo=timezone.utc)
    for location in ('hotel','crew_rest','home'):
        assert _efficiency(SleepIn(start,start+timedelta(hours=8),location=location,quality=1))==1

def test_report_rejects_overlapping_operated_sleep():
    body=base_request();body['sleeps']=[sleep(6,10,0,6,12,0)]
    res=report_client.post('/api/fatigue-report',json=body)
    assert res.status_code==422 and 'overlaps operated duty' in res.text

def test_report_rejects_unbounded_event_and_sector():
    for mutate in [lambda b:b.update(event_time_utc=t(28,9)),lambda b:b['duties'][0]['sectors'][0].update(arrival_utc=t(6,20))]:
        body=base_request();mutate(body)
        assert report_client.post('/api/fatigue-report',json=body).status_code==422

def test_arbitrary_minute_event_is_covered_but_incomplete_diary_abstains():
    body=base_request(duties=[],affected_duty_id=None,event_time_utc=t(8,9,7),diary_complete=True)
    response=report_client.post('/api/fatigue-report',json=body)
    assert response.status_code==200,response.text
    result=response.json()
    assert result['assessment'] is not None and result['data_quality']['event_covered']
    body['diary_complete']=False
    result=report_client.post('/api/fatigue-report',json=body).json()
    assert result['assessment'] is None and not result['data_quality']['model_available']
    assert result['data_quality']['confidence']=='low'

def test_report_fdp_missing_context_is_explicit():
    body=base_request(diary_complete=True)
    result=report_client.post('/api/fatigue-report',json=body).json()
    assert result['easa_summary']['coverage']['fdp_max']['status']=='not_assessed'
    for d in body['duties']:
        d.update(crew_composition='standard',acclimatization='acclimatized')
    result=report_client.post('/api/fatigue-report',json=body).json()
    assert result['easa_summary']['coverage']['fdp_max']['assessed']==2

def test_airport_routes_and_guest_auth():
    from api.api_server import app
    client=TestClient(app)
    assert 'results' in client.get('/api/airports/search?q=LG').json()
    assert client.get('/api/airports/ZZZ').status_code==404
    assert client.get('/api/analysis/anything').status_code==401
    assert client.get('/api/duty/anything/D').status_code==401
    assert client.get('/api/statistics/anything').status_code==401
    assert client.post('/api/what-if',json={'analysis_id':'anything'}).status_code==401


def test_report_export_contains_reproducible_input_hash():
    import hashlib
    body=base_request(diary_complete=True)
    res=report_client.post('/api/fatigue-report',json=body)
    assert res.status_code==200,res.text
    provenance=res.json()['provenance']
    canonical=json.dumps(provenance['inputs'],sort_keys=True,separators=(',', ':'),ensure_ascii=False)
    assert hashlib.sha256(canonical.encode()).hexdigest()==provenance['input_sha256']
    replay=report_client.post('/api/fatigue-report',json=provenance['inputs']).json()
    assert replay['assessment']==res.json()['assessment']


def test_standby_sleep_requires_explicit_home_standby():
    body=base_request(duties=[],affected_duty_id=None)
    body['duties']=[{'id':'SB','report_utc':t(6,0),'release_utc':t(6,8),'duty_type':'home_standby'}]
    body['sleeps']=[sleep(6,1,0,6,7,0)]
    assert report_client.post('/api/fatigue-report',json=body).status_code==200
    for kind in ['airport_standby','standby']:
        body['duties'][0]['duty_type']=kind
        assert report_client.post('/api/fatigue-report',json=body).status_code==422


def test_optional_csv_dates_allow_blank_cells_but_reject_reversed_explicit_dates():
    import pandas as pd
    from parsers.roster_parser import CSVRosterParser
    parser = CSVRosterParser(home_base='DOH')
    row = pd.Series(dict(Date='2026-09-01', Flight='TEST', Departure='DOH', Arrival='DMM',
                         STD='23:00', STA='00:15', DepartureDate=float('nan'), ArrivalDate=float('nan')))
    sector = parser._parse_csv_flight(row)
    assert sector.scheduled_arrival_utc - sector.scheduled_departure_utc == timedelta(minutes=75)
    row['ArrivalDate'] = '2026-09-01'
    with pytest.raises(ValueError, match='Explicit arrival date'):
        parser._parse_csv_flight(row)


def test_rating_during_reported_sleep_does_not_borrow_nearby_awake_prediction():
    body = base_request(duties=[], affected_duty_id=None, event_time_utc=t(8, 9, 7),
                        self_assessment=dict(kss=8, rated_at_utc=t(8, 4, 10)))
    response = report_client.post('/api/fatigue-report', json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['data_quality']['model_available'] is True
    assert result['self_assessment']['model_kss_at_rating'] is None
