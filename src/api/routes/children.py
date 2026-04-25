"""
EPCID Children Routes

Child profile management endpoints.
"""

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...api.dependencies import get_current_active_user
from ...api.schemas import (
    ChildCreate,
    ChildResponse,
    ChildUpdate,
)

router = APIRouter()

# Simulated database
fake_children_db: dict[str, dict[str, Any]] = {}


def calculate_age_months(dob: datetime) -> int:
    """Calculate age in months from date of birth."""
    today = datetime.now()
    months = (today.year - dob.year) * 12 + (today.month - dob.month)
    return max(0, months)


@router.post(
    "/",
    response_model=ChildResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a child",
    description="Add a new child profile to your account.",
)
async def create_child(
    child: ChildCreate,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ChildResponse:
    """
    Create a new child profile.

    - **name**: Child's name
    - **date_of_birth**: Date of birth
    - **gender**: Male, female, or other
    - **medical_conditions**: List of existing conditions
    - **allergies**: Known allergies
    - **medications**: Current medications
    """
    child_id = f"child-{uuid4().hex[:8]}"
    now = datetime.now(__import__("datetime").timezone.utc)

    child_data = {
        "id": child_id,
        "user_id": current_user["id"],
        "name": child.name,
        "date_of_birth": child.date_of_birth,
        "gender": child.gender,
        "age_months": calculate_age_months(child.date_of_birth),
        "medical_conditions": child.medical_conditions,
        "allergies": child.allergies,
        "medications": child.medications,
        "created_at": now,
        "updated_at": now,
    }

    fake_children_db[child_id] = child_data

    return ChildResponse(**child_data)


@router.get(
    "/",
    response_model=list[ChildResponse],
    summary="List children",
    description="Get all children associated with your account.",
)
async def list_children(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[ChildResponse]:
    """Get all children for the current user."""
    user_children = [
        ChildResponse(**child)
        for child in fake_children_db.values()
        if child["user_id"] == current_user["id"]
    ]

    # Update ages
    for child in user_children:
        child.age_months = calculate_age_months(child.date_of_birth)

    return user_children


@router.get(
    "/{child_id}",
    response_model=ChildResponse,
    summary="Get child",
    description="Get a specific child's profile.",
)
async def get_child(
    child_id: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ChildResponse:
    """Get a specific child by ID."""
    child = fake_children_db.get(child_id)

    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child not found",
        )

    if child["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Update age
    child["age_months"] = calculate_age_months(child["date_of_birth"])

    return ChildResponse(**child)


@router.patch(
    "/{child_id}",
    response_model=ChildResponse,
    summary="Update child",
    description="Update a child's profile information.",
)
async def update_child(
    child_id: str,
    update: ChildUpdate,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ChildResponse:
    """Update a child's profile."""
    child = fake_children_db.get(child_id)

    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child not found",
        )

    if child["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Update fields
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        child[key] = value

    child["updated_at"] = datetime.now(__import__("datetime").timezone.utc)
    child["age_months"] = calculate_age_months(child["date_of_birth"])

    fake_children_db[child_id] = child

    return ChildResponse(**child)


@router.delete(
    "/{child_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete child",
    description="Remove a child profile from your account.",
)
async def delete_child(
    child_id: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> None:
    """Delete a child profile."""
    child = fake_children_db.get(child_id)

    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child not found",
        )

    if child["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    del fake_children_db[child_id]

    return None


@router.post(
    "/{child_id}/conditions",
    response_model=ChildResponse,
    summary="Add medical condition",
    description="Add a medical condition to the child's profile.",
)
async def add_condition(
    child_id: str,
    condition: str = Query(..., min_length=1),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ChildResponse:
    """Add a medical condition."""
    child = fake_children_db.get(child_id)

    if not child or child["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Child not found")

    if condition not in child["medical_conditions"]:
        child["medical_conditions"].append(condition)
        child["updated_at"] = datetime.now(__import__("datetime").timezone.utc)

    child["age_months"] = calculate_age_months(child["date_of_birth"])
    return ChildResponse(**child)


@router.delete(
    "/{child_id}/conditions/{condition}",
    response_model=ChildResponse,
    summary="Remove medical condition",
)
async def remove_condition(
    child_id: str,
    condition: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ChildResponse:
    """Remove a medical condition."""
    child = fake_children_db.get(child_id)

    if not child or child["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Child not found")

    if condition in child["medical_conditions"]:
        child["medical_conditions"].remove(condition)
        child["updated_at"] = datetime.now(__import__("datetime").timezone.utc)

    child["age_months"] = calculate_age_months(child["date_of_birth"])
    return ChildResponse(**child)


@router.post(
    "/{child_id}/allergies",
    response_model=ChildResponse,
    summary="Add allergy",
)
async def add_allergy(
    child_id: str,
    allergy: str = Query(..., min_length=1),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ChildResponse:
    """Add an allergy."""
    child = fake_children_db.get(child_id)

    if not child or child["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Child not found")

    if allergy not in child["allergies"]:
        child["allergies"].append(allergy)
        child["updated_at"] = datetime.now(__import__("datetime").timezone.utc)

    child["age_months"] = calculate_age_months(child["date_of_birth"])
    return ChildResponse(**child)


@router.post(
    "/{child_id}/medications",
    response_model=ChildResponse,
    summary="Add medication",
)
async def add_medication(
    child_id: str,
    medication: str = Query(..., min_length=1),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ChildResponse:
    """Add a medication."""
    child = fake_children_db.get(child_id)

    if not child or child["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Child not found")

    if medication not in child["medications"]:
        child["medications"].append(medication)
        child["updated_at"] = datetime.now(__import__("datetime").timezone.utc)

    child["age_months"] = calculate_age_months(child["date_of_birth"])
    return ChildResponse(**child)
