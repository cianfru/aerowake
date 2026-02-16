"""
Aviation Workload Model
=====================

Workload estimation for flight operations based on duty characteristics.

References: Aviation workload research
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import pytz

from models.data_models import Duty, FlightSegment, FlightPhase

@dataclass
class WorkloadParameters:
    """
    Workload multipliers derived from aviation research
    References: Bourgeois-Bougrine et al. (2003), Cabon et al. (1993), Gander et al. (1994)
    """
    
    WORKLOAD_MULTIPLIERS: Dict[FlightPhase, float] = field(default_factory=lambda: {
        FlightPhase.PREFLIGHT: 1.1,
        FlightPhase.TAXI_OUT: 1.0,
        FlightPhase.TAKEOFF: 1.8,
        FlightPhase.CLIMB: 1.3,
        FlightPhase.CRUISE: 0.8,
        FlightPhase.DESCENT: 1.2,
        FlightPhase.APPROACH: 1.5,
        FlightPhase.LANDING: 2.0,
        FlightPhase.TAXI_IN: 1.0,
        FlightPhase.GROUND_TURNAROUND: 1.2,
    })
    
    SECTOR_PENALTY_RATE: float = 0.15  # 15% per additional sector
    RECOVERY_THRESHOLD_HOURS: float = 2.0
    TURNAROUND_RECOVERY_RATE: float = 0.3


class WorkloadModel:
    """Integrates aviation workload into fatigue model"""
    
    def __init__(self, params: WorkloadParameters = None):
        self.params = params or WorkloadParameters()
    
    def get_phase_multiplier(self, phase: FlightPhase) -> float:
        return self.params.WORKLOAD_MULTIPLIERS.get(phase, 1.0)
    
    def get_sector_multiplier(self, sector_number: int) -> float:
        return 1.0 + (sector_number - 1) * self.params.SECTOR_PENALTY_RATE
    
    def get_combined_multiplier(self, phase: FlightPhase, sector_number: int) -> float:
        return self.get_phase_multiplier(phase) * self.get_sector_multiplier(sector_number)