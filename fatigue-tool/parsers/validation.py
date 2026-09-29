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

def validate_roster(roster):
    duties = sorted(roster.duties + roster.standbys, key=lambda d: d.report_time_utc)
    if len(duties) > 120:
        raise ValueError('A roster may contain at most 120 duties.')
    for d in duties:
        if not 0 < d.duty_hours <= 24:
            raise ValueError(f'Duty {d.duty_id}: duration must be between 0 and 24 hours. Check dates and time zones.')
        previous = d.report_time_utc
        for s in d.segments:
            known_airport(s.departure_airport.code)
            known_airport(s.arrival_airport.code)
            if not (previous <= s.scheduled_departure_utc < s.scheduled_arrival_utc <= d.release_time_utc):
                raise ValueError(f'Duty {d.duty_id}: sectors overlap or lie outside report/release.')
            if s.block_time_hours > 20:
                raise ValueError(f'Sector {s.flight_number}: more than 20 hours. Confirm dates.')
            previous = s.scheduled_arrival_utc
    for a,b in zip(duties,duties[1:]):
        if b.report_time_utc < a.release_time_utc:
            raise ValueError(f'Duties {a.duty_id} and {b.duty_id} overlap.')
    if duties and (duties[-1].release_time_utc - duties[0].report_time_utc).days > 35:
        raise ValueError('Upload one roster month at a time.')
