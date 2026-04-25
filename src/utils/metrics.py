"""
EPCID Metrics Utilities

Performance and clinical metrics collection:
- Latency tracking
- Throughput measurement
- Risk tier distribution
- Model performance metrics
- Safety rule trigger rates
"""

from __future__ import annotations

import logging
import statistics
import time
from collections import defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger("epcid.utils.metrics")


@dataclass
class MetricValue:
    """A single metric value with timestamp."""

    value: float
    timestamp: datetime
    labels: dict[str, str] = field(default_factory=dict)


class Timer:
    """Context manager for timing operations."""

    def __init__(self, name: str, collector: MetricsCollector | None = None):
        self.name = name
        self.collector = collector
        self.start_time: float | None = None
        self.end_time: float | None = None

    def __enter__(self) -> Timer:
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, *args: Any) -> None:
        self.end_time = time.perf_counter()
        if self.collector:
            self.collector.observe_latency(
                self.name,
                self.duration_ms,
            )

    @property
    def duration_ms(self) -> float:
        """Get duration in milliseconds."""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time) * 1000
        return 0.0


class Counter:
    """Simple counter metric."""

    def __init__(self, name: str, labels: dict[str, str] | None = None):
        self.name = name
        self.labels = labels or {}
        self._count = 0

    def inc(self, amount: int = 1) -> None:
        """Increment the counter."""
        self._count += amount

    def reset(self) -> None:
        """Reset the counter."""
        self._count = 0

    @property
    def value(self) -> int:
        """Get current count."""
        return self._count


