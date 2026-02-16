#!/usr/bin/env python3
"""Quick test of improved sleep efficiency"""

from datetime import datetime, timedelta
import pytz
from core import BorbelyFatigueModel, ModelConfig
from models.data_models import Duty, FlightSegment, Airport, SleepBlock

def test_improved_efficiency():
    print("=" * 80)
    print("SLEEP EFFICIENCY IMPROVEMENTS TEST")
    print("=" * 80)
    print()
    
    model = BorbelyFatigueModel(ModelConfig.default_easa_config())
    
    # Test 1: Home sleep, 8h, good conditions
    print("Test 1: Home Sleep (8h, ideal conditions)")
    print("-" * 80)
    
    home_tz = pytz.timezone('Asia/Qatar')
    sleep_start = home_tz.localize(datetime(2025, 2, 10, 23, 0))
    sleep_end = home_tz.localize(datetime(2025, 2, 11, 7, 0))
    next_event = home_tz.localize(datetime(2025, 2, 11, 9, 0))
    
    quality = model.sleep_calculator.calculate_sleep_quality(
        sleep_start=sleep_start,
        sleep_end=sleep_end,
        location='home',
        previous_duty_end=None,
        next_event=next_event,
        location_timezone='Asia/Qatar'
    )
    
    print(f"  Duration: {quality.actual_sleep_hours:.2f}h")
    print(f"  Base efficiency: {quality.base_efficiency:.1%}")
    print(f"  Combined efficiency: {quality.sleep_efficiency:.1%}")
    print(f"  Effective sleep: {quality.effective_sleep_hours:.2f}h")
    print(f"  Recovery credit (×1.15): {quality.effective_sleep_hours * 1.15:.2f}h")
    print(f"  Deficit vs 8h need: {8.0 - (quality.effective_sleep_hours * 1.15):.2f}h")
    print()
    
    # Test 2: Hotel sleep
    print("Test 2: Hotel Sleep (8h, good conditions)")
    print("-" * 80)
    
    quality2 = model.sleep_calculator.calculate_sleep_quality(
        sleep_start=sleep_start,
        sleep_end=sleep_end,
        location='hotel',
        previous_duty_end=None,
        next_event=next_event,
        location_timezone='Asia/Qatar'
    )
    
    print(f"  Duration: {quality2.actual_sleep_hours:.2f}h")
    print(f"  Base efficiency: {quality2.base_efficiency:.1%}")
    print(f"  Combined efficiency: {quality2.sleep_efficiency:.1%}")
    print(f"  Effective sleep: {quality2.effective_sleep_hours:.2f}h")
    print(f"  Recovery credit (×1.15): {quality2.effective_sleep_hours * 1.15:.2f}h")
    print(f"  Deficit vs 8h need: {8.0 - (quality2.effective_sleep_hours * 1.15):.2f}h")
    print()
    
    # Test 3: Early duty constraint (7h sleep, time pressure)
    print("Test 3: Constrained Sleep (7h, some time pressure)")
    print("-" * 80)
    
    sleep_start3 = home_tz.localize(datetime(2025, 2, 10, 22, 0))
    sleep_end3 = home_tz.localize(datetime(2025, 2, 11, 5, 0))
    next_event3 = home_tz.localize(datetime(2025, 2, 11, 6, 30))
    
    quality3 = model.sleep_calculator.calculate_sleep_quality(
        sleep_start=sleep_start3,
        sleep_end=sleep_end3,
        location='home',
        previous_duty_end=None,
        next_event=next_event3,
        location_timezone='Asia/Qatar'
    )
    
    print(f"  Duration: {quality3.actual_sleep_hours:.2f}h")
    print(f"  Base efficiency: {quality3.base_efficiency:.1%}")
    print(f"  Combined efficiency: {quality3.sleep_efficiency:.1%}")
    print(f"  Effective sleep: {quality3.effective_sleep_hours:.2f}h")
    print(f"  Recovery credit (×1.15): {quality3.effective_sleep_hours * 1.15:.2f}h")
    print(f"  Deficit vs 8h need: {8.0 - (quality3.effective_sleep_hours * 1.15):.2f}h")
    print()
    
    # Summary
    print("=" * 80)
    print("SUMMARY OF IMPROVEMENTS")
    print("=" * 80)
    print()
    print("Old Model (before changes):")
    print("  Home 8h: ~7.0h effective → 1.0h deficit")
    print("  Hotel 8h: ~6.1h effective → 1.9h deficit")
    print()
    print("New Model (with improvements):")
    print(f"  Home 8h: {quality.effective_sleep_hours:.1f}h effective × 1.15 = {quality.effective_sleep_hours * 1.15:.1f}h recovery → {8.0 - (quality.effective_sleep_hours * 1.15):.1f}h deficit")
    print(f"  Hotel 8h: {quality2.effective_sleep_hours:.1f}h effective × 1.15 = {quality2.effective_sleep_hours * 1.15:.1f}h recovery → {8.0 - (quality2.effective_sleep_hours * 1.15):.1f}h deficit")
    print()
    
    if quality.effective_sleep_hours * 1.15 >= 8.0:
        print("✓ Home sleep now provides SURPLUS recovery!")
    else:
        print(f"⚠ Home sleep still shows {8.0 - (quality.effective_sleep_hours * 1.15):.1f}h deficit")
        
    if quality2.effective_sleep_hours * 1.15 >= 7.5:
        print("✓ Hotel sleep now provides adequate recovery!")
    else:
        print(f"⚠ Hotel sleep still shows {8.0 - (quality2.effective_sleep_hours * 1.15):.1f}h deficit")
    
    print()

if __name__ == '__main__':
    test_improved_efficiency()
