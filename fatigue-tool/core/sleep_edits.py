"""Pilot sleep edits: remove, move or add a sleep block in an analysis.

The model estimates sleep from the roster for an average pilot. A pilot can say
what they actually plan to do instead: remove an assumed nap, change the times of
a night's sleep, or add a nap. Edits are stored with the analysis inputs
(``Roster.sleep_edits``) so replays and reanalyses apply them again.

An edit is a dict:

* ``id``: client identifier (kept for the UI);
* ``action``: 'remove' | 'replace' | 'add';
* ``kind``: 'main' | 'nap' (a replaced block keeps the target's kind unless given);
* ``target_start_utc`` / ``target_end_utc``: the estimated block it changes
  (remove, replace). Matched exactly by start, else the estimated block of the
  same kind that overlaps that span most, so an edit survives small changes to
  the estimate (for example a new nap habit);
* ``start_utc`` / ``end_utc``: the pilot's times (replace, add);
* ``environment``: optional 'home' | 'hotel'.

Pilot blocks are planned sleep the pilot stated (``source='pilot'``), not sleep
they reported having had. Estimated blocks that overlap a pilot block are dropped.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

import pytz

from models.data_models import SleepBlock

ACTIONS = ('remove', 'replace', 'add')
KINDS = ('main', 'nap')
ENVIRONMENTS = ('home', 'hotel')
MAX_EDITS = 200
NAP_HOURS = (0.25, 4.0)
MAIN_HOURS = (1.0, 14.0)


def _instant(value: Any, name: str) -> Optional[datetime]:
    if value in (None, ''):
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        except ValueError:
            raise ValueError(f'{name} is not an ISO 8601 date-time')
    if dt.tzinfo is None:
        raise ValueError(f'{name} needs a UTC offset')
    return dt.astimezone(pytz.utc)


def normalise(edits: List[Dict[str, Any]], roster, strict: bool = True) -> List[Dict[str, Any]]:
    """Validate edits against the roster; returns JSON-safe dicts.

    ``strict``: raise ValueError on the first invalid edit (the pilot is editing
    now). Otherwise drop invalid ones (edits carried over to a new upload of the
    roster, whose duties may have changed).
    """
    if not isinstance(edits, list) or not all(isinstance(e, dict) for e in edits):
        raise ValueError('Sleep changes must be a list of objects')
    if len(edits) > MAX_EDITS:
        raise ValueError(f'At most {MAX_EDITS} sleep changes per analysis')
    duties = sorted(roster.duties, key=lambda d: d.report_time_utc)
    if not duties:
        raise ValueError('The roster has no duties')
    earliest = duties[0].report_time_utc - timedelta(days=3)
    latest = max(d.release_time_utc for d in duties) + timedelta(days=2)
    out, pilot_spans = [], []
    for i, raw in enumerate(edits):
        try:
            item = _one(raw, i, duties, earliest, latest, pilot_spans)
        except ValueError:
            if strict:
                raise
            continue
        out.append(item)
    return out


def _one(raw: Dict[str, Any], i: int, duties, earliest, latest, pilot_spans) -> Dict[str, Any]:
    label = f'Sleep change {i + 1}'
    action = raw.get('action')
    if action not in ACTIONS:
        raise ValueError(f'{label}: action must be one of {", ".join(ACTIONS)}')
    kind = raw.get('kind')
    if kind is not None and kind not in KINDS:
        raise ValueError(f'{label}: kind must be main or nap')
    env = raw.get('environment')
    if env is not None and env not in ENVIRONMENTS:
        raise ValueError(f'{label}: environment must be home or hotel')
    t_start = _instant(raw.get('target_start_utc'), f'{label} target_start_utc')
    t_end = _instant(raw.get('target_end_utc'), f'{label} target_end_utc')
    start = _instant(raw.get('start_utc'), f'{label} start_utc')
    end = _instant(raw.get('end_utc'), f'{label} end_utc')
    if action in ('remove', 'replace') and t_start is None:
        raise ValueError(f'{label}: say which sleep it changes (target_start_utc)')
    if t_start and t_end and t_end <= t_start:
        raise ValueError(f'{label}: target ends before it starts')
    if action in ('replace', 'add'):
        if start is None or end is None or end <= start:
            raise ValueError(f'{label}: give a start and an end after it')
        if action == 'add' and kind is None:
            raise ValueError(f'{label}: say whether it is a main sleep or a nap')
        lo, hi = NAP_HOURS if kind == 'nap' else MAIN_HOURS
        hours = (end - start).total_seconds() / 3600
        if kind is not None and not lo <= hours <= hi:
            raise ValueError(f'{label}: a {"nap" if kind == "nap" else "main sleep"} must last '
                             f'{lo:g}–{hi:g} h')
        if not NAP_HOURS[0] <= hours <= MAIN_HOURS[1]:
            raise ValueError(f'{label}: sleep must last {NAP_HOURS[0]:g}–{MAIN_HOURS[1]:g} h')
        if start < earliest or end > latest:
            raise ValueError(f'{label}: outside the period of this roster')
        if any(d.report_time_utc < end and d.release_time_utc > start for d in duties):
            raise ValueError(f'{label}: sleep overlaps a duty')
        if any(s < end and e > start for s, e in pilot_spans):
            raise ValueError(f'{label}: overlaps another sleep you set')
        pilot_spans.append((start, end))
    return {
        'id': str(raw.get('id') or f'edit-{i + 1}')[:64],
        'action': action,
        'kind': kind,
        'environment': env,
        'target_start_utc': t_start.isoformat() if t_start else None,
        'target_end_utc': t_end.isoformat() if t_end else None,
        'start_utc': start.isoformat() if start else None,
        'end_utc': end.isoformat() if end else None,
    }


def _match(blocks: List[SleepBlock], edit: Dict[str, Any], taken: Set[int]) -> Optional[SleepBlock]:
    t_start = _instant(edit['target_start_utc'], 'target')
    t_end = _instant(edit.get('target_end_utc'), 'target') or t_start + timedelta(minutes=1)
    candidates = [b for b in blocks if b.source != 'pilot' and not b.is_inflight_rest and id(b) not in taken]
    for b in candidates:
        if b.start_utc == t_start:
            return b
    kind = edit.get('kind')
    best, best_overlap = None, timedelta(0)
    for b in candidates:
        if kind is not None and (kind == 'main') != bool(b.is_anchor_sleep):
            continue
        overlap = min(b.end_utc, t_end) - max(b.start_utc, t_start)
        if overlap > best_overlap:
            best, best_overlap = b, overlap
    return best


def _where(roster, at: datetime) -> Tuple[str, str]:
    """(timezone, environment) where the pilot is at ``at``: the arrival of the last duty."""
    home_tz = roster.home_base_timezone
    before = [d for d in roster.duties if d.release_time_utc <= at and d.segments]
    if not before:
        return home_tz, 'home'
    last = max(before, key=lambda d: d.release_time_utc)
    arrival = last.segments[-1].arrival_airport
    if roster.pilot_base and arrival.code != roster.pilot_base and arrival.timezone:
        return arrival.timezone, 'hotel'
    return home_tz, 'home'


def apply(blocks: List[SleepBlock], roster, calculator) -> Tuple[List[SleepBlock], Dict[str, Tuple], List[Dict]]:
    """Apply ``roster.sleep_edits`` to the estimated blocks.

    Returns (blocks, removed, results): ``removed`` maps the start (UTC ISO) of each
    estimated block the pilot removed or replaced to (start, end, is_nap, timezone) so the
    sleep description can say so; ``results`` echoes each edit with ``applied``.
    """
    edits = list(getattr(roster, 'sleep_edits', None) or [])
    if not edits:
        return blocks, {}, []
    home_tz = pytz.timezone(roster.home_base_timezone)
    blocks = list(blocks)
    removed: Dict[str, Tuple] = {}
    results, additions, taken = [], [], set()

    for edit in edits:
        target = None
        if edit['action'] in ('remove', 'replace'):
            target = _match(blocks, edit, taken)
            if target is None:
                results.append({**edit, 'applied': False,
                                'note': 'No estimated sleep matches this change any more.'})
                continue
            taken.add(id(target))
            removed[target.start_utc.astimezone(pytz.utc).isoformat()] = (
                target.start_utc, target.end_utc, not target.is_anchor_sleep,
                target.location_timezone or roster.home_base_timezone)
        if edit['action'] in ('replace', 'add'):
            kind = edit.get('kind') or ('nap' if target is not None and not target.is_anchor_sleep else 'main')
            additions.append((edit, target, kind))
        results.append({**edit, 'applied': True})

    blocks = [b for b in blocks if id(b) not in taken]
    for edit, target, kind in additions:
        start, end = _instant(edit['start_utc'], 'start'), _instant(edit['end_utc'], 'end')
        tz_name, env = _where(roster, start)
        if target is not None:
            tz_name, env = target.location_timezone or tz_name, target.environment or env
        if edit.get('environment'):
            env = edit['environment']
            tz_name = roster.home_base_timezone if env == 'home' else tz_name
        releases = [d.release_time_utc for d in roster.duties if d.release_time_utc <= start]
        reports = [d.report_time_utc for d in roster.duties if d.report_time_utc >= end]
        quality = calculator.calculate_sleep_quality(
            sleep_start=start, sleep_end=end, location=env,
            previous_duty_end=max(releases) if releases else None,
            next_event=min(reports) if reports else end + timedelta(hours=12),
            is_nap=kind == 'nap', location_timezone=tz_name)
        s_home, e_home = start.astimezone(home_tz), end.astimezone(home_tz)
        verb = 'added' if edit['action'] == 'add' else 'set'
        blocks = [b for b in blocks if not (b.start_utc < end and b.end_utc > start and not b.is_inflight_rest)]
        blocks.append(SleepBlock(
            start_utc=start, end_utc=end, location_timezone=tz_name,
            duration_hours=quality.actual_sleep_hours, quality_factor=quality.sleep_efficiency,
            effective_sleep_hours=quality.effective_sleep_hours,
            is_anchor_sleep=kind == 'main', environment=env,
            sleep_start_day=s_home.day, sleep_start_hour=s_home.hour + s_home.minute / 60.0,
            sleep_end_day=e_home.day, sleep_end_hour=e_home.hour + e_home.minute / 60.0,
            basis=(f"You {verb} this {'nap' if kind == 'nap' else 'sleep'}. The model uses your times as "
                   "planned sleep; how well it restores you still follows the time of day, place and "
                   "time since your last duty. It is not counted as sleep you reported having had."),
            source='pilot',
        ))
    blocks.sort(key=lambda b: b.start_utc)
    return blocks, removed, results
