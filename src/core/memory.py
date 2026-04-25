"""
EPCID Memory System

Hierarchical memory architecture for the agentic platform:
- Short-term Memory: Recent observations and context (working memory)
- Episodic Memory: Specific events and experiences with temporal context
- Semantic Memory: Knowledge base and learned patterns

This enables longitudinal tracking of patient health signals over time.
"""

import hashlib
import json
import logging
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, cast

logger = logging.getLogger("epcid.core.memory")


class MemoryType(Enum):
    """Types of memory in the hierarchical system."""

    SHORT_TERM = "short_term"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"


@dataclass
class MemoryItem:
    """A single item stored in memory."""

    id: str
    content: Any
    timestamp: datetime
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] | None = None
    importance: float = 0.5
    access_count: int = 0
    last_accessed: datetime | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
            "importance": self.importance,
            "access_count": self.access_count,
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed else None,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MemoryItem":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            content=data["content"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            metadata=data.get("metadata", {}),
            importance=data.get("importance", 0.5),
            access_count=data.get("access_count", 0),
            last_accessed=(
                datetime.fromisoformat(data["last_accessed"]) if data.get("last_accessed") else None
            ),
        )


@dataclass
class Episode:
    """An episode capturing a specific health event or interaction."""

    id: str
    child_id: str
    event_type: str
    start_time: datetime
    end_time: datetime | None
    observations: list[MemoryItem]
    outcome: str | None = None
    risk_tier: str | None = None
    actions_taken: list[str] = field(default_factory=list)
    summary: str | None = None

    def duration(self) -> timedelta | None:
        """Calculate episode duration."""
        if self.end_time:
            return self.end_time - self.start_time
        return None


