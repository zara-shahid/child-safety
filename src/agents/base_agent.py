"""
EPCID Base Agent

Abstract base class for all agents in the EPCID platform.
Provides common functionality for:
- Configuration management
- Memory access
- Reasoning invocation
- Audit logging
- Error handling
"""

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, TypeVar

from ..core.memory import Memory, MemoryType
from ..core.reasoning import ReasoningChain, ReasoningEngine

logger = logging.getLogger("epcid.agents")


class AgentStatus(Enum):
    """Agent execution status."""

    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class AgentConfig:
    """Configuration for an agent."""

    name: str
    description: str
    enabled: bool = True
    priority: int = 5  # 1 = highest, 10 = lowest
    timeout_seconds: int = 30
    max_retries: int = 3
    require_explainability: bool = True

    # Memory settings
    use_short_term_memory: bool = True
    use_episodic_memory: bool = False
    use_semantic_memory: bool = False

    # Reasoning settings
    enable_reasoning: bool = True
    reasoning_strategy: str = "chain_of_thought"

    # Custom settings
    custom_config: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "enabled": self.enabled,
            "priority": self.priority,
            "timeout_seconds": self.timeout_seconds,
            "max_retries": self.max_retries,
            "require_explainability": self.require_explainability,
            "custom_config": self.custom_config,
        }


@dataclass
class AgentResponse:
    """
    Standardized response from an agent.

    All agents return this structure to ensure consistency
    and explainability across the platform.
    """

    agent_name: str
    request_id: str
    status: AgentStatus

    # Output data
    data: dict[str, Any] = field(default_factory=dict)

    # Explainability
    explanation: str | None = None
    reasoning_chain: ReasoningChain | None = None
    evidence: list[str] = field(default_factory=list)

    # Confidence and uncertainty
    confidence: float = 0.0
    uncertainty_factors: list[str] = field(default_factory=list)

    # Warnings and errors
    warnings: list[str] = field(default_factory=list)
    error_message: str | None = None

    # Timing
    started_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    completed_at: datetime | None = None
    duration_ms: float | None = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def success(self) -> bool:
        """Check if the agent completed successfully."""
        return self.status == AgentStatus.COMPLETED

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "agent_name": self.agent_name,
            "request_id": self.request_id,
            "status": self.status.value,
            "success": self.success,
            "data": self.data,
            "explanation": self.explanation,
            "confidence": self.confidence,
            "uncertainty_factors": self.uncertainty_factors,
            "warnings": self.warnings,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
        }

    def finalize(self) -> "AgentResponse":
        """Mark the response as complete and calculate duration."""
        self.completed_at = datetime.now(__import__("datetime").timezone.utc)
        if self.started_at:
            delta = self.completed_at - self.started_at
            self.duration_ms = delta.total_seconds() * 1000
        return self


T = TypeVar("T", bound="BaseAgent")


