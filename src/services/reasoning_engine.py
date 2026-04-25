from typing import Dict, Any, List, Tuple
import math
import re

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km using Haversine formula."""
    try:
        R = 6371  # Earth radius in km
        
        lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        return R * c
    except (ValueError, TypeError):
        return 9999.0

def parse_user_intent(medical_need: str) -> Dict[str, Any]:
    """Parse the medical need string to determine required capabilities."""
    need_lower = medical_need.lower()
    
    requires_icu = bool(re.search(r'\b(icu|intensive care|critical|severe)\b', need_lower))
    requires_surgery = bool(re.search(r'\b(surgery|appendectomy|operate|trauma)\b', need_lower))
    requires_emergency = bool(re.search(r'\b(emergency|urgent|immediate|now)\b', need_lower))
    
    required_specialists = []
    if "child" in need_lower or "pediatric" in need_lower:
        required_specialists.append("pediatrician")
    if "heart" in need_lower or "cardio" in need_lower:
        required_specialists.append("cardiologist")
    if "brain" in need_lower or "neuro" in need_lower:
        required_specialists.append("neurologist")
        
    return {
        "requires_icu": requires_icu,
        "requires_surgery": requires_surgery,
        "requires_emergency": requires_emergency,
        "required_specialists": required_specialists
    }

def evaluate_capability_match(extracted: Dict[str, Any], intent: Dict[str, Any]) -> List[str]:
    """Evaluate how well the facility matches the user intent."""
    matches = []
    
    if intent["requires_icu"]:
        if extracted["icu"]:
            matches.append("✔ ICU available")
        else:
            matches.append("⚠ No ICU found")
            
    if intent["requires_surgery"]:
        if extracted["surgery"]:
            matches.append("✔ Surgery supported")
        else:
            matches.append("⚠ Surgery capability missing")
            
    if intent["requires_emergency"]:
        if extracted["emergency_ready"]:
            matches.append("✔ 24/7 Emergency ready")
        else:
            matches.append("⚠ May not have 24/7 emergency")
            
    for spec in intent["required_specialists"]:
        if spec in extracted["specialists"]:
            matches.append(f"✔ {spec.capitalize()} available")
        else:
            matches.append(f"⚠ Missing {spec}")
            
    # Always add some general info if no specific intent matched
    if not matches:
        if extracted["emergency_ready"]:
            matches.append("✔ 24/7 Emergency ready")
        if extracted["icu"]:
            matches.append("✔ ICU available")
            
    return matches
