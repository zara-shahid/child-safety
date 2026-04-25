"""
EPCID Agent Tests

Tests for the EPCID agent system including:
- IngestionAgent
- PhenotypeAgent
- RiskAgent
- GuidelineRAGAgent
- MedicationSafetyAgent
- GeoExposureAgent
- EscalationAgent
"""

import pytest

from src.agents.base_agent import AgentStatus
from src.agents.escalation_agent import EscalationAgent
from src.agents.guideline_rag_agent import GuidelineRAGAgent
from src.agents.ingestion_agent import IngestionAgent
from src.agents.phenotype_agent import PhenotypeAgent
from src.agents.risk_agent import RiskAgent
from src.core.memory import Memory


@pytest.fixture
def memory():
    """Create a fresh memory instance for each test."""
    return Memory()


@pytest.fixture
def sample_input():
    """Sample input data for testing."""
    return {
        "child_id": "test-child-001",
        "demographics": {
            "age_months": 24,
            "weight_kg": 12,
            "sex": "female",
        },
        "symptoms": ["fever", "cough", "runny_nose"],
        "vitals": {
            "temperature": 38.5,
            "heart_rate": 110,
            "respiratory_rate": 28,
        },
        "symptom_duration": "24 hours",
    }


@pytest.fixture
def critical_input():
    """Critical case input for testing safety rules."""
    return {
        "child_id": "test-child-critical",
        "demographics": {
            "age_months": 2,  # Infant
        },
        "symptoms": ["fever", "difficulty_breathing"],
        "vitals": {
            "temperature": 38.1,  # Infant with fever = critical
        },
    }


# =====================
# Ingestion Agent Tests
# =====================


class TestIngestionAgent:
    """Tests for IngestionAgent."""

    @pytest.mark.asyncio
    async def test_basic_ingestion(self, memory, sample_input):
        """Test basic data ingestion."""
        agent = IngestionAgent(memory=memory)
        response = await agent.run(sample_input)

        assert response.success
        assert response.status == AgentStatus.COMPLETED
        assert "normalized" in response.data

    @pytest.mark.asyncio
    async def test_symptom_normalization(self, memory):
        """Test symptom normalization."""
        agent = IngestionAgent(memory=memory)

        input_data = {
            "symptoms": ["Fever", "COUGH", "runny nose"],
        }

        response = await agent.run(input_data)

        assert response.success
        normalized = response.data["normalized"]["symptoms"]
        assert "fever" in normalized
        assert "cough" in normalized

    @pytest.mark.asyncio
    async def test_temperature_conversion(self, memory):
        """Test temperature unit conversion."""
        agent = IngestionAgent(memory=memory)

        input_data = {
            "vitals": {
                "temperature": 101.3,
                "temperature_unit": "fahrenheit",
            },
        }

        response = await agent.run(input_data)

        assert response.success
        temp = response.data["normalized"]["vitals"]["temperature"]
        assert 38.0 < temp < 39.0  # Should be converted to Celsius

    @pytest.mark.asyncio
    async def test_quality_score(self, memory, sample_input):
        """Test data quality scoring."""
        agent = IngestionAgent(memory=memory)
        response = await agent.run(sample_input)

        assert response.success
        quality_score = response.data["quality_score"]
        assert 0 < quality_score <= 1.0


# =====================
# Phenotype Agent Tests
# =====================


class TestPhenotypeAgent:
    """Tests for PhenotypeAgent."""

    @pytest.mark.asyncio
    async def test_fever_phenotype(self, memory):
        """Test fever phenotype derivation."""
        agent = PhenotypeAgent(memory=memory)

        input_data = {
            "normalized": {
                "vitals": {"temperature": 39.5},
                "symptoms": ["fever", "chills"],
            },
        }

        response = await agent.run(input_data)

        assert response.success
        phenotypes = response.data["phenotypes"]

        fever_phenotype = next((p for p in phenotypes if p["name"] == "fever"), None)
        assert fever_phenotype is not None
        assert fever_phenotype["severity"] in ["moderate", "severe"]

    @pytest.mark.asyncio
    async def test_respiratory_phenotype(self, memory):
        """Test respiratory effort phenotype."""
        agent = PhenotypeAgent(memory=memory)

        input_data = {
            "normalized": {
                "vitals": {"respiratory_rate": 45},
                "symptoms": ["wheezing", "difficulty_breathing"],
            },
        }

        response = await agent.run(input_data)

        assert response.success
        phenotypes = response.data["phenotypes"]

        resp_phenotype = next((p for p in phenotypes if p["name"] == "respiratory_effort"), None)
        assert resp_phenotype is not None

    @pytest.mark.asyncio
    async def test_symptom_burden(self, memory):
        """Test symptom burden calculation."""
        agent = PhenotypeAgent(memory=memory)

        input_data = {
            "normalized": {
                "symptoms": ["fever", "cough", "vomiting", "diarrhea", "headache"],
                "vitals": {},
            },
        }

        response = await agent.run(input_data)

        assert response.success
        phenotypes = response.data["phenotypes"]

        burden = next((p for p in phenotypes if p["name"] == "symptom_burden"), None)
        assert burden is not None
        assert burden["value"] > 0


# =====================
# Risk Agent Tests
# =====================


