import math
from typing import Any, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ...agents.facility_verification_agent import FacilityVerificationAgent
from ...services.facility_loader import FacilityLoader
from ..dependencies import get_current_active_user

router = APIRouter()


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in kilometers between two points."""
    R = 6371.0  # Earth radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


class FacilitySearchResponse(BaseModel):
    name: str
    city: str | None
    latitude: float
    longitude: float
    trust_score: int
    flags: List[str]


class FacilitiesResponse(BaseModel):
    facilities: List[FacilitySearchResponse]


@router.get("/search", response_model=FacilitiesResponse)
async def search_facilities(
    latitude: float = Query(..., description="User latitude"),
    longitude: float = Query(..., description="User longitude"),
    radius: float = Query(50.0, description="Search radius in kilometers"),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> FacilitiesResponse:
    """
    Search for verified facilities within a given radius, sorted by Trust Score.
    """
    facilities = FacilityLoader.get_facilities()

    nearby_facilities = []

    # Filter nearby using Haversine
    for f in facilities:
        f_lat = f.get("latitude")
        f_lng = f.get("longitude")
        if f_lat is not None and f_lng is not None:
            dist = haversine(latitude, longitude, f_lat, f_lng)
            if dist <= radius:
                nearby_facilities.append(f)

    agent = FacilityVerificationAgent()
    verified_results = []

    for f in nearby_facilities:
        res = await agent.process({"facility": f})
        data = res.data
        if data:
            verified_results.append(
                {
                    "name": data.get("facility_name"),
                    "city": data.get("city"),
                    "latitude": data.get("latitude") or 0.0,
                    "longitude": data.get("longitude") or 0.0,
                    "trust_score": data.get("trust_score", 0),
                    "flags": data.get("flags", []),
                }
            )

    # Sort results: Highest Trust Score first
    verified_results.sort(key=lambda x: x["trust_score"], reverse=True)

    # Return top 20 verified facilities
    return FacilitiesResponse(facilities=verified_results[:20])