class MemoryStore(ABC):
    """Abstract base class for memory storage backends."""

    @abstractmethod
    def store(self, item: MemoryItem) -> bool:
        """Store an item in memory."""
        pass

    @abstractmethod
    def retrieve(self, item_id: str) -> MemoryItem | None:
        """Retrieve an item by ID."""
        pass

    @abstractmethod
    def search(self, query: str, limit: int = 10) -> list[MemoryItem]:
        """Search for items matching a query."""
        pass

    @abstractmethod
    def delete(self, item_id: str) -> bool:
        """Delete an item from memory."""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Clear all items from memory."""
        pass


class ShortTermMemory(MemoryStore):
    """
    Short-term working memory for recent observations.

    Uses a bounded deque with time-based expiration.
    Maintains the most recent context for agent decision-making.
    """

    def __init__(
        self,
        max_items: int = 100,
        ttl_minutes: int = 60,
    ):
        self.max_items = max_items
        self.ttl_minutes = ttl_minutes
        self._items: deque[MemoryItem] = deque(maxlen=max_items)
        self._index: dict[str, int] = {}
        logger.info(f"Initialized ShortTermMemory: max_items={max_items}, ttl={ttl_minutes}min")

    def store(self, item: MemoryItem) -> bool:
        """Store an item in short-term memory."""
        try:
            self._expire_old_items()
            self._items.append(item)
            self._rebuild_index()
            logger.debug(f"Stored item {item.id} in short-term memory")
            return True
        except Exception as e:
            logger.error(f"Failed to store item in short-term memory: {e}")
            return False

    def retrieve(self, item_id: str) -> MemoryItem | None:
        """Retrieve an item by ID."""
        self._expire_old_items()
        if item_id in self._index:
            idx = self._index[item_id]
            if idx < len(self._items):
                item = self._items[idx]
                item.access_count += 1
                item.last_accessed = datetime.now(__import__("datetime").timezone.utc)
                return item
        return None

    def search(self, query: str, limit: int = 10) -> list[MemoryItem]:
        """Search for items containing the query string."""
        self._expire_old_items()
        results = []
        query_lower = query.lower()

        for item in reversed(self._items):  # Most recent first
            content_str = str(item.content).lower()
            if query_lower in content_str:
                results.append(item)
                if len(results) >= limit:
                    break

        return results

    def get_recent(self, n: int = 10) -> list[MemoryItem]:
        """Get the n most recent items."""
        self._expire_old_items()
        return list(reversed(list(self._items)))[:n]

    def get_context_window(self, minutes: int = 30) -> list[MemoryItem]:
        """Get items from the last N minutes."""
        cutoff = datetime.now(__import__("datetime").timezone.utc) - timedelta(minutes=minutes)
        return [item for item in self._items if item.timestamp > cutoff]

    def delete(self, item_id: str) -> bool:
        """Delete an item from short-term memory."""
        if item_id in self._index:
            idx = self._index[item_id]
            if idx < len(self._items):
                self._items = deque(
                    [item for i, item in enumerate(self._items) if i != idx], maxlen=self.max_items
                )
                self._rebuild_index()
                return True
        return False

    def clear(self) -> None:
        """Clear all items from short-term memory."""
        self._items.clear()
        self._index.clear()
        logger.info("Cleared short-term memory")

    def _expire_old_items(self) -> None:
        """Remove items older than TTL."""
        cutoff = datetime.now(__import__("datetime").timezone.utc) - timedelta(
            minutes=self.ttl_minutes
        )
        original_count = len(self._items)

        self._items = deque(
            [item for item in self._items if item.timestamp > cutoff], maxlen=self.max_items
        )

        expired_count = original_count - len(self._items)
        if expired_count > 0:
            self._rebuild_index()
            logger.debug(f"Expired {expired_count} items from short-term memory")

    def _rebuild_index(self) -> None:
        """Rebuild the ID index after modifications."""
        self._index = {item.id: i for i, item in enumerate(self._items)}

    def __len__(self) -> int:
        return len(self._items)


class EpisodicMemory(MemoryStore):
    """
    Episodic memory for health events and interactions.

    Stores structured episodes with temporal context, enabling
    pattern recognition across similar events over time.
    """

    def __init__(
        self,
        max_episodes: int = 1000,
        compression_enabled: bool = True,
    ):
        self.max_episodes = max_episodes
        self.compression_enabled = compression_enabled
        self._episodes: dict[str, Episode] = {}
        self._items: dict[str, MemoryItem] = {}
        self._child_episodes: dict[str, list[str]] = {}  # child_id -> episode_ids
        self._temporal_index: list[tuple[datetime, str]] = []  # (timestamp, episode_id)
        logger.info(f"Initialized EpisodicMemory: max_episodes={max_episodes}")

    def store(self, item: MemoryItem) -> bool:
        """Store a memory item."""
        try:
            self._items[item.id] = item
            logger.debug(f"Stored item {item.id} in episodic memory")
            return True
        except Exception as e:
            logger.error(f"Failed to store item in episodic memory: {e}")
            return False

    def store_episode(self, episode: Episode) -> bool:
        """Store a complete episode."""
        try:
            if len(self._episodes) >= self.max_episodes:
                self._evict_oldest_episode()

            self._episodes[episode.id] = episode

            # Update child index
            if episode.child_id not in self._child_episodes:
                self._child_episodes[episode.child_id] = []
            self._child_episodes[episode.child_id].append(episode.id)

            # Update temporal index
            self._temporal_index.append((episode.start_time, episode.id))
            self._temporal_index.sort(key=lambda x: x[0])

            logger.info(f"Stored episode {episode.id} for child {episode.child_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to store episode: {e}")
            return False

    def retrieve(self, item_id: str) -> MemoryItem | None:
        """Retrieve a memory item by ID."""
        return self._items.get(item_id)

    def retrieve_episode(self, episode_id: str) -> Episode | None:
        """Retrieve an episode by ID."""
        return self._episodes.get(episode_id)

    def get_child_episodes(
        self,
        child_id: str,
        event_type: str | None = None,
        limit: int = 50,
    ) -> list[Episode]:
        """Get episodes for a specific child."""
        episode_ids = self._child_episodes.get(child_id, [])
        episodes = [self._episodes[eid] for eid in episode_ids if eid in self._episodes]

        if event_type:
            episodes = [e for e in episodes if e.event_type == event_type]

        # Sort by start time, most recent first
        episodes.sort(key=lambda e: e.start_time, reverse=True)
        return episodes[:limit]

    def get_similar_episodes(
        self,
        event_type: str,
        risk_tier: str | None = None,
        limit: int = 10,
    ) -> list[Episode]:
        """Find similar episodes by type and risk."""
        episodes = [e for e in self._episodes.values() if e.event_type == event_type]

        if risk_tier:
            episodes = [e for e in episodes if e.risk_tier == risk_tier]

        episodes.sort(key=lambda e: e.start_time, reverse=True)
        return episodes[:limit]

    def search(self, query: str, limit: int = 10) -> list[MemoryItem]:
        """Search for items matching a query."""
        results = []
        query_lower = query.lower()

        for item in self._items.values():
            content_str = str(item.content).lower()
            if query_lower in content_str:
                results.append(item)
                if len(results) >= limit:
                    break

        return results

    def delete(self, item_id: str) -> bool:
        """Delete a memory item."""
        if item_id in self._items:
            del self._items[item_id]
            return True
        return False

    def delete_episode(self, episode_id: str) -> bool:
        """Delete an episode."""
        if episode_id in self._episodes:
            episode = self._episodes[episode_id]

            # Remove from child index
            if episode.child_id in self._child_episodes:
                self._child_episodes[episode.child_id] = [
                    eid for eid in self._child_episodes[episode.child_id] if eid != episode_id
                ]

            # Remove from temporal index
            self._temporal_index = [
                (ts, eid) for ts, eid in self._temporal_index if eid != episode_id
            ]

            del self._episodes[episode_id]
            return True
        return False

    def clear(self) -> None:
        """Clear all episodic memory."""
        self._episodes.clear()
        self._items.clear()
        self._child_episodes.clear()
        self._temporal_index.clear()
        logger.info("Cleared episodic memory")

    def _evict_oldest_episode(self) -> None:
        """Evict the oldest episode to make room."""
        if self._temporal_index:
            _, oldest_id = self._temporal_index[0]
            self.delete_episode(oldest_id)
            logger.debug(f"Evicted oldest episode: {oldest_id}")


class SemanticMemory(MemoryStore):
    """
    Semantic memory for knowledge and learned patterns.

    Uses vector embeddings for semantic similarity search.
    Stores medical knowledge, guidelines, and learned patterns.
    """

    def __init__(
        self,
        embedding_dim: int = 384,
        similarity_threshold: float = 0.75,
    ):
        self.embedding_dim = embedding_dim
        self.similarity_threshold = similarity_threshold
        self._items: dict[str, MemoryItem] = {}
        self._embeddings: dict[str, list[float]] = {}
        self._categories: dict[str, list[str]] = {}  # category -> item_ids
        logger.info(f"Initialized SemanticMemory: embedding_dim={embedding_dim}")

    def store(self, item: MemoryItem) -> bool:
        """Store an item with its embedding."""
        try:
            self._items[item.id] = item

            if item.embedding:
                self._embeddings[item.id] = item.embedding

            # Index by category
            category = item.metadata.get("category", "general")
            if category not in self._categories:
                self._categories[category] = []
            self._categories[category].append(item.id)

            logger.debug(f"Stored item {item.id} in semantic memory")
            return True
        except Exception as e:
            logger.error(f"Failed to store item in semantic memory: {e}")
            return False

    def retrieve(self, item_id: str) -> MemoryItem | None:
        """Retrieve an item by ID."""
        item = self._items.get(item_id)
        if item:
            item.access_count += 1
            item.last_accessed = datetime.now(__import__("datetime").timezone.utc)
        return item

    def search(self, query: str, limit: int = 10) -> list[MemoryItem]:
        """Search for items by text query."""
        results = []
        query_lower = query.lower()

        for item in self._items.values():
            content_str = str(item.content).lower()
            if query_lower in content_str:
                results.append(item)
                if len(results) >= limit:
                    break

        return results

    def search_by_embedding(
        self,
        query_embedding: list[float],
        limit: int = 10,
        category: str | None = None,
    ) -> list[tuple[MemoryItem, float]]:
        """Search for semantically similar items using embeddings."""
        if not query_embedding:
            return []

        # Filter by category if specified
        if category and category in self._categories:
            candidate_ids = self._categories[category]
        else:
            candidate_ids = list(self._embeddings.keys())

        # Calculate similarities
        similarities = []
        for item_id in candidate_ids:
            if item_id in self._embeddings:
                similarity = self._cosine_similarity(query_embedding, self._embeddings[item_id])
                if similarity >= self.similarity_threshold:
                    similarities.append((item_id, similarity))

        # Sort by similarity
        similarities.sort(key=lambda x: x[1], reverse=True)

        # Return top results with items
        results = []
        for item_id, score in similarities[:limit]:
            if item_id in self._items:
                results.append((self._items[item_id], score))

        return results

    def get_by_category(self, category: str, limit: int = 50) -> list[MemoryItem]:
        """Get items by category."""
        item_ids = self._categories.get(category, [])
        return [self._items[iid] for iid in item_ids[:limit] if iid in self._items]

    def delete(self, item_id: str) -> bool:
        """Delete an item from semantic memory."""
        if item_id in self._items:
            item = self._items[item_id]

            # Remove from category index
            category = item.metadata.get("category", "general")
            if category in self._categories:
                self._categories[category] = [
                    iid for iid in self._categories[category] if iid != item_id
                ]

            # Remove from embeddings
            if item_id in self._embeddings:
                del self._embeddings[item_id]

            del self._items[item_id]
            return True
        return False

    def clear(self) -> None:
        """Clear all semantic memory."""
        self._items.clear()
        self._embeddings.clear()
        self._categories.clear()
        logger.info("Cleared semantic memory")

    @staticmethod
    def _cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(vec1) != len(vec2):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec1, vec2, strict=False))
        magnitude1 = sum(a * a for a in vec1) ** 0.5
        magnitude2 = sum(b * b for b in vec2) ** 0.5

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return cast(float, dot_product / (magnitude1 * magnitude2))


class Memory:
    """
    Unified memory system combining all memory types.

    Provides a single interface for storing and retrieving
    information across the hierarchical memory architecture.
    """

    def __init__(
        self,
        short_term_config: dict[str, Any] | None = None,
        episodic_config: dict[str, Any] | None = None,
        semantic_config: dict[str, Any] | None = None,
    ):
        short_term_config = short_term_config or {}
        episodic_config = episodic_config or {}
        semantic_config = semantic_config or {}

        self.short_term = ShortTermMemory(**short_term_config)
        self.episodic = EpisodicMemory(**episodic_config)
        self.semantic = SemanticMemory(**semantic_config)

        logger.info("Initialized unified Memory system")

    def store(
        self,
        content: Any,
        memory_type: MemoryType = MemoryType.SHORT_TERM,
        metadata: dict[str, Any] | None = None,
        embedding: list[float] | None = None,
        importance: float = 0.5,
    ) -> MemoryItem:
        """Store content in the specified memory type."""
        item = MemoryItem(
            id=self._generate_id(content),
            content=content,
            timestamp=datetime.now(__import__("datetime").timezone.utc),
            metadata=metadata or {},
            embedding=embedding,
            importance=importance,
        )

        if memory_type == MemoryType.SHORT_TERM:
            self.short_term.store(item)
        elif memory_type == MemoryType.EPISODIC:
            self.episodic.store(item)
        elif memory_type == MemoryType.SEMANTIC:
            self.semantic.store(item)

        return item

    def retrieve(
        self,
        item_id: str,
        memory_type: MemoryType | None = None,
    ) -> MemoryItem | None:
        """Retrieve an item by ID, optionally from a specific memory type."""
        if memory_type == MemoryType.SHORT_TERM:
            return self.short_term.retrieve(item_id)
        elif memory_type == MemoryType.EPISODIC:
            return self.episodic.retrieve(item_id)
        elif memory_type == MemoryType.SEMANTIC:
            return self.semantic.retrieve(item_id)
        else:
            # Search all memory types
            for store in [self.short_term, self.episodic, self.semantic]:
                item = store.retrieve(item_id)
                if item:
                    return item
            return None

    def search(
        self,
        query: str,
        memory_types: list[MemoryType] | None = None,
        limit: int = 10,
    ) -> list[MemoryItem]:
        """Search across memory types."""
        memory_types = memory_types or list(MemoryType)
        results = []

        for mem_type in memory_types:
            if mem_type == MemoryType.SHORT_TERM:
                results.extend(self.short_term.search(query, limit))
            elif mem_type == MemoryType.EPISODIC:
                results.extend(self.episodic.search(query, limit))
            elif mem_type == MemoryType.SEMANTIC:
                results.extend(self.semantic.search(query, limit))

        # Sort by importance and recency
        results.sort(key=lambda x: (x.importance, x.timestamp), reverse=True)
        return results[:limit]

    def get_context(
        self,
        child_id: str,
        window_minutes: int = 60,
    ) -> dict[str, Any]:
        """Get comprehensive context for a child."""
        return {
            "recent_observations": self.short_term.get_context_window(window_minutes),
            "recent_episodes": self.episodic.get_child_episodes(child_id, limit=5),
            "relevant_knowledge": self.semantic.get_by_category("pediatric_health", limit=10),
        }

    def clear_all(self) -> None:
        """Clear all memory stores."""
        self.short_term.clear()
        self.episodic.clear()
        self.semantic.clear()
        logger.info("Cleared all memory stores")

    @staticmethod
    def _generate_id(content: Any) -> str:
        """Generate a unique ID for content."""
        timestamp = datetime.now(__import__("datetime").timezone.utc).isoformat()
        content_str = json.dumps(content, default=str)
        hash_input = f"{timestamp}:{content_str}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]
