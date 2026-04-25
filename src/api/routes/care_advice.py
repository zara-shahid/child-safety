"""
EPCID Care Advice API Routes

Provides endpoints for condition-specific care guidance,
including when to seek care and home management tips.
"""

import json
from pathlib import Path
from typing import Any, cast

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/care-advice", tags=["Care Advice"])


# ============== Schemas ==============


class CareGuide(BaseModel):
    """Care guide for a specific condition."""

    id: str
    title: str
    summary: str
    when_to_call_911: list[str]
    when_to_call_now: list[str]
    when_to_call_24_hours: list[str]
    home_care: dict[str, Any]
    age_specific: dict[str, Any] | None = None


class CareGuideListItem(BaseModel):
    """Summary item for listing care guides."""

    id: str
    title: str
    summary: str


class CareGuidesResponse(BaseModel):
    """Response with list of available care guides."""

    guides: list[CareGuideListItem]
    total: int


class EmergencySignsResponse(BaseModel):
    """Emergency warning signs response."""

    title: str
    always_call_911: list[str]
    infants_under_3_months: list[str]


# ============== Load Care Guides Data ==============


def load_care_guides() -> dict[str, Any]:
    """Load care guides from JSON file."""
    try:
        data_path = Path(__file__).parent.parent.parent / "data" / "care_guides.json"
        with open(data_path) as f:
            return cast(dict[str, Any], json.load(f))
    except FileNotFoundError:
        # Return default data if file not found
        return {
            "guides": {},
            "emergency_signs": {"always_call_911": [], "infants_under_3_months": []},
        }


# ============== Endpoints ==============


@router.get("/", response_model=CareGuidesResponse)
async def list_care_guides() -> CareGuidesResponse:
    """
    List all available care guides.

    Returns a summary of each guide including ID, title, and description.
    """
    data = load_care_guides()
    guides = data.get("guides", {})

    items = [
        CareGuideListItem(
            id=guide_id,
            title=guide.get("title", guide_id),
            summary=guide.get("summary", ""),
        )
        for guide_id, guide in guides.items()
    ]

    return CareGuidesResponse(guides=items, total=len(items))


@router.get("/emergency-signs", response_model=EmergencySignsResponse)
async def get_emergency_signs() -> EmergencySignsResponse:
    """
    Get list of emergency warning signs.

    Returns signs that always require calling 911 and
    special considerations for infants under 3 months.
    """
    data = load_care_guides()
    emergency = data.get("emergency_signs", {})

    return EmergencySignsResponse(
        title=emergency.get("title", "Emergency Warning Signs"),
        always_call_911=emergency.get("always_call_911", []),
        infants_under_3_months=emergency.get("infants_under_3_months", []),
    )


@router.get("/{condition_id}", response_model=CareGuide)
async def get_care_guide(condition_id: str) -> CareGuide:
    """
    Get detailed care guide for a specific condition.

    Args:
        condition_id: The condition identifier (e.g., 'fever', 'cough_cold')

    Returns:
        Complete care guide with when to seek care and home treatment advice.
    """
    data = load_care_guides()
    guides = data.get("guides", {})

    guide = guides.get(condition_id)
    if not guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Care guide not found for condition: {condition_id}",
        )

    return CareGuide(
        id=condition_id,
        title=guide.get("title", condition_id),
        summary=guide.get("summary", ""),
        when_to_call_911=guide.get("when_to_call_911", []),
        when_to_call_now=guide.get("when_to_call_now", []),
        when_to_call_24_hours=guide.get("when_to_call_24_hours", []),
        home_care=guide.get("home_care", {}),
        age_specific=guide.get("age_specific"),
    )


@router.get("/search/{query}")
async def search_care_guides(query: str) -> dict[str, Any]:
    """
    Search care guides by keyword.

    Args:
        query: Search term

    Returns:
        List of matching care guides.
    """
    data = load_care_guides()
    guides = data.get("guides", {})

    query_lower = query.lower()
    results = []

    for guide_id, guide in guides.items():
        # Search in title and summary
        title = guide.get("title", "").lower()
        summary = guide.get("summary", "").lower()

        if query_lower in title or query_lower in summary:
            results.append(
                CareGuideListItem(
                    id=guide_id,
                    title=guide.get("title", guide_id),
                    summary=guide.get("summary", ""),
                )
            )

    return {"query": query, "results": results, "total": len(results)}
