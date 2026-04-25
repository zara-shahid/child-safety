"""
Pediatric Early Warning Score (PEWS) Calculator

Implements a validated PEWS scoring system based on multicenter validation
studies. PEWS is designed to identify clinical deterioration in hospitalized
pediatric patients.

Components assessed:
1. Cardiovascular (heart rate, capillary refill, blood pressure)
2. Respiratory (respiratory rate, work of breathing, oxygen requirement)
3. Behavior/Neurological (AVPU scale, activity level)

References:
- ACC Journal multicenter validation study (pDEWS)
- Parshuram et al. - Brighton PEWS
- PEWS systematic review (BMJ Open)
"""

import logging
from dataclasses import dataclass, field
from enum import Enum

from .vital_signs import AgeAdjustedVitals, VitalSignNormalizer, VitalSignStatus

logger = logging.getLogger("epcid.clinical.pews")


class WorkOfBreathing(Enum):
    """Work of breathing assessment levels."""

    NORMAL = "normal"
    MILD = "mild"  # Mild increase, nasal flaring
    MODERATE = "moderate"  # Retractions, accessory muscle use
    SEVERE = "severe"  # Severe distress, grunting, head bobbing


class CapillaryRefill(Enum):
    """Capillary refill time categories."""

    NORMAL = "normal"  # <=2 seconds
    SLIGHTLY_PROLONGED = "slightly_prolonged"  # 2-3 seconds
    PROLONGED = "prolonged"  # 3-4 seconds
    SEVERELY_PROLONGED = "severely_prolonged"  # >4 seconds


class AVPU(Enum):
    """AVPU neurological assessment scale."""

    ALERT = "A"  # Alert and responsive
    VERBAL = "V"  # Responds to verbal stimuli
    PAIN = "P"  # Responds only to pain
    UNRESPONSIVE = "U"  # Unresponsive


class BehaviorStatus(Enum):
    """Behavior/activity assessment."""

    APPROPRIATE = "appropriate"
    DECREASED_ACTIVITY = "decreased_activity"  # Less active than normal
    IRRITABLE = "irritable"  # Unusually irritable
    LETHARGIC = "lethargic"  # Difficult to arouse
    INCONSOLABLE = "inconsolable"  # Cannot be comforted


@dataclass
class CardiovascularPEWS:
    """Cardiovascular component of PEWS."""

    heart_rate: int | None = None
    capillary_refill: CapillaryRefill = CapillaryRefill.NORMAL
    systolic_bp: int | None = None
    skin_color: str = "normal"  # normal, pale, mottled, grey

    # Age-adjusted assessment
    tachycardia: bool = False
    bradycardia: bool = False
    hypotension: bool = False

    score: int = 0
    score_components: list[str] = field(default_factory=list)


@dataclass
class RespiratoryPEWS:
    """Respiratory component of PEWS."""

    respiratory_rate: int | None = None
    work_of_breathing: WorkOfBreathing = WorkOfBreathing.NORMAL
    oxygen_requirement: float = 0.21  # FiO2 (room air = 0.21)
    oxygen_saturation: float | None = None

    # Specific signs
    nasal_flaring: bool = False
    retractions: bool = False
    accessory_muscle_use: bool = False
    grunting: bool = False
    stridor: bool = False
    wheezing: bool = False

    # Age-adjusted assessment
    tachypnea: bool = False
    hypoxia: bool = False

    score: int = 0
    score_components: list[str] = field(default_factory=list)


@dataclass
class BehaviorPEWS:
    """Behavior/Neurological component of PEWS."""

    avpu: AVPU = AVPU.ALERT
    behavior: BehaviorStatus = BehaviorStatus.APPROPRIATE

    # Parent concern
    parent_concern: bool = False
    parent_notes: str | None = None

    # Additional observations
    consolable: bool = True
    interacting: bool = True

    score: int = 0
    score_components: list[str] = field(default_factory=list)


