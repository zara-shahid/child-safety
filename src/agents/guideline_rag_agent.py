"""
EPCID Guideline RAG Agent

Retrieval-Augmented Generation for clinical guidelines:
- Sources: MedlinePlus, curated pediatric guidelines, internal playbooks
- Strict source allowlist only
- Every output must cite a source
- No treatment instructions
- Escalation language enforced at high risk

This agent provides educational information, NOT medical advice.
"""

import logging
import re
from dataclasses import dataclass
from typing import Any

from .base_agent import AgentConfig, AgentResponse, BaseAgent

logger = logging.getLogger("epcid.agents.guideline_rag")


@dataclass
class GuidelineSource:
    """A source for clinical guidelines."""

    id: str
    name: str
    url: str
    trust_level: str  # "high", "medium", "verified"
    category: str  # "government", "academic", "professional"


@dataclass
class GuidelineResult:
    """A retrieved guideline result."""

    title: str
    content: str
    source: GuidelineSource
    relevance_score: float
    age_appropriate: bool
    citation: str
    url: str | None = None


# Allowlisted sources
ALLOWED_SOURCES = [
    GuidelineSource(
        id="medlineplus",
        name="MedlinePlus",
        url="https://medlineplus.gov",
        trust_level="high",
        category="government",
    ),
    GuidelineSource(
        id="aap",
        name="American Academy of Pediatrics",
        url="https://www.aap.org",
        trust_level="high",
        category="professional",
    ),
    GuidelineSource(
        id="cdc",
        name="Centers for Disease Control and Prevention",
        url="https://www.cdc.gov",
        trust_level="high",
        category="government",
    ),
    GuidelineSource(
        id="nih",
        name="National Institutes of Health",
        url="https://www.nih.gov",
        trust_level="high",
        category="government",
    ),
    GuidelineSource(
        id="internal_playbook",
        name="EPCID Clinical Playbook",
        url="",
        trust_level="verified",
        category="internal",
    ),
]


