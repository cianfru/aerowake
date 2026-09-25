"""Physical consistency and report provenance, independent of target score tuning."""
from datetime import timedelta
from dataclasses import replace
import pytest
from core import BorbelyFatigueModel, ModelConfig
from models.data_models import SleepBlock, Roster
from test_extended_operations import make_short_haul_duty


def block(end, hours, quality=1):
    return SleepBlock(start_utc=end-timedelta(hours=hours), end_utc=end,
                      location_timezone='Asia/Qatar', duration_hours=hours,
                      quality_factor=quality, effective_sleep_hours=hours*quality)


def test_nap_preserves_night_and_improves_landing():
    m = BorbelyFatigueModel(ModelConfig.operational_config())
    d = make_short_haul_duty(report_hour_utc=10)
    night = block(d.report_time_utc-timedelta(hours=6), 8)
    nap = block(d.report_time_utc-timedelta(hours=1.5), .5)
    baseline = m.simulate_duty(d, [night])
    improved = m.simulate_duty(d, [night, nap])
    nap_only = m.simulate_duty(d, [nap])
    assert improved.prior_sleep_hours == pytest.approx(8.5)
    assert improved.landing_performance > baseline.landing_performance
    assert improved.landing_performance > nap_only.landing_performance


def test_quality_and_prior_state_are_used():
    m = BorbelyFatigueModel()
    d = make_short_haul_duty()
    sleep = block(d.report_time_utc-timedelta(hours=2), 8)
    good = m.simulate_duty(d, [sleep], cached_s=.8, state_time=sleep.start_utc)
    poor = m.simulate_duty(d, [replace(sleep, quality_factor=.5)], cached_s=.8, state_time=sleep.start_utc)
    rested = m.simulate_duty(d, [sleep], cached_s=.1, state_time=sleep.start_utc)
    assert good.landing_performance > poor.landing_performance
    assert rested.landing_performance > good.landing_performance


def test_debt_used_matches_reported_and_state_is_carried():
    class Trace(BorbelyFatigueModel):
        def simulate_duty(self, *args, **kwargs):
            result = super().simulate_duty(*args, **kwargs)
            self.inputs.append((kwargs, result))
            return result
    m = Trace(ModelConfig.operational_config()); m.inputs = []
    first = make_short_haul_duty()
    second = replace(first, duty_id='second', date=first.date+timedelta(days=4),
                     report_time_utc=first.report_time_utc+timedelta(days=4),
                     release_time_utc=first.release_time_utc+timedelta(days=4),
                     segments=[replace(s, scheduled_departure_utc=s.scheduled_departure_utc+timedelta(days=4), scheduled_arrival_utc=s.scheduled_arrival_utc+timedelta(days=4)) for s in first.segments])
    r = Roster('test', 'synthetic', '2025-06', [first, second], 'Asia/Qatar', pilot_base='DOH', initial_sleep_debt=10)
    m.simulate_roster(r)
    for args, result in m.inputs:
        assert result.cumulative_sleep_debt == args['cumulative_sleep_debt']
        assert result.risk_thresholds == m.config.risk_thresholds.thresholds
        assert result.model_version
    assert m.inputs[1][0]['cached_s'] == m.inputs[0][1].final_process_s
    assert m.inputs[1][0]['state_time'] == first.release_time_utc


def test_risk_boundaries_and_invalid_data():
    policy = ModelConfig.aerowake().risk_thresholds
    assert policy.classify(100) == 'low'
    assert policy.classify(float('nan')) == 'unknown'
    assert policy.classify(None) == 'unknown'
    for name, (low, high) in policy.thresholds.items():
        assert policy.classify(low) == name


def test_single_model_for_all_legacy_presets():
    # One model only: legacy preset names must not change results.
    base = ModelConfig.aerowake()
    for name in ['default', 'operational', 'easa_default', 'conservative', 'liberal', 'research']:
        assert ModelConfig.from_preset(name).risk_thresholds.thresholds == base.risk_thresholds.thresholds
    assert ModelConfig.operational_config().sleep_quality_params == base.sleep_quality_params
