"""Save ratings before returning predictions. Owner-only export/deletion."""
from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, AwareDatetime, model_validator
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from auth.dependencies import get_current_user
from db.session import get_db
from db.models import PilotObservation
from core.published_tpm import predict
from study import config
from study.debriefs import require_enrolled
from study.limits import enforce_daily_cap, participant_id, throttle

router = APIRouter(prefix='/api/pilot-study', tags=['Pilot study'])


class SleepEpisode(BaseModel):
    start: AwareDatetime
    end: AwareDatetime


class Observation(BaseModel):
    client_id: UUID
    observed_at: AwareDatetime
    observed_kss: int = Field(strict=True, ge=1, le=9)
    # v1 clients typed an offset; current clients send the IANA home zone and the
    # server derives the offset at the rating time.
    home_utc_offset: Optional[float] = Field(None, ge=-12, le=14, allow_inf_nan=False)
    home_timezone: Optional[str] = Field(None, min_length=1, max_length=64)
    sleeps: List[SleepEpisode] = Field(min_length=2, max_length=100)
    phase: Literal['pre_duty', 'cruise', 'post_duty', 'off_duty']
    prediction_seen: bool
    actual_sleep: bool
    complete_diary: bool
    home_acclimatized: bool
    consent: Literal[True]

    @model_validator(mode='after')
    def home_clock(self):
        if self.home_timezone is not None:
            try:
                ZoneInfo(self.home_timezone)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError('Unknown home time zone.')
        elif self.home_utc_offset is None:
            raise ValueError('Provide the home time zone.')
        return self


def home_offset(body):
    if body.home_timezone:
        return body.observed_at.astimezone(ZoneInfo(body.home_timezone)).utcoffset().total_seconds() / 3600
    return body.home_utc_offset


def build_payload(body, now):
    if body.observed_at > now + timedelta(minutes=5):
        raise ValueError('The observation cannot be in the future.')
    if body.observed_at < now - timedelta(days=14):
        raise ValueError('Record observations within 14 days.')
    prediction = predict(body.observed_at, [(s.start, s.end) for s in body.sleeps], home_offset(body))
    exclusions = list(prediction['flags'])
    for condition, reason in [
        (body.prediction_seen, 'prediction_seen_before_rating'),
        (not body.actual_sleep, 'sleep_estimated'),
        (not body.complete_diary, 'incomplete_sleep_diary'),
        (not body.home_acclimatized, 'away_or_not_acclimatized'),
        ((now-body.observed_at).total_seconds() > 15*60, 'rating_more_than_15_minutes_late'),
    ]:
        if condition:
            exclusions.append(reason)
    return dict(schema_version=1, consent_version='pilot-study-v1',
                inputs={**body.model_dump(mode='json', exclude={'client_id', 'consent'}),
                        'home_utc_offset': home_offset(body)},
                prediction=prediction, received_at=now.isoformat(),
                primary_analysis_eligible=not exclusions, exclusions=exclusions)


@router.post('/observations')
async def record(body: Observation, user=Depends(require_enrolled), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    # Idempotent retry preserves the original rating/prediction snapshot.
    query = select(PilotObservation).where(PilotObservation.user_id == user.id,
                                           PilotObservation.client_id == body.client_id)
    existing = (await db.execute(query)).scalar_one_or_none()
    if existing:
        return {'id': str(existing.id), **existing.payload}
    await enforce_daily_cap(db, PilotObservation, user.id)
    try:
        payload = build_payload(body, datetime.now(timezone.utc))
    except ValueError as error:
        raise HTTPException(422, str(error))
    payload['enrolment_consent_version'] = user.study_consent_version
    row = PilotObservation(user_id=user.id, client_id=body.client_id, payload=payload)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        row = (await db.execute(query)).scalar_one_or_none()
        if row is None:
            raise HTTPException(409, 'Could not save observation; please retry.')
    return {'id': str(row.id), **row.payload}


@router.get('/observations')
async def export(user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-read', config.READS_PER_MINUTE)
    rows = (await db.execute(select(PilotObservation).where(
        PilotObservation.user_id == user.id).order_by(PilotObservation.created_at))).scalars().all()
    # Stable pseudonym for participant-held-out analysis, no email/name/company.
    participant = participant_id(user.id)
    return {'schema_version': 1, 'participant_id': participant,
            'observations': [{'id': str(r.id), **r.payload} for r in rows]}


@router.delete('/observations/{observation_id}', status_code=204)
async def delete_one(observation_id: UUID, user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    result = await db.execute(delete(PilotObservation).where(PilotObservation.id == observation_id,
                                                             PilotObservation.user_id == user.id))
    if not result.rowcount:
        await db.rollback()
        raise HTTPException(404, 'Observation not found')
    await db.commit()


@router.delete('/observations')
async def withdraw(user=Depends(get_current_user), db=Depends(get_db)):
    throttle(user.id, 'study-write', config.WRITES_PER_MINUTE)
    await db.execute(delete(PilotObservation).where(PilotObservation.user_id == user.id))
    await db.commit()
    return {'deleted': True}
