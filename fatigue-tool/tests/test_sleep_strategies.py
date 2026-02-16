#!/usr/bin/env python3
"""Tests for sleep strategy selection logic.

Validates that the decision tree in estimate_sleep_for_duty correctly
assigns strategy types based on duty context: timezone crossing, rest
period duration, and report time.
"""

from datetime import datetime, timedelta
import pytz
import pytest

from core import BorbelyFatigueModel, ModelConfig
from models.data_models import Duty, FlightSegment, Airport


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_airport(code, timezone, lat=0.0, lon=0.0):
    return Airport(code=code, timezone=timezone, latitude=lat, longitude=lon)


DOH = _make_airport('DOH', 'Asia/Qatar', lat=25.26, lon=51.56)
DEL = _make_airport('DEL', 'Asia/Kolkata', lat=28.56, lon=77.10)
CCJ = _make_airport('CCJ', 'Asia/Kolkata', lat=11.14, lon=75.95)
LHR = _make_airport('LHR', 'Europe/London', lat=51.47, lon=-0.46)
DXB = _make_airport('DXB', 'Asia/Dubai', lat=25.25, lon=55.36)
MCT = _make_airport('MCT', 'Asia/Muscat', lat=23.59, lon=58.28)
BKK = _make_airport('BKK', 'Asia/Bangkok', lat=13.69, lon=100.75)


def _make_duty(duty_id, report_utc, release_utc, dep_airport, arr_airport,
               home_tz='Asia/Qatar'):
    """Create a minimal single-segment duty."""
    segment = FlightSegment(
        flight_number=f'QR{duty_id}',
        departure_airport=dep_airport,
        arrival_airport=arr_airport,
        scheduled_departure_utc=report_utc + timedelta(minutes=45),
        scheduled_arrival_utc=release_utc - timedelta(minutes=30),
    )
    return Duty(
        duty_id=duty_id,
        date=report_utc.date(),
        report_time_utc=report_utc,
        release_time_utc=release_utc,
        segments=[segment],
        home_base_timezone=home_tz,
    )


def _get_strategy(duty, previous_duty=None, home_tz='Asia/Qatar', home_base='DOH'):
    """Run the sleep calculator and return the SleepStrategy."""
    model = BorbelyFatigueModel(ModelConfig.default_easa_config())
    calc = model.sleep_calculator
    return calc.estimate_sleep_for_duty(
        duty=duty,
        previous_duty=previous_duty,
        home_timezone=home_tz,
        home_base=home_base,
    )


# ── Strategy tests ──────────────────────────────────────────────────────

