"""Circadian adaptation resolves offsets at UTC instants, not local wall fields."""
from datetime import datetime, timedelta, timezone
import pytest
from core.fatigue_model import BorbelyFatigueModel
from core import alertness
from models.data_models import CircadianState


@pytest.mark.parametrize('instant,current_zone,expected_gap', [
    (datetime(2026, 3, 29, 1, 30, tzinfo=timezone.utc), 'Europe/London', 1),
    (datetime(2026, 3, 8, 3, 30, tzinfo=timezone.utc), 'America/New_York', -5),
    (datetime(2026, 10, 25, 1, 30, tzinfo=timezone.utc), 'Europe/London', 0),
])
def test_phase_adaptation_uses_timezone_offset_at_instant(instant, current_zone, expected_gap):
    state = CircadianState(current_phase_shift_hours=0,
                           last_update_utc=instant - timedelta(days=1),
                           reference_timezone='UTC')
    result = BorbelyFatigueModel().calculate_adaptation(instant, state, current_zone, 'UTC')
    assert result.current_phase_shift_hours == pytest.approx(alertness.acclimatize(0, expected_gap, 1))
