"""Versioned JSON snapshots, with a closed set of supported input types (no pickle)."""
from dataclasses import fields, is_dataclass
from datetime import datetime
from enum import Enum
from models import data_models as dm
from core.alertness import ENGINE_VERSION, is_kss_engine

_TYPES = {name: cls for name, cls in vars(dm).items()
          if isinstance(cls, type) and (is_dataclass(cls) or issubclass(cls, Enum))}

def _encode(value):
    if isinstance(value, datetime):
        return {'$datetime': value.isoformat()}
    if isinstance(value, Enum):
        return {'$enum': type(value).__name__, 'value': value.value}
    if is_dataclass(value):
        return {'$type': type(value).__name__, 'fields': {
            f.name: _encode(getattr(value, f.name)) for f in fields(value) if f.init}}
    if isinstance(value, (list, tuple)):
        return [_encode(v) for v in value]
    if isinstance(value, dict):
        return {k: _encode(v) for k, v in value.items()}
    return value

def _decode(value):
    if isinstance(value, list):
        return [_decode(v) for v in value]
    if not isinstance(value, dict):
        return value
    if '$datetime' in value:
        return datetime.fromisoformat(value['$datetime'])
    if '$enum' in value:
        return _TYPES[value['$enum']](value['value'])
    if '$type' in value:
        return _TYPES[value['$type']](**{k: _decode(v) for k, v in value['fields'].items()})
    return {k: _decode(v) for k, v in value.items()}

def snapshot(roster, provenance=None):
    return {'schema': 1, 'engine': ENGINE_VERSION, 'parser': 'roster-1.1', 'provenance': provenance or {}, 'roster': _encode(roster)}

def restore(data):
    # Snapshots hold normalised inputs, not outputs: any KSS-engine snapshot can
    # be re-simulated with the current engine.
    if data.get('schema') != 1 or not is_kss_engine(data.get('engine')):
        from fastapi import HTTPException
        raise HTTPException(409, 'The stored inputs require an explicit reanalysis with the current model.')
    result = _decode(data['roster'])
    if not isinstance(result, dm.Roster):
        raise ValueError('Invalid roster snapshot')
    return result
