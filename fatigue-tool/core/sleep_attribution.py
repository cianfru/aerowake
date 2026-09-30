"""
Sleep attribution for the API
=============================

The sleep estimator produces one list of sleep blocks for the whole roster
(``all_sleep``) plus descriptive entries keyed by duty id or rest day. This
module makes the entries match the blocks the model actually used:

* every modelled block appears in exactly one entry, with its final
  (overlap-resolved) times — including gap-fill pre-duty naps;
* a duty's entry holds the **last main sleep before report** and anything
  after it (naps). The recovery sleep right after the previous duty moves to a
  ``post_duty_<previous duty id>`` entry when days off lie in between.

No sleep is added, removed or moved in time here; only the description changes.
"""

from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional

import pytz

from core.alertness import round_half_up
from core.strategy_references import get_strategy_references
from models.data_models import SleepBlock

WOCL_START_HOUR = 2   # AMC1 ORO.FTL.105(10): 02:00–05:59
WOCL_END_HOUR = 6


def block_key(block: SleepBlock) -> str:
    return block.start_utc.astimezone(pytz.utc).isoformat()


def sleep_type_of(block: SleepBlock) -> str:
    if block.is_inflight_rest:
        return 'inflight'
    return 'main' if block.is_anchor_sleep else 'nap'


def wocl_overlap_hours(block: SleepBlock, home_tz) -> float:
    start = block.start_utc.astimezone(home_tz)
    end = block.end_utc.astimezone(home_tz)
    total = 0.0
    day = start.date() - timedelta(days=1)
    while day <= end.date():
        w_start = home_tz.localize(datetime.combine(day, time(WOCL_START_HOUR)))
        w_end = home_tz.localize(datetime.combine(day, time(WOCL_END_HOUR)))
        overlap = (min(end, w_end) - max(start, w_start)).total_seconds() / 3600
        total += max(0.0, overlap)
        day += timedelta(days=1)
    return round(total, 2)


def block_dict(block: SleepBlock, home_tz, sleep_type: Optional[str] = None,
               quality_factors: Optional[dict] = None) -> Dict[str, Any]:
    """API dict for one sleep block (same fields as the strategy entries)."""
    loc_tz = pytz.timezone(block.location_timezone or home_tz.zone)
    s_utc, e_utc = block.start_utc.astimezone(pytz.utc), block.end_utc.astimezone(pytz.utc)
    s_home, e_home = s_utc.astimezone(home_tz), e_utc.astimezone(home_tz)
    s_loc, e_loc = s_utc.astimezone(loc_tz), e_utc.astimezone(loc_tz)
    return {
        'sleep_start_time': s_home.strftime('%H:%M'),
        'sleep_end_time': e_home.strftime('%H:%M'),
        'sleep_start_iso': s_home.isoformat(),
        'sleep_end_iso': e_home.isoformat(),
        'sleep_start_utc': s_utc.isoformat(),
        'sleep_end_utc': e_utc.isoformat(),
        'sleep_start_day': s_home.day,
        'sleep_start_hour': s_home.hour + s_home.minute / 60.0,
        'sleep_end_day': e_home.day,
        'sleep_end_hour': e_home.hour + e_home.minute / 60.0,
        'location_timezone': loc_tz.zone,
        'environment': block.environment,
        'sleep_start_time_home_tz': s_home.strftime('%H:%M'),
        'sleep_end_time_home_tz': e_home.strftime('%H:%M'),
        'sleep_start_day_home_tz': s_home.day,
        'sleep_start_hour_home_tz': s_home.hour + s_home.minute / 60.0,
        'sleep_end_day_home_tz': e_home.day,
        'sleep_end_hour_home_tz': e_home.hour + e_home.minute / 60.0,
        'sleep_start_day_utc': s_utc.day,
        'sleep_start_hour_utc': s_utc.hour + s_utc.minute / 60.0,
        'sleep_end_day_utc': e_utc.day,
        'sleep_end_hour_utc': e_utc.hour + e_utc.minute / 60.0,
        'sleep_start_time_utc': s_utc.strftime('%H:%M'),
        'sleep_end_time_utc': e_utc.strftime('%H:%M'),
        'sleep_start_time_location_tz': s_loc.strftime('%H:%M'),
        'sleep_end_time_location_tz': e_loc.strftime('%H:%M'),
        'sleep_type': sleep_type or sleep_type_of(block),
        'duration_hours': block.duration_hours,
        'effective_hours': block.effective_sleep_hours,
        'quality_factor': block.quality_factor,
        'quality_factors': quality_factors,
    }


