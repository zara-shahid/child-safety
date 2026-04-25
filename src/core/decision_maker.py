"""
EPCID Decision Maker

Risk-aware decision synthesis for clinical decision support:
- Aggregates signals from multiple agents
- Applies safety rules with hard overrides
- Generates explainable, actionable decisions
- Maintains uncertainty awareness throughout

This is NOT a diagnostic system - it supports, not replaces, clinical judgment.
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, cast

# Risk level constants
RISK_LOW = "low"
RISK_MODERATE = "moderate"
RISK_HIGH = "high"
RISK_CRITICAL = "critical"

logger = logging.getLogger("epcid.core.decision_maker")


class DecisionType(Enum):
    """Types of decisions the system can make."""

    RISK_CLASSIFICATION = "risk_classification"
    ESCALATION = "escalation"
    CARE_RECOMMENDATION = "care_recommendation"
    DATA_REQUEST = "data_request"
    MONITORING_ADJUSTMENT = "monitoring_adjustment"
    EDUCATION = "education"


class UrgencyLevel(Enum):
    """Urgency levels for actions."""

    EMERGENCY = "emergency"  # Immediate (911)
    URGENT = "urgent"  # Within hours
    SEMI_URGENT = "semi_urgent"  # Within 24 hours
    ROUTINE = "routine"  # Scheduled
    INFORMATIONAL = "informational"  # No action required


@dataclass
class RiskAssessment:
    """
    Comprehensive risk assessment output.

    Includes risk tier, confidence, uncertainty factors,
    and explainable evidence for the assessment.
    """

    id: str
    child_id: str
    risk_tier: str
    confidence: float
    confidence_interval: tuple[float, float]

    # Evidence and explanation
    primary_factors: list[str]
    secondary_factors: list[str]
    protective_factors: list[str]
    uncertainty_factors: list[str]

    # Missing data that would improve assessment
    missing_data: list[str]

    # Safety rule results
    safety_rules_triggered: list[str]
    safety_rule_override: bool

    # Model contributions
    model_scores: dict[str, float]

    # Temporal context
    trend_direction: str  # improving, stable, worsening, unknown
    trend_confidence: float

    # Metadata
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    assessment_version: str = "1.0"

    def get_explanation(self) -> str:
        """Generate human-readable explanation."""
        lines = [
            f"## Risk Assessment: {self.risk_tier}",
            f"**Confidence:** {self.confidence:.0%} ({self.confidence_interval[0]:.0%} - {self.confidence_interval[1]:.0%})",
            "",
        ]

        if self.safety_rules_triggered:
            lines.append("### ⚠️ Safety Alerts")
            for rule in self.safety_rules_triggered:
                lines.append(f"- {rule}")
            lines.append("")

        if self.primary_factors:
            lines.append("### Primary Concerns")
            for factor in self.primary_factors:
                lines.append(f"- {factor}")
            lines.append("")

        if self.uncertainty_factors:
            lines.append("### Uncertainty Factors")
            for factor in self.uncertainty_factors:
                lines.append(f"- {factor}")
            lines.append("")

        if self.missing_data:
            lines.append("### Additional Data Would Help")
            for item in self.missing_data:
                lines.append(f"- {item}")

        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "child_id": self.child_id,
            "risk_tier": self.risk_tier,
            "confidence": self.confidence,
            "confidence_interval": list(self.confidence_interval),
            "primary_factors": self.primary_factors,
            "secondary_factors": self.secondary_factors,
            "protective_factors": self.protective_factors,
            "uncertainty_factors": self.uncertainty_factors,
            "missing_data": self.missing_data,
            "safety_rules_triggered": self.safety_rules_triggered,
            "safety_rule_override": self.safety_rule_override,
            "model_scores": self.model_scores,
            "trend_direction": self.trend_direction,
            "trend_confidence": self.trend_confidence,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class Decision:
    """
    A decision output from the decision maker.

    Includes the decision itself, supporting evidence,
    recommended actions, and explicit uncertainty.
    """

    id: str
    decision_type: DecisionType
    summary: str
    urgency: UrgencyLevel

    # Risk assessment (if applicable)
    risk_assessment: RiskAssessment | None

    # Recommended actions
    recommended_actions: list[str]
    contraindicated_actions: list[str]

    # Supporting information
    evidence: list[str]
    guidelines_referenced: list[str]

    # Confidence and uncertainty
    confidence: float
    uncertainty_statement: str

    # Safety disclaimers
    disclaimers: list[str]

    # Follow-up
    follow_up_recommendations: list[str]
    escalation_criteria: list[str]

    # Metadata
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "decision_type": self.decision_type.value,
            "summary": self.summary,
            "urgency": self.urgency.value,
            "risk_assessment": self.risk_assessment.to_dict() if self.risk_assessment else None,
            "recommended_actions": self.recommended_actions,
            "contraindicated_actions": self.contraindicated_actions,
            "evidence": self.evidence,
            "guidelines_referenced": self.guidelines_referenced,
            "confidence": self.confidence,
            "uncertainty_statement": self.uncertainty_statement,
            "disclaimers": self.disclaimers,
            "follow_up_recommendations": self.follow_up_recommendations,
            "escalation_criteria": self.escalation_criteria,
            "timestamp": self.timestamp.isoformat(),
        }


class SafetyRule:
    """A safety rule that can trigger hard overrides."""

    def __init__(
        self,
        name: str,
        description: str,
        check_function: Callable,
        override_to_risk: str = RISK_CRITICAL,
        urgency: UrgencyLevel = UrgencyLevel.EMERGENCY,
    ):
        self.name = name
        self.description = description
        self.check_function = check_function
        self.override_to_risk = override_to_risk
        self.urgency = urgency

    def check(self, context: dict[str, Any]) -> tuple[bool, str | None]:
        """Check if rule is triggered. Returns (triggered, message)."""
        try:
            return cast(tuple[bool, str | None], self.check_function(context))
        except Exception as e:
            logger.error(f"Safety rule {self.name} check failed: {e}")
            return False, None


class DecisionMaker:
    """
    Central decision-making component for EPCID.

    Synthesizes inputs from multiple agents into actionable,
    explainable decisions with appropriate uncertainty handling.
    """

    # Standard disclaimers
    STANDARD_DISCLAIMERS = [
        "This assessment is for informational purposes only and does not constitute medical advice.",
        "Always consult with a qualified healthcare provider for medical decisions.",
        "If you believe this is an emergency, call 911 immediately.",
    ]

    def __init__(
        self,
        enable_safety_rules: bool = True,
        min_confidence_threshold: float = 0.5,
        uncertainty_penalty: float = 0.1,
    ):
        self.enable_safety_rules = enable_safety_rules
        self.min_confidence_threshold = min_confidence_threshold
        self.uncertainty_penalty = uncertainty_penalty

        # Initialize safety rules
        self.safety_rules = self._initialize_safety_rules()

        logger.info("Initialized DecisionMaker")

    def make_decision(
        self,
        context: dict[str, Any],
        agent_outputs: dict[str, Any],
        decision_type: DecisionType = DecisionType.RISK_CLASSIFICATION,
    ) -> Decision:
        """
        Make a decision based on context and agent outputs.

        Args:
            context: Input context including symptoms, vitals, demographics
            agent_outputs: Outputs from various agents
            decision_type: Type of decision to make

        Returns:
            Decision object with recommendations and explanations
        """
        import uuid

        logger.info(f"Making {decision_type.value} decision")

        # Check safety rules first (hard overrides)
        safety_triggered, safety_messages, override_risk = self._check_safety_rules(context)

        # Perform risk assessment
        risk_assessment = self._assess_risk(
            context,
            agent_outputs,
            safety_triggered,
            safety_messages,
            override_risk,
        )

        # Determine urgency
        urgency = self._determine_urgency(risk_assessment, safety_triggered)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            risk_assessment,
            urgency,
            context,
        )

        # Generate evidence summary
        evidence = self._summarize_evidence(agent_outputs, risk_assessment)

        # Generate uncertainty statement
        uncertainty_statement = self._generate_uncertainty_statement(risk_assessment)

        # Create decision
        decision = Decision(
            id=str(uuid.uuid4())[:12],
            decision_type=decision_type,
            summary=self._generate_summary(risk_assessment, urgency),
            urgency=urgency,
            risk_assessment=risk_assessment,
            recommended_actions=recommendations["actions"],
            contraindicated_actions=recommendations["contraindicated"],
            evidence=evidence,
            guidelines_referenced=recommendations.get("guidelines", []),
            confidence=risk_assessment.confidence,
            uncertainty_statement=uncertainty_statement,
            disclaimers=self.STANDARD_DISCLAIMERS.copy(),
            follow_up_recommendations=recommendations["follow_up"],
            escalation_criteria=recommendations["escalation_criteria"],
            metadata={
                "safety_triggered": safety_triggered,
                "agent_outputs_count": len(agent_outputs),
            },
        )

        logger.info(f"Decision {decision.id}: {risk_assessment.risk_tier}, urgency={urgency.value}")
        return decision

    def _check_safety_rules(
        self,
        context: dict[str, Any],
    ) -> tuple[list[str], list[str], str | None]:
        """Check all safety rules. Returns (triggered_rules, messages, override_risk)."""
        if not self.enable_safety_rules:
            return [], [], None

        triggered = []
        messages = []
        override_risk = None

        for rule in self.safety_rules:
            is_triggered, message = rule.check(context)
            if is_triggered:
                triggered.append(rule.name)
                if message:
                    messages.append(message)

                # Track highest risk override
                if override_risk is None:
                    override_risk = rule.override_to_risk
                elif rule.override_to_risk == RISK_CRITICAL:
                    override_risk = RISK_CRITICAL

        if triggered:
            logger.warning(f"Safety rules triggered: {triggered}")

        return triggered, messages, override_risk

    def _assess_risk(
        self,
        context: dict[str, Any],
        agent_outputs: dict[str, Any],
        safety_triggered: list[str],
        safety_messages: list[str],
        override_risk: str | None,
    ) -> RiskAssessment:
        """Perform comprehensive risk assessment."""
        import uuid

        # Collect model scores from agent outputs
        model_scores = {}
        if "risk_agent" in agent_outputs:
            risk_output = agent_outputs["risk_agent"]
            model_scores = risk_output.get("model_scores", {})

        # Calculate base risk from model scores
        if model_scores:
            avg_score = sum(model_scores.values()) / len(model_scores)
        else:
            avg_score = 0.3  # Default low-moderate

        # Determine risk tier
        if override_risk:
            risk_tier = override_risk
            safety_rule_override = True
        else:
            risk_tier = self._score_to_tier(avg_score)
            safety_rule_override = False

        # Calculate confidence
        confidence = self._calculate_confidence(context, agent_outputs, model_scores)

        # Identify factors
        primary_factors = self._identify_primary_factors(context, agent_outputs)
        secondary_factors = self._identify_secondary_factors(context, agent_outputs)
        protective_factors = self._identify_protective_factors(context)
        uncertainty_factors = self._identify_uncertainty_factors(context, agent_outputs)
        missing_data = self._identify_missing_data(context)

        # Calculate confidence interval
        ci_width = 0.15 + (0.1 * len(uncertainty_factors))
        ci_lower = max(0.0, confidence - ci_width)
        ci_upper = min(1.0, confidence + ci_width)

        # Determine trend
        trend_direction, trend_confidence = self._analyze_trend(context)

        return RiskAssessment(
            id=str(uuid.uuid4())[:12],
            child_id=context.get("child_id", "unknown"),
            risk_tier=risk_tier,
            confidence=confidence,
            confidence_interval=(ci_lower, ci_upper),
            primary_factors=primary_factors,
            secondary_factors=secondary_factors,
            protective_factors=protective_factors,
            uncertainty_factors=uncertainty_factors,
            missing_data=missing_data,
            safety_rules_triggered=safety_triggered,
            safety_rule_override=safety_rule_override,
            model_scores=model_scores,
            trend_direction=trend_direction,
            trend_confidence=trend_confidence,
        )

    def _score_to_tier(self, score: float) -> str:
        """Convert numerical score to risk tier."""
        if score >= 0.85:
            return RISK_CRITICAL
        elif score >= 0.65:
            return RISK_HIGH
        elif score >= 0.35:
            return RISK_MODERATE
        else:
            return RISK_LOW

    def _calculate_confidence(
        self,
        context: dict[str, Any],
        agent_outputs: dict[str, Any],
        model_scores: dict[str, float],
    ) -> float:
        """Calculate overall confidence in the assessment."""
        confidence = 0.7  # Base confidence

        # Boost for more data
        data_keys = ["symptoms", "vitals", "demographics", "history"]
        data_present = sum(1 for k in data_keys if k in context)
        confidence += data_present * 0.05

        # Penalty for missing critical data
        if "vitals" not in context:
            confidence -= 0.15
        if "demographics" not in context:
            confidence -= 0.1

        # Model agreement boosts confidence
        if model_scores and len(model_scores) > 1:
            scores = list(model_scores.values())
            variance = sum((s - sum(scores) / len(scores)) ** 2 for s in scores) / len(scores)
            if variance < 0.05:
                confidence += 0.1  # Models agree

        return max(0.2, min(0.95, confidence))

    def _determine_urgency(
        self,
        risk_assessment: RiskAssessment,
        safety_triggered: list[str],
    ) -> UrgencyLevel:
        """Determine urgency level based on risk assessment."""
        if risk_assessment.risk_tier == RISK_CRITICAL or safety_triggered:
            return UrgencyLevel.EMERGENCY
        elif risk_assessment.risk_tier == RISK_HIGH:
            return UrgencyLevel.URGENT
        elif risk_assessment.risk_tier == RISK_MODERATE:
            return UrgencyLevel.SEMI_URGENT
        else:
            return UrgencyLevel.ROUTINE

    def _generate_recommendations(
        self,
        risk_assessment: RiskAssessment,
        urgency: UrgencyLevel,
        context: dict[str, Any],
    ) -> dict[str, list[str]]:
        """Generate action recommendations based on assessment."""
        recommendations: dict[str, list[str]] = {
            "actions": [],
            "contraindicated": [],
            "follow_up": [],
            "escalation_criteria": [],
            "guidelines": [],
        }

        if urgency == UrgencyLevel.EMERGENCY:
            recommendations["actions"] = [
                "Call 911 or go to nearest emergency room immediately",
                "Do not drive yourself - call for emergency transport",
                "Stay with child and monitor breathing",
                "Bring list of symptoms and any medications",
            ]
            recommendations["contraindicated"] = [
                "Do not wait to see if symptoms improve",
                "Do not give any medications without medical guidance",
            ]
            recommendations["follow_up"] = [
                "Follow up with pediatrician within 24-48 hours after ER visit",
            ]

        elif urgency == UrgencyLevel.URGENT:
            recommendations["actions"] = [
                "Contact pediatrician or nurse line within the next few hours",
                "If unable to reach provider, consider urgent care",
                "Monitor symptoms closely and document changes",
                "Ensure child stays hydrated",
            ]
            recommendations["follow_up"] = [
                "Schedule follow-up appointment within 1-2 days",
                "Continue symptom monitoring and logging",
            ]
            recommendations["escalation_criteria"] = [
                "Symptoms worsen or new concerning symptoms develop",
                "Difficulty breathing or rapid breathing",
                "Unable to keep fluids down",
                "Child becomes less responsive or very irritable",
            ]

        elif urgency == UrgencyLevel.SEMI_URGENT:
            recommendations["actions"] = [
                "Schedule appointment with pediatrician within 24 hours",
                "Continue home monitoring and comfort care",
                "Track symptoms in the app",
            ]
            recommendations["follow_up"] = [
                "Attend scheduled appointment",
                "Continue monitoring for 48-72 hours",
            ]
            recommendations["escalation_criteria"] = [
                "Fever persists more than 3 days",
                "Symptoms significantly worsen",
                "Child unable to eat or drink",
            ]

        else:  # ROUTINE or INFORMATIONAL
            recommendations["actions"] = [
                "Continue home monitoring",
                "Provide comfort care and rest",
                "Ensure adequate hydration and nutrition",
                "Log symptoms daily in the app",
            ]
            recommendations["follow_up"] = [
                "Review symptoms in 2-3 days",
                "Schedule routine visit if symptoms persist beyond 5-7 days",
            ]
            recommendations["escalation_criteria"] = [
                "Development of new symptoms",
                "Symptoms worsen instead of improving",
                "Fever develops or increases",
            ]

        return recommendations

    def _summarize_evidence(
        self,
        agent_outputs: dict[str, Any],
        risk_assessment: RiskAssessment,
    ) -> list[str]:
        """Summarize evidence supporting the decision."""
        evidence = []

        # Add primary factors
        for factor in risk_assessment.primary_factors[:3]:
            evidence.append(f"Observed: {factor}")

        # Add model evidence
        for model, score in risk_assessment.model_scores.items():
            evidence.append(f"{model} risk score: {score:.0%}")

        # Add safety rule evidence
        for rule in risk_assessment.safety_rules_triggered:
            evidence.append(f"Safety alert: {rule}")

        return evidence

    def _generate_uncertainty_statement(self, risk_assessment: RiskAssessment) -> str:
        """Generate explicit uncertainty statement."""
        confidence = risk_assessment.confidence
        factors = risk_assessment.uncertainty_factors
        missing = risk_assessment.missing_data

        if confidence >= 0.85:
            qualifier = "high confidence"
        elif confidence >= 0.7:
            qualifier = "moderate confidence"
        elif confidence >= 0.5:
            qualifier = "limited confidence"
        else:
            qualifier = "low confidence"

        statement = f"This assessment is made with {qualifier} ({confidence:.0%}). "

        if factors:
            statement += f"Uncertainty is increased due to: {', '.join(factors[:2])}. "

        if missing:
            statement += (
                f"The following additional data would improve accuracy: {', '.join(missing[:2])}."
            )

        return statement

    def _generate_summary(
        self,
        risk_assessment: RiskAssessment,
        urgency: UrgencyLevel,
    ) -> str:
        """Generate decision summary."""
        tier_descriptions = {
            RISK_CRITICAL: "Critical concern requiring immediate attention",
            RISK_HIGH: "High concern requiring urgent evaluation",
            RISK_MODERATE: "Moderate concern warranting medical consultation",
            RISK_LOW: "Low concern - continue home monitoring",
        }

        description = tier_descriptions.get(risk_assessment.risk_tier, "Assessment completed")

        if risk_assessment.safety_rules_triggered:
            description = f"SAFETY ALERT: {description}"

        return description

    def _identify_primary_factors(
        self,
        context: dict[str, Any],
        agent_outputs: dict[str, Any],
    ) -> list[str]:
        """Identify primary risk factors."""
        factors = []

        symptoms = context.get("symptoms", [])
        vitals = context.get("vitals", {})

        # High fever
        temp = vitals.get("temperature", 0)
        if temp >= 39.0:
            factors.append(f"High fever: {temp}°C")
        elif temp >= 38.0:
            factors.append(f"Fever present: {temp}°C")

        # Respiratory symptoms
        respiratory = ["difficulty_breathing", "rapid_breathing", "wheezing", "stridor"]
        if any(s in symptoms for s in respiratory):
            factors.append("Respiratory symptoms present")

        # Dehydration signs
        dehydration = ["decreased_urine", "dry_mouth", "no_tears"]
        dehydration_count = sum(1 for s in dehydration if s in symptoms)
        if dehydration_count >= 2:
            factors.append(f"Multiple dehydration signs ({dehydration_count})")

        # Duration
        duration = context.get("symptom_duration_hours", 0)
        if duration > 72:
            factors.append(f"Prolonged symptoms ({duration // 24} days)")

        return factors

    def _identify_secondary_factors(
        self,
        context: dict[str, Any],
        agent_outputs: dict[str, Any],
    ) -> list[str]:
        """Identify secondary contributing factors."""
        factors = []

        symptoms = context.get("symptoms", [])

        # GI symptoms
        gi = ["vomiting", "diarrhea", "abdominal_pain"]
        if any(s in symptoms for s in gi):
            factors.append("Gastrointestinal symptoms")

        # Pain
        if "pain" in symptoms or "headache" in symptoms:
            factors.append("Pain reported")

        # Poor appetite
        if "poor_appetite" in symptoms:
            factors.append("Decreased appetite")

        return factors

    def _identify_protective_factors(self, context: dict[str, Any]) -> list[str]:
        """Identify protective factors that reduce risk."""
        factors = []

        symptoms = context.get("symptoms", [])
        context.get("vitals", {})
        demographics = context.get("demographics", {})

        # Normal hydration
        if "good_urine_output" in context or "well_hydrated" in symptoms:
            factors.append("Adequate hydration")

        # Normal activity
        if context.get("activity_level") == "normal":
            factors.append("Normal activity level")

        # Eating/drinking well
        if "eating_well" in context or "drinking_well" in context:
            factors.append("Maintaining oral intake")

        # Age (older children generally more resilient)
        age_months = demographics.get("age_months", 0)
        if age_months > 24:
            factors.append("Age >2 years")

        return factors

    def _identify_uncertainty_factors(
        self,
        context: dict[str, Any],
        agent_outputs: dict[str, Any],
    ) -> list[str]:
        """Identify factors that increase uncertainty."""
        factors = []

        # Missing data
        if "vitals" not in context:
            factors.append("No vital signs available")

        if "symptom_duration_hours" not in context:
            factors.append("Unknown symptom duration")

        # Model disagreement
        if "risk_agent" in agent_outputs:
            scores = agent_outputs["risk_agent"].get("model_scores", {})
            if scores:
                min_score = min(scores.values())
                max_score = max(scores.values())
                if max_score - min_score > 0.3:
                    factors.append("Model predictions diverge")

        # Limited history
        if not context.get("history"):
            factors.append("Limited medical history available")

        return factors

    def _identify_missing_data(self, context: dict[str, Any]) -> list[str]:
        """Identify data that would improve the assessment."""
        missing = []

        if "vitals" not in context:
            missing.append("Vital signs (temperature, heart rate)")
        elif "temperature" not in context.get("vitals", {}):
            missing.append("Temperature measurement")

        if "symptom_duration_hours" not in context:
            missing.append("How long symptoms have been present")

        if "medications" not in context:
            missing.append("Current medications")

        if "history" not in context:
            missing.append("Medical history")

        return missing

    def _analyze_trend(
        self,
        context: dict[str, Any],
    ) -> tuple[str, float]:
        """Analyze symptom trend over time."""
        history = context.get("observation_history", [])

        if len(history) < 2:
            return "unknown", 0.3

        # Simple trend analysis based on severity scores
        severities = [obs.get("severity", 0.5) for obs in history]

        if len(severities) >= 2:
            recent = sum(severities[-2:]) / 2
            earlier = sum(severities[:-2]) / max(1, len(severities) - 2)

            if recent > earlier + 0.1:
                return "worsening", 0.7
            elif recent < earlier - 0.1:
                return "improving", 0.7
            else:
                return "stable", 0.8

        return "unknown", 0.3

    def _initialize_safety_rules(self) -> list[SafetyRule]:
        """Initialize the safety rules for hard overrides."""
        rules = []

        # Critical symptom rule
        def check_critical_symptoms(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            critical = [
                "cyanosis",
                "unresponsive",
                "seizure",
                "severe_difficulty_breathing",
                "apnea",
            ]
            found = [s for s in critical if s in symptoms]
            if found:
                return True, f"Critical symptom detected: {', '.join(found)}"
            return False, None

        rules.append(
            SafetyRule(
                name="CRITICAL_SYMPTOM",
                description="Detects immediately life-threatening symptoms",
                check_function=check_critical_symptoms,
                override_to_risk=RISK_CRITICAL,
                urgency=UrgencyLevel.EMERGENCY,
            )
        )

        # Infant fever rule
        def check_infant_fever(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            age_months = ctx.get("demographics", {}).get("age_months", 99)
            temp = ctx.get("vitals", {}).get("temperature", 0)
            if age_months < 3 and temp >= 38.0:
                return True, f"Fever ({temp}°C) in infant under 3 months"
            return False, None

        rules.append(
            SafetyRule(
                name="INFANT_FEVER",
                description="Fever in infant under 3 months requires immediate evaluation",
                check_function=check_infant_fever,
                override_to_risk=RISK_CRITICAL,
                urgency=UrgencyLevel.EMERGENCY,
            )
        )

        # Severe dehydration rule
        def check_severe_dehydration(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            symptoms = ctx.get("symptoms", [])
            dehydration_signs = [
                "no_urine_8_hours",
                "sunken_fontanelle",
                "very_dry_mouth",
                "no_tears",
                "lethargic",
            ]
            count = sum(1 for s in dehydration_signs if s in symptoms)
            if count >= 3:
                return True, f"Multiple signs of severe dehydration ({count} signs)"
            return False, None

        rules.append(
            SafetyRule(
                name="SEVERE_DEHYDRATION",
                description="Multiple signs of severe dehydration",
                check_function=check_severe_dehydration,
                override_to_risk=RISK_HIGH,
                urgency=UrgencyLevel.URGENT,
            )
        )

        # High fever rule
        def check_high_fever(ctx: dict[str, Any]) -> tuple[bool, str | None]:
            temp = ctx.get("vitals", {}).get("temperature", 0)
            if temp >= 40.0:
                return True, f"Very high fever: {temp}°C"
            return False, None

        rules.append(
            SafetyRule(
                name="HIGH_FEVER",
                description="Very high fever (≥40°C) requiring evaluation",
                check_function=check_high_fever,
                override_to_risk=RISK_HIGH,
                urgency=UrgencyLevel.URGENT,
            )
        )

        return rules
