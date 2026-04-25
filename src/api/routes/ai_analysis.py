"""
EPCID AI Analysis Routes — Powered by Vertex AI

This module provides AI-powered clinical analysis endpoints using
Google Cloud Vertex AI with Gemini 2.5 Flash model.

Demonstrates enterprise-grade Google Cloud integration for the
Gemini Live Agent Challenge hackathon.
"""

import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai", tags=["AI Analysis (Vertex AI)"])


# ============== Request/Response Models ==============


class AISymptomAnalysisRequest(BaseModel):
    """Request for AI-powered symptom analysis."""

    child_age_years: float = Field(..., ge=0, le=18, description="Child's age in years")
    symptoms: list[str] = Field(..., min_length=1, description="List of symptoms")
    vitals: dict[str, float] | None = Field(
        None,
        description="Optional vital signs (temperature, heart_rate, respiratory_rate, oxygen_saturation)",
    )
    additional_context: str | None = Field(None, description="Additional notes or context")


class ClinicalScores(BaseModel):
    """Clinical risk scores."""

    pews_estimate: str = Field(..., description="Pediatric Early Warning Score estimate")
    sepsis_risk: str = Field(..., description="Sepsis risk level")


class AISymptomAnalysisResponse(BaseModel):
    """Response from AI-powered symptom analysis."""

    id: str
    timestamp: datetime
    urgency: str = Field(..., description="low, moderate, high, or critical")
    confidence: float = Field(..., ge=0, le=1)
    recommendation: str
    reasoning: str
    home_care_tips: list[str]
    warning_signs_to_watch: list[str]
    when_to_seek_care: str
    possible_conditions: list[str]
    clinical_scores: ClinicalScores
    provider: str = Field(..., description="AI provider used (vertex_ai or fallback)")
    model: str = Field(..., description="Model used for analysis")
    disclaimers: list[str]


class AICareAdviceRequest(BaseModel):
    """Request for AI-generated care advice."""

    condition: str = Field(..., description="Condition to get advice for (e.g., fever, cough)")
    child_age_years: float = Field(..., ge=0, le=18)
    severity: str = Field("mild", description="mild, moderate, or severe")


class AICareAdviceResponse(BaseModel):
    """Response with AI-generated care advice."""

    id: str
    timestamp: datetime
    condition: str
    overview: str
    care_instructions: list[str]
    medication_guidance: dict[str, Any]
    hydration_tips: list[str]
    comfort_measures: list[str]
    when_to_worry: list[str]
    expected_duration: str
    sources: list[str]
    provider: str
    disclaimers: list[str]


class AIStatusResponse(BaseModel):
    """Response showing AI service status."""

    vertex_ai_available: bool
    model: str | None
    project_id: str | None
    location: str
    fallback_available: bool
    message: str


# ============== Endpoints ==============


@router.get("/status", response_model=AIStatusResponse)
async def get_ai_status(request: Request) -> AIStatusResponse:
    """
    Check AI service status.

    Returns information about Vertex AI availability and configuration.
    This endpoint is useful for debugging and demonstrating GCP integration.
    """
    vertex_available = getattr(request.app.state, "vertex_ai_available", False)
    vertex_service = getattr(request.app.state, "vertex_ai", None)

    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")

    if vertex_available:
        message = "Vertex AI is active and ready for AI-powered analysis"
    elif vertex_service is not None:
        message = "Vertex AI SDK installed but not initialized (may need GCP credentials)"
    else:
        message = "Running with fallback rule-based analysis (Vertex AI not available)"

    return AIStatusResponse(
        vertex_ai_available=vertex_available,
        model="gemini-2.5-flash-preview-05-20" if vertex_available else None,
        project_id=project_id,
        location="us-central1",
        fallback_available=True,
        message=message,
    )


