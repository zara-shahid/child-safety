"""
EPCID API Schemas

Pydantic models for API request/response validation.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# Enums
class RiskLevel(str, Enum):
    """Risk level classification."""

    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class SymptomSeverity(str, Enum):
    """Symptom severity levels."""

    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


class Gender(str, Enum):
    """Gender options."""

    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


# Authentication Schemas
class Token(BaseModel):
    """JWT token model."""

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token payload data."""

    email: str | None = None
    user_id: str | None = None
    scopes: list[str] = []


class UserBase(BaseModel):
    """Base user model."""

    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    """User creation model."""

    password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    """User response model."""

    id: str
    email: EmailStr
    full_name: str
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# Child Schemas
class ChildBase(BaseModel):
    """Base child model."""

    name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: datetime
    gender: Gender

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: datetime) -> datetime:
        if v > datetime.now():
            raise ValueError("Date of birth cannot be in the future")
        return v


class ChildCreate(ChildBase):
    """Child creation model."""

    medical_conditions: list[str] = []
    allergies: list[str] = []
    medications: list[str] = []


class ChildUpdate(BaseModel):
    """Child update model."""

    name: str | None = None
    medical_conditions: list[str] | None = None
    allergies: list[str] | None = None
    medications: list[str] | None = None


class ChildResponse(ChildBase):
    """Child response model."""

    id: str
    age_months: int
    medical_conditions: list[str] = []
    allergies: list[str] = []
    medications: list[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Symptom Schemas
class SymptomBase(BaseModel):
    """Base symptom model."""

    symptom_type: str = Field(..., description="Type of symptom (e.g., fever, cough)")
    severity: SymptomSeverity
    notes: str | None = None


class SymptomCreate(SymptomBase):
    """Symptom creation model."""

    child_id: str
    onset_time: datetime | None = None
    measurements: dict[str, Any] | None = Field(
        default=None,
        description="Additional measurements (e.g., temperature: 101.5)",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "child_id": "child-001",
                "symptom_type": "fever",
                "severity": "moderate",
                "onset_time": "2024-01-15T08:00:00Z",
                "measurements": {"temperature": 101.5, "unit": "fahrenheit"},
                "notes": "Started this morning, seems uncomfortable",
            }
        }
    )


class SymptomResponse(SymptomBase):
    """Symptom response model."""

    id: str
    child_id: str
    recorded_at: datetime
    onset_time: datetime | None
    measurements: dict[str, Any] | None

    model_config = ConfigDict(from_attributes=True)


class SymptomHistory(BaseModel):
    """Symptom history response."""

    child_id: str
    symptoms: list[SymptomResponse]
    total_count: int
    date_range: dict[str, datetime]


# Assessment Schemas
class AssessmentRequest(BaseModel):
    """Risk assessment request."""

    child_id: str
    symptoms: list[SymptomCreate]
    location: dict[str, float] | None = Field(
        default=None,
        description="Location for environmental context (lat, lng)",
    )
    include_guidelines: bool = True
    include_environmental: bool = True

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "child_id": "child-001",
                "symptoms": [
                    {
                        "child_id": "child-001",
                        "symptom_type": "fever",
                        "severity": "moderate",
                        "measurements": {"temperature": 102.0},
                    },
                    {"child_id": "child-001", "symptom_type": "cough", "severity": "mild"},
                ],
                "location": {"lat": 40.7128, "lng": -74.0060},
                "include_guidelines": True,
                "include_environmental": True,
            }
        }
    )


class RiskFactor(BaseModel):
    """Individual risk factor."""

    name: str
    contribution: float = Field(..., ge=0, le=1)
    description: str
    source: str


class AssessmentResponse(BaseModel):
    """Risk assessment response."""

    id: str
    child_id: str
    timestamp: datetime
    risk_level: RiskLevel
    risk_score: float = Field(..., ge=0, le=1)
    confidence: float = Field(..., ge=0, le=1)

    # Risk breakdown
    risk_factors: list[RiskFactor]

    # Recommendations
    primary_recommendation: str
    secondary_recommendations: list[str]

    # Flags
    red_flags: list[str]
    warning_signs: list[str]

    # Explanations
    explanation: str
    clinical_reasoning: str

    # Actions
    suggested_actions: list[str]
    when_to_seek_care: str

    # Disclaimers
    disclaimers: list[str]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "assess-001",
                "child_id": "child-001",
                "timestamp": "2024-01-15T10:30:00Z",
                "risk_level": "moderate",
                "risk_score": 0.45,
                "confidence": 0.85,
                "risk_factors": [
                    {
                        "name": "fever",
                        "contribution": 0.3,
                        "description": "Temperature of 102°F is elevated",
                        "source": "symptom_input",
                    }
                ],
                "primary_recommendation": "Monitor symptoms closely",
                "secondary_recommendations": [
                    "Ensure adequate hydration",
                    "Check temperature every 4 hours",
                ],
                "red_flags": [],
                "warning_signs": ["Fever lasting more than 3 days"],
                "explanation": "Based on the reported symptoms...",
                "clinical_reasoning": "Fever in this age group...",
                "suggested_actions": ["Rest", "Fluids"],
                "when_to_seek_care": "If fever exceeds 104°F or lasts more than 3 days",
                "disclaimers": [
                    "This is not a medical diagnosis",
                    "Consult a healthcare provider for medical advice",
                ],
            }
        }
    )


# Guideline Schemas
class GuidelineRequest(BaseModel):
    """Guideline query request."""

    query: str = Field(..., description="Search query for guidelines")
    symptoms: list[str] | None = None
    age_months: int | None = None
    max_results: int = Field(default=5, ge=1, le=20)


class GuidelineSource(BaseModel):
    """Guideline source information."""

    name: str
    url: str | None
    organization: str
    last_updated: datetime | None


class GuidelineResponse(BaseModel):
    """Guideline response."""

    id: str
    title: str
    content: str
    relevance_score: float
    source: GuidelineSource
    key_points: list[str]
    age_specific: bool
    warning_signs: list[str]


class GuidelinesResponse(BaseModel):
    """Multiple guidelines response."""

    query: str
    results: list[GuidelineResponse]
    total_found: int


# Environment Schemas
class LocationRequest(BaseModel):
    """Location for environmental data."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    model_config = ConfigDict(
        json_schema_extra={"example": {"latitude": 40.7128, "longitude": -74.0060}}
    )


class AirQualityResponse(BaseModel):
    """Air quality data response."""

    aqi: int = Field(..., ge=0)
    category: str
    dominant_pollutant: str
    pollutants: dict[str, float]
    health_implications: str
    recommendation: str
    pediatric_advisory: str | None
    data_timestamp: datetime
    location: str


class WeatherResponse(BaseModel):
    """Weather data response."""

    temperature: float
    feels_like: float
    humidity: int
    conditions: str
    wind_speed: float
    uv_index: float | None
    alerts: list[str]
    pediatric_considerations: list[str]
    data_timestamp: datetime
    location: str


class EnvironmentResponse(BaseModel):
    """Combined environmental data."""

    air_quality: AirQualityResponse
    weather: WeatherResponse
    health_impact_summary: str
    recommendations: list[str]


# Generic Schemas
class PaginationParams(BaseModel):
    """Pagination parameters."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    """Generic paginated response."""

    items: list[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str
    message: str
    detail: str | None = None
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )


class SuccessResponse(BaseModel):
    """Generic success response."""

    message: str
    data: dict[str, Any] | None = None
