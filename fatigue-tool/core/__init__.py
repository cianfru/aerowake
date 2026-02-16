"""
Core Fatigue Model Components
============================

Main exports for the Borbély Two-Process Fatigue Model.
"""

from core.parameters import (
    EASAFatigueFramework,
    BorbelyParameters,
    SleepQualityParameters,
    AdaptationRates,
    RiskThresholds,
    ModelConfig
)

from core.sleep_quality import SleepQualityAnalysis, SleepQualityEngine
from core.sleep_calculator import (
    SleepStrategy,
    UnifiedSleepCalculator
)
from core.strategy_references import get_confidence_basis, get_strategy_references

from core.compliance import EASAComplianceValidator
from core.workload import WorkloadParameters, WorkloadModel
from core.fatigue_model import BorbelyFatigueModel

from core.extended_operations import (
    AugmentedFDPParameters,
    ULRParameters,
    AcclimatizationCalculator,
    AugmentedCrewRestPlanner,
    ULRRestPlanner,
    ULRComplianceValidator,
)

__all__ = [
    # Parameters
    'EASAFatigueFramework',
    'BorbelyParameters',
    'SleepQualityParameters',
    'AdaptationRates',
    'RiskThresholds',
    'ModelConfig',
    # Sleep calculation
    'SleepQualityAnalysis',
    'SleepStrategy',
    'UnifiedSleepCalculator',
    # Compliance & Workload
    'EASAComplianceValidator',
    'WorkloadParameters',
    'WorkloadModel',
    # Main model
    'BorbelyFatigueModel',
    # Extended operations (ULR / Augmented crew)
    'AugmentedFDPParameters',
    'ULRParameters',
    'AcclimatizationCalculator',
    'AugmentedCrewRestPlanner',
    'ULRRestPlanner',
    'ULRComplianceValidator',
]
