"""
EPCID Agents Module

Specialized agents for pediatric health assessment:
- IngestionAgent: Normalizes multimodal inputs
- PhenotypeAgent: Derives clinical phenotypes
- RiskAgent: Risk stratification with rules + ML
- GuidelineRAGAgent: Retrieves validated guidelines
- MedicationSafetyAgent: Drug safety awareness
- GeoExposureAgent: Environmental exposure analysis
- EscalationAgent: Workflow and care navigation
"""

from .base_agent import AgentConfig, AgentResponse, BaseAgent
from .escalation_agent import EscalationAgent
from .geo_exposure_agent import GeoExposureAgent
from .guideline_rag_agent import GuidelineRAGAgent
from .ingestion_agent import IngestionAgent
from .medication_safety_agent import MedicationSafetyAgent
from .phenotype_agent import PhenotypeAgent
from .risk_agent import RiskAgent

__all__ = [
    "BaseAgent",
    "AgentConfig",
    "AgentResponse",
    "IngestionAgent",
    "PhenotypeAgent",
    "RiskAgent",
    "GuidelineRAGAgent",
    "MedicationSafetyAgent",
    "GeoExposureAgent",
    "EscalationAgent",
]
