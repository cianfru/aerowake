"""Canonical input checks shared by upload, preview and replay paths."""
import pytz
from parsers.roster_parser import AirportDatabase, _IATA_DB

def known_airport(code):
    code = str(code).strip().upper()
    if code not in _IATA_DB and code not in AirportDatabase._custom_airports:
        raise ValueError(f'Unknown airport: {code}. Confirm the IATA code before analysis.')
    return AirportDatabase.get_airport(code)

def resolve_home_timezone(base, explicit=None):
    actual = known_airport(base).timezone
    if explicit and explicit != actual:
        raise ValueError(f'Home time zone does not match {base}: expected {actual}.')
    return actual

def duty_label(duty):
    """Human reference for a duty in messages: date in home-base time plus first flight."""
    try:
        local = duty.report_time_utc.astimezone(pytz.timezone(duty.home_base_timezone))
    except (pytz.UnknownTimeZoneError, AttributeError, TypeError):
        local = duty.report_time_utc
    when = f'{local.day} {local:%b %Y}'
    flight = duty.segments[0].flight_number if duty.segments else None
    return f'the duty on {when}' + (f' ({flight})' if flight else '')

def require_duties(roster):
    """Reject imports with nothing to analyse, with a message the pilot can act on."""
    from parsers.base_detection import RosterIntakeError, no_duties_found
    if not roster.duties and not roster.standbys:
        raise no_duties_found()
    if not roster.duties:
        raise RosterIntakeError('This roster only contains home standby, which Aerowake does not score. '
                                'There are no duties to analyse.', 'no_duties')

def validate_roster(roster):
    duties = sorted(roster.duties + roster.standbys, key=lambda d: d.report_time_utc)
    if len(duties) > 120:
        raise ValueError('A roster may contain at most 120 duties.')
    for d in duties:
        if not 0 < d.duty_hours <= 24:
            raise ValueError(f'In {duty_label(d)}, the duty would last {d.duty_hours:.1f} hours. '
                             'Duties must be between 0 and 24 hours. Check dates and time zones.')
        previous = d.report_time_utc
        for s in d.segments:
            known_airport(s.departure_airport.code)
            known_airport(s.arrival_airport.code)
            if not (previous <= s.scheduled_departure_utc < s.scheduled_arrival_utc <= d.release_time_utc):
                raise ValueError(f'In {duty_label(d)}, flights overlap or fall outside report and release. '
                                 'Check dates, times and the home base.')
            if s.block_time_hours > 20:
                raise ValueError(f'Sector {s.flight_number}: more than 20 hours. Confirm dates.')
            previous = s.scheduled_arrival_utc
    for a,b in zip(duties,duties[1:]):
        if b.report_time_utc < a.release_time_utc:
            raise ValueError(f'{duty_label(a)[0].upper()}{duty_label(a)[1:]} overlaps {duty_label(b)}. '
                             'Check report and release times.')
    if duties and (duties[-1].release_time_utc - duties[0].report_time_utc).days > 35:
        raise ValueError('Upload one roster month at a time.')
