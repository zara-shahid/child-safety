"""
EPCID Action Executor

Safe action execution with validation, rollback, and audit logging:
- Action: A discrete operation to be performed
- ActionResult: Outcome of an action execution
- Executor: Orchestrates safe action execution

All actions are logged for audit compliance and safety review.
"""

import asyncio
import logging
import traceback
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, TypeVar

logger = logging.getLogger("epcid.core.executor")


class ActionStatus(Enum):
    """Status of an action execution."""

    PENDING = "pending"
    VALIDATING = "validating"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"


class ActionCategory(Enum):
    """Categories of actions for safety classification."""

    READ = "read"  # Read-only operations
    COMPUTE = "compute"  # Computational operations
    NOTIFY = "notify"  # Notification operations
    STORE = "store"  # Data storage operations
    EXTERNAL = "external"  # External API calls
    ESCALATE = "escalate"  # Escalation actions


T = TypeVar("T")


@dataclass
class Action:
    """
    A discrete operation to be executed.

    Actions are the atomic units of execution in the system.
    Each action is validated, executed, and logged.
    """

    id: str
    name: str
    description: str
    category: ActionCategory

    # Execution details
    handler: str  # Name of handler function
    parameters: dict[str, Any]

    # Validation
    requires_validation: bool = True
    validators: list[str] = field(default_factory=list)

    # Safety
    is_reversible: bool = False
    rollback_handler: str | None = None

    # Execution control
    timeout_seconds: int = 30
    retry_count: int = 0
    max_retries: int = 2

    # Context
    child_id: str | None = None
    session_id: str | None = None
    initiated_by: str | None = None

    # Timestamps
    created_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for logging."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "handler": self.handler,
            "parameters": {
                k: str(v)[:100] for k, v in self.parameters.items()
            },  # Truncate for logging
            "is_reversible": self.is_reversible,
            "timeout_seconds": self.timeout_seconds,
            "child_id": self.child_id,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class ActionResult:
    """
    Result of an action execution.

    Contains the outcome, any output data, and execution metadata.
    """

    action_id: str
    status: ActionStatus

    # Output
    output: Any = None
    error_message: str | None = None
    error_traceback: str | None = None

    # Execution details
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: float | None = None

    # Validation results
    validation_passed: bool = True
    validation_messages: list[str] = field(default_factory=list)

    # Rollback info
    was_rolled_back: bool = False
    rollback_at: datetime | None = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def success(self) -> bool:
        """Check if the action completed successfully."""
        return self.status == ActionStatus.COMPLETED

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for logging."""
        return {
            "action_id": self.action_id,
            "status": self.status.value,
            "success": self.success,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
            "validation_passed": self.validation_passed,
            "was_rolled_back": self.was_rolled_back,
        }


class ActionValidator(ABC):
    """Base class for action validators."""

    @abstractmethod
    def validate(self, action: Action) -> tuple[bool, str | None]:
        """Validate an action. Returns (is_valid, error_message)."""
        pass


class SafetyValidator(ActionValidator):
    """Validates actions for safety compliance."""

    def validate(self, action: Action) -> tuple[bool, str | None]:
        """Check safety constraints."""
        # Ensure child_id is present for patient-related actions
        if action.category in [ActionCategory.STORE, ActionCategory.ESCALATE]:
            if not action.child_id:
                return False, "Patient-related actions require child_id"

        # Ensure escalation actions have proper context
        if action.category == ActionCategory.ESCALATE:
            if "risk_tier" not in action.parameters:
                return False, "Escalation actions require risk_tier parameter"

        return True, None


class ParameterValidator(ActionValidator):
    """Validates action parameters."""

    def __init__(self, required_params: dict[str, type]):
        self.required_params = required_params

    def validate(self, action: Action) -> tuple[bool, str | None]:
        """Check parameter presence and types."""
        for param_name, param_type in self.required_params.items():
            if param_name not in action.parameters:
                return False, f"Missing required parameter: {param_name}"

            if not isinstance(action.parameters[param_name], param_type):
                return False, f"Parameter {param_name} must be {param_type.__name__}"

        return True, None


class ActionHandler(ABC):
    """Base class for action handlers."""

    @abstractmethod
    async def execute(self, action: Action) -> Any:
        """Execute the action and return the result."""
        pass

    async def rollback(self, action: Action, result: ActionResult) -> bool:
        """Rollback the action if supported. Returns success."""
        return False


class AuditLogger:
    """Logs all action executions for audit compliance."""

    def __init__(self, log_path: str | None = None):
        self.log_path = log_path
        self.audit_logger = logging.getLogger("epcid.audit")

    def log_action_start(self, action: Action) -> None:
        """Log action start."""
        self.audit_logger.info(
            "ACTION_START",
            extra={
                "event_type": "action_start",
                "action": action.to_dict(),
            },
        )

    def log_action_complete(self, action: Action, result: ActionResult) -> None:
        """Log action completion."""
        level = logging.INFO if result.success else logging.WARNING
        self.audit_logger.log(
            level,
            "ACTION_COMPLETE",
            extra={
                "event_type": "action_complete",
                "action": action.to_dict(),
                "result": result.to_dict(),
            },
        )

    def log_validation_failure(self, action: Action, messages: list[str]) -> None:
        """Log validation failure."""
        self.audit_logger.warning(
            "VALIDATION_FAILED",
            extra={
                "event_type": "validation_failed",
                "action": action.to_dict(),
                "validation_messages": messages,
            },
        )

    def log_rollback(self, action: Action, success: bool) -> None:
        """Log rollback attempt."""
        level = logging.INFO if success else logging.ERROR
        self.audit_logger.log(
            level,
            "ROLLBACK",
            extra={
                "event_type": "rollback",
                "action": action.to_dict(),
                "success": success,
            },
        )


class Executor:
    """
    Central executor for action orchestration.

    Handles validation, execution, error handling, and rollback
    of all actions in the system with full audit logging.
    """

    def __init__(
        self,
        enable_validation: bool = True,
        enable_audit: bool = True,
        max_concurrent_actions: int = 10,
    ):
        self.enable_validation = enable_validation
        self.enable_audit = enable_audit
        self.max_concurrent_actions = max_concurrent_actions

        # Validators
        self.validators: dict[str, ActionValidator] = {
            "safety": SafetyValidator(),
        }

        # Handlers
        self.handlers: dict[str, ActionHandler] = {}

        # Audit
        self.audit_logger = AuditLogger() if enable_audit else None

        # Execution tracking
        self._active_actions: dict[str, Action] = {}
        self._semaphore = asyncio.Semaphore(max_concurrent_actions)

        logger.info(f"Initialized Executor: validation={enable_validation}, audit={enable_audit}")

    def register_handler(self, name: str, handler: ActionHandler) -> None:
        """Register an action handler."""
        self.handlers[name] = handler
        logger.debug(f"Registered handler: {name}")

    def register_validator(self, name: str, validator: ActionValidator) -> None:
        """Register a validator."""
        self.validators[name] = validator
        logger.debug(f"Registered validator: {name}")

    async def execute(self, action: Action) -> ActionResult:
        """
        Execute an action with validation, error handling, and audit logging.

        Args:
            action: The action to execute

        Returns:
            ActionResult with execution outcome
        """
        result = ActionResult(action_id=action.id, status=ActionStatus.PENDING)

        try:
            async with self._semaphore:
                # Log start
                if self.audit_logger:
                    self.audit_logger.log_action_start(action)

                # Track active action
                self._active_actions[action.id] = action

                # Validate
                if self.enable_validation and action.requires_validation:
                    result.status = ActionStatus.VALIDATING
                    is_valid, messages = await self._validate(action)
                    result.validation_passed = is_valid
                    result.validation_messages = messages

                    if not is_valid:
                        result.status = ActionStatus.FAILED
                        result.error_message = f"Validation failed: {'; '.join(messages)}"
                        if self.audit_logger:
                            self.audit_logger.log_validation_failure(action, messages)
                        return result

                # Execute
                result.status = ActionStatus.EXECUTING
                result.started_at = datetime.now(__import__("datetime").timezone.utc)

                try:
                    output = await self._execute_with_timeout(action)
                    result.output = output
                    result.status = ActionStatus.COMPLETED

                except TimeoutError:
                    result.status = ActionStatus.FAILED
                    result.error_message = f"Action timed out after {action.timeout_seconds}s"

                except Exception as e:
                    result.status = ActionStatus.FAILED
                    result.error_message = str(e)
                    result.error_traceback = traceback.format_exc()

                    # Attempt rollback if supported
                    if action.is_reversible:
                        rollback_success = await self._rollback(action, result)
                        result.was_rolled_back = rollback_success
                        if rollback_success:
                            result.status = ActionStatus.ROLLED_BACK
                            result.rollback_at = datetime.now(__import__("datetime").timezone.utc)

                result.completed_at = datetime.now(__import__("datetime").timezone.utc)
                if result.started_at:
                    delta = result.completed_at - result.started_at
                    result.duration_ms = delta.total_seconds() * 1000

        finally:
            # Remove from active actions
            self._active_actions.pop(action.id, None)

            # Log completion
            if self.audit_logger:
                self.audit_logger.log_action_complete(action, result)

        return result

    async def execute_batch(
        self,
        actions: list[Action],
        stop_on_failure: bool = False,
    ) -> list[ActionResult]:
        """
        Execute multiple actions, optionally in parallel.

        Args:
            actions: List of actions to execute
            stop_on_failure: If True, stop on first failure

        Returns:
            List of ActionResults in same order as input
        """
        results = []

        for action in actions:
            result = await self.execute(action)
            results.append(result)

            if stop_on_failure and not result.success:
                # Mark remaining actions as cancelled
                for remaining in actions[len(results) :]:
                    results.append(
                        ActionResult(
                            action_id=remaining.id,
                            status=ActionStatus.CANCELLED,
                            error_message="Cancelled due to previous failure",
                        )
                    )
                break

        return results

    async def _validate(self, action: Action) -> tuple[bool, list[str]]:
        """Run all validators on the action."""
        messages = []

        # Run specified validators
        validators_to_run = action.validators if action.validators else list(self.validators.keys())

        for validator_name in validators_to_run:
            validator = self.validators.get(validator_name)
            if validator:
                is_valid, message = validator.validate(action)
                if not is_valid and message:
                    messages.append(f"{validator_name}: {message}")

        return len(messages) == 0, messages

    async def _execute_with_timeout(self, action: Action) -> Any:
        """Execute action with timeout."""
        handler = self.handlers.get(action.handler)

        if not handler:
            raise ValueError(f"No handler registered for: {action.handler}")

        return await asyncio.wait_for(
            handler.execute(action),
            timeout=action.timeout_seconds,
        )

    async def _rollback(self, action: Action, result: ActionResult) -> bool:
        """Attempt to rollback a failed action."""
        if not action.is_reversible:
            return False

        handler = self.handlers.get(action.rollback_handler or action.handler)
        if not handler:
            return False

        try:
            success = await handler.rollback(action, result)
            if self.audit_logger:
                self.audit_logger.log_rollback(action, success)
            return success
        except Exception as e:
            logger.error(f"Rollback failed for action {action.id}: {e}")
            if self.audit_logger:
                self.audit_logger.log_rollback(action, False)
            return False

    def cancel(self, action_id: str) -> bool:
        """Cancel a pending or running action."""
        if action_id in self._active_actions:
            # Mark for cancellation (actual cancellation depends on handler support)
            logger.info(f"Cancellation requested for action {action_id}")
            return True
        return False

    def get_active_actions(self) -> list[Action]:
        """Get list of currently active actions."""
        return list(self._active_actions.values())


# Built-in handlers


class LogActionHandler(ActionHandler):
    """Handler that logs actions (for testing and audit)."""

    async def execute(self, action: Action) -> dict[str, Any]:
        """Log and return action details."""
        logger.info(f"Executing action: {action.name}")
        return {
            "action_id": action.id,
            "action_name": action.name,
            "parameters": action.parameters,
            "executed_at": datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }


class NoOpHandler(ActionHandler):
    """Handler that does nothing (for testing)."""

    async def execute(self, action: Action) -> None:
        """Do nothing."""
        await asyncio.sleep(0.01)  # Minimal delay
        return None


def create_action(
    name: str,
    handler: str,
    parameters: dict[str, Any],
    category: ActionCategory = ActionCategory.COMPUTE,
    child_id: str | None = None,
    **kwargs: Any,
) -> Action:
    """Factory function to create actions."""
    return Action(
        id=str(uuid.uuid4())[:12],
        name=name,
        description=kwargs.pop("description", f"Action: {name}"),
        category=category,
        handler=handler,
        parameters=parameters,
        child_id=child_id,
        **kwargs,
    )
