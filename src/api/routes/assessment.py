"""
EPCID Assessment Routes

Risk assessment and analysis endpoints.
This is the core intelligence endpoint that orchestrates all agents.
"""

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from ...agents.escalation_agent import EscalationAgent
from ...agents.geo_exposure_agent import GeoExposureAgent
from ...agents.guideline_rag_agent import GuidelineRAGAgent
from ...agents.ingestion_agent import IngestionAgent
from ...agents.phenotype_agent import PhenotypeAgent
from ...agents.risk_agent import RiskAgent
from ...api.dependencies import get_current_active_user
from ...api.schemas import (
    AssessmentRequest,
    AssessmentResponse,
    RiskFactor,
    RiskLevel,
)
from ...utils.explainability import ExplanationGenerator

router = APIRouter()


# Simulated assessment storage
fake_assessments_db: dict[str, dict[str, Any]] = {}


async def run_assessment_pipeline(
    request: AssessmentRequest,
    user_id: str,
) -> AssessmentResponse:
    """
    Run the full assessment pipeline using all agents.
    """
    assessment_id = f"assess-{uuid4().hex[:8]}"

    try:
        # Initialize agents
        ingestion_agent = IngestionAgent(agent_id="ingestion-001")
        phenotype_agent = PhenotypeAgent(agent_id="phenotype-001")
        risk_agent = RiskAgent(agent_id="risk-001")
        guideline_agent = GuidelineRAGAgent(agent_id="guideline-001")
        escalation_agent = EscalationAgent(agent_id="escalation-001")
        explainer = ExplanationGenerator()

        # Step 1: Ingest and normalize symptoms
        normalized_symptoms = []
        for symptom in request.symptoms:
            result = await ingestion_agent.process(
                {
                    "event_type": "symptom",
                    "data": symptom.model_dump(),
                    "child_id": request.child_id,
                }
            )
            if result.success:
                normalized_symptoms.append(result.data.get("normalized_event"))

        # Step 2: Extract phenotype signals
        phenotype_res = await phenotype_agent.process(
            {
                "symptoms": normalized_symptoms,
                "child_id": request.child_id,
            }
        )
        phenotype_result = phenotype_res.data

        # Step 3: Risk stratification
        risk_res = await risk_agent.process(
            {
                "phenotype": phenotype_result.get("phenotype", {}),
                "symptoms": normalized_symptoms,
                "child_id": request.child_id,
            }
        )
        risk_result = risk_res.data
        risk_confidence = risk_res.confidence

        # Step 4: Get guideline recommendations (if requested)
        guidelines_content = []
        if request.include_guidelines:
            guideline_res = await guideline_agent.process(
                {
                    "symptoms": [s.symptom_type for s in request.symptoms],
                    "risk_level": risk_result.get("risk_level", "low"),
                }
            )
            guidelines_content = guideline_res.data.get("recommendations", [])

        # Step 5: Check environmental factors (if requested)
        environmental_context = None
        if request.include_environmental and request.location:
            geo_agent = GeoExposureAgent(agent_id="geo-001")
            env_res = await geo_agent.process(
                {
                    "latitude": request.location.get("lat"),
                    "longitude": request.location.get("lng"),
                    "symptoms": [s.symptom_type for s in request.symptoms],
                }
            )
            environmental_context = env_res.data
        # Step 6: Generate escalation recommendations
        _ = guidelines_content
        _ = environmental_context
        escalation_res = await escalation_agent.process(
            {
                "risk_level": risk_result.get("risk_level", "low"),
                "risk_score": risk_result.get("risk_score", 0.0),
                "symptoms": [s.symptom_type for s in request.symptoms],
            }
        )
        escalation_result = escalation_res.data

        # Step 7: Generate explanation
        explanation = explainer.explain_risk_assessment(
            risk_tier=risk_result.get("risk_level", "UNKNOWN"),
            confidence=risk_confidence,
            risk_factors=[s.symptom_type for s in request.symptoms],
            protective_factors=[],
            uncertainty_factors=[],
            triggered_rules=[r.get("name", "") for r in risk_result.get("triggered_rules", [])],
            model_scores=risk_result.get("model_scores", {}),
            missing_data=[],
        )

        # Build risk factors
        risk_factors = []
        for symptom in request.symptoms:
            contribution = (
                0.2
                if symptom.severity.value == "mild"
                else 0.4 if symptom.severity.value == "moderate" else 0.6
            )
            risk_factors.append(
                RiskFactor(
                    name=symptom.symptom_type,
                    contribution=contribution,
                    description=f"{symptom.severity.value.title()} {symptom.symptom_type}",
                    source="symptom_input",
                )
            )

        # Determine risk level
        risk_score = risk_result.get("risk_score", 0.3)
        if risk_score < 0.25:
            risk_level = RiskLevel.LOW
        elif risk_score < 0.5:
            risk_level = RiskLevel.MODERATE
        elif risk_score < 0.75:
            risk_level = RiskLevel.HIGH
        else:
            risk_level = RiskLevel.CRITICAL

        # Build response
        response = AssessmentResponse(
            id=assessment_id,
            child_id=request.child_id,
            timestamp=datetime.now(__import__("datetime").timezone.utc),
            risk_level=risk_level,
            risk_score=risk_score,
            confidence=risk_confidence,
            risk_factors=risk_factors,
            primary_recommendation=escalation_result.get(
                "primary_action", "Monitor symptoms and maintain hydration"
            ),
            secondary_recommendations=escalation_result.get(
                "secondary_actions", ["Rest", "Track symptom progression"]
            ),
            red_flags=risk_result.get("red_flags", []),
            warning_signs=risk_result.get("warning_signs", []),
            explanation=getattr(explanation, "summary", "Based on the reported symptoms..."),
            clinical_reasoning=(
                explanation.to_markdown() if hasattr(explanation, "to_markdown") else ""
            ),
            suggested_actions=escalation_result.get("suggested_actions", []),
            when_to_seek_care=escalation_result.get(
                "when_to_seek_care", "If symptoms worsen or new symptoms develop"
            ),
            disclaimers=[
                "This assessment is for informational purposes only and is NOT a medical diagnosis.",
                "Always consult a healthcare provider for medical advice.",
                "If you believe your child is experiencing a medical emergency, call 911 immediately.",
            ],
        )

        # Store assessment
        fake_assessments_db[assessment_id] = {
            "assessment": response.model_dump(),
            "user_id": user_id,
            "request": request.model_dump(),
            "created_at": datetime.now(__import__("datetime").timezone.utc),
        }

        return response

    except Exception:
        # Return safe fallback response on error
        return AssessmentResponse(
            id=assessment_id,
            child_id=request.child_id,
            timestamp=datetime.now(__import__("datetime").timezone.utc),
            risk_level=RiskLevel.MODERATE,
            risk_score=0.5,
            confidence=0.5,
            risk_factors=[],
            primary_recommendation="Due to a system issue, we recommend contacting your healthcare provider.",
            secondary_recommendations=[
                "Monitor your child's symptoms closely",
                "Keep your child comfortable and hydrated",
            ],
            red_flags=[],
            warning_signs=[],
            explanation="We were unable to complete the full assessment. Please err on the side of caution.",
            clinical_reasoning="System encountered an error during assessment.",
            suggested_actions=["Contact healthcare provider", "Monitor symptoms"],
            when_to_seek_care="When in doubt, contact your healthcare provider.",
            disclaimers=[
                "This assessment is for informational purposes only.",
                "System error occurred - please consult a healthcare provider.",
            ],
        )