class MetricsCollector:
    """
    Central metrics collection for EPCID.

    Collects:
    - Latency histograms
    - Counters
    - Gauges
    - Risk tier distributions
    - Model performance metrics
    """

    def __init__(
        self,
        retention_minutes: int = 60,
    ):
        self.retention_minutes = retention_minutes

        # Metric storage
        self._latencies: dict[str, list[MetricValue]] = defaultdict(list)
        self._counters: dict[str, Counter] = {}
        self._gauges: dict[str, MetricValue] = {}
        self._histograms: dict[str, list[float]] = defaultdict(list)

        # Risk assessment metrics
        self._risk_assessments: list[dict[str, Any]] = []
        self._safety_triggers: list[dict[str, Any]] = []

        logger.info("Initialized MetricsCollector")

    def observe_latency(
        self,
        operation: str,
        latency_ms: float,
        labels: dict[str, str] | None = None,
    ) -> None:
        """Record a latency observation."""
        self._latencies[operation].append(
            MetricValue(
                value=latency_ms,
                timestamp=datetime.now(__import__("datetime").timezone.utc),
                labels=labels or {},
            )
        )
        self._cleanup_old_metrics()

    @contextmanager
    def time(self, operation: str, labels: dict[str, str] | None = None) -> Any:
        """Context manager for timing operations."""
        start = time.perf_counter()
        try:
            yield
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            self.observe_latency(operation, duration_ms, labels)

    def inc_counter(
        self,
        name: str,
        amount: int = 1,
        labels: dict[str, str] | None = None,
    ) -> None:
        """Increment a counter."""
        key = self._make_key(name, labels)
        if key not in self._counters:
            self._counters[key] = Counter(name, labels)
        self._counters[key].inc(amount)

    def set_gauge(
        self,
        name: str,
        value: float,
        labels: dict[str, str] | None = None,
    ) -> None:
        """Set a gauge value."""
        key = self._make_key(name, labels)
        self._gauges[key] = MetricValue(
            value=value,
            timestamp=datetime.now(__import__("datetime").timezone.utc),
            labels=labels or {},
        )

    def record_histogram(
        self,
        name: str,
        value: float,
    ) -> None:
        """Record a histogram observation."""
        self._histograms[name].append(value)
        # Keep last 1000 observations
        if len(self._histograms[name]) > 1000:
            self._histograms[name] = self._histograms[name][-1000:]

    def record_risk_assessment(
        self,
        risk_tier: str,
        confidence: float,
        latency_ms: float,
        triggered_rules: list[str],
    ) -> None:
        """Record a risk assessment for analysis."""
        self._risk_assessments.append(
            {
                "timestamp": datetime.now(__import__("datetime").timezone.utc),
                "risk_tier": risk_tier,
                "confidence": confidence,
                "latency_ms": latency_ms,
                "triggered_rules": triggered_rules,
            }
        )

        # Increment tier counter
        self.inc_counter("risk_assessments", labels={"tier": risk_tier})

        # Record latency
        self.observe_latency("risk_assessment", latency_ms, {"tier": risk_tier})

        # Keep last 10000 assessments
        if len(self._risk_assessments) > 10000:
            self._risk_assessments = self._risk_assessments[-10000:]

    def record_safety_trigger(
        self,
        rule_name: str,
        risk_tier: str,
    ) -> None:
        """Record a safety rule trigger."""
        self._safety_triggers.append(
            {
                "timestamp": datetime.now(__import__("datetime").timezone.utc),
                "rule_name": rule_name,
                "risk_tier": risk_tier,
            }
        )

        self.inc_counter("safety_triggers", labels={"rule": rule_name})

    def get_latency_stats(
        self,
        operation: str,
    ) -> dict[str, float]:
        """Get latency statistics for an operation."""
        values = [m.value for m in self._latencies.get(operation, [])]

        if not values:
            return {
                "count": 0,
                "mean": 0,
                "median": 0,
                "p95": 0,
                "p99": 0,
                "min": 0,
                "max": 0,
            }

        sorted_values = sorted(values)
        return {
            "count": len(values),
            "mean": statistics.mean(values),
            "median": statistics.median(values),
            "p95": self._percentile(sorted_values, 95),
            "p99": self._percentile(sorted_values, 99),
            "min": min(values),
            "max": max(values),
        }

    def get_counter_value(
        self,
        name: str,
        labels: dict[str, str] | None = None,
    ) -> int:
        """Get counter value."""
        key = self._make_key(name, labels)
        return self._counters.get(key, Counter(name)).value

    def get_gauge_value(
        self,
        name: str,
        labels: dict[str, str] | None = None,
    ) -> float | None:
        """Get gauge value."""
        key = self._make_key(name, labels)
        metric = self._gauges.get(key)
        return metric.value if metric else None

    def get_risk_tier_distribution(
        self,
        window_minutes: int = 60,
    ) -> dict[str, int]:
        """Get risk tier distribution for recent assessments."""
        cutoff = datetime.now(__import__("datetime").timezone.utc) - timedelta(
            minutes=window_minutes
        )

        distribution: dict[str, int] = defaultdict(int)
        for assessment in self._risk_assessments:
            if assessment["timestamp"] > cutoff:
                distribution[assessment["risk_tier"]] += 1

        return dict(distribution)

    def get_safety_trigger_rate(
        self,
        rule_name: str | None = None,
        window_minutes: int = 60,
    ) -> float:
        """Get safety rule trigger rate per hour."""
        cutoff = datetime.now(__import__("datetime").timezone.utc) - timedelta(
            minutes=window_minutes
        )

        triggers = [
            t
            for t in self._safety_triggers
            if t["timestamp"] > cutoff and (rule_name is None or t["rule_name"] == rule_name)
        ]

        # Calculate rate per hour
        return len(triggers) * (60 / window_minutes)

    def get_summary(self) -> dict[str, Any]:
        """Get summary of all metrics."""
        return {
            "latency": {op: self.get_latency_stats(op) for op in self._latencies.keys()},
            "counters": {k: c.value for k, c in self._counters.items()},
            "gauges": {k: v.value for k, v in self._gauges.items()},
            "risk_distribution": self.get_risk_tier_distribution(),
            "safety_trigger_rate": self.get_safety_trigger_rate(),
        }

    def _make_key(
        self,
        name: str,
        labels: dict[str, str] | None,
    ) -> str:
        """Create a key from name and labels."""
        if not labels:
            return name

        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"

    def _percentile(self, sorted_values: list[float], p: int) -> float:
        """Calculate percentile from sorted values."""
        if not sorted_values:
            return 0.0

        k = (len(sorted_values) - 1) * p / 100
        f = int(k)
        c = f + 1

        if c >= len(sorted_values):
            return sorted_values[-1]

        return sorted_values[f] + (k - f) * (sorted_values[c] - sorted_values[f])

    def _cleanup_old_metrics(self) -> None:
        """Remove metrics older than retention period."""
        cutoff = datetime.now(__import__("datetime").timezone.utc) - timedelta(
            minutes=self.retention_minutes
        )

        for op in list(self._latencies.keys()):
            self._latencies[op] = [m for m in self._latencies[op] if m.timestamp > cutoff]
            if not self._latencies[op]:
                del self._latencies[op]


# Global metrics collector instance
_default_collector: MetricsCollector | None = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create the default metrics collector."""
    global _default_collector
    if _default_collector is None:
        _default_collector = MetricsCollector()
    return _default_collector
