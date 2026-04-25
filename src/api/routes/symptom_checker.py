"""
EPCID Symptom Checker API Routes

Provides endpoints for guided symptom assessment following
the ChildrensMD-style workflow with 4-tier triage output.
"""

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..dependencies import get_current_user

router = APIRouter(prefix="/symptom-checker", tags=["Symptom Checker"])


# ============== Schemas ==============


class TriageLevel(str):
    """Triage level matching ChildrensMD 4-tier output."""

    EMERGENCY_CARE = "emergency_care"
    CALL_NOW = "call_now"
    CALL_24_HOURS = "call_24_hours"
    HOME_CARE = "home_care"


class SymptomInput(BaseModel):
    """Individual symptom input."""

    symptom_id: str
    name: str
    severity: str = Field(..., description="mild, moderate, or severe")
    duration: str = Field(..., description="Duration category")
    notes: str | None = None


class SymptomCheckerStartRequest(BaseModel):
    """Request to start a symptom checker session."""

    child_id: str | None = None
    age_months: int = Field(..., ge=0, le=216)
    sex: str = Field(..., pattern="^(male|female)$")


class SymptomCheckerStartResponse(BaseModel):
    """Response with session ID."""

    session_id: str
    age_months: int
    sex: str
    created_at: datetime
    warnings: list[str] = []


class AddSymptomsRequest(BaseModel):
    """Request to add symptoms to session."""

    session_id: str
    symptoms: list[SymptomInput]


class AddSymptomsResponse(BaseModel):
    """Response after adding symptoms."""

    session_id: str
    symptoms_count: int
    red_flags_detected: list[str] = []
    immediate_escalation: bool = False


class TriageRequest(BaseModel):
    """Request for triage assessment."""

    session_id: str
    additional_context: dict[str, Any] | None = None


class TriageRecommendation(BaseModel):
    """Triage recommendation result."""

    level: str  # emergency_care, call_now, call_24_hours, home_care
    title: str
    description: str
    reasons: list[str]
    recommendations: list[str]
    warning_signs_to_watch: list[str]
    disclaimer: str


class TriageResponse(BaseModel):
    """Full triage response."""

    session_id: str
    triage: TriageRecommendation
    symptoms_assessed: list[SymptomInput]
    assessment_time: datetime
    confidence: float


# ============== In-Memory Session Storage ==============
# In production, use Redis or database

sessions: dict[str, dict[str, Any]] = {}


# ============== Endpoints ==============


