"""
EPCID Symptoms Routes

Symptom logging and tracking endpoints.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...api.dependencies import get_current_active_user
from ...api.schemas import (
    SymptomCreate,
    SymptomHistory,
    SymptomResponse,
    SymptomSeverity,
)

router = APIRouter()

# Simulated database
fake_symptoms_db: dict[str, dict[str, Any]] = {}


@router.post(
    "/",
    response_model=SymptomResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a symptom",
    description="Record a new symptom for a child.",
)
async def create_symptom(
    symptom: SymptomCreate,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> SymptomResponse:
    """
    Log a new symptom.

    - **child_id**: ID of the child
    - **symptom_type**: Type of symptom (fever, cough, etc.)
    - **severity**: mild, moderate, or severe
    - **measurements**: str | None measurements (temperature, etc.)
    - **onset_time**: When the symptom started
    - **notes**: Additional notes
    """
    symptom_id = f"sym-{uuid4().hex[:8]}"
    now = datetime.now(__import__("datetime").timezone.utc)

    symptom_data = {
        "id": symptom_id,
        "user_id": current_user["id"],
        "child_id": symptom.child_id,
        "symptom_type": symptom.symptom_type,
        "severity": symptom.severity,
        "measurements": symptom.measurements,
        "onset_time": symptom.onset_time or now,
        "notes": symptom.notes,
        "recorded_at": now,
    }

    fake_symptoms_db[symptom_id] = symptom_data

    return SymptomResponse(**symptom_data)


@router.post(
    "/batch",
    response_model=list[SymptomResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Log multiple symptoms",
    description="Record multiple symptoms at once.",
)
async def create_symptoms_batch(
    symptoms: list[SymptomCreate],
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[SymptomResponse]:
    """Log multiple symptoms in a single request."""
    results = []
    now = datetime.now(__import__("datetime").timezone.utc)

    for symptom in symptoms:
        symptom_id = f"sym-{uuid4().hex[:8]}"

        symptom_data = {
            "id": symptom_id,
            "user_id": current_user["id"],
            "child_id": symptom.child_id,
            "symptom_type": symptom.symptom_type,
            "severity": symptom.severity,
            "measurements": symptom.measurements,
            "onset_time": symptom.onset_time or now,
            "notes": symptom.notes,
            "recorded_at": now,
        }

        fake_symptoms_db[symptom_id] = symptom_data
        results.append(SymptomResponse(**symptom_data))

    return results


@router.get(
    "/",
    response_model=list[SymptomResponse],
    summary="List symptoms",
    description="Get symptoms with optional filters.",
)
async def list_symptoms(
    child_id: str | None = None,
    symptom_type: str | None = None,
    severity: SymptomSeverity | None = None,
    since: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[SymptomResponse]:
    """
    List symptoms with optional filters.

    - **child_id**: Filter by child
    - **symptom_type**: Filter by type
    - **severity**: Filter by severity
    - **since**: Only symptoms after this date
    - **limit**: Max results to return
    """
    symptoms = []

    for symptom in fake_symptoms_db.values():
        if symptom["user_id"] != current_user["id"]:
            continue

        if child_id and symptom["child_id"] != child_id:
            continue

        if symptom_type and symptom["symptom_type"] != symptom_type:
            continue

        if severity and symptom["severity"] != severity:
            continue

        if since and symptom["recorded_at"] < since:
            continue

        symptoms.append(SymptomResponse(**symptom))

    # Sort by recorded_at descending
    symptoms.sort(key=lambda x: x.recorded_at, reverse=True)

    return symptoms[:limit]


@router.get(
    "/child/{child_id}",
    response_model=SymptomHistory,
    summary="Get child symptom history",
    description="Get all symptoms for a specific child.",
)
async def get_child_symptoms(
    child_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> SymptomHistory:
    """Get symptom history for a child."""
    since = datetime.now(__import__("datetime").timezone.utc) - timedelta(days=days)

    symptoms = [
        SymptomResponse(**symptom)
        for symptom in fake_symptoms_db.values()
        if symptom["user_id"] == current_user["id"]
        and symptom["child_id"] == child_id
        and symptom["recorded_at"] >= since
    ]

    symptoms.sort(key=lambda x: x.recorded_at, reverse=True)

    date_range = {
        "start": since,
        "end": datetime.now(__import__("datetime").timezone.utc),
    }

    return SymptomHistory(
        child_id=child_id,
        symptoms=symptoms,
        total_count=len(symptoms),
        date_range=date_range,
    )


@router.get(
    "/{symptom_id}",
    response_model=SymptomResponse,
    summary="Get symptom",
    description="Get a specific symptom record.",
)
async def get_symptom(
    symptom_id: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> SymptomResponse:
    """Get a specific symptom by ID."""
    symptom = fake_symptoms_db.get(symptom_id)

    if not symptom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Symptom not found",
        )

    if symptom["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return SymptomResponse(**symptom)


@router.delete(
    "/{symptom_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete symptom",
    description="Delete a symptom record.",
)
async def delete_symptom(
    symptom_id: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> None:
    """Delete a symptom record."""
    symptom = fake_symptoms_db.get(symptom_id)

    if not symptom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Symptom not found",
        )

    if symptom["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    del fake_symptoms_db[symptom_id]

    return None


@router.get(
    "/types/common",
    response_model=list[dict],
    summary="Get common symptom types",
    description="Get a list of common pediatric symptom types.",
)
async def get_common_symptom_types() -> list[dict[str, Any]]:
    """Get common pediatric symptom types for the UI."""
    return [
        {
            "type": "fever",
            "display_name": "Fever",
            "description": "Elevated body temperature",
            "measurement_fields": ["temperature"],
            "severity_guidance": {
                "mild": "100.4-101°F (38-38.3°C)",
                "moderate": "101-103°F (38.3-39.4°C)",
                "severe": ">103°F (>39.4°C)",
            },
        },
        {
            "type": "cough",
            "display_name": "Cough",
            "description": "Coughing",
            "measurement_fields": [],
            "subtypes": ["dry", "wet", "barking", "whooping"],
        },
        {
            "type": "breathing_difficulty",
            "display_name": "Breathing Difficulty",
            "description": "Trouble breathing or rapid breathing",
            "measurement_fields": ["respiratory_rate"],
            "red_flag": True,
        },
        {
            "type": "vomiting",
            "display_name": "Vomiting",
            "description": "Throwing up",
            "measurement_fields": ["frequency"],
        },
        {
            "type": "diarrhea",
            "display_name": "Diarrhea",
            "description": "Loose or watery stools",
            "measurement_fields": ["frequency"],
        },
        {
            "type": "rash",
            "display_name": "Rash",
            "description": "Skin rash or irritation",
            "measurement_fields": ["location", "appearance"],
        },
        {
            "type": "congestion",
            "display_name": "Congestion",
            "description": "Stuffy or runny nose",
            "measurement_fields": [],
        },
        {
            "type": "ear_pain",
            "display_name": "Ear Pain",
            "description": "Pain in one or both ears",
            "measurement_fields": ["ear_side"],
        },
        {
            "type": "sore_throat",
            "display_name": "Sore Throat",
            "description": "Pain or discomfort in throat",
            "measurement_fields": [],
        },
        {
            "type": "headache",
            "display_name": "Headache",
            "description": "Head pain",
            "measurement_fields": ["location"],
        },
        {
            "type": "fatigue",
            "display_name": "Fatigue/Lethargy",
            "description": "Unusual tiredness or lack of energy",
            "measurement_fields": [],
        },
        {
            "type": "poor_feeding",
            "display_name": "Poor Feeding",
            "description": "Refusing to eat or drink",
            "measurement_fields": [],
            "age_relevance": "infant",
        },
        {
            "type": "irritability",
            "display_name": "Irritability",
            "description": "Unusual fussiness or crying",
            "measurement_fields": [],
        },
    ]
