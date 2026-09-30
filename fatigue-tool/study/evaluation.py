"""Frozen baseline evaluation; split by participant, never by individual rating.

Two export kinds are supported:
  * pilot-study observations (published model 5c with diary sleep) -> evaluate()
  * duty debriefs (roster forecast vs a blinded rating of a flown duty) -> evaluate_debriefs()
Outputs are descriptive, never certification. Every exclusion is counted by reason.
"""
import hashlib
import math
import random
from collections import Counter, defaultdict
from core.published_tpm import VERSION

STATUS = 'descriptive_results_not_certification'
MODEL_SCOPE_FLAGS = ('more_than_16_hours_since_sleep', 'first_hour_after_waking_inertia_not_modelled')
PRIMARY_STREAMS = ('momentary', 'same_day', 'recalled')
UNMODELLED_COUNTERMEASURES = ('nap', 'controlled_rest', 'inflight_rest')
HIGH_OBSERVED_KSS = 7


def partition(participant):
    return 'holdout' if int(hashlib.sha256(('pilot-study-split-v1:'+participant).encode()).hexdigest(), 16) % 5 == 0 else 'development'


def metrics(pairs):
    if not pairs:
        return None
    errors = [prediction-observed for prediction, observed in pairs]
    return dict(n=len(errors), mae=sum(abs(e) for e in errors)/len(errors),
                rmse=math.sqrt(sum(e*e for e in errors)/len(errors)),
                bias=sum(errors)/len(errors))


def _valid_kss(value, integer=False):
    if integer:
        return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 9
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 1 <= value <= 9


def evaluate(exports):
    groups = {k: defaultdict(list) for k in ('development', 'holdout')}
    strata = defaultdict(list)
    reasons = Counter()
    excluded_rows = 0
    different_version = 0
    seen = set()
    for export in exports:
        participant = export['participant_id']
        for row in export['observations']:
            key = (participant, row['id'])
            if key in seen:
                continue
            seen.add(key)
            if row['prediction']['model_version'] != VERSION:
                different_version += 1
                continue
            p, o = row['prediction']['kss'], row['inputs']['observed_kss']
            if not (_valid_kss(p) and _valid_kss(o, integer=True)):
                raise ValueError('Invalid prediction or observed KSS in export')
            exclusions = list(row.get('exclusions') or [])
            if not row['primary_analysis_eligible'] or exclusions:
                excluded_rows += 1
                reasons.update(exclusions or ['not_primary_eligible'])
                # Pre-registered exploratory strata: model-scope flags only, collection otherwise clean.
                if exclusions and set(exclusions) <= set(MODEL_SCOPE_FLAGS):
                    for flag in exclusions:
                        strata[flag].append((p, o))
                continue
            groups[partition(participant)][participant].append((p, o))
    development = [pair for pairs in groups['development'].values() for pair in pairs]
    mean = sum(o for _, o in development)/len(development) if development else None
    result = dict(model_version=VERSION, status=STATUS,
                  split='sha256 pilot-study-split-v1, participant modulo 5; 0=holdout',
                  excluded=dict(rows=excluded_rows, by_reason=dict(sorted(reasons.items())),
                                different_model_version=different_version),
                  exploratory_model_scope_strata={flag: metrics(strata[flag]) for flag in MODEL_SCOPE_FLAGS},
                  development_mean_kss=mean)
    for name, participants in groups.items():
        pairs = [p for ps in participants.values() for p in ps]
        per_pilot = [metrics(ps) for ps in participants.values()]
        result[name] = dict(participants=len(participants), metrics=metrics(pairs),
            participant_balanced_mae=sum(m['mae'] for m in per_pilot)/len(per_pilot) if per_pilot else None,
            constant_training_mean=metrics([(mean, o) for _, o in pairs]) if mean is not None else None)
    return result


# ── Duty debriefs ────────────────────────────────────────────────────────────

def _forecast_for(row):
    forecast = row.get('forecast') or {}
    return forecast.get('max_kss') if row['moment'] == 'worst_moment' else forecast.get('kss_at_event')


def _duty_period(hour):
    if hour is None:
        return 'unknown'
    if hour >= 20 or hour < 4:
        return 'night'
    if hour < 7:
        return 'early'
    if hour < 12:
        return 'day'
    return 'late'


def _confusion(items):
    """items: (flagged, observed_high). Returns counts and rates (None when undefined)."""
    tp = sum(1 for f, h in items if f and h)
    fp = sum(1 for f, h in items if f and not h)
    fn = sum(1 for f, h in items if not f and h)
    tn = sum(1 for f, h in items if not f and not h)
    rate = lambda a, b: a / (a + b) if a + b else None  # noqa: E731
    return dict(n=len(items), tp=tp, fp=fp, fn=fn, tn=tn, sensitivity=rate(tp, fn), specificity=rate(tn, fp),
                ppv=rate(tp, fp), npv=rate(tn, fn))


def _bootstrap(by_participant, resamples=1000, seed=20260930):
    """Participant-clustered percentile intervals for sensitivity, specificity and PPV."""
    people = list(by_participant)
    if len(people) < 2:
        return None
    rng = random.Random(seed)
    samples = defaultdict(list)
    for _ in range(resamples):
        items = [item for _ in people for item in by_participant[rng.choice(people)]]
        stats = _confusion(items)
        for key in ('sensitivity', 'specificity', 'ppv'):
            if stats[key] is not None:
                samples[key].append(stats[key])
    out = {}
    for key, values in samples.items():
        values.sort()
        out[key] = [values[int(0.025 * (len(values) - 1))], values[int(0.975 * (len(values) - 1))]]
    return dict(resamples=resamples, interval='95% percentile, clustered by participant', **out)


