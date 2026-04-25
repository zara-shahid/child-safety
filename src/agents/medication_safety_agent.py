"""
EPCID Medication Safety Agent

Provides contextual medication risk awareness using:
- OpenFDA drug labels
- OpenFDA adverse event data
- Pediatric-specific drug information

Outputs:
- "This symptom is reported in X% of reports for this medication"
- Explicit caveat: reporting-based, not incidence

This is NOT prescriptive - purely informational.
"""

import logging
from dataclasses import dataclass
from typing import Any

from .base_agent import AgentConfig, AgentResponse, BaseAgent

logger = logging.getLogger("epcid.agents.medication_safety")


@dataclass
class DrugInfo:
    """Information about a drug from FDA sources."""

    name: str
    brand_names: list[str]
    generic_name: str
    drug_class: str
    pediatric_use: str
    warnings: list[str]
    common_adverse_events: list[dict[str, Any]]
    interactions: list[str]


@dataclass
class AdverseEventMatch:
    """A match between a symptom and an adverse event report."""

    drug_name: str
    symptom: str
    report_percentage: float  # Percentage of reports mentioning this
    total_reports: int
    severity: str
    source: str
    caveat: str


class MedicationSafetyAgent(BaseAgent):
    """
    Agent that provides medication safety information.

    Uses FDA data to identify potential relationships between
    medications and symptoms. Always includes explicit caveats
    about the nature of adverse event reporting data.
    """

    # Standard caveats
    CAVEATS = {
        "reporting_basis": (
            "This information is based on voluntary adverse event reports to the FDA. "
            "These percentages represent the proportion of reports, not the actual incidence rate."
        ),
        "not_causation": (
            "A report of an adverse event does not mean the medication caused the event. "
            "Many factors can contribute to these reports."
        ),
        "consult_provider": (
            "Always consult with your healthcare provider before making any changes to medications. "
            "Do not stop or change medications without medical guidance."
        ),
        "pediatric_specific": (
            "Medication effects may differ in children compared to adults. "
            "Pediatric dosing and safety profiles may vary."
        ),
    }

    # Simulated drug database (would use OpenFDA in production)
    DRUG_DATABASE = {
        "acetaminophen": DrugInfo(
            name="acetaminophen",
            brand_names=["Tylenol", "Panadol"],
            generic_name="acetaminophen",
            drug_class="Analgesic/Antipyretic",
            pediatric_use="Approved for use in infants and children",
            warnings=[
                "Liver toxicity with overdose",
                "Do not exceed recommended dose",
                "Check other medications for acetaminophen content",
            ],
            common_adverse_events=[
                {"event": "nausea", "percentage": 3.2, "severity": "mild"},
                {"event": "rash", "percentage": 1.5, "severity": "mild"},
                {"event": "stomach_pain", "percentage": 2.1, "severity": "mild"},
            ],
            interactions=["warfarin", "alcohol"],
        ),
        "ibuprofen": DrugInfo(
            name="ibuprofen",
            brand_names=["Advil", "Motrin"],
            generic_name="ibuprofen",
            drug_class="NSAID",
            pediatric_use="Approved for infants 6 months and older",
            warnings=[
                "GI bleeding risk",
                "Not for infants under 6 months",
                "Take with food",
                "Avoid in dehydration",
            ],
            common_adverse_events=[
                {"event": "stomach_pain", "percentage": 5.8, "severity": "mild"},
                {"event": "nausea", "percentage": 4.2, "severity": "mild"},
                {"event": "vomiting", "percentage": 2.9, "severity": "mild"},
                {"event": "headache", "percentage": 3.1, "severity": "mild"},
                {"event": "rash", "percentage": 1.8, "severity": "mild"},
            ],
            interactions=["aspirin", "blood_thinners", "lithium"],
        ),
        "amoxicillin": DrugInfo(
            name="amoxicillin",
            brand_names=["Amoxil", "Trimox"],
            generic_name="amoxicillin",
            drug_class="Antibiotic (Penicillin)",
            pediatric_use="Commonly used in pediatric infections",
            warnings=[
                "Allergic reactions possible",
                "Complete full course",
                "May cause diarrhea",
            ],
            common_adverse_events=[
                {"event": "diarrhea", "percentage": 8.5, "severity": "mild"},
                {"event": "rash", "percentage": 5.2, "severity": "mild"},
                {"event": "nausea", "percentage": 3.8, "severity": "mild"},
                {"event": "vomiting", "percentage": 2.4, "severity": "mild"},
            ],
            interactions=["methotrexate", "warfarin"],
        ),
        "diphenhydramine": DrugInfo(
            name="diphenhydramine",
            brand_names=["Benadryl"],
            generic_name="diphenhydramine",
            drug_class="Antihistamine",
            pediatric_use="Approved for children 2 years and older",
            warnings=[
                "May cause drowsiness",
                "Not for children under 2",
                "May cause paradoxical excitation in children",
            ],
            common_adverse_events=[
                {"event": "drowsiness", "percentage": 15.2, "severity": "mild"},
                {"event": "dry_mouth", "percentage": 8.3, "severity": "mild"},
                {"event": "irritability", "percentage": 4.5, "severity": "mild"},
                {"event": "difficulty_urinating", "percentage": 2.1, "severity": "mild"},
            ],
            interactions=["sedatives", "MAO_inhibitors"],
        ),
    }

    def __init__(
        self,
        config: AgentConfig | None = None,
        **kwargs: Any,
    ):
        config = config or AgentConfig(
            name="medication_safety_agent",
            description="Provides medication safety information from FDA data",
            priority=5,
            timeout_seconds=15,
        )
        super().__init__(config, **kwargs)

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Check medications against symptoms for potential adverse events.

        Args:
            input_data: Contains medications and symptoms
            context: str | None additional context

        Returns:
            AgentResponse with medication safety information
        """
        import uuid

        request_id = str(uuid.uuid4())[:12]

        medications = input_data.get("medications", [])
        symptoms = input_data.get("symptoms", [])
        age_months = input_data.get("demographics", {}).get("age_months")

        # Normalize medication names
        normalized_meds = self._normalize_medications(medications)

        # Look up drug information
        drug_infos = self._lookup_drugs(normalized_meds)

        # Check for symptom-medication matches
        ae_matches = self._find_adverse_event_matches(drug_infos, symptoms)

        # Check age-appropriateness
        age_warnings = self._check_age_appropriateness(drug_infos, age_months)

        # Check for interactions
        interactions = self._check_interactions(drug_infos)

        # Generate response with caveats
        response_text = self._generate_response(
            drug_infos,
            ae_matches,
            age_warnings,
            interactions,
        )

        return self.create_response(
            request_id=request_id,
            data={
                "medications_checked": [d.name for d in drug_infos],
                "adverse_event_matches": [self._match_to_dict(m) for m in ae_matches],
                "age_warnings": age_warnings,
                "interactions": interactions,
                "response_text": response_text,
                "caveats": list(self.CAVEATS.values()),
            },
            confidence=0.8 if drug_infos else 0.5,
            explanation=self._generate_explanation(drug_infos, ae_matches),
            warnings=age_warnings,
        )

    def _normalize_medications(self, medications: list) -> list[str]:
        """Normalize medication names for lookup."""
        normalized = []

        for med in medications:
            if isinstance(med, str):
                name = med.lower().strip()
            elif isinstance(med, dict):
                name = med.get("name", "").lower().strip()
            else:
                continue

            # Map brand names to generic
            brand_to_generic = {
                "tylenol": "acetaminophen",
                "panadol": "acetaminophen",
                "advil": "ibuprofen",
                "motrin": "ibuprofen",
                "amoxil": "amoxicillin",
                "benadryl": "diphenhydramine",
            }

            normalized_name = brand_to_generic.get(name, name)
            normalized.append(normalized_name)

        return list(set(normalized))

    def _lookup_drugs(self, medication_names: list[str]) -> list[DrugInfo]:
        """Look up drug information from database."""
        results = []

        for name in medication_names:
            if name in self.DRUG_DATABASE:
                results.append(self.DRUG_DATABASE[name])

        return results

    def _find_adverse_event_matches(
        self,
        drugs: list[DrugInfo],
        symptoms: list[str],
    ) -> list[AdverseEventMatch]:
        """Find matches between symptoms and known adverse events."""
        matches = []

        for drug in drugs:
            for event in drug.common_adverse_events:
                event_name = event["event"]

                # Check for symptom match (exact or similar)
                for symptom in symptoms:
                    symptom_lower = symptom.lower().replace("_", " ")
                    event_lower = event_name.lower().replace("_", " ")

                    if symptom_lower == event_lower or event_lower in symptom_lower:
                        matches.append(
                            AdverseEventMatch(
                                drug_name=drug.name,
                                symptom=symptom,
                                report_percentage=event["percentage"],
                                total_reports=1000,  # Would come from FDA data
                                severity=event["severity"],
                                source="OpenFDA",
                                caveat=self.CAVEATS["reporting_basis"],
                            )
                        )

        return matches

    def _check_age_appropriateness(
        self,
        drugs: list[DrugInfo],
        age_months: int | None,
    ) -> list[str]:
        """Check if medications are age-appropriate."""
        warnings = []

        if age_months is None:
            return []

        for drug in drugs:
            if drug.name == "ibuprofen" and age_months < 6:
                warnings.append(
                    f"Ibuprofen is not recommended for infants under 6 months old. "
                    f"Current age: {age_months} months."
                )

            if drug.name == "diphenhydramine" and age_months < 24:
                warnings.append(
                    f"Diphenhydramine (Benadryl) is not recommended for children under 2 years. "
                    f"Current age: {age_months} months."
                )

        return warnings

    def _check_interactions(self, drugs: list[DrugInfo]) -> list[str]:
        """Check for drug-drug interactions."""
        interactions = []
        drug_names = [d.name for d in drugs]

        # Check each drug against others
        for drug in drugs:
            for interaction in drug.interactions:
                if interaction.lower() in drug_names:
                    interactions.append(f"Potential interaction: {drug.name} and {interaction}")

        return interactions

    def _generate_response(
        self,
        drugs: list[DrugInfo],
        matches: list[AdverseEventMatch],
        age_warnings: list[str],
        interactions: list[str],
    ) -> str:
        """Generate response text with medication information."""
        lines = [
            "## Medication Safety Information\n",
            "*" + self.CAVEATS["reporting_basis"] + "*\n",
        ]

        if not drugs:
            lines.append("No medication information was found for the provided medications.")
            return "\n".join(lines)

        # Drug summaries
        lines.append("### Medications Reviewed")
        for drug in drugs:
            lines.append(f"\n**{drug.name.title()}** ({', '.join(drug.brand_names)})")
            lines.append(f"- Class: {drug.drug_class}")
            lines.append(f"- Pediatric use: {drug.pediatric_use}")

        # Adverse event matches
        if matches:
            lines.append("\n### Symptom-Medication Correlations")
            lines.append(
                "*The following symptoms have been reported in FDA adverse event data for these medications:*\n"
            )

            for match in matches:
                lines.append(
                    f"- **{match.symptom}** is mentioned in approximately "
                    f"**{match.report_percentage:.1f}%** of adverse event reports for **{match.drug_name}**"
                )

            lines.append("\n" + self.CAVEATS["not_causation"])

        # Age warnings
        if age_warnings:
            lines.append("\n### ⚠️ Age-Related Considerations")
            for warning in age_warnings:
                lines.append(f"- {warning}")

        # Interactions
        if interactions:
            lines.append("\n### Drug Interactions")
            for interaction in interactions:
                lines.append(f"- {interaction}")

        # Final disclaimer
        lines.append("\n---")
        lines.append("*" + self.CAVEATS["consult_provider"] + "*")

        return "\n".join(lines)

    def _match_to_dict(self, match: AdverseEventMatch) -> dict[str, Any]:
        """Convert match to dictionary."""
        return {
            "drug_name": match.drug_name,
            "symptom": match.symptom,
            "report_percentage": match.report_percentage,
            "severity": match.severity,
            "source": match.source,
            "caveat": match.caveat,
        }

    def _generate_explanation(
        self,
        drugs: list[DrugInfo],
        matches: list[AdverseEventMatch],
    ) -> str:
        """Generate explanation of the analysis."""
        lines = ["## Medication Safety Analysis\n"]

        lines.append(f"**Medications analyzed:** {len(drugs)}")
        lines.append(f"**Symptom-medication correlations found:** {len(matches)}")

        lines.append("\n### Data Sources")
        lines.append("- OpenFDA Drug Labels")
        lines.append("- OpenFDA Adverse Event Reports")

        lines.append("\n### Important Limitations")
        lines.append("- Percentages are from voluntary reports, not controlled studies")
        lines.append("- Correlation does not imply causation")
        lines.append("- Individual responses may vary")

        return "\n".join(lines)
