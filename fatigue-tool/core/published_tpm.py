"""Ingre et al. (2014), model 5c: observed-sleep SB+C+U, direct KSS.
Source: https://doi.org/10.1371/journal.pone.0108679, equations 1.1,
1.3–1.5, 1.7–1.9 and Table 1. Independent implementation, not BAM.
Times are aware UTC instants; circadian time uses a fixed home UTC offset.
"""
from datetime import datetime, timedelta
from math import cos, exp, log, pi, isfinite

VERSION = 'ingre2014-5c-v1'
PARAMETERS = dict(ha=14.3, la=2.4, d=-0.0353, bl=12.2,
                  g=log((14.3-14.0)/(14.3-7.96))/8,
                  phase=16.8, ca=2.5, ua=0.5, um=-0.5,
                  kss_intercept=9.68, kss_slope=-0.46,
                  initial_alertness=8.38)
SOURCE = 'https://doi.org/10.1371/journal.pone.0108679'


def circadian(at: datetime, offset: float):
    # Timestamp arithmetic, independent of the server's local timezone.
    from datetime import timezone
    local = at.astimezone(timezone.utc) + timedelta(hours=offset)
    tod = local.hour + local.minute/60 + local.second/3600
    p = PARAMETERS
    return (p['ca']*cos(2*pi/24*(tod-p['phase'])),
            p['um']+p['ua']*cos(2*pi/12*(tod-p['phase']-3)))


def wake(s: float, hours: float):
    p = PARAMETERS
    return p['la'] + (s-p['la'])*exp(p['d']*hours)


def sleep(s: float, hours: float):
    p = PARAMETERS
    # If already above the brake, continue exponential recovery from s.
    if s >= p['bl']:
        return p['ha']-(p['ha']-s)*exp(p['g']*hours)
    bt = (p['bl']-s)/(p['g']*(p['bl']-p['ha']))
    if hours <= bt:
        return s+hours*p['g']*(p['bl']-p['ha'])
    return p['ha']-(p['ha']-p['bl'])*exp(p['g']*(hours-bt))


def predict(at: datetime, sleeps, home_utc_offset: float):
    """Return an auditable prediction; reject missing/overlapping sleep history.

    No invented sleep, workload multipliers, individual fit, or risk bands.
    Two sleep episodes initialize the published model, but do not by themselves
    establish that a participant supplied a complete diary.
    """
    if at.utcoffset() is None or not isfinite(home_utc_offset) or not -12 <= home_utc_offset <= 14:
        raise ValueError('Use timezone-aware timestamps and a home UTC offset from -12 to +14.')
    if any(start.utcoffset() is None or end.utcoffset() is None for start, end in sleeps):
        raise ValueError('Sleep timestamps must include a timezone.')
    periods = sorted(sleeps)
    if len(periods) < 2 or len(periods) > 100:
        raise ValueError('Provide 2–100 completed sleep episodes, including naps.')
    previous = None
    for start, end in periods:
        if start.utcoffset() is None or end.utcoffset() is None or end <= start or end > at:
            raise ValueError('Sleep must have aware timestamps, end after start, and finish before the rating.')
        if previous is not None and start < previous:
            raise ValueError('Sleep episodes must not overlap.')
        if (end-start).total_seconds() > 24*3600 or at-start > timedelta(days=14):
            raise ValueError('Use sleep episodes up to 24 hours long from the preceding 14 days.')
        previous = end
    c, u = circadian(periods[0][0], home_utc_offset)
    s = PARAMETERS['initial_alertness']-c-u
    cursor = periods[0][0]
    for start, end in periods:
        s = wake(s, (start-cursor).total_seconds()/3600)
        s = sleep(s, (end-start).total_seconds()/3600)
        cursor = end
    hours_awake = (at-cursor).total_seconds()/3600
    s = wake(s, hours_awake)
    c, u = circadian(at, home_utc_offset)
    raw = PARAMETERS['kss_intercept']+PARAMETERS['kss_slope']*(s+c+u)
    flags = []
    if hours_awake > 16:
        flags.append('more_than_16_hours_since_sleep')
    if hours_awake < 1:
        flags.append('first_hour_after_waking_inertia_not_modelled')
    return dict(model_version=VERSION, source=SOURCE, parameters=PARAMETERS.copy(),
                kss_raw=raw, kss=max(1., min(9., raw)), process_s=s,
                process_c=c, process_u=u, hours_awake=hours_awake,
                flags=flags, status='awaiting_operational_validation')
