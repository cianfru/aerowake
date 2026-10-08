"""In-flight sleepiness log: ratings a pilot logs during a duty, synced when online.

The app saves each rating on the device first (it works without a connection)
and sends a batch here when the pilot is online and signed in. Each entry carries
a client id, so a resent batch never duplicates rows. The server adds the
model's predicted KSS at that instant from the pilot's own saved analysis (owner
authorisation first). Ratings are private unless the pilot explicitly opted in
to the current study consent version. ``study_enrolled`` records that choice
at collection; it never enrols a pilot (docs/PILOT_STUDY.md).
"""
from datetime import timedelta
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from auth.dependencies import get_current_user
from db.models import InflightLog
from db.session import get_db
from study import config
from study.debriefs import is_enrolled, kss_near, utc_now
from study.limits import throttle

router = APIRouter(prefix='/api', tags=['In-flight log'])

Phase = Literal['pre_flight', 'taxi', 'takeoff_climb', 'cruise', 'descent_approach', 'landing', 'post_flight']

MAX_BATCH = 100
MAX_AGE = timedelta(days=30)
CLOCK_SKEW = timedelta(minutes=5)
DUTY_WINDOW = (timedelta(hours=3), timedelta(hours=24))   # before report, after report
TOTAL_CAP = 5000


class InflightIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    client_id: UUID
    recorded_at_utc: AwareDatetime
    kss: int = Field(ge=1, le=9)
    phase: Optional[Phase] = None
    note: Optional[str] = Field(None, max_length=280)
    analysis_id: Optional[str] = Field(None, max_length=100)
    duty_id: Optional[str] = Field(None, max_length=64)
    duty_report_utc: Optional[AwareDatetime] = None
    recorded_offline: bool = False
    prediction_seen: bool = True


class InflightBatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    entries: List[InflightIn] = Field(max_length=MAX_BATCH)


def serialize(row: InflightLog) -> dict:
    iso = lambda v: v.isoformat() if v else None  # noqa: E731
    return dict(id=str(row.id), client_id=str(row.client_id), analysis_id=row.analysis_id,
                duty_id=row.duty_id, duty_report_utc=iso(row.duty_report_utc),
                recorded_at_utc=iso(row.recorded_at_utc), kss=row.kss, phase=row.phase, note=row.note,
                predicted_kss=row.predicted_kss, engine_version=row.engine_version,
                recorded_offline=row.recorded_offline, prediction_seen=row.prediction_seen,
                study_enrolled=row.study_enrolled, created_at=iso(row.created_at))


def problem(entry: InflightIn, now) -> Optional[str]:
    at = entry.recorded_at_utc
    if at > now + CLOCK_SKEW:
        return 'The rating time is in the future.'
    if at < now - MAX_AGE:
        return 'The rating is older than 30 days.'
    if entry.duty_report_utc is not None:
        before, after = DUTY_WINDOW
        if not entry.duty_report_utc - before <= at <= entry.duty_report_utc + after:
            return 'The rating time is outside this duty.'
    return None


async def _forecasts(entries, user, db) -> dict:
    """analysis_id → (alertness timeline, engine version) for the pilot's own analyses."""
    from api.analysis_access import Principal, analysis_store, authorize
    principal = Principal('user:' + str(user.id), str(user.id))
    out = {}
    for analysis_id in {e.analysis_id for e in entries if e.analysis_id}:
        try:
            record = await authorize(analysis_id, principal, db)
        except HTTPException:
            continue   # not this pilot's (or gone): the rating is kept without a prediction
        if record is not None:
            body = record.analysis_json or {}
            out[analysis_id] = (body.get('alertness_timeline'), body.get('engine_version'))
        elif analysis_id in analysis_store:
            roster = analysis_store[analysis_id].value[1]
            out[analysis_id] = (getattr(roster, 'alertness_timeline', None), None)
    return out


