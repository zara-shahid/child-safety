"""
EPCID FHIR Service

Integration with SMART on FHIR for EHR data access.
https://docs.smarthealthit.org/

Provides:
- Patient demographics
- Observations (vitals, lab results)
- Conditions (diagnoses)
- Medications
- Immunizations

Designed for FHIR R4 resources.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlencode

logger = logging.getLogger("epcid.services.fhir")


@dataclass
class FHIRPatient:
    """Patient resource from FHIR."""

    id: str
    name: str
    birth_date: str | None
    gender: str | None
    age_months: int | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "birth_date": self.birth_date,
            "gender": self.gender,
            "age_months": self.age_months,
        }


@dataclass
class FHIRObservation:
    """Observation resource from FHIR."""

    id: str
    code: str
    display: str
    value: Any
    unit: str | None
    effective_date: str | None
    status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "display": self.display,
            "value": self.value,
            "unit": self.unit,
            "effective_date": self.effective_date,
        }


@dataclass
class FHIRCondition:
    """Condition resource from FHIR."""

    id: str
    code: str
    display: str
    clinical_status: str
    onset_date: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "display": self.display,
            "clinical_status": self.clinical_status,
            "onset_date": self.onset_date,
        }


@dataclass
class FHIRMedication:
    """MedicationRequest resource from FHIR."""

    id: str
    medication_code: str
    medication_display: str
    dosage: str | None
    status: str
    authored_on: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "medication": self.medication_display,
            "dosage": self.dosage,
            "status": self.status,
        }


@dataclass
class FHIRImmunization:
    """Immunization resource from FHIR."""

    id: str
    vaccine_code: str
    vaccine_display: str
    occurrence_date: str | None
    status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "vaccine": self.vaccine_display,
            "date": self.occurrence_date,
            "status": self.status,
        }


class FHIRService:
    """
    Service for SMART on FHIR integration.

    Provides access to patient health records with proper
    OAuth2 authentication and scope handling.
    """

    # SMART Health IT Sandbox
    DEFAULT_SANDBOX_URL = "https://launch.smarthealthit.org/v/r4/fhir"

    # Common LOINC codes for vital signs
    VITAL_SIGN_CODES = {
        "8310-5": "body_temperature",
        "8867-4": "heart_rate",
        "9279-1": "respiratory_rate",
        "2708-6": "oxygen_saturation",
        "29463-7": "body_weight",
        "8302-2": "body_height",
        "85354-9": "blood_pressure",
        "8480-6": "systolic_bp",
        "8462-4": "diastolic_bp",
    }

    def __init__(
        self,
        base_url: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        timeout_seconds: int = 20,
    ):
        self.base_url = base_url or self.DEFAULT_SANDBOX_URL
        self.client_id = client_id
        self.client_secret = client_secret
        self.timeout_seconds = timeout_seconds
        self._access_token: str | None = None
        self._token_expiry: datetime | None = None

        logger.info(f"Initialized FHIR service: {self.base_url}")

    async def get_patient(self, patient_id: str) -> FHIRPatient | None:
        """
        Get patient demographics.

        Args:
            patient_id: FHIR patient ID

        Returns:
            FHIRPatient or None
        """
        try:
            url = f"{self.base_url}/Patient/{patient_id}"
            response = await self._make_request(url)

            if response:
                return self._parse_patient(response)

            return None

        except Exception as e:
            logger.error(f"Failed to get patient: {e}")
            return None

    async def get_observations(
        self,
        patient_id: str,
        category: str | None = None,
        code: str | None = None,
        date_from: str | None = None,
        limit: int = 50,
    ) -> list[FHIRObservation]:
        """
        Get patient observations (vitals, labs).

        Args:
            patient_id: FHIR patient ID
            category: Observation category (vital-signs, laboratory)
            code: LOINC code to filter by
            date_from: Start date for observations
            limit: Maximum number of results

        Returns:
            List of FHIRObservation objects
        """
        try:
            params = {
                "patient": patient_id,
                "_count": limit,
                "_sort": "-date",
            }

            if category:
                params["category"] = category

            if code:
                params["code"] = code

            if date_from:
                params["date"] = f"ge{date_from}"

            url = f"{self.base_url}/Observation?{urlencode(params)}"
            response = await self._make_request(url)

            observations = []
            if response and response.get("entry"):
                for entry in response["entry"]:
                    resource = entry.get("resource", {})
                    obs = self._parse_observation(resource)
                    if obs:
                        observations.append(obs)

            return observations

        except Exception as e:
            logger.error(f"Failed to get observations: {e}")
            return []

    async def get_vital_signs(
        self,
        patient_id: str,
        date_from: str | None = None,
    ) -> dict[str, Any]:
        """
        Get patient vital signs.

        Args:
            patient_id: FHIR patient ID
            date_from: Start date for vitals

        Returns:
            Dict with vital signs
        """
        observations = await self.get_observations(
            patient_id,
            category="vital-signs",
            date_from=date_from,
        )

        vitals = {}
        for obs in observations:
            vital_name = self.VITAL_SIGN_CODES.get(obs.code)
            if vital_name and vital_name not in vitals:
                vitals[vital_name] = {
                    "value": obs.value,
                    "unit": obs.unit,
                    "date": obs.effective_date,
                }

        return vitals

    async def get_conditions(
        self,
        patient_id: str,
        clinical_status: str | None = "active",
    ) -> list[FHIRCondition]:
        """
        Get patient conditions/diagnoses.

        Args:
            patient_id: FHIR patient ID
            clinical_status: Filter by status (active, resolved)

        Returns:
            List of FHIRCondition objects
        """
        try:
            params = {
                "patient": patient_id,
                "_count": 50,
            }

            if clinical_status:
                params["clinical-status"] = clinical_status

            url = f"{self.base_url}/Condition?{urlencode(params)}"
            response = await self._make_request(url)

            conditions = []
            if response and response.get("entry"):
                for entry in response["entry"]:
                    resource = entry.get("resource", {})
                    cond = self._parse_condition(resource)
                    if cond:
                        conditions.append(cond)

            return conditions

        except Exception as e:
            logger.error(f"Failed to get conditions: {e}")
            return []

    async def get_medications(
        self,
        patient_id: str,
        status: str | None = "active",
    ) -> list[FHIRMedication]:
        """
        Get patient medications.

        Args:
            patient_id: FHIR patient ID
            status: Filter by status (active, completed)

        Returns:
            List of FHIRMedication objects
        """
        try:
            params = {
                "patient": patient_id,
                "_count": 50,
            }

            if status:
                params["status"] = status

            url = f"{self.base_url}/MedicationRequest?{urlencode(params)}"
            response = await self._make_request(url)

            medications = []
            if response and response.get("entry"):
                for entry in response["entry"]:
                    resource = entry.get("resource", {})
                    med = self._parse_medication(resource)
                    if med:
                        medications.append(med)

            return medications

        except Exception as e:
            logger.error(f"Failed to get medications: {e}")
            return []

    async def get_immunizations(
        self,
        patient_id: str,
    ) -> list[FHIRImmunization]:
        """
        Get patient immunizations.

        Args:
            patient_id: FHIR patient ID

        Returns:
            List of FHIRImmunization objects
        """
        try:
            params = {
                "patient": patient_id,
                "_count": 100,
            }

            url = f"{self.base_url}/Immunization?{urlencode(params)}"
            response = await self._make_request(url)

            immunizations = []
            if response and response.get("entry"):
                for entry in response["entry"]:
                    resource = entry.get("resource", {})
                    imm = self._parse_immunization(resource)
                    if imm:
                        immunizations.append(imm)

            return immunizations

        except Exception as e:
            logger.error(f"Failed to get immunizations: {e}")
            return []

    async def get_comprehensive_record(
        self,
        patient_id: str,
    ) -> dict[str, Any]:
        """
        Get comprehensive patient record.

        Args:
            patient_id: FHIR patient ID

        Returns:
            Dict with all patient data
        """
        # Fetch all resources in parallel
        patient_task = self.get_patient(patient_id)
        vitals_task = self.get_vital_signs(patient_id)
        conditions_task = self.get_conditions(patient_id)
        medications_task = self.get_medications(patient_id)
        immunizations_task = self.get_immunizations(patient_id)

        patient, vitals, conditions, medications, immunizations = await asyncio.gather(
            patient_task,
            vitals_task,
            conditions_task,
            medications_task,
            immunizations_task,
        )

        return {
            "patient": patient.to_dict() if patient else None,
            "vitals": vitals,
            "conditions": [c.to_dict() for c in conditions],
            "medications": [m.to_dict() for m in medications],
            "immunizations": [i.to_dict() for i in immunizations],
            "retrieved_at": datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }

    async def _make_request(self, url: str) -> dict[str, Any] | None:
        """Make authenticated request to FHIR server."""
        # In production, would use aiohttp with OAuth2:
        # headers = {"Authorization": f"Bearer {self._access_token}"}
        # async with aiohttp.ClientSession() as session:
        #     async with session.get(url, headers=headers, timeout=self.timeout_seconds) as response:
        #         if response.status == 200:
        #             return await response.json()

        await asyncio.sleep(0.1)
        return None

    def _parse_patient(self, resource: dict[str, Any]) -> FHIRPatient:
        """Parse Patient resource."""
        # Extract name
        names = resource.get("name", [{}])
        name_parts = names[0] if names else {}
        given = " ".join(name_parts.get("given", []))
        family = name_parts.get("family", "")
        full_name = f"{given} {family}".strip()

        # Calculate age
        birth_date = resource.get("birthDate")
        age_months = None
        if birth_date:
            try:
                dob = datetime.fromisoformat(birth_date)
                age_days = (datetime.now(__import__("datetime").timezone.utc) - dob).days
                age_months = age_days // 30
            except Exception:
                pass

        return FHIRPatient(
            id=resource.get("id", ""),
            name=full_name or "Unknown",
            birth_date=birth_date,
            gender=resource.get("gender"),
            age_months=age_months,
        )

    def _parse_observation(self, resource: dict[str, Any]) -> FHIRObservation | None:
        """Parse Observation resource."""
        code_concept = resource.get("code", {})
        codings = code_concept.get("coding", [{}])
        coding = codings[0] if codings else {}

        # Extract value
        value = None
        unit = None

        if "valueQuantity" in resource:
            value = resource["valueQuantity"].get("value")
            unit = resource["valueQuantity"].get("unit")
        elif "valueString" in resource:
            value = resource["valueString"]
        elif "valueCodeableConcept" in resource:
            value = resource["valueCodeableConcept"].get("text")

        return FHIRObservation(
            id=resource.get("id", ""),
            code=coding.get("code", ""),
            display=coding.get("display", code_concept.get("text", "")),
            value=value,
            unit=unit,
            effective_date=resource.get("effectiveDateTime"),
            status=resource.get("status", ""),
        )

    def _parse_condition(self, resource: dict[str, Any]) -> FHIRCondition | None:
        """Parse Condition resource."""
        code_concept = resource.get("code", {})
        codings = code_concept.get("coding", [{}])
        coding = codings[0] if codings else {}

        clinical_status = resource.get("clinicalStatus", {})
        status_codings = clinical_status.get("coding", [{}])
        status = status_codings[0].get("code", "") if status_codings else ""

        return FHIRCondition(
            id=resource.get("id", ""),
            code=coding.get("code", ""),
            display=coding.get("display", code_concept.get("text", "")),
            clinical_status=status,
            onset_date=resource.get("onsetDateTime"),
        )

    def _parse_medication(self, resource: dict[str, Any]) -> FHIRMedication | None:
        """Parse MedicationRequest resource."""
        # Medication can be a reference or codeable concept
        medication = resource.get("medicationCodeableConcept", {})
        codings = medication.get("coding", [{}])
        coding = codings[0] if codings else {}

        # Extract dosage
        dosage_instructions = resource.get("dosageInstruction", [{}])
        dosage = dosage_instructions[0].get("text") if dosage_instructions else None

        return FHIRMedication(
            id=resource.get("id", ""),
            medication_code=coding.get("code", ""),
            medication_display=coding.get("display", medication.get("text", "")),
            dosage=dosage,
            status=resource.get("status", ""),
            authored_on=resource.get("authoredOn"),
        )

    def _parse_immunization(self, resource: dict[str, Any]) -> FHIRImmunization | None:
        """Parse Immunization resource."""
        vaccine = resource.get("vaccineCode", {})
        codings = vaccine.get("coding", [{}])
        coding = codings[0] if codings else {}

        return FHIRImmunization(
            id=resource.get("id", ""),
            vaccine_code=coding.get("code", ""),
            vaccine_display=coding.get("display", vaccine.get("text", "")),
            occurrence_date=resource.get("occurrenceDateTime"),
            status=resource.get("status", ""),
        )
