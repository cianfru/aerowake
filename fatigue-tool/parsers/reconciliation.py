"""Human-reviewable parser facts. Source accounting totals are not model validation.

``review`` returns the import summary a pilot confirms before analysis. Messages
are plain British English; every check has a stable ``code`` so clients can
style them. No personal data (name, staff number) is included.
"""
from datetime import datetime, timezone

import pytz

from models.data_models import DutyType
from parsers.base_detection import DUTY_PATTERN, ROSTER_HEADER

_TRAINING = (DutyType.SIMULATOR, DutyType.GROUND_TRAINING)
_LABELS = {
    DutyType.HOME_STANDBY: 'Home standby',
    DutyType.AIRPORT_STANDBY: 'Airport standby',
    DutyType.SIMULATOR: 'Simulator',
    DutyType.GROUND_TRAINING: 'Ground training',
}
_FORMAT_NAMES = {'crewlink': 'CrewLink', 'easyjet': 'easyJet'}


def _hours(text):
    try:
        h,m = str(text).split(':')
        return int(h) + int(m)/60
    except (ValueError, TypeError):
        return None


def hhmm(hours):
    """Decimal hours as h:mm (37.25 -> '37:15')."""
    minutes = int(round(abs(hours) * 60))
    return f"{'-' if hours < 0 else ''}{minutes // 60}:{minutes % 60:02d}"


def _airport(code):
    from parsers.roster_parser import _IATA_DB
    return _IATA_DB.get(code or '', {})


def _place(code):
    city = _airport(code).get('city')
    return f'{code} ({city})' if city else str(code)