@router.post('/inflight-log')
async def save_inflight_log(body: InflightBatch, user=Depends(get_current_user), db=Depends(get_db)):
    """Save a batch of ratings. Returns one result per entry: saved (or already saved) or rejected."""
    if db is None:
        raise HTTPException(503, 'Database not available')
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    now = utc_now()
    ids = [e.client_id for e in body.entries]
    existing = {row.client_id: row for row in (await db.execute(select(InflightLog).where(
        InflightLog.user_id == user.id, InflightLog.client_id.in_(ids)))).scalars()} if ids else {}
    fresh = [e for e in body.entries if e.client_id not in existing]
    recent = await db.scalar(select(func.count()).select_from(InflightLog).where(
        InflightLog.user_id == user.id, InflightLog.created_at > now - timedelta(hours=24))) or 0
    total = await db.scalar(select(func.count()).select_from(InflightLog).where(InflightLog.user_id == user.id)) or 0
    if fresh and (recent + len(fresh) > config.DAILY_ROW_CAP or total + len(fresh) > TOTAL_CAP):
        raise HTTPException(429, 'Too many in-flight ratings saved recently. They stay on your device; try again later.',
                            headers={'Retry-After': '3600'})
    forecasts = await _forecasts(fresh, user, db)
    enrolled = is_enrolled(user)
    results, added = [], []
    for entry in body.entries:
        if entry.client_id in existing:
            results.append(dict(client_id=str(entry.client_id), status='saved', entry=serialize(existing[entry.client_id])))
            continue
        reason = problem(entry, now)
        if reason:
            results.append(dict(client_id=str(entry.client_id), status='rejected', reason=reason))
            continue
        timeline, engine = forecasts.get(entry.analysis_id, (None, None))
        row = InflightLog(
            user_id=user.id, client_id=entry.client_id,
            analysis_id=entry.analysis_id if entry.analysis_id in forecasts else None,
            duty_id=entry.duty_id, duty_report_utc=entry.duty_report_utc,
            recorded_at_utc=entry.recorded_at_utc, kss=entry.kss, phase=entry.phase,
            note=(entry.note or '').strip() or None,
            predicted_kss=kss_near(timeline, entry.recorded_at_utc) if timeline else None,
            engine_version=engine, recorded_offline=entry.recorded_offline,
            prediction_seen=entry.prediction_seen,
            study_enrolled=bool(enrolled and entry.recorded_at_utc >= user.study_enrolled_at), created_at=now)
        db.add(row)
        added.append(row)
        results.append(dict(client_id=str(entry.client_id), status='saved', row=row))
    try:
        await db.commit()
    except IntegrityError:
        # A concurrent resend saved some of these first: report everything as saved.
        await db.rollback()
        rows = {row.client_id: row for row in (await db.execute(select(InflightLog).where(
            InflightLog.user_id == user.id, InflightLog.client_id.in_(ids)))).scalars()}
        return dict(results=[dict(client_id=str(cid), status='saved', entry=serialize(rows[cid]))
                             if cid in rows else dict(client_id=str(cid), status='rejected', reason='Not saved; try again.')
                             for cid in ids])
    for result in results:
        if 'row' in result:
            result['entry'] = serialize(result.pop('row'))
    return dict(results=results)


@router.get('/inflight-log')
async def list_inflight_log(user=Depends(get_current_user), db=Depends(get_db)):
    if db is None:
        raise HTTPException(503, 'Database not available')
    throttle(user.id, 'study-read', config.READS_PER_MINUTE)
    rows = (await db.execute(select(InflightLog).where(InflightLog.user_id == user.id)
                             .order_by(InflightLog.recorded_at_utc.desc()).limit(1000))).scalars().all()
    return [serialize(r) for r in rows]


@router.delete('/inflight-log/{entry_id}', status_code=204)
async def delete_inflight_entry(entry_id: UUID, user=Depends(get_current_user), db=Depends(get_db)):
    result = await db.execute(delete(InflightLog).where(InflightLog.id == entry_id, InflightLog.user_id == user.id))
    await db.commit()
    if not result.rowcount:
        raise HTTPException(404, 'Rating not found')


@router.delete('/inflight-log', status_code=204)
async def delete_inflight_log(user=Depends(get_current_user), db=Depends(get_db)):
    await db.execute(delete(InflightLog).where(InflightLog.user_id == user.id))
    await db.commit()