class TestAnchorStrategy:
    """Timezone crossing ≥3h should trigger anchor strategy."""

    def test_doh_to_del_gets_anchor(self):
        """DOH→DEL is ~1.5h shift — below threshold, should NOT be anchor."""
        # Asia/Qatar = UTC+3, Asia/Kolkata = UTC+5:30 → 2.5h shift
        report = datetime(2025, 3, 10, 5, 0, tzinfo=pytz.utc)  # 08:00 local DOH
        release = report + timedelta(hours=8)
        duty = _make_duty('D001', report, release, DOH, DEL)
        strategy = _get_strategy(duty)
        # 2.5h shift < 3h threshold → should not be anchor
        assert strategy.strategy_type != 'anchor'

    def test_doh_to_lhr_gets_anchor(self):
        """DOH→LHR is 3h shift — should trigger anchor."""
        # Asia/Qatar = UTC+3, Europe/London = UTC+0 → 3h shift
        report = datetime(2025, 3, 10, 5, 0, tzinfo=pytz.utc)  # 08:00 local DOH
        release = report + timedelta(hours=8)
        duty = _make_duty('D002', report, release, LHR, DOH, home_tz='Europe/London')
        # Pilot is home-based in London, departing from London to DOH
        # Departure at LHR (UTC+0), home_tz UTC+0, dep timezone UTC+0 → 0 shift
        # Let's do it differently: pilot based in DOH, departing from LHR
        duty2 = _make_duty('D002b', report, release, LHR, DOH, home_tz='Asia/Qatar')
        strategy = _get_strategy(duty2, home_tz='Asia/Qatar', home_base='DOH')
        assert strategy.strategy_type == 'anchor'

    def test_doh_to_bkk_gets_anchor(self):
        """DOH→BKK is 4h shift — should trigger anchor."""
        # Asia/Qatar = UTC+3, Asia/Bangkok = UTC+7 → 4h shift
        report = datetime(2025, 3, 10, 5, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=8)
        duty = _make_duty('D003', report, release, BKK, DOH, home_tz='Asia/Qatar')
        strategy = _get_strategy(duty, home_tz='Asia/Qatar', home_base='DOH')
        assert strategy.strategy_type == 'anchor'

    def test_anchor_confidence_decreases_with_shift(self):
        """Larger timezone shifts should have lower confidence."""
        report = datetime(2025, 3, 10, 5, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=8)

        # 4h shift (BKK)
        duty_bkk = _make_duty('D_BKK', report, release, BKK, DOH, home_tz='Asia/Qatar')
        strat_bkk = _get_strategy(duty_bkk, home_tz='Asia/Qatar', home_base='DOH')

        # 3h shift (LHR)
        duty_lhr = _make_duty('D_LHR', report, release, LHR, DOH, home_tz='Asia/Qatar')
        strat_lhr = _get_strategy(duty_lhr, home_tz='Asia/Qatar', home_base='DOH')

        assert strat_bkk.strategy_type == 'anchor'
        assert strat_lhr.strategy_type == 'anchor'
        # Larger shift → lower confidence
        assert strat_bkk.confidence <= strat_lhr.confidence


