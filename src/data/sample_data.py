"""
EPCID Sample Data

Pre-defined sample data for demos and testing.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any


def create_sample_data() -> Dict[str, Any]:
    """
    Create sample data for demonstration purposes.
    
    Returns:
        Dictionary containing sample users, children, symptoms, etc.
    """
    now = datetime.now(__import__('datetime').timezone.utc)
    
    # Sample users
    users = [
        {
            "id": "user-demo-001",
            "email": "demo@epcid.health",
            "full_name": "Demo Parent",
            "phone": "+1-555-123-4567",
            "is_active": True,
            "is_verified": True,
            "created_at": (now - timedelta(days=30)).isoformat(),
        },
        {
            "id": "user-demo-002",
            "email": "test@epcid.health",
            "full_name": "Test User",
            "phone": "+1-555-987-6543",
            "is_active": True,
            "is_verified": True,
            "created_at": (now - timedelta(days=15)).isoformat(),
        },
    ]
    
    # Sample children
    children = [
        {
            "id": "child-demo-001",
            "user_id": "user-demo-001",
            "name": "Emma",
            "date_of_birth": (now - timedelta(days=365 * 3)).isoformat(),
            "gender": "female",
            "medical_conditions": ["asthma"],
            "allergies": ["peanuts"],
            "medications": ["albuterol inhaler"],
            "age_months": 36,
        },
        {
            "id": "child-demo-002",
            "user_id": "user-demo-001",
            "name": "Liam",
            "date_of_birth": (now - timedelta(days=365 * 6)).isoformat(),
            "gender": "male",
            "medical_conditions": [],
            "allergies": [],
            "medications": [],
            "age_months": 72,
        },
        {
            "id": "child-demo-003",
            "user_id": "user-demo-002",
            "name": "Olivia",
            "date_of_birth": (now - timedelta(days=180)).isoformat(),
            "gender": "female",
            "medical_conditions": ["eczema"],
            "allergies": ["milk"],
            "medications": [],
            "age_months": 6,
        },
    ]
    
    # Sample symptom entries
    symptoms = [
        # Emma - asthma exacerbation scenario
        {
            "id": "sym-demo-001",
            "child_id": "child-demo-001",
            "symptom_type": "cough",
            "severity": "moderate",
            "onset_time": (now - timedelta(hours=6)).isoformat(),
            "recorded_at": (now - timedelta(hours=5)).isoformat(),
            "measurements": None,
            "notes": "Dry cough, worse at night",
        },
        {
            "id": "sym-demo-002",
            "child_id": "child-demo-001",
            "symptom_type": "wheeze",
            "severity": "mild",
            "onset_time": (now - timedelta(hours=4)).isoformat(),
            "recorded_at": (now - timedelta(hours=3)).isoformat(),
            "measurements": None,
            "notes": "Audible wheeze when breathing",
        },
        # Liam - cold scenario
        {
            "id": "sym-demo-003",
            "child_id": "child-demo-002",
            "symptom_type": "fever",
            "severity": "mild",
            "onset_time": (now - timedelta(hours=12)).isoformat(),
            "recorded_at": (now - timedelta(hours=10)).isoformat(),
            "measurements": {"temperature": 100.8, "unit": "fahrenheit"},
            "notes": "Low-grade fever started last night",
        },
        {
            "id": "sym-demo-004",
            "child_id": "child-demo-002",
            "symptom_type": "congestion",
            "severity": "moderate",
            "onset_time": (now - timedelta(hours=24)).isoformat(),
            "recorded_at": (now - timedelta(hours=22)).isoformat(),
            "measurements": None,
            "notes": "Stuffy nose, some clear discharge",
        },
        # Olivia - infant fever scenario (higher concern)
        {
            "id": "sym-demo-005",
            "child_id": "child-demo-003",
            "symptom_type": "fever",
            "severity": "moderate",
            "onset_time": (now - timedelta(hours=2)).isoformat(),
            "recorded_at": (now - timedelta(hours=1)).isoformat(),
            "measurements": {"temperature": 101.5, "unit": "fahrenheit"},
            "notes": "Noticed during feeding, seems fussy",
        },
        {
            "id": "sym-demo-006",
            "child_id": "child-demo-003",
            "symptom_type": "irritability",
            "severity": "moderate",
            "onset_time": (now - timedelta(hours=3)).isoformat(),
            "recorded_at": (now - timedelta(hours=1)).isoformat(),
            "measurements": None,
            "notes": "More fussy than usual, hard to console",
        },
    ]
    
    # Sample assessments
    assessments = [
        {
            "id": "assess-demo-001",
            "child_id": "child-demo-001",
            "risk_level": "moderate",
            "risk_score": 0.45,
            "confidence": 0.82,
            "symptoms_input": [
                {"type": "cough", "severity": "moderate"},
                {"type": "wheeze", "severity": "mild"},
            ],
            "risk_factors": [
                {
                    "name": "existing_asthma",
                    "contribution": 0.3,
                    "description": "Child has history of asthma",
                    "source": "medical_history",
                },
                {
                    "name": "respiratory_symptoms",
                    "contribution": 0.35,
                    "description": "Cough and wheeze suggest possible exacerbation",
                    "source": "symptom_analysis",
                },
            ],
            "red_flags": [],
            "warning_signs": ["Monitor for increased breathing effort", "Watch for blue discoloration"],
            "primary_recommendation": "Use rescue inhaler as prescribed. Monitor breathing closely.",
            "secondary_recommendations": [
                "Keep child calm and comfortable",
                "Ensure hydration",
                "Note any changes in symptoms",
            ],
            "suggested_actions": [
                "Administer albuterol inhaler",
                "Monitor breathing rate",
                "Contact pediatrician if symptoms worsen",
            ],
            "when_to_seek_care": "If breathing becomes labored, skin appears blue, or child cannot speak in full sentences",
            "explanation": "Based on the reported symptoms and Emma's history of asthma, there is a moderate risk of an asthma exacerbation. The cough and wheeze are concerning but currently manageable.",
            "clinical_reasoning": "Asthma history combined with respiratory symptoms warrants close monitoring. Current severity does not indicate immediate emergency.",
            "created_at": (now - timedelta(hours=2)).isoformat(),
        },
        {
            "id": "assess-demo-002",
            "child_id": "child-demo-003",
            "risk_level": "high",
            "risk_score": 0.68,
            "confidence": 0.75,
            "symptoms_input": [
                {"type": "fever", "severity": "moderate", "measurements": {"temperature": 101.5}},
                {"type": "irritability", "severity": "moderate"},
            ],
            "risk_factors": [
                {
                    "name": "infant_age",
                    "contribution": 0.4,
                    "description": "Infant under 12 months with fever",
                    "source": "age_assessment",
                },
                {
                    "name": "fever_level",
                    "contribution": 0.25,
                    "description": "Temperature above 101°F",
                    "source": "symptom_analysis",
                },
            ],
            "red_flags": ["Infant under 3 months with fever requires immediate evaluation"],
            "warning_signs": [
                "Watch for decreased activity",
                "Monitor feeding",
                "Check for rash",
            ],
            "primary_recommendation": "Contact your pediatrician promptly for guidance on fever evaluation in an infant.",
            "secondary_recommendations": [
                "Keep baby comfortable",
                "Offer frequent feeds",
                "Monitor temperature every 2-3 hours",
            ],
            "suggested_actions": [
                "Call pediatrician within 1 hour",
                "Prepare for possible office visit",
                "Document feeding and wet diapers",
            ],
            "when_to_seek_care": "Immediately if: temperature rises above 102°F, baby becomes very sleepy or hard to wake, has difficulty breathing, or develops a rash",
            "explanation": "Fever in a 6-month-old infant warrants prompt medical attention. While Olivia is not in the highest-risk under-3-month category, fever in infants should be evaluated by a healthcare provider.",
            "clinical_reasoning": "Infants have immature immune systems and fever can indicate serious infection. The combination of fever and irritability in this age group requires professional assessment.",
            "created_at": (now - timedelta(minutes=30)).isoformat(),
        },
    ]
    
    # Sample environmental data
    environmental = [
        {
            "location": {"lat": 40.7128, "lng": -74.0060},  # NYC
            "location_name": "New York, NY",
            "air_quality": {
                "aqi": 75,
                "category": "Moderate",
                "dominant_pollutant": "pm25",
                "pollutants": {
                    "pm25": 22.5,
                    "pm10": 35.0,
                    "o3": 45.0,
                    "no2": 18.0,
                },
            },
            "weather": {
                "temperature": 68,
                "feels_like": 70,
                "humidity": 55,
                "conditions": "Partly Cloudy",
                "wind_speed": 8,
            },
            "timestamp": now.isoformat(),
        },
        {
            "location": {"lat": 34.0522, "lng": -118.2437},  # LA
            "location_name": "Los Angeles, CA",
            "air_quality": {
                "aqi": 95,
                "category": "Moderate",
                "dominant_pollutant": "o3",
                "pollutants": {
                    "pm25": 18.0,
                    "pm10": 42.0,
                    "o3": 68.0,
                    "no2": 22.0,
                },
            },
            "weather": {
                "temperature": 78,
                "feels_like": 80,
                "humidity": 45,
                "conditions": "Sunny",
                "wind_speed": 5,
            },
            "timestamp": now.isoformat(),
        },
    ]
    
    return {
        "metadata": {
            "created_at": now.isoformat(),
            "description": "Sample data for EPCID demonstration",
            "version": "1.0",
        },
        "users": users,
        "children": children,
        "symptoms": symptoms,
        "assessments": assessments,
        "environmental": environmental,
    }


def get_demo_scenario(scenario: str = "cold") -> Dict[str, Any]:
    """
    Get a specific demo scenario for interactive testing.
    
    Args:
        scenario: One of "cold", "asthma", "infant_fever", "emergency"
        
    Returns:
        Scenario data including patient, symptoms, and expected outcome
    """
    scenarios = {
        "cold": {
            "name": "Common Cold in School-Age Child",
            "description": "6-year-old with typical viral URI symptoms",
            "expected_risk": "low",
            "patient": {
                "name": "Alex",
                "age_months": 72,
                "gender": "male",
                "conditions": [],
                "allergies": [],
            },
            "symptoms": [
                {"type": "congestion", "severity": "moderate"},
                {"type": "cough", "severity": "mild"},
                {"type": "sore_throat", "severity": "mild"},
            ],
        },
        "asthma": {
            "name": "Asthma Exacerbation",
            "description": "4-year-old with asthma showing respiratory symptoms",
            "expected_risk": "moderate",
            "patient": {
                "name": "Maya",
                "age_months": 48,
                "gender": "female",
                "conditions": ["asthma"],
                "allergies": [],
                "medications": ["albuterol inhaler"],
            },
            "symptoms": [
                {"type": "cough", "severity": "moderate"},
                {"type": "wheeze", "severity": "moderate"},
                {"type": "breathing_difficulty", "severity": "mild"},
            ],
        },
        "infant_fever": {
            "name": "Fever in Young Infant",
            "description": "4-month-old with new fever",
            "expected_risk": "high",
            "patient": {
                "name": "Baby Noah",
                "age_months": 4,
                "gender": "male",
                "conditions": [],
                "allergies": [],
            },
            "symptoms": [
                {"type": "fever", "severity": "moderate", "measurements": {"temperature": 101.2}},
                {"type": "irritability", "severity": "mild"},
                {"type": "poor_feeding", "severity": "mild"},
            ],
        },
        "emergency": {
            "name": "Respiratory Emergency",
            "description": "2-year-old with severe breathing difficulty",
            "expected_risk": "critical",
            "patient": {
                "name": "Sophia",
                "age_months": 24,
                "gender": "female",
                "conditions": [],
                "allergies": [],
            },
            "symptoms": [
                {"type": "breathing_difficulty", "severity": "severe"},
                {"type": "fever", "severity": "moderate", "measurements": {"temperature": 103.5}},
                {"type": "cough", "severity": "severe"},
            ],
            "red_flags": [
                "Severe breathing difficulty",
                "High fever",
                "Possible respiratory distress",
            ],
        },
    }
    
    return scenarios.get(scenario, scenarios["cold"])
