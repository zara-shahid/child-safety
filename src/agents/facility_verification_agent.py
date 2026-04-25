import logging
import uuid
from typing import Any, Dict

from .base_agent import AgentConfig, AgentResponse, BaseAgent
from ..services.trust_scorer import calculate_trust_score

logger = logging.getLogger(__name__)


class FacilityVerificationAgent(BaseAgent):
    """
    Agent #9: Facility Verification Agent
    Verifies hospital facilities by calculating Trust Scores
    and identifying suspicious contradictions.
    """

    def __init__(self, config: AgentConfig | None = None, **kwargs: Any) -> None:
        config = config or AgentConfig(
            name="facility_verification_agent",
            description="Verifies hospital facilities by scoring and detecting contradictions.",
            priority=9,
            timeout_seconds=10,
        )
        super().__init__(config, **kwargs)

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Process a facility to calculate trust score and generate flags.
        """
        request_id = str(uuid.uuid4())[:12]
        
        facility = input_data.get("facility", {})
        
        # 1. Calculate Trust Score
        score_res = calculate_trust_score(facility)
        score = score_res.get("trust_score", 0)
        
        # 2. Detect suspicious contradictions
        flags = []
        capability = str(facility.get("capability", "")).lower()
        equipment = str(facility.get("equipment", "")).lower()
        
        if "icu" in capability and "ventilator" not in equipment:
            flags.append("Possible ICU equipment mismatch")
            
        try:
            # Need to handle potential None or non-numeric strings safely
            cap_val = facility.get("capacity")
            docs_val = facility.get("numberDoctors")
            
            capacity = float(cap_val) if cap_val and str(cap_val).strip() else 0.0
            docs = float(docs_val) if docs_val and str(docs_val).strip() else 0.0
            
            if capacity > 0 and docs == 0:
                flags.append("Doctors missing but capacity exists")
        except (ValueError, TypeError):
            pass
            
        # 3. Return structured output
        facility_name = facility.get("name", "Unknown Facility")
        
        response_data = {
            "facility_name": facility_name,
            "trust_score": score,
            "flags": flags,
            "latitude": facility.get("latitude"),
            "longitude": facility.get("longitude"),
            "city": facility.get("address_city")
        }
        
        return self.create_response(
            request_id=request_id,
            data=response_data,
            confidence=1.0 if score >= 80 else 0.5,
            explanation=f"Facility verification completed. Score: {score}. Flags: {len(flags)}"
        )
