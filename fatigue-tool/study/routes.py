"""Save ratings before returning predictions. Owner-only export/deletion."""
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, AwareDatetime
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from auth.dependencies import get_current_user
from db.session import get_db
from db.models import PilotObservation
from core.published_tpm import predict

router = APIRouter(prefix='/api/pilot-study', tags=['Pilot study'])


class SleepEpisode(BaseModel):
    start: AwareDatetime
    end: AwareDatetime


class Observation(BaseModel):
    client_id: UUID
    observed_at: AwareDatetime
    observed_kss: int = Field(strict=True, ge=1, le=9)
    home_utc_offset: float = Field(ge=-12, le=14, allow_inf_nan=False)
    sleeps: List[SleepEpisode] = Field(min_length=2, max_length=100)
    phase: Literal['pre_duty', 'cruise', 'post_duty', 'off_duty']
    prediction_seen: bool
    actual_sleep: bool
    complete_diary: bool
    home_acclimatized: bool
    consent: Literal[True]


def build_payload(body, now):
    if body.observed_at > now + timedelta(minutes=5):
        raise ValueError('The observation cannot be in the future.')
    if body.observed_at < now - timedelta(days=14):
        raise ValueError('Record observations within 14 days.')
    prediction = predict(body.observed_at, [(s.start, s.end) for s in body.sleeps], body.home_utc_offset)
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
                inputs=body.model_dump(mode='json', exclude={'client_id', 'consent'}),
                prediction=prediction, received_at=now.isoformat(),
                primary_analysis_eligible=not exclusions, exclusions=exclusions)


@router.post('/observations')
async def record(body: Observation, user=Depends(get_current_user), db=Depends(get_db)):
    # Idempotent retry preserves the original rating/prediction snapshot.
    query = select(PilotObservation).where(PilotObservation.user_id == user.id,
                                           PilotObservation.client_id == body.client_id)
    existing = (await db.execute(query)).scalar_one_or_none()
    if existing:
        return {'id': str(existing.id), **existing.payload}
    try:
        payload = build_payload(body, datetime.now(timezone.utc))
    except ValueError as error:
        raise HTTPException(422, str(error))
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
    rows = (await db.execute(select(PilotObservation).where(
        PilotObservation.user_id == user.id).order_by(PilotObservation.created_at))).scalars().all()
    # Stable pseudonym for participant-held-out analysis, no email/name/company.
    participant = hashlib.sha256(('aerowake-pilot-study-v1:'+str(user.id)).encode()).hexdigest()[:24]
    return {'schema_version': 1, 'participant_id': participant,
            'observations': [{'id': str(r.id), **r.payload} for r in rows]}


@router.delete('/observations')
async def withdraw(user=Depends(get_current_user), db=Depends(get_db)):
    await db.execute(delete(PilotObservation).where(PilotObservation.user_id == user.id))
    await db.commit()
    return {'deleted': True}
