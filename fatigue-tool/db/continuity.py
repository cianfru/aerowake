"""Atomic continuity-state upsert for repeated analyses of one roster."""
from sqlalchemy.dialects.postgresql import insert
from db.models import FatigueState

async def save_fatigue_state(db, state):
    values = {column.name: getattr(state, column.name) for column in FatigueState.__table__.columns
              if column.name not in ('id', 'created_at')}
    statement = insert(FatigueState).values(**values)
    statement = statement.on_conflict_do_update(
        index_elements=['user_id', 'roster_id'],
        set_={name: getattr(statement.excluded, name) for name in values if name not in ('user_id', 'roster_id')})
    await db.execute(statement)
