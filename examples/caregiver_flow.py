# ruff: noqa: E402
"""
EPCID Caregiver Flow Example

Demonstrates a complete workflow from symptom entry to care guidance:
1. Caregiver enters symptoms and basic information
2. System ingests and normalizes data
3. Clinical phenotypes are derived
4. Risk assessment is performed
5. Guidelines are retrieved
6. Care guidance is generated

This example shows how the agents work together to provide
safe, explainable clinical decision support.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("epcid.example.caregiver")

# Import EPCID components
from src.agents.escalation_agent import EscalationAgent
from src.agents.guideline_rag_agent import GuidelineRAGAgent
from src.agents.ingestion_agent import IngestionAgent
from src.agents.phenotype_agent import PhenotypeAgent
from src.agents.risk_agent import RiskAgent
from src.core.memory import Memory
from src.core.reasoning import ReasoningEngine
from src.utils.explainability import ExplanationGenerator


async def caregiver_symptom_check(
    input_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Complete caregiver symptom check workflow.

    Args:
        input_data: Dict containing:
            - child_id: Unique identifier for the child
            - demographics: Age, weight, etc.
            - symptoms: List of symptoms
            - vitals: Temperature, etc.
            - medications: Current medications (optional)
            - symptom_duration: How long symptoms have been present

    Returns:
        Complete assessment with guidance
    """
    logger.info("Starting caregiver symptom check workflow")

    # Initialize shared components
    memory = Memory()
    reasoning_engine = ReasoningEngine()
    explainer = ExplanationGenerator()

    # Initialize agents
    ingestion_agent = IngestionAgent(memory=memory, reasoning_engine=reasoning_engine)
    phenotype_agent = PhenotypeAgent(memory=memory, reasoning_engine=reasoning_engine)
    risk_agent = RiskAgent(memory=memory, reasoning_engine=reasoning_engine)
    guideline_agent = GuidelineRAGAgent(memory=memory, reasoning_engine=reasoning_engine)
    escalation_agent = EscalationAgent(memory=memory, reasoning_engine=reasoning_engine)

    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "child_id": input_data.get("child_id"),
        "stages": {},
    }

    # =====================================
    # Stage 1: Ingest and normalize data
    # =====================================
    logger.info("Stage 1: Data ingestion and normalization")

    ingestion_response = await ingestion_agent.run(input_data)
    results["stages"]["ingestion"] = {
        "status": ingestion_response.status.value,
        "quality_score": ingestion_response.data.get("quality_score"),
        "warnings": ingestion_response.warnings,
    }

    if not ingestion_response.success:
        logger.error("Ingestion failed")
        results["error"] = "Data ingestion failed"
        return results

    normalized_data = ingestion_response.data.get("normalized", {})

    # =====================================
    # Stage 2: Derive clinical phenotypes
    # =====================================
    logger.info("Stage 2: Deriving clinical phenotypes")

    phenotype_input = {
        "normalized": normalized_data,
    }

    phenotype_response = await phenotype_agent.run(phenotype_input)
    results["stages"]["phenotypes"] = {
        "status": phenotype_response.status.value,
        "phenotype_count": phenotype_response.data.get("phenotype_count"),
        "clinical_state": phenotype_response.data.get("clinical_state"),
        "severe_phenotypes": phenotype_response.data.get("severe_phenotypes"),
    }

    phenotypes = phenotype_response.data.get("phenotypes", [])

    # =====================================
    # Stage 3: Risk stratification
    # =====================================
    logger.info("Stage 3: Risk assessment")

    risk_input = {
        "normalized": normalized_data,
        "phenotypes": phenotypes,
    }

    risk_response = await risk_agent.run(risk_input)
    results["stages"]["risk"] = {
        "status": risk_response.status.value,
        "risk_tier": risk_response.data.get("risk_tier"),
        "risk_score": risk_response.data.get("risk_score"),
        "confidence": risk_response.data.get("confidence"),
        "triggered_rules": risk_response.data.get("triggered_rules"),
        "risk_factors": risk_response.data.get("risk_factors"),
    }

    risk_tier = risk_response.data.get("risk_tier", "LOW")

    # =====================================
    # Stage 4: Retrieve guidelines
    # =====================================
    logger.info("Stage 4: Retrieving guidelines")

    guideline_input = {
        "symptoms": normalized_data.get("symptoms", []),
        "demographics": normalized_data.get("demographics", {}),
        "risk_tier": risk_tier,
    }

    guideline_response = await guideline_agent.run(guideline_input)
    results["stages"]["guidelines"] = {
        "status": guideline_response.status.value,
        "result_count": guideline_response.data.get("result_count"),
        "citations": guideline_response.data.get("citations"),
    }

    # =====================================
    # Stage 5: Generate care guidance
    # =====================================
    logger.info("Stage 5: Generating care guidance")

    escalation_input = {
        "risk_tier": risk_tier,
        "symptoms": normalized_data.get("symptoms", []),
        "vitals": normalized_data.get("vitals", {}),
        "medications": normalized_data.get("medications", []),
        "demographics": normalized_data.get("demographics", {}),
    }

    escalation_response = await escalation_agent.run(
        escalation_input,
        context={"risk_assessment": risk_response.data},
    )
    results["stages"]["escalation"] = {
        "status": escalation_response.status.value,
        "escalation_type": escalation_response.data.get("escalation_type"),
        "urgency": escalation_response.data.get("urgency"),
        "primary_action": escalation_response.data.get("primary_action"),
    }

    # =====================================
    # Generate final explanation
    # =====================================
    logger.info("Generating final explanation")

    explanation = explainer.explain_risk_assessment(
        risk_tier=risk_tier,
        confidence=risk_response.data.get("confidence", 0.5),
        risk_factors=risk_response.data.get("risk_factors", []),
        protective_factors=risk_response.data.get("protective_factors", []),
        uncertainty_factors=risk_response.data.get("uncertainty_factors", []),
        triggered_rules=risk_response.data.get("triggered_rules", []),
        model_scores=risk_response.data.get("model_scores", {}),
        missing_data=risk_response.data.get("missing_data", []),
    )

    results["assessment"] = {
        "risk_tier": risk_tier,
        "urgency": escalation_response.data.get("urgency"),
        "primary_action": escalation_response.data.get("primary_action"),
        "timeline": escalation_response.data.get("timeline"),
        "guidance": escalation_response.data.get("guidance_message"),
        "explanation": explanation.to_markdown(),
        "checklist": escalation_response.data.get("checklist"),
        "escalation_criteria": escalation_response.data.get("escalation_criteria"),
    }

    logger.info(f"Workflow complete. Risk tier: {risk_tier}")
    return results


