"""
EPCID - Early Pediatric Critical Illness Detection Platform

An agentic AI platform for clinical decision support and care navigation
in pediatric health screening.

This system:
- Aggregates multimodal health signals (symptoms, vitals, images, voice, environment)
- Provides risk stratification using rules and ML ensemble
- Delivers care navigation with validated medical guidelines
- Does NOT diagnose or replace clinical judgment

Safety First | Uncertainty Aware | Always Escalate
"""

__version__ = "0.1.0"
__author__ = "Ayesha-Ali676"
__license__ = "MIT"

from typing import Final

# Risk Tier Constants
RISK_LOW: Final[str] = "LOW"
RISK_MODERATE: Final[str] = "MODERATE"
RISK_HIGH: Final[str] = "HIGH"
RISK_CRITICAL: Final[str] = "CRITICAL"

RISK_TIERS: Final[tuple] = (RISK_LOW, RISK_MODERATE, RISK_HIGH, RISK_CRITICAL)

# Safety Messages
EMERGENCY_DISCLAIMER: Final[str] = (
    "⚠️ This is not a substitute for emergency medical care. "
    "If you believe your child is experiencing a medical emergency, "
    "call 911 or go to the nearest emergency room immediately."
)

NOT_A_DIAGNOSIS: Final[str] = (
    "This assessment is for informational purposes only and does not "
    "constitute a medical diagnosis. Always consult with a qualified "
    "healthcare provider for medical advice."
)
