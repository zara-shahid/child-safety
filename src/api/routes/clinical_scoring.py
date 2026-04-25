"""
EPCID Clinical Scoring API Routes

Provides endpoints for clinical scoring systems:
- Phoenix Sepsis Score
- Pediatric Early Warning Score (PEWS)
- Physical Exam Assessment
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/clinical-scoring", tags=["Clinical Scoring"])


# ============== Schemas ==============


class PhoenixScoreRequest(BaseModel):
    """Request for Phoenix Sepsis Score calculation."""

    age_months: int = Field(..., ge=0, le=216)

    # Respiratory
    spo2: float | None = Field(None, ge=0, le=100)
    pao2: float | None = Field(None, ge=0)
    fio2: float | None = Field(None, ge=0.21, le=1.0)
    on_invasive_ventilation: bool = False

    # Cardiovascular
    systolic_bp: int | None = Field(None, ge=0)
    diastolic_bp: int | None = Field(None, ge=0)
    lactate: float | None = Field(None, ge=0)
    vasoactive_medications: list[str] = []

    # Coagulation
    platelet_count: int | None = Field(None, ge=0)
    inr: float | None = Field(None, ge=0)

    # Neurological
    gcs_total: int | None = Field(None, ge=3, le=15)
    avpu: str | None = Field(None, pattern="^[AVPUavpu]$")
    bilateral_fixed_pupils: bool = False

    # Clinical context
    suspected_infection: bool = False


class PhoenixScoreComponent(BaseModel):
    """Individual component score."""

    score: int
    max_score: int
    factors: list[str]


class PhoenixScoreResponse(BaseModel):
    """Response with Phoenix Score calculation."""

    total_score: int

    respiratory: PhoenixScoreComponent
    cardiovascular: PhoenixScoreComponent
    coagulation: PhoenixScoreComponent
    neurological: PhoenixScoreComponent

    meets_sepsis_criteria: bool
    meets_septic_shock_criteria: bool

    risk_level: str
    summary: str
    recommendations: list[str]
    missing_data: list[str]
    confidence: float


class PEWSRequest(BaseModel):
    """Request for PEWS calculation."""

    age_months: int = Field(..., ge=0, le=216)

    # Cardiovascular
    heart_rate: int | None = Field(None, ge=0)
    systolic_bp: int | None = Field(None, ge=0)
    capillary_refill_seconds: float | None = Field(None, ge=0)
    skin_color: str = "normal"  # normal, pale, mottled, grey

    # Respiratory
    respiratory_rate: int | None = Field(None, ge=0)
    oxygen_saturation: float | None = Field(None, ge=0, le=100)
    oxygen_requirement: float = 0.21
    work_of_breathing: str = "normal"  # normal, mild, moderate, severe
    grunting: bool = False
    stridor: bool = False
    retractions: bool = False

    # Behavior
    avpu: str = "A"
    behavior: str = "appropriate"
    parent_concern: bool = False


class PEWSComponent(BaseModel):
    """Individual PEWS component score."""

    score: int
    max_score: int
    factors: list[str]


class PEWSResponse(BaseModel):
    """Response with PEWS calculation."""

    total_score: int
    max_score: int = 9

    cardiovascular: PEWSComponent
    respiratory: PEWSComponent
    behavior: PEWSComponent

    risk_level: str
    escalation_recommended: bool
    rapid_response_threshold: bool

    interpretation: str
    recommended_actions: list[str]
    confidence: float


class PhysicalExamRequest(BaseModel):
    """Request for physical exam assessment."""

    # Mental status
    mental_status: str = (
        "normal"  # normal, mildly_altered, moderately_altered, severely_altered, unresponsive
    )
    gcs_total: int | None = Field(None, ge=3, le=15)
    avpu: str | None = Field(None, pattern="^[AVPUavpu]$")

    # Pulse quality
    pulse_quality: str = "normal"  # normal, slightly_weak, weak, thready, absent

    # Perfusion
    capillary_refill_seconds: float | None = Field(None, ge=0)
    skin_perfusion: str = "normal"  # normal, pale, mottled, cool, cold, cyanotic

    # Context
    has_fever: bool = False
    has_tachycardia: bool = False


class ExamFindingResult(BaseModel):
    """Individual exam finding result."""

    name: str
    present: bool
    severity: str
    description: str | None = None


class PhysicalExamResponse(BaseModel):
    """Response with physical exam assessment."""

    signs_present_count: int
    composite_relative_risk: float

    findings: dict[str, ExamFindingResult]

    risk_level: str
    organ_dysfunction_risk: str

    summary: list[str]
    recommendations: list[str]
    confidence: float


# ============== Endpoints ==============


@router.post("/phoenix-score", response_model=PhoenixScoreResponse)
async def calculate_phoenix_score(request: PhoenixScoreRequest) -> PhoenixScoreResponse:
    """
    Calculate Phoenix Sepsis Score.

    The Phoenix criteria (JAMA 2024) assess four organ systems:
    - Respiratory (0-3 points)
    - Cardiovascular (0-6 points)
    - Coagulation (0-2 points)
    - Neurological (0-2 points)

    Sepsis: Phoenix Score >= 2 with suspected infection
    Septic Shock: Sepsis + Cardiovascular Score >= 1
    """
    try:
        from ...clinical.phoenix_score import PhoenixScoreCalculator

        calculator = PhoenixScoreCalculator()

        result = calculator.calculate(
            age_months=request.age_months,
            spo2=request.spo2,
            pao2=request.pao2,
            fio2=request.fio2,
            on_invasive_ventilation=request.on_invasive_ventilation,
            systolic_bp=request.systolic_bp,
            diastolic_bp=request.diastolic_bp,
            lactate=request.lactate,
            vasoactive_medications=request.vasoactive_medications,
            platelet_count=request.platelet_count,
            inr=request.inr,
            gcs_total=request.gcs_total,
            avpu=request.avpu,
            bilateral_fixed_pupils=request.bilateral_fixed_pupils,
            suspected_infection=request.suspected_infection,
        )

        recommendations = []
        if result.meets_septic_shock_criteria:
            recommendations = [
                "URGENT: Septic shock criteria met",
                "Initiate sepsis bundle immediately",
                "Obtain IV access and begin fluid resuscitation",
                "Consider vasoactive support",
                "Obtain blood cultures before antibiotics if possible",
            ]
        elif result.meets_sepsis_criteria:
            recommendations = [
                "Sepsis criteria met - urgent evaluation needed",
                "Consider IV fluids and antibiotics",
                "Continuous monitoring recommended",
                "Escalate to ICU if deteriorating",
            ]
        else:
            recommendations = [
                "Monitor closely for signs of deterioration",
                "Reassess if clinical status changes",
            ]

        return PhoenixScoreResponse(
            total_score=result.total_score,
            respiratory=PhoenixScoreComponent(
                score=result.respiratory.score,
                max_score=3,
                factors=result.respiratory.score_components,
            ),
            cardiovascular=PhoenixScoreComponent(
                score=result.cardiovascular.score,
                max_score=6,
                factors=result.cardiovascular.score_components,
            ),
            coagulation=PhoenixScoreComponent(
                score=result.coagulation.score,
                max_score=2,
                factors=result.coagulation.score_components,
            ),
            neurological=PhoenixScoreComponent(
                score=result.neurological.score,
                max_score=2,
                factors=result.neurological.score_components,
            ),
            meets_sepsis_criteria=result.meets_sepsis_criteria,
            meets_septic_shock_criteria=result.meets_septic_shock_criteria,
            risk_level=result.risk_level,
            summary=result.summary,
            recommendations=recommendations,
            missing_data=result.missing_data,
            confidence=result.confidence,
        )

    except ImportError:
        # Fallback if clinical module not available
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Clinical scoring module not available",
        ) from None


@router.post("/pews", response_model=PEWSResponse)
async def calculate_pews(request: PEWSRequest) -> PEWSResponse:
    """
    Calculate Pediatric Early Warning Score (PEWS).

    PEWS assesses three domains:
    - Cardiovascular (0-3 points)
    - Respiratory (0-3 points)
    - Behavior/Neurological (0-3 points)

    Score interpretation:
    - 0-2: Low risk, routine monitoring
    - 3-4: Moderate risk, increased monitoring
    - 5-6: High risk, consider rapid response
    - 7+: Critical, immediate senior review
    """
    try:
        from ...clinical.pews import AVPU, PEWSCalculator, WorkOfBreathing

        calculator = PEWSCalculator()

        # Map work of breathing
        wob_map = {
            "normal": WorkOfBreathing.NORMAL,
            "mild": WorkOfBreathing.MILD,
            "moderate": WorkOfBreathing.MODERATE,
            "severe": WorkOfBreathing.SEVERE,
        }
        wob = wob_map.get(request.work_of_breathing.lower(), WorkOfBreathing.NORMAL)

        # Map AVPU
        avpu_map = {
            "A": AVPU.ALERT,
            "V": AVPU.VERBAL,
            "P": AVPU.PAIN,
            "U": AVPU.UNRESPONSIVE,
        }
        avpu = avpu_map.get(request.avpu.upper(), AVPU.ALERT)

        result = calculator.calculate(
            age_months=request.age_months,
            heart_rate=request.heart_rate,
            systolic_bp=request.systolic_bp,
            respiratory_rate=request.respiratory_rate,
            oxygen_saturation=request.oxygen_saturation,
            oxygen_requirement=request.oxygen_requirement,
            work_of_breathing=wob,
            capillary_refill_seconds=request.capillary_refill_seconds,
            skin_color=request.skin_color,
            avpu=avpu,
            grunting=request.grunting,
            stridor=request.stridor,
            retractions=request.retractions,
            parent_concern=request.parent_concern,
        )

        return PEWSResponse(
            total_score=result.total_score,
            max_score=result.max_possible_score,
            cardiovascular=PEWSComponent(
                score=result.cardiovascular.score,
                max_score=3,
                factors=result.cardiovascular.score_components,
            ),
            respiratory=PEWSComponent(
                score=result.respiratory.score,
                max_score=3,
                factors=result.respiratory.score_components,
            ),
            behavior=PEWSComponent(
                score=result.behavior.score,
                max_score=3,
                factors=result.behavior.score_components,
            ),
            risk_level=result.risk_level,
            escalation_recommended=result.escalation_recommended,
            rapid_response_threshold=result.rapid_response_threshold,
            interpretation=result.interpretation,
            recommended_actions=result.recommended_actions,
            confidence=result.confidence,
        )

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Clinical scoring module not available",
        ) from None


@router.post("/physical-exam", response_model=PhysicalExamResponse)
async def assess_physical_exam(request: PhysicalExamRequest) -> PhysicalExamResponse:
    """
    Assess physical exam findings for critical illness risk.

    Evaluates four validated physical exam signs:
    - Altered mental status (Sensitivity 54%, Specificity 84%)
    - Abnormal peripheral pulse quality (Sensitivity 8%, Specificity 98%)
    - Prolonged capillary refill >2s (Sensitivity 23%, Specificity 91%)
    - Cold/mottled extremities (Sensitivity 15%, Specificity 95%)

    Key finding: >=2 signs present = RR 4.98 for organ dysfunction
    """
    try:
        from ...clinical.physical_exam import (
            MentalStatus,
            PhysicalExamAssessor,
            PulseQuality,
            SkinPerfusion,
        )

        assessor = PhysicalExamAssessor()

        # Map mental status
        mental_map = {
            "normal": MentalStatus.NORMAL,
            "mildly_altered": MentalStatus.MILDLY_ALTERED,
            "moderately_altered": MentalStatus.MODERATELY_ALTERED,
            "severely_altered": MentalStatus.SEVERELY_ALTERED,
            "unresponsive": MentalStatus.UNRESPONSIVE,
        }
        mental = mental_map.get(request.mental_status.lower(), MentalStatus.NORMAL)

        # Map pulse quality
        pulse_map = {
            "normal": PulseQuality.NORMAL,
            "slightly_weak": PulseQuality.SLIGHTLY_WEAK,
            "weak": PulseQuality.WEAK,
            "thready": PulseQuality.THREADY,
            "absent": PulseQuality.ABSENT,
        }
        pulse = pulse_map.get(request.pulse_quality.lower(), PulseQuality.NORMAL)

        # Map skin perfusion
        skin_map = {
            "normal": SkinPerfusion.NORMAL,
            "pale": SkinPerfusion.PALE,
            "mottled": SkinPerfusion.MOTTLED,
            "cool": SkinPerfusion.COOL,
            "cold": SkinPerfusion.COLD,
            "cyanotic": SkinPerfusion.CYANOTIC,
        }
        skin = skin_map.get(request.skin_perfusion.lower(), SkinPerfusion.NORMAL)

        result = assessor.assess(
            mental_status=mental,
            gcs_total=request.gcs_total,
            avpu=request.avpu,
            pulse_quality=pulse,
            capillary_refill_seconds=request.capillary_refill_seconds,
            skin_perfusion=skin,
            has_fever=request.has_fever,
            has_tachycardia=request.has_tachycardia,
        )

        findings = {
            "altered_mental_status": ExamFindingResult(
                name=result.altered_mental_status.name,
                present=result.altered_mental_status.present,
                severity=result.altered_mental_status.severity,
                description=result.altered_mental_status.description,
            ),
            "abnormal_pulse_quality": ExamFindingResult(
                name=result.abnormal_pulse_quality.name,
                present=result.abnormal_pulse_quality.present,
                severity=result.abnormal_pulse_quality.severity,
                description=result.abnormal_pulse_quality.description,
            ),
            "prolonged_capillary_refill": ExamFindingResult(
                name=result.prolonged_capillary_refill.name,
                present=result.prolonged_capillary_refill.present,
                severity=result.prolonged_capillary_refill.severity,
                description=result.prolonged_capillary_refill.description,
            ),
            "cold_mottled_extremities": ExamFindingResult(
                name=result.cold_mottled_extremities.name,
                present=result.cold_mottled_extremities.present,
                severity=result.cold_mottled_extremities.severity,
                description=result.cold_mottled_extremities.description,
            ),
        }

        return PhysicalExamResponse(
            signs_present_count=result.signs_present_count,
            composite_relative_risk=result.composite_relative_risk,
            findings=findings,
            risk_level=result.risk_level,
            organ_dysfunction_risk=result.organ_dysfunction_risk,
            summary=result.findings_summary,
            recommendations=result.recommendations,
            confidence=result.confidence,
        )

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Clinical scoring module not available",
        ) from None
