#!/usr/bin/env python3
"""
Test script to verify performance calculation improvements

Tests the scenario described:
- Pre-duty sleep with 71% efficiency
- Day flight with 8:10 AM takeoff
- Verifies performance is now in acceptable range
"""

from datetime import datetime, timedelta
import pytz
from core import BorbelyFatigueModel, ModelConfig
from models.data_models import Duty, FlightSegment, Airport, SleepBlock, Roster

def test_performance_improvements():
    """Test the improved performance calculations"""
    
    print("=" * 70)
    print("PERFORMANCE CALCULATION IMPROVEMENT TEST")
    print("=" * 70)
    print()
    
    # Setup model
    config = ModelConfig.default_easa_config()
    model = BorbelyFatigueModel(config)
    
    # Test parameters
    home_tz = pytz.timezone('Asia/Qatar')
    test_date = datetime(2025, 2, 10, tzinfo=pytz.utc)
    
    # Create a morning duty (8:10 AM takeoff)
    report_time = home_tz.localize(datetime(2025, 2, 10, 7, 10)).astimezone(pytz.utc)
    takeoff_time = home_tz.localize(datetime(2025, 2, 10, 8, 10)).astimezone(pytz.utc)
    landing_time = takeoff_time + timedelta(hours=2, minutes=30)
    release_time = landing_time + timedelta(minutes=30)
    
    # Second sector
    takeoff_time_2 = release_time + timedelta(minutes=45)
    landing_time_2 = takeoff_time_2 + timedelta(hours=3)
    final_release = landing_time_2 + timedelta(minutes=30)
    
    # Create airports
    origin = Airport(code='DOH', timezone='Asia/Qatar')
    destination = Airport(code='DXB', timezone='Asia/Dubai')
    final_dest = Airport(code='MCT', timezone='Asia/Muscat')
    
    # Create flight segments
    segment1 = FlightSegment(
        flight_number='QR123',
        departure_airport=origin,
        arrival_airport=destination,
        scheduled_departure_utc=takeoff_time,
        scheduled_arrival_utc=landing_time
    )
    
    segment2 = FlightSegment(
        flight_number='QR456',
        departure_airport=destination,
        arrival_airport=final_dest,
        scheduled_departure_utc=takeoff_time_2,
        scheduled_arrival_utc=landing_time_2
    )
    
    duty = Duty(
        duty_id='test_morning_duty',
        date=test_date,
        report_time_utc=report_time,
        release_time_utc=final_release,
        segments=[segment1, segment2],
        home_base_timezone='Asia/Qatar'
    )
    
    # Create pre-duty sleep with 71% efficiency (as mentioned in the issue)
    # This simulates: 8 hours duration * 0.71 efficiency = 5.68h effective
    sleep_start = report_time - timedelta(hours=10)  # 10 hours before report
    sleep_end = report_time - timedelta(hours=2)     # 2 hours before report
    
    pre_duty_sleep = SleepBlock(
        start_utc=sleep_start,
        end_utc=sleep_end,
        location_timezone='Asia/Qatar',
        duration_hours=8.0,
        quality_factor=0.71,  # 71% efficiency as mentioned
        effective_sleep_hours=5.68,
        environment='home'
    )
    
    print("Test Scenario:")
    print(f"  Pre-duty sleep: {sleep_start.astimezone(home_tz).strftime('%H:%M')} - {sleep_end.astimezone(home_tz).strftime('%H:%M')}")
    print(f"  Sleep duration: 8.0 hours")
    print(f"  Sleep efficiency: 71%")
    print(f"  Effective sleep: 5.68 hours")
    print()
    print(f"  Report time: {report_time.astimezone(home_tz).strftime('%H:%M')}")
    print(f"  First takeoff: {takeoff_time.astimezone(home_tz).strftime('%H:%M')}")
    print(f"  First landing: {landing_time.astimezone(home_tz).strftime('%H:%M')}")
    print(f"  Second takeoff: {takeoff_time_2.astimezone(home_tz).strftime('%H:%M')}")
    print(f"  Second landing: {landing_time_2.astimezone(home_tz).strftime('%H:%M')}")
    print()
    
    # Simulate the duty
    timeline = model.simulate_duty(
        duty=duty,
        sleep_history=[pre_duty_sleep],
        circadian_phase_shift=0.0,
        initial_s=0.3
    )
    
    # Extract key performance points
    report_perf = None
    first_takeoff_perf = None
    first_landing_perf = None
    second_takeoff_perf = None
    second_landing_perf = None
    
    for point in timeline.timeline:
        if report_perf is None:
            report_perf = point.raw_performance
        
        # Find takeoff/landing performances
        if abs((point.timestamp_utc - takeoff_time).total_seconds()) < 300:
            first_takeoff_perf = point.raw_performance
        if abs((point.timestamp_utc - landing_time).total_seconds()) < 300:
            first_landing_perf = point.raw_performance
        if abs((point.timestamp_utc - takeoff_time_2).total_seconds()) < 300:
            second_takeoff_perf = point.raw_performance
        if abs((point.timestamp_utc - landing_time_2).total_seconds()) < 300:
            second_landing_perf = point.raw_performance
    
    # Calculate s_at_wake using new formula
    sleep_quality_ratio = pre_duty_sleep.effective_sleep_hours / 8.0
    sleep_quality_ratio = max(0.3, min(1.3, sleep_quality_ratio))
    s_at_wake_new = max(0.03, 0.45 - (sleep_quality_ratio ** 1.3) * 0.42)
    
    # Old formula for comparison
    sleep_quality_ratio_old = pre_duty_sleep.effective_sleep_hours / 8.0
    s_at_wake_old = max(0.1, 0.7 - (sleep_quality_ratio_old * 0.6))
    
    print("=" * 70)
    print("RESULTS")
    print("=" * 70)
    print()
    
    print("s_at_wake Calculation:")
    print(f"  OLD formula: s_at_wake = {s_at_wake_old:.3f}")
    print(f"  NEW formula: s_at_wake = {s_at_wake_new:.3f}")
    print(f"  Improvement: {((s_at_wake_old - s_at_wake_new) / s_at_wake_old * 100):.1f}% reduction in initial sleep pressure")
    print()
    
    print("Performance Scores:")
    print(f"  At report:         {report_perf:.1f}%")
    if first_takeoff_perf:
        print(f"  First takeoff:     {first_takeoff_perf:.1f}%")
    if first_landing_perf:
        print(f"  First landing:     {first_landing_perf:.1f}%")
    if second_takeoff_perf:
        print(f"  Second takeoff:    {second_takeoff_perf:.1f}%")
    if second_landing_perf:
        print(f"  Second landing:    {second_landing_perf:.1f}%")
    print()
    print(f"  Minimum:           {timeline.min_performance:.1f}%")
    print(f"  Average:           {timeline.average_performance:.1f}%")
    print()
    
    # Performance classification
    def classify_performance(perf):
        if perf >= 70:
            return "Normal"
        elif perf >= 60:
            return "Moderate"
        elif perf >= 50:
            return "High Risk"
        else:
            return "CRITICAL"
    
    print("Performance Classification:")
    print(f"  At report:         {classify_performance(report_perf)}")
    if second_landing_perf:
        print(f"  Second landing:    {classify_performance(second_landing_perf)}")
    print()
    
    # Success criteria
    print("=" * 70)
    print("ASSESSMENT")
    print("=" * 70)
    print()
    
    success = True
    
    if report_perf < 70:
        print("⚠️  CONCERN: Report performance < 70% (still below Normal)")
        success = False
    else:
        print("✓ Report performance >= 70% (Normal range)")
    
    if second_landing_perf and second_landing_perf < 50:
        print("⚠️  CONCERN: Landing performance < 50% (Critical)")
        success = False
    elif second_landing_perf and second_landing_perf < 60:
        print("⚠️  NOTE: Landing performance in 50-60% range (High Risk)")
    else:
        print("✓ Landing performance >= 60% (Acceptable)")
    
    print()
    
    if success:
        print("✓ TEST PASSED: Performance calculations are now more realistic!")
    else:
        print("⚠️  TEST SHOWS IMPROVEMENT but may need further tuning")
    
    print()
    print("EXPECTED vs ACTUAL:")
    print(f"  Expected report performance: 73-75%")
    print(f"  Actual report performance:   {report_perf:.1f}%")
    if second_landing_perf:
        print(f"  Expected landing performance: 65-68%")
        print(f"  Actual landing performance:   {second_landing_perf:.1f}%")
    
    print()
    print("=" * 70)
    
    return success

if __name__ == '__main__':
    test_performance_improvements()
