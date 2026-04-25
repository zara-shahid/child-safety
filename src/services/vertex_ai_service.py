"""
Vertex AI Gemini Service — Enterprise-grade AI for EPCID Backend

This service uses Vertex AI's Gemini API for server-side AI operations,
providing enterprise security (IAM authentication) and advanced features
like grounding and function calling.

For the Live API (voice/vision), we use @google/genai SDK on the frontend
since it provides better real-time streaming support.

Google Cloud Services Used:
- Vertex AI Gemini API (gemini-2.5-flash)
- Secret Manager (for API key storage)
- Cloud Run (deployment)
"""

import json
import logging
import os
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

# Check if we're running on Google Cloud
IS_GOOGLE_CLOUD = (
    os.environ.get("K_SERVICE") is not None or os.environ.get("GOOGLE_CLOUD_PROJECT") is not None
)

if IS_GOOGLE_CLOUD:
    try:
        import vertexai
        from vertexai.generative_models import (
            GenerationConfig,
            GenerativeModel,
            HarmBlockThreshold,
            HarmCategory,
            SafetySetting,
        )

        VERTEX_AI_AVAILABLE = True
    except ImportError:
        VERTEX_AI_AVAILABLE = False
        logger.warning("Vertex AI SDK not installed. Using fallback.")
else:
    VERTEX_AI_AVAILABLE = False
    logger.info("Not running on Google Cloud. Vertex AI disabled.")


