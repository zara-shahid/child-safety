"""
EPCID Ingestion Agent

Normalizes and validates multimodal inputs:
- Manual symptom entry
- Wearable data (heart rate, temperature)
- Images (rash, swelling, jaundice)
- Voice clips (cough, breathing)
- Environmental data
- FHIR resources

Ensures all data is timestamped, validated, and ready for processing.
"""

import base64
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from .base_agent import AgentConfig, AgentResponse, BaseAgent

logger = logging.getLogger("epcid.agents.ingestion")


class InputType(Enum):
    """Types of input data supported."""

    SYMPTOMS = "symptoms"
    VITALS = "vitals"
    IMAGE = "image"
    VOICE = "voice"
    ENVIRONMENTAL = "environmental"
    FHIR = "fhir"
    WEARABLE = "wearable"
    DEMOGRAPHICS = "demographics"
    MEDICATIONS = "medications"
    HISTORY = "history"


class ValidationStatus(Enum):
    """Validation result status."""

    VALID = "valid"
    INVALID = "invalid"
    WARNING = "warning"
    NORMALIZED = "normalized"


@dataclass
class ValidationResult:
    """Result of input validation."""

    status: ValidationStatus
    field: str
    original_value: Any
    normalized_value: Any
    message: str | None = None


class IngestionAgent(BaseAgent):
    """
    Agent responsible for ingesting and normalizing multimodal health data.

    Key responsibilities:
    - Validate input format and completeness
    - Normalize values to standard units
    - Timestamp all observations
    - Flag suspicious or out-of-range values
    - Prepare data for downstream agents
    """

    # Valid symptom categories
    SYMPTOM_CATEGORIES = {
        "respiratory": [
            "cough",
            "wheezing",
            "difficulty_breathing",
            "rapid_breathing",
            "stridor",
            "nasal_congestion",
            "runny_nose",
            "sneezing",
        ],
        "gastrointestinal": [
            "vomiting",
            "diarrhea",
            "abdominal_pain",
            "nausea",
            "poor_appetite",
            "constipation",
            "blood_in_stool",
        ],
        "neurological": [
            "headache",
            "dizziness",
            "confusion",
            "seizure",
            "unresponsive",
            "irritability",
            "lethargy",
        ],
        "skin": [
            "rash",
            "hives",
            "swelling",
            "bruising",
            "pallor",
            "jaundice",
            "cyanosis",
            "petechiae",
        ],
        "general": [
            "fever",
            "chills",
            "fatigue",
            "weakness",
            "pain",
            "decreased_activity",
            "poor_sleep",
        ],
        "hydration": [
            "decreased_urine",
            "dry_mouth",
            "no_tears",
            "sunken_eyes",
            "sunken_fontanelle",
            "thirst",
        ],
        "ear_nose_throat": ["ear_pain", "sore_throat", "neck_stiffness", "swollen_lymph_nodes"],
    }

    # Vital sign normal ranges by age group (months)
    VITAL_RANGES = {
        # (min_age, max_age): {vital: (min_normal, max_normal, unit)}
        (0, 3): {
            "heart_rate": (100, 180, "bpm"),
            "respiratory_rate": (30, 60, "breaths/min"),
            "temperature": (36.5, 37.5, "celsius"),
            "oxygen_saturation": (95, 100, "percent"),
        },
        (3, 12): {
            "heart_rate": (80, 160, "bpm"),
            "respiratory_rate": (25, 50, "breaths/min"),
            "temperature": (36.5, 37.5, "celsius"),
            "oxygen_saturation": (95, 100, "percent"),
        },
        (12, 36): {
            "heart_rate": (80, 140, "bpm"),
            "respiratory_rate": (20, 40, "breaths/min"),
            "temperature": (36.5, 37.5, "celsius"),
            "oxygen_saturation": (95, 100, "percent"),
        },
        (36, 72): {
            "heart_rate": (70, 120, "bpm"),
            "respiratory_rate": (18, 30, "breaths/min"),
            "temperature": (36.5, 37.5, "celsius"),
            "oxygen_saturation": (95, 100, "percent"),
        },
        (72, 216): {  # 6-18 years
            "heart_rate": (60, 100, "bpm"),
            "respiratory_rate": (12, 20, "breaths/min"),
            "temperature": (36.5, 37.5, "celsius"),
            "oxygen_saturation": (95, 100, "percent"),
        },
    }

    def __init__(
        self,
        config: AgentConfig | None = None,
        **kwargs: Any,
    ) -> None:
        config = config or AgentConfig(
            name="ingestion_agent",
            description="Normalizes and validates multimodal health inputs",
            priority=1,
            timeout_seconds=15,
        )
        super().__init__(config, **kwargs)

        # Build symptom lookup
        self._all_symptoms = set()
        for symptoms in self.SYMPTOM_CATEGORIES.values():
            self._all_symptoms.update(symptoms)

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Process and normalize input data.

        Args:
            input_data: Raw input data with various types
            context: str | None processing context

        Returns:
            AgentResponse with normalized data
        """
        import uuid

        request_id = str(uuid.uuid4())[:12]

        normalized_data = {}
        validation_results: list[ValidationResult] = []
        warnings: list[str] = []

        # Get timestamp
        timestamp = input_data.get(
            "timestamp", datetime.now(__import__("datetime").timezone.utc).isoformat()
        )
        normalized_data["timestamp"] = timestamp

        # Get child ID
        child_id = input_data.get("child_id")
        if child_id:
            normalized_data["child_id"] = child_id

        # Process demographics first (needed for vital sign validation)
        age_months = None
        if "demographics" in input_data:
            demo_result = self._normalize_demographics(input_data["demographics"])
            normalized_data["demographics"] = demo_result["data"]
            validation_results.extend(demo_result["validations"])
            warnings.extend(demo_result["warnings"])
            age_months = demo_result["data"].get("age_months")

        # Process symptoms
        if "symptoms" in input_data:
            symptom_result = self._normalize_symptoms(input_data["symptoms"])
            normalized_data["symptoms"] = symptom_result["data"]
            validation_results.extend(symptom_result["validations"])
            warnings.extend(symptom_result["warnings"])

        # Process vitals
        if "vitals" in input_data:
            vitals_result = self._normalize_vitals(input_data["vitals"], age_months)
            normalized_data["vitals"] = vitals_result["data"]
            validation_results.extend(vitals_result["validations"])
            warnings.extend(vitals_result["warnings"])

        # Process image data
        if "image" in input_data:
            image_result = self._validate_image(input_data["image"])
            normalized_data["image"] = image_result["data"]
            validation_results.extend(image_result["validations"])
            warnings.extend(image_result["warnings"])

        # Process voice data
        if "voice" in input_data:
            voice_result = self._validate_voice(input_data["voice"])
            normalized_data["voice"] = voice_result["data"]
            validation_results.extend(voice_result["validations"])
            warnings.extend(voice_result["warnings"])

        # Process environmental data
        if "environmental" in input_data:
            env_result = self._normalize_environmental(input_data["environmental"])
            normalized_data["environmental"] = env_result["data"]
            validation_results.extend(env_result["validations"])
            warnings.extend(env_result["warnings"])

        # Process medications
        if "medications" in input_data:
            med_result = self._normalize_medications(input_data["medications"])
            normalized_data["medications"] = med_result["data"]
            validation_results.extend(med_result["validations"])
            warnings.extend(med_result["warnings"])

        # Process symptom duration
        if "symptom_duration" in input_data:
            duration = self._normalize_duration(input_data["symptom_duration"])
            normalized_data["symptom_duration_hours"] = duration

        # Calculate data quality score
        quality_score = self._calculate_quality_score(normalized_data, validation_results)

        # Generate explanation
        explanation = self._generate_explanation(
            normalized_data,
            validation_results,
            quality_score,
        )

        return self.create_response(
            request_id=request_id,
            data={
                "normalized": normalized_data,
                "quality_score": quality_score,
                "input_types_processed": list(normalized_data.keys()),
                "validation_summary": {
                    "total": len(validation_results),
                    "valid": sum(
                        1 for v in validation_results if v.status == ValidationStatus.VALID
                    ),
                    "warnings": sum(
                        1 for v in validation_results if v.status == ValidationStatus.WARNING
                    ),
                    "invalid": sum(
                        1 for v in validation_results if v.status == ValidationStatus.INVALID
                    ),
                },
            },
            confidence=quality_score,
            explanation=explanation,
            warnings=warnings,
        )

    def _normalize_symptoms(self, symptoms: list[str] | str) -> dict[str, Any]:
        """Normalize symptom input."""
        validations: list[ValidationResult] = []
        warnings: list[str] = []

        # Handle string input
        if isinstance(symptoms, str):
            symptoms = [s.strip() for s in symptoms.split(",")]

        normalized_symptoms = []
        symptom_details = []

        for symptom in symptoms:
            # Normalize symptom name
            normalized = symptom.lower().strip().replace(" ", "_")

            if normalized in self._all_symptoms:
                normalized_symptoms.append(normalized)
                validations.append(
                    ValidationResult(
                        status=ValidationStatus.VALID,
                        field="symptom",
                        original_value=symptom,
                        normalized_value=normalized,
                    )
                )

                # Find category
                for category, syms in self.SYMPTOM_CATEGORIES.items():
                    if normalized in syms:
                        symptom_details.append(
                            {
                                "name": normalized,
                                "category": category,
                            }
                        )
                        break
            else:
                # Unknown symptom - still include but flag
                normalized_symptoms.append(normalized)
                warnings.append(f"Unknown symptom: {symptom}")
                validations.append(
                    ValidationResult(
                        status=ValidationStatus.WARNING,
                        field="symptom",
                        original_value=symptom,
                        normalized_value=normalized,
                        message="Symptom not in known list",
                    )
                )

        return {
            "data": normalized_symptoms,
            "details": symptom_details,
            "validations": validations,
            "warnings": warnings,
        }

    def _normalize_vitals(
        self,
        vitals: dict[str, Any],
        age_months: int | None = None,
    ) -> dict[str, Any]:
        """Normalize vital signs and check ranges."""
        validations: list[ValidationResult] = []
        warnings: list[str] = []
        normalized: dict[str, Any] = {}

        # Get appropriate ranges for age
        ranges = self._get_vital_ranges(age_months)

        # Temperature
        if "temperature" in vitals:
            temp = vitals["temperature"]
            unit = vitals.get("temperature_unit", "celsius")

            # Convert to Celsius if needed
            if unit.lower() in ["f", "fahrenheit"]:
                temp = (temp - 32) * 5 / 9

            normalized["temperature"] = round(temp, 1)

            # Check range
            if ranges and "temperature" in ranges:
                min_val, max_val, _ = ranges["temperature"]
                if temp < min_val - 1 or temp > max_val + 2:
                    warnings.append(f"Temperature {temp:.1f}°C is outside normal range")
                    validations.append(
                        ValidationResult(
                            status=ValidationStatus.WARNING,
                            field="temperature",
                            original_value=vitals["temperature"],
                            normalized_value=temp,
                            message="Outside normal range",
                        )
                    )
                else:
                    validations.append(
                        ValidationResult(
                            status=ValidationStatus.VALID,
                            field="temperature",
                            original_value=vitals["temperature"],
                            normalized_value=temp,
                        )
                    )

        # Heart rate
        if "heart_rate" in vitals:
            hr = int(vitals["heart_rate"])
            normalized["heart_rate"] = hr

            if ranges and "heart_rate" in ranges:
                min_val, max_val, _ = ranges["heart_rate"]
                if hr < min_val * 0.7 or hr > max_val * 1.3:
                    warnings.append(f"Heart rate {hr} bpm is significantly abnormal")
                    validations.append(
                        ValidationResult(
                            status=ValidationStatus.WARNING,
                            field="heart_rate",
                            original_value=vitals["heart_rate"],
                            normalized_value=hr,
                            message="Significantly outside normal range",
                        )
                    )

        # Respiratory rate
        if "respiratory_rate" in vitals:
            rr = int(vitals["respiratory_rate"])
            normalized["respiratory_rate"] = rr

            if ranges and "respiratory_rate" in ranges:
                min_val, max_val, _ = ranges["respiratory_rate"]
                if rr < min_val * 0.5 or rr > max_val * 1.5:
                    warnings.append(f"Respiratory rate {rr} is significantly abnormal")

        # Oxygen saturation
        if "oxygen_saturation" in vitals:
            spo2 = int(vitals["oxygen_saturation"])
            normalized["oxygen_saturation"] = spo2

            if spo2 < 95:
                warnings.append(f"Oxygen saturation {spo2}% is below normal")
            if spo2 < 90:
                warnings.append("CRITICAL: Oxygen saturation below 90%")

        # Blood pressure
        if "blood_pressure" in vitals or ("systolic" in vitals and "diastolic" in vitals):
            if "blood_pressure" in vitals:
                bp = vitals["blood_pressure"]
                if isinstance(bp, str) and "/" in bp:
                    parts = bp.split("/")
                    normalized["blood_pressure_systolic"] = int(parts[0])
                    normalized["blood_pressure_diastolic"] = int(parts[1])
            else:
                normalized["blood_pressure_systolic"] = int(vitals["systolic"])
                normalized["blood_pressure_diastolic"] = int(vitals["diastolic"])

        return {
            "data": normalized,
            "validations": validations,
            "warnings": warnings,
        }

    def _normalize_demographics(self, demographics: dict[str, Any]) -> dict[str, Any]:
        """Normalize demographic data."""
        validations: list[ValidationResult] = []
        warnings: list[str] = []
        normalized: dict[str, Any] = {}

        # Age
        if "age_months" in demographics:
            normalized["age_months"] = int(demographics["age_months"])
        elif "age_years" in demographics:
            normalized["age_months"] = int(demographics["age_years"]) * 12
        elif "date_of_birth" in demographics:
            # Calculate age from DOB
            dob = datetime.fromisoformat(demographics["date_of_birth"].replace("Z", "+00:00"))
            now = datetime.now(__import__("datetime").timezone.utc)
            age_days = (now - dob.replace(tzinfo=None)).days
            normalized["age_months"] = age_days // 30
            normalized["date_of_birth"] = dob.isoformat()

        # Validate age
        if "age_months" in normalized:
            age = normalized["age_months"]
            if age < 0 or age > 216:  # 0-18 years
                warnings.append(f"Age {age} months is outside expected range")
                validations.append(
                    ValidationResult(
                        status=ValidationStatus.WARNING,
                        field="age_months",
                        original_value=demographics.get("age_months"),
                        normalized_value=age,
                        message="Outside expected pediatric range",
                    )
                )

        # Sex
        if "sex" in demographics:
            sex = demographics["sex"].lower()
            if sex in ["m", "male", "boy"]:
                normalized["sex"] = "male"
            elif sex in ["f", "female", "girl"]:
                normalized["sex"] = "female"
            else:
                normalized["sex"] = "unknown"

        # Weight
        if "weight_kg" in demographics:
            normalized["weight_kg"] = float(demographics["weight_kg"])
        elif "weight_lb" in demographics:
            normalized["weight_kg"] = float(demographics["weight_lb"]) * 0.453592

        # Height
        if "height_cm" in demographics:
            normalized["height_cm"] = float(demographics["height_cm"])
        elif "height_in" in demographics:
            normalized["height_cm"] = float(demographics["height_in"]) * 2.54

        return {
            "data": normalized,
            "validations": validations,
            "warnings": warnings,
        }

    def _validate_image(self, image_data: dict[str, Any]) -> dict[str, Any]:
        """Validate image input."""
        validations: list[ValidationResult] = []
        warnings: list[str] = []
        normalized: dict[str, Any] = {}

        # Check for required fields
        if "data" in image_data or "base64" in image_data:
            data = image_data.get("data") or image_data.get("base64") or ""

            # Validate base64
            try:
                # Check if it's valid base64
                base64.b64decode(data[:100])  # Just check prefix
                normalized["has_image_data"] = True
                normalized["image_size_bytes"] = len(data) * 3 // 4  # Approximate

                validations.append(
                    ValidationResult(
                        status=ValidationStatus.VALID,
                        field="image",
                        original_value="[base64 data]",
                        normalized_value="validated",
                    )
                )
            except Exception:
                warnings.append("Invalid image data format")
                validations.append(
                    ValidationResult(
                        status=ValidationStatus.INVALID,
                        field="image",
                        original_value="[data]",
                        normalized_value=None,
                        message="Invalid base64 encoding",
                    )
                )

        # Body location
        if "body_location" in image_data:
            normalized["body_location"] = image_data["body_location"]

        # Description
        if "description" in image_data:
            normalized["description"] = image_data["description"]

        # Timestamp
        normalized["captured_at"] = image_data.get(
            "timestamp", datetime.now(__import__("datetime").timezone.utc).isoformat()
        )

        return {
            "data": normalized,
            "validations": validations,
            "warnings": warnings,
        }

    def _validate_voice(self, voice_data: dict[str, Any]) -> dict[str, Any]:
        """Validate voice/audio input."""
        validations: list[ValidationResult] = []
        warnings: list[str] = []
        normalized: dict[str, Any] = {}

        # Check for audio data
        if "data" in voice_data or "base64" in voice_data:
            data = voice_data.get("data") or voice_data.get("base64") or ""
            normalized["has_audio_data"] = True
            normalized["audio_size_bytes"] = len(data) * 3 // 4

            validations.append(
                ValidationResult(
                    status=ValidationStatus.VALID,
                    field="voice",
                    original_value="[audio data]",
                    normalized_value="validated",
                )
            )

        # Audio type (cough, breathing, etc.)
        if "audio_type" in voice_data:
            audio_type = voice_data["audio_type"].lower()
            valid_types = ["cough", "breathing", "crying", "voice", "other"]
            if audio_type in valid_types:
                normalized["audio_type"] = audio_type
            else:
                normalized["audio_type"] = "other"
                warnings.append(f"Unknown audio type: {voice_data['audio_type']}")

        # Duration
        if "duration_seconds" in voice_data:
            duration = float(voice_data["duration_seconds"])
            normalized["duration_seconds"] = duration

            if duration < 1:
                warnings.append("Audio clip is very short (<1 second)")
            elif duration > 30:
                warnings.append("Audio clip is very long (>30 seconds)")

        # Timestamp
        normalized["recorded_at"] = voice_data.get(
            "timestamp", datetime.now(__import__("datetime").timezone.utc).isoformat()
        )

        return {
            "data": normalized,
            "validations": validations,
            "warnings": warnings,
        }

    def _normalize_environmental(self, env_data: dict[str, Any]) -> dict[str, Any]:
        """Normalize environmental data."""
        validations: list[ValidationResult] = []
        warnings: list[str] = []
        normalized: dict[str, Any] = {}

        # Location
        if "zip_code" in env_data:
            zip_code = str(env_data["zip_code"])
            if re.match(r"^\d{5}(-\d{4})?$", zip_code):
                normalized["zip_code"] = zip_code[:5]
            else:
                warnings.append(f"Invalid zip code format: {zip_code}")

        if "latitude" in env_data and "longitude" in env_data:
            normalized["latitude"] = float(env_data["latitude"])
            normalized["longitude"] = float(env_data["longitude"])

        # Air quality
        if "aqi" in env_data:
            aqi = int(env_data["aqi"])
            normalized["aqi"] = aqi

            if aqi > 100:
                warnings.append(f"Unhealthy air quality: AQI {aqi}")
            if aqi > 150:
                warnings.append(f"Very unhealthy air quality: AQI {aqi}")

        # Temperature
        if "outdoor_temperature" in env_data:
            temp = float(env_data["outdoor_temperature"])
            unit = env_data.get("temperature_unit", "fahrenheit")
            if unit.lower() in ["c", "celsius"]:
                temp = temp * 9 / 5 + 32  # Convert to F for storage
            normalized["outdoor_temperature_f"] = round(temp, 1)

        # Humidity
        if "humidity" in env_data:
            normalized["humidity_percent"] = int(env_data["humidity"])

        return {
            "data": normalized,
            "validations": validations,
            "warnings": warnings,
        }

    def _normalize_medications(self, medications: list | dict) -> dict[str, Any]:
        """Normalize medication data."""
        validations: list[ValidationResult] = []
        warnings: list[str] = []
        normalized = []

        if isinstance(medications, dict):
            medications = [medications]

        for med in medications:
            if isinstance(med, str):
                normalized.append({"name": med.lower().strip()})
            elif isinstance(med, dict):
                norm_med = {
                    "name": med.get("name", "").lower().strip(),
                }
                if "dose" in med:
                    norm_med["dose"] = med["dose"]
                if "frequency" in med:
                    norm_med["frequency"] = med["frequency"]
                if "last_taken" in med:
                    norm_med["last_taken"] = med["last_taken"]
                normalized.append(norm_med)

        return {
            "data": normalized,
            "validations": validations,
            "warnings": warnings,
        }

    def _normalize_duration(self, duration: str | int | float) -> float:
        """Normalize symptom duration to hours."""
        if isinstance(duration, (int, float)):
            return float(duration)

        # Parse string duration
        duration = duration.lower().strip()

        # Try to extract number and unit
        match = re.match(r"(\d+(?:\.\d+)?)\s*(hours?|hrs?|days?|d|minutes?|mins?|m)?", duration)
        if match:
            value = float(match.group(1))
            unit = match.group(2) or "hours"

            if unit.startswith("day") or unit == "d":
                return value * 24
            elif unit.startswith("min") or unit == "m":
                return value / 60
            else:
                return value

        return 0.0

    def _get_vital_ranges(self, age_months: int | None) -> dict | None:
        """Get appropriate vital sign ranges for age."""
        if age_months is None:
            return None

        for (min_age, max_age), ranges in self.VITAL_RANGES.items():
            if min_age <= age_months < max_age:
                return ranges

        # Default to oldest age group
        return self.VITAL_RANGES[(72, 216)]

    def _calculate_quality_score(
        self,
        normalized_data: dict[str, Any],
        validations: list[ValidationResult],
    ) -> float:
        """Calculate overall data quality score (0-1)."""
        score = 0.5  # Base score

        # Bonus for complete data
        important_fields = ["symptoms", "vitals", "demographics"]
        present = sum(1 for f in important_fields if f in normalized_data)
        score += present * 0.1

        # Bonus for timestamps
        if "timestamp" in normalized_data:
            score += 0.05

        # Penalty for validation issues
        invalid_count = sum(1 for v in validations if v.status == ValidationStatus.INVALID)
        warning_count = sum(1 for v in validations if v.status == ValidationStatus.WARNING)

        score -= invalid_count * 0.1
        score -= warning_count * 0.02

        return max(0.1, min(1.0, score))

    def _generate_explanation(
        self,
        normalized_data: dict[str, Any],
        validations: list[ValidationResult],
        quality_score: float,
    ) -> str:
        """Generate explanation of ingestion results."""
        lines = ["## Data Ingestion Summary\n"]

        # Data types processed
        data_types = [k for k in normalized_data.keys() if k not in ["timestamp", "child_id"]]
        lines.append(f"**Processed:** {', '.join(data_types)}")
        lines.append(f"**Quality Score:** {quality_score:.0%}")

        # Validation summary
        valid = sum(1 for v in validations if v.status == ValidationStatus.VALID)
        warnings = sum(1 for v in validations if v.status == ValidationStatus.WARNING)
        invalid = sum(1 for v in validations if v.status == ValidationStatus.INVALID)

        lines.append(f"\n**Validation:** {valid} valid, {warnings} warnings, {invalid} invalid")

        # Specific warnings
        warning_msgs = [
            v.message for v in validations if v.status == ValidationStatus.WARNING and v.message
        ]
        if warning_msgs:
            lines.append("\n**Warnings:**")
            for msg in warning_msgs[:5]:
                lines.append(f"- {msg}")

        return "\n".join(lines)