class TestRiskAgent:
    """Tests for RiskAgent."""

    @pytest.mark.asyncio
    async def test_low_risk_assessment(self, memory):
        """Test low risk assessment."""
        agent = RiskAgent(memory=memory)

        input_data = {
            "normalized": {
                "demographics": {"age_months": 48},
                "symptoms": ["runny_nose"],
                "vitals": {"temperature": 37.0},
            },
            "phenotypes": [],
        }

        response = await agent.run(input_data)

        assert response.success
        assert response.data["risk_tier"] == "LOW"

    @pytest.mark.asyncio
    async def test_safety_rule_override(self, memory, critical_input):
        """Test safety rule triggers critical tier."""
        agent = RiskAgent(memory=memory)

        # Infant with fever should trigger safety rule
        input_data = {
            "normalized": {
                "demographics": {"age_months": 2},
                "symptoms": ["fever"],
                "vitals": {"temperature": 38.1},
            },
            "phenotypes": [],
        }

        response = await agent.run(input_data)

        assert response.success
        assert response.data["risk_tier"] == "CRITICAL"
        assert len(response.data["triggered_rules"]) > 0

    @pytest.mark.asyncio
    async def test_confidence_calculation(self, memory, sample_input):
        """Test confidence is calculated."""
        agent = RiskAgent(memory=memory)

        input_data = {
            "normalized": sample_input,
            "phenotypes": [],
        }

        response = await agent.run(input_data)

        assert response.success
        assert 0 < response.data["confidence"] <= 1.0
        assert "confidence_interval" in response.data


# =====================
# Guideline RAG Tests
# =====================


class TestGuidelineRAGAgent:
    """Tests for GuidelineRAGAgent."""

    @pytest.mark.asyncio
    async def test_guideline_retrieval(self, memory):
        """Test guideline retrieval for symptoms."""
        agent = GuidelineRAGAgent(memory=memory)

        input_data = {
            "symptoms": ["fever"],
            "demographics": {"age_months": 24},
            "risk_tier": "MODERATE",
        }

        response = await agent.run(input_data)

        assert response.success
        assert response.data["result_count"] >= 0

    @pytest.mark.asyncio
    async def test_escalation_language(self, memory):
        """Test escalation language for high risk."""
        agent = GuidelineRAGAgent(memory=memory)

        input_data = {
            "symptoms": ["fever", "difficulty_breathing"],
            "risk_tier": "HIGH",
        }

        response = await agent.run(input_data)

        assert response.success
        assert response.data["escalation_message"] is not None


# =====================
# Escalation Agent Tests
# =====================


class TestEscalationAgent:
    """Tests for EscalationAgent."""

    @pytest.mark.asyncio
    async def test_critical_escalation(self, memory):
        """Test critical escalation path."""
        agent = EscalationAgent(memory=memory)

        input_data = {
            "risk_tier": "CRITICAL",
            "symptoms": ["seizure"],
        }

        response = await agent.run(input_data)

        assert response.success
        assert response.data["escalation_type"] == "emergency_911"
        assert response.data["urgency"] == "immediate"
        assert "911" in response.data["primary_action"]

    @pytest.mark.asyncio
    async def test_visit_packet_generation(self, memory, sample_input):
        """Test visit preparation packet generation."""
        agent = EscalationAgent(memory=memory)

        input_data = {
            "risk_tier": "MODERATE",
            "symptoms": sample_input["symptoms"],
            "vitals": sample_input["vitals"],
        }

        response = await agent.run(input_data)

        assert response.success
        assert "visit_packet" in response.data
        assert "questions_for_provider" in response.data["visit_packet"]

    @pytest.mark.asyncio
    async def test_reminder_generation(self, memory):
        """Test reminder generation."""
        agent = EscalationAgent(memory=memory)

        input_data = {
            "risk_tier": "MODERATE",
            "symptoms": ["fever"],
        }

        response = await agent.run(input_data)

        assert response.success
        reminders = response.data["reminders"]
        assert len(reminders) > 0


# =====================
# Integration Tests
# =====================


class TestAgentIntegration:
    """Integration tests for agent pipeline."""

    @pytest.mark.asyncio
    async def test_full_pipeline(self, memory, sample_input):
        """Test complete agent pipeline."""
        # Stage 1: Ingestion
        ingestion = IngestionAgent(memory=memory)
        ing_response = await ingestion.run(sample_input)
        assert ing_response.success

        normalized = ing_response.data["normalized"]

        # Stage 2: Phenotypes
        phenotype = PhenotypeAgent(memory=memory)
        phen_response = await phenotype.run({"normalized": normalized})
        assert phen_response.success

        phenotypes = phen_response.data["phenotypes"]

        # Stage 3: Risk
        risk = RiskAgent(memory=memory)
        risk_response = await risk.run(
            {
                "normalized": normalized,
                "phenotypes": phenotypes,
            }
        )
        assert risk_response.success

        risk_tier = risk_response.data["risk_tier"]

        # Stage 4: Escalation
        escalation = EscalationAgent(memory=memory)
        esc_response = await escalation.run(
            {
                "risk_tier": risk_tier,
                "symptoms": normalized.get("symptoms", []),
            }
        )
        assert esc_response.success

    @pytest.mark.asyncio
    async def test_agent_memory_sharing(self, memory, sample_input):
        """Test that agents share memory correctly."""
        ingestion = IngestionAgent(memory=memory)
        PhenotypeAgent(memory=memory)

        # Run ingestion
        await ingestion.run(sample_input)

        # Check memory has stored something
        recent = memory.short_term.get_recent(5)
        assert len(recent) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