class VertexAIService:
    """
    Vertex AI Gemini Service for EPCID backend agents.

    Provides enterprise-grade AI capabilities:
    - IAM-based authentication (no API keys in code)
    - Structured JSON output for reliable parsing
    - Safety settings tuned for healthcare content
    - Automatic grounding (future enhancement)
    """

    def __init__(
        self,
        project_id: str | None = None,
        location: str = "us-central1",
        model_name: str = "gemini-2.5-flash",
    ):
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT")
        self.location = location
        self.model_name = model_name
        self.model: Any | None = None
        self._initialized = False

        if VERTEX_AI_AVAILABLE and self.project_id:
            self._initialize()

    def _initialize(self) -> None:
        """Initialize Vertex AI with project and location."""
        try:
            vertexai.init(project=self.project_id, location=self.location)

            self.model = GenerativeModel(
                self.model_name,
                system_instruction=self._get_system_instruction(),
            )

            self._initialized = True
            logger.info(
                f"Vertex AI initialized: project={self.project_id}, model={self.model_name}"
            )

        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI: {e}")
            self._initialized = False

    def _get_system_instruction(self) -> str:
        """System instruction for pediatric health assessment."""
        return """You are the EPCID Clinical Analysis Engine — an AI system designed to assist
with pediatric health assessment. You provide evidence-based analysis while always
recommending professional medical evaluation.

CORE PRINCIPLES:
1. Patient safety is paramount - err on the side of caution
2. Never diagnose - provide risk assessments and recommendations
3. Always consider age-specific factors for pediatric patients
4. Cite clinical guidelines when possible (AAP, CDC, Phoenix Sepsis Criteria)

OUTPUT FORMAT:
- Always return valid JSON when requested
- Include confidence levels for assessments
- Provide clear reasoning for recommendations"""

    def _get_safety_settings(self) -> list[Any]:
        """Safety settings tuned for healthcare content."""
        if not VERTEX_AI_AVAILABLE:
            return []

        return [
            SafetySetting(
                category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH,
            ),
            SafetySetting(
                category=HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            SafetySetting(
                category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            SafetySetting(
                category=HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
        ]

    @property
    def is_available(self) -> bool:
        """Check if Vertex AI is available and initialized."""
        return self._initialized and self.model is not None

    async def analyze_symptoms(
        self,
        symptoms: list[str],
        child_age_years: float,
        vitals: dict | None = None,
        additional_context: str | None = None,
    ) -> dict[str, Any]:
        """
        Analyze pediatric symptoms using Vertex AI Gemini.

        Args:
            symptoms: List of symptom descriptions
            child_age_years: Age of child in years
            vitals: Optional vital signs (temp, hr, rr, spo2)
            additional_context: Optional additional notes

        Returns:
            dict with urgency, recommendation, warningSignsToWatch, etc.
        """
        if not self.is_available:
            return self._fallback_analysis(symptoms, child_age_years)

        prompt = self._build_symptom_prompt(symptoms, child_age_years, vitals, additional_context)

        assert self.model is not None
        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config=GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=2048,
                    response_mime_type="application/json",
                ),
                safety_settings=self._get_safety_settings(),
            )

            raw_text = response.text.strip()
            # Handle potential markdown fencing
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            result: dict[str, Any] = json.loads(raw_text)
            result["provider"] = "vertex_ai"
            result["model"] = self.model_name
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Vertex AI JSON parse failed: {e}")
            # Return partial fallback but mark as vertex_ai since the model DID respond
            fallback = self._fallback_analysis(symptoms, child_age_years)
            fallback["provider"] = "vertex_ai_partial"
            fallback["reasoning"] = (
                "Vertex AI responded but output could not be parsed. Conservative fallback applied."
            )
            return fallback
        except Exception as e:
            logger.error(f"Vertex AI symptom analysis failed: {e}")
            return self._fallback_analysis(symptoms, child_age_years)

    def _build_symptom_prompt(
        self,
        symptoms: list[str],
        child_age_years: float,
        vitals: dict | None,
        additional_context: str | None,
    ) -> str:
        """Build the symptom analysis prompt."""
        age_context = self._get_age_context(child_age_years)

        vitals_str = ""
        if vitals:
            vitals_str = f"""
Vital Signs:
- Temperature: {vitals.get('temperature', 'Not provided')}°F
- Heart Rate: {vitals.get('heart_rate', 'Not provided')} bpm
- Respiratory Rate: {vitals.get('respiratory_rate', 'Not provided')}/min
- Oxygen Saturation: {vitals.get('oxygen_saturation', 'Not provided')}%
"""

        return f"""Analyze these pediatric symptoms and provide a clinical risk assessment.

PATIENT: {child_age_years} years old
AGE CONTEXT: {age_context}

SYMPTOMS:
{chr(10).join(f'- {s}' for s in symptoms)}
{vitals_str}
ADDITIONAL NOTES: {additional_context or 'None'}

Provide a JSON response with this EXACT structure:
{{
    "urgency": "low" | "moderate" | "high" | "critical",
    "confidence": 0.0-1.0,
    "recommendation": "Primary recommendation in 2-3 sentences",
    "reasoning": "Clinical reasoning for the assessment",
    "homeCareTips": ["tip1", "tip2", "tip3"],
    "warningSignsToWatch": ["sign1", "sign2", "sign3"],
    "whenToSeekCare": "Specific guidance on when to see a doctor",
    "possibleConditions": ["condition1", "condition2"],
    "clinicalScores": {{
        "pewsEstimate": "low/moderate/high",
        "sepsisRisk": "low/moderate/high"
    }}
}}

RULES:
- For infants <3 months with ANY fever (≥100.4°F), urgency must be "critical"
- For breathing difficulties, urgency must be at least "high"
- Always recommend professional evaluation for moderate+ urgency
- Be conservative - when in doubt, escalate"""

    def _get_age_context(self, age_years: float) -> str:
        """Get age-specific clinical context."""
        if age_years < 0.25:
            return "CRITICAL: Infant under 3 months. Any fever requires immediate evaluation. Very high sepsis risk."
        elif age_years < 1:
            return "Infant 3-12 months. Fever >102°F concerning. Cannot communicate symptoms."
        elif age_years < 2:
            return "Toddler 1-2 years. May not communicate well. Watch behavior changes."
        elif age_years < 5:
            return (
                "Preschool 2-5 years. May exaggerate or minimize. Correlate with observed behavior."
            )
        elif age_years < 12:
            return (
                "School-age 5-12 years. Can usually describe symptoms. Verify with objective signs."
            )
        else:
            return "Adolescent 12+ years. Can describe symptoms well. Consider age-specific conditions."

    def _fallback_analysis(self, symptoms: list[str], child_age_years: float) -> dict[str, Any]:
        """Provide a safe fallback analysis when Vertex AI is unavailable."""
        symptoms_lower = " ".join(symptoms).lower()

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

        if is_emergency or (is_infant and has_fever):
            urgency = "critical"
        elif has_fever and child_age_years < 1:
            urgency = "high"
        else:
            urgency = "moderate"

        return {
            "urgency": urgency,
            "confidence": 0.6,
            "recommendation": "Based on the symptoms described, we recommend consulting with your pediatrician for proper evaluation. For any emergency symptoms, call 911 immediately.",
            "reasoning": "Fallback assessment - Vertex AI unavailable",
            "homeCareTips": [
                "Keep child comfortable and rested",
                "Ensure adequate fluid intake",
                "Monitor temperature every 4 hours",
            ],
            "warningSignsToWatch": [
                "Difficulty breathing or rapid breathing",
                "Refusal to drink fluids",
                "Unusual drowsiness or irritability",
                "Rash that doesn't fade when pressed",
            ],
            "whenToSeekCare": "Contact your pediatrician if symptoms worsen or don't improve within 24-48 hours.",
            "possibleConditions": [],
            "clinicalScores": {"pewsEstimate": "unknown", "sepsisRisk": "unknown"},
            "provider": "fallback",
            "model": "rule_based",
        }

    async def generate_care_advice(
        self,
        condition: str,
        child_age_years: float,
        severity: str = "mild",
    ) -> dict[str, Any]:
        """
        Generate home care advice for a specific condition.

        Args:
            condition: The condition (e.g., "fever", "cough", "rash")
            child_age_years: Age of child in years
            severity: Severity level (mild, moderate, severe)

        Returns:
            dict with care instructions, medication guidance, when to worry
        """
        if not self.is_available:
            return {"error": "Vertex AI not available", "provider": "fallback"}

        prompt = f"""Provide home care advice for a pediatric patient.

CONDITION: {condition}
PATIENT AGE: {child_age_years} years
SEVERITY: {severity}

Provide a JSON response with:
{{
    "overview": "Brief overview of the condition",
    "careInstructions": ["step1", "step2", "step3"],
    "medicationGuidance": {{
        "appropriate": ["medication1", "medication2"],
        "avoid": ["medication to avoid"],
        "notes": "Dosing guidance based on age/weight"
    }},
    "hydrationTips": ["tip1", "tip2"],
    "comfortMeasures": ["measure1", "measure2"],
    "whenToWorry": ["warning sign 1", "warning sign 2"],
    "expectedDuration": "How long symptoms typically last",
    "sources": ["AAP", "CDC", etc.]
}}"""

        assert self.model is not None
        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config=GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2048,
                    response_mime_type="application/json",
                ),
                safety_settings=self._get_safety_settings(),
            )

            raw_text = response.text.strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            result: dict[str, Any] = json.loads(raw_text)
            result["provider"] = "vertex_ai"
            return result

        except Exception as e:
            logger.error(f"Vertex AI care advice failed: {e}")
            return {"error": str(e), "provider": "fallback"}


# Singleton instance
@lru_cache(maxsize=1)
def get_vertex_ai_service() -> VertexAIService:
    """Get the Vertex AI service singleton."""
    return VertexAIService()


# Export for easy import
__all__ = ["VertexAIService", "get_vertex_ai_service", "VERTEX_AI_AVAILABLE"]
