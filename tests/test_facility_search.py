import pytest

from src.agents.facility_verification_agent import FacilityVerificationAgent
from src.api.routes.facilities import haversine
from src.services.facility_loader import FacilityLoader
from src.services.trust_scorer import calculate_trust_score


@pytest.fixture(autouse=True)
def init_loader():
    FacilityLoader.load_data()


def test_dataset_loads_correctly():
    facilities = FacilityLoader.get_facilities()
    assert isinstance(facilities, list)
    # It should load successfully without crashing, even if list is empty when no dataset is present


def test_trust_score_calculation():
    # Bad facility: 100 points penalty
    facility = {
        "numberDoctors": 0,
        "capacity": None,
        "equipment": "",
        "capability": "",
        "officialWebsite": "",
        "latitude": None,
        "longitude": None,
        "distinct_social_media_presence_count": 0,
    }
    score = calculate_trust_score(facility)["trust_score"]
    assert score == 0

    # Good facility: 0 points penalty
    facility2 = {
        "numberDoctors": 10,
        "capacity": 50,
        "equipment": "X-Ray",
        "capability": "Emergency",
        "officialWebsite": "http://example.com",
        "latitude": 30.0,
        "longitude": 70.0,
        "distinct_social_media_presence_count": 2,
    }
    score2 = calculate_trust_score(facility2)["trust_score"]
    assert score2 == 100


@pytest.mark.asyncio
async def test_facility_verification_agent_flags():
    agent = FacilityVerificationAgent()
    facility = {
        "name": "Test Hospital",
        "capacity": 50,
        "numberDoctors": 0,
        "capability": "ICU, Emergency",
        "equipment": "X-Ray",
        "latitude": 30.0,
        "longitude": 70.0,
    }

    res = await agent.process({"facility": facility})
    data = res.data

    assert data["facility_name"] == "Test Hospital"
    flags = data["flags"]
    assert "Possible ICU equipment mismatch" in flags
    assert "Doctors missing but capacity exists" in flags


def test_haversine():
    dist = haversine(31.4398, 73.0694, 31.4285, 73.0782)
    # Distance between these two points in Faisalabad should be around 1.5km
    assert 1.0 < dist < 2.0