@dataclass
class PEWSScore:
    """Complete PEWS assessment result."""

    # Component scores
    cardiovascular: CardiovascularPEWS = field(default_factory=CardiovascularPEWS)
    respiratory: RespiratoryPEWS = field(default_factory=RespiratoryPEWS)
    behavior: BehaviorPEWS = field(default_factory=BehaviorPEWS)

    # Total score (0-9 typically, can vary by implementation)
    total_score: int = 0
    max_possible_score: int = 9

    # Risk stratification
    risk_level: str = "low"  # low, moderate, high, critical
    escalation_recommended: bool = False
    rapid_response_threshold: bool = False

    # Clinical interpretation
    interpretation: str = ""
    recommended_actions: list[str] = field(default_factory=list)

    # Metadata
    age_months: int = 0
    confidence: float = 0.5


class PEWSCalculator:
    """
    Calculator for Pediatric Early Warning Score.

    PEWS provides a standardized assessment of pediatric patients
    to identify those at risk of clinical deterioration. Score
    thresholds trigger escalating responses:

    - Score 0-2: Low risk, routine monitoring
    - Score 3-4: Moderate risk, increased monitoring
    - Score 5-6: High risk, consider rapid response
    - Score 7+: Critical, immediate senior review

    Usage:
        calculator = PEWSCalculator()
        score = calculator.calculate(
            age_months=24,
            heart_rate=140,
            respiratory_rate=40,
            oxygen_saturation=94,
            work_of_breathing=WorkOfBreathing.MODERATE,
            avpu=AVPU.ALERT,
        )

        if score.escalation_recommended:
            print("Consider escalation to senior clinician")
    """

    def __init__(self) -> None:
        self.vital_normalizer = VitalSignNormalizer()

    def calculate(
        self,
        age_months: int,
        # Cardiovascular
        heart_rate: int | None = None,
        systolic_bp: int | None = None,
        capillary_refill: CapillaryRefill = CapillaryRefill.NORMAL,
        capillary_refill_seconds: float | None = None,
        skin_color: str = "normal",
        # Respiratory
        respiratory_rate: int | None = None,
        oxygen_saturation: float | None = None,
        oxygen_requirement: float = 0.21,
        work_of_breathing: WorkOfBreathing = WorkOfBreathing.NORMAL,
        nasal_flaring: bool = False,
        retractions: bool = False,
        accessory_muscle_use: bool = False,
        grunting: bool = False,
        stridor: bool = False,
        wheezing: bool = False,
        # Behavior/Neurological
        avpu: AVPU = AVPU.ALERT,
        behavior: BehaviorStatus = BehaviorStatus.APPROPRIATE,
        parent_concern: bool = False,
        parent_notes: str | None = None,
    ) -> PEWSScore:
        """
        Calculate PEWS score.

        Args:
            age_months: Patient age in months
            heart_rate: Heart rate in bpm
            systolic_bp: Systolic blood pressure in mmHg
            capillary_refill: Capillary refill category
            capillary_refill_seconds: Capillary refill time in seconds
            skin_color: Skin color description
            respiratory_rate: Respiratory rate in breaths/min
            oxygen_saturation: SpO2 percentage
            oxygen_requirement: FiO2 (0.21 = room air)
            work_of_breathing: Work of breathing assessment
            nasal_flaring: Presence of nasal flaring
            retractions: Presence of retractions
            accessory_muscle_use: Use of accessory muscles
            grunting: Presence of grunting
            stridor: Presence of stridor
            wheezing: Presence of wheezing
            avpu: AVPU scale assessment
            behavior: Behavior status assessment
            parent_concern: Whether parent has concerns
            parent_notes: Parent notes about concerns

        Returns:
            PEWSScore with complete assessment
        """
        result = PEWSScore(age_months=age_months)

        # Get age-adjusted vital sign assessment
        vitals = self.vital_normalizer.normalize(
            age_months=age_months,
            heart_rate=heart_rate,
            respiratory_rate=respiratory_rate,
            systolic_bp=systolic_bp,
            oxygen_saturation=oxygen_saturation,
        )

        # Convert capillary refill seconds to category if provided
        if capillary_refill_seconds is not None:
            capillary_refill = self._seconds_to_capillary_refill(capillary_refill_seconds)

        # Calculate component scores
        result.cardiovascular = self._calculate_cardiovascular(
            vitals=vitals,
            capillary_refill=capillary_refill,
            skin_color=skin_color,
        )

        result.respiratory = self._calculate_respiratory(
            vitals=vitals,
            oxygen_requirement=oxygen_requirement,
            work_of_breathing=work_of_breathing,
            nasal_flaring=nasal_flaring,
            retractions=retractions,
            accessory_muscle_use=accessory_muscle_use,
            grunting=grunting,
            stridor=stridor,
            wheezing=wheezing,
        )

        result.behavior = self._calculate_behavior(
            avpu=avpu,
            behavior=behavior,
            parent_concern=parent_concern,
            parent_notes=parent_notes,
        )

        # Calculate total score
        result.total_score = (
            result.cardiovascular.score + result.respiratory.score + result.behavior.score
        )

        # Determine risk level and recommendations
        result.risk_level = self._determine_risk_level(result.total_score)
        result.escalation_recommended = result.total_score >= 5
        result.rapid_response_threshold = result.total_score >= 7

        # Generate interpretation and actions
        result.interpretation = self._generate_interpretation(result)
        result.recommended_actions = self._generate_recommendations(result)

        # Calculate confidence
        result.confidence = self._calculate_confidence(vitals, work_of_breathing, avpu)

        return result

    def _seconds_to_capillary_refill(self, seconds: float) -> CapillaryRefill:
        """Convert capillary refill time in seconds to category."""
        if seconds <= 2:
            return CapillaryRefill.NORMAL
        elif seconds <= 3:
            return CapillaryRefill.SLIGHTLY_PROLONGED
        elif seconds <= 4:
            return CapillaryRefill.PROLONGED
        else:
            return CapillaryRefill.SEVERELY_PROLONGED

    def _calculate_cardiovascular(
        self,
        vitals: AgeAdjustedVitals,
        capillary_refill: CapillaryRefill,
        skin_color: str,
    ) -> CardiovascularPEWS:
        """Calculate cardiovascular PEWS component (0-3 points)."""
        cv = CardiovascularPEWS(
            heart_rate=vitals.heart_rate,
            capillary_refill=capillary_refill,
            systolic_bp=vitals.systolic_bp,
            skin_color=skin_color,
            tachycardia=vitals.tachycardia,
            bradycardia=vitals.bradycardia,
            hypotension=vitals.hypotension,
        )

        score = 0
        components = []

        # Heart rate scoring (0-2 points based on deviation)
        if vitals.heart_rate is not None:
            if vitals.hr_status == VitalSignStatus.CRITICALLY_HIGH:
                score += 2
                components.append(f"Severe tachycardia (HR {vitals.heart_rate})")
            elif vitals.hr_status == VitalSignStatus.CRITICALLY_LOW:
                score += 2
                components.append(f"Severe bradycardia (HR {vitals.heart_rate})")
            elif vitals.hr_status == VitalSignStatus.HIGH:
                score += 1
                components.append(f"Tachycardia (HR {vitals.heart_rate})")
            elif vitals.hr_status == VitalSignStatus.LOW:
                score += 1
                components.append(f"Bradycardia (HR {vitals.heart_rate})")

        # Capillary refill scoring (0-2 points)
        if capillary_refill == CapillaryRefill.SEVERELY_PROLONGED:
            score += 2
            components.append("Severely prolonged cap refill (>4s)")
        elif capillary_refill == CapillaryRefill.PROLONGED:
            score += 1
            components.append("Prolonged cap refill (3-4s)")
        elif capillary_refill == CapillaryRefill.SLIGHTLY_PROLONGED:
            score += 1
            components.append("Slightly prolonged cap refill (2-3s)")

        # Skin color (0-1 points)
        if skin_color.lower() in ["grey", "gray", "mottled"]:
            score += 1
            components.append(f"Abnormal skin color: {skin_color}")
        elif skin_color.lower() == "pale":
            score += 1
            components.append("Pale skin color")

        cv.score = min(3, score)  # Cap at 3
        cv.score_components = components

        return cv

    def _calculate_respiratory(
        self,
        vitals: AgeAdjustedVitals,
        oxygen_requirement: float,
        work_of_breathing: WorkOfBreathing,
        nasal_flaring: bool,
        retractions: bool,
        accessory_muscle_use: bool,
        grunting: bool,
        stridor: bool,
        wheezing: bool,
    ) -> RespiratoryPEWS:
        """Calculate respiratory PEWS component (0-3 points)."""
        resp = RespiratoryPEWS(
            respiratory_rate=vitals.respiratory_rate,
            work_of_breathing=work_of_breathing,
            oxygen_requirement=oxygen_requirement,
            oxygen_saturation=vitals.oxygen_saturation,
            nasal_flaring=nasal_flaring,
            retractions=retractions,
            accessory_muscle_use=accessory_muscle_use,
            grunting=grunting,
            stridor=stridor,
            wheezing=wheezing,
            tachypnea=vitals.tachypnea if hasattr(vitals, "tachypnea") else False,
            hypoxia=vitals.hypoxia if hasattr(vitals, "hypoxia") else False,
        )

        score = 0
        components = []

        # Respiratory rate scoring (0-2 points)
        if vitals.respiratory_rate is not None:
            if vitals.rr_status == VitalSignStatus.CRITICALLY_HIGH:
                score += 2
                components.append(f"Severe tachypnea (RR {vitals.respiratory_rate})")
            elif vitals.rr_status == VitalSignStatus.HIGH:
                score += 1
                components.append(f"Tachypnea (RR {vitals.respiratory_rate})")

        # Oxygen requirement (0-2 points)
        if oxygen_requirement > 0.5:
            score += 2
            components.append(f"High O2 requirement (FiO2 {oxygen_requirement:.0%})")
        elif oxygen_requirement > 0.21:
            score += 1
            components.append(f"Supplemental O2 (FiO2 {oxygen_requirement:.0%})")

        # Work of breathing (0-2 points)
        if work_of_breathing == WorkOfBreathing.SEVERE:
            score += 2
            components.append("Severe work of breathing")
        elif work_of_breathing == WorkOfBreathing.MODERATE:
            score += 1
            components.append("Moderate work of breathing")
        elif work_of_breathing == WorkOfBreathing.MILD:
            score += 1
            components.append("Mild increased work of breathing")

        # Specific respiratory signs
        if grunting:
            score += 1
            components.append("Grunting")
        if stridor:
            score += 1
            components.append("Stridor")
        if retractions:
            components.append("Retractions present")
        if nasal_flaring:
            components.append("Nasal flaring")

        # Oxygen saturation
        if vitals.oxygen_saturation is not None:
            if vitals.spo2_status == VitalSignStatus.CRITICALLY_LOW:
                score += 2
                components.append(f"Severe hypoxia (SpO2 {vitals.oxygen_saturation}%)")
            elif vitals.spo2_status == VitalSignStatus.LOW:
                score += 1
                components.append(f"Hypoxia (SpO2 {vitals.oxygen_saturation}%)")

        resp.score = min(3, score)  # Cap at 3
        resp.score_components = components

        return resp

    def _calculate_behavior(
        self,
        avpu: AVPU,
        behavior: BehaviorStatus,
        parent_concern: bool,
        parent_notes: str | None,
    ) -> BehaviorPEWS:
        """Calculate behavior/neurological PEWS component (0-3 points)."""
        beh = BehaviorPEWS(
            avpu=avpu,
            behavior=behavior,
            parent_concern=parent_concern,
            parent_notes=parent_notes,
        )

        score = 0
        components = []

        # AVPU scoring (0-3 points)
        if avpu == AVPU.UNRESPONSIVE:
            score += 3
            components.append("Unresponsive (AVPU: U)")
        elif avpu == AVPU.PAIN:
            score += 2
            components.append("Responds to pain only (AVPU: P)")
        elif avpu == AVPU.VERBAL:
            score += 1
            components.append("Responds to verbal (AVPU: V)")

        # Behavior scoring (0-2 points)
        if behavior == BehaviorStatus.LETHARGIC:
            score += 2
            components.append("Lethargic")
        elif behavior == BehaviorStatus.INCONSOLABLE:
            score += 2
            components.append("Inconsolable")
        elif behavior == BehaviorStatus.IRRITABLE:
            score += 1
            components.append("Irritable")
        elif behavior == BehaviorStatus.DECREASED_ACTIVITY:
            score += 1
            components.append("Decreased activity")

        # Parent concern (add 1 point if present)
        if parent_concern:
            score += 1
            components.append("Parent concern noted")
            if parent_notes:
                components.append(f"Parent notes: {parent_notes}")

        beh.score = min(3, score)  # Cap at 3
        beh.score_components = components

        return beh

    def _determine_risk_level(self, total_score: int) -> str:
        """Determine risk level from total PEWS score."""
        if total_score >= 7:
            return "critical"
        elif total_score >= 5:
            return "high"
        elif total_score >= 3:
            return "moderate"
        else:
            return "low"

    def _generate_interpretation(self, result: PEWSScore) -> str:
        """Generate clinical interpretation of PEWS score."""
        score = result.total_score

        if score >= 7:
            return (
                f"PEWS Score {score}/9: CRITICAL - Immediate senior review required. "
                "Consider rapid response team activation."
            )
        elif score >= 5:
            return (
                f"PEWS Score {score}/9: HIGH RISK - Escalate to senior clinician. "
                "Increase monitoring frequency."
            )
        elif score >= 3:
            return (
                f"PEWS Score {score}/9: MODERATE RISK - Increase monitoring. "
                "Consider clinical review."
            )
        else:
            return (
                f"PEWS Score {score}/9: LOW RISK - Continue routine monitoring. "
                "Reassess as clinically indicated."
            )

    def _generate_recommendations(self, result: PEWSScore) -> list[str]:
        """Generate recommended actions based on PEWS score."""
        actions = []
        score = result.total_score

        if score >= 7:
            actions.extend(
                [
                    "Activate rapid response team",
                    "Immediate senior clinician review",
                    "Consider ICU evaluation",
                    "Continuous monitoring required",
                    "Document escalation in medical record",
                ]
            )
        elif score >= 5:
            actions.extend(
                [
                    "Notify senior clinician within 30 minutes",
                    "Increase monitoring to every 15-30 minutes",
                    "Consider additional interventions",
                    "Prepare for potential escalation",
                ]
            )
        elif score >= 3:
            actions.extend(
                [
                    "Increase monitoring frequency to hourly",
                    "Clinical review within 2 hours",
                    "Reassess response to current interventions",
                ]
            )
        else:
            actions.extend(
                [
                    "Continue routine monitoring",
                    "Reassess per standard protocol",
                ]
            )

        # Add specific component-based recommendations
        if result.respiratory.score >= 2:
            actions.append("Respiratory assessment - consider respiratory therapy evaluation")

        if result.cardiovascular.score >= 2:
            actions.append("Cardiovascular assessment - check perfusion and fluid status")

        if result.behavior.score >= 2:
            actions.append(
                "Neurological assessment - evaluate for underlying cause of altered status"
            )

        return actions

    def _calculate_confidence(
        self,
        vitals: AgeAdjustedVitals,
        work_of_breathing: WorkOfBreathing,
        avpu: AVPU,
    ) -> float:
        """Calculate confidence based on available data."""
        confidence = 0.5

        if vitals.heart_rate is not None:
            confidence += 0.1
        if vitals.respiratory_rate is not None:
            confidence += 0.1
        if vitals.oxygen_saturation is not None:
            confidence += 0.1
        if work_of_breathing != WorkOfBreathing.NORMAL:
            confidence += 0.1  # Active assessment made
        if avpu != AVPU.ALERT:
            confidence += 0.1  # Active assessment made

        return min(0.95, confidence)