def summarise(blocks: List[SleepBlock], home_tz) -> Dict[str, Any]:
    total = sum(b.duration_hours for b in blocks)
    effective = sum(b.effective_sleep_hours for b in blocks)
    return {
        'total_sleep_hours': round(total, 2),
        'effective_sleep_hours': round(effective, 2),
        'sleep_efficiency': round(effective / total, 3) if total > 0 else 0.0,
        'wocl_overlap_hours': round(sum(wocl_overlap_hours(b, home_tz) for b in blocks), 2),
    }


def main_block(blocks: List[SleepBlock]) -> Optional[SleepBlock]:
    mains = [b for b in blocks if b.is_anchor_sleep and not b.is_inflight_rest]
    return mains[-1] if mains else (blocks[-1] if blocks else None)


def pre_duty_naps(blocks: List[SleepBlock]) -> List[SleepBlock]:
    """Naps after the last main sleep (the assumed pre-duty naps)."""
    main = main_block(blocks)
    if main is None:
        return []
    return [b for b in blocks if not b.is_anchor_sleep and b.start_utc >= main.end_utc]


def _clock(dt: datetime, tz) -> str:
    return dt.astimezone(tz).strftime('%H:%M')


def _nap_sentence(naps: List[SleepBlock], habit: str) -> str:
    if not naps:
        return ''
    hours = sum(b.duration_hours for b in naps)
    spans = ', '.join(f"{_clock(b.start_utc, pytz.timezone(b.location_timezone))}–"
                      f"{_clock(b.end_utc, pytz.timezone(b.location_timezone))}" for b in naps)
    return f" Assumed pre-duty nap {spans} local ({round_half_up(hours, 1):.1f}h; nap habit: {habit})."


