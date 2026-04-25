"""
EPCID Phenotype Agent

Converts raw data into clinically meaningful signals (phenotypes):
- Weight loss velocity (kg/week)
- Fever persistence (days)
- Respiratory effort score
- Fatigue trend index
- Appetite decline score
- Hydration status
- Pain trajectory
- Sleep quality index

These derived signals enable better risk stratification.
"""

import logging
from dataclasses import dataclass
from typing import Any

from .base_agent import AgentConfig, AgentResponse, BaseAgent

logger = logging.getLogger("epcid.agents.phenotype")


@dataclass
class Phenotype:
    """A derived clinical phenotype."""

    name: str
    value: float
    unit: str
    severity: str  # normal, mild, moderate, severe
    confidence: float
    trend: str | None = None  # improving, stable, worsening
    description: str | None = None
    contributing_factors: list[str] | None = None

    def __post_init__(self) -> None:
        if self.contributing_factors is None:
            self.contributing_factors = []

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "unit": self.unit,
            "severity": self.severity,
            "confidence": self.confidence,
            "trend": self.trend,
            "description": self.description,
            "contributing_factors": self.contributing_factors,
        }


class PhenotypeAgent(BaseAgent):
    """
    Agent that derives clinical phenotypes from raw observations.

    Phenotypes are higher-level clinical signals computed from
    raw data, enabling more nuanced risk assessment.
    """

    # Severity thresholds for phenotypes
    SEVERITY_THRESHOLDS = {
        "fever_persistence": {
            "normal": 0,  # hours
            "mild": 24,
            "moderate": 48,
            "severe": 72,
        },
        "respiratory_effort": {
            "normal": 0,
            "mild": 2,
            "moderate": 4,
            "severe": 6,
        },
        "dehydration_score": {
            "normal": 0,
            "mild": 2,
            "moderate": 4,
            "severe": 6,
        },
        "symptom_burden": {
            "normal": 0,
            "mild": 3,
            "moderate": 6,
            "severe": 9,
        },
    }

    def __init__(
        self,
        config: AgentConfig | None = None,
        **kwargs: Any,
    ) -> None:
        config = config or AgentConfig(
            name="phenotype_agent",
            description="Derives clinical phenotypes from raw data",
            priority=2,
            timeout_seconds=10,
        )
        super().__init__(config, **kwargs)

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Process normalized data and compute phenotypes.

        Args:
            input_data: Normalized data from ingestion agent
            context: str | None context with historical data

        Returns:
            AgentResponse with computed phenotypes
        """
        import uuid

        request_id = str(uuid.uuid4())[:12]

        phenotypes: list[Phenotype] = []
        warnings: list[str] = []

        # Extract data
        normalized = input_data.get("normalized", input_data)
        symptoms = normalized.get("symptoms", [])
        vitals = normalized.get("vitals", {})
        demographics = normalized.get("demographics", {})
        history = context.get("observation_history", []) if context else []

        # Compute fever phenotype
        if "temperature" in vitals:
            fever = self._compute_fever_phenotype(vitals, history)
            if fever:
                phenotypes.append(fever)

        # Compute respiratory effort phenotype
        respiratory = self._compute_respiratory_phenotype(symptoms, vitals)
        if respiratory:
            phenotypes.append(respiratory)

        # Compute dehydration phenotype
        dehydration = self._compute_dehydration_phenotype(symptoms, vitals)
        if dehydration:
            phenotypes.append(dehydration)

        # Compute symptom burden
        symptom_burden = self._compute_symptom_burden(symptoms)
        phenotypes.append(symptom_burden)

        # Compute fatigue/activity index
        if context and "activity_levels" in context:
            fatigue = self._compute_fatigue_index(context["activity_levels"])
            if fatigue:
                phenotypes.append(fatigue)

        # Compute appetite phenotype
        appetite = self._compute_appetite_phenotype(symptoms, context)
        if appetite:
            phenotypes.append(appetite)

        # Compute weight velocity if we have history
        if history and demographics.get("weight_kg"):
            weight_velocity = self._compute_weight_velocity(
                demographics["weight_kg"],
                history,
            )
            if weight_velocity:
                phenotypes.append(weight_velocity)

        # Compute pain phenotype
        pain = self._compute_pain_phenotype(symptoms, context)
        if pain:
            phenotypes.append(pain)

        # Compute overall clinical state
        clinical_state = self._compute_clinical_state(phenotypes)

        # Calculate overall confidence
        if phenotypes:
            avg_confidence = sum(p.confidence for p in phenotypes) / len(phenotypes)
        else:
            avg_confidence = 0.5

        # Generate explanation
        explanation = self._generate_explanation(phenotypes, clinical_state)

        return self.create_response(
            request_id=request_id,
            data={
                "phenotypes": [p.to_dict() for p in phenotypes],
                "clinical_state": clinical_state,
                "phenotype_count": len(phenotypes),
                "severe_phenotypes": [p.name for p in phenotypes if p.severity == "severe"],
                "moderate_phenotypes": [p.name for p in phenotypes if p.severity == "moderate"],
            },
            confidence=avg_confidence,
            explanation=explanation,
            warnings=warnings,
        )

    def _compute_fever_phenotype(
        self,
        vitals: dict[str, Any],
        history: list[dict],
    ) -> Phenotype | None:
        """Compute fever persistence and severity phenotype."""
        temp = vitals.get("temperature")
        if temp is None:
            return None

        # Determine fever presence
        is_fever = temp >= 38.0

        # Calculate persistence from history
        persistence_hours = 0
        if history and is_fever:
            for obs in reversed(history):
                obs_temp = obs.get("vitals", {}).get("temperature", 0)
                if obs_temp >= 38.0:
                    persistence_hours += 1  # Assuming hourly observations
                else:
                    break

        # Determine severity
        if temp >= 40.0:
            severity = "severe"
        elif temp >= 39.0:
            severity = "moderate"
        elif temp >= 38.0:
            severity = "mild"
        else:
            severity = "normal"

        # Increase severity for persistence
        thresholds = self.SEVERITY_THRESHOLDS["fever_persistence"]
        if persistence_hours >= thresholds["severe"]:
            severity = "severe"
        elif persistence_hours >= thresholds["moderate"] and severity != "severe":
            severity = "moderate"

        return Phenotype(
            name="fever",
            value=temp,
            unit="celsius",
            severity=severity,
            confidence=0.9,
            description=f"Temperature {temp:.1f}°C"
            + (f", persistent for ~{persistence_hours}h" if persistence_hours > 0 else ""),
            contributing_factors=[
                f"Current temperature: {temp:.1f}°C",
                f"Persistence: {persistence_hours} hours",
            ],
        )

    def _compute_respiratory_phenotype(
        self,
        symptoms: list[str],
        vitals: dict[str, Any],
    ) -> Phenotype | None:
        """Compute respiratory effort score."""
        score = 0.0
        factors = []

        # Symptom contributions
        respiratory_symptoms = {
            "difficulty_breathing": 3,
            "rapid_breathing": 2,
            "wheezing": 2,
            "stridor": 3,
            "nasal_flaring": 2,
            "retractions": 3,
            "grunting": 3,
            "cough": 1,
            "nasal_congestion": 0.5,
        }

        for symptom, weight in respiratory_symptoms.items():
            if symptom in symptoms:
                score += weight
                factors.append(symptom.replace("_", " "))

        # Vital sign contributions
        if "oxygen_saturation" in vitals:
            spo2 = vitals["oxygen_saturation"]
            if spo2 < 90:
                score += 4
                factors.append(f"Low O2 sat: {spo2}%")
            elif spo2 < 94:
                score += 2
                factors.append(f"Borderline O2 sat: {spo2}%")

        if "respiratory_rate" in vitals:
            rr = vitals["respiratory_rate"]
            # This would ideally be age-adjusted
            if rr > 40:
                score += 2
                factors.append(f"Elevated respiratory rate: {rr}")

        if score == 0:
            return None

        # Determine severity
        thresholds = self.SEVERITY_THRESHOLDS["respiratory_effort"]
        if score >= thresholds["severe"]:
            severity = "severe"
        elif score >= thresholds["moderate"]:
            severity = "moderate"
        elif score >= thresholds["mild"]:
            severity = "mild"
        else:
            severity = "normal"

        return Phenotype(
            name="respiratory_effort",
            value=score,
            unit="score",
            severity=severity,
            confidence=0.85,
            description=f"Respiratory effort score: {score}",
            contributing_factors=factors,
        )

    def _compute_dehydration_phenotype(
        self,
        symptoms: list[str],
        vitals: dict[str, Any],
    ) -> Phenotype | None:
        """Compute dehydration severity score."""
        score = 0
        factors = []

        # Symptom contributions
        dehydration_signs = {
            "decreased_urine": 2,
            "no_urine_8_hours": 4,
            "dry_mouth": 1,
            "very_dry_mouth": 2,
            "no_tears": 2,
            "sunken_eyes": 2,
            "sunken_fontanelle": 3,
            "poor_skin_turgor": 2,
            "lethargic": 2,
            "irritable": 1,
            "vomiting": 1,
            "diarrhea": 1,
            "thirst": 1,
        }

        for sign, weight in dehydration_signs.items():
            if sign in symptoms:
                score += weight
                factors.append(sign.replace("_", " "))

        # Elevated heart rate can indicate dehydration
        if "heart_rate" in vitals:
            hr = vitals["heart_rate"]
            # This would need age-adjustment
            if hr > 160:
                score += 1
                factors.append(f"Tachycardia: {hr} bpm")

        if score == 0:
            return None

        # Determine severity
        thresholds = self.SEVERITY_THRESHOLDS["dehydration_score"]
        if score >= thresholds["severe"]:
            severity = "severe"
        elif score >= thresholds["moderate"]:
            severity = "moderate"
        elif score >= thresholds["mild"]:
            severity = "mild"
        else:
            severity = "normal"

        return Phenotype(
            name="dehydration",
            value=score,
            unit="score",
            severity=severity,
            confidence=0.8,
            description=f"Dehydration score: {score}",
            contributing_factors=factors,
        )

    def _compute_symptom_burden(self, symptoms: list[str]) -> Phenotype:
        """Compute overall symptom burden."""
        # Weight symptoms by severity
        severe_symptoms = {"cyanosis", "unresponsive", "seizure", "difficulty_breathing"}
        moderate_symptoms = {"high_fever", "vomiting", "diarrhea", "severe_pain", "lethargy"}

        score = 0
        for symptom in symptoms:
            if symptom in severe_symptoms:
                score += 3
            elif symptom in moderate_symptoms:
                score += 2
            else:
                score += 1

        # Determine severity
        thresholds = self.SEVERITY_THRESHOLDS["symptom_burden"]
        if score >= thresholds["severe"]:
            severity = "severe"
        elif score >= thresholds["moderate"]:
            severity = "moderate"
        elif score >= thresholds["mild"]:
            severity = "mild"
        else:
            severity = "normal"

        return Phenotype(
            name="symptom_burden",
            value=score,
            unit="weighted_count",
            severity=severity,
            confidence=0.9,
            description=f"Symptom burden: {len(symptoms)} symptoms (weighted score: {score})",
            contributing_factors=symptoms[:5],  # Top 5 symptoms
        )

    def _compute_fatigue_index(
        self,
        activity_levels: list[dict[str, Any]],
    ) -> Phenotype | None:
        """Compute fatigue/activity index from historical data."""
        if not activity_levels:
            return None

        # Calculate average activity level (0-100)
        recent_levels = activity_levels[-24:]  # Last 24 readings
        if not recent_levels:
            return None

        avg_activity = sum(a.get("level", 50) for a in recent_levels) / len(recent_levels)

        # Determine severity (inverse - low activity = high fatigue)
        if avg_activity < 20:
            severity = "severe"
            fatigue_value = 90
        elif avg_activity < 40:
            severity = "moderate"
            fatigue_value = 70
        elif avg_activity < 60:
            severity = "mild"
            fatigue_value = 50
        else:
            severity = "normal"
            fatigue_value = 20

        # Determine trend
        if len(activity_levels) >= 2:
            recent = sum(a.get("level", 50) for a in activity_levels[-6:]) / min(
                6, len(activity_levels)
            )
            older = (
                sum(a.get("level", 50) for a in activity_levels[-12:-6])
                / min(6, len(activity_levels) - 6)
                if len(activity_levels) > 6
                else recent
            )

            if recent < older - 10:
                trend = "worsening"
            elif recent > older + 10:
                trend = "improving"
            else:
                trend = "stable"
        else:
            trend = "unknown"

        return Phenotype(
            name="fatigue_index",
            value=fatigue_value,
            unit="percent",
            severity=severity,
            confidence=0.7,
            trend=trend,
            description=f"Fatigue index: {fatigue_value}% (based on activity levels)",
            contributing_factors=[f"Average activity: {avg_activity:.0f}%"],
        )

    def _compute_appetite_phenotype(
        self,
        symptoms: list[str],
        context: dict[str, Any] | None,
    ) -> Phenotype | None:
        """Compute appetite/feeding phenotype."""
        score = 100  # Start at 100% normal
        factors = []

        # Symptom contributions
        appetite_symptoms = {
            "poor_appetite": -30,
            "refuses_food": -40,
            "refuses_liquids": -50,
            "nausea": -20,
            "vomiting": -30,
            "abdominal_pain": -15,
        }

        for symptom, impact in appetite_symptoms.items():
            if symptom in symptoms:
                score += impact
                factors.append(symptom.replace("_", " "))

        # Context contributions (meal tracking)
        if context and "meals" in context:
            recent_meals = context["meals"][-6:]  # Last 6 meals
            meals_eaten = sum(1 for m in recent_meals if m.get("eaten", False))
            if meals_eaten < 2:
                score -= 30
                factors.append(f"Only {meals_eaten}/6 recent meals eaten")

        score = max(0, min(100, score))

        if score >= 80:
            severity = "normal"
        elif score >= 60:
            severity = "mild"
        elif score >= 30:
            severity = "moderate"
        else:
            severity = "severe"

        if severity == "normal" and not factors:
            return None

        return Phenotype(
            name="appetite",
            value=score,
            unit="percent",
            severity=severity,
            confidence=0.75,
            description=f"Appetite score: {score}%",
            contributing_factors=factors,
        )

    def _compute_weight_velocity(
        self,
        current_weight: float,
        history: list[dict],
    ) -> Phenotype | None:
        """Compute weight change velocity."""
        # Find weight from 7 days ago
        week_ago_weight = None
        for obs in history:
            obs_time = obs.get("timestamp")
            if obs_time:
                # Check if approximately 7 days ago
                weight = obs.get("demographics", {}).get("weight_kg")
                if weight:
                    week_ago_weight = weight
                    break

        if week_ago_weight is None:
            return None

        # Calculate change
        weight_change = current_weight - week_ago_weight
        velocity = weight_change / 7 * 7  # kg/week

        # Determine severity based on weight loss
        # For children, significant weight loss is concerning
        pct_change = (weight_change / week_ago_weight) * 100

        if pct_change < -5:
            severity = "severe"
        elif pct_change < -2:
            severity = "moderate"
        elif pct_change < 0:
            severity = "mild"
        else:
            severity = "normal"

        if severity == "normal":
            return None

        return Phenotype(
            name="weight_velocity",
            value=velocity,
            unit="kg/week",
            severity=severity,
            confidence=0.8,
            trend="worsening" if velocity < 0 else "stable",
            description=f"Weight change: {weight_change:.2f}kg ({pct_change:.1f}%) over 7 days",
            contributing_factors=[
                f"Current weight: {current_weight:.1f}kg",
                f"Previous weight: {week_ago_weight:.1f}kg",
            ],
        )

    def _compute_pain_phenotype(
        self,
        symptoms: list[str],
        context: dict[str, Any] | None,
    ) -> Phenotype | None:
        """Compute pain phenotype."""
        pain_symptoms = {
            "severe_pain": 9,
            "moderate_pain": 6,
            "pain": 4,
            "mild_pain": 2,
            "headache": 4,
            "ear_pain": 5,
            "abdominal_pain": 5,
            "throat_pain": 3,
            "sore_throat": 3,
        }

        max_pain = 0
        pain_locations = []

        for symptom, level in pain_symptoms.items():
            if symptom in symptoms:
                max_pain = max(max_pain, level)
                if "pain" not in symptom or symptom == "pain":
                    pain_locations.append(symptom)
                else:
                    location = symptom.replace("_pain", "").replace("sore_", "")
                    pain_locations.append(location)

        if max_pain == 0:
            return None

        # Check for pain scores in context
        if context and "pain_scores" in context:
            recent_scores = context["pain_scores"][-3:]
            if recent_scores:
                avg_score = sum(recent_scores) / len(recent_scores)
                max_pain = max(max_pain, avg_score)

        # Determine severity
        if max_pain >= 7:
            severity = "severe"
        elif max_pain >= 4:
            severity = "moderate"
        elif max_pain >= 1:
            severity = "mild"
        else:
            severity = "normal"

        return Phenotype(
            name="pain",
            value=max_pain,
            unit="scale_0_10",
            severity=severity,
            confidence=0.7,
            description=f"Pain level: {max_pain}/10",
            contributing_factors=pain_locations[:3],
        )

    def _compute_clinical_state(
        self,
        phenotypes: list[Phenotype],
    ) -> dict[str, Any]:
        """Compute overall clinical state summary."""
        severe_count = sum(1 for p in phenotypes if p.severity == "severe")
        moderate_count = sum(1 for p in phenotypes if p.severity == "moderate")

        if severe_count >= 2:
            overall_state = "critical"
        elif severe_count >= 1 or moderate_count >= 3:
            overall_state = "concerning"
        elif moderate_count >= 1:
            overall_state = "monitor_closely"
        else:
            overall_state = "stable"

        # Find dominant concerns
        concerns = [p.name for p in phenotypes if p.severity in ("severe", "moderate")]

        return {
            "overall_state": overall_state,
            "severe_count": severe_count,
            "moderate_count": moderate_count,
            "primary_concerns": concerns[:3],
            "recommendation": self._get_state_recommendation(overall_state),
        }

    def _get_state_recommendation(self, state: str) -> str:
        """Get recommendation based on clinical state."""
        recommendations = {
            "critical": "Immediate medical evaluation recommended",
            "concerning": "Medical consultation within 24 hours recommended",
            "monitor_closely": "Close monitoring with follow-up if worsening",
            "stable": "Continue home care and routine monitoring",
        }
        return recommendations.get(state, "Continue monitoring")

    def _generate_explanation(
        self,
        phenotypes: list[Phenotype],
        clinical_state: dict[str, Any],
    ) -> str:
        """Generate explanation of phenotype analysis."""
        lines = ["## Phenotype Analysis\n"]

        lines.append(
            f"**Clinical State:** {clinical_state['overall_state'].replace('_', ' ').title()}"
        )
        lines.append(f"**Recommendation:** {clinical_state['recommendation']}")

        if phenotypes:
            lines.append("\n### Derived Phenotypes")
            for p in sorted(
                phenotypes,
                key=lambda x: {"severe": 0, "moderate": 1, "mild": 2, "normal": 3}.get(
                    x.severity, 4
                ),
            ):
                severity_emoji = {
                    "severe": "🔴",
                    "moderate": "🟠",
                    "mild": "🟡",
                    "normal": "🟢",
                }.get(p.severity, "⚪")
                lines.append(f"\n{severity_emoji} **{p.name.replace('_', ' ').title()}**")
                lines.append(f"- Value: {p.value} {p.unit}")
                lines.append(f"- Severity: {p.severity}")
                if p.description:
                    lines.append(f"- {p.description}")

        return "\n".join(lines)
