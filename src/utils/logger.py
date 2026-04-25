"""
EPCID Logging Utilities

Provides structured logging with:
- JSON formatting for production
- Audit logging for compliance
- Context injection (request_id, child_id, etc.)
- Log level management
"""

import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(__import__("datetime").timezone.utc).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "child_id"):
            log_data["child_id"] = record.child_id
        if hasattr(record, "agent"):
            log_data["agent"] = record.agent
        if hasattr(record, "extra_data"):
            log_data.update(record.extra_data)

        # Add exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


class ContextFilter(logging.Filter):
    """Filter that adds context to log records."""

    def __init__(self, context: dict[str, Any] | None = None):
        super().__init__()
        self.context = context or {}

    def filter(self, record: logging.LogRecord) -> bool:
        for key, value in self.context.items():
            setattr(record, key, value)
        return True

    def set_context(self, key: str, value: Any) -> None:
        """Set a context value."""
        self.context[key] = value

    def clear_context(self) -> None:
        """Clear all context."""
        self.context.clear()


def setup_logging(
    level: str = "INFO",
    json_format: bool = False,
    log_file: str | None = None,
) -> logging.Logger:
    """
    Set up logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        json_format: Use JSON formatting
        log_file: str | None file path for logging

    Returns:
        Root logger
    """
    root_logger = logging.getLogger("epcid")
    root_logger.setLevel(getattr(logging, level.upper()))

    # Clear existing handlers
    root_logger.handlers.clear()

    # Create formatters
    formatter: logging.Formatter
    if json_format:
        formatter = JSONFormatter()
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # File handler
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the given name.

    Args:
        name: Logger name (will be prefixed with 'epcid.')

    Returns:
        Logger instance
    """
    if not name.startswith("epcid."):
        name = f"epcid.{name}"
    return logging.getLogger(name)


class AuditLogger:
    """
    Audit logger for compliance and safety tracking.

    All audit events are immutable and include:
    - Timestamp
    - Event type
    - User/session context
    - Action details
    - Outcome
    """

    REQUIRED_FIELDS = [
        "event_type",
        "action",
        "outcome",
    ]

    def __init__(
        self,
        log_file: str | None = None,
    ):
        self.logger = logging.getLogger("epcid.audit")
        self.logger.setLevel(logging.INFO)

        # Use JSON format for audit logs
        formatter = JSONFormatter()

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.setLevel(logging.INFO)
        self.logger.addHandler(console_handler)

        # File handler for audit trail
        if log_file:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)

            file_handler = logging.FileHandler(log_file)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)

    def log_event(
        self,
        event_type: str,
        action: str,
        outcome: str,
        child_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """
        Log an audit event.

        Args:
            event_type: Type of event (e.g., "risk_assessment")
            action: Action performed
            outcome: Outcome of the action
            child_id: str | None child identifier
            user_id: str | None user identifier
            session_id: str | None session identifier
            details: Additional event details
        """
        extra = {
            "event_type": event_type,
            "action": action,
            "outcome": outcome,
            "child_id": child_id,
            "user_id": user_id,
            "session_id": session_id,
            "extra_data": details or {},
        }

        self.logger.info(f"AUDIT: {event_type} - {action}", extra=extra)

    def log_access(
        self,
        resource_type: str,
        resource_id: str,
        action: str,
        user_id: str | None = None,
        child_id: str | None = None,
    ) -> None:
        """Log a data access event."""
        self.log_event(
            event_type="data_access",
            action=action,
            outcome="success",
            user_id=user_id,
            child_id=child_id,
            details={
                "resource_type": resource_type,
                "resource_id": resource_id,
            },
        )

    def log_risk_assessment(
        self,
        child_id: str,
        risk_tier: str,
        confidence: float,
        triggered_rules: list,
        user_id: str | None = None,
    ) -> None:
        """Log a risk assessment event."""
        self.log_event(
            event_type="risk_assessment",
            action="assess",
            outcome=risk_tier,
            child_id=child_id,
            user_id=user_id,
            details={
                "risk_tier": risk_tier,
                "confidence": confidence,
                "triggered_rules": triggered_rules,
            },
        )

    def log_escalation(
        self,
        child_id: str,
        escalation_type: str,
        urgency: str,
        user_id: str | None = None,
    ) -> None:
        """Log an escalation event."""
        self.log_event(
            event_type="escalation",
            action="escalate",
            outcome="initiated",
            child_id=child_id,
            user_id=user_id,
            details={
                "escalation_type": escalation_type,
                "urgency": urgency,
            },
        )

    def log_safety_alert(
        self,
        child_id: str,
        alert_type: str,
        triggered_rule: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Log a safety alert event."""
        self.log_event(
            event_type="safety_alert",
            action="alert",
            outcome="triggered",
            child_id=child_id,
            details={
                "alert_type": alert_type,
                "triggered_rule": triggered_rule,
                **(details or {}),
            },
        )
