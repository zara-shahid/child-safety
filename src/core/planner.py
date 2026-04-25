"""
EPCID Task Planner

Implements goal decomposition and task planning for the agentic platform:
- Goal: High-level objective to achieve
- Task: Individual actionable unit of work
- Plan: Ordered sequence of tasks with dependencies

Enables structured, safe execution of clinical support workflows.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

logger = logging.getLogger("epcid.core.planner")


class TaskStatus(Enum):
    """Status of a task in the plan."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    BLOCKED = "blocked"


class TaskPriority(Enum):
    """Priority levels for tasks."""

    CRITICAL = 1  # Safety-critical, must execute first
    HIGH = 2
    MEDIUM = 3
    LOW = 4


class GoalType(Enum):
    """Types of goals in the EPCID system."""

    RISK_ASSESSMENT = "risk_assessment"
    DATA_COLLECTION = "data_collection"
    GUIDELINE_LOOKUP = "guideline_lookup"
    CARE_NAVIGATION = "care_navigation"
    ESCALATION = "escalation"
    MONITORING = "monitoring"
    EDUCATION = "education"


@dataclass
class Task:
    """
    A single actionable task within a plan.

    Tasks are atomic units of work that can be executed
    by agents in the system.
    """

    id: str
    name: str
    description: str
    agent_type: str  # Which agent should execute this task
    priority: TaskPriority
    status: TaskStatus = TaskStatus.PENDING
    dependencies: list[str] = field(default_factory=list)  # Task IDs
    input_data: dict[str, Any] = field(default_factory=dict)
    output_data: dict[str, Any] = field(default_factory=dict)
    timeout_seconds: int = 30
    retries: int = 0
    max_retries: int = 3
    created_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def can_execute(self, completed_tasks: set[str]) -> bool:
        """Check if all dependencies are satisfied."""
        return all(dep in completed_tasks for dep in self.dependencies)

    def duration(self) -> timedelta | None:
        """Calculate task execution duration."""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "agent_type": self.agent_type,
            "priority": self.priority.name,
            "status": self.status.name,
            "dependencies": self.dependencies,
            "timeout_seconds": self.timeout_seconds,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
        }


