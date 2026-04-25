"""
EPCID Reasoning Engine

Implements structured reasoning capabilities for the agentic platform:
- Chain-of-Thought: Step-by-step reasoning with explicit intermediate steps
- Self-Consistency: Multiple reasoning paths with consensus validation
- Reflection: Self-evaluation and reasoning verification

Critical for explainable clinical decision support.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

logger = logging.getLogger("epcid.core.reasoning")


class ReasoningType(Enum):
    """Types of reasoning strategies."""

    CHAIN_OF_THOUGHT = "chain_of_thought"
    SELF_CONSISTENCY = "self_consistency"
    TREE_OF_THOUGHT = "tree_of_thought"
    REFLECTION = "reflection"


class ConfidenceLevel(Enum):
    """Confidence levels for reasoning outcomes."""

    VERY_HIGH = "very_high"  # >0.95
    HIGH = "high"  # 0.85-0.95
    MODERATE = "moderate"  # 0.70-0.85
    LOW = "low"  # 0.50-0.70
    VERY_LOW = "very_low"  # <0.50

    @classmethod
    def from_score(cls, score: float) -> "ConfidenceLevel":
        """Get confidence level from numerical score."""
        if score >= 0.95:
            return cls.VERY_HIGH
        elif score >= 0.85:
            return cls.HIGH
        elif score >= 0.70:
            return cls.MODERATE
        elif score >= 0.50:
            return cls.LOW
        else:
            return cls.VERY_LOW


@dataclass
class ReasoningStep:
    """A single step in the reasoning process."""

    step_number: int
    description: str
    input_data: dict[str, Any]
    output_data: dict[str, Any]
    rationale: str
    confidence: float
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "step_number": self.step_number,
            "description": self.description,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "rationale": self.rationale,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat(),
            "warnings": self.warnings,
        }


@dataclass
class ReasoningChain:
    """A complete chain of reasoning steps."""

    id: str
    reasoning_type: ReasoningType
    steps: list[ReasoningStep]
    final_conclusion: str
    overall_confidence: float
    uncertainty_factors: list[str]
    supporting_evidence: list[str]
    contradicting_evidence: list[str]
    created_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    metadata: dict[str, Any] = field(default_factory=dict)

    def get_explanation(self) -> str:
        """Generate human-readable explanation of reasoning."""
        lines = ["## Reasoning Process\n"]

        for step in self.steps:
            lines.append(f"### Step {step.step_number}: {step.description}")
            lines.append(f"**Rationale:** {step.rationale}")
            lines.append(f"**Confidence:** {step.confidence:.0%}")
            if step.warnings:
                lines.append(f"**Warnings:** {', '.join(step.warnings)}")
            lines.append("")

        lines.append("## Conclusion")
        lines.append(f"**Result:** {self.final_conclusion}")
        lines.append(f"**Overall Confidence:** {self.overall_confidence:.0%}")

        if self.uncertainty_factors:
            lines.append("\n**Uncertainty Factors:**")
            for factor in self.uncertainty_factors:
                lines.append(f"- {factor}")

        if self.supporting_evidence:
            lines.append("\n**Supporting Evidence:**")
            for evidence in self.supporting_evidence:
                lines.append(f"- {evidence}")

        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "reasoning_type": self.reasoning_type.value,
            "steps": [step.to_dict() for step in self.steps],
            "final_conclusion": self.final_conclusion,
            "overall_confidence": self.overall_confidence,
            "uncertainty_factors": self.uncertainty_factors,
            "supporting_evidence": self.supporting_evidence,
            "contradicting_evidence": self.contradicting_evidence,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }


class ReasoningStrategy(ABC):
    """Abstract base class for reasoning strategies."""

    @abstractmethod
    def reason(
        self,
        context: dict[str, Any],
        goal: str,
    ) -> ReasoningChain:
        """Execute reasoning with the given context and goal."""
        pass

    @abstractmethod
    def validate(self, chain: ReasoningChain) -> tuple[bool, list[str]]:
        """Validate a reasoning chain. Returns (is_valid, issues)."""
        pass


class ChainOfThought(ReasoningStrategy):
    """
    Chain-of-Thought reasoning implementation.

    Breaks down complex reasoning into explicit, sequential steps.
    Critical for explainability in clinical decision support.
    """

    def __init__(
        self,
        max_steps: int = 10,
        min_confidence_threshold: float = 0.5,
        require_rationale: bool = True,
    ):
        self.max_steps = max_steps
        self.min_confidence_threshold = min_confidence_threshold
        self.require_rationale = require_rationale
        logger.info(f"Initialized ChainOfThought reasoning: max_steps={max_steps}")

    def reason(
        self,
        context: dict[str, Any],
        goal: str,
    ) -> ReasoningChain:
        """Execute chain-of-thought reasoning."""
        import hashlib

        steps: list[ReasoningStep] = []
        uncertainty_factors: list[str] = []
        supporting_evidence: list[str] = []
        contradicting_evidence: list[str] = []

        # Step 1: Analyze available data
        step1 = self._analyze_data(context)
        steps.append(step1)

        # Step 2: Identify relevant patterns
        step2 = self._identify_patterns(context, step1.output_data)
        steps.append(step2)

        # Step 3: Apply clinical rules
        step3 = self._apply_clinical_rules(context, step2.output_data)
        steps.append(step3)

        # Step 4: Assess uncertainty
        step4 = self._assess_uncertainty(context, steps)
        steps.append(step4)
        uncertainty_factors = step4.output_data.get("uncertainty_factors", [])

        # Step 5: Synthesize conclusion
        step5 = self._synthesize_conclusion(context, steps, goal)
        steps.append(step5)

        # Calculate overall confidence
        overall_confidence = self._calculate_overall_confidence(steps)

        # Collect evidence
        for step in steps:
            supporting_evidence.extend(step.output_data.get("supporting_evidence", []))
            contradicting_evidence.extend(step.output_data.get("contradicting_evidence", []))

        chain_id = hashlib.sha256(
            f"{goal}:{datetime.now(__import__('datetime').timezone.utc).isoformat()}".encode()
        ).hexdigest()[:12]

        chain = ReasoningChain(
            id=chain_id,
            reasoning_type=ReasoningType.CHAIN_OF_THOUGHT,
            steps=steps,
            final_conclusion=step5.output_data.get("conclusion", "Unable to determine"),
            overall_confidence=overall_confidence,
            uncertainty_factors=uncertainty_factors,
            supporting_evidence=list(set(supporting_evidence)),
            contradicting_evidence=list(set(contradicting_evidence)),
            metadata={"goal": goal},
        )

        logger.info(
            f"Completed chain-of-thought reasoning: {chain.id}, confidence={overall_confidence:.2f}"
        )
        return chain

    def _analyze_data(self, context: dict[str, Any]) -> ReasoningStep:
        """Analyze available data for completeness and quality."""
        input_data = {
            "data_sources": list(context.keys()),
            "context_keys": len(context),
        }

        # Check data completeness
        required_fields = ["symptoms", "vitals", "demographics"]
        present_fields = [f for f in required_fields if f in context]
        missing_fields = [f for f in required_fields if f not in context]

        completeness_score = len(present_fields) / len(required_fields)

        output_data = {
            "completeness_score": completeness_score,
            "present_fields": present_fields,
            "missing_fields": missing_fields,
            "data_quality": "adequate" if completeness_score >= 0.7 else "incomplete",
        }

        warnings = []
        if missing_fields:
            warnings.append(f"Missing data fields: {', '.join(missing_fields)}")

        return ReasoningStep(
            step_number=1,
            description="Data Analysis",
            input_data=input_data,
            output_data=output_data,
            rationale=f"Analyzed {len(context)} data sources. Data completeness: {completeness_score:.0%}",
            confidence=completeness_score,
            warnings=warnings,
        )

    def _identify_patterns(
        self,
        context: dict[str, Any],
        previous_output: dict[str, Any],
    ) -> ReasoningStep:
        """Identify clinical patterns in the data."""
        patterns_found = []
        supporting_evidence = []

        # Check for fever pattern
        vitals = context.get("vitals", {})
        if vitals.get("temperature", 0) >= 38.0:
            patterns_found.append("elevated_temperature")
            supporting_evidence.append(f"Temperature: {vitals.get('temperature')}°C")

        # Check for respiratory concerns
        symptoms = context.get("symptoms", [])
        respiratory_symptoms = ["cough", "wheezing", "difficulty_breathing", "rapid_breathing"]
        if any(s in symptoms for s in respiratory_symptoms):
            patterns_found.append("respiratory_symptoms")
            supporting_evidence.append("Respiratory symptoms present")

        # Check for GI concerns
        gi_symptoms = ["vomiting", "diarrhea", "abdominal_pain", "poor_appetite"]
        if any(s in symptoms for s in gi_symptoms):
            patterns_found.append("gastrointestinal_symptoms")
            supporting_evidence.append("GI symptoms present")

        return ReasoningStep(
            step_number=2,
            description="Pattern Identification",
            input_data={"data_completeness": previous_output.get("completeness_score")},
            output_data={
                "patterns_found": patterns_found,
                "supporting_evidence": supporting_evidence,
                "pattern_count": len(patterns_found),
            },
            rationale=f"Identified {len(patterns_found)} clinical patterns from available data",
            confidence=0.8 if patterns_found else 0.6,
        )

    def _apply_clinical_rules(
        self,
        context: dict[str, Any],
        previous_output: dict[str, Any],
    ) -> ReasoningStep:
        """Apply clinical safety rules and guidelines."""
        rules_triggered = []
        risk_indicators = []

        vitals = context.get("vitals", {})
        demographics = context.get("demographics", {})
        symptoms = context.get("symptoms", [])

        age_months = demographics.get("age_months", 24)

        # Critical safety rules
        critical_symptoms = ["cyanosis", "unresponsive", "seizure", "severe_difficulty_breathing"]
        if any(s in symptoms for s in critical_symptoms):
            rules_triggered.append("CRITICAL_SYMPTOM_RULE")
            risk_indicators.append("Critical symptom detected - immediate evaluation required")

        # Infant fever rule
        if age_months < 3 and vitals.get("temperature", 0) >= 38.0:
            rules_triggered.append("INFANT_FEVER_RULE")
            risk_indicators.append("Fever in infant <3 months requires urgent evaluation")

        # Dehydration rule
        dehydration_signs = ["decreased_urine", "dry_mouth", "no_tears", "sunken_eyes"]
        if sum(1 for s in dehydration_signs if s in symptoms) >= 2:
            rules_triggered.append("DEHYDRATION_RULE")
            risk_indicators.append("Multiple signs of dehydration present")

        # High fever rule
        if vitals.get("temperature", 0) >= 40.0:
            rules_triggered.append("HIGH_FEVER_RULE")
            risk_indicators.append("High fever ≥40°C detected")

        return ReasoningStep(
            step_number=3,
            description="Clinical Rule Application",
            input_data={"patterns": previous_output.get("patterns_found", [])},
            output_data={
                "rules_triggered": rules_triggered,
                "risk_indicators": risk_indicators,
                "rule_count": len(rules_triggered),
                "supporting_evidence": risk_indicators,
            },
            rationale=f"Applied clinical safety rules. {len(rules_triggered)} rules triggered.",
            confidence=0.95 if rules_triggered else 0.7,
            warnings=risk_indicators,
        )

    def _assess_uncertainty(
        self,
        context: dict[str, Any],
        previous_steps: list[ReasoningStep],
    ) -> ReasoningStep:
        """Assess uncertainty in the reasoning process."""
        uncertainty_factors = []

        # Check data completeness uncertainty
        step1 = previous_steps[0] if previous_steps else None
        if step1 and step1.output_data.get("completeness_score", 0) < 1.0:
            missing = step1.output_data.get("missing_fields", [])
            uncertainty_factors.append(f"Incomplete data: missing {', '.join(missing)}")

        # Check for conflicting patterns
        step2 = previous_steps[1] if len(previous_steps) > 1 else None
        if step2:
            patterns = step2.output_data.get("patterns_found", [])
            if len(patterns) > 2:
                uncertainty_factors.append(
                    "Multiple concurrent patterns may indicate complex condition"
                )

        # Check temporal context
        if "symptom_duration" not in context:
            uncertainty_factors.append("Unknown symptom duration affects risk assessment")

        # Calculate uncertainty score
        uncertainty_score = len(uncertainty_factors) * 0.1
        confidence = max(0.3, 1.0 - uncertainty_score)

        return ReasoningStep(
            step_number=4,
            description="Uncertainty Assessment",
            input_data={"previous_step_count": len(previous_steps)},
            output_data={
                "uncertainty_factors": uncertainty_factors,
                "uncertainty_score": uncertainty_score,
                "data_gaps": step1.output_data.get("missing_fields", []) if step1 else [],
            },
            rationale=f"Identified {len(uncertainty_factors)} sources of uncertainty",
            confidence=confidence,
        )

    def _synthesize_conclusion(
        self,
        context: dict[str, Any],
        previous_steps: list[ReasoningStep],
        goal: str,
    ) -> ReasoningStep:
        """Synthesize final conclusion from reasoning steps."""
        # Collect all risk indicators
        risk_indicators = []
        rules_triggered = []

        for step in previous_steps:
            risk_indicators.extend(step.output_data.get("risk_indicators", []))
            rules_triggered.extend(step.output_data.get("rules_triggered", []))

        # Determine risk tier
        if "CRITICAL_SYMPTOM_RULE" in rules_triggered:
            risk_tier = "CRITICAL"
            conclusion = "Critical symptoms detected. Immediate emergency evaluation required."
        elif "INFANT_FEVER_RULE" in rules_triggered or "HIGH_FEVER_RULE" in rules_triggered:
            risk_tier = "HIGH"
            conclusion = "High-risk indicators present. Urgent medical evaluation recommended within 24 hours."
        elif "DEHYDRATION_RULE" in rules_triggered or len(risk_indicators) >= 2:
            risk_tier = "MODERATE"
            conclusion = "Moderate concern identified. Medical consultation recommended."
        else:
            risk_tier = "LOW"
            conclusion = "No high-risk indicators detected. Continue monitoring."

        # Calculate confidence based on data quality and rule clarity
        confidence_scores = [step.confidence for step in previous_steps]
        avg_confidence = (
            sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.5
        )

        return ReasoningStep(
            step_number=5,
            description="Conclusion Synthesis",
            input_data={
                "rules_triggered": rules_triggered,
                "risk_indicators": risk_indicators,
            },
            output_data={
                "conclusion": conclusion,
                "risk_tier": risk_tier,
                "action_required": risk_tier in ["CRITICAL", "HIGH"],
                "recommendations": self._get_recommendations(risk_tier),
            },
            rationale=f"Synthesized conclusion based on {len(rules_triggered)} triggered rules and {len(risk_indicators)} risk indicators",
            confidence=avg_confidence,
        )

    def _get_recommendations(self, risk_tier: str) -> list[str]:
        """Get recommendations based on risk tier."""
        recommendations = {
            "CRITICAL": [
                "Call 911 or go to emergency room immediately",
                "Do not wait for symptoms to worsen",
                "Stay with child and monitor breathing",
            ],
            "HIGH": [
                "Contact pediatrician within 24 hours",
                "Seek urgent care if symptoms worsen",
                "Monitor closely for emergency signs",
            ],
            "MODERATE": [
                "Schedule appointment with pediatrician",
                "Continue symptom monitoring",
                "Review when to seek emergency care",
            ],
            "LOW": [
                "Continue home monitoring",
                "Track symptoms in diary",
                "Know when to escalate",
            ],
        }
        return recommendations.get(risk_tier, recommendations["LOW"])

    def _calculate_overall_confidence(self, steps: list[ReasoningStep]) -> float:
        """Calculate overall confidence from all steps."""
        if not steps:
            return 0.5

        # Weighted average with more weight on critical steps
        weights = [1.0, 1.0, 1.5, 0.8, 1.2]  # Weights for each step

        total_weight = 0.0
        weighted_sum = 0.0

        for i, step in enumerate(steps):
            weight = weights[i] if i < len(weights) else 1.0
            weighted_sum += step.confidence * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0.5

    def validate(self, chain: ReasoningChain) -> tuple[bool, list[str]]:
        """Validate a reasoning chain."""
        issues = []

        # Check step count
        if len(chain.steps) < 3:
            issues.append("Insufficient reasoning steps")

        # Check for rationale in each step
        if self.require_rationale:
            for step in chain.steps:
                if not step.rationale:
                    issues.append(f"Step {step.step_number} missing rationale")

        # Check confidence threshold
        if chain.overall_confidence < self.min_confidence_threshold:
            issues.append(
                f"Overall confidence {chain.overall_confidence:.2f} below threshold {self.min_confidence_threshold}"
            )

        # Check for conclusion
        if not chain.final_conclusion:
            issues.append("Missing final conclusion")

        is_valid = len(issues) == 0
        return is_valid, issues


class SelfConsistency(ReasoningStrategy):
    """
    Self-Consistency reasoning implementation.

    Generates multiple reasoning paths and validates through consensus.
    Improves reliability through diversity of reasoning approaches.
    """

    def __init__(
        self,
        num_samples: int = 3,
        consensus_threshold: float = 0.6,
        base_strategy: ReasoningStrategy | None = None,
    ):
        self.num_samples = num_samples
        self.consensus_threshold = consensus_threshold
        self.base_strategy = base_strategy or ChainOfThought()
        logger.info(f"Initialized SelfConsistency: samples={num_samples}")

    def reason(
        self,
        context: dict[str, Any],
        goal: str,
    ) -> ReasoningChain:
        """Execute self-consistency reasoning with multiple paths."""
        import hashlib

        # Generate multiple reasoning chains
        chains: list[ReasoningChain] = []
        for i in range(self.num_samples):
            # Add slight variation to encourage diverse reasoning
            varied_context = self._add_variation(context, i)
            chain = self.base_strategy.reason(varied_context, goal)
            chains.append(chain)

        # Aggregate conclusions
        conclusions = [c.final_conclusion for c in chains]
        confidence_scores = [c.overall_confidence for c in chains]

        # Find consensus
        consensus_conclusion, consensus_rate = self._find_consensus(conclusions)

        # Merge uncertainty factors
        all_uncertainties = []
        for chain in chains:
            all_uncertainties.extend(chain.uncertainty_factors)
        unique_uncertainties = list(set(all_uncertainties))

        # Merge evidence
        all_supporting = []
        all_contradicting = []
        for chain in chains:
            all_supporting.extend(chain.supporting_evidence)
            all_contradicting.extend(chain.contradicting_evidence)

        # Calculate overall confidence (boosted by consensus)
        base_confidence = sum(confidence_scores) / len(confidence_scores)
        consensus_boost = 0.1 if consensus_rate >= self.consensus_threshold else -0.1
        overall_confidence = min(1.0, base_confidence + consensus_boost)

        # Merge steps from best chain
        best_chain = max(chains, key=lambda c: c.overall_confidence)

        chain_id = hashlib.sha256(
            f"{goal}:sc:{datetime.now(__import__('datetime').timezone.utc).isoformat()}".encode()
        ).hexdigest()[:12]

        result = ReasoningChain(
            id=chain_id,
            reasoning_type=ReasoningType.SELF_CONSISTENCY,
            steps=best_chain.steps,
            final_conclusion=consensus_conclusion,
            overall_confidence=overall_confidence,
            uncertainty_factors=unique_uncertainties,
            supporting_evidence=list(set(all_supporting)),
            contradicting_evidence=list(set(all_contradicting)),
            metadata={
                "goal": goal,
                "num_samples": self.num_samples,
                "consensus_rate": consensus_rate,
                "individual_conclusions": conclusions,
            },
        )

        logger.info(f"Completed self-consistency reasoning: consensus={consensus_rate:.2f}")
        return result

    def _add_variation(self, context: dict[str, Any], sample_idx: int) -> dict[str, Any]:
        """Add slight variation to context for diverse reasoning."""
        # For now, just return the context as-is
        # In a full implementation, this could:
        # - Slightly adjust numerical values
        # - Prioritize different data sources
        # - Use different orderings
        varied = dict(context)
        varied["_sample_idx"] = sample_idx
        return varied

    def _find_consensus(self, conclusions: list[str]) -> tuple[str, float]:
        """Find consensus among conclusions."""
        if not conclusions:
            return "Unable to determine", 0.0

        # Simple majority voting
        from collections import Counter

        # Normalize conclusions for comparison
        normalized = [c.lower().strip() for c in conclusions]

        # Count occurrences
        counter = Counter(normalized)
        most_common, count = counter.most_common(1)[0]

        # Find original conclusion
        for c in conclusions:
            if c.lower().strip() == most_common:
                consensus_conclusion = c
                break
        else:
            consensus_conclusion = conclusions[0]

        consensus_rate = count / len(conclusions)
        return consensus_conclusion, consensus_rate

    def validate(self, chain: ReasoningChain) -> tuple[bool, list[str]]:
        """Validate a self-consistency reasoning chain."""
        issues = []

        # Check consensus rate
        consensus_rate = chain.metadata.get("consensus_rate", 0)
        if consensus_rate < self.consensus_threshold:
            issues.append(f"Low consensus rate: {consensus_rate:.2f}")

        # Validate underlying chain
        base_valid, base_issues = self.base_strategy.validate(chain)
        issues.extend(base_issues)

        return len(issues) == 0, issues


class ReasoningEngine:
    """
    Central reasoning engine that orchestrates different strategies.

    Provides a unified interface for reasoning across the platform,
    with support for multiple strategies and automatic selection.
    """

    def __init__(
        self,
        default_strategy: ReasoningType = ReasoningType.CHAIN_OF_THOUGHT,
        enable_reflection: bool = True,
    ):
        self.default_strategy = default_strategy
        self.enable_reflection = enable_reflection

        # Initialize strategies
        self.strategies: dict[ReasoningType, ReasoningStrategy] = {
            ReasoningType.CHAIN_OF_THOUGHT: ChainOfThought(),
            ReasoningType.SELF_CONSISTENCY: SelfConsistency(),
        }

        logger.info(f"Initialized ReasoningEngine with default: {default_strategy.value}")

    def reason(
        self,
        context: dict[str, Any],
        goal: str,
        strategy: ReasoningType | None = None,
    ) -> ReasoningChain:
        """Execute reasoning with specified or default strategy."""
        strategy = strategy or self.default_strategy

        if strategy not in self.strategies:
            logger.warning(f"Unknown strategy {strategy}, falling back to default")
            strategy = self.default_strategy

        # Execute reasoning
        chain = self.strategies[strategy].reason(context, goal)

        # Apply reflection if enabled
        if self.enable_reflection:
            chain = self._reflect(chain, context)

        return chain

    def _reflect(self, chain: ReasoningChain, context: dict[str, Any]) -> ReasoningChain:
        """Apply reflection to verify and potentially revise reasoning."""
        # Validate the chain
        strategy = self.strategies.get(chain.reasoning_type)
        if strategy:
            is_valid, issues = strategy.validate(chain)

            if not is_valid:
                logger.warning(f"Reasoning chain {chain.id} has issues: {issues}")
                chain.metadata["reflection_issues"] = issues

                # Adjust confidence based on issues
                penalty = len(issues) * 0.05
                chain.overall_confidence = max(0.1, chain.overall_confidence - penalty)

        return chain

    def explain(self, chain: ReasoningChain) -> str:
        """Generate human-readable explanation of reasoning."""
        return chain.get_explanation()

    def compare_strategies(
        self,
        context: dict[str, Any],
        goal: str,
    ) -> dict[str, ReasoningChain]:
        """Run multiple strategies and compare results."""
        results = {}
        for strategy_type, strategy in self.strategies.items():
            chain = strategy.reason(context, goal)
            results[strategy_type.value] = chain

        return results
