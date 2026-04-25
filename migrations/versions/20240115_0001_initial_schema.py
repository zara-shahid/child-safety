"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-15 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("is_verified", sa.Boolean(), default=False, nullable=False),
        sa.Column("is_admin", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.Column("preferences", sa.JSON(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # Children table
    op.create_table(
        "children",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("date_of_birth", sa.DateTime(), nullable=False),
        sa.Column("gender", sa.Enum("male", "female", "other", name="gender"), nullable=False),
        sa.Column("medical_conditions", sa.JSON(), default=list),
        sa.Column("allergies", sa.JSON(), default=list),
        sa.Column("medications", sa.JSON(), default=list),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_children_user_id", "children", ["user_id"])

    # Symptoms table
    op.create_table(
        "symptoms",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "child_id",
            sa.String(36),
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("symptom_type", sa.String(50), nullable=False),
        sa.Column(
            "severity",
            sa.Enum("mild", "moderate", "severe", name="symptom_severity"),
            nullable=False,
        ),
        sa.Column("measurements", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("onset_time", sa.DateTime(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_symptoms_child_id", "symptoms", ["child_id"])
    op.create_index("ix_symptoms_symptom_type", "symptoms", ["symptom_type"])
    op.create_index("ix_symptoms_recorded_at", "symptoms", ["recorded_at"])
    op.create_index("ix_symptoms_child_recorded", "symptoms", ["child_id", "recorded_at"])
    op.create_index("ix_symptoms_type_recorded", "symptoms", ["symptom_type", "recorded_at"])

    # Assessments table
    op.create_table(
        "assessments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "child_id",
            sa.String(36),
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "risk_level",
            sa.Enum("low", "moderate", "high", "critical", name="risk_level"),
            nullable=False,
        ),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("symptoms_input", sa.JSON(), nullable=False),
        sa.Column("location", sa.JSON(), nullable=True),
        sa.Column("risk_factors", sa.JSON(), default=list),
        sa.Column("red_flags", sa.JSON(), default=list),
        sa.Column("warning_signs", sa.JSON(), default=list),
        sa.Column("primary_recommendation", sa.Text(), nullable=False),
        sa.Column("secondary_recommendations", sa.JSON(), default=list),
        sa.Column("suggested_actions", sa.JSON(), default=list),
        sa.Column("when_to_seek_care", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("clinical_reasoning", sa.Text(), nullable=True),
        sa.Column("environmental_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("model_version", sa.String(20), default="1.0.0", nullable=False),
    )
    op.create_index("ix_assessments_child_id", "assessments", ["child_id"])
    op.create_index("ix_assessments_risk_level", "assessments", ["risk_level"])
    op.create_index("ix_assessments_created_at", "assessments", ["created_at"])
    op.create_index("ix_assessments_child_created", "assessments", ["child_id", "created_at"])
    op.create_index("ix_assessments_risk_created", "assessments", ["risk_level", "created_at"])

    # Audit logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column(
            "action",
            sa.Enum(
                "create",
                "read",
                "update",
                "delete",
                "login",
                "logout",
                "assessment",
                name="audit_action",
            ),
            nullable=False,
        ),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.String(36), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("request_id", sa.String(36), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
    op.create_index("ix_audit_user_timestamp", "audit_logs", ["user_id", "timestamp"])
    op.create_index("ix_audit_action_timestamp", "audit_logs", ["action", "timestamp"])
    op.create_index("ix_audit_resource", "audit_logs", ["resource_type", "resource_id"])

    # Refresh tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("token_hash", sa.String(255), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), default=False, nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("device_info", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])
    op.create_index("ix_refresh_tokens_user_expires", "refresh_tokens", ["user_id", "expires_at"])

    # Environment data table
    op.create_table(
        "environment_data",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location_name", sa.String(255), nullable=True),
        sa.Column("aqi", sa.Integer(), nullable=True),
        sa.Column("aqi_category", sa.String(50), nullable=True),
        sa.Column("pollutants", sa.JSON(), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("humidity", sa.Integer(), nullable=True),
        sa.Column("conditions", sa.String(100), nullable=True),
        sa.Column("data_timestamp", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_environment_location", "environment_data", ["latitude", "longitude"])
    op.create_index("ix_environment_timestamp", "environment_data", ["data_timestamp"])


def downgrade() -> None:
    op.drop_table("environment_data")
    op.drop_table("refresh_tokens")
    op.drop_table("audit_logs")
    op.drop_table("assessments")
    op.drop_table("symptoms")
    op.drop_table("children")
    op.drop_table("users")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS symptom_severity")
    op.execute("DROP TYPE IF EXISTS risk_level")
    op.execute("DROP TYPE IF EXISTS audit_action")
