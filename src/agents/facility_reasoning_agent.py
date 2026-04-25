import logging
import uuid
from typing import Any, Dict, List

from .base_agent import AgentConfig, AgentResponse, BaseAgent
from ..services.facility_loader import FacilityLoader
from ..services.unstructured_extractor import parse_unstructured_facility_data
from ..services.reasoning_engine import calculate_distance, parse_user_intent, evaluate_capability_match
from ..services.trust_scorer import calculate_trust_score

logger = logging.getLogger(__name__)

class FacilityReasoningAgent(BaseAgent):
    """
    Facility Reasoning Agent
    Combines unstructured extraction, reasoning engine, and trust scoring.
    """

    def __init__(self, config: AgentConfig | None = None, **kwargs: Any) -> None:
        config = config or AgentConfig(
            name="facility_reasoning_agent",
            description="Evaluates hospitals using extraction, multi-attribute reasoning, and trust scoring.",
            priority=10,
            timeout_seconds=30,
        )
        super().__init__(config, **kwargs)

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        request_id = str(uuid.uuid4())[:12]
        
        user_lat = float(input_data.get("latitude", 0.0))
        user_lon = float(input_data.get("longitude", 0.0))
        medical_need = str(input_data.get("medical_need", ""))
        radius_km = float(input_data.get("radius", 300.0))  # 300km covers an entire Indian state
        state_filter = str(input_data.get("state_filter", "")).strip()
        
        # 1. Parse user intent
        intent = parse_user_intent(medical_need)
        
        # 2. Fetch nearby facilities
        all_facilities = FacilityLoader.get_facilities()
        nearby_facilities = []
        
        for fac in all_facilities:
            fac_lat = fac.get("latitude")
            fac_lon = fac.get("longitude")
            if fac_lat and fac_lon:
                try:
                    dist = calculate_distance(user_lat, user_lon, float(fac_lat), float(fac_lon))
                    if dist <= radius_km:
                        fac["distance_km"] = round(dist, 2)
                        nearby_facilities.append(fac)
                except (ValueError, TypeError):
                    continue
        
        # Fallback: if radius finds < 5 hospitals, try state-name filter from dataset
        if len(nearby_facilities) < 5 and state_filter:
            logger.info(f"Radius search found {len(nearby_facilities)} results. Falling back to state filter: '{state_filter}'")
            nearby_facilities = []
            for fac in all_facilities:
                state_val = str(fac.get("address_stateOrRegion", "") or "")
                city_val = str(fac.get("address_city", "") or "")
                if state_filter.lower() in state_val.lower() or state_filter.lower() in city_val.lower():
                    fac_lat = fac.get("latitude")
                    fac_lon = fac.get("longitude")
                    if fac_lat and fac_lon:
                        try:
                            dist = calculate_distance(user_lat, user_lon, float(fac_lat), float(fac_lon))
                            fac["distance_km"] = round(dist, 2)
                        except (ValueError, TypeError):
                            fac["distance_km"] = 999
                    else:
                        fac["distance_km"] = 999
                    nearby_facilities.append(fac)
                    
        # 3. Extract, Compute, Rank
        recommended = []
        for fac in nearby_facilities:
            # Extract structured info
            extracted = parse_unstructured_facility_data(fac)
            
            # Capability Match Reasoning
            capability_match = evaluate_capability_match(extracted, intent)
            
            # Compute Trust Score
            score_data = calculate_trust_score(fac, extracted)
            trust_score = score_data["trust_score"]
            score_reasoning = score_data["reasoning"]
            
            recommended.append({
                "name": fac.get("name", "Unknown Facility"),
                "distance_km": fac["distance_km"],
                "trust_score": trust_score,
                "reasoning": score_reasoning,
                "capability_match": capability_match,
                "latitude": fac.get("latitude"),
                "longitude": fac.get("longitude"),
                "city": fac.get("address_city")
            })
            
        # Sort by Trust Score (desc) then distance (asc)
        recommended.sort(key=lambda x: (-x["trust_score"], x["distance_km"]))
        top_facilities = recommended[:20]
        
        # 4. Generate AI Decision Report
        safe_hospitals = [f["name"] for f in top_facilities if f["trust_score"] >= 80][:3]
        safe_names = ", ".join(safe_hospitals) if safe_hospitals else "None completely verified"
        
        risks_found = set()
        for f in top_facilities[:5]:
            for r in f["reasoning"]:
                if "⚠" in r:
                    risks_found.add(r.replace("⚠ ", "").split(" (-")[0])
        risks_summary = ", ".join(list(risks_found)[:3]) if risks_found else "Minimal risks detected in top facilities."
        
        best_emergency = "No fully verified emergency facility nearby."
        for f in top_facilities:
            caps = str(f["capability_match"])
            if "24/7 Emergency ready" in caps and f["trust_score"] >= 70:
                best_emergency = f"{f['name']} (Score: {f['trust_score']}/100, Dist: {f['distance_km']}km)"
                break
                
        ai_decision_report = {
            "what_is_safe": safe_names,
            "why_safe": "These facilities have high Trust Scores (>80) with verified capabilities and no critical medical contradictions.",
            "risks_exist": risks_summary,
            "best_emergency": best_emergency,
            "human_logic_steps": [
                f"Step 1: Parsed user intent for '{medical_need}'",
                "Step 2: Scanned radius for physical proximity",
                "Step 3: Extracted unstructured medical capabilities",
                "Step 4: Evaluated missing staff and equipment (Contradiction Check)",
                "Step 5: Ranked by definitive Trust Score"
            ]
        }
        
        return self.create_response(
            request_id=request_id,
            data={
                "recommended_facilities": top_facilities,
                "ai_decision_report": ai_decision_report
            },
            confidence=0.9,
            explanation=f"Evaluated {len(nearby_facilities)} facilities based on medical need."
        )
