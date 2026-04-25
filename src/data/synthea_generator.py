"""
EPCID Synthea-Style Synthetic Data Generator

Generates realistic pediatric patient data for testing and development.
Mimics Synthea output format but focused on pediatric scenarios.
"""

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4


class SyntheaGenerator:
    """
    Generate synthetic pediatric patient data.
    
    Creates realistic test data including:
    - Patient demographics
    - Conditions
    - Observations (vitals, symptoms)
    - Encounters
    - Medications
    """
    
    # Name pools
    FIRST_NAMES_MALE = [
        "Liam", "Noah", "Oliver", "Elijah", "James", "William", "Benjamin", 
        "Lucas", "Henry", "Theodore", "Jack", "Levi", "Alexander", "Mason",
        "Ethan", "Sebastian", "Michael", "Daniel", "Matthew", "Aiden"
    ]
    
    FIRST_NAMES_FEMALE = [
        "Olivia", "Emma", "Charlotte", "Amelia", "Ava", "Sophia", "Isabella",
        "Mia", "Evelyn", "Harper", "Luna", "Camila", "Gianna", "Elizabeth",
        "Eleanor", "Ella", "Abigail", "Sofia", "Avery", "Scarlett"
    ]
    
    LAST_NAMES = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
        "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
        "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"
    ]
    
    # Common pediatric conditions
    CONDITIONS = {
        "asthma": {
            "code": "195967001",
            "system": "http://snomed.info/sct",
            "display": "Asthma",
            "prevalence": 0.08,  # 8% of children
        },
        "allergic_rhinitis": {
            "code": "61582004",
            "system": "http://snomed.info/sct",
            "display": "Allergic rhinitis",
            "prevalence": 0.10,
        },
        "eczema": {
            "code": "43116000",
            "system": "http://snomed.info/sct",
            "display": "Eczema",
            "prevalence": 0.10,
        },
        "food_allergy": {
            "code": "414285001",
            "system": "http://snomed.info/sct",
            "display": "Food allergy",
            "prevalence": 0.05,
        },
        "adhd": {
            "code": "406506008",
            "system": "http://snomed.info/sct",
            "display": "Attention deficit hyperactivity disorder",
            "prevalence": 0.07,
        },
        "anxiety": {
            "code": "197480006",
            "system": "http://snomed.info/sct",
            "display": "Anxiety disorder",
            "prevalence": 0.04,
        },
    }
    
    # Common allergies
    ALLERGIES = [
        {"name": "Peanuts", "code": "91935009", "prevalence": 0.02},
        {"name": "Tree nuts", "code": "91934008", "prevalence": 0.01},
        {"name": "Milk", "code": "425525006", "prevalence": 0.03},
        {"name": "Eggs", "code": "91930004", "prevalence": 0.02},
        {"name": "Wheat", "code": "420174000", "prevalence": 0.01},
        {"name": "Soy", "code": "91937001", "prevalence": 0.005},
        {"name": "Penicillin", "code": "91936005", "prevalence": 0.01},
    ]
    
    # Symptom scenarios
    SYMPTOM_SCENARIOS = {
        "viral_uri": {
            "name": "Viral Upper Respiratory Infection",
            "symptoms": [
                {"type": "fever", "severity": "mild", "prob": 0.7, "temp_range": (100.0, 101.5)},
                {"type": "cough", "severity": "mild", "prob": 0.9},
                {"type": "congestion", "severity": "moderate", "prob": 0.95},
                {"type": "sore_throat", "severity": "mild", "prob": 0.5},
                {"type": "fatigue", "severity": "mild", "prob": 0.6},
            ],
            "duration_days": (5, 10),
            "prevalence": 0.3,
        },
        "gastroenteritis": {
            "name": "Viral Gastroenteritis",
            "symptoms": [
                {"type": "fever", "severity": "mild", "prob": 0.4, "temp_range": (100.0, 101.0)},
                {"type": "vomiting", "severity": "moderate", "prob": 0.8},
                {"type": "diarrhea", "severity": "moderate", "prob": 0.9},
                {"type": "abdominal_pain", "severity": "mild", "prob": 0.6},
                {"type": "fatigue", "severity": "moderate", "prob": 0.7},
            ],
            "duration_days": (2, 5),
            "prevalence": 0.15,
        },
        "otitis_media": {
            "name": "Ear Infection",
            "symptoms": [
                {"type": "fever", "severity": "moderate", "prob": 0.6, "temp_range": (101.0, 103.0)},
                {"type": "ear_pain", "severity": "severe", "prob": 0.95},
                {"type": "irritability", "severity": "moderate", "prob": 0.8},
                {"type": "poor_feeding", "severity": "mild", "prob": 0.4},
            ],
            "duration_days": (3, 7),
            "prevalence": 0.2,
        },
        "asthma_exacerbation": {
            "name": "Asthma Exacerbation",
            "symptoms": [
                {"type": "cough", "severity": "moderate", "prob": 0.95},
                {"type": "wheeze", "severity": "moderate", "prob": 0.9},
                {"type": "breathing_difficulty", "severity": "moderate", "prob": 0.7},
                {"type": "chest_tightness", "severity": "mild", "prob": 0.5},
            ],
            "duration_days": (1, 5),
            "prevalence": 0.1,
            "requires_condition": "asthma",
        },
        "flu": {
            "name": "Influenza",
            "symptoms": [
                {"type": "fever", "severity": "severe", "prob": 0.95, "temp_range": (102.0, 104.0)},
                {"type": "cough", "severity": "moderate", "prob": 0.8},
                {"type": "body_aches", "severity": "moderate", "prob": 0.7},
                {"type": "headache", "severity": "moderate", "prob": 0.6},
                {"type": "fatigue", "severity": "severe", "prob": 0.9},
                {"type": "chills", "severity": "moderate", "prob": 0.7},
            ],
            "duration_days": (5, 10),
            "prevalence": 0.1,
        },
    }
    
    def __init__(self, seed: int | None = None):
        """
        Initialize the generator.
        
        Args:
            seed: Random seed for reproducibility
        """
        if seed is not None:
            random.seed(seed)
        
        self.generated_patients: List[Dict] = []
    
    def generate_patient(
        self,
        age_months: int | None = None,
        gender: str | None = None,
    ) -> Dict[str, Any]:
        """
        Generate a single synthetic patient.
        
        Args:
            age_months: Specific age in months (random if None)
            gender: "male" or "female" (random if None)
            
        Returns:
            FHIR-like Patient resource
        """
        # Generate demographics
        patient_id = str(uuid4())
        gender = gender or random.choice(["male", "female"])
        
        if age_months is None:
            # Weight towards younger children (more common scenario)
            if random.random() < 0.3:
                age_months = random.randint(1, 24)  # Infant/toddler
            elif random.random() < 0.6:
                age_months = random.randint(24, 72)  # Toddler/preschool
            else:
                age_months = random.randint(72, 216)  # School age
        
        birth_date = datetime.now() - timedelta(days=age_months * 30.44)
        
        # Generate name
        first_name = random.choice(
            self.FIRST_NAMES_MALE if gender == "male" else self.FIRST_NAMES_FEMALE
        )
        last_name = random.choice(self.LAST_NAMES)
        
        # Generate conditions
        conditions = self._generate_conditions()
        
        # Generate allergies
        allergies = self._generate_allergies()
        
        # Generate medications based on conditions
        medications = self._generate_medications(conditions)
        
        patient = {
            "resourceType": "Patient",
            "id": patient_id,
            "identifier": [
                {
                    "system": "urn:epcid:patient",
                    "value": patient_id,
                }
            ],
            "name": [
                {
                    "family": last_name,
                    "given": [first_name],
                }
            ],
            "gender": gender,
            "birthDate": birth_date.strftime("%Y-%m-%d"),
            "age_months": age_months,
            "conditions": conditions,
            "allergies": allergies,
            "medications": medications,
            "meta": {
                "lastUpdated": datetime.now().isoformat(),
            },
        }
        
        self.generated_patients.append(patient)
        return patient
    
    def _generate_conditions(self) -> List[Dict]:
        """Generate chronic conditions based on prevalence."""
        conditions = []
        
        for code, data in self.CONDITIONS.items():
            if random.random() < data["prevalence"]:
                conditions.append({
                    "code": data["code"],
                    "system": data["system"],
                    "display": data["display"],
                    "onset": (datetime.now() - timedelta(days=random.randint(30, 365))).isoformat(),
                })
        
        return conditions
    
    def _generate_allergies(self) -> List[Dict]:
        """Generate allergies based on prevalence."""
        allergies = []
        
        for allergy in self.ALLERGIES:
            if random.random() < allergy["prevalence"]:
                allergies.append({
                    "substance": allergy["name"],
                    "code": allergy["code"],
                    "reaction": random.choice(["rash", "hives", "swelling", "anaphylaxis"]),
                })
        
        return allergies
    
    def _generate_medications(self, conditions: List[Dict]) -> List[Dict]:
        """Generate medications based on conditions."""
        medications = []
        
        condition_codes = [c["code"] for c in conditions]
        
        # Asthma medications
        if "195967001" in condition_codes:  # Asthma
            medications.append({
                "name": "Albuterol inhaler",
                "code": "372897005",
                "dosage": "2 puffs as needed",
                "frequency": "PRN",
            })
            if random.random() < 0.5:
                medications.append({
                    "name": "Fluticasone inhaler",
                    "code": "116601002",
                    "dosage": "1 puff twice daily",
                    "frequency": "BID",
                })
        
        # Allergy medications
        if "61582004" in condition_codes:  # Allergic rhinitis
            medications.append({
                "name": "Cetirizine",
                "code": "372523007",
                "dosage": "5-10mg daily",
                "frequency": "Daily",
            })
        
        return medications
    
    def generate_symptom_episode(
        self,
        patient: Dict,
        scenario_key: str | None = None,
    ) -> Dict[str, Any]:
        """
        Generate a symptom episode for a patient.
        
        Args:
            patient: Patient resource
            scenario_key: Specific scenario to use (random if None)
            
        Returns:
            Episode with symptoms
        """
        # Select scenario
        if scenario_key:
            scenario = self.SYMPTOM_SCENARIOS.get(scenario_key)
            if not scenario:
                raise ValueError(f"Unknown scenario: {scenario_key}")
        else:
            # Select random scenario weighted by prevalence
            valid_scenarios = []
            for key, data in self.SYMPTOM_SCENARIOS.items():
                # Check if scenario requires a condition
                if "requires_condition" in data:
                    patient_conditions = [c.get("display", "").lower() for c in patient.get("conditions", [])]
                    if data["requires_condition"].lower() not in " ".join(patient_conditions):
                        continue
                valid_scenarios.append((key, data, data["prevalence"]))
            
            if not valid_scenarios:
                valid_scenarios = [(k, v, v["prevalence"]) for k, v in self.SYMPTOM_SCENARIOS.items()
                                   if "requires_condition" not in v]
            
            total = sum(s[2] for s in valid_scenarios)
            r = random.random() * total
            cumulative = 0
            for key, data, prevalence in valid_scenarios:
                cumulative += prevalence
                if r <= cumulative:
                    scenario_key = key
                    scenario = data
                    break
            else:
                scenario_key = valid_scenarios[0][0]
                scenario = valid_scenarios[0][1]
        
        # Generate episode timing
        duration_range = scenario["duration_days"]
        duration = random.randint(duration_range[0], duration_range[1])
        onset = datetime.now() - timedelta(hours=random.randint(1, 48))
        
        # Generate symptoms
        symptoms = []
        for symptom_data in scenario["symptoms"]:
            if random.random() < symptom_data["prob"]:
                symptom = {
                    "type": symptom_data["type"],
                    "severity": symptom_data["severity"],
                    "onset": onset.isoformat(),
                }
                
                # Add temperature for fever
                if symptom_data["type"] == "fever" and "temp_range" in symptom_data:
                    temp_range = symptom_data["temp_range"]
                    symptom["measurements"] = {
                        "temperature": round(random.uniform(temp_range[0], temp_range[1]), 1),
                        "unit": "fahrenheit",
                    }
                
                symptoms.append(symptom)
        
        return {
            "episode_id": str(uuid4()),
            "patient_id": patient["id"],
            "scenario": scenario_key,
            "scenario_name": scenario["name"],
            "onset": onset.isoformat(),
            "expected_duration_days": duration,
            "symptoms": symptoms,
            "created_at": datetime.now().isoformat(),
        }
    
    def generate_vital_signs(
        self,
        patient: Dict,
        include_abnormal: bool = False,
    ) -> Dict[str, Any]:
        """
        Generate vital signs for a patient.
        
        Args:
            patient: Patient resource
            include_abnormal: Whether to include abnormal values
            
        Returns:
            Vital signs observation
        """
        age_months = patient.get("age_months", 36)
        
        # Age-appropriate normal ranges
        if age_months < 12:  # Infant
            hr_range = (110, 160)
            rr_range = (30, 50)
            temp_range = (97.0, 99.0)
        elif age_months < 36:  # Toddler
            hr_range = (90, 150)
            rr_range = (24, 40)
            temp_range = (97.5, 99.0)
        elif age_months < 72:  # Preschool
            hr_range = (80, 120)
            rr_range = (20, 30)
            temp_range = (97.5, 99.0)
        else:  # School age
            hr_range = (70, 110)
            rr_range = (16, 24)
            temp_range = (97.5, 99.0)
        
        # Generate values
        if include_abnormal and random.random() < 0.5:
            # Generate one abnormal value
            abnormal_type = random.choice(["hr", "rr", "temp"])
            hr = random.randint(*hr_range)
            rr = random.randint(*rr_range)
            temp = round(random.uniform(*temp_range), 1)
            
            if abnormal_type == "hr":
                hr = hr_range[1] + random.randint(10, 30)  # Elevated
            elif abnormal_type == "rr":
                rr = rr_range[1] + random.randint(5, 15)  # Elevated
            else:
                temp = round(random.uniform(100.4, 103.0), 1)  # Fever
        else:
            hr = random.randint(*hr_range)
            rr = random.randint(*rr_range)
            temp = round(random.uniform(*temp_range), 1)
        
        return {
            "observation_id": str(uuid4()),
            "patient_id": patient["id"],
            "timestamp": datetime.now().isoformat(),
            "vital_signs": {
                "heart_rate": {
                    "value": hr,
                    "unit": "bpm",
                },
                "respiratory_rate": {
                    "value": rr,
                    "unit": "breaths/min",
                },
                "temperature": {
                    "value": temp,
                    "unit": "fahrenheit",
                },
            },
        }
    
    def generate_dataset(
        self,
        num_patients: int = 100,
        episodes_per_patient: int = 2,
    ) -> Dict[str, Any]:
        """
        Generate a complete dataset.
        
        Args:
            num_patients: Number of patients to generate
            episodes_per_patient: Average symptom episodes per patient
            
        Returns:
            Complete dataset with patients and episodes
        """
        patients = []
        episodes = []
        vitals = []
        
        for _ in range(num_patients):
            # Generate patient
            patient = self.generate_patient()
            patients.append(patient)
            
            # Generate symptom episodes
            num_episodes = max(0, int(random.gauss(episodes_per_patient, 1)))
            for _ in range(num_episodes):
                episode = self.generate_symptom_episode(patient)
                episodes.append(episode)
            
            # Generate vital signs
            vital = self.generate_vital_signs(patient, include_abnormal=random.random() < 0.2)
            vitals.append(vital)
        
        return {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "num_patients": num_patients,
                "num_episodes": len(episodes),
                "generator": "EPCID SyntheaGenerator v1.0",
            },
            "patients": patients,
            "episodes": episodes,
            "vitals": vitals,
        }
    
    def save_dataset(
        self,
        dataset: Dict[str, Any],
        output_path: str,
    ) -> None:
        """
        Save dataset to JSON file.
        
        Args:
            dataset: Dataset to save
            output_path: Path to output file
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, "w") as f:
            json.dump(dataset, f, indent=2)
    
    def generate_fhir_bundle(
        self,
        patient: Dict,
        episodes: List[Dict],
    ) -> Dict[str, Any]:
        """
        Generate a FHIR Bundle for a patient.
        
        Args:
            patient: Patient resource
            episodes: List of symptom episodes
            
        Returns:
            FHIR Bundle resource
        """
        entries = []
        
        # Add patient
        entries.append({
            "fullUrl": f"urn:uuid:{patient['id']}",
            "resource": patient,
        })
        
        # Add conditions
        for condition in patient.get("conditions", []):
            condition_resource = {
                "resourceType": "Condition",
                "id": str(uuid4()),
                "subject": {"reference": f"Patient/{patient['id']}"},
                "code": {
                    "coding": [
                        {
                            "system": condition["system"],
                            "code": condition["code"],
                            "display": condition["display"],
                        }
                    ]
                },
                "onsetDateTime": condition.get("onset"),
            }
            entries.append({
                "resource": condition_resource,
            })
        
        # Add observations from episodes
        for episode in episodes:
            for symptom in episode.get("symptoms", []):
                observation = {
                    "resourceType": "Observation",
                    "id": str(uuid4()),
                    "status": "final",
                    "category": [
                        {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                    "code": "survey",
                                    "display": "Survey",
                                }
                            ]
                        }
                    ],
                    "code": {
                        "text": symptom["type"],
                    },
                    "subject": {"reference": f"Patient/{patient['id']}"},
                    "effectiveDateTime": symptom.get("onset"),
                    "valueString": symptom["severity"],
                }
                
                if "measurements" in symptom:
                    observation["valueQuantity"] = symptom["measurements"]
                
                entries.append({
                    "resource": observation,
                })
        
        return {
            "resourceType": "Bundle",
            "type": "collection",
            "timestamp": datetime.now().isoformat(),
            "entry": entries,
        }


# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate synthetic pediatric data")
    parser.add_argument("--patients", type=int, default=100, help="Number of patients")
    parser.add_argument("--output", type=str, default="data/synthetic_dataset.json", help="Output file")
    parser.add_argument("--seed", type=int, help="Random seed")
    
    args = parser.parse_args()
    
    generator = SyntheaGenerator(seed=args.seed)
    dataset = generator.generate_dataset(num_patients=args.patients)
    generator.save_dataset(dataset, args.output)
    
    print(f"Generated {len(dataset['patients'])} patients with {len(dataset['episodes'])} episodes")
    print(f"Saved to {args.output}")
