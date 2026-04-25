import datetime
from typing import Any, Dict

import pandas as pd


def calculate_trust_score(facility: Dict[str, Any]) -> Dict[str, int]:
    """Calculate Trust Score based on facility attributes."""
    score = 100

    # 1. If numberDoctors is missing or 0: -15 points
    docs = facility.get("numberDoctors")
    try:
        if docs is None or float(docs) == 0:
            score -= 15
    except (ValueError, TypeError):
        score -= 15

    # 2. If capacity missing: -10 points
    cap = facility.get("capacity")
    if not cap:
        score -= 10

    # 3. If equipment empty: -20 points
    equip = facility.get("equipment")
    if not equip or str(equip).strip() == "" or str(equip).lower() == "nan":
        score -= 20

    # 4. If capability empty: -15 points
    capab = facility.get("capability")
    if not capab or str(capab).strip() == "" or str(capab).lower() == "nan":
        score -= 15

    # 5. If officialWebsite missing: -10 points
    web = facility.get("officialWebsite")
    if not web or str(web).strip() == "" or str(web).lower() == "nan":
        score -= 10

    # 6. If latitude or longitude missing: -25 points
    lat = facility.get("latitude")
    lng = facility.get("longitude")
    if not lat or not lng:
        score -= 25

    # 7. If recency_of_page_update older than 3 years: -10 points
    recency = facility.get("recency_of_page_update")
    if recency and str(recency).lower() != "nan":
        try:
            date_obj = pd.to_datetime(recency)
            # Compare with current date (naive)
            now = pd.Timestamp.now()
            # If date is aware, make now aware
            if date_obj.tzinfo is not None:
                now = pd.Timestamp.now(tz=date_obj.tzinfo)
            if (now - date_obj).days > 3 * 365:
                score -= 10
        except Exception:
            # If we can't parse it, we skip the penalty or apply it? 
            # We'll skip since rule specifies "older than 3 years".
            pass

    # 8. If distinct_social_media_presence_count = 0: -5 points
    social = facility.get("distinct_social_media_presence_count")
    try:
        if social is not None and float(social) == 0:
            score -= 5
    except (ValueError, TypeError):
        pass

    # Ensure boundaries
    score = max(0, min(100, int(score)))

    return {"trust_score": score}
