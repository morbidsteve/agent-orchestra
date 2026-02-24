"""Pydantic models mirroring the frontend TypeScript types."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────────────────────────────────────
# Enum-like Literal types (matching TypeScript string unions)
# ──────────────────────────────────────────────────────────────────────────────

ExecutionStatus = Literal["running", "completed", "failed", "queued"]
PipelinePhase = Literal["plan", "develop", "test", "security", "report"]
PhaseStatus = Literal["pending", "running", "completed", "failed", "skipped"]
AgentRole = str
AgentStatus = Literal["idle", "busy", "offline"]
FindingSeverity = Literal["critical", "high", "medium", "low", "info"]
FindingType = Literal["security", "quality", "performance", "compliance"]
FindingStatus = Literal["open", "resolved", "dismissed"]
WorkflowType = Literal[
    "full-pipeline", "code-review", "security-audit", "feature-eval", "quick-fix"
]


# ──────────────────────────────────────────────────────────────────────────────
# camelCase alias helper
# ──────────────────────────────────────────────────────────────────────────────


def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class ProjectSource(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)
    type: Literal["local", "git", "new"]
    path: str = ""


# ──────────────────────────────────────────────────────────────────────────────
# Domain models
# ──────────────────────────────────────────────────────────────────────────────


class PipelineStep(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    phase: PipelinePhase
    status: PhaseStatus = "pending"
    agent_role: AgentRole | None = None
    started_at: str | None = None
    completed_at: str | None = None
    output: list[str] = Field(default_factory=list)


class AgentActivity(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    id: str
    agent_role: AgentRole
    action: str
    output: list[str] = Field(default_factory=list)
    files_modified: list[str] = Field(default_factory=list)
    started_at: str
    completed_at: str | None = None
    status: PhaseStatus = "pending"


class Execution(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    id: str
    workflow: WorkflowType
    task: str
    status: ExecutionStatus = "queued"
    model: str = "sonnet"
    target: str = ""
    project_source: ProjectSource | None = None
    resolved_project_path: str = ""
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    pipeline: list[PipelineStep] = Field(default_factory=list)
    activities: list[AgentActivity] = Field(default_factory=list)
    findings: list[str] = Field(default_factory=list)


class AgentInfo(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    role: AgentRole
    name: str
    description: str
    status: AgentStatus = "idle"
    capabilities: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    color: str = ""
    icon: str = ""
    is_custom: bool = False
    current_execution: str | None = None
    completed_tasks: int = 0
    success_rate: float = 100.0


class Finding(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    id: str
    execution_id: str
    type: FindingType
    severity: FindingSeverity
    status: FindingStatus = "open"
    title: str
    description: str
    file: str = ""
    line: int | None = None
    remediation: str = ""
    agent: AgentRole
    created_at: str


# ──────────────────────────────────────────────────────────────────────────────
# Request / Response models
# ──────────────────────────────────────────────────────────────────────────────


class CreateAgentRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    name: str = Field(max_length=100)
    description: str = Field(default="", max_length=500)
    capabilities: list[str] = Field(default_factory=list, max_length=20)
    tools: list[str] = Field(default_factory=list, max_length=20)
    color: str = Field(default="#6b7280", pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str = "Bot"


class CreateExecutionRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    workflow: WorkflowType
    task: str = Field(max_length=10000)
    model: Literal["sonnet", "opus", "haiku"] = "sonnet"
    target: str = Field(default="", max_length=500)
    project_source: ProjectSource | None = None
    github_url: str | None = None  # Clone from GitHub
    codebase_id: str | None = None  # Reuse existing codebase


class WebSocketMessage(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    type: Literal[
        "output", "phase", "finding", "complete",
        "agent-status", "agent-connection",
        "console-text", "clarification",
        "execution-start", "screenshot", "business-eval",
    ]
    line: str | None = None
    phase: str | None = None
    status: str | None = None
    finding: dict | None = None
    # Agent office fields
    agent_role: str | None = None
    visual_status: str | None = None
    current_task: str | None = None
    # Agent connection fields
    from_agent: str | None = Field(None, alias="from")
    to_agent: str | None = Field(None, alias="to")
    label: str | None = None
    active: bool | None = None
    data_flow: str | None = None
    # Console fields
    text: str | None = None
    message_id: str | None = None
    question: str | None = None
    options: list[str] | None = None
    required: bool | None = None
    # Execution start
    execution_id: str | None = None
    # Screenshot
    screenshot: dict | None = None
    # Business eval
    section: str | None = None
    data: dict | None = None


class BrowseResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    current: str
    parent: str | None = None
    directories: list[str] = Field(default_factory=list)
    truncated: bool = False


# ──────────────────────────────────────────────────────────────────────────────
# Conversation models (Phase 1)
# ──────────────────────────────────────────────────────────────────────────────


class ConversationMessageRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    text: str = Field(max_length=10000)
    conversation_id: str | None = None
    project_source: ProjectSource | None = None
    model: Literal["sonnet", "opus", "haiku"] = "sonnet"


class ScreenshotRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    execution_id: str
    type: Literal["terminal", "browser"] = "terminal"
    phase: str = ""
    milestone: str = ""
    terminal_lines: list[str] = Field(default_factory=list)
    url: str | None = None


# ──────────────────────────────────────────────────────────────────────────────
# Dynamic agent models
# ──────────────────────────────────────────────────────────────────────────────


class SpawnAgentRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    execution_id: str
    role: str  # e.g. "developer", "tester", "security-reviewer", custom roles too
    name: str  # e.g. "Developer Alpha", "Test Runner"
    task: str  # The specific task for this agent
    wait: bool = True  # If True, block until agent completes; if False, return agent_id immediately
    model: str | None = None  # Override model for this agent


class SpawnAgentResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    agent_id: str
    status: str  # 'pending' | 'running' | 'completed' | 'failed'
    output: str | None = None  # Final output if wait=True and completed


class CodebaseRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    name: str
    git_url: str | None = None
    path: str | None = None  # Existing local path


class CodebaseResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    id: str
    name: str
    path: str
    git_url: str | None = None
    execution_ids: list[str] = Field(default_factory=list)
    created_at: str
