"""
EPCID API Tests

Comprehensive test suite for all API endpoints.
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Import the app
from src.api.main import app

pytestmark = pytest.mark.integration


# Test client fixtures
@pytest.fixture
def client():
    """Synchronous test client."""
    return TestClient(app)


@pytest.fixture
async def async_client():
    """Async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    """Get authentication headers for protected endpoints."""
    # Register a test user
    register_data = {
        "email": f"test_{datetime.now().timestamp()}@test.com",
        "password": "testpassword123",
        "full_name": "Test User",
    }

    response = client.post("/api/v1/auth/register", json=register_data)
    print(f"\nREGISTER RESPONSE: {response.status_code} {response.text}")

    if response.status_code == 201:
        token = response.json()["access_token"]
    else:
        # User might exist, try login
        login_data = {
            "email": "demo@epcid.health",
            "password": "secret",
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        print(f"\nLOGIN RESPONSE: {response.status_code} {response.text}")
        token = response.json().get("access_token", "test-token")

    return {"Authorization": f"Bearer {token}"}


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_health_check(self, client: TestClient):
        """Test basic health check."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "epcid-api"

    def test_readiness_check(self, client: TestClient):
        """Test readiness check."""
        response = client.get("/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "checks" in data

    def test_liveness_check(self, client: TestClient):
        """Test liveness check."""
        response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json()["status"] == "alive"


class TestAuthEndpoints:
    """Test authentication endpoints."""

    def test_register_user(self, client: TestClient):
        """Test user registration."""
        data = {
            "email": f"newuser_{datetime.now().timestamp()}@test.com",
            "password": "securepassword123",
            "full_name": "New User",
        }

        response = client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 201

        result = response.json()
        assert "access_token" in result
        assert "refresh_token" in result
        assert result["token_type"] == "bearer"
        assert result["user"]["email"] == data["email"]

    def test_register_duplicate_email(self, client: TestClient):
        """Test registration with duplicate email."""
        data = {
            "email": "duplicate@test.com",
            "password": "password123",
            "full_name": "Test User",
        }

        # First registration
        client.post("/api/v1/auth/register", json=data)

        # Second registration should fail
        response = client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 400

    def test_register_invalid_password(self, client: TestClient):
        """Test registration with short password."""
        data = {
            "email": "short@test.com",
            "password": "short",
            "full_name": "Test User",
        }

        response = client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 422  # Validation error

    def test_login_success(self, client: TestClient):
        """Test successful login."""
        # Register first
        email = f"login_{datetime.now().timestamp()}@test.com"
        register_data = {
            "email": email,
            "password": "testpassword123",
            "full_name": "Login Test",
        }
        client.post("/api/v1/auth/register", json=register_data)

        # Then login
        login_data = {
            "email": email,
            "password": "testpassword123",
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        print(f"\nLOGIN RESPONSE: {response.status_code} {response.text}")

        assert response.status_code == 200
        result = response.json()
        assert "access_token" in result

    def test_login_wrong_password(self, client: TestClient):
        """Test login with wrong password."""
        data = {
            "email": "demo@epcid.health",
            "password": "wrongpassword",
        }

        response = client.post("/api/v1/auth/login", json=data)
        assert response.status_code == 401

    def test_get_current_user(self, client: TestClient, auth_headers: dict):
        """Test getting current user profile."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert "email" in data
        assert "full_name" in data

    def test_unauthorized_access(self, client: TestClient):
        """Test accessing protected endpoint without auth."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401


class TestChildrenEndpoints:
    """Test child management endpoints."""

    def test_create_child(self, client: TestClient, auth_headers: dict):
        """Test creating a child profile."""
        data = {
            "name": "Test Child",
            "date_of_birth": (datetime.now() - timedelta(days=365 * 2)).isoformat(),
            "gender": "male",
            "medical_conditions": ["asthma"],
            "allergies": ["peanuts"],
            "medications": [],
        }

        response = client.post("/api/v1/children/", json=data, headers=auth_headers)
        assert response.status_code == 201

        result = response.json()
        assert result["name"] == data["name"]
        assert "id" in result
        assert result["age_months"] > 0

    def test_list_children(self, client: TestClient, auth_headers: dict):
        """Test listing children."""
        response = client.get("/api/v1/children/", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_child(self, client: TestClient, auth_headers: dict):
        """Test getting a specific child."""
        # Create child first
        create_data = {
            "name": "Get Test Child",
            "date_of_birth": (datetime.now() - timedelta(days=365)).isoformat(),
            "gender": "female",
        }
        create_response = client.post("/api/v1/children/", json=create_data, headers=auth_headers)
        child_id = create_response.json()["id"]

        # Get the child
        response = client.get(f"/api/v1/children/{child_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Get Test Child"

    def test_update_child(self, client: TestClient, auth_headers: dict):
        """Test updating a child profile."""
        # Create child first
        create_data = {
            "name": "Update Test",
            "date_of_birth": (datetime.now() - timedelta(days=180)).isoformat(),
            "gender": "male",
        }
        create_response = client.post("/api/v1/children/", json=create_data, headers=auth_headers)
        child_id = create_response.json()["id"]

        # Update
        update_data = {"name": "Updated Name"}
        response = client.patch(
            f"/api/v1/children/{child_id}", json=update_data, headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_delete_child(self, client: TestClient, auth_headers: dict):
        """Test deleting a child profile."""
        # Create child first
        create_data = {
            "name": "Delete Test",
            "date_of_birth": (datetime.now() - timedelta(days=90)).isoformat(),
            "gender": "female",
        }
        create_response = client.post("/api/v1/children/", json=create_data, headers=auth_headers)
        child_id = create_response.json()["id"]

        # Delete
        response = client.delete(f"/api/v1/children/{child_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify deleted
        get_response = client.get(f"/api/v1/children/{child_id}", headers=auth_headers)
        assert get_response.status_code == 404


class TestSymptomsEndpoints:
    """Test symptom logging endpoints."""

    def test_log_symptom(self, client: TestClient, auth_headers: dict):
        """Test logging a symptom."""
        # Create child first
        child_data = {
            "name": "Symptom Test Child",
            "date_of_birth": (datetime.now() - timedelta(days=365 * 3)).isoformat(),
            "gender": "male",
        }
        child_response = client.post("/api/v1/children/", json=child_data, headers=auth_headers)
        child_id = child_response.json()["id"]

        # Log symptom
        symptom_data = {
            "child_id": child_id,
            "symptom_type": "fever",
            "severity": "moderate",
            "measurements": {"temperature": 101.5, "unit": "fahrenheit"},
            "notes": "Started this morning",
        }

        response = client.post("/api/v1/symptoms/", json=symptom_data, headers=auth_headers)
        assert response.status_code == 201

        result = response.json()
        assert result["symptom_type"] == "fever"
        assert result["severity"] == "moderate"

    def test_list_symptoms(self, client: TestClient, auth_headers: dict):
        """Test listing symptoms."""
        response = client.get("/api/v1/symptoms/", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_common_symptom_types(self, client: TestClient):
        """Test getting common symptom types."""
        response = client.get("/api/v1/symptoms/types/common")
        assert response.status_code == 200

        types = response.json()
        assert isinstance(types, list)
        assert len(types) > 0
        assert any(t["type"] == "fever" for t in types)


class TestAssessmentEndpoints:
    """Test risk assessment endpoints."""

    def test_create_assessment(self, client: TestClient, auth_headers: dict):
        """Test creating a risk assessment."""
        # Create child first
        child_data = {
            "name": "Assessment Test Child",
            "date_of_birth": (datetime.now() - timedelta(days=365 * 2)).isoformat(),
            "gender": "female",
        }
        child_response = client.post("/api/v1/children/", json=child_data, headers=auth_headers)
        child_id = child_response.json()["id"]

        # Create assessment
        assessment_data = {
            "child_id": child_id,
            "symptoms": [
                {
                    "child_id": child_id,
                    "symptom_type": "fever",
                    "severity": "moderate",
                    "measurements": {"temperature": 101.5},
                },
                {
                    "child_id": child_id,
                    "symptom_type": "cough",
                    "severity": "mild",
                },
            ],
            "include_guidelines": True,
            "include_environmental": False,
        }

        response = client.post("/api/v1/assessment/", json=assessment_data, headers=auth_headers)
        assert response.status_code == 200

        result = response.json()
        assert "risk_level" in result
        assert "risk_score" in result
        assert "primary_recommendation" in result
        assert "disclaimers" in result

    def test_list_assessments(self, client: TestClient, auth_headers: dict):
        """Test listing assessments."""
        response = client.get("/api/v1/assessment/", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestGuidelinesEndpoints:
    """Test clinical guidelines endpoints."""

    def test_search_guidelines(self, client: TestClient):
        """Test searching guidelines."""
        data = {
            "query": "fever in children",
            "max_results": 5,
        }

        response = client.post("/api/v1/guidelines/search", json=data)
        assert response.status_code == 200

        result = response.json()
        assert "results" in result
        assert isinstance(result["results"], list)

    def test_get_fever_guidelines(self, client: TestClient):
        """Test getting fever-specific guidelines."""
        response = client.get("/api/v1/guidelines/fever")
        assert response.status_code == 200

        result = response.json()
        assert "title" in result
        assert "content" in result
        assert "warning_signs" in result

    def test_get_emergency_signs(self, client: TestClient):
        """Test getting emergency warning signs."""
        response = client.get("/api/v1/guidelines/emergency-signs")
        assert response.status_code == 200

        signs = response.json()
        assert isinstance(signs, list)
        assert len(signs) > 0


class TestEnvironmentEndpoints:
    """Test environmental data endpoints."""

    def test_get_air_quality(self, client: TestClient):
        """Test getting air quality data."""
        response = client.get("/api/v1/environment/air-quality?latitude=40.7128&longitude=-74.0060")
        assert response.status_code == 200

        result = response.json()
        assert "aqi" in result
        assert "category" in result
        assert "recommendation" in result

    def test_get_weather(self, client: TestClient):
        """Test getting weather data."""
        response = client.get("/api/v1/environment/weather?latitude=40.7128&longitude=-74.0060")
        assert response.status_code == 200

        result = response.json()
        assert "temperature" in result
        assert "conditions" in result
        assert "pediatric_considerations" in result

    def test_get_full_environment(self, client: TestClient):
        """Test getting combined environmental data."""
        data = {
            "latitude": 40.7128,
            "longitude": -74.0060,
        }

        response = client.post("/api/v1/environment/", json=data)
        assert response.status_code == 200

        result = response.json()
        assert "air_quality" in result
        assert "weather" in result
        assert "recommendations" in result


class TestOpenAPI:
    """Test OpenAPI documentation."""

    def test_openapi_schema(self, client: TestClient):
        """Test that OpenAPI schema is valid."""
        response = client.get("/openapi.json")
        assert response.status_code == 200

        schema = response.json()
        assert "openapi" in schema
        assert "info" in schema
        assert "paths" in schema

    def test_docs_endpoint(self, client: TestClient):
        """Test docs endpoint is accessible."""
        response = client.get("/docs")
        assert response.status_code == 200

    def test_redoc_endpoint(self, client: TestClient):
        """Test ReDoc endpoint is accessible."""
        response = client.get("/redoc")
        assert response.status_code == 200


class TestErrorHandling:
    """Test error handling."""

    def test_404_not_found(self, client: TestClient):
        """Test 404 response."""
        response = client.get("/api/v1/nonexistent")
        assert response.status_code == 404

    def test_422_validation_error(self, client: TestClient, auth_headers: dict):
        """Test validation error response."""
        # Invalid child data (missing required fields)
        response = client.post("/api/v1/children/", json={}, headers=auth_headers)
        assert response.status_code == 422


# Pytest configuration
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
