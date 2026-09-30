"""Duty debriefs and study enrolment: owner-scoped, blinded, forecast snapshot taken on the server.

A debrief is one sleepiness rating of a flown duty at a named moment. The pilot
rates first; the server then freezes the roster forecast for that duty from the
saved analysis (never from the client) and returns it with the saved row.
Debriefs are private study records: never shown to companies, never reports to
an operator. See docs/PILOT_STUDY.md (duty debrief protocol v1).
"""
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from auth.dependencies import get_current_user
from core.published_tpm import predict
from db.models import DutyDebrief, PilotObservation
from db.session import get_db
from study import config
from study.limits import enforce_daily_cap, participant_id, throttle

router = APIRouter(prefix='/api', tags=['Duty debriefs'])

Moment = Literal['worst_moment', 'top_of_descent', 'end_of_duty']
Operation = Literal['as_rostered', 'times_changed', 'not_operated']
Felt = Literal['worse', 'about_right', 'better']
Countermeasure = Literal['nap', 'strategic_sleep', 'caffeine', 'controlled_rest', 'inflight_rest', 'other', 'none']

FLAG_KSS = 6.5               # "high" band lower bound; duties at or above are flagged
TOP_OF_DESCENT_BEFORE_ARRIVAL = timedelta(minutes=30)
RECALL_LIMIT = timedelta(days=30)
CLOCK_SKEW = timedelta(minutes=5)


def utc_now():
    return datetime.now(timezone.utc)


# ── Bands (KSS 1–9, classified on the value rounded to one decimal) ─────────

def kss_band(kss):
    if kss is None:
        return None
    value = round(float(kss), 1)
    if value >= 8.5:
        return 'extreme'
    if value >= 7.5:
        return 'critical'
    if value >= 6.5:
        return 'high'
    if value >= 5.5:
        return 'moderate'
    return 'low'


def is_flagged(kss):
    return None if kss is None else round(float(kss), 1) >= FLAG_KSS


def stream_for(delay_hours):
    if delay_hours <= 1:
        return 'momentary'
    if delay_hours <= 12:
        return 'same_day'
    if delay_hours <= 48:
        return 'recalled'
    return 'late'


# ── Request models ───────────────────────────────────────────────────────────

class ReportedSleep(BaseModel):
    model_config = ConfigDict(extra='forbid')
    start_utc: AwareDatetime
    end_utc: AwareDatetime
    kind: Literal['main', 'nap'] = 'main'


class DebriefIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    client_id: UUID
    analysis_id: str = Field(min_length=1, max_length=100)
    duty_id: str = Field(min_length=1, max_length=64)
    duty_report_utc: AwareDatetime
    operation: Operation
    moment: Moment = 'worst_moment'
    kss: Optional[int] = Field(None, strict=True, ge=1, le=9)
    samn_perelli: Optional[int] = Field(None, strict=True, ge=1, le=7)
    rated_at_utc: AwareDatetime
    prediction_seen: bool
    sleeps: List[ReportedSleep] = Field(default_factory=list, max_length=8)
    sleep_complete: bool = False
    countermeasures: List[Countermeasure] = Field(default_factory=list, max_length=7)
    note: Optional[str] = Field(None, max_length=500)

    @field_validator('note')
    @classmethod
    def clean_note(cls, value):
        if value is None:
            return None
        value = ''.join(ch for ch in value if ch == '\n' or ch >= ' ').strip()
        return value or None

    @model_validator(mode='after')
    def consistent(self):
        if self.operation != 'not_operated' and self.kss is None and self.samn_perelli is None:
            raise ValueError('Give a KSS or Samn-Perelli rating, or mark the duty as not operated.')
        if len(set(self.countermeasures)) != len(self.countermeasures):
            raise ValueError('List each countermeasure once.')
        if 'none' in self.countermeasures and len(self.countermeasures) > 1:
            raise ValueError('"None" cannot be combined with other countermeasures.')
        return self


class FeltIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    felt_vs_prediction: Optional[Felt]


class EnrolIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    consent_version: str = Field(max_length=40)
    accepted: Literal[True]


