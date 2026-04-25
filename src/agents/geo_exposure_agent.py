"""
EPCID Geo-Exposure Agent

Environmental exposure analysis for pediatric health:
- Air Quality Index (AQI)
- PM2.5 / Ozone levels
- Temperature & humidity
- Rapid weather shifts
- Pollen levels

Correlates symptom flares with environmental exposure
and generates preventive guidance.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .base_agent import AgentConfig, AgentResponse, BaseAgent

logger = logging.getLogger("epcid.agents.geo_exposure")


@dataclass
class EnvironmentalConditions:
    """Current environmental conditions."""

    aqi: int | None = None
    aqi_category: str | None = None
    pm25: float | None = None
    ozone: float | None = None
    temperature_f: float | None = None
    humidity_percent: int | None = None
    uv_index: int | None = None
    pollen_level: str | None = None
    weather_condition: str | None = None
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    location: str | None = None


@dataclass
class ExposureAlert:
    """An environmental exposure alert."""

    alert_type: str
    severity: str  # low, moderate, high, severe
    title: str
    description: str
    recommendation: str
    related_symptoms: list[str]


class GeoExposureAgent(BaseAgent):
    """
    Agent that analyzes environmental exposure risks.

    Correlates environmental conditions with symptom patterns
    to identify potential exposure-related health impacts.
    """

    # AQI categories and health implications
    AQI_CATEGORIES = {
        (0, 50): ("Good", "low", "Air quality is satisfactory"),
        (51, 100): ("Moderate", "low", "Acceptable; sensitive groups may be affected"),
        (101, 150): (
            "Unhealthy for Sensitive Groups",
            "moderate",
            "Children may experience respiratory symptoms",
        ),
        (151, 200): (
            "Unhealthy",
            "high",
            "Everyone may experience health effects; children at higher risk",
        ),
        (201, 300): ("Very Unhealthy", "severe", "Health alert: significant risk to children"),
        (301, 500): ("Hazardous", "severe", "Health emergency: avoid outdoor activity"),
    }

    # Symptoms that may be environment-related
    ENVIRONMENT_SENSITIVE_SYMPTOMS = {
        "respiratory": [
            "cough",
            "wheezing",
            "difficulty_breathing",
            "asthma_attack",
            "nasal_congestion",
            "runny_nose",
            "sneezing",
        ],
        "skin": ["rash", "hives", "eczema_flare", "itchy_skin"],
        "eye": ["itchy_eyes", "watery_eyes", "red_eyes"],
        "general": ["headache", "fatigue", "nausea"],
    }

    # Temperature thresholds for alerts
    TEMP_THRESHOLDS = {
        "extreme_cold": 32,  # °F
        "cold": 45,
        "hot": 85,
        "extreme_hot": 95,
    }

    def __init__(
        self,
        config: AgentConfig | None = None,
        **kwargs: Any,
    ) -> None:
        config = config or AgentConfig(
            name="geo_exposure_agent",
            description="Analyzes environmental exposure risks for pediatric health",
            priority=6,
            timeout_seconds=15,
        )
        super().__init__(config, **kwargs)

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Analyze environmental conditions and correlate with symptoms.

        Args:
            input_data: Contains environmental data and symptoms
            context: str | None context with location or history

        Returns:
            AgentResponse with exposure analysis and recommendations
        """
        import uuid

        request_id = str(uuid.uuid4())[:12]

        # Extract data
        env_data = input_data.get("environmental", {})
        symptoms = input_data.get("symptoms", [])
        location = input_data.get("location") or env_data.get("zip_code")

        # Parse environmental conditions
        conditions = self._parse_conditions(env_data)

        # Generate exposure alerts
        alerts = self._generate_alerts(conditions)

        # Correlate symptoms with environmental factors
        correlations = self._correlate_symptoms(symptoms, conditions)

        # Generate recommendations
        recommendations = self._generate_recommendations(conditions, alerts, symptoms)

        # Calculate exposure risk score
        risk_score = self._calculate_risk_score(conditions, alerts)

        return self.create_response(
            request_id=request_id,
            data={
                "conditions": self._conditions_to_dict(conditions),
                "alerts": [self._alert_to_dict(a) for a in alerts],
                "correlations": correlations,
                "recommendations": recommendations,
                "risk_score": risk_score,
                "location": location,
            },
            confidence=0.75 if conditions.aqi else 0.5,
            explanation=self._generate_explanation(conditions, alerts, correlations),
        )

    def _parse_conditions(self, env_data: dict[str, Any]) -> EnvironmentalConditions:
        """Parse environmental data into structured conditions."""
        aqi = env_data.get("aqi")
        aqi_category = None

        if aqi is not None:
            for (low, high), (category, _, _) in self.AQI_CATEGORIES.items():
                if low <= aqi <= high:
                    aqi_category = category
                    break

        return EnvironmentalConditions(
            aqi=aqi,
            aqi_category=aqi_category,
            pm25=env_data.get("pm25"),
            ozone=env_data.get("ozone"),
            temperature_f=env_data.get("outdoor_temperature_f"),
            humidity_percent=env_data.get("humidity_percent"),
            uv_index=env_data.get("uv_index"),
            pollen_level=env_data.get("pollen_level"),
            weather_condition=env_data.get("weather_condition"),
            location=env_data.get("zip_code"),
        )

    def _generate_alerts(self, conditions: EnvironmentalConditions) -> list[ExposureAlert]:
        """Generate exposure alerts based on conditions."""
        alerts = []

        # AQI alerts
        if conditions.aqi is not None:
            aqi = conditions.aqi

            if aqi > 100:
                severity = "high" if aqi > 150 else "moderate"
                alerts.append(
                    ExposureAlert(
                        alert_type="air_quality",
                        severity=severity,
                        title=f"Air Quality Alert: {conditions.aqi_category}",
                        description=f"Current AQI is {aqi}. " + (self._get_aqi_description(aqi)),
                        recommendation=self._get_aqi_recommendation(aqi),
                        related_symptoms=[
                            "cough",
                            "wheezing",
                            "difficulty_breathing",
                            "asthma_attack",
                            "eye_irritation",
                        ],
                    )
                )

        # Temperature alerts
        if conditions.temperature_f is not None:
            temp = conditions.temperature_f

            if temp >= self.TEMP_THRESHOLDS["extreme_hot"]:
                alerts.append(
                    ExposureAlert(
                        alert_type="temperature",
                        severity="high",
                        title="Extreme Heat Alert",
                        description=f"Temperature is {temp}°F. Risk of heat-related illness.",
                        recommendation="Limit outdoor activity. Stay hydrated. Watch for heat exhaustion signs.",
                        related_symptoms=["fatigue", "headache", "nausea", "dizziness"],
                    )
                )
            elif temp >= self.TEMP_THRESHOLDS["hot"]:
                alerts.append(
                    ExposureAlert(
                        alert_type="temperature",
                        severity="moderate",
                        title="Heat Advisory",
                        description=f"Temperature is {temp}°F. Take precautions.",
                        recommendation="Limit strenuous outdoor activity. Ensure adequate hydration.",
                        related_symptoms=["fatigue", "headache"],
                    )
                )
            elif temp <= self.TEMP_THRESHOLDS["extreme_cold"]:
                alerts.append(
                    ExposureAlert(
                        alert_type="temperature",
                        severity="high",
                        title="Extreme Cold Alert",
                        description=f"Temperature is {temp}°F. Risk of cold-related illness.",
                        recommendation="Limit outdoor exposure. Dress in layers. Watch for hypothermia signs.",
                        related_symptoms=["respiratory_symptoms", "skin_irritation"],
                    )
                )

        # UV alerts
        if conditions.uv_index is not None and conditions.uv_index >= 8:
            alerts.append(
                ExposureAlert(
                    alert_type="uv",
                    severity="moderate" if conditions.uv_index < 11 else "high",
                    title=f"High UV Index: {conditions.uv_index}",
                    description="Elevated risk of sun damage.",
                    recommendation="Apply sunscreen. Wear protective clothing and hat. Seek shade.",
                    related_symptoms=["skin_irritation", "sunburn"],
                )
            )

        # Pollen alerts
        if conditions.pollen_level and conditions.pollen_level.lower() in ["high", "very_high"]:
            alerts.append(
                ExposureAlert(
                    alert_type="pollen",
                    severity="moderate",
                    title=f"Pollen Level: {conditions.pollen_level}",
                    description="Elevated pollen may trigger allergies.",
                    recommendation="Keep windows closed. Consider allergy medication if appropriate.",
                    related_symptoms=["sneezing", "runny_nose", "itchy_eyes", "watery_eyes"],
                )
            )

        return alerts

    def _correlate_symptoms(
        self,
        symptoms: list[str],
        conditions: EnvironmentalConditions,
    ) -> list[dict[str, Any]]:
        """Find correlations between symptoms and environmental factors."""
        correlations = []

        # Check each symptom category
        for category, category_symptoms in self.ENVIRONMENT_SENSITIVE_SYMPTOMS.items():
            matching = [s for s in symptoms if s.lower() in category_symptoms]

            if not matching:
                continue

            # Determine environmental correlation
            if category == "respiratory":
                if conditions.aqi and conditions.aqi > 100:
                    correlations.append(
                        {
                            "symptoms": matching,
                            "factor": "air_quality",
                            "value": conditions.aqi,
                            "strength": "strong" if conditions.aqi > 150 else "moderate",
                            "explanation": f"Poor air quality (AQI {conditions.aqi}) may be contributing to respiratory symptoms.",
                        }
                    )

                if conditions.temperature_f and conditions.temperature_f <= 40:
                    correlations.append(
                        {
                            "symptoms": matching,
                            "factor": "cold_temperature",
                            "value": conditions.temperature_f,
                            "strength": "moderate",
                            "explanation": "Cold air can irritate airways and trigger respiratory symptoms.",
                        }
                    )

            elif category == "skin" or category == "eye":
                if conditions.pollen_level and conditions.pollen_level.lower() in [
                    "high",
                    "very_high",
                ]:
                    correlations.append(
                        {
                            "symptoms": matching,
                            "factor": "pollen",
                            "value": conditions.pollen_level,
                            "strength": "moderate",
                            "explanation": "High pollen levels may be triggering allergic symptoms.",
                        }
                    )

                if conditions.uv_index and conditions.uv_index >= 8:
                    correlations.append(
                        {
                            "symptoms": matching,
                            "factor": "uv_exposure",
                            "value": conditions.uv_index,
                            "strength": "moderate",
                            "explanation": "High UV exposure may be contributing to skin/eye irritation.",
                        }
                    )

        return correlations

    def _generate_recommendations(
        self,
        conditions: EnvironmentalConditions,
        alerts: list[ExposureAlert],
        symptoms: list[str],
    ) -> list[str]:
        """Generate actionable recommendations."""
        recommendations = []

        # General recommendations based on conditions
        if conditions.aqi and conditions.aqi > 100:
            recommendations.append("Keep windows closed to reduce indoor air pollution")
            recommendations.append("Consider using an air purifier with HEPA filter")
            recommendations.append("Limit outdoor activities, especially vigorous exercise")

        if conditions.temperature_f:
            if conditions.temperature_f >= 85:
                recommendations.append("Ensure adequate hydration - offer water frequently")
                recommendations.append("Schedule outdoor activities for cooler parts of the day")
            elif conditions.temperature_f <= 40:
                recommendations.append("Dress in warm layers for any outdoor time")
                recommendations.append("Limit prolonged outdoor exposure")

        if conditions.humidity_percent:
            if conditions.humidity_percent < 30:
                recommendations.append("Use a humidifier to maintain indoor humidity")
            elif conditions.humidity_percent > 70:
                recommendations.append("Use dehumidifier or AC to reduce humidity")

        # Symptom-specific recommendations
        respiratory_symptoms = ["cough", "wheezing", "difficulty_breathing"]
        if any(s in symptoms for s in respiratory_symptoms):
            recommendations.append(
                "Track when respiratory symptoms worsen relative to outdoor time"
            )
            recommendations.append("Consider keeping a symptom diary noting weather conditions")

        return recommendations

    def _calculate_risk_score(
        self,
        conditions: EnvironmentalConditions,
        alerts: list[ExposureAlert],
    ) -> float:
        """Calculate overall environmental risk score (0-1)."""
        score = 0.0
        factors = 0

        # AQI contribution
        if conditions.aqi is not None:
            factors += 1
            if conditions.aqi > 200:
                score += 0.9
            elif conditions.aqi > 150:
                score += 0.7
            elif conditions.aqi > 100:
                score += 0.5
            elif conditions.aqi > 50:
                score += 0.2
            else:
                score += 0.1

        # Temperature contribution
        if conditions.temperature_f is not None:
            factors += 1
            temp = conditions.temperature_f
            if temp >= 95 or temp <= 32:
                score += 0.7
            elif temp >= 85 or temp <= 45:
                score += 0.4
            else:
                score += 0.1

        # Alert severity contribution
        for alert in alerts:
            if alert.severity == "severe":
                score += 0.3
            elif alert.severity == "high":
                score += 0.2
            elif alert.severity == "moderate":
                score += 0.1

        # Normalize
        if factors > 0:
            return min(1.0, score / factors)
        return 0.2  # Low baseline

    def _get_aqi_description(self, aqi: int) -> str:
        """Get AQI description."""
        for (low, high), (_, _, description) in self.AQI_CATEGORIES.items():
            if low <= aqi <= high:
                return description
        return "Check local air quality advisories"

    def _get_aqi_recommendation(self, aqi: int) -> str:
        """Get AQI-based recommendation."""
        if aqi > 200:
            return "Avoid all outdoor activity. Keep windows closed. Use air purifier if available."
        elif aqi > 150:
            return "Avoid prolonged outdoor exertion. Consider indoor activities."
        elif aqi > 100:
            return "Sensitive individuals should reduce prolonged outdoor activity."
        return "Generally safe for outdoor activity."

    def _conditions_to_dict(self, conditions: EnvironmentalConditions) -> dict[str, Any]:
        """Convert conditions to dictionary."""
        return {
            "aqi": conditions.aqi,
            "aqi_category": conditions.aqi_category,
            "pm25": conditions.pm25,
            "ozone": conditions.ozone,
            "temperature_f": conditions.temperature_f,
            "humidity_percent": conditions.humidity_percent,
            "uv_index": conditions.uv_index,
            "pollen_level": conditions.pollen_level,
            "weather_condition": conditions.weather_condition,
            "location": conditions.location,
            "timestamp": conditions.timestamp.isoformat(),
        }

    def _alert_to_dict(self, alert: ExposureAlert) -> dict[str, Any]:
        """Convert alert to dictionary."""
        return {
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "title": alert.title,
            "description": alert.description,
            "recommendation": alert.recommendation,
            "related_symptoms": alert.related_symptoms,
        }

    def _generate_explanation(
        self,
        conditions: EnvironmentalConditions,
        alerts: list[ExposureAlert],
        correlations: list[dict],
    ) -> str:
        """Generate explanation of environmental analysis."""
        lines = ["## Environmental Analysis\n"]

        # Current conditions
        lines.append("### Current Conditions")
        if conditions.aqi:
            lines.append(f"- Air Quality Index: {conditions.aqi} ({conditions.aqi_category})")
        if conditions.temperature_f:
            lines.append(f"- Temperature: {conditions.temperature_f}°F")
        if conditions.humidity_percent:
            lines.append(f"- Humidity: {conditions.humidity_percent}%")

        # Alerts
        if alerts:
            lines.append("\n### Active Alerts")
            for alert in alerts:
                emoji = {"severe": "🔴", "high": "🟠", "moderate": "🟡", "low": "🟢"}.get(
                    alert.severity, "⚪"
                )
                lines.append(f"{emoji} **{alert.title}**")

        # Correlations
        if correlations:
            lines.append("\n### Potential Environmental Correlations")
            for corr in correlations:
                lines.append(f"- {corr['explanation']}")

        return "\n".join(lines)
