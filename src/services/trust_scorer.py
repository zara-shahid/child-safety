from typing import Dict, Any, Tuple, List

def calculate_trust_score(facility: Dict[str, Any], extracted: Dict[str, Any]) -> Dict[str, Any]:
    """
    Trust Scorer (Core Requirement).
    Calculates the Trust Score using strict deduction rules and returns reasoning.
    """
    score = 100
    reasoning: List[str] = []
    
    # Missing doctors -> -15
    if extracted["doctors_available"] == 0:
        score -= 15
        reasoning.append("⚠ Missing doctors (-15)")
        
    # Missing ICU data -> -20
    # Wait, the prompt says "Missing ICU data" not "No ICU". 
    # If capability exists but doesn't mention ICU, is it missing? We'll assume if ICU is false, it's a deduction for emergency context, 
    # or if capability string is entirely empty.
    capability = str(facility.get("capability", "")).strip()
    if not capability or (not extracted["icu"] and "intensive" not in capability.lower()):
        score -= 20
        reasoning.append("⚠ Missing ICU data (-20)")
        
    # Missing equipment -> -15
    if not extracted["equipment"]:
        score -= 15
        reasoning.append("⚠ Incomplete equipment data (-15)")
        
    # Surgery capability but no anesthesiologist -> -25
    if extracted["surgery"] and "anesthesiologist" not in extracted["specialists"]:
        score -= 25
        reasoning.append("⚠ Surgery capability but missing anesthesiologist (-25)")
        
    # Outdated data -> -10
    # Using recency_of_page_update if it exists, or just checking if yearEstablished is missing/old
    recency = str(facility.get("recency_of_page_update", ""))
    if "year" in recency.lower() or not recency:
        score -= 10
        reasoning.append("⚠ Outdated data (-10)")
        
    # No official website -> -5
    website = str(facility.get("officialWebsite", "")).strip()
    if not website or website.lower() == 'nan':
        score -= 5
        reasoning.append("⚠ No official website (-5)")
        
    # Low completeness of record -> -10
    # Checking if basic fields are missing
    completeness = 0
    if facility.get("phone_numbers"): completeness += 1
    if facility.get("address_line1"): completeness += 1
    if facility.get("latitude"): completeness += 1
    if completeness < 3:
        score -= 10
        reasoning.append("⚠ Low completeness of record (-10)")
        
    if not reasoning:
        reasoning.append("✔ Highly verified data")
        
    # Score constraints
    score = max(0, min(100, score))
    
    return {
        "trust_score": score,
        "reasoning": reasoning
    }
