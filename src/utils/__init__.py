"""
EPCID Utilities

Shared utilities for the EPCID platform:
- Logger: Structured logging with audit support
- Metrics: Performance and clinical metrics
- Validator: Input validation utilities
- Explainability: Explanation generation utilities
"""

from .explainability import ExplanationGenerator, format_explanation
from .logger import AuditLogger, get_logger, setup_logging
from .metrics import Counter, MetricsCollector, Timer
from .validator import InputValidator, ValidationError

__all__ = [
    "setup_logging",
    "get_logger",
    "AuditLogger",
    "MetricsCollector",
    "Timer",
    "Counter",
    "InputValidator",
    "ValidationError",
    "ExplanationGenerator",
    "format_explanation",
]
