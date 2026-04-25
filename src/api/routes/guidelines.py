"""
EPCID Guidelines Routes

Clinical guidelines and health education endpoints.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends

from ...api.dependencies import get_optional_user
from ...api.schemas import (
    GuidelineRequest,
    GuidelineResponse,
    GuidelineSource,
    GuidelinesResponse,
)
from ...services.medlineplus_service import MedlinePlusService

router = APIRouter()


# Initialize service
medlineplus = MedlinePlusService()

# Curated pediatric guidelines database
PEDIATRIC_GUIDELINES: dict[str, dict[str, Any]] = {
    "fever": {
        "id": "guide-fever-001",
        "title": "Fever in Children: What Parents Need to Know",
        "content": """
Fever is a common symptom in children and is usually a sign that the body is fighting an infection.

**Normal Temperature Ranges:**
- Oral: 97.6°F to 99.6°F (36.4°C to 37.6°C)
- Rectal: 98.6°F to 100.4°F (37°C to 38°C)
- Axillary: 96.6°F to 98°F (35.9°C to 36.7°C)

**When to Call the Doctor:**
- Infant under 3 months with rectal temp ≥ 100.4°F (38°C)
- Child 3-36 months with temp ≥ 102°F (38.9°C)
- Any age with temp ≥ 104°F (40°C)
- Fever lasting more than 3 days
- Fever with rash, stiff neck, or severe headache
- Signs of dehydration

**Home Care:**
- Encourage fluids
- Dress in light clothing
- Keep room comfortable
- Acetaminophen or ibuprofen as directed by doctor
        """,
        "source": {
            "name": "AAP",
            "organization": "American Academy of Pediatrics",
            "url": "https://www.healthychildren.org/fever",
            "last_updated": "2024-01-01",
        },
        "key_points": [
            "Fever itself is not dangerous - it's a sign the body is fighting infection",
            "Treat the child, not the number",
            "Seek immediate care for infants under 3 months with fever",
        ],
        "warning_signs": [
            "Infant under 3 months with any fever",
            "Difficulty breathing",
            "Stiff neck",
            "Purple spots on skin",
            "Inconsolable crying",
        ],
    },
    "cough": {
        "id": "guide-cough-001",
        "title": "Cough in Children: Causes and When to Worry",
        "content": """
Coughing is a normal reflex that helps clear the airways. Most coughs in children are caused by viral infections.

**Types of Cough:**
- **Dry cough**: Often from cold or allergies
- **Wet cough**: Produces mucus, may indicate chest infection
- **Barking cough**: May indicate croup
- **Whooping cough**: Fits of coughing followed by a "whoop" sound

**When to Seek Care:**
- Difficulty breathing or rapid breathing
- Bluish color around lips
- Coughing blood
- Fever with cough lasting more than 3 days
- Wheezing or stridor
- Cough lasting more than 2 weeks

**Home Care:**
- Honey (for children over 1 year)
- Humidifier
- Plenty of fluids
- Elevate head during sleep
        """,
        "source": {
            "name": "AAP",
            "organization": "American Academy of Pediatrics",
            "url": "https://www.healthychildren.org/cough",
            "last_updated": "2024-01-01",
        },
        "key_points": [
            "Most coughs are viral and resolve on their own",
            "Note the type and timing of cough",
            "Honey can help (only for children over 1 year)",
        ],
        "warning_signs": [
            "Difficulty breathing",
            "Blue color around lips or face",
            "Stridor (high-pitched breathing)",
            "Unable to speak or cry normally",
        ],
    },
    "breathing": {
        "id": "guide-breathing-001",
        "title": "Breathing Problems in Children: Emergency Guide",
        "content": """
Breathing difficulties can be serious in children. Know the signs of respiratory distress.

**Signs of Normal Breathing:**
- Quiet, effortless breathing
- Regular rhythm
- Age-appropriate rate

**Signs of Respiratory Distress:**
- Nasal flaring
- Retractions (skin pulling in between ribs)
- Grunting
- Using neck muscles to breathe
- Unable to speak in full sentences
- Bluish color (cyanosis)

**Normal Respiratory Rates:**
- Newborn: 30-60 breaths/minute
- Infant (1-12 months): 24-40 breaths/minute
- Toddler (1-3 years): 22-30 breaths/minute
- Preschool (3-5 years): 20-28 breaths/minute
- School age (6-12 years): 18-24 breaths/minute

