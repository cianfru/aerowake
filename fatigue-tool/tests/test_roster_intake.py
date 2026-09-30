"""Roster intake: honest home-base detection, conflicts and empty files (synthetic data only)."""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.preview import parse_for_review, router as preview_router
from parsers.base_detection import (DUTY_PATTERN, ENTERED, ROSTER_HEADER, RosterIntakeError,
                                    infer_csv_base, resolve_base)
from parsers.easyjet_parser import EasyJetParser
from parsers.qatar_crewlink_parser import CrewLinkRosterParser
from parsers.reconciliation import hhmm
from parsers.roster_parser import CSVRosterParser
from tests.synthetic_pdf import build_pdf, crewlink_pdf

GUEST = {'X-Guest-Session': 'intake-test-' + 'x' * 40}
HEADER = 'Date,Flight,Departure,Arrival,STD,STA,Report,Release\n'
# Late Doha–Najaf returns (Doha is UTC+3, Najaf UTC+3).
DOH_ROWS = ''.join(f'2026-10-{d:02d},QR460,DOH,NJF,18:30,20:40,17:15,00:45\n'
                   f'2026-10-{d:02d},QR461,NJF,DOH,21:40,23:55,17:15,00:45\n' for d in (5, 6, 7, 12))

preview_app = FastAPI()
preview_app.include_router(preview_router)
preview_client = TestClient(preview_app)


def preview(content, name, **form):
    return preview_client.post('/api/roster/preview', headers=GUEST,
                               files={'file': (name, content)}, data={k: str(v) for k, v in form.items()})


# ── Resolution rules ─────────────────────────────────────────────────────

def test_header_base_wins_unless_explicitly_overridden():
    detected = resolve_base(None, 'DOH', ROSTER_HEADER)
    assert (detected.base, detected.source, detected.conflict) == ('DOH', ROSTER_HEADER, False)
    kept = resolve_base('LGW', 'DOH', ROSTER_HEADER)
    assert (kept.base, kept.source, kept.conflict, kept.override) == ('DOH', ROSTER_HEADER, True, False)
    chosen = resolve_base('lgw', 'DOH', ROSTER_HEADER, override=True)
    assert (chosen.base, chosen.source, chosen.conflict, chosen.override) == ('LGW', ENTERED, True, True)
    agreed = resolve_base('DOH', 'DOH', ROSTER_HEADER)
    assert (agreed.source, agreed.conflict) == (ROSTER_HEADER, False)


def test_typed_base_beats_a_duty_pattern_but_is_flagged():
    typed = resolve_base('BAH', 'DOH', DUTY_PATTERN)
    assert (typed.base, typed.source, typed.conflict, typed.override) == ('BAH', ENTERED, True, False)
    confirmed = resolve_base('DOH', 'DOH', DUTY_PATTERN)
    assert (confirmed.source, confirmed.conflict) == (ENTERED, False)
    assert resolve_base(None, 'DOH', DUTY_PATTERN).source == DUTY_PATTERN


def test_missing_or_unknown_base_is_never_assumed():
    with pytest.raises(RosterIntakeError) as missing:
        resolve_base(None, None, None)
    assert missing.value.code == 'home_base_required'
    with pytest.raises(RosterIntakeError) as unknown:
        resolve_base('ZZX', None, None)
    assert unknown.value.code == 'unknown_airport'


# ── Parser defaults removed ──────────────────────────────────────────────

def test_crewlink_header_without_base_does_not_default_to_doha():
    page = SimpleNamespace(extract_text=lambda: 'Name : TEST PILOT\nID :100001\nPeriod: 01-Oct-2026 - 31-Oct-2026')
    info = CrewLinkRosterParser()._extract_pilot_info(page)
    assert info['base'] is None and info['aircraft'] is None
    assert info['block_hours'] is None
    page = SimpleNamespace(extract_text=lambda: 'ID :100001 (LGW SFO-A320)\nPeriod: 01-Oct-2026 - 31-Oct-2026')
    info = CrewLinkRosterParser()._extract_pilot_info(page)
    assert (info['base'], info['role'], info['aircraft']) == ('LGW', 'SFO', 'A320')


def test_easyjet_header_without_base_does_not_default_to_malaga():
    info = EasyJetParser()._extract_pilot_info('Personal Crew Schedule\n01/09/2025 - 30/09/2025\n')
    assert info.get('base') is None and (info['year'], info['month']) == (2025, 9)
    assert 'year' not in EasyJetParser()._extract_pilot_info('Personal Crew Schedule\n')


# ── PDF intake ───────────────────────────────────────────────────────────

def test_pdf_header_base_is_detected_without_typing():
    res = preview(crewlink_pdf(), 'roster.pdf')
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body['home_base'], body['base_source'], body['home_timezone']) == ('LGW', 'roster_header', 'Europe/London')
    assert body['base_city'] == 'London' and body['base_utc_offsets'] == ['+01:00']
    assert (body['total_duties'], body['total_sectors'], body['flight_duties']) == (3, 4, 3)
    assert body['block_total_matches_source'] is True and body['needs_confirmation'] is False
    assert body['inferred_release_count'] == 3
    assert [c['code'] for c in body['checks']] == ['inferred_release']
    assert body['duties'][0]['route'] == 'LGW → AMS → LGW' and body['duties'][0]['release_inferred'] is True
    assert 'TEST PILOT' not in res.text and '100001' not in res.text