class TestRestrictedStrategy:
    """Short rest period (<9h) should trigger restricted strategy."""

    def test_8h_rest_gets_restricted(self):
        """8h between duties → restricted."""
        prev_release = datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc)
        prev_duty = _make_duty('P001', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        report = prev_release + timedelta(hours=8)
        duty = _make_duty('D004', report, report + timedelta(hours=6), DXB, DOH)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.strategy_type == 'restricted'

    def test_7h_rest_gets_restricted(self):
        """7h between duties → restricted."""
        prev_release = datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc)
        prev_duty = _make_duty('P002', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        report = prev_release + timedelta(hours=7)
        duty = _make_duty('D005', report, report + timedelta(hours=6), DXB, DOH)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.strategy_type == 'restricted'

    def test_restricted_has_low_confidence(self):
        """Restricted strategy should have low confidence (schedule constraint)."""
        prev_release = datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc)
        prev_duty = _make_duty('P003', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        report = prev_release + timedelta(hours=8)
        duty = _make_duty('D006', report, report + timedelta(hours=6), DXB, DOH)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.confidence <= 0.50


class TestSplitStrategy:
    """Rest period 9-10h should trigger split strategy."""

    def test_9_5h_rest_gets_split(self):
        """9.5h between duties → split."""
        prev_release = datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc)
        prev_duty = _make_duty('P004', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        report = prev_release + timedelta(hours=9, minutes=30)
        duty = _make_duty('D007', report, report + timedelta(hours=6), DXB, DOH)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.strategy_type == 'split'


class TestEarlyBedtimeStrategy:
    """Report before 06:00 local should trigger early_bedtime."""

    def test_0430_report_gets_early_bedtime(self):
        """Report at 04:30 local → early_bedtime."""
        # DOH is UTC+3, so 04:30 local = 01:30 UTC
        report = datetime(2025, 3, 10, 1, 30, tzinfo=pytz.utc)
        release = report + timedelta(hours=8)
        duty = _make_duty('D008', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert strategy.strategy_type == 'early_bedtime'

    def test_0530_report_gets_early_bedtime(self):
        """Report at 05:30 local → early_bedtime."""
        # 05:30 local DOH = 02:30 UTC
        report = datetime(2025, 3, 10, 2, 30, tzinfo=pytz.utc)
        release = report + timedelta(hours=8)
        duty = _make_duty('D009', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert strategy.strategy_type == 'early_bedtime'


class TestNapStrategy:
    """Night departure (report ≥20:00 or <04:00 local) → nap strategy."""

    def test_2100_report_gets_nap(self):
        """Report at 21:00 local → nap (night departure)."""
        # 21:00 local DOH = 18:00 UTC
        report = datetime(2025, 3, 10, 18, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=8)
        duty = _make_duty('D010', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert strategy.strategy_type == 'nap'

    def test_2300_report_gets_nap(self):
        """Report at 23:00 local → nap."""
        # 23:00 local DOH = 20:00 UTC
        report = datetime(2025, 3, 10, 20, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=8)
        duty = _make_duty('D011', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert strategy.strategy_type == 'nap'

    def test_nap_has_two_sleep_blocks(self):
        """Nap strategy should produce morning sleep + pre-duty nap."""
        report = datetime(2025, 3, 10, 18, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=8)
        duty = _make_duty('D012', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert len(strategy.sleep_blocks) == 2


class TestAfternoonNapStrategy:
    """Late report (14:00-20:00 local) → afternoon_nap strategy."""

    def test_1500_report_gets_afternoon_nap(self):
        """Report at 15:00 local → afternoon_nap."""
        # 15:00 local DOH = 12:00 UTC
        report = datetime(2025, 3, 10, 12, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=6)
        duty = _make_duty('D013', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert strategy.strategy_type == 'afternoon_nap'

    def test_1800_report_gets_afternoon_nap(self):
        """Report at 18:00 local → afternoon_nap."""
        # 18:00 local DOH = 15:00 UTC
        report = datetime(2025, 3, 10, 15, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=6)
        duty = _make_duty('D014', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert strategy.strategy_type == 'afternoon_nap'

    def test_afternoon_nap_has_two_blocks(self):
        """Afternoon nap strategy: night sleep + afternoon nap."""
        report = datetime(2025, 3, 10, 12, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=6)
        duty = _make_duty('D015', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert len(strategy.sleep_blocks) == 2


class TestExtendedStrategy:
    """Long rest period (>14h) → extended strategy."""

    def test_16h_rest_gets_extended(self):
        """16h rest → extended."""
        prev_release = datetime(2025, 3, 9, 14, 0, tzinfo=pytz.utc)
        prev_duty = _make_duty('P005', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        # 16h gap → report at 06:00 UTC = 09:00 local
        report = prev_release + timedelta(hours=16)
        duty = _make_duty('D016', report, report + timedelta(hours=6), DOH, DXB)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.strategy_type == 'extended'

    def test_extended_has_high_confidence(self):
        """Extended sleep should have higher confidence (ample rest)."""
        prev_release = datetime(2025, 3, 9, 14, 0, tzinfo=pytz.utc)
        prev_duty = _make_duty('P006', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        report = prev_release + timedelta(hours=16)
        duty = _make_duty('D017', report, report + timedelta(hours=6), DOH, DXB)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.confidence >= 0.70


class TestNormalStrategy:
    """Standard daytime duty with no special constraints → normal."""

    def test_0900_report_12h_rest_gets_normal(self):
        """Report at 09:00 local, 12h rest → normal."""
        prev_release = datetime(2025, 3, 9, 15, 0, tzinfo=pytz.utc)  # 18:00 local
        prev_duty = _make_duty('P007', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        # 12h rest → report at 03:00 UTC = 06:00 local
        report = prev_release + timedelta(hours=12)
        duty = _make_duty('D018', report, report + timedelta(hours=6), DOH, DXB)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.strategy_type == 'normal'

    def test_first_duty_no_previous_gets_normal(self):
        """First duty with no previous duty → normal (default)."""
        # 10:00 local DOH = 07:00 UTC
        report = datetime(2025, 3, 10, 7, 0, tzinfo=pytz.utc)
        release = report + timedelta(hours=6)
        duty = _make_duty('D019', report, release, DOH, DXB)
        strategy = _get_strategy(duty)
        assert strategy.strategy_type == 'normal'


class TestStrategyPriority:
    """Verify that more specific strategies take priority."""

    def test_timezone_shift_overrides_extended_rest(self):
        """Even with >14h rest, ≥3h timezone shift → anchor, not extended."""
        prev_release = datetime(2025, 3, 9, 10, 0, tzinfo=pytz.utc)
        prev_duty = _make_duty('P008', prev_release - timedelta(hours=6),
                               prev_release, DOH, BKK)
        # 20h rest — would be extended, but departing from BKK (4h shift)
        report = prev_release + timedelta(hours=20)
        duty = _make_duty('D020', report, report + timedelta(hours=8),
                          BKK, DOH, home_tz='Asia/Qatar')
        strategy = _get_strategy(duty, previous_duty=prev_duty,
                                 home_tz='Asia/Qatar', home_base='DOH')
        assert strategy.strategy_type == 'anchor'

    def test_restricted_overrides_early_bedtime(self):
        """Even with early report, <9h rest → restricted, not early_bedtime."""
        prev_release = datetime(2025, 3, 9, 20, 0, tzinfo=pytz.utc)  # 23:00 local
        prev_duty = _make_duty('P009', prev_release - timedelta(hours=6),
                               prev_release, DOH, DXB)
        # 7h rest → report at 03:00 UTC = 06:00 local (also early)
        # But restricted takes priority
        report = prev_release + timedelta(hours=7)
        duty = _make_duty('D021', report, report + timedelta(hours=6), DOH, DXB)
        strategy = _get_strategy(duty, previous_duty=prev_duty)
        assert strategy.strategy_type == 'restricted'


class TestAllStrategiesReachable:
    """Integration test: verify all 8 pre-duty strategy types are reachable."""

    def test_all_strategy_types_reachable(self):
        """Each strategy type can be triggered with appropriate inputs."""
        strategy_types_seen = set()

        # anchor: BKK departure (4h shift from DOH)
        r = datetime(2025, 3, 10, 5, 0, tzinfo=pytz.utc)
        d = _make_duty('S1', r, r + timedelta(hours=8), BKK, DOH, home_tz='Asia/Qatar')
        strategy_types_seen.add(_get_strategy(d, home_tz='Asia/Qatar', home_base='DOH').strategy_type)

        # restricted: 8h rest
        prev_rel = datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc)
        prev = _make_duty('SP2', prev_rel - timedelta(hours=6), prev_rel, DOH, DXB)
        r2 = prev_rel + timedelta(hours=8)
        d2 = _make_duty('S2', r2, r2 + timedelta(hours=6), DXB, DOH)
        strategy_types_seen.add(_get_strategy(d2, previous_duty=prev).strategy_type)

        # split: 9.5h rest
        r3 = prev_rel + timedelta(hours=9, minutes=30)
        d3 = _make_duty('S3', r3, r3 + timedelta(hours=6), DXB, DOH)
        strategy_types_seen.add(_get_strategy(d3, previous_duty=prev).strategy_type)

        # early_bedtime: 04:30 local report
        r4 = datetime(2025, 3, 10, 1, 30, tzinfo=pytz.utc)
        d4 = _make_duty('S4', r4, r4 + timedelta(hours=8), DOH, DXB)
        strategy_types_seen.add(_get_strategy(d4).strategy_type)

        # nap: 21:00 local report
        r5 = datetime(2025, 3, 10, 18, 0, tzinfo=pytz.utc)
        d5 = _make_duty('S5', r5, r5 + timedelta(hours=8), DOH, DXB)
        strategy_types_seen.add(_get_strategy(d5).strategy_type)

        # afternoon_nap: 15:00 local report
        r6 = datetime(2025, 3, 10, 12, 0, tzinfo=pytz.utc)
        d6 = _make_duty('S6', r6, r6 + timedelta(hours=6), DOH, DXB)
        strategy_types_seen.add(_get_strategy(d6).strategy_type)

        # extended: 16h rest
        prev_rel7 = datetime(2025, 3, 9, 14, 0, tzinfo=pytz.utc)
        prev7 = _make_duty('SP7', prev_rel7 - timedelta(hours=6), prev_rel7, DOH, DXB)
        r7 = prev_rel7 + timedelta(hours=16)
        d7 = _make_duty('S7', r7, r7 + timedelta(hours=6), DOH, DXB)
        strategy_types_seen.add(_get_strategy(d7, previous_duty=prev7).strategy_type)

        # normal: 10:00 local, no previous duty
        r8 = datetime(2025, 3, 10, 7, 0, tzinfo=pytz.utc)
        d8 = _make_duty('S8', r8, r8 + timedelta(hours=6), DOH, DXB)
        strategy_types_seen.add(_get_strategy(d8).strategy_type)

        expected = {'anchor', 'restricted', 'split', 'early_bedtime',
                    'nap', 'afternoon_nap', 'extended', 'normal'}
        assert strategy_types_seen == expected, (
            f"Missing strategies: {expected - strategy_types_seen}, "
            f"Got: {strategy_types_seen}"
        )


class TestSleepBlocksValid:
    """Verify all strategies produce valid sleep blocks."""

    def _assert_valid_blocks(self, strategy):
        assert len(strategy.sleep_blocks) >= 1
        for block in strategy.sleep_blocks:
            assert block.duration_hours > 0
            assert block.effective_sleep_hours >= 0
            assert block.quality_factor > 0
            assert block.start_utc < block.end_utc

    def test_anchor_blocks_valid(self):
        r = datetime(2025, 3, 10, 5, 0, tzinfo=pytz.utc)
        d = _make_duty('V1', r, r + timedelta(hours=8), BKK, DOH, home_tz='Asia/Qatar')
        s = _get_strategy(d, home_tz='Asia/Qatar', home_base='DOH')
        self._assert_valid_blocks(s)

    def test_restricted_blocks_valid(self):
        prev_rel = datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc)
        prev = _make_duty('VP2', prev_rel - timedelta(hours=6), prev_rel, DOH, DXB)
        r = prev_rel + timedelta(hours=8)
        d = _make_duty('V2', r, r + timedelta(hours=6), DXB, DOH)
        s = _get_strategy(d, previous_duty=prev)
        self._assert_valid_blocks(s)

    def test_split_blocks_valid(self):
        prev_rel = datetime(2025, 3, 10, 14, 0, tzinfo=pytz.utc)
        prev = _make_duty('VP3', prev_rel - timedelta(hours=6), prev_rel, DOH, DXB)
        r = prev_rel + timedelta(hours=9, minutes=30)
        d = _make_duty('V3', r, r + timedelta(hours=6), DXB, DOH)
        s = _get_strategy(d, previous_duty=prev)
        self._assert_valid_blocks(s)

    def test_afternoon_nap_blocks_valid(self):
        r = datetime(2025, 3, 10, 12, 0, tzinfo=pytz.utc)
        d = _make_duty('V4', r, r + timedelta(hours=6), DOH, DXB)
        s = _get_strategy(d)
        self._assert_valid_blocks(s)

    def test_extended_blocks_valid(self):
        prev_rel = datetime(2025, 3, 9, 14, 0, tzinfo=pytz.utc)
        prev = _make_duty('VP5', prev_rel - timedelta(hours=6), prev_rel, DOH, DXB)
        r = prev_rel + timedelta(hours=16)
        d = _make_duty('V5', r, r + timedelta(hours=6), DOH, DXB)
        s = _get_strategy(d, previous_duty=prev)
        self._assert_valid_blocks(s)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