**CALL 911 IF:**
- Blue lips or face
- Severe difficulty breathing
- Not responding normally
- Unable to speak or cry
        """,
        "source": {
            "name": "AAP",
            "organization": "American Academy of Pediatrics",
            "url": "https://www.healthychildren.org/breathing",
            "last_updated": "2024-01-01",
        },
        "key_points": [
            "Know your child's normal breathing pattern",
            "Count breaths for 30 seconds and multiply by 2",
            "Breathing problems can escalate quickly in young children",
        ],
        "warning_signs": [
            "Blue color anywhere (lips, face, fingernails)",
            "Severe retractions",
            "Grunting with each breath",
            "Not waking up or very hard to wake",
            "Drooling and unable to swallow",
        ],
    },
    "dehydration": {
        "id": "guide-dehydration-001",
        "title": "Preventing and Recognizing Dehydration in Children",
        "content": """
Children can become dehydrated quickly, especially during illness with fever, vomiting, or diarrhea.

**Signs of Mild Dehydration:**
- Dry lips and mouth
- Decreased urine output
- Darker urine
- Slightly increased thirst

**Signs of Moderate to Severe Dehydration:**
- Sunken eyes
- Sunken fontanelle (soft spot) in infants
- No tears when crying
- Very dry mouth
- No wet diapers for 6+ hours
- Lethargy or irritability
- Cool, mottled hands and feet

**How to Prevent:**
- Offer small, frequent sips of fluid
- Use oral rehydration solutions (Pedialyte)
- Continue breastfeeding or formula
- Avoid sugary drinks and fruit juice

