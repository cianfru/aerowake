"""/api/analyze resolves the home base exactly like the preview (synthetic data only)."""
from fastapi.testclient import TestClient

from tests.synthetic_pdf import crewlink_pdf
from tests.test_roster_intake import DOH_ROWS, GUEST, HEADER


def test_analyze_uses_detected_base_and_reports_missing_base():
    from api.api_server import app
    client = TestClient(app)
    res = client.post('/api/analyze', headers=GUEST, files={'file': ('roster.pdf', crewlink_pdf())})
    assert res.status_code == 200, res.text
    assert (res.json()['pilot_base'], res.json()['home_base_timezone']) == ('LGW', 'Europe/London')

    # A typed base that differs from the header is reported in the preview; analysis keeps the header.
    res = client.post('/api/analyze', headers=GUEST, files={'file': ('roster.pdf', crewlink_pdf())},
                      data={'home_base': 'DOH'})
    assert res.status_code == 200 and res.json()['pilot_base'] == 'LGW'

    res = client.post('/api/analyze', headers=GUEST, files={'file': ('roster.pdf', crewlink_pdf())},
                      data={'home_base': 'DOH', 'home_base_override': 'true'})
    assert res.status_code == 200, res.text
    assert (res.json()['pilot_base'], res.json()['home_base_timezone']) == ('DOH', 'Asia/Qatar')

    res = client.post('/api/analyze', headers=GUEST,
                      files={'file': ('roster.pdf', crewlink_pdf(header_id_line='ID :100001'))})
    assert res.status_code == 422 and res.json()['code'] == 'home_base_required'

    res = client.post('/api/analyze', headers=GUEST, files={'file': ('roster.csv', (HEADER + DOH_ROWS).encode())})
    assert res.status_code == 200 and res.json()['pilot_base'] == 'DOH'
