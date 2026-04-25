import re
from typing import Dict, Any, List

def parse_unstructured_facility_data(facility: Dict[str, Any]) -> Dict[str, Any]:
    """
    Massive Unstructured Extraction Module.
    Takes raw, messy facility data and extracts structured medical attributes.
    """
    description = str(facility.get("description", "")).lower()
    capability = str(facility.get("capability", "")).lower()
    equipment_str = str(facility.get("equipment", "")).lower()
    specialties_str = str(facility.get("specialties", "")).lower()
    
    # Combine all unstructured text for deep searching
    full_text = f"{description} {capability} {equipment_str} {specialties_str}"
    
    # Extract ICU
    icu_ready = bool(re.search(r'\b(icu|intensive care|nicu|picu|ccu)\b', full_text))
    
    # Extract Emergency Surgery
    surgery_ready = bool(re.search(r'\b(surgery|surgical|operating room|ot|surgeon|appendectomy)\b', full_text))
    
    # Extract Equipment
    equipment: List[str] = []
    if "ventilator" in full_text: equipment.append("ventilator")
    if "oxygen" in full_text or "o2" in full_text: equipment.append("oxygen")
    if "x-ray" in full_text or "xray" in full_text or "imaging" in full_text: equipment.append("x-ray")
    if "defibrillator" in full_text: equipment.append("defibrillator")
    if "ultrasound" in full_text: equipment.append("ultrasound")
        
    # Extract Doctor Availability (Try to parse from numberDoctors or text)
    doctors_available = 0
    try:
        docs_val = facility.get("numberDoctors")
        if docs_val and str(docs_val).strip() != 'nan':
            doctors_available = int(float(docs_val))
    except (ValueError, TypeError):
        pass
        
    # Fallback to parsing text for doctors if 0
    if doctors_available == 0:
        doc_matches = re.findall(r'(\d+)\s+(?:doctors|physicians|surgeons)', full_text)
        if doc_matches:
            doctors_available = int(doc_matches[0])
            
    # Extract Specialists
    specialists: List[str] = []
    if re.search(r'\b(pediatric|paediatric)\b', full_text): specialists.append("pediatrician")
    if re.search(r'\b(cardio|cardiologist)\b', full_text): specialists.append("cardiologist")
    if re.search(r'\b(neuro|neurologist)\b', full_text): specialists.append("neurologist")
    if re.search(r'\b(ortho|orthopedic)\b', full_text): specialists.append("orthopedic")
    if re.search(r'\b(anesthesiologist|anesthesia)\b', full_text): specialists.append("anesthesiologist")

    # Extract 24/7 readiness
    emergency_ready = bool(re.search(r'\b(24/7|24x7|24 hours|emergency|er|trauma)\b', full_text))
    
    return {
        "icu": icu_ready,
        "surgery": surgery_ready,
        "equipment": equipment,
        "doctors_available": doctors_available,
        "specialists": specialists,
        "emergency_ready": emergency_ready
    }
