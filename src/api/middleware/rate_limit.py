"""
Rate Limiting Middleware for EPCID API

Implements token bucket algorithm with:
- Per-IP rate limiting
- Per-user rate limiting (when authenticated)
- Different limits for different endpoints
- Graceful handling with retry-after headers
"""

import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, cast

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


@dataclass
class TokenBucket:
    """Token bucket for rate limiting."""

    capacity: int  # Maximum tokens
    refill_rate: float  # Tokens per second
    tokens: float = field(default=0)
    last_refill: float = field(default_factory=time.time)

    def __post_init__(self) -> None:
        self.tokens = float(self.capacity)

    def consume(self, tokens: int = 1) -> tuple[bool, float]:
        """
        Try to consume tokens.
        Returns (success, wait_time_if_failed)
        """
        now = time.time()

        # Refill tokens based on time elapsed
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True, 0
        else:
            # Calculate wait time until enough tokens are available
            wait_time = (tokens - self.tokens) / self.refill_rate
            return False, wait_time


# Rate limit configurations for different endpoint categories
RATE_LIMITS = {
    # Auth endpoints - stricter to prevent brute force
    "auth": {"capacity": 10, "refill_rate": 0.5},  # 10 requests, refills 1 every 2 seconds
    # Assessment/Clinical - moderate limits
    "clinical": {"capacity": 30, "refill_rate": 1},  # 30 requests, 1 per second refill
    # Read endpoints - more generous
    "read": {"capacity": 100, "refill_rate": 5},  # 100 requests, 5 per second refill
    # Write endpoints - moderate
    "write": {"capacity": 50, "refill_rate": 2},  # 50 requests, 2 per second refill
    # AI/LLM endpoints - stricter due to cost
    "ai": {"capacity": 20, "refill_rate": 0.5},  # 20 requests, 1 every 2 seconds
    # Default
    "default": {"capacity": 60, "refill_rate": 2},
}


def get_endpoint_category(path: str, method: str) -> str:
    """Determine the rate limit category for an endpoint."""
    path_lower = path.lower()

    # Auth endpoints
    if "/auth/" in path_lower:
        return "auth"

    # AI/LLM endpoints
    if any(x in path_lower for x in ["/chat", "/analyze", "/symptom-checker", "/ai"]):
        return "ai"

    # Clinical endpoints
    if any(x in path_lower for x in ["/assessment", "/clinical", "/pews", "/phoenix"]):
        return "clinical"

    # Read vs Write
    if method in ("GET", "HEAD", "OPTIONS"):
        return "read"
    else:
        return "write"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using token bucket algorithm.

    Tracks limits per IP address and per authenticated user.
    """

    def __init__(self, app: Any, enabled: bool = True) -> None:
        super().__init__(app)
        self.enabled = enabled
        self.buckets: dict[str, dict[str, TokenBucket]] = defaultdict(dict)
        self.cleanup_interval = 300  # Clean up old buckets every 5 minutes
        self.last_cleanup = time.time()

    def _get_client_identifier(self, request: Request) -> str:
        """Get a unique identifier for the client."""
        # Try to get user ID from auth header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # Use a hash of the token as identifier
            token = auth_header[7:]
            return f"user:{hash(token)}"

        # Fall back to IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Get the first IP in the chain (client IP)
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        return f"ip:{client_ip}"

    def _get_or_create_bucket(self, identifier: str, category: str) -> TokenBucket:
        """Get or create a token bucket for the identifier and category."""
        buckets = cast(dict[str, TokenBucket], self.buckets[identifier])
        if category not in buckets:
            config = cast(dict[str, Any], RATE_LIMITS.get(category, RATE_LIMITS["default"]))
            buckets[category] = TokenBucket(
                capacity=config["capacity"], refill_rate=config["refill_rate"]
            )
        return buckets[category]

    def _cleanup_old_buckets(self) -> None:
        """Remove buckets that haven't been used recently."""
        now = time.time()
        if now - self.last_cleanup < self.cleanup_interval:
            return

        self.last_cleanup = now
        stale_time = 600  # Remove buckets not used in 10 minutes

        identifiers_to_remove = []
        for identifier, categories in self.buckets.items():
            categories_to_remove = []
            for category, bucket in categories.items():
                if now - bucket.last_refill > stale_time:
                    categories_to_remove.append(category)

            for category in categories_to_remove:
                del categories[category]

            if not categories:
                identifiers_to_remove.append(identifier)

        for identifier in identifiers_to_remove:
            del self.buckets[identifier]

    async def dispatch(self, request: Request, call_next: Callable) -> Any:
        """Process the request with rate limiting."""
        # Skip rate limiting if disabled
        if not self.enabled:
            return await call_next(request)

        # Skip rate limiting for health checks
        if request.url.path.startswith("/health"):
            return await call_next(request)

        # Cleanup periodically
        self._cleanup_old_buckets()

        # Get client identifier and endpoint category
        identifier = self._get_client_identifier(request)
        category = get_endpoint_category(request.url.path, request.method)

        # Get the token bucket
        bucket = self._get_or_create_bucket(identifier, category)

        # Try to consume a token
        allowed, wait_time = bucket.consume(1)

        if not allowed:
            # Return 429 Too Many Requests
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "RATE_LIMITED",
                    "message": "Too many requests. Please slow down and try again.",
                    "retry_after": round(wait_time, 1),
                    "category": category,
                },
                headers={
                    "Retry-After": str(int(wait_time) + 1),
                    "X-RateLimit-Category": category,
                    "X-RateLimit-Remaining": "0",
                },
            )

        # Process the request
        response = await call_next(request)

        # Add rate limit headers to response
        remaining = int(bucket.tokens)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Category"] = category

        return response


def create_rate_limit_middleware(enabled: bool = True) -> Callable:
    """Factory function to create rate limit middleware."""

    def middleware(app: Any) -> RateLimitMiddleware:
        return RateLimitMiddleware(app, enabled=enabled)

    return middleware
