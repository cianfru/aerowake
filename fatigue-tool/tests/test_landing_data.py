"""The landing page publishes engine outputs as TypeScript literals.

Recompute them from the synthetic inputs in scripts/landing_data.py and compare,
so a model change cannot leave the public page silently disagreeing with the
engine. To fix a failure, run `python scripts/landing_data.py` and paste the
printed literals back into the landing data files.
"""
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import landing_data  # noqa: E402

LANDING = ROOT.parent / 'fatigue-insight-hub' / 'src' / 'components' / 'landing'
pytestmark = pytest.mark.skipif(not LANDING.is_dir(), reason='frontend sources not checked out')

TOLERANCE = 0.006  # literals are rounded to two decimals


def _array(source: str, name: str) -> list[float | None]:
    match = re.search(rf'\b{name}: \[(.*?)\]', source, re.S)
    assert match, f'{name} literal not found'
    return [None if v.strip() == 'null' else float(v) for v in match.group(1).split(',') if v.strip()]


def _assert_series(published, computed, label):
    assert len(published) == len(computed), label
    for i, (a, b) in enumerate(zip(published, computed)):
        assert (a is None) == (b is None), f'{label}[{i}]: {a} vs {b}'
        if a is not None:
            assert abs(a - b) <= TOLERANCE, f'{label}[{i}]: published {a}, engine {b}'


@pytest.fixture(scope='module')
def analysis():
    return landing_data.analyse_tour()


def test_science_scenario_matches_published_model():
    source = (LANDING / 'scienceData.ts').read_text()
    _assert_series(_array(source, 'noNap'), landing_data.science_series(nap=False), 'noNap')
    _assert_series(_array(source, 'nap2h'), landing_data.science_series(nap=True), 'nap2h')


def test_tour_duties_match_engine(analysis):
    source = (LANDING / 'tourData.ts').read_text()
    rows = re.findall(
        r"\{ date: '([\d-]+)', route: \[([^\]]*)\], report: '([\d:]+)', release: '([\d:]+)', "
        r"peakKss: ([\d.]+), wocl: (true|false)",
        source,
    )
    engine = landing_data.tour_duties(analysis)
    assert len(rows) == len(engine)
    for (date, route, report, release, peak, wocl), duty in zip(rows, engine):
        assert date == duty['date']
        assert re.findall(r"'([A-Z]{3})'", route) == duty['route'], date
        assert (report, release) == (duty['report'], duty['release']), date
        assert abs(float(peak) - duty['peakKss']) <= TOLERANCE, date
        assert (wocl == 'true') == duty['wocl'], date
    totals = re.search(r'TOUR_TOTALS = \{ duties: (\d+), sectors: (\d+) \}', source)
    assert totals and (int(totals.group(1)), int(totals.group(2))) == (
        analysis['total_duties'], analysis['total_sectors'])


def test_tour_week_matches_engine_timeline(analysis):
    source = (LANDING / 'tourData.ts').read_text()
    _assert_series(_array(source, 'kss'), landing_data.tour_week_kss(analysis), 'TOUR_WEEK.kss')