def flag_discrimination(rows):
    """Duty flagged (forecast peak >= 6.5) vs the pilot's own worst-moment KSS >= 7."""
    usable = [r for r in rows if r['moment'] == 'worst_moment' and isinstance((r.get('forecast') or {}).get('flagged'), bool)
              and _valid_kss(r.get('kss'), integer=True)]
    by_participant = defaultdict(list)
    for r in usable:
        by_participant[r['_participant']].append((r['forecast']['flagged'], r['kss'] >= HIGH_OBSERVED_KSS))

    def summary(subset):
        items = [(r['forecast']['flagged'], r['kss'] >= HIGH_OBSERVED_KSS) for r in subset]
        return _confusion(items) if items else None

    def observed(flag):
        values = [r['kss'] for r in usable if r['forecast']['flagged'] is flag]
        return dict(n=len(values), mean_observed_kss=sum(values) / len(values) if values else None)

    felt = defaultdict(Counter)
    for r in usable:
        felt['flagged' if r['forecast']['flagged'] else 'not_flagged'][r.get('felt_vs_prediction') or 'not_answered'] += 1
    strata = defaultdict(list)
    for r in usable:
        f = r['forecast']
        strata['duty_period:' + _duty_period(f.get('report_local_hour'))].append(r)
        if (f.get('wocl_hours') or 0) > 0:
            strata['wocl_encroachment'].append(r)
        if (f.get('max_hours_awake') or 0) > 16:
            strata['more_than_16_hours_awake'].append(r)
        if set(r.get('countermeasures') or []) & set(UNMODELLED_COUNTERMEASURES):
            strata['unmodelled_countermeasure_used'].append(r)
        strata['prediction_seen' if r.get('prediction_seen') else 'prediction_not_seen'].append(r)
    return dict(definition='flagged: forecast duty peak KSS >= 6.5 (rounded to 0.1); observed high: worst-moment KSS >= 7',
                overall=summary(usable), bootstrap=_bootstrap(by_participant),
                flagged=observed(True), not_flagged=observed(False),
                self_rated_vs_forecast={k: dict(v) for k, v in felt.items()},
                strata={k: summary(v) for k, v in sorted(strata.items())})


def evaluate_debriefs(exports):
    """Roster forecast vs blinded debrief ratings; exploratory by construction (pilots may have seen the outlook)."""
    seen = set()
    rows = []
    reasons = Counter()
    flags = Counter()
    excluded_rows = 0
    for export in exports:
        if export.get('kind') != 'duty_debriefs':
            raise ValueError('Not a duty-debrief export')
        participant = export['participant_id']
        for row in export['debriefs']:
            key = (participant, row['id'])
            if key in seen:
                continue
            seen.add(key)
            row = {**row, '_participant': participant}
            exclusions = list((row.get('quality') or {}).get('exclusions') or [])
            if row.get('operation') == 'not_operated' or _forecast_for(row) is None or not (
                    _valid_kss(row.get('kss'), integer=True)):
                excluded_rows += 1
                reasons.update(exclusions or ['no_kss_or_no_forecast'])
                continue
            if not _valid_kss(_forecast_for(row)):
                raise ValueError('Invalid forecast KSS in export')
            rows.append(row)
            flags.update(exclusions)

    def pairs(subset, source=_forecast_for):
        return [(source(r), r['kss']) for r in subset if source(r) is not None]

    clean = [r for r in rows if r.get('operation') == 'as_rostered']
    by_engine = defaultdict(list)
    for r in clean:
        by_engine[(r.get('forecast') or {}).get('engine_version') or 'unknown'].append(r)

    per_engine = {}
    for engine, subset in by_engine.items():
        streams = {s: defaultdict(list) for s in PRIMARY_STREAMS + ('late',)}
        for r in subset:
            stream = (r.get('quality') or {}).get('stream', 'late')
            streams.setdefault(stream, defaultdict(list))[r['moment']].append(r)
        split = {name: [r for r in subset if partition(r['_participant']) == name
                        and (r.get('quality') or {}).get('stream') in PRIMARY_STREAMS]
                 for name in ('development', 'holdout')}
        tpm = [r for r in subset if r.get('published_tpm') and r['moment'] != 'worst_moment']
        per_engine[engine] = dict(
            by_stream={s: {m: metrics(pairs(v)) for m, v in moments.items()} for s, moments in streams.items()},
            by_partition={name: dict(participants=len({r['_participant'] for r in v}), metrics=metrics(pairs(v)))
                          for name, v in split.items()},
            prediction_seen_covariate={
                'seen': metrics(pairs([r for r in subset if r.get('prediction_seen')])),
                'not_seen': metrics(pairs([r for r in subset if not r.get('prediction_seen')]))},
            # Same rows, two predictions: the gap estimates error from roster-inferred sleep.
            confirmed_sleep_comparison=dict(
                roster_forecast=metrics(pairs(tpm)),
                published_model_with_reported_sleep=metrics(pairs(tpm, lambda r: r['published_tpm']['kss']))),
        )
    return dict(kind='duty_debriefs', status=STATUS,
                note='Exploratory: roster-linked debriefs never enter the ingre2014-5c-v1 primary comparison.',
                participants=len({r['_participant'] for r in rows}), debriefs=len(rows),
                excluded=dict(rows=excluded_rows, by_reason=dict(sorted(reasons.items()))),
                quality_flags_on_included=dict(sorted(flags.items())),
                times_changed=metrics(pairs([r for r in rows if r.get('operation') == 'times_changed'])),
                engines=per_engine, flag_discrimination=flag_discrimination(clean))
