#!/usr/bin/env python3
"""
Test script to verify performance calculation improvements

Tests the scenario described:
- Pre-duty sleep with 71% efficiency
- Day flight with 8:10 AM takeoff
- Verifies the model retains its morning circadian upswing
"""

from datetime import datetime, timedelta
import pytz
from core import BorbelyFatigueModel, ModelConfig
from models.data_models import Duty, FlightSegment, Airport, SleepBlock, Roster

def test_performance_improvements():
    """Test the improved performance calculations"""
    
    
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
    
    
    # Simulate the duty
    timeline = model.simulate_duty(
        duty=duty,
        sleep_history=[pre_duty_sleep],
        circadian_phase_shift=0.0,
        initial_s=0.3
    )
    
    # A morning circadian upswing can improve alertness despite elapsed duty time.
    # This is a behavior regression, not a claim of acceptable operational performance.
    points = [p for p in timeline.timeline if not p.is_in_rest]
    assert points
    assert points[-1].raw_performance > points[0].raw_performance
    assert all(20 <= p.raw_performance <= 100 for p in points)
    assert timeline.landing_performance is not None