@router.post("/start", response_model=SymptomCheckerStartResponse)
async def start_symptom_checker(
    request: SymptomCheckerStartRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> SymptomCheckerStartResponse:
    """
    Start a new symptom checker session.

    Creates a session for collecting and assessing symptoms,
    with age-appropriate warnings and guidance.
    """
    session_id = str(uuid4())

    warnings = []

    # Age-specific warnings
    if request.age_months < 3:
        warnings.append(
            "IMPORTANT: Any fever in an infant under 3 months requires "
            "immediate medical evaluation. Please call your doctor or go to the ER."
        )
    elif request.age_months < 6:
        warnings.append(
            "Note: Infants 3-6 months old need prompt medical attention for "
            "fevers above 101°F (38.3°C)."
        )

    now = datetime.now(__import__("datetime").timezone.utc)
    session = {
        "session_id": session_id,
        "user_id": current_user.get("id"),
        "child_id": request.child_id,
        "age_months": request.age_months,
        "sex": request.sex,
        "created_at": now,
        "symptoms": [],
        "warnings": warnings,
    }

    sessions[session_id] = session

    return SymptomCheckerStartResponse(
        session_id=session_id,
        age_months=request.age_months,
        sex=request.sex,
        created_at=now,
        warnings=warnings,
    )


@router.post("/symptoms", response_model=AddSymptomsResponse)
async def add_symptoms(
    request: AddSymptomsRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> AddSymptomsResponse:
    """
    Add symptoms to an existing session.

    Symptoms are validated and checked for red flags that
    might require immediate escalation.
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Verify user owns session
    if session.get("user_id") != current_user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this session"
        )

    # Add symptoms
    session["symptoms"].extend([s.dict() for s in request.symptoms])

    # Check for red flags
    red_flags = []
    immediate_escalation = False

    critical_symptoms = [
        "unresponsive",
        "seizure",
        "severe_difficulty_breathing",
        "blue_lips",
        "not_breathing",
        "apnea",
        "severe_abdominal_pain",
        "bloody_vomit",
        "currant_jelly_stool",
        "petechiae",
    ]

    for symptom in request.symptoms:
        if symptom.symptom_id in critical_symptoms:
            red_flags.append(f"Critical: {symptom.name}")
            immediate_escalation = True
        elif symptom.severity == "severe":
            red_flags.append(f"Severe: {symptom.name}")

    # Check infant fever
    if session["age_months"] < 3:
        fever_symptoms = ["fever", "high_fever"]
        if any(s.symptom_id in fever_symptoms for s in request.symptoms):
            red_flags.append("Critical: Any fever in infant under 3 months")
            immediate_escalation = True

    return AddSymptomsResponse(
        session_id=request.session_id,
        symptoms_count=len(session["symptoms"]),
        red_flags_detected=red_flags,
        immediate_escalation=immediate_escalation,
    )


@router.post("/triage", response_model=TriageResponse)
async def get_triage(
    request: TriageRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> TriageResponse:
    """
    Get triage recommendation based on collected symptoms.

    Returns a 4-tier triage level (emergency_care, call_now, call_24_hours, home_care)
    with specific recommendations and warning signs to watch.
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session.get("user_id") != current_user.get("id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    symptoms = session["symptoms"]
    age_months = session["age_months"]

    # Calculate triage
    triage = calculate_triage(symptoms, age_months)

    return TriageResponse(
        session_id=request.session_id,
        triage=triage,
        symptoms_assessed=[SymptomInput(**s) for s in symptoms],
        assessment_time=datetime.now(__import__("datetime").timezone.utc),
        confidence=0.85,
    )


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a symptom checker session."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session.get("user_id") != current_user.get("id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    del sessions[session_id]
    return {"message": "Session deleted"}


# ============== Triage Logic ==============


def calculate_triage(symptoms: list[dict], age_months: int) -> TriageRecommendation:
    """
    Calculate triage level based on symptoms and age.

    Implements the 4-tier triage system:
    - emergency_care: Life-threatening emergency
    - call_now: Urgent, needs immediate attention
    - call_24_hours: Should see doctor soon
    - home_care: Can manage at home
    """
    reasons = []

    disclaimer = (
        "This is not a substitute for professional medical advice, diagnosis, "
        "or treatment. If you think your child may have a medical emergency, "
        "seek medical care immediately at the nearest hospital."
    )

    # Critical symptoms - Call 911
    critical_symptoms = {
        "unresponsive",
        "seizure",
        "severe_difficulty_breathing",
        "apnea",
        "blue_lips",
        "not_breathing",
        "severe_abdominal_pain",
        "bloody_vomit",
        "currant_jelly_stool",
        "petechiae",
        "purpura",
        "mottled_skin",
        "drooling",
        "stiff_neck",
    }

    # High priority symptoms - Call Now
    high_priority = {
        "difficulty_breathing",
        "high_fever",
        "lethargy",
        "confusion",
        "bloody_stool",
        "no_urine_8_hours",
        "no_tears",
        "sunken_eyes",
        "sunken_fontanelle",
        "vomiting_projectile",
        "inconsolable",
        "grunting",
        "stridor",
        "nasal_flaring",
        "retractions",
    }

    symptom_ids = {s["symptom_id"] for s in symptoms}
    severe_symptoms = {s["symptom_id"] for s in symptoms if s.get("severity") == "severe"}

    # Check for critical
    critical_found = symptom_ids & critical_symptoms
    if critical_found:
        reasons = [f"Critical symptom detected: {', '.join(critical_found)}"]
        return TriageRecommendation(
            level="emergency_care",
            title="Seek Emergency Care Now",
            description="This requires immediate emergency care.",
            reasons=reasons,
            recommendations=[
                "Go to the nearest emergency room immediately",
                "Stay with your child and monitor their condition",
                "Seek professional help without delay",
            ],
            warning_signs_to_watch=[],
            disclaimer=disclaimer,
        )

    # Infant fever check
    if age_months < 3 and ("fever" in symptom_ids or "high_fever" in symptom_ids):
        return TriageRecommendation(
            level="emergency_care",
            title="Seek Emergency Care Now",
            description="Any fever in an infant under 3 months requires immediate evaluation.",
            reasons=["Fever in infant under 3 months old"],
            recommendations=[
                "Go to the emergency room immediately",
                "Do not give fever medication until seen by a doctor",
                "This is a medical emergency for this age group",
            ],
            warning_signs_to_watch=[],
            disclaimer=disclaimer,
        )

    # Check for high priority
    high_found = symptom_ids & high_priority
    if high_found or severe_symptoms:
        reasons = []
        if high_found:
            reasons.append(f"Urgent symptoms: {', '.join(high_found)}")
        if severe_symptoms:
            reasons.append(f"Severe symptoms reported: {', '.join(severe_symptoms)}")

        return TriageRecommendation(
            level="call_now",
            title="Call Your Doctor Now",
            description="Contact your doctor or go to urgent care immediately.",
            reasons=reasons,
            recommendations=[
                "Contact your pediatrician immediately",
                "If unable to reach, go to urgent care or ER",
                "Keep your child hydrated if possible",
                "Monitor for worsening symptoms",
            ],
            warning_signs_to_watch=[
                "Difficulty breathing or rapid breathing",
                "Not responding normally or very sleepy",
                "Refusing all fluids",
                "Symptoms getting worse",
            ],
            disclaimer=disclaimer,
        )

    # Check for moderate - call within 24 hours
    prolonged = any(s.get("duration") in [">3_days", ">1_week"] for s in symptoms)
    moderate_symptoms = {s["symptom_id"] for s in symptoms if s.get("severity") == "moderate"}

    if len(moderate_symptoms) >= 2 or prolonged:
        reasons = []
        if moderate_symptoms:
            reasons.append(f"Multiple moderate symptoms: {', '.join(moderate_symptoms)}")
        if prolonged:
            reasons.append("Symptoms lasting more than expected")

        return TriageRecommendation(
            level="call_24_hours",
            title="Call Within 24 Hours",
            description="Schedule a visit or call your doctor within 24 hours.",
            reasons=reasons,
            recommendations=[
                "Schedule an appointment with your pediatrician",
                "Continue monitoring symptoms",
                "Ensure adequate rest and hydration",
                "Use age-appropriate fever/pain medication if needed",
            ],
            warning_signs_to_watch=[
                "Symptoms getting worse instead of better",
                "New symptoms appearing",
                "Fever above 104°F (40°C)",
                "Signs of dehydration",
            ],
            disclaimer=disclaimer,
        )

    # Home care
    reasons = [s.get("name", s["symptom_id"]) for s in symptoms[:3]]

    return TriageRecommendation(
        level="home_care",
        title="Home Care",
        description="You can manage this at home with the advice below.",
        reasons=reasons if reasons else ["Mild symptoms reported"],
        recommendations=[
            "Rest and plenty of fluids",
            "Monitor symptoms closely",
            "Use age-appropriate fever/pain medication if needed",
            "Call your doctor if symptoms worsen or don't improve in 2-3 days",
        ],
        warning_signs_to_watch=[
            "Fever above 104°F (40°C) or lasting more than 3 days",
            "Difficulty breathing",
            "Not drinking fluids",
            "Acting very sick or unresponsive",
            "Symptoms getting significantly worse",
        ],
        disclaimer=disclaimer,
    )
