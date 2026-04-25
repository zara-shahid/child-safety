"""
EPCID Explainability Utilities

Generates human-readable explanations for:
- Risk assessments
- Clinical decisions
- Agent reasoning
- Safety alerts

Every output from EPCID must be explainable.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

logger = logging.getLogger("epcid.utils.explainability")


@dataclass
class ExplanationSection:
    """A section of an explanation."""

    title: str
    content: str
    importance: str = "medium"  # high, medium, low
    evidence: list[str] = field(default_factory=list)


@dataclass
class Explanation:
    """A complete explanation."""

    summary: str
    sections: list[ExplanationSection]
    confidence_statement: str
    disclaimers: list[str]
    generated_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )

    def to_markdown(self) -> str:
        """Convert explanation to Markdown format."""
        lines = [
            f"# {self.summary}\n",
        ]

        for section in self.sections:
            importance_marker = (
                "🔴"
                if section.importance == "high"
                else "🟡" if section.importance == "medium" else "🟢"
            )
            lines.append(f"## {importance_marker} {section.title}")
            lines.append(section.content)

            if section.evidence:
                lines.append("\n**Evidence:**")
                for item in section.evidence:
                    lines.append(f"- {item}")

            lines.append("")

        lines.append(f"---\n*{self.confidence_statement}*\n")

        if self.disclaimers:
            lines.append("### Disclaimers")
            for disclaimer in self.disclaimers:
                lines.append(f"- {disclaimer}")

        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "summary": self.summary,
            "sections": [
                {
                    "title": s.title,
                    "content": s.content,
                    "importance": s.importance,
                    "evidence": s.evidence,
                }
                for s in self.sections
            ],
            "confidence_statement": self.confidence_statement,
            "disclaimers": self.disclaimers,
            "generated_at": self.generated_at.isoformat(),
        }


class ExplanationGenerator:
    """
    Generates explanations for EPCID outputs.

    Ensures all system outputs are explainable and
    understandable by caregivers and clinicians.
    """

    # Standard disclaimers
    STANDARD_DISCLAIMERS = [
        "This is not a medical diagnosis.",
        "Always consult with a qualified healthcare provider.",
        "If you believe this is an emergency, call 911 immediately.",
    ]

    def __init__(self, include_disclaimers: bool = True):
        self.include_disclaimers = include_disclaimers

    def explain_risk_assessment(
        self,
        risk_tier: str,
        confidence: float,
        risk_factors: list[str],
        protective_factors: list[str],
        uncertainty_factors: list[str],
        triggered_rules: list[str],
        model_scores: dict[str, float],
        missing_data: list[str],
    ) -> Explanation:
        """
        Generate explanation for a risk assessment.

        Args:
            risk_tier: The assessed risk tier
            confidence: Confidence in the assessment
            risk_factors: Factors increasing risk
            protective_factors: Factors decreasing risk
            uncertainty_factors: Sources of uncertainty
            triggered_rules: Safety rules that were triggered
            model_scores: Scores from ML models
            missing_data: Data that would improve assessment

        Returns:
            Explanation object
        """
        sections = []

        # Risk tier explanation
        tier_explanations = {
            "CRITICAL": "Immediate medical attention is required. This assessment indicates potentially serious symptoms.",
            "HIGH": "Urgent medical evaluation is recommended within the next few hours.",
            "MODERATE": "Medical consultation is recommended. Please contact your pediatrician.",
            "LOW": "Home monitoring is appropriate. Continue to watch for changes.",
        }

        sections.append(
            ExplanationSection(
                title=f"Risk Level: {risk_tier}",
                content=tier_explanations.get(risk_tier, "Assessment complete."),
                importance="high" if risk_tier in ["CRITICAL", "HIGH"] else "medium",
            )
        )

        # Safety alerts
        if triggered_rules:
            sections.append(
                ExplanationSection(
                    title="⚠️ Safety Alerts",
                    content="The following safety rules were triggered:",
                    importance="high",
                    evidence=triggered_rules,
                )
            )

        # Risk factors
        if risk_factors:
            sections.append(
                ExplanationSection(
                    title="Why This Risk Level?",
                    content="The following factors contributed to this assessment:",
                    importance="high",
                    evidence=risk_factors[:5],
                )
            )

        # Protective factors
        if protective_factors:
            sections.append(
                ExplanationSection(
                    title="Positive Signs",
                    content="The following factors are reassuring:",
                    importance="low",
                    evidence=protective_factors[:3],
                )
            )

        # Uncertainty
        if uncertainty_factors:
            sections.append(
                ExplanationSection(
                    title="Uncertainty",
                    content="The following factors add uncertainty to this assessment:",
                    importance="medium",
                    evidence=uncertainty_factors[:3],
                )
            )

        # Missing data
        if missing_data:
            sections.append(
                ExplanationSection(
                    title="Additional Data Would Help",
                    content="Providing the following information would improve the accuracy:",
                    importance="low",
                    evidence=missing_data[:3],
                )
            )

        # Model contributions
        if model_scores:
            model_content = "Multiple analysis methods were used:\n"
            for model, score in model_scores.items():
                model_content += f"- {model.replace('_', ' ').title()}: {score:.0%}\n"

            sections.append(
                ExplanationSection(
                    title="How This Was Calculated",
                    content=model_content,
                    importance="low",
                )
            )

        # Confidence statement
        confidence_statement = self._generate_confidence_statement(
            confidence,
            uncertainty_factors,
        )

        return Explanation(
            summary=f"Risk Assessment: {risk_tier}",
            sections=sections,
            confidence_statement=confidence_statement,
            disclaimers=self.STANDARD_DISCLAIMERS if self.include_disclaimers else [],
        )

    def explain_escalation(
        self,
        escalation_type: str,
        urgency: str,
        primary_action: str,
        reasons: list[str],
        timeline: str,
    ) -> Explanation:
        """Generate explanation for an escalation recommendation."""
        sections = []

        # Main recommendation
        sections.append(
            ExplanationSection(
                title="Recommended Action",
                content=primary_action,
                importance="high",
                evidence=[f"Timeline: {timeline}"],
            )
        )

        # Reasons
        if reasons:
            sections.append(
                ExplanationSection(
                    title="Why This Recommendation",
                    content="Based on the following observations:",
                    importance="medium",
                    evidence=reasons[:5],
                )
            )

        return Explanation(
            summary=f"Care Guidance: {urgency.title()} - {escalation_type.replace('_', ' ').title()}",
            sections=sections,
            confidence_statement="This guidance is based on the symptoms and data provided.",
            disclaimers=self.STANDARD_DISCLAIMERS if self.include_disclaimers else [],
        )

    def explain_phenotype(
        self,
        phenotype_name: str,
        value: float,
        severity: str,
        contributing_factors: list[str],
        trend: str | None = None,
    ) -> Explanation:
        """Generate explanation for a clinical phenotype."""
        sections = []

        severity_descriptions = {
            "severe": "This is significantly elevated and warrants attention.",
            "moderate": "This is moderately elevated.",
            "mild": "This is mildly elevated.",
            "normal": "This is within normal range.",
        }

        sections.append(
            ExplanationSection(
                title=f"{phenotype_name.replace('_', ' ').title()}",
                content=severity_descriptions.get(severity, "Assessment complete."),
                importance="high" if severity == "severe" else "medium",
                evidence=[f"Value: {value}", f"Severity: {severity}"],
            )
        )

        if contributing_factors:
            sections.append(
                ExplanationSection(
                    title="Contributing Factors",
                    content="This assessment considers:",
                    importance="low",
                    evidence=contributing_factors[:3],
                )
            )

        if trend:
            sections.append(
                ExplanationSection(
                    title="Trend",
                    content=f"The trend appears to be: {trend}",
                    importance="medium" if trend == "worsening" else "low",
                )
            )

        return Explanation(
            summary=f"Clinical Signal: {phenotype_name.replace('_', ' ').title()}",
            sections=sections,
            confidence_statement="This is a derived clinical signal based on reported data.",
            disclaimers=[],
        )

    def explain_guideline_retrieval(
        self,
        query: str,
        sources: list[str],
        citations: list[dict[str, str]],
    ) -> Explanation:
        """Generate explanation for guideline retrieval."""
        sections = []

        sections.append(
            ExplanationSection(
                title="Information Sources",
                content="This information comes from trusted medical sources:",
                importance="medium",
                evidence=sources[:5],
            )
        )

        if citations:
            citation_list = [f"{c['source']}: {c['title']}" for c in citations[:3]]
            sections.append(
                ExplanationSection(
                    title="Citations",
                    content="Full references:",
                    importance="low",
                    evidence=citation_list,
                )
            )

        return Explanation(
            summary=f"Educational Information: {query}",
            sections=sections,
            confidence_statement="This information is from verified medical sources for educational purposes.",
            disclaimers=["This is educational information only, not medical advice."],
        )

    def _generate_confidence_statement(
        self,
        confidence: float,
        uncertainty_factors: list[str],
    ) -> str:
        """Generate a confidence statement."""
        if confidence >= 0.85:
            qualifier = "high confidence"
        elif confidence >= 0.7:
            qualifier = "moderate confidence"
        elif confidence >= 0.5:
            qualifier = "limited confidence"
        else:
            qualifier = "low confidence"

        statement = f"This assessment is made with {qualifier} ({confidence:.0%})."

        if uncertainty_factors:
            statement += f" Uncertainty factors: {', '.join(uncertainty_factors[:2])}."

        return statement


def format_explanation(
    explanation: Explanation,
    format: str = "markdown",
) -> str:
    """
    Format an explanation for display.

    Args:
        explanation: The explanation to format
        format: Output format (markdown, text, html)

    Returns:
        Formatted explanation string
    """
    if format == "markdown":
        return explanation.to_markdown()

    elif format == "text":
        lines = [explanation.summary, ""]

        for section in explanation.sections:
            lines.append(f"## {section.title}")
            lines.append(section.content)
            for item in section.evidence:
                lines.append(f"  - {item}")
            lines.append("")

        lines.append(explanation.confidence_statement)

        return "\n".join(lines)

    elif format == "html":
        html = [f"<h1>{explanation.summary}</h1>"]

        for section in explanation.sections:
            html.append(f"<h2>{section.title}</h2>")
            html.append(f"<p>{section.content}</p>")

            if section.evidence:
                html.append("<ul>")
                for item in section.evidence:
                    html.append(f"<li>{item}</li>")
                html.append("</ul>")

        html.append(f"<p><em>{explanation.confidence_statement}</em></p>")

        return "\n".join(html)

    return explanation.to_markdown()


def generate_simple_explanation(
    risk_tier: str,
    risk_factors: list[str],
) -> str:
    """
    Generate a simple one-paragraph explanation.

    Args:
        risk_tier: The risk tier
        risk_factors: Top risk factors

    Returns:
        Simple explanation string
    """
    tier_phrases = {
        "CRITICAL": "immediate medical attention is needed",
        "HIGH": "you should seek medical care soon",
        "MODERATE": "we recommend consulting with your pediatrician",
        "LOW": "home monitoring should be sufficient",
    }

    phrase = tier_phrases.get(risk_tier, "assessment is complete")

    if risk_factors:
        factors_str = ", ".join(risk_factors[:3])
        return f"Based on {factors_str}, {phrase}."

    return f"Based on the information provided, {phrase}."
