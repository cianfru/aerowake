"""Human-reviewable parser facts. Source accounting totals are not model validation."""
from datetime import datetime, timezone

def _hours(text):
    try:
        h,m = str(text).split(':')
        return int(h) + int(m)/60
    except (ValueError, TypeError):
        return None

def review(roster, parser, suffix):
    year, month = map(int, roster.month.split('-'))
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + (month == 12), month % 12 + 1, 1, tzinfo=timezone.utc)
    segments = [s for d in roster.duties for s in d.segments]
    calendar_block = sum(max(0, (min(s.scheduled_arrival_utc, end) - max(s.scheduled_departure_utc, start)).total_seconds()) / 3600
                         for s in segments)
    source = getattr(parser, 'pilot_info', {})
    source_block, source_duty = _hours(source.get('block_hours')), _hours(source.get('duty_hours'))
    notes = []
    if suffix == '.pdf':
        notes.append('Some PDF release times are inferred from post-flight allowances. Confirm them against operator records; duty totals are not independently verified.')
    if abs(roster.total_block_hours - calendar_block) > 1/120:
        notes.append('A flight crosses the UTC month boundary. Whole-duty block hours include the continuation; calendar-month block hours are clipped at midnight UTC.')
    matched = source_block is not None and abs(calendar_block - source_block) <= 1/60
    if source_block is not None and not matched:
        notes.append('Source block hours do not reconcile with parsed calendar-month hours. Review sector times before continuing.')
    return {'month': roster.month, 'home_base': roster.pilot_base, 'home_timezone': roster.home_base_timezone,
            'time_convention': getattr(parser, 'effective_timezone_format', 'base-local report/release; airport-local sectors'),
            'total_duties': len(roster.duties), 'total_sectors': len(segments), 'standby_periods': len(roster.standbys),
            'whole_duty_block_hours': round(roster.total_block_hours, 4),
            'calendar_month_block_hours': round(calendar_block, 4),
            'source_block_hours': source_block, 'source_duty_hours': source_duty,
            'block_total_matches_source': matched if source_block is not None else None,
            'warnings': notes, 'duties': [
                {'id': d.duty_id, 'report_utc': d.report_time_utc.isoformat(),
                 'release_utc': d.release_time_utc.isoformat(), 'type': d.duty_type.value,
                 'route': ' → '.join([d.segments[0].departure_airport.code] + [s.arrival_airport.code for s in d.segments]) if d.segments else 'Standby / training'}
                for d in sorted(roster.duties + roster.standbys, key=lambda d: d.report_time_utc)]}
