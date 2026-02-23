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


class WebSocketMessage(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

    type: Literal["output", "phase", "finding", "complete"]
    line: str | None = None
    phase: str | None = None
    status: str | None = None
    finding: dict | None = None