# Example usage
async def main():
    """Run example caregiver workflow."""

    # Example 1: Moderate fever with respiratory symptoms
    print("\n" + "=" * 60)
    print("Example 1: Fever with cough")
    print("=" * 60)

    input_data = {
        "child_id": "child-001",
        "demographics": {
            "age_months": 24,  # 2 years old
            "weight_kg": 12,
            "sex": "female",
        },
        "symptoms": [
            "fever",
            "cough",
            "runny_nose",
            "decreased_appetite",
        ],
        "vitals": {
            "temperature": 38.5,  # Celsius
            "heart_rate": 110,
            "respiratory_rate": 28,
        },
        "symptom_duration": "36 hours",
        "medications": [
            {"name": "acetaminophen", "dose": "160mg", "frequency": "every 6 hours"},
        ],
    }

    result = await caregiver_symptom_check(input_data)

    print(f"\nRisk Tier: {result['assessment']['risk_tier']}")
    print(f"Urgency: {result['assessment']['urgency']}")
    print(f"Action: {result['assessment']['primary_action']}")
    print(f"\nExplanation:\n{result['assessment']['explanation'][:500]}...")

    # Example 2: Critical symptoms (infant with fever)
    print("\n" + "=" * 60)
    print("Example 2: Infant with fever (Critical)")
    print("=" * 60)

    critical_input = {
        "child_id": "child-002",
        "demographics": {
            "age_months": 2,  # 2 months old
            "weight_kg": 4.5,
            "sex": "male",
        },
        "symptoms": [
            "fever",
            "irritability",
            "poor_feeding",
        ],
        "vitals": {
            "temperature": 38.2,  # Celsius
            "heart_rate": 160,
            "respiratory_rate": 45,
        },
        "symptom_duration": "4 hours",
    }

    critical_result = await caregiver_symptom_check(critical_input)

    print(f"\nRisk Tier: {critical_result['assessment']['risk_tier']}")
    print(f"Urgency: {critical_result['assessment']['urgency']}")
    print(f"Action: {critical_result['assessment']['primary_action']}")

    # Example 3: Low risk symptoms
    print("\n" + "=" * 60)
    print("Example 3: Mild cold symptoms (Low risk)")
    print("=" * 60)

    low_risk_input = {
        "child_id": "child-003",
        "demographics": {
            "age_months": 48,  # 4 years old
            "weight_kg": 16,
            "sex": "male",
        },
        "symptoms": [
            "runny_nose",
            "sneezing",
            "mild_cough",
        ],
        "vitals": {
            "temperature": 37.2,  # Normal
            "heart_rate": 95,
        },
        "symptom_duration": "2 days",
    }

    low_result = await caregiver_symptom_check(low_risk_input)

    print(f"\nRisk Tier: {low_result['assessment']['risk_tier']}")
    print(f"Urgency: {low_result['assessment']['urgency']}")
    print(f"Action: {low_result['assessment']['primary_action']}")


if __name__ == "__main__":
    asyncio.run(main())