def attribute_sleep(roster, blocks: List[SleepBlock], strategies: Dict[str, Any],
                    home_tz, nap_habit: str) -> Dict[str, Any]:
    """Return entries that describe exactly ``blocks`` (see module docstring)."""
    blocks = sorted(blocks, key=lambda b: b.start_utc)
    final = {block_key(b): b for b in blocks}

    # Which entry described each block, and its quality-factor breakdown.
    owner: Dict[str, str] = {}
    factors: Dict[str, Optional[dict]] = {}
    for key, data in strategies.items():
        for bd in data.get('sleep_blocks', []):
            k = bd.get('sleep_start_utc')
            if k and k not in owner:
                owner[k] = key
                factors[k] = bd.get('quality_factors')

    out: Dict[str, Any] = {}
    claimed = set()

    def refresh(key: str, members: List[SleepBlock], data: Dict[str, Any]) -> Dict[str, Any]:
        entry = dict(data)
        entry['sleep_blocks'] = [block_dict(b, home_tz, quality_factors=factors.get(block_key(b)))
                                 for b in members]
        entry.update(summarise(members, home_tz))
        main = main_block(members)
        if main is not None:
            entry['sleep_start_time'] = _clock(main.start_utc, home_tz)
            entry['sleep_end_time'] = _clock(main.end_utc, home_tz)
        naps = pre_duty_naps(members)
        entry['assumed_nap_hours'] = round(sum(b.duration_hours for b in naps), 2) if naps else None
        claimed.update(block_key(b) for b in members)
        return entry

    duties = roster.duties
    for i, duty in enumerate(duties):
        own = duty.duty_id
        data = strategies.get(own)
        if data is not None and (data.get('strategy_type') == 'ulr_pre_duty'
                                 or getattr(duty, 'is_augmented_crew', False)):
            members = [final[bd['sleep_start_utc']] for bd in data.get('sleep_blocks', [])
                       if bd.get('sleep_start_utc') in final]
            out[own] = refresh(own, members, data)
            continue
        gap_start = duties[i - 1].release_time_utc if i else None
        in_gap = [b for b in blocks if b.start_utc < duty.report_time_utc
                  and (gap_start is None or b.start_utc >= gap_start)
                  and block_key(b) not in claimed]
        if not in_gap:
            continue
        mains = [b for b in in_gap if b.is_anchor_sleep and not b.is_inflight_rest]
        last_main = mains[-1] if mains else None
        if last_main is None or owner.get(block_key(last_main)) == own:
            pre = [b for b in in_gap if owner.get(block_key(b)) == own
                   or (block_key(b) not in owner and (last_main is None or b.start_utc >= last_main.start_utc))]
        else:
            pre = [b for b in in_gap if b.start_utc >= last_main.start_utc]
        if not pre:
            continue
        moved = [b for b in in_gap if owner.get(block_key(b)) == own and b not in pre]
        if moved and i:
            prev_id = duties[i - 1].duty_id
            out[f'post_duty_{prev_id}'] = refresh(f'post_duty_{prev_id}', moved, data or {})

        naps = pre_duty_naps(pre)
        gap_naps = [b for b in naps if block_key(b) not in owner]
        main = main_block(pre)
        main_owner = owner.get(block_key(main)) if main is not None else None
        source = strategies.get(main_owner) or data or {}
        entry = dict(source)
        if main_owner != own and main is not None:
            # The gap-fill night (or another entry's block) is the last main sleep.
            tz = pytz.timezone(main.location_timezone)
            entry['strategy_type'] = 'normal'
            entry['explanation'] = (f"Last main sleep before report: {main.environment} "
                                    f"{_clock(main.start_utc, tz)}–{_clock(main.end_utc, tz)} local "
                                    f"({main.duration_hours:.1f}h).")
            entry.pop('recovery_night_number', None)
            entry.pop('cumulative_recovery_fraction', None)
        if gap_naps:
            entry['strategy_type'] = 'nap'
            entry['confidence'] = round(min(entry.get('confidence', 0.8), 0.6), 2)
            entry['explanation'] = (entry.get('explanation', '') + _nap_sentence(gap_naps, nap_habit)).strip()
            entry['confidence_basis'] = ((entry.get('confidence_basis') or
                                          'Estimated sleep opportunity, not reported sleep.') +
                                         ' Naps vary between pilots; the nap habit setting controls this assumption.')
            entry['references'] = list(entry.get('references') or []) + get_strategy_references('nap')
        entry.setdefault('strategy_type', 'normal')
        entry.setdefault('confidence', 0.6)
        entry.setdefault('warnings', [])
        entry.setdefault('references', get_strategy_references('recovery'))
        out[own] = refresh(own, pre, entry)

    # Remaining blocks keep (or get) their rest-day/post-duty entries.
    remaining: Dict[str, List[SleepBlock]] = {}
    for b in blocks:
        k = block_key(b)
        if k in claimed:
            continue
        key = owner.get(k)
        if key is None or key in out or not (key.startswith('rest_') or key.startswith('post_duty_')):
            key = f"rest_{b.start_utc.astimezone(home_tz).date().isoformat()}"
        remaining.setdefault(key, []).append(b)
    for key, members in remaining.items():
        base = strategies.get(key) or {
            'strategy_type': 'nap' if all(not m.is_anchor_sleep for m in members) else 'recovery',
            'confidence': 0.6,
            'warnings': [],
            'explanation': 'Estimated sleep between duties.',
            'confidence_basis': 'Estimated sleep opportunity, not reported sleep.',
            'quality_factors': None,
            'references': get_strategy_references('recovery'),
        }
        out[key] = refresh(key, members, base)
    return out
