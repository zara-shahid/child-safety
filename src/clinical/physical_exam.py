"""
Physical Exam Signs Assessment for Pediatric Critical Illness

Implements validated physical examination findings for early detection
of critical illness in pediatric SIRS patients.

Based on BMC Emergency Medicine study findings:
- Altered mental status: Sensitivity 54%, Specificity 84%
- Peripheral pulse quality: Sensitivity 8%, Specificity 98%
- Capillary refill >2s: Sensitivity 23%, Specificity 91%
- Cold/mottled extremities: Sensitivity 15%, Specificity 95%

Key finding: >=2 signs present = Relative Risk 4.98 for organ dysfunction

References:
- BMC Emergency Medicine: "Effectiveness of physical exam signs for
  early detection of critical illness in pediatric SIRS"
- Pediatric Sepsis Clinical Presentation guidelines
"""

import logging
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("epcid.clinical.physical_exam")


class MentalStatus(Enum):
    """Mental status assessment categories."""

    NORMAL = "normal"  # Alert, age-appropriate interaction
    MILDLY_ALTERED = "mildly_altered"  # Slightly drowsy but arousable
    MODERATELY_ALTERED = "moderately_altered"  # Lethargic, decreased responsiveness
    SEVERELY_ALTERED = "severely_altered"  # Obtunded, minimal response
    UNRESPONSIVE = "unresponsive"  # No response to stimuli


class PulseQuality(Enum):
    """Peripheral pulse quality assessment."""

    NORMAL = "normal"  # Strong, easily palpable
    SLIGHTLY_WEAK = "slightly_weak"  # Palpable but diminished
    WEAK = "weak"  # Difficult to palpate
    THREADY = "thready"  # Barely palpable
    ABSENT = "absent"  # Not palpable


class SkinPerfusion(Enum):
    """Skin perfusion and color assessment."""

    NORMAL = "normal"  # Pink, warm, dry
    PALE = "pale"  # Pallor
    MOTTLED = "mottled"  # Mottled appearance
    COOL = "cool"  # Cool to touch
    COLD = "cold"  # Cold extremities
    CYANOTIC = "cyanotic"  # Central or peripheral cyanosis


@dataclass
class ExamFinding:
    """Individual physical exam finding."""

    name: str
    present: bool
    severity: str = "none"  # none, mild, moderate, severe
    description: str | None = None

    # Diagnostic characteristics
    sensitivity: float = 0.0
    specificity: float = 0.0
    relative_risk: float = 1.0


@dataclass
class PhysicalExamAssessment:
    """
    Complete physical examination assessment for critical illness detection.

    Evaluates four key physical exam signs validated for early detection
    of organ dysfunction in pediatric patients with systemic inflammatory
    response syndrome (SIRS).
    """

    # Primary exam findings
    altered_mental_status: ExamFinding = field(
        default_factory=lambda: ExamFinding(
            name="Altered Mental Status",
            present=False,
            sensitivity=0.54,
            specificity=0.84,
            relative_risk=2.71,
        )
    )

    abnormal_pulse_quality: ExamFinding = field(
        default_factory=lambda: ExamFinding(
            name="Abnormal Peripheral Pulse Quality",
            present=False,
            sensitivity=0.08,
            specificity=0.98,
            relative_risk=2.71,
        )
    )

    prolonged_capillary_refill: ExamFinding = field(
        default_factory=lambda: ExamFinding(
            name="Prolonged Capillary Refill (>2s)",
            present=False,
            sensitivity=0.23,
            specificity=0.91,
            relative_risk=1.5,  # Not independently significant
        )
    )

    cold_mottled_extremities: ExamFinding = field(
        default_factory=lambda: ExamFinding(
            name="Cold or Mottled Extremities",
            present=False,
            sensitivity=0.15,
            specificity=0.95,
            relative_risk=1.3,  # Not independently significant
        )
    )

    # Additional findings
    mental_status: MentalStatus = MentalStatus.NORMAL
    pulse_quality: PulseQuality = PulseQuality.NORMAL
    skin_perfusion: SkinPerfusion = SkinPerfusion.NORMAL
    capillary_refill_seconds: float | None = None

    # Composite scores
    signs_present_count: int = 0
    composite_relative_risk: float = 1.0

    # Risk assessment
    risk_level: str = "low"  # low, moderate, high, critical
    organ_dysfunction_risk: str = "low"

    # Recommendations
    findings_summary: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)

    # Confidence
    confidence: float = 0.5


