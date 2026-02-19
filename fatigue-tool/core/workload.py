"""
Aviation Workload Model
=====================

Workload estimation for flight operations and training duties.

References:
    Flight phases: Bourgeois-Bougrine et al. (2003), Cabon et al. (1993), Gander et al. (1994)
    Training workload: Fuentes-Garcia et al. (2021), Hamann & Carstengerdes (2023)
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

    # Training duty workload multipliers
    # BAM doesn't differentiate duty types, but SAFTE-FAST allows operator-
    # configured weights. These values reflect available scientific literature:
    #
    # Simulator (1.3): High cognitive load — checks, assessments, emergency
    #   scenarios. But ~32% lower physiological stress vs real flight (heart rate
    #   70.83 vs 93.81 bpm, Fuentes-Garcia et al. 2021). Subjective fatigue
    #   increases linearly during sessions (Hamann & Carstengerdes 2023).
    #   Weighted average of flight phase multipliers is ~1.3 (excl. takeoff/landing
    #   peaks), which matches simulator cognitive intensity without physical stress.
    #
    # Ground training (0.7): Passive cognitive engagement — classroom lectures,
    #   briefings, e-learning. No motor demands, no monitoring workload. Similar
    #   to a long meeting. CRUISE phase (0.8) minus the vigilance requirement.
    TRAINING_WORKLOAD: Dict[str, float] = field(default_factory=lambda: {
        'simulator': 1.3,
        'ground_training': 0.7,
    })


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

    def get_training_multiplier(self, duty_type_value: str) -> float:
        """
        Get flat workload multiplier for training duties.

        Training duties don't have flight phases — they use a single constant
        multiplier for the entire duration of the duty period.

        Args:
            duty_type_value: DutyType enum value ('simulator' or 'ground_training')

        Returns:
            Workload multiplier (default 1.0 if type unknown)
        """
        return self.params.TRAINING_WORKLOAD.get(duty_type_value, 1.0)