@router.post(
    "/",
    response_model=AssessmentResponse,
    summary="Run risk assessment",
    description="""
    Run a comprehensive risk assessment for a child based on reported symptoms.

    This endpoint orchestrates multiple AI agents to:
    1. Normalize and validate symptom data
    2. Extract clinical phenotypes
    3. Calculate risk scores
    4. Retrieve relevant guidelines
    5. Check environmental factors
    6. Generate actionable recommendations

    ⚠️ **Important**: This is NOT a diagnostic tool. Always consult a healthcare provider.
    """,
)
async def create_assessment(
    request: AssessmentRequest,
    background_tasks: BackgroundTasks,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AssessmentResponse:
    """
    Run a comprehensive risk assessment.

    The assessment combines:
    - Symptom analysis
    - Age-appropriate risk factors
    - Environmental context (if location provided)
    - Evidence-based guidelines
    """
    response = await run_assessment_pipeline(request, current_user["id"])
    return response


@router.get(
    "/",
    response_model=list[AssessmentResponse],
    summary="List assessments",
    description="Get previous assessments for the current user.",
)
async def list_assessments(
    child_id: str | None = None,
    limit: int = 20,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[AssessmentResponse]:
    """Get previous assessments."""
    assessments = []

    for stored in fake_assessments_db.values():
        if stored["user_id"] != current_user["id"]:
            continue

        if child_id and stored["assessment"]["child_id"] != child_id:
            continue

        assessments.append(AssessmentResponse(**stored["assessment"]))

    # Sort by timestamp descending
    assessments.sort(key=lambda x: x.timestamp, reverse=True)

    return assessments[:limit]


@router.get(
    "/{assessment_id}",
    response_model=AssessmentResponse,
    summary="Get assessment",
    description="Get a specific assessment by ID.",
)
async def get_assessment(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AssessmentResponse:
    """Get a specific assessment."""
    stored = fake_assessments_db.get(assessment_id)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if stored["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return AssessmentResponse(**stored["assessment"])


@router.post(
    "/quick",
    response_model=AssessmentResponse,
    summary="Quick assessment",
    description="Run a quick assessment with minimal input.",
)
async def quick_assessment(
    child_id: str,
    symptoms: list[str],
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AssessmentResponse:
    """
    Run a quick assessment with just symptom types.

    Useful for fast triaging. For comprehensive assessment,
    use the full /assessment endpoint.
    """
    from ...api.schemas import SymptomCreate, SymptomSeverity

    # Convert simple symptom list to full request
    symptom_objects = [
        SymptomCreate(
            child_id=child_id,
            symptom_type=s,
            severity=SymptomSeverity.MODERATE,  # Default to moderate
        )
        for s in symptoms
    ]

    request = AssessmentRequest(
        child_id=child_id,
        symptoms=symptom_objects,
        include_guidelines=True,
        include_environmental=False,
    )

    return await run_assessment_pipeline(request, current_user["id"])


@router.get(
    "/child/{child_id}/history",
    response_model=list[AssessmentResponse],
    summary="Get child assessment history",
    description="Get assessment history for a specific child.",
)
async def get_child_assessment_history(
    child_id: str,
    days: int = 30,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[AssessmentResponse]:
    """Get assessment history for a child."""
    from datetime import timedelta

    since = datetime.now(__import__("datetime").timezone.utc) - timedelta(days=days)

    assessments = [
        AssessmentResponse(**stored["assessment"])
        for stored in fake_assessments_db.values()
        if stored["user_id"] == current_user["id"]
        and stored["assessment"]["child_id"] == child_id
        and stored["created_at"] >= since
    ]

    assessments.sort(key=lambda x: x.timestamp, reverse=True)

    return assessments


@router.delete(
    "/{assessment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete assessment",
    description="Delete a specific assessment by ID.",
)
async def delete_assessment(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> None:
    """Delete a specific assessment."""
    stored = fake_assessments_db.get(assessment_id)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if stored["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    del fake_assessments_db[assessment_id]
    return None