# ── Snapshot helpers (pure; unit-tested) ─────────────────────────────────────

def _parse(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None
    return parsed if parsed.utcoffset() is not None else None


def _num(value):
    return round(float(value), 2) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def find_duty(analysis, duty_id, report_utc):
    for duty in analysis.get('duties') or []:
        report = _parse(duty.get('report_time_utc'))
        if duty.get('duty_id') == duty_id and report and abs(report - report_utc) <= timedelta(minutes=1):
            return duty
    return None


def flown_segments(duty):
    return [s for s in duty.get('segments') or []
            if (s.get('activity_code') or '').upper() != 'IR' and not s.get('is_deadhead')]


def event_time(duty, moment):
    """Clock time the rating refers to; None for the sleepiest point (time unknown)."""
    if moment == 'end_of_duty':
        return _parse(duty.get('release_time_utc'))
    if moment == 'top_of_descent':
        arrivals = [_parse(s.get('arrival_time')) for s in flown_segments(duty)]
        arrivals = [a for a in arrivals if a]
        return max(arrivals) - TOP_OF_DESCENT_BEFORE_ARRIVAL if arrivals else None
    return None


def kss_near(timeline, at, tolerance=timedelta(minutes=20)):
    """Nearest model sample to ``at`` (no interpolation); None when none is close."""
    best = None
    for point in timeline or []:
        t = _parse(point.get('t'))
        if t is None or not isinstance(point.get('kss'), (int, float)):
            continue
        gap = abs(t - at)
        if gap <= tolerance and (best is None or gap < best[0]):
            best = (gap, point['kss'])
    return _num(best[1]) if best else None


def local_hour(at, zone):
    try:
        return at.astimezone(ZoneInfo(zone)).hour if zone else None
    except (ZoneInfoNotFoundError, ValueError):
        return None


def forecast_snapshot(analysis, duty, moment):
    at = event_time(duty, moment)
    peak = duty.get('max_kss')
    zone = analysis.get('home_base_timezone')
    report = _parse(duty.get('report_time_utc'))
    quality = duty.get('sleep_quality') or {}
    segments = [dict(kss_peak=_num(s.get('kss_peak')), kss_at_arrival=_num(s.get('kss_at_arrival')),
                     risk_level=s.get('risk_level'))
                for s in flown_segments(duty) if s.get('kss_peak') is not None]
    return dict(
        engine_version=duty.get('model_version'),
        max_kss=_num(peak), landing_kss=_num(duty.get('landing_kss')), max_kss_90=_num(duty.get('max_kss_90')),
        kss_peak_fdp=_num(duty.get('kss_peak_fdp')), peak_time_utc=duty.get('peak_time_utc'),
        risk_level=kss_band(peak), flagged=is_flagged(peak),
        event_time_utc=at.isoformat() if at else None,
        kss_at_event=kss_near(analysis.get('alertness_timeline'), at) if at else None,
        max_hours_awake=_num(duty.get('max_hours_awake')), prior_sleep_estimated=_num(duty.get('prior_sleep')),
        wocl_hours=_num(duty.get('wocl_hours')), sectors=duty.get('sectors'), duty_type=duty.get('duty_type'),
        report_local_hour=local_hour(report, zone) if report else None, home_timezone=zone,
        segments=segments or None,
        estimated_sleep=[dict(start_utc=b.get('sleep_start_utc'), end_utc=b.get('sleep_end_utc'),
                              kind=b.get('sleep_type'))
                         for b in quality.get('sleep_blocks') or [] if b.get('sleep_start_utc')],
    )


def validate_sleeps(sleeps, report, now):
    periods = sorted((s.start_utc, s.end_utc, s.kind) for s in sleeps)
    previous = None
    for start, end, _ in periods:
        if end <= start or end - start > timedelta(hours=16):
            raise ValueError('Each sleep must end after it starts and last at most 16 hours.')
        if end > now + CLOCK_SKEW or end > report + timedelta(minutes=15):
            raise ValueError('Reported sleep must have ended before the duty report time.')
        if start < report - timedelta(hours=72):
            raise ValueError('Report sleep from the 72 hours before the duty only.')
        if previous is not None and start < previous:
            raise ValueError('Sleep periods must not overlap.')
        previous = end
    return periods


def build_debrief(body, analysis, now):
    """Validate against the saved analysis and return column values plus the frozen payload."""
    duty = find_duty(analysis, body.duty_id, body.duty_report_utc)
    if duty is None:
        raise ValueError('This duty is not in the selected analysis.')
    report, release = _parse(duty.get('report_time_utc')), _parse(duty.get('release_time_utc'))
    if report is None or release is None:
        raise ValueError('This duty has no usable report or release time.')
    if body.moment == 'top_of_descent' and not flown_segments(duty):
        raise ValueError('Top of descent needs a flight sector; choose another moment.')
    rated = body.rated_at_utc
    if rated > now + CLOCK_SKEW:
        raise ValueError('The rating time cannot be in the future.')
    if rated < now - timedelta(hours=24):
        raise ValueError('The rating time is the moment you gave the rating; submit within 24 hours.')
    if release > now and body.operation != 'not_operated':
        raise ValueError('Debrief a duty after its planned release time.')
    at = event_time(duty, body.moment)
    if rated < (at or report) - CLOCK_SKEW:
        raise ValueError('The rating cannot be earlier than the moment it describes.')
    if rated - release > RECALL_LIMIT:
        raise ValueError('Debrief a duty within 30 days of its release.')
    periods = validate_sleeps(body.sleeps, report, now)

    forecast = forecast_snapshot(analysis, duty, body.moment)
    published = None
    if (len(periods) >= 2 and body.sleep_complete and at is not None and body.operation != 'not_operated'
            and forecast['home_timezone']):
        try:
            offset = ZoneInfo(forecast['home_timezone']).utcoffset(at).total_seconds() / 3600
            published = predict(at, [(s, e) for s, e, _ in periods], offset)
        except (ValueError, ZoneInfoNotFoundError):
            published = None

    delay = (rated - (at or release)).total_seconds() / 3600
    stream = stream_for(max(delay, 0))
    exclusions = [reason for condition, reason in [
        (body.operation == 'not_operated', 'not_operated'),
        (body.operation == 'times_changed', 'times_changed_from_roster'),
        (body.prediction_seen, 'prediction_seen_before_rating'),
        (stream == 'late', 'recalled_after_48_hours'),
        (forecast['max_kss'] is None, 'no_model_forecast'),
    ] if condition]
    airports = [s.get('departure') for s in flown_segments(duty)][:1] + [s.get('arrival') for s in flown_segments(duty)]
    payload = dict(
        forecast=forecast, published_tpm=published,
        sleeps=[dict(start_utc=s.isoformat(), end_utc=e.isoformat(), kind=k, source='reported') for s, e, k in periods],
        sleep_complete=body.sleep_complete if periods else False,
        countermeasures=list(body.countermeasures), note=body.note,
        duty=dict(date=duty.get('date'), route=[a for a in airports if a], sectors=duty.get('sectors')),
        quality=dict(recall_delay_hours=round(delay, 2), stream=stream, exclusions=exclusions),
        received_at=now.isoformat(),
    )
    return dict(duty_id=body.duty_id, duty_report_utc=report, duty_release_utc=release, moment=body.moment,
                operation=body.operation, kss=body.kss, samn_perelli=body.samn_perelli, rated_at_utc=rated,
                prediction_seen=body.prediction_seen, payload=payload)


def serialize(row):
    payload = row.payload or {}
    return dict(
        id=str(row.id), client_id=str(row.client_id), analysis_id=row.analysis_id,
        roster_id=str(row.roster_id) if row.roster_id else None, duty_id=row.duty_id,
        duty_report_utc=row.duty_report_utc.isoformat(), duty_release_utc=row.duty_release_utc.isoformat(),
        moment=row.moment, operation=row.operation, kss=row.kss, samn_perelli=row.samn_perelli,
        felt_vs_prediction=row.felt_vs_prediction, rated_at_utc=row.rated_at_utc.isoformat(),
        prediction_seen=row.prediction_seen, consent_version=row.consent_version,
        created_at=row.created_at.isoformat() if row.created_at else None, **payload)


def export_row(row, first_day):
    """Pseudonymised research view: no duty id, route, flight numbers, free text or calendar dates."""
    payload = row.payload or {}
    forecast = {k: v for k, v in (payload.get('forecast') or {}).items()
                if k not in ('peak_time_utc', 'event_time_utc', 'estimated_sleep', 'home_timezone')}
    published = payload.get('published_tpm') or None
    sleeps = payload.get('sleeps') or []
    hours = sum((_parse(s['end_utc']) - _parse(s['start_utc'])).total_seconds() / 3600 for s in sleeps)
    return dict(
        id=str(row.id), day_index=(row.duty_report_utc.date() - first_day).days,
        moment=row.moment, operation=row.operation, kss=row.kss, samn_perelli=row.samn_perelli,
        felt_vs_prediction=row.felt_vs_prediction, prediction_seen=row.prediction_seen,
        countermeasures=payload.get('countermeasures') or [],
        sleep=dict(reported_periods=len(sleeps), reported_hours=round(hours, 2),
                   complete=bool(payload.get('sleep_complete'))),
        forecast=forecast,
        published_tpm=dict(kss=published['kss'], model_version=published['model_version'],
                           hours_awake=published['hours_awake'], flags=published['flags']) if published else None,
        quality=payload.get('quality'), consent_version=row.consent_version)


# ── Enrolment ────────────────────────────────────────────────────────────────

def is_enrolled(user):
    return (getattr(user, 'study_consent_version', None) == config.CONSENT_VERSION
            and getattr(user, 'study_enrolled_at', None) is not None
            and getattr(user, 'study_withdrawn_at', None) is None)


async def require_enrolled(user=Depends(get_current_user)):
    if not is_enrolled(user):
        raise HTTPException(403, 'Join the pilot study before saving debriefs.')
    return user


def _iso(value):
    return value.isoformat() if value else None


async def _enrolment(user, db):
    debriefs = await db.scalar(select(func.count()).select_from(DutyDebrief).where(DutyDebrief.user_id == user.id))
    observations = await db.scalar(select(func.count()).select_from(PilotObservation).where(
        PilotObservation.user_id == user.id))
    last = await db.scalar(select(func.max(DutyDebrief.created_at)).where(DutyDebrief.user_id == user.id))
    return dict(enrolled=is_enrolled(user), enrolled_at=_iso(user.study_enrolled_at),
                consent_version=user.study_consent_version, withdrawn_at=_iso(user.study_withdrawn_at),
                debriefs=debriefs or 0, observations=observations or 0, last_activity_at=_iso(last),
                current=config.summary())


@router.get('/study/enrolment')
async def get_enrolment(user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-read', config.READS_PER_MINUTE)
    return await _enrolment(user, db)


@router.put('/study/enrolment')
async def enrol(body: EnrolIn, user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    if body.consent_version != config.CONSENT_VERSION:
        raise HTTPException(409, 'The study information has changed. Please read it again before joining.')
    user.study_enrolled_at = utc_now()
    user.study_consent_version = config.CONSENT_VERSION
    user.study_withdrawn_at = None
    await db.commit()
    return await _enrolment(user, db)


@router.delete('/study/enrolment')
async def withdraw(delete_data: bool = Query(False), user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    user.study_withdrawn_at = utc_now()
    deleted = dict(debriefs=0, observations=0)
    if delete_data:
        deleted['debriefs'] = (await db.execute(delete(DutyDebrief).where(DutyDebrief.user_id == user.id))).rowcount or 0
        deleted['observations'] = (await db.execute(
            delete(PilotObservation).where(PilotObservation.user_id == user.id))).rowcount or 0
    await db.commit()
    return {**await _enrolment(user, db), 'deleted': deleted}


# ── Debriefs ─────────────────────────────────────────────────────────────────

@router.post('/debriefs')
async def create_debrief(body: DebriefIn, user=Depends(require_enrolled), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    by_client = select(DutyDebrief).where(DutyDebrief.user_id == user.id, DutyDebrief.client_id == body.client_id)
    existing = (await db.execute(by_client)).scalar_one_or_none()
    if existing:  # idempotent retry returns the original snapshot
        return serialize(existing)
    await enforce_daily_cap(db, DutyDebrief, user.id)
    total = await db.scalar(select(func.count()).select_from(DutyDebrief).where(DutyDebrief.user_id == user.id))
    if (total or 0) >= config.TOTAL_DEBRIEF_CAP:
        raise HTTPException(409, 'You have reached the debrief storage limit. Export and delete older debriefs first.')

    # Owner authorisation precedes any cache or database read of the analysis.
    from api.analysis_access import Principal, authorize
    record = await authorize(body.analysis_id, Principal('user:' + str(user.id), str(user.id)), db)
    if record is None:
        raise HTTPException(409, 'This analysis is not saved to your account yet. Re-open it from History and try again.')
    now = utc_now()
    try:
        values = build_debrief(body, record.analysis_json, now)
    except ValueError as error:
        raise HTTPException(422, str(error))
    duplicate = (await db.execute(select(DutyDebrief.id).where(
        DutyDebrief.user_id == user.id, DutyDebrief.duty_id == values['duty_id'],
        DutyDebrief.duty_report_utc == values['duty_report_utc'],
        DutyDebrief.moment == values['moment']))).scalar_one_or_none()
    if duplicate:
        raise HTTPException(409, 'You have already rated this moment of the duty. Delete that debrief to rate it again.')
    row = DutyDebrief(user_id=user.id, client_id=body.client_id, roster_id=record.roster_id,
                      analysis_id=body.analysis_id, consent_version=user.study_consent_version,
                      schema_version=1, **values)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        row = (await db.execute(by_client)).scalar_one_or_none()
        if row is None:
            raise HTTPException(409, 'Could not save this debrief; it may already exist. Refresh and try again.')
    if row.created_at is None:
        row.created_at = now
    return serialize(row)


@router.get('/debriefs')
async def list_debriefs(user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-read', config.READS_PER_MINUTE)
    rows = (await db.execute(select(DutyDebrief).where(DutyDebrief.user_id == user.id)
                             .order_by(DutyDebrief.duty_report_utc.desc(), DutyDebrief.created_at.desc())
                             .limit(1000))).scalars().all()
    return {'debriefs': [serialize(r) for r in rows]}


@router.get('/debriefs/export')
async def export_debriefs(user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-read', config.READS_PER_MINUTE)
    rows = (await db.execute(select(DutyDebrief).where(DutyDebrief.user_id == user.id)
                             .order_by(DutyDebrief.duty_report_utc))).scalars().all()
    first = rows[0].duty_report_utc.date() if rows else None
    return {'schema_version': 1, 'kind': 'duty_debriefs', 'participant_id': participant_id(user.id),
            'consent_version': user.study_consent_version,
            'notice': 'Pseudonymised, not anonymous. Share only by your own choice.',
            'debriefs': [export_row(r, first) for r in rows]}


@router.patch('/debriefs/{debrief_id}')
async def update_felt(debrief_id: UUID, body: FeltIn, user=Depends(get_current_user), db=Depends(get_db)):
    """Only the post-reveal comparison can change; the blinded rating is immutable."""
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    row = (await db.execute(select(DutyDebrief).where(DutyDebrief.id == debrief_id,
                                                      DutyDebrief.user_id == user.id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, 'Debrief not found')
    row.felt_vs_prediction = body.felt_vs_prediction
    await db.commit()
    return serialize(row)


@router.delete('/debriefs/{debrief_id}', status_code=204)
async def delete_debrief(debrief_id: UUID, user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    result = await db.execute(delete(DutyDebrief).where(DutyDebrief.id == debrief_id, DutyDebrief.user_id == user.id))
    if not result.rowcount:
        await db.rollback()
        raise HTTPException(404, 'Debrief not found')
    await db.commit()


@router.delete('/debriefs')
async def delete_all_debriefs(user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    result = await db.execute(delete(DutyDebrief).where(DutyDebrief.user_id == user.id))
    await db.commit()
    return {'deleted': result.rowcount or 0}
