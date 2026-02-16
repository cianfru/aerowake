#!/usr/bin/env python3
"""
Analyze sleep efficiency and debt accumulation issues

This script examines:
1. Current sleep efficiency values by environment
2. How sleep debt accumulates over a month
3. Whether effective sleep provides sufficient recovery
"""

from datetime import datetime, timedelta
import pytz
from core import BorbelyFatigueModel, ModelConfig
from models.data_models import Duty, FlightSegment, Airport, SleepBlock, Roster

def create_monthly_roster():
    """Create a typical monthly roster with varied patterns"""
    
    home_tz = pytz.timezone('Asia/Qatar')
    duties = []
    
    # Pattern: 3 days on, 2 days off, repeated
    month_start = datetime(2025, 2, 1, tzinfo=pytz.utc)
    
    duty_count = 0
    current_date = month_start
    
    while current_date < month_start + timedelta(days=28):
        # 3 days on
        for day_num in range(3):
            if current_date >= month_start + timedelta(days=28):
                break
                
            duty_count += 1
            
            # Vary duty types: early start, normal, late
            if duty_count % 3 == 0:
                # Early start
                report_hour = 5
                duty_hours = 10
            elif duty_count % 3 == 1:
                # Normal
                report_hour = 8
                duty_hours = 8
            else:
                # Late/night
                report_hour = 20
                duty_hours = 9
            
            report_time = home_tz.localize(
                datetime.combine(current_date.date(), datetime.min.time())
            ).replace(hour=report_hour).astimezone(pytz.utc)
            
            release_time = report_time + timedelta(hours=duty_hours)
            
            # Create flight segments
            origin = Airport(code='DOH', timezone='Asia/Qatar')
            dest = Airport(code='LHR', timezone='Europe/London')
            
            dep_time = report_time + timedelta(hours=1)
            arr_time = dep_time + timedelta(hours=duty_hours - 2)
            
            segment = FlightSegment(
                flight_number=f'QR{duty_count:03d}',
                departure_airport=origin,
                arrival_airport=dest,
                scheduled_departure_utc=dep_time,
                scheduled_arrival_utc=arr_time
            )
            
            duty = Duty(
                duty_id=f'duty_{duty_count}',
                date=current_date,
                report_time_utc=report_time,
                release_time_utc=release_time,
                segments=[segment],
                home_base_timezone='Asia/Qatar'
            )
            
            duties.append(duty)
            current_date += timedelta(days=1)
        
        # 2 days off
        current_date += timedelta(days=2)
    
    roster = Roster(
        roster_id='test_monthly',
        pilot_id='test_pilot',
        month='2025-02',
        home_base_timezone='Asia/Qatar',
        pilot_base='DOH',
        duties=duties,
        initial_sleep_debt=0.0
    )
    
    return roster

