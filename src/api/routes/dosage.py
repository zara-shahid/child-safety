"""
EPCID Dosage Calculator API Routes

Provides weight-based medication dosing calculations for
common over-the-counter pediatric medications.
"""

import json
from pathlib import Path
from typing import Any, cast

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/dosage", tags=["Dosage Calculator"])


# ============== Schemas ==============


class MedicationInfo(BaseModel):
    """Information about a medication."""

    id: str
    name: str
    brand_names: list[str]
    uses: list[str]
    dose_per_kg: dict[str, float]
    max_daily_doses: int
    frequency: str
    age_restrictions: dict[str, str]
    warnings: list[str]
    formulations: list[dict[str, Any]]


class MedicationListItem(BaseModel):
    """Summary item for listing medications."""

    id: str
    name: str
    brand_names: list[str]
    uses: list[str]
    age_restriction: str


class MedicationsResponse(BaseModel):
    """Response with list of available medications."""

    medications: list[MedicationListItem]
    disclaimer: str


class DoseCalculationRequest(BaseModel):
    """Request for dose calculation."""

    medication_id: str
    weight_kg: float = Field(..., gt=0, le=100)
    formulation_index: int = 0


class DoseCalculationResponse(BaseModel):
    """Response with calculated dose."""

    medication: str
    weight_kg: float
    formulation: str

    min_dose_mg: float
    max_dose_mg: float
    recommended_dose_mg: float

    liquid_amount_ml: float | None = None
    tablet_count: float | None = None

    frequency: str
    max_daily_doses: int
    warnings: list[str]

    disclaimer: str


# ============== Load Dosage Data ==============


def load_dosage_data() -> dict[str, Any]:
    """Load dosage data from JSON file."""
    try:
        data_path = Path(__file__).parent.parent.parent / "data" / "dosage_tables.json"
        with open(data_path) as f:
            return cast(dict[str, Any], json.load(f))
    except FileNotFoundError:
        return {"medications": {}, "disclaimer": "Always consult your healthcare provider."}


# ============== Endpoints ==============


@router.get("/medications", response_model=MedicationsResponse)
async def list_medications() -> MedicationsResponse:
    """
    List all available medications with dosing information.

    Returns medication names, uses, and age restrictions.
    """
    data = load_dosage_data()
    meds = data.get("medications", {})

    items = []
    for med_id, med in meds.items():
        age_restrictions = med.get("age_restrictions", {})
        restriction = age_restrictions.get(
            "under_6_months", age_restrictions.get("under_2_years", "Check with doctor")
        )

        items.append(
            MedicationListItem(
                id=med_id,
                name=med.get("brand_names", [med_id])[0] if med.get("brand_names") else med_id,
                brand_names=med.get("brand_names", []),
                uses=med.get("uses", []),
                age_restriction=restriction,
            )
        )

    return MedicationsResponse(
        medications=items,
        disclaimer=data.get("disclaimer", "Always consult your healthcare provider."),
    )


@router.get("/medications/{medication_id}", response_model=MedicationInfo)
async def get_medication_info(medication_id: str) -> MedicationInfo:
    """
    Get detailed information about a specific medication.

    Args:
        medication_id: The medication identifier (e.g., 'acetaminophen', 'ibuprofen')

    Returns:
        Complete medication information including formulations and warnings.
    """
    data = load_dosage_data()
    meds = data.get("medications", {})

    med = meds.get(medication_id)
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Medication not found: {medication_id}"
        )

    dose_per_kg = med.get("dose_per_kg", "")
    if isinstance(dose_per_kg, str):
        # Parse "10-15 mg/kg per dose" format
        parts = dose_per_kg.replace(" mg/kg per dose", "").split("-")
        dose_per_kg = {"min": float(parts[0]), "max": float(parts[-1])}

    return MedicationInfo(
        id=medication_id,
        name=(
            med.get("brand_names", [medication_id])[0] if med.get("brand_names") else medication_id
        ),
        brand_names=med.get("brand_names", []),
        uses=med.get("uses", []),
        dose_per_kg=dose_per_kg,
        max_daily_doses=med.get("max_daily_doses", 4),
        frequency=med.get("frequency", "As directed"),
        age_restrictions=med.get("age_restrictions", {}),
        warnings=med.get("warnings", []),
        formulations=med.get("formulations", []),
    )


