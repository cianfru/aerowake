"""Evaluation: per-reason exclusions, exploratory strata, debrief streams and flag discrimination (synthetic)."""
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from study.evaluation import evaluate, evaluate_debriefs, partition
from study.routes import Observation, build_payload

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 9, 3, 16, tzinfo=timezone.utc)


def observation(**changes):
    value = dict(client_id=str(uuid4()), observed_at=NOW.isoformat(), observed_kss=4, home_timezone='UTC',
                 sleeps=[dict(start='2026-09-01T22:00:00Z', end='2026-09-02T06:00:00Z'),
                         dict(start='2026-09-02T22:00:00Z', end='2026-09-03T06:00:00Z')],
                 phase='post_duty', prediction_seen=False, actual_sleep=True, complete_diary=True,
                 home_acclimatized=True, consent=True)
    value.update(changes)
    return Observation(**value)


def test_observation_exclusions_are_counted_per_reason_with_model_scope_strata():
    rows = [
        dict(id='ok', **build_payload(observation(), NOW)),
        dict(id='seen', **build_payload(observation(prediction_seen=True, actual_sleep=False), NOW)),
        # 16 h+ awake only: a pre-registered exploratory stratum, not a collection failure.
        dict(id='long', **build_payload(observation(observed_at=(NOW + timedelta(hours=7)).isoformat()), NOW + timedelta(hours=7))),
    ]
    result = evaluate([dict(participant_id='p1', observations=rows)])
    assert result['excluded']['rows'] == 2
    assert result['excluded']['by_reason'] == {'more_than_16_hours_since_sleep': 1, 'prediction_seen_before_rating': 1,
                                                'sleep_estimated': 1}
    assert result['exploratory_model_scope_strata']['more_than_16_hours_since_sleep']['n'] == 1
    assert result['exploratory_model_scope_strata']['first_hour_after_waking_inertia_not_modelled'] is None


def debrief(i, *, flagged, kss, moment='worst_moment', stream='same_day', operation='as_rostered', **extra):
    peak = 7.0 if flagged else 5.0
    row = dict(id=f'd{i}', day_index=i, moment=moment, operation=operation, kss=kss, samn_perelli=None,
               felt_vs_prediction=extra.pop('felt', None), prediction_seen=extra.pop('seen', False),
               countermeasures=extra.pop('countermeasures', []),
               sleep=dict(reported_periods=0, reported_hours=0, complete=False),
               forecast=dict(engine_version='aerowake-4.0-kss', max_kss=peak, kss_at_event=peak - 0.5,
                             risk_level='high' if flagged else 'low', flagged=flagged, report_local_hour=2,
                             max_hours_awake=extra.pop('awake', 12), wocl_hours=1.0),
               published_tpm=extra.pop('tpm', None),
               quality=dict(recall_delay_hours=3, stream=stream, exclusions=extra.pop('exclusions', [])),
               consent_version='duty-debrief-v1')
    row.update(extra)
    return row


def export(participant, rows):
    return dict(kind='duty_debriefs', schema_version=1, participant_id=participant, debriefs=rows)


def test_debrief_streams_moments_and_duplicates():
    rows = [debrief(1, flagged=True, kss=8), debrief(2, flagged=False, kss=4, stream='momentary'),
            debrief(3, flagged=True, kss=6, moment='end_of_duty', stream='recalled',
                    tpm=dict(kss=6.2, model_version='ingre2014-5c-v1', hours_awake=10, flags=[])),
            debrief(4, flagged=True, kss=None, operation='not_operated', exclusions=['not_operated']),
            debrief(5, flagged=False, kss=5, stream='late', exclusions=['recalled_after_48_hours']),
            debrief(6, flagged=True, kss=7, operation='times_changed', exclusions=['times_changed_from_roster'])]
    first = export('p1', rows)
    result = evaluate_debriefs([first, first])  # identical exports are deduplicated
    assert result['debriefs'] == 5 and result['excluded'] == dict(rows=1, by_reason={'not_operated': 1})
    engine = result['engines']['aerowake-4.0-kss']
    assert engine['by_stream']['same_day']['worst_moment']['n'] == 1
    assert engine['by_stream']['momentary']['worst_moment']['bias'] == 1.0
    assert engine['by_stream']['recalled']['end_of_duty']['bias'] == 0.5
    assert engine['by_stream']['late']['worst_moment']['n'] == 1
    assert engine['confirmed_sleep_comparison']['published_model_with_reported_sleep']['mae'] == pytest.approx(0.2)
    assert result['times_changed']['n'] == 1
    assert result['quality_flags_on_included'] == {'recalled_after_48_hours': 1, 'times_changed_from_roster': 1}
    assert result['status'] == 'descriptive_results_not_certification'


def test_flag_discrimination_counts_and_strata():
    rows = [debrief(1, flagged=True, kss=8, felt='about_right'), debrief(2, flagged=True, kss=5, felt='better'),
            debrief(3, flagged=False, kss=7, countermeasures=['nap']), debrief(4, flagged=False, kss=3, awake=17, seen=True)]
    others = [debrief(10 + i, flagged=i % 2 == 0, kss=8 if i % 2 == 0 else 3) for i in range(4)]
    result = evaluate_debriefs([export('p1', rows), export('p2', others)])['flag_discrimination']
    overall = result['overall']
    assert (overall['tp'], overall['fp'], overall['fn'], overall['tn']) == (3, 1, 1, 3)
    assert overall['sensitivity'] == 0.75 and overall['specificity'] == 0.75 and overall['ppv'] == 0.75
    assert result['flagged']['mean_observed_kss'] == pytest.approx(7.25)
    assert result['self_rated_vs_forecast']['flagged'] == {'about_right': 1, 'better': 1, 'not_answered': 2}
    assert result['strata']['unmodelled_countermeasure_used']['n'] == 1
    assert result['strata']['more_than_16_hours_awake']['n'] == 1
    assert result['strata']['duty_period:night']['n'] == 8
    assert result['strata']['prediction_seen']['n'] == 1
    bounds = result['bootstrap']['sensitivity']
    assert 0 <= bounds[0] <= 0.75 <= bounds[1] <= 1


def test_partition_is_by_participant():
    rows = [debrief(1, flagged=True, kss=8)]
    people = {}
    for i in range(50):
        people.setdefault(partition(str(i)), str(i))
    result = evaluate_debriefs([export(p, rows) for p in people.values()])
    split = result['engines']['aerowake-4.0-kss']['by_partition']
    assert split['development']['participants'] == 1 and split['holdout']['participants'] == 1


def test_script_dispatches_on_export_kind(tmp_path):
    diary = dict(participant_id='p1', observations=[dict(id='o', **build_payload(observation(), NOW))])
    files = [tmp_path / 'diary.json', tmp_path / 'debriefs.json']
    files[0].write_text(json.dumps(diary))
    files[1].write_text(json.dumps(export('p1', [debrief(1, flagged=True, kss=8)])))
    output = subprocess.run([sys.executable, 'scripts/evaluate_pilot_study.py', *map(str, files)], cwd=ROOT,
                            capture_output=True, text=True, check=True).stdout
    result = json.loads(output)
    assert result['observations']['model_version'] == 'ingre2014-5c-v1'
    assert result['debriefs']['kind'] == 'duty_debriefs'