@router.post("/analyze-symptoms", response_model=AISymptomAnalysisResponse)
async def analyze_symptoms_with_ai(
    request_body: AISymptomAnalysisRequest,
    request: Request,
) -> AISymptomAnalysisResponse:
    """
    Analyze symptoms using Vertex AI Gemini.

    This endpoint uses Google Cloud Vertex AI with the Gemini 2.5 Flash model
    to provide intelligent symptom analysis with:
    - Urgency assessment (4-tier triage)
    - Clinical reasoning
    - Age-appropriate recommendations
    - PEWS and sepsis risk estimates

    Falls back to rule-based analysis if Vertex AI is unavailable.

    **Google Cloud Integration:**
    - Uses Vertex AI Gemini API
    - IAM-authenticated (no API keys in code)
    - Runs on Cloud Run
    """
    analysis_id = f"ai-{uuid4().hex[:8]}"
    timestamp = datetime.now(tz=timezone.utc)  # noqa: UP017

    # Get Vertex AI service
    vertex_service = getattr(request.app.state, "vertex_ai", None)
    vertex_available = getattr(request.app.state, "vertex_ai_available", False)

    disclaimers = [
        "This AI analysis is for informational purposes only and is NOT a medical diagnosis.",
        "Always consult a healthcare provider for medical advice.",
        "If you believe your child is experiencing a medical emergency, call 911 immediately.",
        "AI-powered by Google Cloud Vertex AI with Gemini 2.5 Flash.",
    ]

    # Try Vertex AI first
    if vertex_available and vertex_service:
        try:
            result = await vertex_service.analyze_symptoms(
                symptoms=request_body.symptoms,
                child_age_years=request_body.child_age_years,
                vitals=request_body.vitals,
                additional_context=request_body.additional_context,
            )

            return AISymptomAnalysisResponse(
                id=analysis_id,
                timestamp=timestamp,
                urgency=result.get("urgency", "moderate"),
                confidence=result.get("confidence", 0.8),
                recommendation=result.get("recommendation", "Please consult your pediatrician."),
                reasoning=result.get("reasoning", "AI analysis completed."),
                home_care_tips=result.get("homeCareTips", []),
                warning_signs_to_watch=result.get("warningSignsToWatch", []),
                when_to_seek_care=result.get("whenToSeekCare", "If symptoms worsen."),
                possible_conditions=result.get("possibleConditions", []),
                clinical_scores=ClinicalScores(
                    pews_estimate=result.get("clinicalScores", {}).get("pewsEstimate", "unknown"),
                    sepsis_risk=result.get("clinicalScores", {}).get("sepsisRisk", "unknown"),
                ),
                provider=result.get("provider", "vertex_ai"),
                model=result.get("model", "gemini-2.5-flash-preview-05-20"),
                disclaimers=disclaimers,
            )

        except Exception as e:
            # Log error and fall through to fallback
            import logging

            logging.error(f"Vertex AI analysis failed: {e}")

    # Fallback: Rule-based analysis
    return _fallback_symptom_analysis(
        analysis_id=analysis_id,
        timestamp=timestamp,
        symptoms=request_body.symptoms,
        child_age_years=request_body.child_age_years,
        vitals=request_body.vitals,
        disclaimers=disclaimers,
    )


@router.post("/care-advice", response_model=AICareAdviceResponse)
async def get_ai_care_advice(
    request_body: AICareAdviceRequest,
    request: Request,
) -> AICareAdviceResponse:
    """
    Get AI-generated care advice for a specific condition.

    Uses Vertex AI Gemini to generate personalized care advice based on:
    - The specific condition
    - Child's age
    - Severity level

    Returns detailed home care instructions, medication guidance,
    and warning signs to watch.
    """
    advice_id = f"advice-{uuid4().hex[:8]}"
    timestamp = datetime.now(tz=timezone.utc)  # noqa: UP017

    vertex_service = getattr(request.app.state, "vertex_ai", None)
    vertex_available = getattr(request.app.state, "vertex_ai_available", False)

    disclaimers = [
        "This advice is for informational purposes only.",
        "Always follow your healthcare provider's specific instructions.",
        "If symptoms worsen or you're concerned, contact your doctor.",
    ]

    # Try Vertex AI
    if vertex_available and vertex_service:
        try:
            result = await vertex_service.generate_care_advice(
                condition=request_body.condition,
                child_age_years=request_body.child_age_years,
                severity=request_body.severity,
            )

            if "error" not in result:
                return AICareAdviceResponse(
                    id=advice_id,
                    timestamp=timestamp,
                    condition=request_body.condition,
                    overview=result.get("overview", f"Care advice for {request_body.condition}"),
                    care_instructions=result.get("careInstructions", []),
                    medication_guidance=result.get("medicationGuidance", {}),
                    hydration_tips=result.get("hydrationTips", []),
                    comfort_measures=result.get("comfortMeasures", []),
                    when_to_worry=result.get("whenToWorry", []),
                    expected_duration=result.get("expectedDuration", "Varies"),
                    sources=result.get("sources", ["AAP", "CDC"]),
                    provider="vertex_ai",
                    disclaimers=disclaimers,
                )
        except Exception:
            pass

    # Fallback care advice
    return _fallback_care_advice(
        advice_id=advice_id,
        timestamp=timestamp,
        condition=request_body.condition,
        child_age_years=request_body.child_age_years,
        severity=request_body.severity,
        disclaimers=disclaimers,
    )


# ============== Fallback Functions ==============


