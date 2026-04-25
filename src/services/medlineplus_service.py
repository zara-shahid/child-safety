"""
EPCID MedlinePlus Service

Integration with the MedlinePlus Connect API for health education content.
https://medlineplus.gov/connect/overview.html

Provides:
- Condition information
- Lab test information
- Medication information
- Health topics

All content is from the National Library of Medicine (NLM).
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast
from urllib.parse import urlencode

logger = logging.getLogger("epcid.services.medlineplus")


@dataclass
class MedlinePlusResult:
    """A result from MedlinePlus."""

    title: str
    url: str
    summary: str
    source: str
    language: str
    topic_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "url": self.url,
            "summary": self.summary,
            "source": self.source,
            "language": self.language,
            "topic_id": self.topic_id,
        }


class MedlinePlusService:
    """
    Service for MedlinePlus Connect API integration.

    MedlinePlus Connect provides patient education materials linked
    to clinical data (diagnoses, labs, medications).
    """

    BASE_URL = "https://connect.medlineplus.gov/service"

    # Common ICD-10 codes for pediatric conditions
    COMMON_PEDIATRIC_CODES = {
        "fever": "R50.9",
        "cough": "R05",
        "vomiting": "R11.10",
        "diarrhea": "R19.7",
        "rash": "R21",
        "ear_pain": "H92.09",
        "sore_throat": "J02.9",
        "headache": "R51",
        "abdominal_pain": "R10.9",
        "wheezing": "R06.2",
        "difficulty_breathing": "R06.00",
    }

    def __init__(
        self,
        timeout_seconds: int = 10,
        cache_ttl_hours: int = 24,
    ):
        self.timeout_seconds = timeout_seconds
        self.cache_ttl_hours = cache_ttl_hours
        self._cache: dict[str, tuple] = {}  # key -> (result, timestamp)

        logger.info("Initialized MedlinePlus service")

    async def search_by_code(
        self,
        code: str,
        code_system: str = "ICD-10-CM",
        language: str = "en",
    ) -> list[MedlinePlusResult]:
        """
        Search MedlinePlus by medical code (ICD-10, SNOMED, etc.).

        Args:
            code: The medical code (e.g., "R50.9" for fever)
            code_system: The coding system (default: ICD-10-CM)
            language: Language for results (default: English)

        Returns:
            List of MedlinePlusResult objects
        """
        cache_key = f"code:{code_system}:{code}:{language}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[MedlinePlusResult], cached)

        try:
            # Build URL
            params = {
                "mainSearchCriteria.v.cs": self._get_code_system_oid(code_system),
                "mainSearchCriteria.v.c": code,
                "informationRecipient.languageCode.c": language,
                "knowledgeResponseType": "application/json",
            }

            url = f"{self.BASE_URL}?{urlencode(params)}"

            # Make request (simulated for now - would use aiohttp in production)
            results = await self._make_request(url)

            # Parse results
            parsed = self._parse_response(results)

            # Cache results
            self._set_cached(cache_key, parsed)

            return parsed

        except Exception as e:
            logger.error(f"MedlinePlus search failed: {e}")
            return []

    async def search_by_symptom(
        self,
        symptom: str,
        language: str = "en",
    ) -> list[MedlinePlusResult]:
        """
        Search MedlinePlus by symptom name.

        Args:
            symptom: The symptom to search for
            language: Language for results

        Returns:
            List of MedlinePlusResult objects
        """
        # Map symptom to ICD-10 code if possible
        normalized = symptom.lower().replace(" ", "_")
        code = self.COMMON_PEDIATRIC_CODES.get(normalized)

        if code:
            return await self.search_by_code(code, "ICD-10-CM", language)

        # Fall back to topic search
        return await self.search_topics(symptom, language)

    async def search_topics(
        self,
        query: str,
        language: str = "en",
    ) -> list[MedlinePlusResult]:
        """
        Search MedlinePlus health topics.

        Args:
            query: Search query
            language: Language for results

        Returns:
            List of MedlinePlusResult objects
        """
        cache_key = f"topic:{query}:{language}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[MedlinePlusResult], cached)

        try:
            # In production, would call the MedlinePlus API
            # For now, return curated pediatric content
            results = self._get_curated_content(query)

            self._set_cached(cache_key, results)
            return results

        except Exception as e:
            logger.error(f"MedlinePlus topic search failed: {e}")
            return []

    async def get_medication_info(
        self,
        medication_name: str,
        language: str = "en",
    ) -> list[MedlinePlusResult]:
        """
        Get medication information from MedlinePlus.

        Args:
            medication_name: Name of the medication
            language: Language for results

        Returns:
            List of MedlinePlusResult objects
        """
        cache_key = f"med:{medication_name}:{language}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[MedlinePlusResult], cached)

        try:
            # Map common medications to RxNorm codes
            rxnorm_codes = {
                "acetaminophen": "161",
                "ibuprofen": "5640",
                "amoxicillin": "723",
                "diphenhydramine": "3498",
            }

            normalized = medication_name.lower()
            code = rxnorm_codes.get(normalized)

            if code:
                params = {
                    "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.88",  # RxNorm
                    "mainSearchCriteria.v.c": code,
                    "mainSearchCriteria.v.dn": medication_name,
                    "informationRecipient.languageCode.c": language,
                    "knowledgeResponseType": "application/json",
                }

                url = f"{self.BASE_URL}?{urlencode(params)}"
                results = await self._make_request(url)
                parsed = self._parse_response(results)
            else:
                # Return curated content
                parsed = self._get_medication_content(medication_name)

            self._set_cached(cache_key, parsed)
            return parsed

        except Exception as e:
            logger.error(f"MedlinePlus medication search failed: {e}")
            return []

    async def get_lab_info(
        self,
        lab_name: str,
        loinc_code: str | None = None,
        language: str = "en",
    ) -> list[MedlinePlusResult]:
        """
        Get lab test information from MedlinePlus.

        Args:
            lab_name: Name of the lab test
            loinc_code: str | None LOINC code
            language: Language for results

        Returns:
            List of MedlinePlusResult objects
        """
        cache_key = f"lab:{loinc_code or lab_name}:{language}"

        cached = self._get_cached(cache_key)
        if cached:
            return cached

        try:
            if loinc_code:
                params = {
                    "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.1",  # LOINC
                    "mainSearchCriteria.v.c": loinc_code,
                    "informationRecipient.languageCode.c": language,
                    "knowledgeResponseType": "application/json",
                }

                url = f"{self.BASE_URL}?{urlencode(params)}"
                results = await self._make_request(url)
                parsed = self._parse_response(results)
            else:
                parsed = []

            self._set_cached(cache_key, parsed)
            return parsed

        except Exception as e:
            logger.error(f"MedlinePlus lab search failed: {e}")
            return []

    async def _make_request(self, url: str) -> dict[str, Any]:
        """Make HTTP request to MedlinePlus API."""
        # In production, would use aiohttp:
        # async with aiohttp.ClientSession() as session:
        #     async with session.get(url, timeout=self.timeout_seconds) as response:
        #         return await response.json()

        # For now, return simulated response
        await asyncio.sleep(0.1)  # Simulate network latency
        return {"feed": {"entry": []}}

    def _parse_response(self, response: dict[str, Any]) -> list[MedlinePlusResult]:
        """Parse MedlinePlus API response."""
        results = []

        try:
            entries = response.get("feed", {}).get("entry", [])

            for entry in entries:
                result = MedlinePlusResult(
                    title=entry.get("title", {}).get("_value", ""),
                    url=entry.get("link", [{}])[0].get("href", ""),
                    summary=entry.get("summary", {}).get("_value", ""),
                    source="MedlinePlus",
                    language="en",
                    topic_id=entry.get("id", {}).get("_value"),
                )
                results.append(result)

        except Exception as e:
            logger.error(f"Error parsing MedlinePlus response: {e}")

        return results

    def _get_code_system_oid(self, code_system: str) -> str:
        """Get OID for code system."""
        oids = {
            "ICD-10-CM": "2.16.840.1.113883.6.90",
            "ICD-9-CM": "2.16.840.1.113883.6.103",
            "SNOMED-CT": "2.16.840.1.113883.6.96",
            "RxNorm": "2.16.840.1.113883.6.88",
            "LOINC": "2.16.840.1.113883.6.1",
        }
        return oids.get(code_system, code_system)

    def _get_curated_content(self, query: str) -> list[MedlinePlusResult]:
        """Get curated content for common queries."""
        # Curated pediatric health content
        content = {
            "fever": MedlinePlusResult(
                title="Fever in Children",
                url="https://medlineplus.gov/ency/article/003090.htm",
                summary="A fever is a body temperature that is higher than normal. It is not an illness. It is part of your body's defense against infection.",
                source="MedlinePlus",
                language="en",
            ),
            "cough": MedlinePlusResult(
                title="Cough",
                url="https://medlineplus.gov/cough.html",
                summary="A cough is a reflex that keeps your throat and airways clear. Although it can be annoying, coughing helps your body heal or protect itself.",
                source="MedlinePlus",
                language="en",
            ),
            "vomiting": MedlinePlusResult(
                title="Nausea and Vomiting - Children",
                url="https://medlineplus.gov/ency/article/003117.htm",
                summary="Vomiting is the forceful emptying of the stomach contents through the mouth. It can be caused by many things in children.",
                source="MedlinePlus",
                language="en",
            ),
            "diarrhea": MedlinePlusResult(
                title="Diarrhea in Children",
                url="https://medlineplus.gov/diarrhea.html",
                summary="Diarrhea is loose, watery stools. It's usually caused by a virus or bacteria. Dehydration is the main concern.",
                source="MedlinePlus",
                language="en",
            ),
            "rash": MedlinePlusResult(
                title="Rashes in Children",
                url="https://medlineplus.gov/rashes.html",
                summary="A rash is a change of the skin which affects its color, appearance, or texture. Common causes include infections, allergies, and contact dermatitis.",
                source="MedlinePlus",
                language="en",
            ),
        }

        query_lower = query.lower()
        for key, result in content.items():
            if key in query_lower:
                return [result]

        return []

    def _get_medication_content(self, medication_name: str) -> list[MedlinePlusResult]:
        """Get curated medication content."""
        content = {
            "acetaminophen": MedlinePlusResult(
                title="Acetaminophen",
                url="https://medlineplus.gov/druginfo/meds/a681004.html",
                summary="Acetaminophen is used to relieve mild to moderate pain and reduce fever. It is commonly used in children.",
                source="MedlinePlus",
                language="en",
            ),
            "ibuprofen": MedlinePlusResult(
                title="Ibuprofen",
                url="https://medlineplus.gov/druginfo/meds/a682159.html",
                summary="Ibuprofen is used to relieve pain and reduce fever. It is an NSAID approved for children 6 months and older.",
                source="MedlinePlus",
                language="en",
            ),
        }

        name_lower = medication_name.lower()
        return [content[name_lower]] if name_lower in content else []

    def _get_cached(self, key: str) -> list[MedlinePlusResult] | None:
        """Get cached result if not expired."""
        if key in self._cache:
            result, timestamp = self._cache[key]
            if datetime.now(__import__("datetime").timezone.utc) - timestamp < timedelta(
                hours=self.cache_ttl_hours
            ):
                return cast(list[MedlinePlusResult] | None, result)
        return None

    def _set_cached(self, key: str, value: list[MedlinePlusResult]) -> None:
        """Set cached result."""
        self._cache[key] = (value, datetime.now(__import__("datetime").timezone.utc))

    def clear_cache(self) -> None:
        """Clear the cache."""
        self._cache.clear()