@router.post("/calculate", response_model=DoseCalculationResponse)
async def calculate_dose(request: DoseCalculationRequest) -> DoseCalculationResponse:
    """
    Calculate medication dose based on weight.

    Args:
        request: Medication ID, weight in kg, and formulation selection

    Returns:
        Calculated dose with liquid/tablet amounts and warnings.
    """
    data = load_dosage_data()
    meds = data.get("medications", {})

    med = meds.get(request.medication_id)
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medication not found: {request.medication_id}",
        )

    # Parse dose per kg
    dose_per_kg = med.get("dose_per_kg", "10-15 mg/kg per dose")
    if isinstance(dose_per_kg, str):
        parts = dose_per_kg.replace(" mg/kg per dose", "").split("-")
        min_dose_per_kg = float(parts[0])
        max_dose_per_kg = float(parts[-1])
    else:
        min_dose_per_kg = dose_per_kg.get("min", 10)
        max_dose_per_kg = dose_per_kg.get("max", 15)

    # Calculate doses
    min_dose_mg = round(request.weight_kg * min_dose_per_kg, 1)
    max_dose_mg = round(request.weight_kg * max_dose_per_kg, 1)
    recommended_mg = round((min_dose_mg + max_dose_mg) / 2, 1)

    # Get formulation
    formulations = med.get("formulations", {})
    form_keys = list(formulations.keys())

    if request.formulation_index >= len(form_keys):
        form_key = form_keys[0] if form_keys else "default"
    else:
        form_key = form_keys[request.formulation_index]

    formulation = formulations.get(form_key, {})
    concentration = formulation.get("concentration", "160 mg/5 mL")

    # Parse concentration
    liquid_amount_ml = None
    tablet_count = None

    if "/mL" in concentration or "/5" in concentration:
        # Liquid formulation
        parts = concentration.replace(" ", "").split("/")
        mg_part = float(parts[0].replace("mg", ""))
        ml_part = float(parts[1].replace("mL", ""))

        liquid_amount_ml = round((recommended_mg / mg_part) * ml_part, 1)
    elif "per tablet" in concentration or "mg" in concentration:
        # Tablet formulation
        mg_per_tablet = float(concentration.split(" ")[0].replace("mg", ""))
        tablet_count = round(recommended_mg / mg_per_tablet, 1)

    return DoseCalculationResponse(
        medication=med.get("brand_names", [request.medication_id])[0],
        weight_kg=request.weight_kg,
        formulation=form_key.replace("_", " ").title(),
        min_dose_mg=min_dose_mg,
        max_dose_mg=max_dose_mg,
        recommended_dose_mg=recommended_mg,
        liquid_amount_ml=liquid_amount_ml,
        tablet_count=tablet_count,
        frequency=med.get("frequency", "As directed"),
        max_daily_doses=med.get("max_daily_doses", 4),
        warnings=med.get("warnings", []),
        disclaimer=data.get("disclaimer", "Always consult your healthcare provider."),
    )


@router.get("/weight-conversion")
async def convert_weight(
    value: float = Query(..., description="Weight value to convert"),
    from_unit: str = Query(..., pattern="^(lbs|kg)$", description="Source unit"),
) -> dict[str, Any]:
    """
    Convert weight between pounds and kilograms.

    Args:
        value: Weight value
        from_unit: Source unit ('lbs' or 'kg')

    Returns:
        Converted weight value.
    """
    if from_unit == "lbs":
        return {
            "from": {"value": value, "unit": "lbs"},
            "to": {"value": round(value / 2.2, 2), "unit": "kg"},
        }
    else:
        return {
            "from": {"value": value, "unit": "kg"},
            "to": {"value": round(value * 2.2, 2), "unit": "lbs"},
        }