**When to Seek Care:**
- Unable to keep fluids down
- Signs of moderate/severe dehydration
- Bloody diarrhea
- High fever with signs of dehydration
        """,
        "source": {
            "name": "CDC",
            "organization": "Centers for Disease Control and Prevention",
            "url": "https://www.cdc.gov/dehydration",
            "last_updated": "2024-01-01",
        },
        "key_points": [
            "Small, frequent sips work better than large amounts",
            "Oral rehydration solutions are preferred over water",
            "Monitor wet diapers/urination frequency",
        ],
        "warning_signs": [
            "No wet diapers for 6+ hours",
            "Very dry mouth and no tears",
            "Sunken eyes or fontanelle",
            "Unresponsive or very sleepy",
        ],
    },
}


@router.post(
    "/search",
    response_model=GuidelinesResponse,
    summary="Search guidelines",
    description="Search pediatric clinical guidelines and health education content.",
)
async def search_guidelines(
    request: GuidelineRequest,
    current_user: dict | None = Depends(get_optional_user),
) -> GuidelinesResponse:
    """
    Search for relevant pediatric guidelines.

    Searches curated guidelines and MedlinePlus health topics.
    """
    results = []
    query_lower = request.query.lower()

    # Search curated guidelines
    for key, guideline in PEDIATRIC_GUIDELINES.items():
        # Calculate relevance
        relevance = 0.0

        if key in query_lower:
            relevance = 0.9
        elif any(term in guideline["title"].lower() for term in query_lower.split()):
            relevance = 0.7
        elif any(term in guideline["content"].lower() for term in query_lower.split()):
            relevance = 0.5

        # Check symptom match
        if request.symptoms:
            for symptom in request.symptoms:
                if symptom.lower() in key or symptom.lower() in guideline["content"].lower():
                    relevance = max(relevance, 0.8)

        if relevance > 0.3:
            source_data = guideline["source"]
            results.append(
                GuidelineResponse(
                    id=guideline["id"],
                    title=guideline["title"],
                    content=guideline["content"].strip(),
                    relevance_score=relevance,
                    source=GuidelineSource(
                        name=source_data["name"],
                        organization=source_data["organization"],
                        url=source_data.get("url"),
                        last_updated=(
                            datetime.fromisoformat(source_data["last_updated"])
                            if source_data.get("last_updated")
                            else None
                        ),
                    ),
                    key_points=guideline["key_points"],
                    age_specific=request.age_months is not None,
                    warning_signs=guideline["warning_signs"],
                )
            )

    # Sort by relevance
    results.sort(key=lambda x: x.relevance_score, reverse=True)

    # Limit results
    results = results[: request.max_results]

    return GuidelinesResponse(
        query=request.query,
        results=results,
        total_found=len(results),
    )


@router.get(
    "/fever",
    response_model=GuidelineResponse,
    summary="Get fever guidelines",
    description="Get comprehensive fever management guidelines.",
)
async def get_fever_guidelines() -> GuidelineResponse:
    """Get fever guidelines."""
    guideline = PEDIATRIC_GUIDELINES["fever"]
    return GuidelineResponse(
        id=guideline["id"],
        title=guideline["title"],
        content=guideline["content"].strip(),
        relevance_score=1.0,
        source=GuidelineSource(
            name=guideline["source"]["name"],
            organization=guideline["source"]["organization"],
            url=guideline["source"].get("url"),
            last_updated=datetime.fromisoformat(guideline["source"]["last_updated"]),
        ),
        key_points=guideline["key_points"],
        age_specific=False,
        warning_signs=guideline["warning_signs"],
    )


@router.get(
    "/breathing",
    response_model=GuidelineResponse,
    summary="Get breathing guidelines",
    description="Get respiratory emergency guidelines.",
)
async def get_breathing_guidelines() -> GuidelineResponse:
    """Get breathing difficulty guidelines."""
    guideline = PEDIATRIC_GUIDELINES["breathing"]
    return GuidelineResponse(
        id=guideline["id"],
        title=guideline["title"],
        content=guideline["content"].strip(),
        relevance_score=1.0,
        source=GuidelineSource(
            name=guideline["source"]["name"],
            organization=guideline["source"]["organization"],
            url=guideline["source"].get("url"),
            last_updated=datetime.fromisoformat(guideline["source"]["last_updated"]),
        ),
        key_points=guideline["key_points"],
        age_specific=False,
        warning_signs=guideline["warning_signs"],
    )


@router.get(
    "/dehydration",
    response_model=GuidelineResponse,
    summary="Get dehydration guidelines",
)
async def get_dehydration_guidelines() -> GuidelineResponse:
    """Get dehydration prevention and recognition guidelines."""
    guideline = PEDIATRIC_GUIDELINES["dehydration"]
    return GuidelineResponse(
        id=guideline["id"],
        title=guideline["title"],
        content=guideline["content"].strip(),
        relevance_score=1.0,
        source=GuidelineSource(
            name=guideline["source"]["name"],
            organization=guideline["source"]["organization"],
            url=guideline["source"].get("url"),
            last_updated=datetime.fromisoformat(guideline["source"]["last_updated"]),
        ),
        key_points=guideline["key_points"],
        age_specific=False,
        warning_signs=guideline["warning_signs"],
    )


@router.get(
    "/emergency-signs",
    response_model=list[dict],
    summary="Get emergency warning signs",
    description="Get a list of emergency warning signs for quick reference.",
)
async def get_emergency_signs() -> list[dict[str, Any]]:
    """Get emergency warning signs for all conditions."""
    return [
        {
            "category": "Breathing",
            "signs": [
                "Difficulty breathing",
                "Blue lips or face",
                "Grunting with each breath",
                "Severe chest retractions",
                "Unable to speak or cry normally",
            ],
            "action": "Call 911 immediately",
        },
        {
            "category": "Consciousness",
            "signs": [
                "Cannot be woken up",
                "Very difficult to wake",
                "Confused or disoriented",
                "Not responding normally",
                "Seizure",
            ],
            "action": "Call 911 immediately",
        },
        {
            "category": "Dehydration",
            "signs": [
                "No tears when crying",
                "Sunken eyes",
                "Very dry mouth",
                "No wet diapers for 6+ hours",
                "Skin doesn't bounce back when pinched",
            ],
            "action": "Seek immediate medical care",
        },
        {
            "category": "Fever",
            "signs": [
                "Infant under 3 months with any fever",
                "Purple or red spots that don't fade",
                "Stiff neck with fever",
                "Fever over 104°F (40°C)",
                "Fever with rash",
            ],
            "action": "Seek immediate medical care",
        },
        {
            "category": "Skin",
            "signs": [
                "Purple or blood-colored spots",
                "Rash that doesn't fade when pressed",
                "Severe swelling of face/lips/tongue",
                "Hives with breathing difficulty",
            ],
            "action": "Call 911 for allergic reaction signs",
        },
    ]


@router.get(
    "/topics",
    response_model=list[dict],
    summary="Get available topics",
    description="Get list of available guideline topics.",
)
async def get_guideline_topics() -> list[dict[str, Any]]:
    """Get list of available guideline topics."""
    return [{"id": key, "title": g["title"]} for key, g in PEDIATRIC_GUIDELINES.items()]