def analyze_sleep_efficiency():
    """Analyze sleep efficiency values and their impact"""
    
    print("=" * 80)
    print("SLEEP EFFICIENCY & DEBT ACCUMULATION ANALYSIS")
    print("=" * 80)
    print()
    
    model = BorbelyFatigueModel(ModelConfig.default_easa_config())
    
    print("CURRENT EFFICIENCY VALUES:")
    print("-" * 80)
    print(f"{'Location':<20} {'Base Efficiency':>15} {'After Penalties':>15}")
    print("-" * 80)
    
    # Show current values
    for location, efficiency in model.sleep_calculator.LOCATION_EFFICIENCY.items():
        # Calculate with typical penalties
        # Assume good WOCL alignment (0.97), normal timing (1.0), no pressure (1.0)
        typical_combined = efficiency * 0.97 * 1.0 * 1.0 * 1.0
        print(f"{location:<20} {efficiency:>14.1%} {typical_combined:>14.1%}")
    
    print()
    print("TYPICAL SLEEP SCENARIOS:")
    print("-" * 80)
    
    # Example calculations
    scenarios = [
        ("Home, 8h, ideal", 'home', 8.0, 0.97),
        ("Home, 7h, some pressure", 'home', 7.0, 0.93),
        ("Hotel, 8h, good", 'hotel', 8.0, 0.90),
        ("Hotel, 7h, early wake", 'hotel', 7.0, 0.88),
        ("Airport hotel, 6h", 'airport_hotel', 6.0, 0.88),
    ]
    
    print(f"{'Scenario':<30} {'Duration':>10} {'Efficiency':>12} {'Effective':>12} {'Deficit':>10}")
    print("-" * 80)
    
    for scenario_name, location, duration, combined_factors in scenarios:
        base_eff = model.sleep_calculator.LOCATION_EFFICIENCY.get(location, 0.85)
        total_eff = base_eff * combined_factors
        effective = duration * total_eff
        deficit = 8.0 - effective
        
        print(f"{scenario_name:<30} {duration:>9.1f}h {total_eff:>11.1%} {effective:>11.1f}h {deficit:>9.1f}h")
    
    print()
    print("=" * 80)
    print("MONTHLY DEBT ACCUMULATION SIMULATION")
    print("=" * 80)
    print()
    
    roster = create_monthly_roster()
    print(f"Simulating {len(roster.duties)} duties over 28 days")
    print(f"Pattern: 3 days on, 2 days off (typical airline pattern)")
    print()
    
    # Run simulation
    analysis = model.simulate_roster(roster)
    
    print("SLEEP DEBT PROGRESSION:")
    print("-" * 80)
    print(f"{'Day':>5} {'Duty ID':<15} {'Type':<15} {'Sleep Obtained':>15} {'Debt':>12}")
    print("-" * 80)
    
    day_count = 1
    for timeline in analysis.duty_timelines:
        duty_type = "Early" if timeline.timeline[0].timestamp_local.hour < 7 else \
                    "Late" if timeline.timeline[0].timestamp_local.hour > 19 else "Normal"
        
        # Get sleep info from strategy
        sleep_info = "N/A"
        if timeline.sleep_strategy_type:
            if timeline.sleep_quality_data:
                effective = timeline.sleep_quality_data.get('effective_sleep_hours', 0)
                sleep_info = f"{effective:.1f}h effective"
        
        print(f"{day_count:>5} {timeline.duty_id:<15} {duty_type:<15} {sleep_info:>15} {timeline.cumulative_sleep_debt:>11.1f}h")
        day_count += 1
    
    print("-" * 80)
    print(f"FINAL SLEEP DEBT: {analysis.duty_timelines[-1].cumulative_sleep_debt:.1f} hours")
    print()
    
    # Calculate average effective sleep
    total_effective = 0
    count = 0
    for timeline in analysis.duty_timelines:
        if timeline.sleep_quality_data:
            total_effective += timeline.sleep_quality_data.get('effective_sleep_hours', 0)
            count += 1
    
    avg_effective = total_effective / count if count > 0 else 0
    
    print("ANALYSIS:")
    print("-" * 80)
    print(f"Average effective sleep per duty: {avg_effective:.2f}h")
    print(f"Baseline need per day: {model.params.baseline_sleep_need_hours:.1f}h")
    print(f"Daily deficit (avg): {model.params.baseline_sleep_need_hours - avg_effective:.2f}h")
    print(f"Expected monthly accumulation: {(model.params.baseline_sleep_need_hours - avg_effective) * len(roster.duties):.1f}h")
    print(f"Actual monthly accumulation: {analysis.duty_timelines[-1].cumulative_sleep_debt:.1f}h")
    print()
    
    print("KEY ISSUES IDENTIFIED:")
    print("-" * 80)
    
    if avg_effective < 6.5:
        print("⚠️  CRITICAL: Average effective sleep < 6.5h (insufficient for recovery)")
    elif avg_effective < 7.0:
        print("⚠️  WARNING: Average effective sleep < 7h (marginal recovery)")
    else:
        print("✓ Average effective sleep adequate")
    
    if analysis.duty_timelines[-1].cumulative_sleep_debt > 10:
        print("⚠️  CRITICAL: Sleep debt > 10h by month end (unsustainable)")
    elif analysis.duty_timelines[-1].cumulative_sleep_debt > 5:
        print("⚠️  WARNING: Sleep debt > 5h by month end (concerning)")
    else:
        print("✓ Sleep debt within acceptable range")
    
    print()
    print("ROOT CAUSES:")
    print("-" * 80)
    print("1. Sleep debt calculated using RAW duration vs 8h need")
    print("2. But Process S calculated using EFFECTIVE hours (quality-adjusted)")
    print("3. This creates asymmetry: penalties applied to recovery, not to need")
    print("4. Efficiency penalties compound: base × WOCL × timing × pressure × duration")
    print("5. Result: Even 8h RAW sleep may only give 6-7h effective recovery")
    print()

if __name__ == '__main__':
    analyze_sleep_efficiency()
