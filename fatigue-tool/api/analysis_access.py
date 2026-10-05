"""A single authorization boundary for cached and persisted analyses."""
import hashlib
import time
from dataclasses import dataclass
from typing import Optional
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from auth.dependencies import get_optional_user
from db.models import Analysis, Roster, User
from api.hardening import BoundedStore

@dataclass(frozen=True)
class Principal:
    owner: str
    user_id: Optional[str] = None

async def analysis_principal(user: Optional[User] = Depends(get_optional_user),
                             guest: Optional[str] = Header(None, alias='X-Guest-Session')):
    if user is not None:
        return Principal('user:' + str(user.id), str(user.id))
    # A per-tab random bearer capability. Never include it in URLs or logs.
    if not guest or len(guest) < 32 or len(guest) > 128:
        raise HTTPException(401, 'Sign in or start a new guest session.')
    return Principal('guest:' + hashlib.sha256(guest.encode()).hexdigest())

@dataclass
class CacheEntry:
    owner: str
    value: tuple
    expires_at: float
    roster_id: Optional[str] = None

analysis_store = BoundedStore()

def remember(analysis_id, value, principal, roster_id=None):
    analysis_store[analysis_id] = CacheEntry(principal.owner, value, time.monotonic() + 3600,
                                           str(roster_id) if roster_id else None)

def evict_roster(roster_id):
    for key, entry in list(analysis_store.items()):
        if entry.roster_id == str(roster_id):
            analysis_store.pop(key, None)

def evict_owner(user_id):
    for key, entry in list(analysis_store.items()):
        if entry.owner == 'user:' + str(user_id):
            analysis_store.pop(key, None)

async def authorize(analysis_id, principal, db):
    entry = analysis_store.get(analysis_id)
    if entry and entry.expires_at <= time.monotonic():
        analysis_store.pop(analysis_id, None)
        entry = None
    if entry and entry.owner != principal.owner:
        raise HTTPException(404, 'Analysis not found')
    # Saved results always check durable ownership (also handles deletion on another worker).
    if principal.user_id and db is not None:
        result = await db.execute(select(Analysis).join(Roster).where(
            Analysis.id == analysis_id, Roster.user_id == principal.user_id))
        record = result.scalar_one_or_none()
        if record is not None:
            return record
        if entry and entry.roster_id:
            analysis_store.pop(analysis_id, None)
            raise HTTPException(404, 'Analysis not found')
    if entry:
        return None
    raise HTTPException(404, 'Analysis not found')

async def load(analysis_id, principal, db):
    record = await authorize(analysis_id, principal, db)
    if analysis_id not in analysis_store:
        from api.replay import restore
        from api.hardening import run_compute
        from core import BorbelyFatigueModel, ModelConfig
        snapshot = record.analysis_json.get('_replay') if record else None
        if not snapshot:
            raise HTTPException(409, 'This legacy analysis has no reproducible inputs. Re-upload the original roster.')
        roster = restore(snapshot)
        stored = getattr(roster, 'analysis_assumptions', None) or {}
        model = BorbelyFatigueModel(ModelConfig.aerowake(
            nap_habit=stored.get('nap_habit'), usual_bedtime=stored.get('usual_bedtime'),
            usual_wake_time=stored.get('usual_wake_time')))
        monthly = await run_compute(model.simulate_roster, roster)
        remember(analysis_id, (monthly, roster, model.sleep_strategies), principal, record.roster_id)
    return analysis_store[analysis_id].value
