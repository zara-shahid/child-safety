"""
EPCID Input Validation Utilities

Provides comprehensive input validation:
- Type validation
- Range validation
- Format validation
- Pediatric-specific validation
- Safety validation
"""

import logging
import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, cast

logger = logging.getLogger("epcid.utils.validator")


class ValidationError(Exception):
    """Raised when validation fails."""

    def __init__(self, message: str, field: str | None = None, value: Any = None):
        super().__init__(message)
        self.field = field
        self.value = value
        self.message = message


@dataclass
class ValidationResult:
    """Result of a validation check."""

    valid: bool
    field: str
    message: str | None = None
    value: Any = None
    normalized_value: Any = None


@dataclass
class ValidationRule:
    """A validation rule definition."""

    name: str
    field: str
    validator: Callable[[Any], bool]
    error_message: str
    required: bool = False
    normalizer: Callable[[Any], Any] | None = None


class InputValidator:
    """
    Comprehensive input validator for EPCID.

    Validates:
    - Demographics (age, weight, height)
    - Vital signs (temperature, heart rate, etc.)
    - Symptoms
    - Medications
    - Environmental data
    """

    # Temperature ranges (Celsius)
    TEMP_RANGE = (35.0, 42.0)

    # Heart rate ranges by age (beats per minute)
    HR_RANGES = {
        (0, 3): (100, 190),  # 0-3 months
        (3, 12): (80, 170),  # 3-12 months
        (12, 36): (70, 150),  # 1-3 years
        (36, 72): (65, 135),  # 3-6 years
        (72, 144): (60, 120),  # 6-12 years
        (144, 216): (55, 110),  # 12-18 years
    }

    # Respiratory rate ranges by age
    RR_RANGES = {
        (0, 3): (30, 60),
        (3, 12): (25, 50),
        (12, 36): (20, 40),
        (36, 72): (18, 30),
        (72, 144): (15, 25),
        (144, 216): (12, 20),
    }

    # Valid symptom list
    VALID_SYMPTOMS = {
        "fever",
        "cough",
        "vomiting",
        "diarrhea",
        "rash",
        "headache",
        "abdominal_pain",
        "ear_pain",
        "sore_throat",
        "runny_nose",
        "nasal_congestion",
        "sneezing",
        "wheezing",
        "difficulty_breathing",
        "rapid_breathing",
        "fatigue",
        "weakness",
        "poor_appetite",
        "decreased_urine",
        "dry_mouth",
        "no_tears",
        "sunken_eyes",
        "irritability",
        "lethargy",
        "seizure",
        "unresponsive",
        "cyanosis",
        "stridor",
        "pain",
        "swelling",
        "bruising",
        "bleeding",
    }

    def __init__(self, strict_mode: bool = False):
        self.strict_mode = strict_mode
        self._custom_rules: list[ValidationRule] = []

    def add_rule(self, rule: ValidationRule) -> None:
        """Add a custom validation rule."""
        self._custom_rules.append(rule)

    def validate_all(
        self,
        data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> list[ValidationResult]:
        """
        Validate all data fields.

        Args:
            data: Input data to validate
            context: str | None context (e.g., age for range validation)

        Returns:
            List of ValidationResult objects
        """
        results = []

        # Validate demographics
        if "demographics" in data:
            results.extend(self.validate_demographics(data["demographics"]))

        # Validate vitals
        if "vitals" in data:
            age_months = data.get("demographics", {}).get("age_months")
            results.extend(self.validate_vitals(data["vitals"], age_months))

        # Validate symptoms
        if "symptoms" in data:
            results.extend(self.validate_symptoms(data["symptoms"]))

        # Validate medications
        if "medications" in data:
            results.extend(self.validate_medications(data["medications"]))

        # Run custom rules
        for rule in self._custom_rules:
            if rule.field in data:
                result = self._run_rule(rule, data[rule.field])
                results.append(result)
            elif rule.required:
                results.append(
                    ValidationResult(
                        valid=False,
                        field=rule.field,
                        message=f"Required field '{rule.field}' is missing",
                    )
                )

        return results

    def validate_demographics(
        self,
        demographics: dict[str, Any],
    ) -> list[ValidationResult]:
        """Validate demographic data."""
        results = []

        # Age validation
        if "age_months" in demographics:
            age = demographics["age_months"]
            valid = isinstance(age, (int, float)) and 0 <= age <= 216
            results.append(
                ValidationResult(
                    valid=valid,
                    field="age_months",
                    value=age,
                    message=None if valid else "Age must be between 0 and 216 months (0-18 years)",
                )
            )

        # Weight validation
        if "weight_kg" in demographics:
            weight = demographics["weight_kg"]
            valid = isinstance(weight, (int, float)) and 0.5 <= weight <= 150
            results.append(
                ValidationResult(
                    valid=valid,
                    field="weight_kg",
                    value=weight,
                    message=None if valid else "Weight must be between 0.5 and 150 kg",
                )
            )

        # Sex validation
        if "sex" in demographics:
            sex = demographics["sex"]
            valid = sex in ["male", "female", "unknown"]
            results.append(
                ValidationResult(
                    valid=valid,
                    field="sex",
                    value=sex,
                    message=None if valid else "Sex must be 'male', 'female', or 'unknown'",
                )
            )

        return results

    def validate_vitals(
        self,
        vitals: dict[str, Any],
        age_months: int | None = None,
    ) -> list[ValidationResult]:
        """Validate vital signs."""
        results = []

        # Temperature
        if "temperature" in vitals:
            temp = vitals["temperature"]
            valid = (
                isinstance(temp, (int, float)) and self.TEMP_RANGE[0] <= temp <= self.TEMP_RANGE[1]
            )

            # Flag suspicious values
            message = None
            if not valid:
                message = f"Temperature {temp}°C is outside valid range {self.TEMP_RANGE}"
            elif temp > 41.5:
                message = "Warning: Extremely high temperature - verify measurement"

            results.append(
                ValidationResult(
                    valid=valid,
                    field="temperature",
                    value=temp,
                    message=message,
                )
            )

        # Heart rate
        if "heart_rate" in vitals:
            hr = vitals["heart_rate"]
            valid = isinstance(hr, (int, float)) and 30 <= hr <= 250

            # Age-specific validation
            if valid and age_months is not None:
                expected_range = self._get_age_range(self.HR_RANGES, age_months)
                if expected_range and not (
                    expected_range[0] * 0.7 <= hr <= expected_range[1] * 1.3
                ):
                    results.append(
                        ValidationResult(
                            valid=True,  # Still valid, but warning
                            field="heart_rate",
                            value=hr,
                            message=f"Heart rate {hr} is outside typical range for age ({expected_range[0]}-{expected_range[1]})",
                        )
                    )
            else:
                results.append(
                    ValidationResult(
                        valid=valid,
                        field="heart_rate",
                        value=hr,
                        message=None if valid else "Heart rate must be between 30 and 250 bpm",
                    )
                )

        # Respiratory rate
        if "respiratory_rate" in vitals:
            rr = vitals["respiratory_rate"]
            valid = isinstance(rr, (int, float)) and 5 <= rr <= 80
            results.append(
                ValidationResult(
                    valid=valid,
                    field="respiratory_rate",
                    value=rr,
                    message=None if valid else "Respiratory rate must be between 5 and 80",
                )
            )

        # Oxygen saturation
        if "oxygen_saturation" in vitals:
            spo2 = vitals["oxygen_saturation"]
            valid = isinstance(spo2, (int, float)) and 50 <= spo2 <= 100
            results.append(
                ValidationResult(
                    valid=valid,
                    field="oxygen_saturation",
                    value=spo2,
                    message=None if valid else "Oxygen saturation must be between 50 and 100%",
                )
            )

        return results

    def validate_symptoms(
        self,
        symptoms: list[str] | str,
    ) -> list[ValidationResult]:
        """Validate symptom list."""
        results = []

        if isinstance(symptoms, str):
            symptoms = [s.strip() for s in symptoms.split(",")]

        for symptom in symptoms:
            normalized = symptom.lower().strip().replace(" ", "_")
            valid = normalized in self.VALID_SYMPTOMS

            results.append(
                ValidationResult(
                    valid=valid or not self.strict_mode,
                    field="symptom",
                    value=symptom,
                    normalized_value=normalized,
                    message=None if valid else f"Unknown symptom: {symptom}",
                )
            )

        return results

    def validate_medications(
        self,
        medications: list,
    ) -> list[ValidationResult]:
        """Validate medication list."""
        results = []

        for med in medications:
            if isinstance(med, str):
                valid = len(med.strip()) > 0
                results.append(
                    ValidationResult(
                        valid=valid,
                        field="medication",
                        value=med,
                        message=None if valid else "Medication name cannot be empty",
                    )
                )
            elif isinstance(med, dict):
                name = med.get("name", "")
                valid = len(name.strip()) > 0
                results.append(
                    ValidationResult(
                        valid=valid,
                        field="medication.name",
                        value=name,
                        message=None if valid else "Medication name is required",
                    )
                )

        return results

    def validate_required_fields(
        self,
        data: dict[str, Any],
        required: list[str],
    ) -> list[ValidationResult]:
        """Validate that required fields are present."""
        results = []

        for field in required:
            present = field in data and data[field] is not None
            results.append(
                ValidationResult(
                    valid=present,
                    field=field,
                    message=None if present else f"Required field '{field}' is missing",
                )
            )

        return results

    def _get_age_range(
        self,
        ranges: dict,
        age_months: int,
    ) -> tuple | None:
        """Get the appropriate range for an age."""
        for (low, high), range_val in ranges.items():
            if low <= age_months < high:
                return cast(tuple[Any, ...] | None, range_val)
        return None

    def _run_rule(
        self,
        rule: ValidationRule,
        value: Any,
    ) -> ValidationResult:
        """Run a single validation rule."""
        try:
            valid = rule.validator(value)
            normalized = rule.normalizer(value) if rule.normalizer else None

            return ValidationResult(
                valid=valid,
                field=rule.field,
                value=value,
                normalized_value=normalized,
                message=None if valid else rule.error_message,
            )
        except Exception as e:
            return ValidationResult(
                valid=False,
                field=rule.field,
                value=value,
                message=f"Validation error: {str(e)}",
            )

    @staticmethod
    def is_valid_email(email: str) -> bool:
        """Validate email format."""
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, email))

    @staticmethod
    def is_valid_phone(phone: str) -> bool:
        """Validate phone number format."""
        # Remove common separators
        cleaned = re.sub(r"[\s\-\.\(\)]", "", phone)
        # Check for valid digits
        return bool(re.match(r"^\+?1?\d{10,14}$", cleaned))

    @staticmethod
    def is_valid_zip_code(zip_code: str) -> bool:
        """Validate US zip code format."""
        return bool(re.match(r"^\d{5}(-\d{4})?$", zip_code))


def validate_or_raise(
    validator: InputValidator,
    data: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Validate data and raise ValidationError if invalid.

    Args:
        validator: InputValidator instance
        data: Data to validate
        context: str | None context

    Returns:
        Validated data

    Raises:
        ValidationError: If validation fails
    """
    results = validator.validate_all(data, context)

    invalid = [r for r in results if not r.valid]
    if invalid:
        first_error = invalid[0]
        raise ValidationError(
            message=first_error.message or f"Validation failed for {first_error.field}",
            field=first_error.field,
            value=first_error.value,
        )

    return data
