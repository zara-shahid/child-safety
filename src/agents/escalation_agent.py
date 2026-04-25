"""
EPCID Escalation & Workflow Agent

Automations and care navigation:
- "Prepare for pediatrician visit" packet
- Symptom summary PDF
- Image/voice attachments
- Reminder workflows
- Notification integrations (Slack, Email, SMS)

This agent helps caregivers navigate the healthcare system effectively.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

from .. import RISK_CRITICAL, RISK_HIGH, RISK_LOW, RISK_MODERATE
from .base_agent import AgentConfig, AgentResponse, BaseAgent

logger = logging.getLogger("epcid.agents.escalation")


class EscalationType(Enum):
    """Types of escalation actions."""

    EMERGENCY_911 = "emergency_911"
    EMERGENCY_ROOM = "emergency_room"
    URGENT_CARE = "urgent_care"
    CALL_PEDIATRICIAN = "call_pediatrician"
    SCHEDULE_APPOINTMENT = "schedule_appointment"
    HOME_MONITORING = "home_monitoring"


class NotificationChannel(Enum):
    """Notification channels."""

    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"
    SLACK = "slack"


@dataclass
class EscalationPath:
    """An escalation path with actions and timeline."""

    escalation_type: EscalationType
    urgency: str  # immediate, urgent, soon, routine
    primary_action: str
    secondary_actions: list[str]
    timeline: str
    phone_number: str | None = None
    preparation_steps: list[str] = field(default_factory=list)


@dataclass
class VisitPacket:
    """Prepared packet for healthcare visit."""

    summary: str
    symptoms_timeline: list[dict[str, Any]]
    vital_signs: dict[str, Any]
    medications: list[str]
    questions_for_provider: list[str]
    attachments: list[dict[str, str]]
    generated_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )


@dataclass
class Reminder:
    """A reminder for follow-up actions."""

    id: str
    title: str
    description: str
    due_at: datetime
    priority: str
    channels: list[NotificationChannel]
    completed: bool = False


class EscalationAgent(BaseAgent):
    """
    Agent responsible for escalation and workflow automation.

    Determines appropriate escalation paths based on risk tier
    and generates actionable guidance for caregivers.
    """

    # Escalation paths by risk tier
    ESCALATION_PATHS = {
        RISK_CRITICAL: EscalationPath(
            escalation_type=EscalationType.EMERGENCY_911,
            urgency="immediate",
            primary_action="Call 911 immediately",
            secondary_actions=[
                "Go to nearest emergency room if ambulance unavailable",
                "Stay with child and monitor breathing",
                "Have someone meet emergency responders",
            ],
            timeline="Now",
            phone_number="911",
            preparation_steps=[
                "Note child's current condition",
                "Gather any medications child is taking",
                "Have ID and insurance information ready",
            ],
        ),
        RISK_HIGH: EscalationPath(
            escalation_type=EscalationType.URGENT_CARE,
            urgency="urgent",
            primary_action="Seek medical care within the next few hours",
            secondary_actions=[
                "Call pediatrician's office or nurse line",
                "Visit urgent care if pediatrician unavailable",
                "Go to ER if symptoms worsen",
            ],
            timeline="Within 2-4 hours",
            preparation_steps=[
                "Prepare symptom summary",
                "Note when symptoms started",
                "List all medications and doses",
                "Bring insurance information",
            ],
        ),
        RISK_MODERATE: EscalationPath(
            escalation_type=EscalationType.CALL_PEDIATRICIAN,
            urgency="soon",
            primary_action="Contact pediatrician within 24 hours",
            secondary_actions=[
                "Schedule appointment if advised",
                "Continue home monitoring",
                "Use symptom diary to track changes",
            ],
            timeline="Within 24 hours",
            preparation_steps=[
                "Track symptoms over next few hours",
                "Note temperature readings",
                "Document fluid intake",
            ],
        ),
        RISK_LOW: EscalationPath(
            escalation_type=EscalationType.HOME_MONITORING,
            urgency="routine",
            primary_action="Continue home care and monitoring",
            secondary_actions=[
                "Track symptoms daily",
                "Provide comfort care",
                "Schedule routine check-up if symptoms persist",
            ],
            timeline="Monitor for 48-72 hours",
            preparation_steps=[
                "Keep symptom diary updated",
                "Note any changes or new symptoms",
            ],
        ),
    }

    def __init__(
        self,
        config: AgentConfig | None = None,
        **kwargs: Any,
    ) -> None:
        config = config or AgentConfig(
            name="escalation_agent",
            description="Workflow automation and care navigation",
            priority=7,
            timeout_seconds=20,
        )
        super().__init__(config, **kwargs)

    async def process(
        self,
        input_data: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """
        Generate escalation guidance and care navigation.

        Args:
            input_data: Contains risk assessment and patient data
            context: str | None additional context

        Returns:
            AgentResponse with escalation path and materials
        """
        import uuid

        request_id = str(uuid.uuid4())[:12]

        # Extract data
        risk_tier = input_data.get("risk_tier", RISK_LOW)
        symptoms = input_data.get("symptoms", [])
        vitals = input_data.get("vitals", {})
        medications = input_data.get("medications", [])
        demographics = input_data.get("demographics", {})
        _ = input_data.get("has_image") or input_data.get("has_audio")

        # Determine escalation path
        escalation_path = self._get_escalation_path(risk_tier)

        # Generate visit packet
        visit_packet = self._generate_visit_packet(
            symptoms,
            vitals,
            medications,
            demographics,
            context,
        )

        # Generate reminders
        reminders = self._generate_reminders(escalation_path, risk_tier)

        # Generate action checklist
        checklist = self._generate_checklist(escalation_path, risk_tier)

        # Generate when-to-escalate guidance
        escalation_criteria = self._generate_escalation_criteria(risk_tier)

        # Format the guidance message
        guidance_message = self._format_guidance(
            escalation_path,
            visit_packet,
            checklist,
            escalation_criteria,
        )

        return self.create_response(
            request_id=request_id,
            data={
                "escalation_type": escalation_path.escalation_type.value,
                "urgency": escalation_path.urgency,
                "primary_action": escalation_path.primary_action,
                "secondary_actions": escalation_path.secondary_actions,
                "timeline": escalation_path.timeline,
                "phone_number": escalation_path.phone_number,
                "visit_packet": self._packet_to_dict(visit_packet),
                "reminders": [self._reminder_to_dict(r) for r in reminders],
                "checklist": checklist,
                "escalation_criteria": escalation_criteria,
                "guidance_message": guidance_message,
            },
            confidence=0.9,
            explanation=self._generate_explanation(escalation_path, risk_tier),
        )

    def _get_escalation_path(self, risk_tier: str) -> EscalationPath:
        """Get appropriate escalation path for risk tier."""
        return self.ESCALATION_PATHS.get(
            risk_tier,
            self.ESCALATION_PATHS[RISK_LOW],
        )

    def _generate_visit_packet(
        self,
        symptoms: list[str],
        vitals: dict[str, Any],
        medications: list,
        demographics: dict[str, Any],
        context: dict[str, Any] | None,
    ) -> VisitPacket:
        """Generate a visit preparation packet."""
        context = context or {}
        # Build symptoms timeline
        symptoms_timeline = []
        for symptom in symptoms:
            symptoms_timeline.append(
                {
                    "symptom": symptom,
                    "noted_at": datetime.now(__import__("datetime").timezone.utc).isoformat(),
                    "severity": "reported",
                }
            )

        # Add historical symptoms from context
        if context and "observation_history" in context:
            for obs in context["observation_history"][-5:]:
                for s in obs.get("symptoms", []):
                    symptoms_timeline.append(
                        {
                            "symptom": s,
                            "noted_at": obs.get("timestamp", ""),
                            "severity": "historical",
                        }
                    )

        # Generate questions for provider
        questions = self._generate_provider_questions(symptoms, vitals)

        # Format medications
        med_list = []
        for med in medications:
            if isinstance(med, dict):
                med_str = med.get("name", "Unknown")
                if med.get("dose"):
                    med_str += f" ({med['dose']})"
                med_list.append(med_str)
            else:
                med_list.append(str(med))

        # Build summary
        age_str = ""
        if demographics.get("age_months"):
            months = demographics["age_months"]
            if months < 24:
                age_str = f"{months} months old"
            else:
                age_str = f"{months // 12} years old"

        summary = f"Child: {age_str}\n"
        summary += f"Current symptoms: {', '.join(symptoms[:5])}\n"

        if vitals.get("temperature"):
            summary += f"Temperature: {vitals['temperature']}°C\n"

        summary += f"Duration: {context.get('symptom_duration_hours', 'Unknown')} hours\n"

        return VisitPacket(
            summary=summary,
            symptoms_timeline=symptoms_timeline,
            vital_signs=vitals,
            medications=med_list,
            questions_for_provider=questions,
            attachments=[],
        )

    def _generate_provider_questions(
        self,
        symptoms: list[str],
        vitals: dict[str, Any],
    ) -> list[str]:
        """Generate relevant questions to ask the provider."""
        questions = [
            "What is the likely cause of these symptoms?",
            "What warning signs should I watch for?",
            "When should I bring my child back if symptoms don't improve?",
        ]

        # Symptom-specific questions
        if "fever" in symptoms or vitals.get("temperature", 0) >= 38:
            questions.append("Should I give fever medication, and if so, what and how much?")

        if "vomiting" in symptoms or "diarrhea" in symptoms:
            questions.append("How can I prevent dehydration?")
            questions.append("When can my child resume normal eating?")

        if "cough" in symptoms:
            questions.append("What can I do to help with the cough?")
            questions.append("Should I be concerned about the type of cough?")

        if "rash" in symptoms:
            questions.append("Is this rash contagious?")
            questions.append("Should I apply any treatment to the rash?")

        return questions[:6]  # Limit to 6 questions

    def _generate_reminders(
        self,
        path: EscalationPath,
        risk_tier: str,
    ) -> list[Reminder]:
        """Generate follow-up reminders."""
        reminders = []
        now = datetime.now(__import__("datetime").timezone.utc)

        if path.urgency == "immediate":
            # No reminders for emergencies
            return []

        if path.urgency == "urgent":
            reminders.append(
                Reminder(
                    id="remind_1",
                    title="Check on symptoms",
                    description="Re-evaluate symptoms and decide if urgent care is needed",
                    due_at=now + timedelta(hours=2),
                    priority="high",
                    channels=[NotificationChannel.PUSH, NotificationChannel.SMS],
                )
            )

        if path.urgency in ["urgent", "soon"]:
            reminders.append(
                Reminder(
                    id="remind_2",
                    title="Follow up with pediatrician",
                    description="Call or schedule appointment with pediatrician",
                    due_at=now + timedelta(hours=24),
                    priority="medium",
                    channels=[NotificationChannel.PUSH],
                )
            )

        # Symptom check reminders
        reminders.append(
            Reminder(
                id="remind_3",
                title="Log symptoms",
                description="Record current symptoms and any changes",
                due_at=now + timedelta(hours=6),
                priority="medium",
                channels=[NotificationChannel.PUSH],
            )
        )

        # Temperature check for fever
        if risk_tier in [RISK_HIGH, RISK_MODERATE]:
            reminders.append(
                Reminder(
                    id="remind_temp",
                    title="Check temperature",
                    description="Take and record temperature",
                    due_at=now + timedelta(hours=4),
                    priority="medium",
                    channels=[NotificationChannel.PUSH],
                )
            )

        return reminders

    def _generate_checklist(
        self,
        path: EscalationPath,
        risk_tier: str,
    ) -> list[dict[str, Any]]:
        """Generate action checklist."""
        checklist = []

        # Primary action
        checklist.append(
            {
                "item": path.primary_action,
                "priority": "high",
                "category": "action",
                "completed": False,
            }
        )

        # Preparation steps
        for step in path.preparation_steps:
            checklist.append(
                {
                    "item": step,
                    "priority": "medium",
                    "category": "preparation",
                    "completed": False,
                }
            )

        # Monitoring tasks
        monitoring_tasks = [
            "Record temperature every 4 hours",
            "Track fluid intake",
            "Note any new symptoms",
            "Log medication doses given",
        ]

        for task in monitoring_tasks[:3]:
            checklist.append(
                {
                    "item": task,
                    "priority": "medium",
                    "category": "monitoring",
                    "completed": False,
                }
            )

        return checklist

    def _generate_escalation_criteria(self, risk_tier: str) -> list[str]:
        """Generate criteria for when to escalate further."""
        criteria = []

        # Universal criteria
        criteria.extend(
            [
                "Difficulty breathing or rapid breathing",
                "Blue color around lips or fingernails",
                "Unable to wake child or unusually difficult to arouse",
                "Severe or worsening headache with stiff neck",
                "Seizure",
            ]
        )

        # Risk-tier specific
        if risk_tier in [RISK_MODERATE, RISK_LOW]:
            criteria.extend(
                [
                    "Fever persists more than 3 days",
                    "Unable to keep any fluids down for 8+ hours",
                    "No wet diapers for 8+ hours (or no urination)",
                    "Rash that doesn't fade when pressed (petechiae)",
                    "Child appears much sicker than expected",
                ]
            )

        return criteria

    def _format_guidance(
        self,
        path: EscalationPath,
        packet: VisitPacket,
        checklist: list[dict],
        escalation_criteria: list[str],
    ) -> str:
        """Format the complete guidance message."""
        lines = []

        # Header with urgency
        urgency_emoji = {
            "immediate": "🚨",
            "urgent": "⚠️",
            "soon": "📋",
            "routine": "📝",
        }

        lines.append(f"# {urgency_emoji.get(path.urgency, '📋')} Care Guidance\n")

        # Primary action
        lines.append(f"## Recommended Action: {path.primary_action}")
        lines.append(f"**Timeline:** {path.timeline}\n")

        if path.phone_number:
            lines.append(f"**Phone:** {path.phone_number}\n")

        # Secondary actions
        if path.secondary_actions:
            lines.append("### Additional Steps")
            for action in path.secondary_actions:
                lines.append(f"- {action}")
            lines.append("")

        # Visit preparation
        if path.urgency != "immediate":
            lines.append("### Prepare for Visit")
            for step in path.preparation_steps:
                lines.append(f"☐ {step}")
            lines.append("")

        # Symptom summary
        lines.append("### Current Symptom Summary")
        lines.append(packet.summary)

        # When to escalate
        lines.append("### ⚠️ Seek Immediate Care If:")
        for criterion in escalation_criteria[:5]:
            lines.append(f"- {criterion}")

        # Disclaimer
        lines.append("\n---")
        lines.append(
            "*This guidance is not a substitute for professional medical advice. "
            "When in doubt, seek medical evaluation.*"
        )

        return "\n".join(lines)

    def _packet_to_dict(self, packet: VisitPacket) -> dict[str, Any]:
        """Convert visit packet to dictionary."""
        return {
            "summary": packet.summary,
            "symptoms_timeline": packet.symptoms_timeline,
            "vital_signs": packet.vital_signs,
            "medications": packet.medications,
            "questions_for_provider": packet.questions_for_provider,
            "attachments": packet.attachments,
            "generated_at": packet.generated_at.isoformat(),
        }

    def _reminder_to_dict(self, reminder: Reminder) -> dict[str, Any]:
        """Convert reminder to dictionary."""
        return {
            "id": reminder.id,
            "title": reminder.title,
            "description": reminder.description,
            "due_at": reminder.due_at.isoformat(),
            "priority": reminder.priority,
            "channels": [c.value for c in reminder.channels],
            "completed": reminder.completed,
        }

    def _generate_explanation(
        self,
        path: EscalationPath,
        risk_tier: str,
    ) -> str:
        """Generate explanation of escalation decision."""
        lines = ["## Escalation Analysis\n"]

        lines.append(f"**Risk Tier:** {risk_tier}")
        lines.append(f"**Escalation Type:** {path.escalation_type.value}")
        lines.append(f"**Urgency:** {path.urgency}")
        lines.append(f"**Timeline:** {path.timeline}")

        lines.append("\n### Rationale")
        lines.append(
            f"Based on the {risk_tier} risk assessment, the recommended "
            f"course of action is to {path.primary_action.lower()}."
        )

        if path.urgency == "immediate":
            lines.append("\n⚠️ **This situation requires immediate emergency response.**")

        return "\n".join(lines)