@dataclass
class Goal:
    """
    A high-level goal to be achieved by the system.

    Goals are decomposed into tasks by the planner.
    """

    id: str
    goal_type: GoalType
    description: str
    context: dict[str, Any]
    success_criteria: list[str]
    constraints: list[str] = field(default_factory=list)
    deadline: datetime | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    created_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "goal_type": self.goal_type.value,
            "description": self.description,
            "success_criteria": self.success_criteria,
            "constraints": self.constraints,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "priority": self.priority.name,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Plan:
    """
    An ordered sequence of tasks to achieve a goal.

    Plans maintain task dependencies and execution state.
    """

    id: str
    goal: Goal
    tasks: list[Task]
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(
        default_factory=lambda: datetime.now(__import__("datetime").timezone.utc)
    )
    started_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def completed_tasks(self) -> set[str]:
        """Get IDs of completed tasks."""
        return {t.id for t in self.tasks if t.status == TaskStatus.COMPLETED}

    @property
    def pending_tasks(self) -> list[Task]:
        """Get tasks that are ready to execute."""
        return [
            t
            for t in self.tasks
            if t.status == TaskStatus.PENDING and t.can_execute(self.completed_tasks)
        ]

    @property
    def progress(self) -> float:
        """Calculate plan completion progress (0-1)."""
        if not self.tasks:
            return 1.0
        completed = sum(1 for t in self.tasks if t.status == TaskStatus.COMPLETED)
        return completed / len(self.tasks)

    @property
    def is_complete(self) -> bool:
        """Check if all tasks are completed."""
        return all(t.status in [TaskStatus.COMPLETED, TaskStatus.SKIPPED] for t in self.tasks)

    @property
    def has_failed(self) -> bool:
        """Check if any critical task has failed."""
        return any(
            t.status == TaskStatus.FAILED and t.priority == TaskPriority.CRITICAL
            for t in self.tasks
        )

    def get_next_tasks(self, max_parallel: int = 3) -> list[Task]:
        """Get the next tasks to execute, respecting dependencies and parallelism."""
        ready = self.pending_tasks
        # Sort by priority
        ready.sort(key=lambda t: t.priority.value)
        return ready[:max_parallel]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "goal": self.goal.to_dict(),
            "tasks": [t.to_dict() for t in self.tasks],
            "status": self.status.name,
            "progress": self.progress,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class Planner:
    """
    Task planner that decomposes goals into executable plans.

    Uses domain knowledge to create safe, efficient execution plans
    for clinical support workflows.
    """

    def __init__(
        self,
        max_tasks_per_plan: int = 20,
        default_timeout: int = 30,
        enable_safety_checks: bool = True,
    ):
        self.max_tasks_per_plan = max_tasks_per_plan
        self.default_timeout = default_timeout
        self.enable_safety_checks = enable_safety_checks

        # Task templates for common goals
        self._task_templates = self._initialize_templates()

        logger.info(f"Initialized Planner: max_tasks={max_tasks_per_plan}")

    def create_plan(self, goal: Goal) -> Plan:
        """Create an execution plan for a goal."""
        logger.info(f"Creating plan for goal: {goal.goal_type.value}")

        # Decompose goal into tasks
        tasks = self._decompose_goal(goal)

        # Add safety checks if enabled
        if self.enable_safety_checks:
            tasks = self._add_safety_tasks(tasks, goal)

        # Order tasks by dependencies and priority
        tasks = self._order_tasks(tasks)

        # Validate the plan
        self._validate_plan(tasks)

        plan = Plan(
            id=str(uuid.uuid4())[:8],
            goal=goal,
            tasks=tasks,
        )

        logger.info(f"Created plan {plan.id} with {len(tasks)} tasks")
        return plan

    def _decompose_goal(self, goal: Goal) -> list[Task]:
        """Decompose a goal into individual tasks."""
        templates = self._task_templates.get(goal.goal_type, [])
        tasks = []

        for i, template in enumerate(templates):
            task = Task(
                id=f"{goal.id}-{i:02d}",
                name=template["name"],
                description=template["description"],
                agent_type=template["agent_type"],
                priority=template.get("priority", TaskPriority.MEDIUM),
                dependencies=[f"{goal.id}-{d:02d}" for d in template.get("depends_on", [])],
                timeout_seconds=template.get("timeout", self.default_timeout),
                input_data=dict(goal.context),
                metadata={"goal_id": goal.id},
            )
            tasks.append(task)

        return tasks

    def _add_safety_tasks(self, tasks: list[Task], goal: Goal) -> list[Task]:
        """Add safety validation tasks to the plan."""
        safety_tasks = []

        # Add input validation task at the beginning
        validation_task = Task(
            id=f"{goal.id}-safety-00",
            name="Input Validation",
            description="Validate input data for safety and completeness",
            agent_type="safety_validator",
            priority=TaskPriority.CRITICAL,
            dependencies=[],
            timeout_seconds=10,
            input_data=dict(goal.context),
        )
        safety_tasks.append(validation_task)

        # Update dependencies of first task to depend on validation
        if tasks:
            for task in tasks:
                if not task.dependencies:
                    task.dependencies.append(validation_task.id)

        # Add audit task at the end
        audit_task = Task(
            id=f"{goal.id}-safety-99",
            name="Audit Logging",
            description="Log execution results for audit trail",
            agent_type="audit_logger",
            priority=TaskPriority.HIGH,
            dependencies=[t.id for t in tasks],
            timeout_seconds=5,
        )

        return safety_tasks + tasks + [audit_task]

    def _order_tasks(self, tasks: list[Task]) -> list[Task]:
        """Order tasks by dependencies and priority using topological sort."""
        # Build dependency graph
        {t.id: t for t in tasks}
        in_degree = {t.id: len(t.dependencies) for t in tasks}

        # Find tasks with no dependencies
        queue = [t for t in tasks if in_degree[t.id] == 0]
        queue.sort(key=lambda t: t.priority.value)

        ordered = []
        while queue:
            # Get highest priority task
            task = queue.pop(0)
            ordered.append(task)

            # Update dependencies
            for other_task in tasks:
                if task.id in other_task.dependencies:
                    in_degree[other_task.id] -= 1
                    if in_degree[other_task.id] == 0:
                        queue.append(other_task)
                        queue.sort(key=lambda t: t.priority.value)

        # Check for cycles
        if len(ordered) != len(tasks):
            logger.error("Dependency cycle detected in task plan")
            raise ValueError("Task dependencies contain a cycle")

        return ordered

    def _validate_plan(self, tasks: list[Task]) -> None:
        """Validate that the plan is executable."""
        if len(tasks) > self.max_tasks_per_plan:
            raise ValueError(
                f"Plan exceeds maximum tasks: {len(tasks)} > {self.max_tasks_per_plan}"
            )

        # Check all dependencies reference valid tasks
        task_ids = {t.id for t in tasks}
        for task in tasks:
            for dep in task.dependencies:
                if dep not in task_ids:
                    raise ValueError(f"Task {task.id} has invalid dependency: {dep}")

    def replan(self, plan: Plan, failed_task: Task) -> Plan:
        """Create a recovery plan after task failure."""
        logger.info(f"Replanning after task {failed_task.id} failed")

        # Check if we can retry the failed task
        if failed_task.retries < failed_task.max_retries:
            failed_task.retries += 1
            failed_task.status = TaskStatus.PENDING
            failed_task.error_message = None
            logger.info(f"Retrying task {failed_task.id} (attempt {failed_task.retries})")
            return plan

        # If critical task failed, mark plan as failed
        if failed_task.priority == TaskPriority.CRITICAL:
            plan.status = TaskStatus.FAILED
            logger.error(f"Critical task {failed_task.id} failed, marking plan as failed")
            return plan

        # Skip non-critical failed task and dependent tasks
        failed_task.status = TaskStatus.SKIPPED
        for task in plan.tasks:
            if failed_task.id in task.dependencies:
                if task.priority != TaskPriority.CRITICAL:
                    task.status = TaskStatus.SKIPPED
                    logger.info(f"Skipping task {task.id} due to dependency failure")

        return plan

    def _initialize_templates(self) -> dict[GoalType, list[dict[str, Any]]]:
        """Initialize task templates for common goals."""
        return {
            GoalType.RISK_ASSESSMENT: [
                {
                    "name": "Collect Symptoms",
                    "description": "Gather symptom data from input",
                    "agent_type": "ingestion_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [],
                },
                {
                    "name": "Collect Vitals",
                    "description": "Gather vital signs data",
                    "agent_type": "ingestion_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [],
                },
                {
                    "name": "Compute Phenotypes",
                    "description": "Derive clinical phenotypes from raw data",
                    "agent_type": "phenotype_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [0, 1],
                },
                {
                    "name": "Apply Safety Rules",
                    "description": "Check for critical safety conditions",
                    "agent_type": "risk_agent",
                    "priority": TaskPriority.CRITICAL,
                    "depends_on": [0, 1],
                },
                {
                    "name": "ML Risk Scoring",
                    "description": "Run ML models for risk stratification",
                    "agent_type": "risk_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [2],
                    "timeout": 60,
                },
                {
                    "name": "Synthesize Risk",
                    "description": "Combine rule and ML outputs",
                    "agent_type": "risk_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [3, 4],
                },
            ],
            GoalType.GUIDELINE_LOOKUP: [
                {
                    "name": "Parse Query",
                    "description": "Extract medical entities from query",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [],
                },
                {
                    "name": "Retrieve Guidelines",
                    "description": "Search knowledge base for relevant guidelines",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [0],
                },
                {
                    "name": "Filter & Rank",
                    "description": "Filter by age-appropriateness and rank by relevance",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [1],
                },
                {
                    "name": "Generate Response",
                    "description": "Format response with citations",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.LOW,
                    "depends_on": [2],
                },
            ],
            GoalType.ESCALATION: [
                {
                    "name": "Assess Urgency",
                    "description": "Determine escalation urgency level",
                    "agent_type": "escalation_agent",
                    "priority": TaskPriority.CRITICAL,
                    "depends_on": [],
                },
                {
                    "name": "Prepare Summary",
                    "description": "Generate clinical summary for escalation",
                    "agent_type": "escalation_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [0],
                },
                {
                    "name": "Identify Recipients",
                    "description": "Determine who should receive escalation",
                    "agent_type": "escalation_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [0],
                },
                {
                    "name": "Send Notifications",
                    "description": "Dispatch escalation notifications",
                    "agent_type": "escalation_agent",
                    "priority": TaskPriority.CRITICAL,
                    "depends_on": [1, 2],
                },
                {
                    "name": "Log Escalation",
                    "description": "Record escalation in audit log",
                    "agent_type": "audit_logger",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [3],
                },
            ],
            GoalType.DATA_COLLECTION: [
                {
                    "name": "Validate Input Type",
                    "description": "Identify and validate input data type",
                    "agent_type": "ingestion_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [],
                },
                {
                    "name": "Normalize Data",
                    "description": "Normalize data to standard format",
                    "agent_type": "ingestion_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [0],
                },
                {
                    "name": "Quality Check",
                    "description": "Check data quality and completeness",
                    "agent_type": "ingestion_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [1],
                },
                {
                    "name": "Store Data",
                    "description": "Persist data with audit trail",
                    "agent_type": "ingestion_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [2],
                },
            ],
            GoalType.MONITORING: [
                {
                    "name": "Fetch Latest Data",
                    "description": "Get most recent observations",
                    "agent_type": "ingestion_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [],
                },
                {
                    "name": "Compute Trends",
                    "description": "Calculate trend indicators",
                    "agent_type": "phenotype_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [0],
                },
                {
                    "name": "Check Thresholds",
                    "description": "Compare against alert thresholds",
                    "agent_type": "risk_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [1],
                },
                {
                    "name": "Generate Report",
                    "description": "Create monitoring summary",
                    "agent_type": "escalation_agent",
                    "priority": TaskPriority.LOW,
                    "depends_on": [2],
                },
            ],
            GoalType.EDUCATION: [
                {
                    "name": "Parse Topic",
                    "description": "Identify education topic",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [],
                },
                {
                    "name": "Fetch MedlinePlus",
                    "description": "Retrieve MedlinePlus content",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [0],
                },
                {
                    "name": "Age Adaptation",
                    "description": "Adapt content for child's age",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.LOW,
                    "depends_on": [1],
                },
                {
                    "name": "Format Response",
                    "description": "Format educational response",
                    "agent_type": "guideline_rag_agent",
                    "priority": TaskPriority.LOW,
                    "depends_on": [2],
                },
            ],
            GoalType.CARE_NAVIGATION: [
                {
                    "name": "Assess Current State",
                    "description": "Evaluate current health status",
                    "agent_type": "risk_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [],
                },
                {
                    "name": "Determine Next Steps",
                    "description": "Identify recommended actions",
                    "agent_type": "escalation_agent",
                    "priority": TaskPriority.HIGH,
                    "depends_on": [0],
                },
                {
                    "name": "Check Environment",
                    "description": "Assess environmental factors",
                    "agent_type": "geo_exposure_agent",
                    "priority": TaskPriority.LOW,
                    "depends_on": [],
                },
                {
                    "name": "Generate Guidance",
                    "description": "Create actionable guidance",
                    "agent_type": "escalation_agent",
                    "priority": TaskPriority.MEDIUM,
                    "depends_on": [1, 2],
                },
            ],
        }

    def estimate_duration(self, plan: Plan) -> timedelta:
        """Estimate total plan duration."""
        # Simple estimate: sum of timeouts for non-parallel tasks
        # More sophisticated would account for parallelism
        critical_path = self._find_critical_path(plan)
        total_seconds = sum(t.timeout_seconds for t in critical_path)
        return timedelta(seconds=total_seconds)

    def _find_critical_path(self, plan: Plan) -> list[Task]:
        """Find the critical path through the task graph."""
        # Simplified: just return tasks with most dependencies
        task_map = {t.id: t for t in plan.tasks}

        # Calculate longest path to each task
        longest_path: dict[str, list[Task]] = {}

        def get_longest_path(task_id: str) -> list[Task]:
            if task_id in longest_path:
                return longest_path[task_id]

            task = task_map.get(task_id)
            if not task:
                return []

            if not task.dependencies:
                longest_path[task_id] = [task]
                return [task]

            # Find longest path among dependencies
            max_path: list[Task] = []
            for dep_id in task.dependencies:
                dep_path = get_longest_path(dep_id)
                if len(dep_path) > len(max_path):
                    max_path = dep_path

            longest_path[task_id] = max_path + [task]
            return longest_path[task_id]

        # Find task with longest path
        max_path: list[Task] = []
        for task in plan.tasks:
            path = get_longest_path(task.id)
            if len(path) > len(max_path):
                max_path = path

        return max_path