class BaseAgent(ABC):
    """
    Abstract base class for all EPCID agents.

    Agents are specialized components that perform specific tasks
    in the clinical decision support workflow. Each agent:
    - Has a specific responsibility
    - Produces explainable outputs
    - Integrates with the memory and reasoning systems
    - Logs all actions for audit
    """

    def __init__(
        self,
        config: AgentConfig,
        memory: Memory | None = None,
        reasoning_engine: ReasoningEngine | None = None,
    ):
        self.config = config
        self.memory = memory or Memory()
        self.reasoning_engine = reasoning_engine or ReasoningEngine()

        self._status = AgentStatus.IDLE
        self._logger = logging.getLogger(f"epcid.agents.{config.name}")

        self._logger.info(f"Initialized {config.name} agent")

    @property
    def name(self) -> str:
        """Get agent name."""
        return self.config.name

    @property
    def status(self) -> AgentStatus:
        """Get current agent status."""
        return self._status

    @abstractmethod
    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Process input and produce a response.

        This is the main method that each agent must implement.

        Args:
            input_data: The input data to process
            context: str | None context from previous agents or memory

        Returns:
            AgentResponse with results and explanation
        """
        pass

    async def run(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Run the agent with error handling and logging.

        This wraps the process() method with common functionality.
        """
        request_id = str(uuid.uuid4())[:12]
        response = AgentResponse(
            agent_name=self.name,
            request_id=request_id,
            status=AgentStatus.PROCESSING,
        )

        self._status = AgentStatus.PROCESSING
        self._logger.info(f"Starting request {request_id}")

        try:
            # Check if agent is enabled
            if not self.config.enabled:
                response.status = AgentStatus.FAILED
                response.error_message = f"Agent {self.name} is disabled"
                return response.finalize()

            # Load context from memory if enabled
            if self.config.use_short_term_memory:
                memory_context = self._load_memory_context(input_data)
                context = {**(context or {}), **memory_context}

            # Run with timeout
            result = await asyncio.wait_for(
                self.process(input_data, context),
                timeout=self.config.timeout_seconds,
            )

            # Store result in memory
            if self.config.use_short_term_memory:
                self._store_in_memory(result)

            response = result
            response.status = AgentStatus.COMPLETED
            self._status = AgentStatus.COMPLETED

        except TimeoutError:
            response.status = AgentStatus.TIMEOUT
            response.error_message = f"Agent timed out after {self.config.timeout_seconds}s"
            self._status = AgentStatus.TIMEOUT
            self._logger.error(f"Request {request_id} timed out")

        except Exception as e:
            response.status = AgentStatus.FAILED
            response.error_message = str(e)
            self._status = AgentStatus.FAILED
            self._logger.error(f"Request {request_id} failed: {e}", exc_info=True)

        finally:
            response = response.finalize()
            self._log_response(response)

        return response

    def _load_memory_context(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """Load relevant context from memory."""
        context = {}

        # Get recent observations
        recent = self.memory.short_term.get_recent(10)
        if recent:
            context["recent_observations"] = [item.content for item in recent]

        # Get child-specific context if child_id is present
        child_id = input_data.get("child_id")
        if child_id and self.config.use_episodic_memory:
            episodes = self.memory.episodic.get_child_episodes(child_id, limit=5)
            if episodes:
                context["recent_episodes"] = [
                    {"type": ep.event_type, "outcome": ep.outcome} for ep in episodes
                ]

        return context

    def _store_in_memory(self, response: AgentResponse) -> None:
        """Store agent response in memory."""
        self.memory.store(
            content={
                "agent": self.name,
                "data": response.data,
                "confidence": response.confidence,
            },
            memory_type=MemoryType.SHORT_TERM,
            metadata={
                "request_id": response.request_id,
                "timestamp": datetime.now(__import__("datetime").timezone.utc).isoformat(),
            },
            importance=response.confidence,
        )

    def _log_response(self, response: AgentResponse) -> None:
        """Log the agent response for audit."""
        level = logging.INFO if response.success else logging.WARNING
        self._logger.log(
            level,
            f"Request {response.request_id} completed: "
            f"status={response.status.value}, "
            f"confidence={response.confidence:.2f}, "
            f"duration={response.duration_ms:.0f}ms",
        )

    def reason(
        self,
        context: dict[str, Any],
        goal: str,
    ) -> ReasoningChain:
        """Invoke the reasoning engine."""
        if not self.config.enable_reasoning:
            # Return a minimal reasoning chain
            return ReasoningChain(
                id="no-reasoning",
                reasoning_type=self.reasoning_engine.default_strategy,
                steps=[],
                final_conclusion="Reasoning disabled",
                overall_confidence=0.5,
                uncertainty_factors=["Reasoning disabled"],
                supporting_evidence=[],
                contradicting_evidence=[],
            )

        return self.reasoning_engine.reason(context, goal)

    def create_response(
        self,
        request_id: str,
        data: dict[str, Any],
        confidence: float,
        explanation: str | None = None,
        **kwargs: Any,
    ) -> AgentResponse:
        """Helper to create a standardized response."""
        return AgentResponse(
            agent_name=self.name,
            request_id=request_id,
            status=AgentStatus.COMPLETED,
            data=data,
            confidence=confidence,
            explanation=explanation,
            **kwargs,
        )

    def validate_input(
        self,
        input_data: dict[str, Any],
        required_fields: list[str],
    ) -> tuple[bool, list[str]]:
        """Validate that required fields are present in input."""
        missing = [f for f in required_fields if f not in input_data]
        return len(missing) == 0, missing

    def get_config_value(self, key: str, default: Any = None) -> Any:
        """Get a value from custom config."""
        return self.config.custom_config.get(key, default)
