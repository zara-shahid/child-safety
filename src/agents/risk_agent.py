"""
EPCID Risk Agent

Risk stratification using a layered approach:
1. Hard safety rules (override everything)
2. Clinical scoring systems (Phoenix Sepsis, PEWS, Physical Exam)
3. Rule-based clinical logic
4. ML model ensemble (tabular, time-series, multimodal)
5. Uncertainty quantification

Outputs risk tiers: LOW, MODERATE, HIGH, CRITICAL
with confidence intervals and explainability.

Clinical References:
- Phoenix Sepsis Criteria (JAMA 2024)
- Pediatric Early Warning Score (PEWS) multicenter validation
- Physical exam signs for pediatric SIRS (BMC Emergency Medicine)
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, cast

from .. import RISK_CRITICAL, RISK_HIGH, RISK_LOW, RISK_MODERATE
from .base_agent import AgentConfig, AgentResponse, BaseAgent

# Import clinical scoring modules
try:
    from ..clinical.pews import AVPU, PEWSCalculator, WorkOfBreathing
    from ..clinical.phoenix_score import PhoenixScoreCalculator
    from ..clinical.physical_exam import (
        MentalStatus,
        PhysicalExamAssessor,
        PulseQuality,
        SkinPerfusion,
    )
    from ..clinical.vital_signs import VitalSignNormalizer

    CLINICAL_SCORING_AVAILABLE = True
except ImportError:
    CLINICAL_SCORING_AVAILABLE = False
    PhoenixScoreCalculator = Any  # type: ignore
    PEWSCalculator = Any  # type: ignore
    PhysicalExamAssessor = Any  # type: ignore
    VitalSignNormalizer = Any  # type: ignore
    AVPU = Any  # type: ignore
    WorkOfBreathing = Any  # type: ignore
    MentalStatus = Any  # type: ignore
    PulseQuality = Any  # type: ignore
    SkinPerfusion = Any  # type: ignore

logger = logging.getLogger("epcid.agents.risk")


class RuleType(Enum):
    """Types of risk rules."""

    SAFETY = "safety"  # Hard override rules
    CLINICAL = "clinical"  # Clinical guideline rules
    HEURISTIC = "heuristic"  # Experience-based rules


@dataclass
class RiskRule:
    """A risk assessment rule."""

    id: str
    name: str
    rule_type: RuleType
    description: str
    condition: Callable  # Function that takes context and returns (triggered, message)
    risk_tier: str
    priority: int  # Lower = higher priority

    def evaluate(self, context: dict[str, Any]) -> tuple[bool, str | None]:
        """Evaluate the rule. Returns (triggered, message)."""
        try:
            return cast(tuple[bool, str | None], self.condition(context))
        except Exception as e:
            logger.error(f"Rule {self.id} evaluation failed: {e}")
            return False, None


@dataclass
class RiskScore:
    """Risk score from a single model or rule set."""

    source: str  # "rules", "ml_tabular", "ml_temporal", etc.
    score: float  # 0-1
    risk_tier: str
    confidence: float
    explanation: str
    contributing_factors: list[str] = field(default_factory=list)


class RiskAgent(BaseAgent):
    """
    Agent responsible for risk stratification.

    Uses a layered approach:
    1. Safety rules (immediate override for critical conditions)
    2. Clinical scoring systems (Phoenix, PEWS, Physical Exam)
    3. Clinical rules (guideline-based logic)
    4. ML models (learned patterns from data)
    5. Ensemble synthesis with uncertainty

    Always errs on the side of caution (high sensitivity).
    """

    def __init__(
        self,
        config: AgentConfig | None = None,
        enable_ml: bool = True,
        enable_clinical_scoring: bool = True,
        **kwargs: Any,
    ) -> None:
        config = config or AgentConfig(
            name="risk_agent",
            description="Risk stratification with clinical scoring, rules, and ML ensemble",
            priority=3,
            timeout_seconds=30,
            require_explainability=True,
        )
        super().__init__(config, **kwargs)

        self.enable_ml = enable_ml
        self.enable_clinical_scoring = enable_clinical_scoring and CLINICAL_SCORING_AVAILABLE
        self.rules = self._initialize_rules()

        # Initialize clinical scoring calculators
        self.phoenix_calculator: Any = None
        self.pews_calculator: Any = None
        self.physical_exam_assessor: Any = None
        self.vital_normalizer: Any = None

        if self.enable_clinical_scoring:
            self.phoenix_calculator = PhoenixScoreCalculator()
            self.pews_calculator = PEWSCalculator()
            self.physical_exam_assessor = PhysicalExamAssessor()
            self.vital_normalizer = VitalSignNormalizer()
            logger.info("Clinical scoring systems initialized (Phoenix, PEWS, Physical Exam)")
        elif not CLINICAL_SCORING_AVAILABLE:
            logger.warning("Clinical scoring modules not available")

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Perform risk assessment on input data.

        Args:
            input_data: Normalized and phenotyped data
            context: str | None historical context

        Returns:
            AgentResponse with risk tier and explanation
        """
        import uuid

        request_id = str(uuid.uuid4())[:12]

        # Merge input with context

        # Extract key data
        normalized = input_data.get("normalized", input_data)
        phenotypes = input_data.get("phenotypes", [])

        # Build assessment context
        assessment_context = self._build_assessment_context(normalized, phenotypes)

        # Layer 1: Safety rules (hard overrides)
        safety_result = self._evaluate_safety_rules(assessment_context)

        # If safety rule triggered, return immediately with CRITICAL/HIGH
        if safety_result["triggered"]:
            return self._create_safety_override_response(
                request_id,
                safety_result,
                assessment_context,
            )

        # Layer 2: Clinical scoring systems (Phoenix, PEWS, Physical Exam)
        clinical_scoring_result = None
        if self.enable_clinical_scoring:
            clinical_scoring_result = self._evaluate_clinical_scoring(assessment_context)

            # Check if clinical scoring triggers immediate escalation
            if clinical_scoring_result.get("immediate_escalation"):
                return self._create_clinical_scoring_response(
                    request_id,
                    clinical_scoring_result,
                    assessment_context,
                )

        # Layer 3: Clinical rules
        clinical_scores = self._evaluate_clinical_rules(assessment_context)

        # Layer 4: ML models (if enabled)
        ml_scores = []
        if self.enable_ml:
            ml_scores = await self._evaluate_ml_models(assessment_context)

        # Layer 5: Ensemble synthesis
        final_result = self._synthesize_risk(
            clinical_scores,
            ml_scores,
            assessment_context,
            clinical_scoring_result=clinical_scoring_result,
        )

        # Calculate confidence interval
        ci_lower, ci_upper = self._calculate_confidence_interval(final_result)

        # Generate explanation
        explanation = self._generate_explanation(
            final_result,
            clinical_scores,
            ml_scores,
            safety_result,
            clinical_scoring_result,
        )

        # Build response data
        response_data = {
            "risk_tier": final_result["risk_tier"],
            "risk_score": final_result["score"],
            "confidence": final_result["confidence"],
            "confidence_interval": {"lower": ci_lower, "upper": ci_upper},
            "model_scores": {
                "clinical_rules": clinical_scores[0].score if clinical_scores else 0,
                **{s.source: s.score for s in ml_scores},
            },
            "triggered_rules": final_result["triggered_rules"],
            "risk_factors": final_result["risk_factors"],
            "protective_factors": final_result.get("protective_factors", []),
            "uncertainty_factors": final_result.get("uncertainty_factors", []),
            "missing_data": self._identify_missing_data(assessment_context),
        }

        # Add clinical scoring details if available
        if clinical_scoring_result:
            response_data["clinical_scores"] = {
                "phoenix_score": clinical_scoring_result.get("phoenix_total", 0),
                "phoenix_sepsis": clinical_scoring_result.get("meets_sepsis_criteria", False),
                "phoenix_shock": clinical_scoring_result.get("meets_septic_shock_criteria", False),
                "pews_score": clinical_scoring_result.get("pews_total", 0),
                "physical_exam_signs": clinical_scoring_result.get("physical_exam_signs_count", 0),
            }

        return self.create_response(
            request_id=request_id,
            data=response_data,
            confidence=final_result["confidence"],
            explanation=explanation,
            reasoning_chain=self.reason(assessment_context, "risk_assessment"),
        )

    def _build_assessment_context(
        self,
        normalized: dict[str, Any],
        phenotypes: list[dict],
    ) -> dict[str, Any]:
        """Build unified context for risk assessment."""
        context = {
            "symptoms": normalized.get("symptoms", []),
            "vitals": normalized.get("vitals", {}),
            "demographics": normalized.get("demographics", {}),
            "medications": normalized.get("medications", []),
            "environmental": normalized.get("environmental", {}),
            "symptom_duration_hours": normalized.get("symptom_duration_hours", 0),
            # Physical exam data
            "physical_exam": normalized.get("physical_exam", {}),
            # Lab data (for Phoenix scoring)
            "labs": normalized.get("labs", {}),
            # Clinical context
            "suspected_infection": normalized.get("suspected_infection", False),
        }

        # Add phenotype data
        phenotype_dict = {}
        for p in phenotypes:
            if isinstance(p, dict):
                phenotype_dict[p["name"]] = p
        context["phenotypes"] = phenotype_dict

        return context

    def _evaluate_clinical_scoring(
        self,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Evaluate clinical scoring systems: Phoenix, PEWS, Physical Exam.

        Returns combined assessment with recommendations for escalation.
        """
        result: dict[str, Any] = {
            "phoenix_total": 0,
            "meets_sepsis_criteria": False,
            "meets_septic_shock_criteria": False,
            "pews_total": 0,
            "pews_escalation": False,
            "physical_exam_signs_count": 0,
            "physical_exam_rr": 1.0,
            "immediate_escalation": False,
            "risk_level": "low",
            "contributing_factors": [],
            "recommendations": [],
        }

        vitals = context.get("vitals", {})
        demographics = context.get("demographics", {})
        labs = context.get("labs", {})
        physical_exam = context.get("physical_exam", {})
        symptoms = context.get("symptoms", [])
        medications = context.get("medications", [])

        age_months = demographics.get("age_months", 24)

        # ===== Phoenix Sepsis Score =====
        if self.phoenix_calculator:
            try:
                phoenix_score = self.phoenix_calculator.calculate(
                    age_months=age_months,
                    # Respiratory
                    spo2=vitals.get("oxygen_saturation"),
                    fio2=vitals.get("fio2", 0.21),
                    on_invasive_ventilation=vitals.get("on_ventilator", False),
                    # Cardiovascular
                    systolic_bp=vitals.get("systolic_bp"),
                    diastolic_bp=vitals.get("diastolic_bp"),
                    lactate=labs.get("lactate"),
                    vasoactive_medications=[m for m in medications if self._is_vasoactive(m)],
                    # Coagulation
                    platelet_count=labs.get("platelets"),
                    inr=labs.get("inr"),
                    # Neurological
                    gcs_total=physical_exam.get("gcs_total"),
                    avpu=physical_exam.get("avpu"),
                    # Clinical context
                    suspected_infection=context.get("suspected_infection", False),
                )

                result["phoenix_total"] = phoenix_score.total_score
                result["meets_sepsis_criteria"] = phoenix_score.meets_sepsis_criteria
                result["meets_septic_shock_criteria"] = phoenix_score.meets_septic_shock_criteria
                result["phoenix_details"] = {
                    "respiratory": phoenix_score.respiratory.score,
                    "cardiovascular": phoenix_score.cardiovascular.score,
                    "coagulation": phoenix_score.coagulation.score,
                    "neurological": phoenix_score.neurological.score,
                }

                if phoenix_score.meets_septic_shock_criteria:
                    result["immediate_escalation"] = True
                    result["risk_level"] = "critical"
                    result["contributing_factors"].append(
                        f"Phoenix Septic Shock Criteria met (Score: {phoenix_score.total_score})"
                    )
                    result["recommendations"].append(
                        "URGENT: Septic shock - immediate intervention required"
                    )
                elif phoenix_score.meets_sepsis_criteria:
                    result["risk_level"] = "high"
                    result["contributing_factors"].append(
                        f"Phoenix Sepsis Criteria met (Score: {phoenix_score.total_score})"
                    )
                    result["recommendations"].append("Sepsis identified - urgent evaluation needed")

            except Exception as e:
                logger.error(f"Phoenix score calculation error: {e}")

        # ===== PEWS Score =====
        if self.pews_calculator:
            try:
                # Determine work of breathing from symptoms
                wob = WorkOfBreathing.NORMAL
                if any(s in symptoms for s in ["severe_difficulty_breathing", "grunting"]):
                    wob = WorkOfBreathing.SEVERE
                elif any(s in symptoms for s in ["retractions", "accessory_muscle_use"]):
                    wob = WorkOfBreathing.MODERATE
                elif any(s in symptoms for s in ["nasal_flaring", "mild_difficulty_breathing"]):
                    wob = WorkOfBreathing.MILD

                # Determine AVPU
                avpu_str = physical_exam.get("avpu", "A")
                avpu = AVPU.ALERT
                if avpu_str.upper() == "V":
                    avpu = AVPU.VERBAL
                elif avpu_str.upper() == "P":
                    avpu = AVPU.PAIN
                elif avpu_str.upper() == "U":
                    avpu = AVPU.UNRESPONSIVE

                pews_score = self.pews_calculator.calculate(
                    age_months=age_months,
                    heart_rate=vitals.get("heart_rate"),
                    respiratory_rate=vitals.get("respiratory_rate"),
                    oxygen_saturation=vitals.get("oxygen_saturation"),
                    oxygen_requirement=vitals.get("fio2", 0.21),
                    work_of_breathing=wob,
                    capillary_refill_seconds=physical_exam.get("capillary_refill_seconds"),
                    avpu=avpu,
                    parent_concern=context.get("parent_concern", False),
                    grunting="grunting" in symptoms,
                    stridor="stridor" in symptoms,
                    retractions="retractions" in symptoms,
                )

                result["pews_total"] = pews_score.total_score
                result["pews_escalation"] = pews_score.escalation_recommended
                result["pews_details"] = {
                    "cardiovascular": pews_score.cardiovascular.score,
                    "respiratory": pews_score.respiratory.score,
                    "behavior": pews_score.behavior.score,
                }

                if pews_score.rapid_response_threshold:
                    result["immediate_escalation"] = True
                    result["risk_level"] = "critical"
                    result["contributing_factors"].append(
                        f"PEWS Critical (Score: {pews_score.total_score}/9)"
                    )
                    result["recommendations"].extend(pews_score.recommended_actions[:3])
                elif pews_score.escalation_recommended:
                    if result["risk_level"] not in ["critical"]:
                        result["risk_level"] = "high"
                    result["contributing_factors"].append(
                        f"PEWS High Risk (Score: {pews_score.total_score}/9)"
                    )
                    result["recommendations"].extend(pews_score.recommended_actions[:2])
                elif pews_score.total_score >= 3:
                    if result["risk_level"] not in ["critical", "high"]:
                        result["risk_level"] = "moderate"
                    result["contributing_factors"].append(
                        f"PEWS Moderate (Score: {pews_score.total_score}/9)"
                    )

            except Exception as e:
                logger.error(f"PEWS calculation error: {e}")

        # ===== Physical Exam Signs =====
        if self.physical_exam_assessor:
            try:
                # Determine mental status
                mental_status = MentalStatus.NORMAL
                if physical_exam.get("avpu", "A").upper() == "U":
                    mental_status = MentalStatus.UNRESPONSIVE
                elif physical_exam.get("avpu", "A").upper() == "P":
                    mental_status = MentalStatus.SEVERELY_ALTERED
                elif physical_exam.get("avpu", "A").upper() == "V":
                    mental_status = MentalStatus.MILDLY_ALTERED
                elif "lethargic" in symptoms or "decreased_activity" in symptoms:
                    mental_status = MentalStatus.MODERATELY_ALTERED

                # Determine pulse quality
                pulse_quality = PulseQuality.NORMAL
                if "weak_pulses" in symptoms or physical_exam.get("weak_pulses"):
                    pulse_quality = PulseQuality.WEAK
                elif "thready_pulses" in symptoms:
                    pulse_quality = PulseQuality.THREADY

                # Determine skin perfusion
                skin_perfusion = SkinPerfusion.NORMAL
                if "mottled_skin" in symptoms or physical_exam.get("mottled"):
                    skin_perfusion = SkinPerfusion.MOTTLED
                elif "cold_extremities" in symptoms or physical_exam.get("cold_extremities"):
                    skin_perfusion = SkinPerfusion.COLD
                elif "pale" in symptoms:
                    skin_perfusion = SkinPerfusion.PALE

                exam_assessment = self.physical_exam_assessor.assess(
                    mental_status=mental_status,
                    pulse_quality=pulse_quality,
                    capillary_refill_seconds=physical_exam.get("capillary_refill_seconds"),
                    skin_perfusion=skin_perfusion,
                    has_fever=vitals.get("temperature", 37) >= 38.0,
                    has_tachycardia=self._has_tachycardia(vitals.get("heart_rate"), age_months),
                )

                result["physical_exam_signs_count"] = exam_assessment.signs_present_count
                result["physical_exam_rr"] = exam_assessment.composite_relative_risk
                result["physical_exam_details"] = {
                    "altered_mental_status": exam_assessment.altered_mental_status.present,
                    "abnormal_pulse_quality": exam_assessment.abnormal_pulse_quality.present,
                    "prolonged_cap_refill": exam_assessment.prolonged_capillary_refill.present,
                    "cold_mottled_extremities": exam_assessment.cold_mottled_extremities.present,
                }

                # Two or more signs = RR 4.98 for organ dysfunction
                if exam_assessment.signs_present_count >= 2:
                    if result["risk_level"] not in ["critical"]:
                        result["risk_level"] = "high"
                    result["contributing_factors"].append(
                        f"Physical exam: {exam_assessment.signs_present_count} signs (RR {exam_assessment.composite_relative_risk:.1f})"
                    )
                    result["recommendations"].extend(exam_assessment.recommendations[:2])
                elif exam_assessment.signs_present_count == 1:
                    if result["risk_level"] not in ["critical", "high"]:
                        result["risk_level"] = "moderate"
                    result["contributing_factors"].append("Physical exam: 1 sign present (RR 2.71)")

            except Exception as e:
                logger.error(f"Physical exam assessment error: {e}")

        return result

    def _is_vasoactive(self, medication: str) -> bool:
        """Check if a medication is a vasoactive agent."""
        vasoactives = {
            "dobutamine",
            "dopamine",
            "epinephrine",
            "milrinone",
            "norepinephrine",
            "vasopressin",
            "phenylephrine",
            "levophed",
        }
        return any(v in medication.lower() for v in vasoactives)

    def _has_tachycardia(self, heart_rate: int | None, age_months: int) -> bool:
        """Check if heart rate indicates tachycardia for age."""
        if heart_rate is None:
            return False

        # Age-adjusted thresholds
        if age_months < 3:
            return heart_rate > 160
        elif age_months < 12:
            return heart_rate > 150
        elif age_months < 24:
            return heart_rate > 140
        elif age_months < 60:
            return heart_rate > 130
        elif age_months < 144:
            return heart_rate > 120
        else:
            return heart_rate > 110

    def _create_clinical_scoring_response(
        self,
        request_id: str,
        clinical_result: dict[str, Any],
        context: dict[str, Any],
    ) -> AgentResponse:
        """Create response when clinical scoring triggers immediate escalation."""
        risk_tier = RISK_CRITICAL if clinical_result["risk_level"] == "critical" else RISK_HIGH

        explanation_parts = ["## Clinical Scoring Alert\n"]

        if clinical_result.get("meets_septic_shock_criteria"):
            explanation_parts.append("### ⚠️ SEPTIC SHOCK CRITERIA MET")
            explanation_parts.append(f"Phoenix Sepsis Score: {clinical_result['phoenix_total']}")
        elif clinical_result.get("meets_sepsis_criteria"):
            explanation_parts.append("### ⚠️ SEPSIS CRITERIA MET")
            explanation_parts.append(f"Phoenix Sepsis Score: {clinical_result['phoenix_total']}")

        if clinical_result.get("pews_total", 0) >= 7:
            explanation_parts.append(f"\n### PEWS Critical: {clinical_result['pews_total']}/9")

        if clinical_result.get("physical_exam_signs_count", 0) >= 2:
            explanation_parts.append(
                f"\n### Physical Exam: {clinical_result['physical_exam_signs_count']} warning signs"
            )
            explanation_parts.append(
                f"Relative Risk for Organ Dysfunction: {clinical_result['physical_exam_rr']:.1f}"
            )

        explanation_parts.append("\n### Contributing Factors")
        for factor in clinical_result.get("contributing_factors", []):
            explanation_parts.append(f"- {factor}")

        explanation_parts.append("\n### Recommended Actions")
        for rec in clinical_result.get("recommendations", [])[:5]:
            explanation_parts.append(f"- {rec}")

        explanation = "\n".join(explanation_parts)

        return self.create_response(
            request_id=request_id,
            data={
                "risk_tier": risk_tier,
                "risk_score": 0.95 if risk_tier == RISK_CRITICAL else 0.85,
                "confidence": 0.9,
                "confidence_interval": {"lower": 0.85, "upper": 0.98},
                "clinical_scoring_override": True,
                "clinical_scores": {
                    "phoenix_score": clinical_result.get("phoenix_total", 0),
                    "phoenix_sepsis": clinical_result.get("meets_sepsis_criteria", False),
                    "phoenix_shock": clinical_result.get("meets_septic_shock_criteria", False),
                    "pews_score": clinical_result.get("pews_total", 0),
                    "physical_exam_signs": clinical_result.get("physical_exam_signs_count", 0),
                },
                "risk_factors": clinical_result.get("contributing_factors", []),
                "recommendations": clinical_result.get("recommendations", []),
            },
            confidence=0.9,
            explanation=explanation,
            warnings=clinical_result.get("recommendations", [])[:3],
        )

    def _evaluate_safety_rules(self, context: dict[str, Any]) -> dict[str, Any]:
        """Evaluate safety rules for immediate override."""
        triggered_rules = []
        messages = []
        max_risk = None

        safety_rules = [r for r in self.rules if r.rule_type == RuleType.SAFETY]
        safety_rules.sort(key=lambda r: r.priority)

        for rule in safety_rules:
            triggered, message = rule.evaluate(context)
            if triggered:
                triggered_rules.append(rule.id)
                if message:
                    messages.append(message)

                # Track highest risk
                if max_risk is None or self._risk_priority(rule.risk_tier) < self._risk_priority(
                    max_risk
                ):
                    max_risk = rule.risk_tier

        return {
            "triggered": len(triggered_rules) > 0,
            "rules": triggered_rules,
            "messages": messages,
            "risk_tier": max_risk,
        }

    def _evaluate_clinical_rules(self, context: dict[str, Any]) -> list[RiskScore]:
        """Evaluate clinical guideline-based rules."""
        scores = []
        triggered_rules = []
        risk_factors = []

        clinical_rules = [r for r in self.rules if r.rule_type == RuleType.CLINICAL]

        # Track points for scoring
        risk_points = 0
        max_points = len(clinical_rules) * 2

        for rule in clinical_rules:
            triggered, message = rule.evaluate(context)
            if triggered:
                triggered_rules.append(rule.id)
                risk_factors.append(message or rule.description)

                # Add points based on rule risk tier
                if rule.risk_tier == RISK_CRITICAL:
                    risk_points += 4
                elif rule.risk_tier == RISK_HIGH:
                    risk_points += 3
                elif rule.risk_tier == RISK_MODERATE:
                    risk_points += 2
                else:
                    risk_points += 1

        # Calculate score
        score = min(1.0, risk_points / max_points) if max_points > 0 else 0

        # Determine tier from score
        if score >= 0.75:
            tier = RISK_HIGH
        elif score >= 0.5:
            tier = RISK_MODERATE
        elif score >= 0.25:
            tier = RISK_MODERATE
        else:
            tier = RISK_LOW

        scores.append(
            RiskScore(
                source="clinical_rules",
                score=score,
                risk_tier=tier,
                confidence=0.85,
                explanation=f"Clinical rules: {len(triggered_rules)} triggered",
                contributing_factors=risk_factors[:5],
            )
        )

        return scores

    async def _evaluate_ml_models(self, context: dict[str, Any]) -> list[RiskScore]:
        """Evaluate ML models for risk scoring."""
        scores = []

        # Tabular model (simulated)
        tabular_score = self._simulate_tabular_model(context)
        scores.append(tabular_score)

        # Time-series model (if history available)
        if context.get("observation_history"):
            temporal_score = self._simulate_temporal_model(context)
            scores.append(temporal_score)

        # Multimodal (if images/audio available)
        if context.get("has_image") or context.get("has_audio"):
            multimodal_score = self._simulate_multimodal_model(context)
            scores.append(multimodal_score)

        return scores

    def _simulate_tabular_model(self, context: dict[str, Any]) -> RiskScore:
        """Simulate tabular model prediction (placeholder for real model)."""
        # Feature extraction
        features = []
        score = 0.3  # Base score

        # Symptom count
        symptoms = context.get("symptoms", [])
        symptom_weight = min(0.3, len(symptoms) * 0.03)
        score += symptom_weight

        # Fever
        temp = context.get("vitals", {}).get("temperature", 37.0)
        if temp >= 39.0:
            score += 0.2
            features.append(f"High fever: {temp}°C")
        elif temp >= 38.0:
            score += 0.1
            features.append(f"Fever: {temp}°C")

        # Age risk
        age_months = context.get("demographics", {}).get("age_months", 24)
        if age_months < 3:
            score += 0.15
            features.append("Infant <3 months")
        elif age_months < 12:
            score += 0.05

        # Phenotype severity
        phenotypes = context.get("phenotypes", {})
        for name, p in phenotypes.items():
            if isinstance(p, dict) and p.get("severity") == "severe":
                score += 0.1
                features.append(f"Severe {name}")

        score = min(1.0, max(0.0, score))

        # Determine tier
        if score >= 0.8:
            tier = RISK_CRITICAL
        elif score >= 0.6:
            tier = RISK_HIGH
        elif score >= 0.35:
            tier = RISK_MODERATE
        else:
            tier = RISK_LOW

        return RiskScore(
            source="ml_tabular",
            score=score,
            risk_tier=tier,
            confidence=0.75,
            explanation=f"Tabular model score: {score:.2f}",
            contributing_factors=features,
        )

    def _simulate_temporal_model(self, context: dict[str, Any]) -> RiskScore:
        """Simulate temporal model prediction."""
        # Would use LSTM/Transformer on time-series in production
        history = context.get("observation_history", [])

        # Check for worsening trend
        score = 0.4
        features = []

        if len(history) >= 2:
            # Compare recent vs older observations
            history[-3:] if len(history) >= 3 else history[-1:]

            # Check fever trend
            temps = [h.get("vitals", {}).get("temperature", 37) for h in history]
            if temps and temps[-1] > temps[0]:
                score += 0.1
                features.append("Worsening fever trend")

            # Check symptom count trend
            symptom_counts = [len(h.get("symptoms", [])) for h in history]
            if symptom_counts and symptom_counts[-1] > symptom_counts[0]:
                score += 0.1
                features.append("Increasing symptoms")

        score = min(1.0, max(0.0, score))

        if score >= 0.7:
            tier = RISK_HIGH
        elif score >= 0.4:
            tier = RISK_MODERATE
        else:
            tier = RISK_LOW

        return RiskScore(
            source="ml_temporal",
            score=score,
            risk_tier=tier,
            confidence=0.7,
            explanation=f"Temporal model score: {score:.2f}",
            contributing_factors=features,
        )

    def _simulate_multimodal_model(self, context: dict[str, Any]) -> RiskScore:
        """Simulate multimodal model prediction."""
        # Would process images/audio in production
        score = 0.35
        features = []

        if context.get("has_image"):
            features.append("Image analysis available")

        if context.get("has_audio"):
            features.append("Audio analysis available")

        return RiskScore(
            source="ml_multimodal",
            score=score,
            risk_tier=RISK_LOW,
            confidence=0.6,
            explanation="Multimodal analysis",
            contributing_factors=features,
        )

    def _synthesize_risk(
        self,
        clinical_scores: list[RiskScore],
        ml_scores: list[RiskScore],
        context: dict[str, Any],
        clinical_scoring_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Synthesize final risk from all sources including clinical scoring."""
        all_scores = clinical_scores + ml_scores

        if not all_scores and not clinical_scoring_result:
            return {
                "risk_tier": RISK_LOW,
                "score": 0.2,
                "confidence": 0.5,
                "triggered_rules": [],
                "risk_factors": [],
                "uncertainty_factors": ["Limited data available"],
            }

        # Weighted ensemble - clinical scoring gets highest weight
        weights = {
            "clinical_scoring": 0.35,  # Phoenix, PEWS, Physical Exam
            "clinical_rules": 0.30,
            "ml_tabular": 0.20,
            "ml_temporal": 0.10,
            "ml_multimodal": 0.05,
        }

        total_weight = 0.0
        weighted_score = 0.0
        all_factors = []

        # Add clinical scoring contribution
        if clinical_scoring_result:
            clinical_scoring_score = self._clinical_scoring_to_score(clinical_scoring_result)
            weighted_score += clinical_scoring_score * weights["clinical_scoring"]
            total_weight += weights["clinical_scoring"]
            all_factors.extend(clinical_scoring_result.get("contributing_factors", []))

        for score in all_scores:
            weight = weights.get(score.source, 0.1)
            weighted_score += score.score * weight
            total_weight += weight
            all_factors.extend(score.contributing_factors)

        final_score = weighted_score / total_weight if total_weight > 0 else 0.3

        # Determine tier from clinical scoring first (most authoritative)
        final_tier = RISK_LOW
        if clinical_scoring_result:
            clinical_tier = self._clinical_scoring_to_tier(clinical_scoring_result)
            final_tier = clinical_tier

        # Then consider rule-based and ML tiers
        tier_priority = {RISK_CRITICAL: 0, RISK_HIGH: 1, RISK_MODERATE: 2, RISK_LOW: 3}
        if all_scores:
            max_model_tier = max(
                (s.risk_tier for s in all_scores),
                key=lambda t: -tier_priority.get(t, 4),
            )
            # Take the more severe tier
            if tier_priority.get(max_model_tier, 4) < tier_priority.get(final_tier, 4):
                final_tier = max_model_tier

        # Adjust tier based on score for consistency
        if final_score >= 0.8 and final_tier not in [RISK_CRITICAL]:
            final_tier = RISK_HIGH
        elif final_score >= 0.6 and final_tier == RISK_LOW:
            final_tier = RISK_MODERATE

        # Calculate confidence
        confidences = [s.confidence for s in all_scores]
        if clinical_scoring_result:
            # Clinical scoring confidence based on data completeness
            clinical_confidence = (
                0.85 if clinical_scoring_result.get("phoenix_total", 0) > 0 else 0.7
            )
            confidences.append(clinical_confidence)

        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.5

        # Reduce confidence if scores disagree
        if all_scores:
            score_values = [s.score for s in all_scores]
            if clinical_scoring_result:
                score_values.append(self._clinical_scoring_to_score(clinical_scoring_result))
            score_variance = sum((s - final_score) ** 2 for s in score_values) / len(score_values)
            if score_variance > 0.05:
                avg_confidence -= 0.1

        # Identify protective factors
        protective = []
        symptoms = context.get("symptoms", [])
        if "eating_well" in symptoms or context.get("good_appetite"):
            protective.append("Maintaining appetite")
        if "drinking_well" in symptoms or context.get("good_hydration"):
            protective.append("Good hydration")
        if context.get("vitals", {}).get("oxygen_saturation", 100) >= 97:
            protective.append("Normal oxygen saturation")
        if context.get("vitals", {}).get("temperature", 37) < 38.0:
            protective.append("No fever")

        return {
            "risk_tier": final_tier,
            "score": final_score,
            "confidence": max(0.3, min(0.95, avg_confidence)),
            "triggered_rules": [s.source for s in clinical_scores if s.score > 0.3],
            "risk_factors": list(set(all_factors))[:10],
            "protective_factors": protective,
            "uncertainty_factors": self._identify_uncertainty_factors(context, all_scores),
        }

    def _clinical_scoring_to_score(self, result: dict[str, Any]) -> float:
        """Convert clinical scoring result to 0-1 score."""
        score = 0.2  # Base score

        # Phoenix contribution
        phoenix_total = result.get("phoenix_total", 0)
        if result.get("meets_septic_shock_criteria"):
            score = max(score, 0.95)
        elif result.get("meets_sepsis_criteria"):
            score = max(score, 0.85)
        elif phoenix_total >= 1:
            score = max(score, 0.5 + phoenix_total * 0.1)

        # PEWS contribution
        pews_total = result.get("pews_total", 0)
        if pews_total >= 7:
            score = max(score, 0.9)
        elif pews_total >= 5:
            score = max(score, 0.75)
        elif pews_total >= 3:
            score = max(score, 0.5)

        # Physical exam contribution
        exam_signs = result.get("physical_exam_signs_count", 0)
        if exam_signs >= 2:
            score = max(score, 0.7)
        elif exam_signs >= 1:
            score = max(score, 0.45)

        return min(1.0, score)

    def _clinical_scoring_to_tier(self, result: dict[str, Any]) -> str:
        """Convert clinical scoring result to risk tier."""
        if result.get("meets_septic_shock_criteria"):
            return RISK_CRITICAL
        if result.get("meets_sepsis_criteria"):
            return RISK_HIGH
        if result.get("pews_total", 0) >= 7:
            return RISK_CRITICAL
        if result.get("pews_total", 0) >= 5:
            return RISK_HIGH
        if result.get("physical_exam_signs_count", 0) >= 2:
            return RISK_HIGH
        if result.get("pews_total", 0) >= 3 or result.get("physical_exam_signs_count", 0) >= 1:
            return RISK_MODERATE
        return RISK_LOW

    def _calculate_confidence_interval(
        self,
        result: dict[str, Any],
    ) -> tuple[float, float]:
        """Calculate confidence interval for risk score."""
        score = result["score"]
        confidence = result["confidence"]

        # Width based on confidence
        width = 0.15 * (1 - confidence) + 0.05

        lower = max(0.0, score - width)
        upper = min(1.0, score + width)

        return lower, upper

    def _identify_missing_data(self, context: dict[str, Any]) -> list[str]:
        """Identify missing data that would improve assessment."""
        missing = []

        if not context.get("vitals", {}).get("temperature"):
            missing.append("Temperature measurement")

        if not context.get("demographics", {}).get("age_months"):
            missing.append("Child's age")

        if not context.get("symptom_duration_hours"):
            missing.append("Duration of symptoms")

        if not context.get("medications"):
            missing.append("Current medications")

        if not context.get("observation_history"):
            missing.append("Historical observations for trend analysis")

        return missing

    def _identify_uncertainty_factors(
        self,
        context: dict[str, Any],
        scores: list[RiskScore],
    ) -> list[str]:
        """Identify factors increasing uncertainty."""
        factors = []

        # Missing data
        if not context.get("vitals"):
            factors.append("No vital signs available")

        if not context.get("symptom_duration_hours"):
            factors.append("Unknown symptom duration")

        # Score disagreement
        if scores:
            score_values = [s.score for s in scores]
            if max(score_values) - min(score_values) > 0.3:
                factors.append("Model predictions disagree")

        # Low confidence scores
        if scores and any(s.confidence < 0.6 for s in scores):
            factors.append("Some models have low confidence")

        return factors

    def _create_safety_override_response(
        self,
        request_id: str,
        safety_result: dict[str, Any],
        context: dict[str, Any],
    ) -> AgentResponse:
        """Create response when safety rule triggers."""
        risk_tier = safety_result["risk_tier"]

        explanation = f"""## ⚠️ SAFETY ALERT

**Risk Tier:** {risk_tier}
**Triggered Rules:** {', '.join(safety_result['rules'])}

### Critical Findings
{chr(10).join('- ' + m for m in safety_result['messages'])}

### Immediate Action Required
This assessment has triggered safety rules that indicate a potentially serious condition.
Please seek medical evaluation immediately.
"""

        return self.create_response(
            request_id=request_id,
            data={
                "risk_tier": risk_tier,
                "risk_score": 1.0 if risk_tier == RISK_CRITICAL else 0.85,
                "confidence": 0.95,
                "confidence_interval": {"lower": 0.9, "upper": 1.0},
                "safety_override": True,
                "triggered_rules": safety_result["rules"],
                "risk_factors": safety_result["messages"],
                "model_scores": {},
            },
            confidence=0.95,
            explanation=explanation,
            warnings=safety_result["messages"],
        )

    def _risk_priority(self, tier: str) -> int:
        """Get priority for risk tier (lower = higher priority)."""
        priorities = {RISK_CRITICAL: 0, RISK_HIGH: 1, RISK_MODERATE: 2, RISK_LOW: 3}
        return priorities.get(tier, 4)

    def _generate_explanation(
        self,
        result: dict[str, Any],
        clinical_scores: list[RiskScore],
        ml_scores: list[RiskScore],
        safety_result: dict[str, Any],
        clinical_scoring_result: dict[str, Any] | None = None,
    ) -> str:
        """Generate explanation of risk assessment."""
        lines = ["## Risk Assessment\n"]

        tier = result["risk_tier"]
        tier_emoji = {
            RISK_CRITICAL: "🔴",
            RISK_HIGH: "🟠",
            RISK_MODERATE: "🟡",
            RISK_LOW: "🟢",
        }

        lines.append(f"### {tier_emoji.get(tier, '⚪')} Risk Tier: {tier}")
        lines.append(f"**Score:** {result['score']:.0%}")
        lines.append(f"**Confidence:** {result['confidence']:.0%}")

        # Clinical Scoring Section
        if clinical_scoring_result:
            lines.append("\n### Clinical Scoring Systems")

            # Phoenix Score
            phoenix_total = clinical_scoring_result.get("phoenix_total", 0)
            phoenix_details = clinical_scoring_result.get("phoenix_details", {})
            lines.append(f"\n**Phoenix Sepsis Score:** {phoenix_total}")
            if phoenix_details:
                lines.append(f"  - Respiratory: {phoenix_details.get('respiratory', 0)}/3")
                lines.append(f"  - Cardiovascular: {phoenix_details.get('cardiovascular', 0)}/6")
                lines.append(f"  - Coagulation: {phoenix_details.get('coagulation', 0)}/2")
                lines.append(f"  - Neurological: {phoenix_details.get('neurological', 0)}/2")

            if clinical_scoring_result.get("meets_septic_shock_criteria"):
                lines.append("  - ⚠️ **SEPTIC SHOCK CRITERIA MET**")
            elif clinical_scoring_result.get("meets_sepsis_criteria"):
                lines.append("  - ⚠️ **SEPSIS CRITERIA MET**")

            # PEWS Score
            pews_total = clinical_scoring_result.get("pews_total", 0)
            pews_details = clinical_scoring_result.get("pews_details", {})
            lines.append(f"\n**PEWS Score:** {pews_total}/9")
            if pews_details:
                lines.append(f"  - Cardiovascular: {pews_details.get('cardiovascular', 0)}/3")
                lines.append(f"  - Respiratory: {pews_details.get('respiratory', 0)}/3")
                lines.append(f"  - Behavior: {pews_details.get('behavior', 0)}/3")

            if pews_total >= 7:
                lines.append("  - ⚠️ **CRITICAL - Rapid Response Threshold**")
            elif pews_total >= 5:
                lines.append("  - ⚠️ **HIGH - Escalation Recommended**")

            # Physical Exam Signs
            exam_signs = clinical_scoring_result.get("physical_exam_signs_count", 0)
            exam_rr = clinical_scoring_result.get("physical_exam_rr", 1.0)
            exam_details = clinical_scoring_result.get("physical_exam_details", {})
            lines.append(f"\n**Physical Exam Warning Signs:** {exam_signs}")
            if exam_details:
                if exam_details.get("altered_mental_status"):
                    lines.append("  - ✓ Altered mental status")
                if exam_details.get("abnormal_pulse_quality"):
                    lines.append("  - ✓ Abnormal peripheral pulse quality")
                if exam_details.get("prolonged_cap_refill"):
                    lines.append("  - ✓ Prolonged capillary refill (>2s)")
                if exam_details.get("cold_mottled_extremities"):
                    lines.append("  - ✓ Cold/mottled extremities")

            if exam_signs >= 2:
                lines.append(f"  - ⚠️ **RR {exam_rr:.1f} for Organ Dysfunction**")

        if result.get("risk_factors"):
            lines.append("\n### Risk Factors")
            for factor in result["risk_factors"][:5]:
                lines.append(f"- {factor}")

        if result.get("protective_factors"):
            lines.append("\n### Protective Factors")
            for factor in result["protective_factors"]:
                lines.append(f"- {factor}")

        if result.get("uncertainty_factors"):
            lines.append("\n### Uncertainty")
            for factor in result["uncertainty_factors"]:
                lines.append(f"- {factor}")

        # Model contributions
        all_scores = clinical_scores + ml_scores
        if all_scores:
            lines.append("\n### Model Contributions")
            if clinical_scoring_result:
                clinical_score = self._clinical_scoring_to_score(clinical_scoring_result)
                lines.append(f"- Clinical Scoring (Phoenix/PEWS/Exam): {clinical_score:.0%}")
            for score in all_scores:
                lines.append(f"- {score.source}: {score.score:.0%}")

        return "\n".join(lines)

    def _initialize_rules(self) -> list[RiskRule]:
        """Initialize risk assessment rules."""
        rules = []

        # ===== SAFETY RULES (immediate override) =====

        # Critical symptoms
        def check_critical_symptoms(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            critical = ["cyanosis", "unresponsive", "seizure", "apnea", "not_breathing"]
            found = [s for s in critical if s in symptoms]
            if found:
                return True, f"Critical symptom: {', '.join(found)}"
            return False, None

        rules.append(
            RiskRule(
                id="SAFETY_CRITICAL_SYMPTOM",
                name="Critical Symptom",
                rule_type=RuleType.SAFETY,
                description="Critical symptoms requiring immediate attention",
                condition=check_critical_symptoms,
                risk_tier=RISK_CRITICAL,
                priority=1,
            )
        )

        # Infant fever (<3 months with ANY fever)
        def check_infant_fever(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            age = ctx.get("demographics", {}).get("age_months", 99)
            temp = ctx.get("vitals", {}).get("temperature", 37)
            if age < 3 and temp >= 38.0:
                return True, f"Fever ({temp}°C) in infant <3 months - requires immediate evaluation"
            return False, None

        rules.append(
            RiskRule(
                id="SAFETY_INFANT_FEVER",
                name="Infant Fever",
                rule_type=RuleType.SAFETY,
                description="Fever in infant under 3 months",
                condition=check_infant_fever,
                risk_tier=RISK_CRITICAL,
                priority=2,
            )
        )

        # Severe respiratory distress
        def check_respiratory_distress(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            spo2 = ctx.get("vitals", {}).get("oxygen_saturation", 100)

            severe_resp = [
                "severe_difficulty_breathing",
                "stridor",
                "apnea",
                "grunting",
                "head_bobbing",
            ]
            if any(s in symptoms for s in severe_resp) or spo2 < 92:
                return True, "Severe respiratory distress or hypoxia (SpO2 <92%)"
            return False, None

        rules.append(
            RiskRule(
                id="SAFETY_RESPIRATORY",
                name="Respiratory Distress",
                rule_type=RuleType.SAFETY,
                description="Severe respiratory distress",
                condition=check_respiratory_distress,
                risk_tier=RISK_CRITICAL,
                priority=3,
            )
        )

        # Shock signs (based on physical exam research)
        def check_shock_signs(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            physical_exam = ctx.get("physical_exam", {})
            symptoms = ctx.get("symptoms", [])

            shock_signs = 0
            details = []

            # Altered mental status
            avpu = physical_exam.get("avpu", "A")
            if avpu.upper() in ["P", "U"]:
                shock_signs += 1
                details.append("Significantly altered mental status")
            elif "lethargic" in symptoms or "unresponsive" in symptoms:
                shock_signs += 1
                details.append("Altered mental status")

            # Poor perfusion
            if physical_exam.get("weak_pulses") or "weak_pulses" in symptoms:
                shock_signs += 1
                details.append("Weak peripheral pulses")

            if physical_exam.get("mottled") or "mottled_skin" in symptoms:
                shock_signs += 1
                details.append("Mottled skin")

            if physical_exam.get("cold_extremities") or "cold_extremities" in symptoms:
                shock_signs += 1
                details.append("Cold extremities")

            cap_refill = physical_exam.get("capillary_refill_seconds", 2)
            if cap_refill > 4:
                shock_signs += 1
                details.append(f"Severely prolonged cap refill ({cap_refill}s)")

            if shock_signs >= 2:
                return True, f"Multiple shock signs: {', '.join(details)}"
            return False, None

        rules.append(
            RiskRule(
                id="SAFETY_SHOCK_SIGNS",
                name="Shock Signs",
                rule_type=RuleType.SAFETY,
                description="Multiple signs of shock/poor perfusion",
                condition=check_shock_signs,
                risk_tier=RISK_CRITICAL,
                priority=4,
            )
        )

        # Severe dehydration
        def check_severe_dehydration(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            ctx.get("physical_exam", {})

            severe_signs = ["sunken_fontanelle", "sunken_eyes", "no_tears", "very_dry_mouth"]
            count = sum(1 for s in severe_signs if s in symptoms)

            # Also check for no urine output
            if "no_urine_8_hours" in symptoms or "no_wet_diapers" in symptoms:
                count += 1

            if count >= 3:
                return True, f"Severe dehydration ({count} signs present)"
            return False, None

        rules.append(
            RiskRule(
                id="SAFETY_SEVERE_DEHYDRATION",
                name="Severe Dehydration",
                rule_type=RuleType.SAFETY,
                description="Signs of severe dehydration",
                condition=check_severe_dehydration,
                risk_tier=RISK_CRITICAL,
                priority=5,
            )
        )

        # ===== CLINICAL RULES =====

        # High fever
        def check_high_fever(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            temp = ctx.get("vitals", {}).get("temperature", 37)
            if temp >= 40.0:
                return True, f"Very high fever: {temp}°C"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_HIGH_FEVER",
                name="High Fever",
                rule_type=RuleType.CLINICAL,
                description="Temperature ≥40°C",
                condition=check_high_fever,
                risk_tier=RISK_HIGH,
                priority=10,
            )
        )

        # Prolonged fever
        def check_prolonged_fever(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            temp = ctx.get("vitals", {}).get("temperature", 37)
            duration = ctx.get("symptom_duration_hours", 0)
            if temp >= 38.0 and duration >= 72:
                return True, "Fever persisting >72 hours"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_PROLONGED_FEVER",
                name="Prolonged Fever",
                rule_type=RuleType.CLINICAL,
                description="Fever >72 hours",
                condition=check_prolonged_fever,
                risk_tier=RISK_MODERATE,
                priority=15,
            )
        )

        # Fever in 3-6 month infant (elevated concern but not critical)
        def check_young_infant_fever(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            age = ctx.get("demographics", {}).get("age_months", 99)
            temp = ctx.get("vitals", {}).get("temperature", 37)
            if 3 <= age < 6 and temp >= 38.5:
                return True, f"Fever ({temp}°C) in infant 3-6 months"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_YOUNG_INFANT_FEVER",
                name="Young Infant Fever",
                rule_type=RuleType.CLINICAL,
                description="Fever in 3-6 month infant",
                condition=check_young_infant_fever,
                risk_tier=RISK_HIGH,
                priority=11,
            )
        )

        # Dehydration signs
        def check_dehydration(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            signs = ["decreased_urine", "dry_mouth", "no_tears", "sunken_eyes", "dry_diaper"]
            count = sum(1 for s in signs if s in symptoms)
            if count >= 2:
                return True, f"Multiple dehydration signs ({count})"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_DEHYDRATION",
                name="Dehydration",
                rule_type=RuleType.CLINICAL,
                description="Signs of dehydration",
                condition=check_dehydration,
                risk_tier=RISK_MODERATE,
                priority=12,
            )
        )

        # Young age with illness
        def check_young_age(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            age = ctx.get("demographics", {}).get("age_months", 99)
            symptoms = ctx.get("symptoms", [])
            if age < 6 and len(symptoms) >= 2:
                return True, "Infant <6 months with multiple symptoms"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_YOUNG_AGE",
                name="Young Age Risk",
                rule_type=RuleType.CLINICAL,
                description="Young infant with illness",
                condition=check_young_age,
                risk_tier=RISK_MODERATE,
                priority=14,
            )
        )

        # Multiple symptoms
        def check_symptom_count(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            if len(symptoms) >= 5:
                return True, f"Multiple symptoms ({len(symptoms)})"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_SYMPTOM_COUNT",
                name="Symptom Count",
                rule_type=RuleType.CLINICAL,
                description="Multiple concurrent symptoms",
                condition=check_symptom_count,
                risk_tier=RISK_MODERATE,
                priority=16,
            )
        )

        # Tachycardia (age-adjusted)
        def check_tachycardia(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            hr = ctx.get("vitals", {}).get("heart_rate")
            age = ctx.get("demographics", {}).get("age_months", 24)
            if hr and self._has_tachycardia(hr, age):
                return True, f"Tachycardia (HR {hr}) for age"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_TACHYCARDIA",
                name="Tachycardia",
                rule_type=RuleType.CLINICAL,
                description="Age-adjusted tachycardia",
                condition=check_tachycardia,
                risk_tier=RISK_MODERATE,
                priority=17,
            )
        )

        # Respiratory distress (moderate)
        def check_moderate_respiratory(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            spo2 = ctx.get("vitals", {}).get("oxygen_saturation", 100)

            moderate_signs = ["difficulty_breathing", "retractions", "nasal_flaring", "wheezing"]
            has_moderate = any(s in symptoms for s in moderate_signs)
            low_spo2 = 92 <= spo2 < 95

            if has_moderate or low_spo2:
                return True, "Moderate respiratory distress"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_MODERATE_RESPIRATORY",
                name="Moderate Respiratory Distress",
                rule_type=RuleType.CLINICAL,
                description="Signs of moderate respiratory distress",
                condition=check_moderate_respiratory,
                risk_tier=RISK_MODERATE,
                priority=13,
            )
        )

        # Petechial or purpuric rash with fever (concern for meningococcemia)
        def check_petechial_rash(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            temp = ctx.get("vitals", {}).get("temperature", 37)

            rash_signs = ["petechiae", "purpura", "non_blanching_rash"]
            has_rash = any(s in symptoms for s in rash_signs)

            if has_rash and temp >= 38.0:
                return (
                    True,
                    "Petechial/purpuric rash with fever - concern for serious bacterial infection",
                )
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_PETECHIAL_RASH",
                name="Petechial Rash with Fever",
                rule_type=RuleType.CLINICAL,
                description="Non-blanching rash with fever",
                condition=check_petechial_rash,
                risk_tier=RISK_HIGH,
                priority=9,
            )
        )

        # Neck stiffness with fever (concern for meningitis)
        def check_meningeal_signs(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            temp = ctx.get("vitals", {}).get("temperature", 37)

            meningeal = ["neck_stiffness", "photophobia", "severe_headache", "bulging_fontanelle"]
            has_meningeal = any(s in symptoms for s in meningeal)

            if has_meningeal and temp >= 38.0:
                return True, "Meningeal signs with fever - concern for meningitis"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_MENINGEAL_SIGNS",
                name="Meningeal Signs",
                rule_type=RuleType.CLINICAL,
                description="Signs of possible meningitis",
                condition=check_meningeal_signs,
                risk_tier=RISK_HIGH,
                priority=8,
            )
        )

        # Single physical exam warning sign (RR 2.71)
        def check_single_exam_sign(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            physical_exam = ctx.get("physical_exam", {})
            symptoms = ctx.get("symptoms", [])

            signs_count = 0

            # Altered mental status
            if physical_exam.get("avpu", "A").upper() in ["V", "P", "U"]:
                signs_count += 1
            elif any(s in symptoms for s in ["lethargic", "irritable", "inconsolable"]):
                signs_count += 1

            # Weak pulses
            if physical_exam.get("weak_pulses") or "weak_pulses" in symptoms:
                signs_count += 1

            # Prolonged cap refill
            cap_refill = physical_exam.get("capillary_refill_seconds", 2)
            if cap_refill > 2:
                signs_count += 1

            # Cold/mottled extremities
            if physical_exam.get("cold_extremities") or physical_exam.get("mottled"):
                signs_count += 1
            elif any(s in symptoms for s in ["cold_extremities", "mottled_skin"]):
                signs_count += 1

            if signs_count == 1:
                return True, "Physical exam warning sign present (RR 2.71 for organ dysfunction)"
            return False, None

        rules.append(
            RiskRule(
                id="CLINICAL_SINGLE_EXAM_SIGN",
                name="Single Physical Exam Sign",
                rule_type=RuleType.CLINICAL,
                description="One physical exam warning sign (validated)",
                condition=check_single_exam_sign,
                risk_tier=RISK_MODERATE,
                priority=18,
            )
        )

        return rules
