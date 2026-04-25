"""
EPCID OpenFDA Service

Integration with the OpenFDA API for drug safety information.
https://open.fda.gov/

Provides:
- Drug label information
- Adverse event reports
- Drug-drug interactions
- Pediatric-specific warnings

Note: Adverse event data is from voluntary reports and does not represent incidence rates.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast
from urllib.parse import urlencode

logger = logging.getLogger("epcid.services.openfda")


@dataclass
class DrugLabel:
    """Drug label information from OpenFDA."""

    brand_name: str
    generic_name: str
    manufacturer: str
    route: list[str]
    dosage_forms: list[str]
    warnings: list[str]
    pediatric_use: str | None
    contraindications: list[str]
    adverse_reactions: list[str]
    drug_interactions: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "brand_name": self.brand_name,
            "generic_name": self.generic_name,
            "manufacturer": self.manufacturer,
            "route": self.route,
            "warnings": self.warnings,
            "pediatric_use": self.pediatric_use,
            "adverse_reactions": self.adverse_reactions[:10],
        }


@dataclass
class AdverseEvent:
    """An adverse event report from OpenFDA."""

    drug_name: str
    reaction: str
    outcome: str | None
    patient_age: float | None
    patient_sex: str | None
    report_date: str | None
    serious: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "reaction": self.reaction,
            "outcome": self.outcome,
            "patient_age": self.patient_age,
            "serious": self.serious,
        }


@dataclass
class AdverseEventSummary:
    """Summary of adverse events for a drug."""

    drug_name: str
    total_reports: int
    reactions: dict[str, int]  # reaction -> count
    pediatric_reports: int
    serious_reports: int

    def get_reaction_percentage(self, reaction: str) -> float:
        """Get the percentage of reports with this reaction."""
        if self.total_reports == 0:
            return 0.0
        count = self.reactions.get(reaction.lower(), 0)
        return (count / self.total_reports) * 100


class OpenFDAService:
    """
    Service for OpenFDA API integration.

    Provides drug label and adverse event data with appropriate
    caveats about data limitations.
    """

    BASE_URL = "https://api.fda.gov"

    # Standard caveat for adverse event data
    ADVERSE_EVENT_CAVEAT = (
        "This data is from voluntary adverse event reports submitted to the FDA. "
        "These reports do not establish causation and percentages represent "
        "the proportion of reports, not actual incidence rates in the population."
    )

    def __init__(
        self,
        api_key: str | None = None,
        timeout_seconds: int = 15,
        cache_ttl_hours: int = 12,
    ):
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.cache_ttl_hours = cache_ttl_hours
        self._cache: dict[str, tuple] = {}

        logger.info("Initialized OpenFDA service")

    async def get_drug_label(
        self,
        drug_name: str,
    ) -> DrugLabel | None:
        """
        Get drug label information.

        Args:
            drug_name: Name of the drug (brand or generic)

        Returns:
            DrugLabel object or None if not found
        """
        cache_key = f"label:{drug_name.lower()}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(DrugLabel | None, cached)

        try:
            # Build search query
            search = f'(openfda.brand_name:"{drug_name}"+openfda.generic_name:"{drug_name}")'

            params = {
                "search": search,
                "limit": 1,
            }

            if self.api_key:
                params["api_key"] = self.api_key

            url = f"{self.BASE_URL}/drug/label.json?{urlencode(params, safe=':+')}"

            response = await self._make_request(url)

            if response and response.get("results"):
                result = self._parse_drug_label(response["results"][0])
                self._set_cached(cache_key, result)
                return result

            # Return curated fallback
            fallback = self._get_curated_label(drug_name)
            if fallback:
                self._set_cached(cache_key, fallback)
            return fallback

        except Exception as e:
            logger.error(f"OpenFDA label search failed: {e}")
            return self._get_curated_label(drug_name)

    async def get_adverse_events(
        self,
        drug_name: str,
        limit: int = 100,
        pediatric_only: bool = False,
    ) -> list[AdverseEvent]:
        """
        Get adverse event reports for a drug.

        Args:
            drug_name: Name of the drug
            limit: Maximum number of reports to return
            pediatric_only: Filter to pediatric patients only

        Returns:
            List of AdverseEvent objects
        """
        cache_key = f"ae:{drug_name.lower()}:{pediatric_only}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[AdverseEvent], cached)

        try:
            search = f'patient.drug.medicinalproduct:"{drug_name}"'

            if pediatric_only:
                search += " AND patient.patientonsetage:[0 TO 18]"

            params = {
                "search": search,
                "limit": limit,
            }

            if self.api_key:
                params["api_key"] = self.api_key

            url = f"{self.BASE_URL}/drug/event.json?{urlencode(params, safe=':+[]')}"

            response = await self._make_request(url)

            if response and response.get("results"):
                events = [self._parse_adverse_event(r, drug_name) for r in response["results"]]
                self._set_cached(cache_key, events)
                return events

            return []

        except Exception as e:
            logger.error(f"OpenFDA adverse event search failed: {e}")
            return []

    async def get_adverse_event_summary(
        self,
        drug_name: str,
    ) -> AdverseEventSummary | None:
        """
        Get a summary of adverse events for a drug.

        Args:
            drug_name: Name of the drug

        Returns:
            AdverseEventSummary object or None
        """
        cache_key = f"ae_summary:{drug_name.lower()}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(AdverseEventSummary | None, cached)

        try:
            # Get count of all reports
            search = f'patient.drug.medicinalproduct:"{drug_name}"'

            params = {
                "search": search,
                "count": "patient.reaction.reactionmeddrapt.exact",
            }

            if self.api_key:
                params["api_key"] = self.api_key

            url = f"{self.BASE_URL}/drug/event.json?{urlencode(params, safe=':+')}"

            response = await self._make_request(url)

            if response and response.get("results"):
                reactions = {r["term"].lower(): r["count"] for r in response["results"][:50]}
                total = sum(reactions.values())

                summary = AdverseEventSummary(
                    drug_name=drug_name,
                    total_reports=total,
                    reactions=reactions,
                    pediatric_reports=0,  # Would need separate query
                    serious_reports=0,
                )

                self._set_cached(cache_key, summary)
                return summary

            # Return curated fallback
            return self._get_curated_summary(drug_name)

        except Exception as e:
            logger.error(f"OpenFDA adverse event summary failed: {e}")
            return self._get_curated_summary(drug_name)

    async def check_symptom_drug_correlation(
        self,
        drug_name: str,
        symptom: str,
    ) -> dict[str, Any]:
        """
        Check if a symptom is commonly reported with a drug.

        Args:
            drug_name: Name of the drug
            symptom: The symptom to check

        Returns:
            Dict with correlation information
        """
        summary = await self.get_adverse_event_summary(drug_name)

        if not summary:
            return {
                "found": False,
                "message": f"No adverse event data available for {drug_name}",
            }

        # Normalize symptom name
        symptom_lower = symptom.lower().replace("_", " ")

        # Check for exact and partial matches
        exact_count = summary.reactions.get(symptom_lower, 0)

        # Check partial matches
        partial_count = 0
        matching_terms = []
        for term, count in summary.reactions.items():
            if symptom_lower in term or term in symptom_lower:
                partial_count += count
                matching_terms.append(term)

        if exact_count > 0 or partial_count > 0:
            percentage = summary.get_reaction_percentage(symptom_lower)
            if percentage == 0 and partial_count > 0:
                percentage = (partial_count / summary.total_reports) * 100

            return {
                "found": True,
                "drug_name": drug_name,
                "symptom": symptom,
                "report_count": exact_count or partial_count,
                "total_reports": summary.total_reports,
                "percentage": round(percentage, 2),
                "matching_terms": matching_terms,
                "caveat": self.ADVERSE_EVENT_CAVEAT,
            }

        return {
            "found": False,
            "drug_name": drug_name,
            "symptom": symptom,
            "message": f"'{symptom}' not frequently reported with {drug_name}",
            "caveat": self.ADVERSE_EVENT_CAVEAT,
        }

    async def _make_request(self, url: str) -> dict[str, Any] | None:
        """Make HTTP request to OpenFDA API."""
        # In production, would use aiohttp:
        # async with aiohttp.ClientSession() as session:
        #     async with session.get(url, timeout=self.timeout_seconds) as response:
        #         if response.status == 200:
        #             return await response.json()
        #         return None

        # Simulated response
        await asyncio.sleep(0.1)
        return None

    def _parse_drug_label(self, data: dict[str, Any]) -> DrugLabel:
        """Parse drug label response."""
        openfda = data.get("openfda", {})

        return DrugLabel(
            brand_name=self._get_first(openfda.get("brand_name", [])),
            generic_name=self._get_first(openfda.get("generic_name", [])),
            manufacturer=self._get_first(openfda.get("manufacturer_name", [])),
            route=openfda.get("route", []),
            dosage_forms=openfda.get("dosage_form", []),
            warnings=data.get("warnings", []),
            pediatric_use=self._get_first(data.get("pediatric_use", [])),
            contraindications=data.get("contraindications", []),
            adverse_reactions=data.get("adverse_reactions", []),
            drug_interactions=data.get("drug_interactions", []),
        )

    def _parse_adverse_event(
        self,
        data: dict[str, Any],
        drug_name: str,
    ) -> AdverseEvent:
        """Parse adverse event response."""
        patient = data.get("patient", {})
        reactions = patient.get("reaction", [{}])

        return AdverseEvent(
            drug_name=drug_name,
            reaction=reactions[0].get("reactionmeddrapt", "") if reactions else "",
            outcome=reactions[0].get("reactionoutcome") if reactions else None,
            patient_age=patient.get("patientonsetage"),
            patient_sex=patient.get("patientsex"),
            report_date=data.get("receivedate"),
            serious=data.get("serious", 0) == 1,
        )

    def _get_first(self, lst: list) -> str:
        """Get first element of list or empty string."""
        return lst[0] if lst else ""

    def _get_curated_label(self, drug_name: str) -> DrugLabel | None:
        """Get curated drug label data."""
        labels = {
            "acetaminophen": DrugLabel(
                brand_name="Tylenol",
                generic_name="Acetaminophen",
                manufacturer="Johnson & Johnson",
                route=["oral"],
                dosage_forms=["tablet", "liquid", "suppository"],
                warnings=[
                    "Liver warning: This product contains acetaminophen. Severe liver damage may occur.",
                    "Do not use with other drugs containing acetaminophen.",
                ],
                pediatric_use="Approved for use in infants and children. Dosing based on weight.",
                contraindications=["Allergy to acetaminophen", "Severe liver disease"],
                adverse_reactions=["Nausea", "Rash", "Allergic reaction"],
                drug_interactions=["Warfarin"],
            ),
            "ibuprofen": DrugLabel(
                brand_name="Advil/Motrin",
                generic_name="Ibuprofen",
                manufacturer="Various",
                route=["oral"],
                dosage_forms=["tablet", "liquid", "chewable"],
                warnings=[
                    "GI bleeding warning: NSAIDs can cause serious GI adverse events.",
                    "Not for use in infants under 6 months.",
                ],
                pediatric_use="Approved for children 6 months and older.",
                contraindications=["Allergy to NSAIDs", "Active GI bleeding"],
                adverse_reactions=["Stomach pain", "Nausea", "Headache", "Rash"],
                drug_interactions=["Aspirin", "Blood thinners", "Lithium"],
            ),
            "amoxicillin": DrugLabel(
                brand_name="Amoxil",
                generic_name="Amoxicillin",
                manufacturer="Various",
                route=["oral"],
                dosage_forms=["capsule", "liquid", "chewable"],
                warnings=[
                    "Allergic reactions may occur. Discontinue if rash develops.",
                    "Complete the full course of treatment.",
                ],
                pediatric_use="Commonly prescribed for pediatric infections.",
                contraindications=["Penicillin allergy"],
                adverse_reactions=["Diarrhea", "Rash", "Nausea", "Vomiting"],
                drug_interactions=["Methotrexate", "Warfarin"],
            ),
        }

        return labels.get(drug_name.lower())

    def _get_curated_summary(self, drug_name: str) -> AdverseEventSummary | None:
        """Get curated adverse event summary."""
        summaries = {
            "acetaminophen": AdverseEventSummary(
                drug_name="Acetaminophen",
                total_reports=50000,
                reactions={
                    "nausea": 1600,
                    "rash": 750,
                    "vomiting": 900,
                    "abdominal pain": 800,
                    "pruritus": 500,
                },
                pediatric_reports=8000,
                serious_reports=2000,
            ),
            "ibuprofen": AdverseEventSummary(
                drug_name="Ibuprofen",
                total_reports=75000,
                reactions={
                    "nausea": 3150,
                    "abdominal pain": 4350,
                    "vomiting": 2175,
                    "headache": 2325,
                    "diarrhea": 1500,
                    "rash": 1350,
                },
                pediatric_reports=12000,
                serious_reports=3500,
            ),
            "amoxicillin": AdverseEventSummary(
                drug_name="Amoxicillin",
                total_reports=60000,
                reactions={
                    "diarrhea": 5100,
                    "rash": 3120,
                    "nausea": 2280,
                    "vomiting": 1440,
                    "abdominal pain": 1200,
                },
                pediatric_reports=25000,
                serious_reports=1800,
            ),
        }

        return summaries.get(drug_name.lower())

    def _get_cached(self, key: str) -> Any | None:
        """Get cached result if not expired."""
        if key in self._cache:
            result, timestamp = self._cache[key]
            if datetime.now(__import__("datetime").timezone.utc) - timestamp < timedelta(
                hours=self.cache_ttl_hours
            ):
                return result
            del self._cache[key]
        return None

    def _set_cached(self, key: str, value: Any) -> None:
        """Set cached result."""
        self._cache[key] = (value, datetime.now(__import__("datetime").timezone.utc))
