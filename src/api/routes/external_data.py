"""
EPCID External Data API Routes

Endpoints for accessing external health data:
- Disease surveillance (CDC)
- Air quality (AirNow/OpenAQ)
- Drug information (OpenFDA)
- Growth charts (WHO/CDC)
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/external-data", tags=["External Data"])


# ============== Request/Response Models ==============


class DiseaseActivityResponse(BaseModel):
    """Disease activity in a region."""

    disease: str
    region: str
    state: str
    activity_level: str
    trend: str
    week: str
    pediatric_impact: str
    recommendation: str


class OutbreakAlert(BaseModel):
    """Disease outbreak alert."""

    type: str
    disease: str
    severity: str
    title: str
    message: str
    pediatric_impact: str
    trend: str


class VaccinationDue(BaseModel):
    """Vaccination due for a child."""

    vaccine_name: str
    disease: str
    recommended_age: str
    dose: str
    catch_up_age: str | None
    notes: str


class GrowthPercentileRequest(BaseModel):
    """Request for growth percentile calculation."""

    age_months: int
    sex: str
    measurement_type: str  # weight, height, head_circumference
    value: float
    unit: str  # kg, lbs, cm, inches


class GrowthPercentileResponse(BaseModel):
    """Growth percentile result."""

    percentile: int | None
    status: str
    message: str
    reference: dict | None


class VitalRangeResponse(BaseModel):
    """Normal vital sign range for age."""

    vital_type: str
    age_months: int
    age_group: str
    low: float
    normal_low: float
    normal_high: float
    high: float
    unit: str


class AirQualityResponse(BaseModel):
    """Air quality reading."""

    aqi: int
    category: str
    pollutant: str
    value: float
    unit: str
    location: str
    timestamp: str
    source: str
    pediatric_guidance: dict


class DrugInfoResponse(BaseModel):
    """Drug information from OpenFDA."""

    brand_name: str
    generic_name: str
    manufacturer: str
    route: list[str]
    warnings: list[str]
    pediatric_use: str | None
    adverse_reactions: list[str]


# ============== CDC Endpoints ==============


@router.get(
    "/disease-activity/{state}",
    response_model=list[DiseaseActivityResponse],
    summary="Get disease activity for a state",
    description="Returns current disease activity levels from CDC surveillance data.",
)
async def get_disease_activity(
    state: str,
    diseases: str | None = Query(None, description="Comma-separated disease types"),
) -> list[dict[str, Any]]:
    """
    Get current disease activity for a state.

    - **state**: Two-letter state code (e.g., "CA", "NY")
    - **diseases**: str | None filter for specific diseases (influenza, rsv, covid, strep)
    """
    from ...services.cdc_service import CDCService, DiseaseType

    service = CDCService()

    disease_list = None
    if diseases:
        disease_list = [DiseaseType(d.strip().lower()) for d in diseases.split(",")]

    activities = await service.get_disease_activity(state.upper(), disease_list)

    return [activity.to_dict() for activity in activities]


@router.get(
    "/outbreak-alerts/{state}",
    response_model=list[OutbreakAlert],
    summary="Get outbreak alerts",
    description="Returns active disease outbreak alerts for a region.",
)
async def get_outbreak_alerts(
    state: str,
    zip_code: str | None = None,
) -> list[OutbreakAlert]:
    """
    Get active outbreak alerts for a state.

    Returns alerts for diseases with HIGH or VERY_HIGH activity levels.
    """
    from ...services.cdc_service import CDCService

    service = CDCService()
    alerts = await service.get_outbreak_alerts(state.upper(), zip_code)

    return [OutbreakAlert(**alert) if isinstance(alert, dict) else alert for alert in alerts]


@router.get(
    "/vaccinations/due",
    response_model=list[VaccinationDue],
    summary="Get due vaccinations",
    description="Returns vaccinations due for a child based on age.",
)
async def get_due_vaccinations(
    age_months: int = Query(..., ge=0, le=216, description="Child's age in months"),
    include_catchup: bool = Query(True, description="Include catch-up vaccines"),
) -> list[dict[str, Any]]:
    """
    Get recommended vaccinations for a child's age.

    Based on the CDC 2024 immunization schedule.
    """
    from ...services.cdc_service import CDCService

    service = CDCService()
    vaccines = service.get_vaccination_schedule(age_months, include_catchup)

    return [v.to_dict() for v in vaccines]


@router.post(
    "/growth/percentile",
    response_model=GrowthPercentileResponse,
    summary="Calculate growth percentile",
    description="Calculate growth percentile based on WHO/CDC growth charts.",
)
async def calculate_growth_percentile(
    request: GrowthPercentileRequest,
) -> GrowthPercentileResponse:
    """
    Calculate growth percentile for a measurement.

    - **age_months**: Child's age in months
    - **sex**: 'male' or 'female'
    - **measurement_type**: 'weight', 'height', or 'head_circumference'
    - **value**: The measured value
    - **unit**: Unit of measurement (kg, lbs, cm, inches)
    """
    from ...services.cdc_service import CDCService

    # Convert units if needed
    value = request.value
    if request.unit == "lbs":
        value = value * 0.453592  # Convert to kg
    elif request.unit == "inches":
        value = value * 2.54  # Convert to cm

    service = CDCService()
    result = service.get_growth_percentile(
        request.age_months,
        request.sex.lower(),
        request.measurement_type.lower(),
        value,
    )

    return GrowthPercentileResponse(**result)


@router.get(
    "/vital-ranges",
    response_model=VitalRangeResponse,
    summary="Get normal vital sign ranges",
    description="Returns age-appropriate normal ranges for vital signs.",
)
async def get_vital_ranges(
    age_months: int = Query(..., ge=0, le=216, description="Child's age in months"),
    vital_type: str = Query(..., description="heart_rate, respiratory_rate, or temperature"),
) -> VitalRangeResponse | dict[str, Any]:
    """
    Get normal vital sign ranges for a child's age.

    Based on PALS (Pediatric Advanced Life Support) guidelines.
    """
    from ...services.cdc_service import CDCService

    service = CDCService()
    result = service.get_vital_sign_reference(age_months, vital_type.lower())

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# ============== Air Quality Endpoints ==============


@router.get(
    "/air-quality",
    response_model=AirQualityResponse,
    summary="Get air quality",
    description="Returns current air quality with pediatric health guidance.",
)
async def get_air_quality(
    zip_code: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    """
    Get current air quality for a location.

    Provide either zip_code OR latitude/longitude.
    """
    from ...services.air_quality_service import AirQualityService

    if not zip_code and not (latitude and longitude):
        raise HTTPException(
            status_code=400,
            detail="Provide either zip_code or latitude/longitude",
        )

    service = AirQualityService()
    reading = await service.get_current_aqi(zip_code, latitude, longitude)

    if not reading:
        raise HTTPException(status_code=404, detail="Air quality data not available")

    guidance = service.get_pediatric_guidance(reading.aqi)

    return {
        **reading.to_dict(),
        "pediatric_guidance": guidance,
    }


# ============== Drug Information Endpoints ==============


@router.get(
    "/drug-info/{drug_name}",
    response_model=DrugInfoResponse,
    summary="Get drug information",
    description="Returns drug label information from OpenFDA.",
)
async def get_drug_info(drug_name: str) -> dict[str, Any]:
    """
    Get drug information from OpenFDA.

    - **drug_name**: Brand or generic drug name (e.g., "Tylenol", "acetaminophen")
    """
    from ...services.openfda_service import OpenFDAService

    service = OpenFDAService()
    label = await service.get_drug_label(drug_name)

    if not label:
        raise HTTPException(
            status_code=404,
            detail=f"Drug information not found for '{drug_name}'",
        )

    return label.to_dict()


@router.get(
    "/drug-interactions",
    summary="Check drug interaction with symptom",
    description="Check if a symptom is commonly associated with a drug.",
)
async def check_drug_interaction(
    drug_name: str = Query(..., description="Drug name"),
    symptom: str = Query(..., description="Symptom to check"),
) -> dict[str, Any]:
    """
    Check if a symptom is commonly reported with a drug.

    Uses FDA adverse event reports. Note: This does not establish
    causation, only correlation in reported events.
    """
    from ...services.openfda_service import OpenFDAService

    service = OpenFDAService()
    result = await service.check_symptom_drug_correlation(drug_name, symptom)

    return result


# ============== Composite Endpoints ==============


@router.get(
    "/health-context",
    summary="Get complete health context",
    description="Returns combined environmental and disease data for a location.",
)
async def get_health_context(
    state: str = Query(..., description="Two-letter state code"),
    zip_code: str | None = None,
    age_months: int | None = None,
) -> dict[str, Any]:
    """
    Get comprehensive health context for a location.

    Combines:
    - Current disease activity
    - Air quality
    - Due vaccinations (if age provided)
    - Relevant alerts
    """
    from ...services.air_quality_service import AirQualityService
    from ...services.cdc_service import CDCService

    cdc_service = CDCService()
    air_service = AirQualityService()

    # Get disease activity
    activities = await cdc_service.get_disease_activity(state.upper())

    # Get outbreak alerts
    alerts = await cdc_service.get_outbreak_alerts(state.upper(), zip_code)

    # Get air quality if zip provided
    air_quality = None
    if zip_code:
        reading = await air_service.get_current_aqi(zip_code=zip_code)
        if reading:
            air_quality = {
                **reading.to_dict(),
                "guidance": air_service.get_pediatric_guidance(reading.aqi),
            }

    # Get due vaccinations if age provided
    vaccinations = None
    if age_months is not None:
        vaccines = cdc_service.get_vaccination_schedule(age_months)
        vaccinations = [v.to_dict() for v in vaccines]

    return {
        "state": state.upper(),
        "disease_activity": [a.to_dict() for a in activities],
        "alerts": alerts,
        "air_quality": air_quality,
        "due_vaccinations": vaccinations,
        "generated_at": __import__("datetime")
        .datetime.now(__import__("datetime").timezone.utc)
        .isoformat(),
    }