def test_pdf_conflict_is_shown_and_header_wins():
    body = preview(crewlink_pdf(), 'roster.pdf', home_base='DOH').json()
    assert (body['home_base'], body['entered_base'], body['base_conflict']) == ('LGW', 'DOH', True)
    assert body['needs_confirmation'] is True
    conflict = next(c for c in body['checks'] if c['code'] == 'base_conflict')
    assert 'header says LGW (London)' in conflict['message'] and conflict['severity'] == 'warning'


def test_pdf_explicit_override_uses_the_pilots_base_with_a_warning():
    body = preview(crewlink_pdf(), 'roster.pdf', home_base='DOH', home_base_override='true').json()
    assert (body['home_base'], body['home_timezone'], body['base_source']) == ('DOH', 'Asia/Qatar', 'entered')
    assert body['base_override'] is True and body['needs_confirmation'] is True
    codes = [c['code'] for c in body['checks']]
    assert 'base_override' in codes and 'base_not_in_duties' in codes


def test_pdf_without_header_base_asks_for_one():
    pdf = crewlink_pdf(header_id_line='ID :100001')
    res = preview(pdf, 'roster.pdf')
    assert res.status_code == 422
    assert res.json()['code'] == 'home_base_required' and 'home base' in res.json()['detail']
    body = preview(pdf, 'roster.pdf', home_base='LGW').json()
    assert (body['home_base'], body['base_source'], body['detected_base']) == ('LGW', 'entered', None)


def test_non_roster_pdf_is_rejected_with_supported_formats():
    pdf = build_pdf([(40, 500, 'Quarterly newsletter'), (40, 480, 'Crew car park reopens on Monday')])
    for form in ({}, {'home_base': 'LGW'}):
        res = preview(pdf, 'newsletter.pdf', **form)
        assert res.status_code == 422
        assert res.json()['code'] == 'no_duties'
        assert 'CrewLink and easyJet' in res.json()['detail']


def test_block_mismatch_is_a_counted_warning():
    body = preview(crewlink_pdf(value_line='VALUE 10:45 16:00'), 'roster.pdf').json()
    assert body['block_total_matches_source'] is False and body['needs_confirmation'] is True
    mismatch = next(c for c in body['checks'] if c['code'] == 'block_mismatch')
    assert '7:30' in mismatch['message'] and '10:45' in mismatch['message'] and '3:15 not found' in mismatch['message']


# ── CSV intake ───────────────────────────────────────────────────────────

def csv_frame(tmp_path, text):
    path = tmp_path / 'r.csv'
    path.write_text(text)
    return CSVRosterParser.load_frame(str(path))


def test_csv_base_is_inferred_from_duty_pattern(tmp_path):
    assert infer_csv_base(csv_frame(tmp_path, HEADER + DOH_ROWS)) == ('DOH', 1.0)
    body = preview((HEADER + DOH_ROWS).encode(), 'roster.csv').json()
    assert (body['home_base'], body['base_source'], body['roster_format']) == ('DOH', 'duty_pattern', 'csv')
    assert body['needs_confirmation'] is True and body['checks'] == []


def test_csv_without_a_dominant_airport_needs_a_base(tmp_path):
    rows = ('2026-10-05,X1,LGW,AMS,07:00,09:15,06:00,10:00\n'
            '2026-10-07,X2,AMS,MAD,07:00,10:30,06:00,11:00\n'
            '2026-10-09,X3,MAD,LGW,07:00,08:30,06:00,09:15\n')
    assert infer_csv_base(csv_frame(tmp_path, HEADER + rows)) is None  # 2 of 6 endpoints each
    res = preview((HEADER + rows).encode(), 'roster.csv')
    assert res.status_code == 422 and res.json()['code'] == 'home_base_required'
    assert preview((HEADER + rows).encode(), 'roster.csv', home_base='LGW').json()['base_source'] == 'entered'


def test_csv_same_offset_wrong_base_is_flagged():
    body = preview((HEADER + DOH_ROWS).encode(), 'roster.csv', home_base='BAH').json()
    assert (body['home_base'], body['base_conflict'], body['duties_touching_base']) == ('BAH', True, 0)
    [conflict] = body['checks']
    assert conflict['code'] == 'base_conflict' and 'None of your 4 flight duties start or end at BAH' in conflict['message']


def test_csv_wrong_offset_base_explains_the_base_not_an_internal_id():
    res = preview((HEADER + DOH_ROWS).encode(), 'roster.csv', home_base='LGW')
    assert res.status_code == 422
    assert res.json()['code'] == 'base_mismatch'
    assert 'start and end at DOH' in res.json()['detail'] and 'D_2026' not in res.json()['detail']


def test_empty_or_foreign_csv_is_rejected_clearly():
    res = preview(HEADER.encode(), 'roster.csv')
    assert res.status_code == 422 and res.json()['code'] == 'no_duties'
    res = preview(b'Name,Email\nA,b@example.com\n', 'contacts.csv')
    assert res.status_code == 422 and 'Aerowake template' in res.json()['detail']


def test_unsupported_suffix_has_a_code():
    res = preview(b'data', 'roster.xlsx')
    assert res.status_code == 422 and res.json()['code'] == 'unsupported_file'


def test_review_helpers_are_pilot_readable():
    assert hhmm(37.25) == '37:15' and hhmm(0.5) == '0:30' and hhmm(-3.25) == '-3:15'
    review = parse_for_review((HEADER + DOH_ROWS).encode(), '.csv', 'DOH')
    assert review['base_source'] == 'entered' and review['needs_confirmation'] is False

