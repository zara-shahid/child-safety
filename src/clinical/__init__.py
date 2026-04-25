"""
EPCID Clinical Scoring Module

Evidence-based clinical scoring systems for pediatric risk assessment:
- Phoenix Sepsis Score (2024 JAMA criteria)
- Pediatric Early Warning Score (PEWS)
- Physical Exam Signs Assessment
- Age-adjusted vital sign normalization
"""

from .pews import PEWSCalculator, PEWSScore
from .phoenix_score import PhoenixScore, PhoenixScoreCalculator
from .physical_exam import PhysicalExamAssessment
from .vital_signs import AgeAdjustedVitals, VitalSignNormalizer

__all__ = [
    "PhoenixScoreCalculator",
    "PhoenixScore",
    "PEWSCalculator",
    "PEWSScore",
    "PhysicalExamAssessment",
    "VitalSignNormalizer",
    "AgeAdjustedVitals",
]