def _offset(delta):
    minutes = int(delta.total_seconds() // 60)
    sign = '+' if minutes >= 0 else '-'
    return f'{sign}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}'


def _utc_offsets(zone_name, instants):
    """Distinct UTC offsets of the base across the roster, in order (DST changes show twice)."""
    zone = pytz.timezone(zone_name)
    offsets = []
    for instant in instants:
        value = _offset(instant.astimezone(zone).utcoffset())
        if not offsets or offsets[-1] != value:
            offsets.append(value)
    return offsets


def _label(duty):
    if duty.segments:
        return ' → '.join([duty.segments[0].departure_airport.code] + [s.arrival_airport.code for s in duty.segments])
    label = _LABELS.get(duty.duty_type, 'Duty')
    code = getattr(duty, 'training_code', None)
    return f'{label} ({code})' if code and duty.duty_type in _TRAINING else label


def _check(code, severity, message):
    return {'code': code, 'severity': severity, 'message': message}


def _base_checks(resolution, base, flight_duties, touching):
    checks = []
    if resolution is None:
        return checks
    detected, entered = resolution.detected, resolution.entered
    if resolution.conflict and resolution.source == ROSTER_HEADER:
        checks.append(_check('base_conflict', 'warning',
            f'Your roster header says {_place(detected)}; you entered {entered}. '
            f'Aerowake uses {detected}, the base printed on your roster.'))
    elif resolution.override:
        checks.append(_check('base_override', 'warning',
            f'Analysing with {_place(base)} as home base instead of {_place(detected)} from your roster header. '
            f'Home or hotel sleep, body-clock adjustment and home-base rest rules follow {base}. '
            'Roster times are still read as printed.'))
    elif resolution.conflict and resolution.detected_source == DUTY_PATTERN:
        lead = (f'None of your {flight_duties} flight duties start or end at {base}; most'
                if flight_duties and touching == 0 else 'Most of your duties')
        checks.append(_check('base_conflict', 'warning',
            f'{lead} start and end at {_place(detected)}. Check that {base} is your home base.'))
        return checks
    if flight_duties and touching == 0:
        checks.append(_check('base_not_in_duties', 'warning',
            f'None of your {flight_duties} flight duties start or end at {base}. Is {base} your home base?'))
    return checks


def review(roster, parser, suffix, resolution=None, roster_format=None):
    year, month = map(int, roster.month.split('-'))
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + (month == 12), month % 12 + 1, 1, tzinfo=timezone.utc)
    segments = [s for d in roster.duties for s in d.segments]
    calendar_block = sum(max(0, (min(s.scheduled_arrival_utc, end) - max(s.scheduled_departure_utc, start)).total_seconds()) / 3600
                         for s in segments)
    source = getattr(parser, 'pilot_info', {}) or {}
    source_block, source_duty = _hours(source.get('block_hours')), _hours(source.get('duty_hours'))
    base = roster.pilot_base
    everything = sorted(roster.duties + roster.standbys, key=lambda d: d.report_time_utc)
    flights = [d for d in roster.duties if d.segments]
    touching = sum(1 for d in flights
                   if base in (d.segments[0].departure_airport.code, d.segments[-1].arrival_airport.code))
    inferred_ids = set(getattr(parser, 'inferred_release_ids', None) or ())
    inferred = [d for d in roster.duties if d.duty_id in inferred_ids]
    fmt = roster_format or ('csv' if suffix == '.csv' else 'pdf')

    checks = _base_checks(resolution, base, len(flights), touching)
    matched = source_block is not None and abs(calendar_block - source_block) <= 1/60
    if source_block is not None and not matched:
        missing = source_block - calendar_block
        checks.append(_check('block_mismatch', 'warning',
            f'Parsed block time is {hhmm(calendar_block)}; your roster says {hhmm(source_block)} '
            f'({hhmm(abs(missing))} {"not found" if missing > 0 else "more than the roster total"}). '
            'Check the duty list against your roster before relying on the analysis.'))
    if abs(roster.total_block_hours - calendar_block) > 1/120:
        checks.append(_check('month_boundary', 'info',
            f'A flight continues past the end of the month. Block time within the month is {hhmm(calendar_block)}; '
            f'including whole flights it is {hhmm(roster.total_block_hours)}.'))
    if inferred:
        system = _FORMAT_NAMES.get(fmt, 'This roster')
        count = len(inferred)
        checks.append(_check('inferred_release', 'info',
            f'{system} does not print release times, so they are inferred for {count} '
            f'{"duty" if count == 1 else "duties"}: 30 minutes after the last landing or training session. '
            "Check them against your operator's records."))

    unknown = sorted(set(getattr(parser, 'unrecognised_codes', None) or ()))
    legend = getattr(parser, 'code_legend', None) or {}
    kinds = {d.training_code: _LABELS.get(d.duty_type, 'duty').lower()
             for d in roster.duties + roster.standbys if getattr(d, 'training_code', None) in unknown}
    for code in unknown:
        meaning = legend.get(code)
        source = (f'your roster\'s legend says "{meaning}", so it is read as {kinds.get(code, "ground training")}'
                  if meaning else 'it is not explained on the roster, so it is read as ground training')
        checks.append(_check('unrecognised_activity', 'info',
            f'Activity code {code} is new to Aerowake: {source}. Check the times against your roster.'))

    base_source = resolution.source if resolution else None
    needs_confirmation = base_source == DUTY_PATTERN or any(c['severity'] == 'warning' for c in checks)
    airport = _airport(base)
    return {'month': roster.month, 'home_base': base, 'home_timezone': roster.home_base_timezone,
            'time_convention': getattr(parser, 'effective_timezone_format', 'base-local report/release; airport-local sectors'),
            'total_duties': len(roster.duties), 'total_sectors': len(segments), 'standby_periods': len(roster.standbys),
            'whole_duty_block_hours': round(roster.total_block_hours, 4),
            'calendar_month_block_hours': round(calendar_block, 4),
            'source_block_hours': source_block, 'source_duty_hours': source_duty,
            'block_total_matches_source': matched if source_block is not None else None,
            'warnings': [c['message'] for c in checks],
            # Additive fields (preview schema 2): base provenance and a structured summary.
            'roster_format': fmt,
            'base_source': base_source,
            'detected_base': resolution.detected if resolution else None,
            'detected_base_source': resolution.detected_source if resolution else None,
            'entered_base': resolution.entered if resolution else None,
            'base_conflict': bool(resolution and resolution.conflict),
            'base_override': bool(resolution and resolution.override),
            'base_city': airport.get('city'), 'base_country': airport.get('country'),
            'base_airport_name': airport.get('name'),
            'base_utc_offsets': _utc_offsets(roster.home_base_timezone, [d.report_time_utc for d in everything]),
            'flight_duties': len(flights),
            'training_duties': sum(1 for d in roster.duties if d.duty_type in _TRAINING),
            'airport_standbys': sum(1 for d in roster.duties if d.duty_type == DutyType.AIRPORT_STANDBY),
            'duties_touching_base': touching,
            'inferred_release_count': len(inferred),
            'checks': checks,
            'needs_confirmation': needs_confirmation,
            'duties': [
                {'id': d.duty_id, 'report_utc': d.report_time_utc.isoformat(),
                 'release_utc': d.release_time_utc.isoformat(), 'type': d.duty_type.value,
                 'route': _label(d), 'sectors': len(d.segments),
                 'release_inferred': d.duty_id in inferred_ids and d.duty_type != DutyType.HOME_STANDBY}
                for d in everything]}
