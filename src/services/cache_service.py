"""
Redis Cache Service for EPCID

Provides caching for:
- API responses (air quality, weather)
- Rate limiting
- Session data
- Temporary computation results
"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Redis client - lazy loaded
_redis_client = None


def get_redis_client() -> Any:
    """Get or create Redis client with lazy loading."""
    global _redis_client

    if _redis_client is not None:
        return _redis_client

    try:
        import redis

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        _redis_client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        # Test connection
        _redis_client.ping()
        logger.info(f"Redis connected: {redis_url}")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis not available: {e}. Caching disabled.")
        return None


class CacheService:
    """
    Cache service with Redis backend and in-memory fallback.
    """

    # Default TTLs for different data types
    TTL_SHORT = 60  # 1 minute
    TTL_MEDIUM = 300  # 5 minutes
    TTL_LONG = 3600  # 1 hour
    TTL_DAY = 86400  # 24 hours

    # Cache key prefixes
    PREFIX_WEATHER = "weather:"
    PREFIX_AIR_QUALITY = "airquality:"
    PREFIX_RATE_LIMIT = "ratelimit:"
    PREFIX_SESSION = "session:"
    PREFIX_ASSESSMENT = "assessment:"
    PREFIX_GUIDELINES = "guidelines:"

    def __init__(self) -> None:
        self._memory_cache: dict = {}  # Fallback in-memory cache
        self._redis = get_redis_client()

    @property
    def is_available(self) -> bool:
        """Check if Redis is available."""
        if self._redis is None:
            return False
        try:
            self._redis.ping()
            return True
        except Exception:
            return False

    def get(self, key: str) -> Any | None:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        # Try Redis first
        if self._redis:
            try:
                value = self._redis.get(key)
                if value:
                    return json.loads(value)
            except Exception as e:
                logger.debug(f"Redis get error: {e}")

        # Fallback to memory cache
        return self._memory_cache.get(key)

    def set(self, key: str, value: Any, ttl: int = TTL_MEDIUM) -> bool:
        """
        Set value in cache with TTL.

        Args:
            key: Cache key
            value: Value to cache (must be JSON serializable)
            ttl: Time to live in seconds

        Returns:
            True if successful
        """
        serialized = json.dumps(value)

        # Try Redis first
        if self._redis:
            try:
                self._redis.setex(key, ttl, serialized)
                return True
            except Exception as e:
                logger.debug(f"Redis set error: {e}")

        # Fallback to memory cache (no TTL enforcement)
        self._memory_cache[key] = value
        return True

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if self._redis:
            try:
                self._redis.delete(key)
            except Exception:
                pass

        self._memory_cache.pop(key, None)
        return True

    def clear_prefix(self, prefix: str) -> int:
        """Clear all keys with given prefix."""
        count = 0

        if self._redis:
            try:
                keys = self._redis.keys(f"{prefix}*")
                if keys:
                    count = self._redis.delete(*keys)
            except Exception as e:
                logger.debug(f"Redis clear error: {e}")

        # Clear from memory cache
        to_delete = [k for k in self._memory_cache if k.startswith(prefix)]
        for k in to_delete:
            del self._memory_cache[k]
            count += 1

        return count

    # =========================================================================
    # Specialized caching methods
    # =========================================================================

    def get_weather(self, zip_code: str) -> dict | None:
        """Get cached weather data."""
        return self.get(f"{self.PREFIX_WEATHER}{zip_code}")

    def set_weather(self, zip_code: str, data: dict) -> bool:
        """Cache weather data (15 min TTL)."""
        return self.set(f"{self.PREFIX_WEATHER}{zip_code}", data, ttl=900)

    def get_air_quality(self, zip_code: str) -> dict | None:
        """Get cached air quality data."""
        return self.get(f"{self.PREFIX_AIR_QUALITY}{zip_code}")

    def set_air_quality(self, zip_code: str, data: dict) -> bool:
        """Cache air quality data (30 min TTL)."""
        return self.set(f"{self.PREFIX_AIR_QUALITY}{zip_code}", data, ttl=1800)

    def get_guidelines(self, topic: str) -> dict | None:
        """Get cached guidelines."""
        return self.get(f"{self.PREFIX_GUIDELINES}{topic}")

    def set_guidelines(self, topic: str, data: dict) -> bool:
        """Cache guidelines (1 hour TTL)."""
        return self.set(f"{self.PREFIX_GUIDELINES}{topic}", data, ttl=self.TTL_LONG)

    # =========================================================================
    # Rate limiting
    # =========================================================================

    def check_rate_limit(
        self, identifier: str, limit: int = 100, window: int = 60
    ) -> tuple[bool, int]:
        """
        Check if request is within rate limit.

        Args:
            identifier: Unique identifier (e.g., user_id, IP)
            limit: Max requests allowed
            window: Time window in seconds

        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        key = f"{self.PREFIX_RATE_LIMIT}{identifier}"

        if self._redis:
            try:
                current = self._redis.incr(key)
                if current == 1:
                    self._redis.expire(key, window)

                remaining = max(0, limit - current)
                return current <= limit, remaining
            except Exception as e:
                logger.debug(f"Rate limit error: {e}")

        # No rate limiting without Redis
        return True, limit

    # =========================================================================
    # Health check
    # =========================================================================

    def health_check(self) -> dict:
        """Get cache health status."""
        status = {
            "backend": "redis" if self._redis else "memory",
            "available": self.is_available,
            "memory_cache_size": len(self._memory_cache),
        }

        if self._redis and self.is_available:
            try:
                info = self._redis.info("memory")
                status["redis_memory_used"] = info.get("used_memory_human", "unknown")
                status["redis_keys"] = self._redis.dbsize()
            except Exception:
                pass

        return status


# Global cache instance
cache = CacheService()


# Convenience functions
def get_cache() -> CacheService:
    """Get the global cache service instance."""
    return cache
