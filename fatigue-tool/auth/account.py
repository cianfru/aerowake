"""Account lifecycle. Email secrets are hashed, single-use and expire in one hour."""
import os
import secrets
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool
from auth.dependencies import get_current_user
from auth.jwt import hash_token
from auth.password import hash_password, verify_password
from db.session import get_db
from db.models import User, AccountActionToken, RefreshToken, Roster, PilotObservation, AggregateMetrics

router = APIRouter(prefix='/api/auth', tags=['account'])

class EmailRequest(BaseModel):
    email: EmailStr

class TokenRequest(BaseModel):
    token: str = Field(min_length=32, max_length=256)

class ResetRequest(TokenRequest):
    password: str = Field(min_length=8, max_length=128)

class PasswordRequest(BaseModel):
    password: str = Field(max_length=128)

class ConsentRequest(BaseModel):
    enabled: bool


def send_email(address, token, purpose):
    message = EmailMessage()
    message['From'] = os.environ['SMTP_FROM']
    message['To'] = address
    message['Subject'] = 'AeroWake: verify your email' if purpose == 'verify' else 'AeroWake: reset your password'
    # Fragment avoids putting bearer secrets into access logs and HTTP referers.
    link = os.environ['PUBLIC_APP_URL'].rstrip('/') + '/account-action#' + purpose + ':' + token
    message.set_content(f'Open this link to {"verify your email" if purpose == "verify" else "reset your password"}:\n\n{link}\n\nThis link expires in one hour. If you did not request it, ignore this email.')
    with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.environ.get('SMTP_PORT', '587')), timeout=15) as smtp:
        smtp.starttls()
        if os.environ.get('SMTP_USER'):
            smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        smtp.send_message(message)

async def issue(db, email, purpose):
    if db is None:
        raise HTTPException(503, 'Account service is unavailable.')
    if not all(os.environ.get(key) for key in ('SMTP_HOST', 'SMTP_FROM', 'PUBLIC_APP_URL')):
        raise HTTPException(503, 'Email delivery is not configured. Contact the operator.')
    user = (await db.execute(select(User).where(User.email == str(email)))).scalar_one_or_none()
    if user and user.is_active:
        raw = secrets.token_urlsafe(48)
        await db.execute(delete(AccountActionToken).where(AccountActionToken.user_id == user.id,
                                                          AccountActionToken.purpose == purpose))
        db.add(AccountActionToken(user_id=user.id, token_hash=hash_token(raw), purpose=purpose,
                                 expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
        try:
            await run_in_threadpool(send_email, user.email, raw, purpose)
            await db.commit()
        except Exception:
            await db.rollback()
            import logging
            logging.getLogger(__name__).warning('Account email delivery failed')
            if purpose == 'verify':
                raise HTTPException(503, 'Email delivery failed. Please try again later.')
    return {'message': 'If this account exists, an email will arrive with the next step.'}

@router.post('/password-reset/request')
async def request_reset(body: EmailRequest, db=Depends(get_db)):
    return await issue(db, body.email, 'reset')

@router.post('/verification/request')
async def request_verification(user=Depends(get_current_user), db=Depends(get_db)):
    return await issue(db, user.email, 'verify')

async def consume(db, raw, purpose):
    if db is None:
        raise HTTPException(503, 'Account service is unavailable.')
    record = (await db.execute(select(AccountActionToken).where(
        AccountActionToken.token_hash == hash_token(raw), AccountActionToken.purpose == purpose,
        AccountActionToken.expires_at > datetime.now(timezone.utc)).with_for_update())).scalar_one_or_none()
    if record is None:
        raise HTTPException(400, 'This link is invalid or expired. Request a new one.')
    user = await db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(400, 'Account is unavailable.')
    await db.delete(record)
    return user

@router.post('/password-reset/confirm')
async def confirm_reset(body: ResetRequest, db=Depends(get_db)):
    user = await consume(db, body.token, 'reset')
    user.password_hash = await run_in_threadpool(hash_password, body.password)
    user.auth_version = (user.auth_version or 0) + 1
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()
    return {'message': 'Password updated. Sign in with your new password.'}

@router.post('/verification/confirm')
async def confirm_verification(body: TokenRequest, db=Depends(get_db)):
    user = await consume(db, body.token, 'verify')
    user.email_verified = True
    await db.commit()
    return {'message': 'Email verified.'}

@router.put('/consent')
async def set_consent(body: ConsentRequest, user=Depends(get_current_user), db=Depends(get_db)):
    if body.enabled and (not user.email_verified or not user.company_id):
        raise HTTPException(400, 'Verify your email and confirm your airline before opting in.')
    user.metrics_consent = body.enabled
    if user.company_id:
        await db.execute(delete(AggregateMetrics).where(AggregateMetrics.company_id == user.company_id))
    await db.commit()
    if user.company_id:
        from metrics.aggregator import compute_aggregate_metrics
        months = (await db.execute(select(Roster.month).where(Roster.company_id == user.company_id).distinct())).scalars().all()
        for month in months:
            await compute_aggregate_metrics(db, user.company_id, month)
    return {'metrics_consent': user.metrics_consent}

@router.get('/export')
async def export_account(user=Depends(get_current_user), db=Depends(get_db)):
    rosters = (await db.execute(select(Roster).where(Roster.user_id == user.id)
                               .options(selectinload(Roster.analyses)))).scalars().all()
    observations = (await db.execute(select(PilotObservation).where(PilotObservation.user_id == user.id))).scalars().all()
    return {'schema': 1, 'email': user.email, 'display_name': user.display_name,
            'sleep_preferences': user.sleep_preferences,
            'rosters': [{'month': r.month, 'filename': r.filename,
                         'analyses': [a.analysis_json for a in r.analyses]} for r in rosters],
            'study_observations': [o.payload for o in observations]}

@router.delete('/account', status_code=204)
async def delete_account(body: PasswordRequest, user=Depends(get_current_user), db=Depends(get_db)):
    if not user.password_hash or not await run_in_threadpool(verify_password, body.password, user.password_hash):
        raise HTTPException(401, 'Confirm your password to delete the account.')
    from api.analysis_access import evict_owner
    if user.company_id:
        await db.execute(delete(AggregateMetrics).where(AggregateMetrics.company_id == user.company_id))
    # Database FK cascades remove uploads, analyses, observations, tokens and fatigue state atomically.
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()
    evict_owner(user.id)