def _fallback_symptom_analysis(
    analysis_id: str,
    timestamp: datetime,
    symptoms: list[str],
    child_age_years: float,
    vitals: dict | None,
    disclaimers: list[str],
) -> AISymptomAnalysisResponse:
    """Provide rule-based fallback analysis."""

    symptoms_lower = " ".join(symptoms).lower()

    # Emergency detection
    emergency_keywords = [
        "not breathing",
        "difficulty breathing",
        "blue lips",
        "seizure",
        "unresponsive",
        "unconscious",
        "stiff neck",
        "purple spots",
    ]

    is_emergency = any(kw in symptoms_lower for kw in emergency_keywords)
    is_infant = child_age_years < 0.25
    has_fever = "fever" in symptoms_lower

    # Check vitals for high fever
    high_fever = False
    if vitals and vitals.get("temperature"):
        high_fever = vitals["temperature"] >= 104.0

    # Determine urgency
    if is_emergency:
        urgency = "critical"
        recommendation = "EMERGENCY: Call 911 immediately. These symptoms may indicate a life-threatening condition."
        pews = "high"
        sepsis_risk = "high"
    elif (is_infant and has_fever) or high_fever:
        urgency = "critical" if is_infant else "high"
        recommendation = "Seek immediate medical attention. Fever in infants under 3 months or very high fever requires urgent evaluation."
        pews = "high" if is_infant else "moderate"
        sepsis_risk = "moderate"
    elif has_fever or len(symptoms) >= 3:
        urgency = "moderate"
        recommendation = "Contact your pediatrician for evaluation. Monitor symptoms closely."
        pews = "moderate"
        sepsis_risk = "low"
    else:
        urgency = "low"
        recommendation = "These symptoms can likely be managed at home. Monitor for any worsening."
        pews = "low"
        sepsis_risk = "low"

    return AISymptomAnalysisResponse(
        id=analysis_id,
        timestamp=timestamp,
        urgency=urgency,
        confidence=0.65,
        recommendation=recommendation,
        reasoning="Rule-based analysis (Vertex AI unavailable). Conservative assessment applied.",
        home_care_tips=[
            "Keep child comfortable and rested",
            "Ensure adequate fluid intake",
            "Monitor temperature regularly",
            "Note any changes in symptoms",
        ],
        warning_signs_to_watch=[
            "Difficulty breathing or rapid breathing",
            "Refusal to drink fluids",
            "Unusual drowsiness or irritability",
            "Rash that doesn't fade when pressed",
            "High fever (>104°F) or fever lasting >3 days",
        ],
        when_to_seek_care="If symptoms worsen, new symptoms develop, or you're concerned about your child's condition.",
        possible_conditions=[],
        clinical_scores=ClinicalScores(
            pews_estimate=pews,
            sepsis_risk=sepsis_risk,
        ),
        provider="fallback",
        model="rule_based_v1",
        disclaimers=disclaimers,
    )


def _fallback_care_advice(
    advice_id: str,
    timestamp: datetime,
    condition: str,
    child_age_years: float,
    severity: str,
    disclaimers: list[str],
) -> AICareAdviceResponse:
    """Provide fallback care advice."""

    # Generic care advice
    care_instructions = [
        "Rest and plenty of fluids",
        "Monitor symptoms closely",
        "Keep a symptom diary",
        "Maintain comfortable room temperature",
    ]

    medication_guidance = {
        "appropriate": ["Acetaminophen (Tylenol)", "Ibuprofen (if >6 months)"],
        "avoid": ["Aspirin (risk of Reye's syndrome in children)"],
        "notes": "Follow package directions for age/weight-appropriate dosing",
    }

    return AICareAdviceResponse(
        id=advice_id,
        timestamp=timestamp,
        condition=condition,
        overview=f"General care guidance for {condition} in a {child_age_years:.1f}-year-old.",
        care_instructions=care_instructions,
        medication_guidance=medication_guidance,
        hydration_tips=[
            "Offer small, frequent sips of water or clear fluids",
            "Popsicles and ice chips can help",
            "Avoid sugary drinks",
        ],
        comfort_measures=[
            "Keep room cool and comfortable",
            "Use light clothing and blankets",
            "Offer favorite comfort items",
        ],
        when_to_worry=[
            "Symptoms getting worse instead of better",
            "New symptoms appearing",
            "Signs of dehydration (dry mouth, no tears, reduced urination)",
            "Child is unusually sleepy or irritable",
        ],
        expected_duration="Most mild illnesses improve within 3-7 days",
        sources=["AAP", "CDC", "General pediatric guidelines"],
        provider="fallback",
        disclaimers=disclaimers,
    )