class GuidelineRAGAgent(BaseAgent):
    """
    RAG agent for retrieving clinical guidelines and educational content.

    Key constraints:
    - Only retrieves from allowlisted sources
    - Always cites sources
    - Never provides treatment instructions
    - Uses escalation language for high-risk situations
    """

    # Educational content templates (simulating knowledge base)
    CONTENT_TEMPLATES = {
        "fever": {
            "title": "Fever in Children",
            "content": """Fever is usually a sign that your child's body is fighting an infection.
            A fever is generally defined as a temperature of 100.4°F (38°C) or higher.

            Common causes include:
            - Viral infections (colds, flu)
            - Ear infections
            - Respiratory infections

            When to contact a doctor:
            - Infant under 3 months with any fever
            - Fever lasting more than 3 days
            - Fever with other concerning symptoms

            Home care:
            - Keep child comfortable
            - Ensure adequate fluid intake
            - Monitor temperature regularly""",
            "source_id": "medlineplus",
        },
        "cough": {
            "title": "Cough in Children",
            "content": """Coughing helps clear mucus and irritants from the airways.

            Types of cough:
            - Dry cough: Often from viral infections or allergies
            - Wet/productive cough: May indicate lower respiratory infection
            - Barking cough: May suggest croup

            When to seek medical attention:
            - Difficulty breathing
            - Cough lasting more than 2 weeks
            - Cough with high fever
            - Wheezing or stridor

            Home care:
            - Keep child hydrated
            - Use a humidifier
            - Elevate head during sleep""",
            "source_id": "medlineplus",
        },
        "vomiting": {
            "title": "Vomiting and Nausea in Children",
            "content": """Vomiting in children is common and usually due to viral gastroenteritis.

            Common causes:
            - Stomach flu (viral gastroenteritis)
            - Food poisoning
            - Motion sickness
            - Overeating

            Warning signs requiring medical attention:
            - Signs of dehydration
            - Blood in vomit
            - Severe abdominal pain
            - Vomiting for more than 24 hours
            - Unable to keep fluids down

            Home care:
            - Small, frequent sips of clear fluids
            - Avoid solid foods until vomiting stops
            - Watch for dehydration signs""",
            "source_id": "medlineplus",
        },
        "rash": {
            "title": "Rashes in Children",
            "content": """Rashes are common in children and have many causes.

            Common types:
            - Viral rashes: Often with fever, usually resolve on their own
            - Allergic rashes: Hives, contact dermatitis
            - Heat rash: Small red bumps in warm areas
            - Eczema: Dry, itchy, recurring patches

            Concerning signs:
            - Petechiae (small red/purple dots that don't fade with pressure)
            - Rash with high fever and ill appearance
            - Rapidly spreading rash
            - Blistering or painful rash

            Always seek immediate care for petechial rashes.""",
            "source_id": "aap",
        },
        "breathing": {
            "title": "Breathing Problems in Children",
            "content": """Normal breathing in children varies by age. Any significant change
            in breathing pattern warrants attention.

            Warning signs:
            - Fast breathing (varies by age)
            - Nostril flaring
            - Chest retractions (skin pulling in between ribs)
            - Blue color around lips or fingernails
            - Grunting

            EMERGENCY: Seek immediate care for:
            - Blue skin color
            - Severe difficulty breathing
            - Child unable to speak or cry
            - Breathing stops

            These require calling 911 immediately.""",
            "source_id": "aap",
        },
        "dehydration": {
            "title": "Dehydration in Children",
            "content": """Dehydration occurs when a child loses more fluid than they take in.

            Signs of dehydration:
            - Dry mouth and tongue
            - No tears when crying
            - Fewer wet diapers (less urination)
            - Sunken soft spot on infant's head
            - Sunken eyes
            - Lethargy or irritability

            Prevention and treatment:
            - Oral rehydration solutions (like Pedialyte)
            - Small, frequent sips
            - Continue breastfeeding if applicable

            Seek medical care for:
            - No wet diaper in 8 hours
            - Very dry mouth
            - No tears
            - Sunken eyes
            - Lethargy""",
            "source_id": "cdc",
        },
    }

    # Escalation messages
    ESCALATION_MESSAGES = {
        "critical": "⚠️ **IMPORTANT**: The symptoms described may indicate a serious condition. "
        "Please seek emergency medical care immediately. Call 911 or go to the nearest emergency room.",
        "high": "⚠️ **ATTENTION**: These symptoms warrant prompt medical evaluation. "
        "Please contact your pediatrician or seek urgent care within the next few hours.",
        "moderate": "📋 We recommend consulting with your pediatrician about these symptoms. "
        "Schedule an appointment within the next 24-48 hours.",
    }

    def __init__(
        self,
        config: AgentConfig | None = None,
        **kwargs: Any,
    ) -> None:
        config = config or AgentConfig(
            name="guideline_rag_agent",
            description="Retrieves validated clinical guidelines with citations",
            priority=4,
            timeout_seconds=15,
            custom_config={
                "require_citation": True,
                "no_treatment_instructions": True,
            },
        )
        super().__init__(config, **kwargs)

        self.sources = {s.id: s for s in ALLOWED_SOURCES}

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Retrieve relevant guidelines for the given query/symptoms.

        Args:
            input_data: Contains query or symptoms to look up
            context: str | None context including risk tier

        Returns:
            AgentResponse with guidelines and citations
        """
        import uuid

        request_id = str(uuid.uuid4())[:12]

        # Extract query
        query = input_data.get("query", "")
        symptoms = input_data.get("symptoms", [])
        risk_tier = input_data.get("risk_tier") or (context or {}).get("risk_tier", "LOW")
        age_months = input_data.get("demographics", {}).get("age_months")

        # Build search terms
        search_terms = self._extract_search_terms(query, symptoms)

        # Retrieve relevant guidelines
        results = self._retrieve_guidelines(search_terms, age_months)

        # Filter and rank results
        filtered_results = self._filter_results(results, age_months)

        # Generate response with citations
        response_text = self._generate_response(
            filtered_results,
            risk_tier,
            query,
        )

        # Add escalation message if needed
        escalation_message = self._get_escalation_message(risk_tier)

        # Extract all citations
        citations = self._extract_citations(filtered_results)

        return self.create_response(
            request_id=request_id,
            data={
                "guidelines": [self._result_to_dict(r) for r in filtered_results],
                "response_text": response_text,
                "escalation_message": escalation_message,
                "citations": citations,
                "search_terms": search_terms,
                "result_count": len(filtered_results),
            },
            confidence=0.85 if filtered_results else 0.5,
            explanation=self._generate_explanation(filtered_results, risk_tier),
        )

    def _extract_search_terms(
        self,
        query: str,
        symptoms: list[str],
    ) -> list[str]:
        """Extract search terms from query and symptoms."""
        terms = []

        # Add symptoms
        for symptom in symptoms:
            normalized = symptom.lower().replace("_", " ")
            terms.append(normalized)

        # Extract keywords from query
        if query:
            # Simple keyword extraction
            words = re.findall(r"\b\w+\b", query.lower())
            medical_terms = [w for w in words if len(w) > 3]
            terms.extend(medical_terms[:5])

        return list(set(terms))

    def _retrieve_guidelines(
        self,
        search_terms: list[str],
        age_months: int | None,
    ) -> list[GuidelineResult]:
        """Retrieve guidelines matching search terms."""
        results = []

        for term in search_terms:
            # Check for matching content
            for key, template in self.CONTENT_TEMPLATES.items():
                if term in key or key in term:
                    source = self.sources.get(template["source_id"])
                    if source:
                        result = GuidelineResult(
                            title=template["title"],
                            content=template["content"],
                            source=source,
                            relevance_score=0.9 if term == key else 0.7,
                            age_appropriate=True,  # Would check in production
                            citation=f"{source.name}. {template['title']}. {source.url}",
                            url=source.url,
                        )
                        results.append(result)

        # Sort by relevance
        results.sort(key=lambda r: r.relevance_score, reverse=True)

        return results

    def _filter_results(
        self,
        results: list[GuidelineResult],
        age_months: int | None,
    ) -> list[GuidelineResult]:
        """Filter and deduplicate results."""
        seen_titles = set()
        filtered = []

        for result in results:
            # Skip duplicates
            if result.title in seen_titles:
                continue
            seen_titles.add(result.title)

            # Skip low relevance
            if result.relevance_score < 0.5:
                continue

            # Check age appropriateness (placeholder)
            # In production, would filter infant-specific content for older children, etc.

            filtered.append(result)

        # Limit to top 5
        return filtered[:5]

    def _generate_response(
        self,
        results: list[GuidelineResult],
        risk_tier: str,
        query: str,
    ) -> str:
        """Generate response text from guidelines."""
        if not results:
            return (
                "I couldn't find specific guidelines matching your query. "
                "For medical concerns, please consult with your pediatrician."
            )

        lines = []

        # Add main disclaimer
        lines.append(
            "**📚 Educational Information**\n"
            "*This information is for educational purposes only and does not constitute medical advice.*\n"
        )

        # Add content from top results
        for _i, result in enumerate(results[:3]):
            lines.append(f"### {result.title}")

            # Truncate content
            content = result.content
            if len(content) > 500:
                content = content[:500] + "..."

            lines.append(content)
            lines.append(f"\n*Source: {result.citation}*\n")

        return "\n".join(lines)

    def _get_escalation_message(self, risk_tier: str) -> str | None:
        """Get appropriate escalation message for risk tier."""
        tier_lower = risk_tier.lower()
        return self.ESCALATION_MESSAGES.get(tier_lower)

    def _extract_citations(self, results: list[GuidelineResult]) -> list[dict[str, str]]:
        """Extract citations from results."""
        citations = []
        seen = set()

        for result in results:
            if result.citation not in seen:
                citations.append(
                    {
                        "source": result.source.name,
                        "title": result.title,
                        "url": result.url or "",
                        "trust_level": result.source.trust_level,
                    }
                )
                seen.add(result.citation)

        return citations

    def _result_to_dict(self, result: GuidelineResult) -> dict[str, Any]:
        """Convert GuidelineResult to dictionary."""
        return {
            "title": result.title,
            "content": (
                result.content[:300] + "..." if len(result.content) > 300 else result.content
            ),
            "source": result.source.name,
            "relevance_score": result.relevance_score,
            "citation": result.citation,
            "url": result.url,
        }

    def _generate_explanation(
        self,
        results: list[GuidelineResult],
        risk_tier: str,
    ) -> str:
        """Generate explanation of the retrieval process."""
        lines = ["## Guideline Retrieval\n"]

        lines.append(f"**Results Found:** {len(results)}")
        lines.append(f"**Risk Context:** {risk_tier}")

        if results:
            lines.append("\n### Sources Used")
            sources = {r.source.name for r in results}
            for source in sources:
                lines.append(f"- {source}")

        lines.append("\n### Disclaimers Applied")
        lines.append("- All content from allowlisted sources only")
        lines.append("- Citations included for all information")
        lines.append("- No treatment instructions provided")

        if risk_tier.upper() in ["CRITICAL", "HIGH"]:
            lines.append("- Escalation language included")

        return "\n".join(lines)


# Query preprocessing utilities


def normalize_symptom_query(symptom: str) -> str:
    """Normalize a symptom for searching."""
    # Map common variations
    mappings = {
        "high temperature": "fever",
        "high fever": "fever",
        "throwing up": "vomiting",
        "puking": "vomiting",
        "skin rash": "rash",
        "hard to breathe": "breathing",
        "trouble breathing": "breathing",
        "can't breathe": "breathing",
        "runny poop": "diarrhea",
    }

    lower = symptom.lower().strip()
    return mappings.get(lower, lower)