class PhysicalExamAssessor:
    """
    Assesses physical examination findings for pediatric critical illness risk.

    Based on validated research showing that combinations of physical exam
    signs significantly increase the risk of organ dysfunction:

    - 1 sign present: RR 2.71 for organ dysfunction
    - >=2 signs present: RR 4.98 for organ dysfunction

    The most predictive individual signs are:
    - Altered mental status (most sensitive at 54%)
    - Abnormal peripheral pulse quality (most specific at 98%)

    Usage:
        assessor = PhysicalExamAssessor()
        assessment = assessor.assess(
            mental_status=MentalStatus.MODERATELY_ALTERED,
            pulse_quality=PulseQuality.WEAK,
            capillary_refill_seconds=4.0,
            skin_perfusion=SkinPerfusion.MOTTLED,
        )

        if assessment.signs_present_count >= 2:
            print(f"High risk: RR {assessment.composite_relative_risk}")
    """

    # Relative risk multipliers based on research
    RR_ONE_SIGN = 2.71
    RR_TWO_OR_MORE_SIGNS = 4.98

    def assess(
        self,
        # Mental status
        mental_status: MentalStatus = MentalStatus.NORMAL,
        gcs_total: int | None = None,
        avpu: str | None = None,
        # Pulse quality
        pulse_quality: PulseQuality = PulseQuality.NORMAL,
        # Capillary refill
        capillary_refill_seconds: float | None = None,
        # Skin/extremities
        skin_perfusion: SkinPerfusion = SkinPerfusion.NORMAL,
        extremities_temperature: str | None = None,  # warm, cool, cold
        # Additional context
        age_months: int | None = None,
        has_fever: bool = False,
        has_tachycardia: bool = False,
    ) -> PhysicalExamAssessment:
        """
        Perform comprehensive physical exam assessment.

        Args:
            mental_status: Mental status category
            gcs_total: Glasgow Coma Scale total (optional, used to infer mental status)
            avpu: AVPU assessment (optional, used to infer mental status)
            pulse_quality: Peripheral pulse quality
            capillary_refill_seconds: Capillary refill time in seconds
            skin_perfusion: Skin perfusion assessment
            extremities_temperature: Temperature of extremities
            age_months: Patient age in months
            has_fever: Whether patient has fever
            has_tachycardia: Whether patient has tachycardia

        Returns:
            PhysicalExamAssessment with risk stratification
        """
        assessment = PhysicalExamAssessment()

        # Infer mental status from GCS/AVPU if not directly assessed
        if gcs_total is not None:
            mental_status = self._gcs_to_mental_status(gcs_total)
        elif avpu is not None:
            mental_status = self._avpu_to_mental_status(avpu)

        assessment.mental_status = mental_status
        assessment.pulse_quality = pulse_quality
        assessment.skin_perfusion = skin_perfusion
        assessment.capillary_refill_seconds = capillary_refill_seconds

        # Evaluate each primary finding
        assessment.altered_mental_status = self._assess_mental_status(mental_status)
        assessment.abnormal_pulse_quality = self._assess_pulse_quality(pulse_quality)
        assessment.prolonged_capillary_refill = self._assess_capillary_refill(
            capillary_refill_seconds
        )
        assessment.cold_mottled_extremities = self._assess_extremities(
            skin_perfusion, extremities_temperature
        )

        # Count positive findings
        findings = [
            assessment.altered_mental_status,
            assessment.abnormal_pulse_quality,
            assessment.prolonged_capillary_refill,
            assessment.cold_mottled_extremities,
        ]

        assessment.signs_present_count = sum(1 for f in findings if f.present)

        # Calculate composite relative risk
        if assessment.signs_present_count >= 2:
            assessment.composite_relative_risk = self.RR_TWO_OR_MORE_SIGNS
        elif assessment.signs_present_count == 1:
            assessment.composite_relative_risk = self.RR_ONE_SIGN
        else:
            assessment.composite_relative_risk = 1.0

        # Determine risk levels
        assessment.risk_level = self._determine_risk_level(assessment)
        assessment.organ_dysfunction_risk = self._determine_organ_dysfunction_risk(
            assessment, has_fever, has_tachycardia
        )

        # Generate summary and recommendations
        assessment.findings_summary = self._generate_findings_summary(assessment)
        assessment.recommendations = self._generate_recommendations(assessment)

        # Calculate confidence
        assessment.confidence = self._calculate_confidence(assessment)

        return assessment

    def _gcs_to_mental_status(self, gcs: int) -> MentalStatus:
        """Convert GCS to mental status category."""
        if gcs >= 15:
            return MentalStatus.NORMAL
        elif gcs >= 13:
            return MentalStatus.MILDLY_ALTERED
        elif gcs >= 9:
            return MentalStatus.MODERATELY_ALTERED
        elif gcs >= 4:
            return MentalStatus.SEVERELY_ALTERED
        else:
            return MentalStatus.UNRESPONSIVE

    def _avpu_to_mental_status(self, avpu: str) -> MentalStatus:
        """Convert AVPU to mental status category."""
        avpu_upper = avpu.upper()
        if avpu_upper == "A":
            return MentalStatus.NORMAL
        elif avpu_upper == "V":
            return MentalStatus.MILDLY_ALTERED
        elif avpu_upper == "P":
            return MentalStatus.MODERATELY_ALTERED
        else:  # U
            return MentalStatus.UNRESPONSIVE

    def _assess_mental_status(self, status: MentalStatus) -> ExamFinding:
        """Assess mental status finding."""
        finding = ExamFinding(
            name="Altered Mental Status",
            present=status not in [MentalStatus.NORMAL],
            sensitivity=0.54,
            specificity=0.84,
            relative_risk=2.71,
        )

        if status == MentalStatus.MILDLY_ALTERED:
            finding.severity = "mild"
            finding.description = "Mildly altered - slightly drowsy but arousable"
        elif status == MentalStatus.MODERATELY_ALTERED:
            finding.severity = "moderate"
            finding.description = "Moderately altered - lethargic, decreased responsiveness"
        elif status == MentalStatus.SEVERELY_ALTERED:
            finding.severity = "severe"
            finding.description = "Severely altered - obtunded, minimal response"
        elif status == MentalStatus.UNRESPONSIVE:
            finding.severity = "critical"
            finding.description = "Unresponsive - no response to stimuli"

        return finding

    def _assess_pulse_quality(self, quality: PulseQuality) -> ExamFinding:
        """Assess peripheral pulse quality finding."""
        finding = ExamFinding(
            name="Abnormal Peripheral Pulse Quality",
            present=quality not in [PulseQuality.NORMAL],
            sensitivity=0.08,
            specificity=0.98,
            relative_risk=2.71,
        )

        if quality == PulseQuality.SLIGHTLY_WEAK:
            finding.severity = "mild"
            finding.description = "Slightly weak peripheral pulses"
        elif quality == PulseQuality.WEAK:
            finding.severity = "moderate"
            finding.description = "Weak peripheral pulses - difficult to palpate"
        elif quality == PulseQuality.THREADY:
            finding.severity = "severe"
            finding.description = "Thready pulses - barely palpable"
        elif quality == PulseQuality.ABSENT:
            finding.severity = "critical"
            finding.description = "Absent peripheral pulses"

        return finding

    def _assess_capillary_refill(self, seconds: float | None) -> ExamFinding:
        """Assess capillary refill finding."""
        finding = ExamFinding(
            name="Prolonged Capillary Refill (>2s)",
            present=False,
            sensitivity=0.23,
            specificity=0.91,
            relative_risk=1.5,
        )

        if seconds is not None:
            if seconds > 2:
                finding.present = True
                if seconds <= 3:
                    finding.severity = "mild"
                    finding.description = f"Capillary refill {seconds:.1f}s (slightly prolonged)"
                elif seconds <= 4:
                    finding.severity = "moderate"
                    finding.description = f"Capillary refill {seconds:.1f}s (prolonged)"
                else:
                    finding.severity = "severe"
                    finding.description = f"Capillary refill {seconds:.1f}s (severely prolonged)"

        return finding

    def _assess_extremities(
        self,
        skin_perfusion: SkinPerfusion,
        extremities_temp: str | None,
    ) -> ExamFinding:
        """Assess cold/mottled extremities finding."""
        finding = ExamFinding(
            name="Cold or Mottled Extremities",
            present=False,
            sensitivity=0.15,
            specificity=0.95,
            relative_risk=1.3,
        )

        # Check skin perfusion
        if skin_perfusion in [SkinPerfusion.MOTTLED, SkinPerfusion.COLD, SkinPerfusion.CYANOTIC]:
            finding.present = True
            if skin_perfusion == SkinPerfusion.MOTTLED:
                finding.severity = "moderate"
                finding.description = "Mottled skin appearance"
            elif skin_perfusion == SkinPerfusion.COLD:
                finding.severity = "moderate"
                finding.description = "Cold extremities"
            elif skin_perfusion == SkinPerfusion.CYANOTIC:
                finding.severity = "severe"
                finding.description = "Cyanotic extremities"
        elif skin_perfusion == SkinPerfusion.COOL:
            finding.present = True
            finding.severity = "mild"
            finding.description = "Cool extremities"

        # Check temperature description
        if extremities_temp is not None:
            temp_lower = extremities_temp.lower()
            if "cold" in temp_lower:
                finding.present = True
                finding.severity = "moderate"
                finding.description = "Cold extremities"
            elif "cool" in temp_lower:
                finding.present = True
                finding.severity = "mild"
                finding.description = "Cool extremities"

        return finding

    def _determine_risk_level(self, assessment: PhysicalExamAssessment) -> str:
        """Determine overall risk level from exam findings."""
        count = assessment.signs_present_count

        # Check for critical individual findings
        if assessment.altered_mental_status.severity in ["severe", "critical"]:
            return "critical"
        if assessment.abnormal_pulse_quality.severity in ["severe", "critical"]:
            return "critical"

        # Based on sign count
        if count >= 3:
            return "critical"
        elif count >= 2:
            return "high"
        elif count >= 1:
            return "moderate"
        else:
            return "low"

    def _determine_organ_dysfunction_risk(
        self,
        assessment: PhysicalExamAssessment,
        has_fever: bool,
        has_tachycardia: bool,
    ) -> str:
        """Determine risk of organ dysfunction."""
        # Base risk from physical exam findings

        # In context of SIRS (fever + tachycardia), risk increases
        if has_fever and has_tachycardia:
            if assessment.signs_present_count >= 2:
                return "high"  # RR 4.98 in SIRS context
            elif assessment.signs_present_count >= 1:
                return "moderate"  # RR 2.71 in SIRS context

        # Without SIRS context
        if assessment.signs_present_count >= 2:
            return "moderate"
        elif assessment.signs_present_count >= 1:
            return "low-moderate"

        return "low"

    def _generate_findings_summary(self, assessment: PhysicalExamAssessment) -> list[str]:
        """Generate summary of positive findings."""
        summary = []

        if assessment.altered_mental_status.present:
            summary.append(
                f"Altered mental status ({assessment.altered_mental_status.severity}): "
                f"{assessment.altered_mental_status.description}"
            )

        if assessment.abnormal_pulse_quality.present:
            summary.append(
                f"Abnormal pulse quality ({assessment.abnormal_pulse_quality.severity}): "
                f"{assessment.abnormal_pulse_quality.description}"
            )

        if assessment.prolonged_capillary_refill.present:
            summary.append(
                f"Prolonged capillary refill ({assessment.prolonged_capillary_refill.severity}): "
                f"{assessment.prolonged_capillary_refill.description}"
            )

        if assessment.cold_mottled_extremities.present:
            summary.append(
                f"Cold/mottled extremities ({assessment.cold_mottled_extremities.severity}): "
                f"{assessment.cold_mottled_extremities.description}"
            )

        if not summary:
            summary.append("No concerning physical exam findings identified")

        return summary

    def _generate_recommendations(self, assessment: PhysicalExamAssessment) -> list[str]:
        """Generate recommendations based on findings."""
        recommendations = []

        if assessment.signs_present_count >= 2:
            recommendations.extend(
                [
                    "High risk for organ dysfunction (RR 4.98)",
                    "Immediate physician evaluation recommended",
                    "Consider sepsis workup",
                    "Monitor closely for deterioration",
                    "Consider fluid resuscitation if signs of shock",
                ]
            )
        elif assessment.signs_present_count == 1:
            recommendations.extend(
                [
                    "Moderate risk for organ dysfunction (RR 2.71)",
                    "Close monitoring recommended",
                    "Re-evaluate physical exam in 30-60 minutes",
                    "Lower threshold for escalation",
                ]
            )
        else:
            recommendations.extend(
                [
                    "Continue routine monitoring",
                    "Reassess if clinical status changes",
                ]
            )

        # Specific recommendations based on findings
        if assessment.altered_mental_status.severity in ["severe", "critical"]:
            recommendations.append(
                "URGENT: Severe altered mental status requires immediate evaluation"
            )

        if assessment.abnormal_pulse_quality.severity in ["severe", "critical"]:
            recommendations.append("URGENT: Poor peripheral perfusion - assess for shock")

        return recommendations

    def _calculate_confidence(self, assessment: PhysicalExamAssessment) -> float:
        """Calculate confidence based on completeness of assessment."""
        confidence = 0.5

        # Each finding assessed adds confidence
        if (
            assessment.mental_status != MentalStatus.NORMAL
            or assessment.altered_mental_status.present
        ):
            confidence += 0.15
        if (
            assessment.pulse_quality != PulseQuality.NORMAL
            or assessment.abnormal_pulse_quality.present
        ):
            confidence += 0.15
        if assessment.capillary_refill_seconds is not None:
            confidence += 0.1
        if (
            assessment.skin_perfusion != SkinPerfusion.NORMAL
            or assessment.cold_mottled_extremities.present
        ):
            confidence += 0.1

        return min(0.95, confidence)
