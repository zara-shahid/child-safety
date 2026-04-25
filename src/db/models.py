"""
EPCID Database Models

SQLAlchemy ORM models for all database entities.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import cast
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def generate_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid4())


# Enums
class Gender(str, enum.Enum):
    """Gender options."""

    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class SymptomSeverity(str, enum.Enum):
    """Symptom severity levels."""

    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


class RiskLevel(str, enum.Enum):
    """Risk level classification."""

    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class AuditAction(str, enum.Enum):
    """Audit log action types."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    ASSESSMENT = "assessment"


# Models
class User(Base):
    """User account model."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Status flags
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(__import__("datetime").timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(__import__("datetime").timezone.utc),
        onupdate=lambda: datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Preferences
    preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    children: Mapped[list[Child]] = relationship(
        "Child", back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list[AuditLog]] = relationship(
        "AuditLog", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


class Child(Base):
    """Child profile model."""

    __tablename__ = "children"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Basic info
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    gender: Mapped[Gender] = mapped_column(Enum(Gender), nullable=False)

    # Medical info
    medical_conditions: Mapped[list | None] = mapped_column(JSON, default=list)
    allergies: Mapped[list | None] = mapped_column(JSON, default=list)
    medications: Mapped[list | None] = mapped_column(JSON, default=list)

    # Additional info
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(__import__("datetime").timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(__import__("datetime").timezone.utc),
        onupdate=lambda: datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="children")
    symptoms: Mapped[list[Symptom]] = relationship(
        "Symptom", back_populates="child", cascade="all, delete-orphan"
    )
    assessments: Mapped[list[Assessment]] = relationship(
        "Assessment", back_populates="child", cascade="all, delete-orphan"
    )

    @property
    def age_months(self) -> int:
        """Calculate age in months."""
        today = datetime.now()
        months = (today.year - self.date_of_birth.year) * 12 + (
            today.month - self.date_of_birth.month
        )
        return cast(int, max(0, months))

    @property
    def age_display(self) -> str:
        """Get human-readable age."""
        months = self.age_months
        if months < 1:
            days = (datetime.now() - self.date_of_birth).days
            return f"{days} days"
        elif months < 24:
            return f"{months} months"
        else:
            years = months // 12
            remaining_months = months % 12
            if remaining_months:
                return f"{years} years, {remaining_months} months"
            return f"{years} years"

    def __repr__(self) -> str:
        return f"<Child {self.name} ({self.age_display})>"


class Symptom(Base):
    """Symptom record model."""

    __tablename__ = "symptoms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Symptom details
    symptom_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[SymptomSeverity] = mapped_column(Enum(SymptomSeverity), nullable=False)
    measurements: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timing
    onset_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
        index=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    child: Mapped[Child] = relationship("Child", back_populates="symptoms")

    # Indexes
    __table_args__ = (
        Index("ix_symptoms_child_recorded", "child_id", "recorded_at"),
        Index("ix_symptoms_type_recorded", "symptom_type", "recorded_at"),
    )

    def __repr__(self) -> str:
        return f"<Symptom {self.symptom_type} ({self.severity.value})>"


class Assessment(Base):
    """Risk assessment record model."""

    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Risk assessment
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    # Input data
    symptoms_input: Mapped[dict] = mapped_column(JSON, nullable=False)
    location: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Results
    risk_factors: Mapped[list] = mapped_column(JSON, default=list)
    red_flags: Mapped[list] = mapped_column(JSON, default=list)
    warning_signs: Mapped[list] = mapped_column(JSON, default=list)

    # Recommendations
    primary_recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    secondary_recommendations: Mapped[list] = mapped_column(JSON, default=list)
    suggested_actions: Mapped[list] = mapped_column(JSON, default=list)
    when_to_seek_care: Mapped[str] = mapped_column(Text, nullable=False)

    # Explanations
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    clinical_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Environmental context
    environmental_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
        index=True,
    )

    # Model versioning
    model_version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)

    # Relationships
    child: Mapped[Child] = relationship("Child", back_populates="assessments")

    # Indexes
    __table_args__ = (
        Index("ix_assessments_child_created", "child_id", "created_at"),
        Index("ix_assessments_risk_created", "risk_level", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Assessment {self.id} ({self.risk_level.value})>"


class AuditLog(Base):
    """Audit log for compliance and security."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Action details
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    resource_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    # Request context
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Details
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Timestamp
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(__import__("datetime").timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    user: Mapped[User | None] = relationship("User", back_populates="audit_logs")

    # Indexes
    __table_args__ = (
        Index("ix_audit_user_timestamp", "user_id", "timestamp"),
        Index("ix_audit_action_timestamp", "action", "timestamp"),
        Index("ix_audit_resource", "resource_type", "resource_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action.value} {self.resource_type}>"


class RefreshToken(Base):
    """Refresh token storage for secure token rotation."""

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Token info
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Status
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Metadata
    device_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(__import__("datetime").timezone.utc), nullable=False
    )

    __table_args__ = (Index("ix_refresh_tokens_user_expires", "user_id", "expires_at"),)


class EnvironmentData(Base):
    """Cached environmental data."""

    __tablename__ = "environment_data"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)

    # Location
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Air quality
    aqi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    aqi_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pollutants: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Weather
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conditions: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Timestamps
    data_timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(__import__("datetime").timezone.utc), nullable=False
    )

    __table_args__ = (
        Index("ix_environment_location", "latitude", "longitude"),
        Index("ix_environment_timestamp", "data_timestamp"),
    )
