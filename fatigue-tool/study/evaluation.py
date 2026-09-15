"""Frozen baseline evaluation; split by participant, never by individual rating."""
import hashlib
import math
from collections import defaultdict
from core.published_tpm import VERSION


def partition(participant):
    return 'holdout' if int(hashlib.sha256(('pilot-study-split-v1:'+participant).encode()).hexdigest(), 16) % 5 == 0 else 'development'


def metrics(pairs):
    if not pairs:
        return None
    errors = [prediction-observed for prediction, observed in pairs]
    return dict(n=len(errors), mae=sum(abs(e) for e in errors)/len(errors),
                rmse=math.sqrt(sum(e*e for e in errors)/len(errors)),
                bias=sum(errors)/len(errors))


def evaluate(exports):
    groups = {k: defaultdict(list) for k in ('development', 'holdout')}
    excluded = defaultdict(int)
    seen = set()
    for export in exports:
        participant = export['participant_id']
        for row in export['observations']:
            key = (participant, row['id'])
            if key in seen:
                continue
            seen.add(key)
            if row['prediction']['model_version'] != VERSION:
                excluded['different_model_version'] += 1
                continue
            if not row['primary_analysis_eligible'] or row['exclusions']:
                excluded['collection_exclusions'] += 1
                continue
            p, o = row['prediction']['kss'], row['inputs']['observed_kss']
            if not (math.isfinite(p) and 1 <= p <= 9 and isinstance(o, int) and not isinstance(o, bool) and 1 <= o <= 9):
                raise ValueError('Invalid prediction or observed KSS in export')
            groups[partition(participant)][participant].append((p, o))
    development = [pair for pairs in groups['development'].values() for pair in pairs]
    mean = sum(o for _, o in development)/len(development) if development else None
    result = dict(model_version=VERSION, status='descriptive_results_not_certification',
                  split='sha256 pilot-study-split-v1, participant modulo 5; 0=holdout',
                  excluded=dict(excluded), development_mean_kss=mean)
    for name, participants in groups.items():
        pairs = [p for ps in participants.values() for p in ps]
        per_pilot = [metrics(ps) for ps in participants.values()]
        result[name] = dict(participants=len(participants), metrics=metrics(pairs),
            participant_balanced_mae=sum(m['mae'] for m in per_pilot)/len(per_pilot) if per_pilot else None,
            constant_training_mean=metrics([(mean, o) for _, o in pairs]) if mean is not None else None)
    return result
