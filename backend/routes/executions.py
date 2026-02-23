"""Execution management routes."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend import store
from backend.models import CreateExecutionRequest
from backend.services.orchestrator import run_execution

router = APIRouter(prefix="/api/executions", tags=["executions"])

# Concurrency limiter — at most 5 executions running simultaneously
_execution_semaphore = asyncio.Semaphore(5)


async def _limited_run(execution_id: str) -> None:
    """Run an execution under the concurrency semaphore."""
    async with _execution_semaphore:
        await run_execution(execution_id)

# ──────────────────────────────────────────────────────────────────────────────
# Workflow → pipeline phases mapping (matches frontend constants)
# ──────────────────────────────────────────────────────────────────────────────

WORKFLOW_PHASES: dict[str, list[str]] = {
    "full-pipeline": ["plan", "develop", "test", "security", "report"],
    "code-review": ["plan", "develop", "test", "security", "report"],
    "security-audit": ["plan", "security", "report"],
    "feature-eval": ["plan", "develop", "report"],
    "quick-fix": ["develop", "test", "report"],
}

# Phase → default agent role mapping
PHASE_AGENTS: dict[str, str] = {
    "plan": "developer",
    "develop": "developer",
    "test": "tester",
    "security": "devsecops",
    "report": "developer",
}


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/")
async def list_executions() -> list[dict]:
    """Return all executions, sorted by createdAt descending."""
    items = list(store.executions.values())
    items.sort(key=lambda e: e.get("createdAt", ""), reverse=True)
    return items


@router.get("/{execution_id}")
async def get_execution(execution_id: str) -> dict:
    """Return a single execution by ID."""
    execution = store.executions.get(execution_id)
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution


@router.post("/", status_code=201)
async def create_execution(req: CreateExecutionRequest) -> dict:
    """Create a new execution and launch it as a background task."""
    exec_id = store.next_execution_id()
    now = datetime.now(timezone.utc).isoformat()

    phases = WORKFLOW_PHASES.get(req.workflow, WORKFLOW_PHASES["full-pipeline"])
    pipeline = [
        {
            "phase": phase,
            "status": "pending",
            "agentRole": PHASE_AGENTS.get(phase),
            "startedAt": None,
            "completedAt": None,
            "output": [],
        }
        for phase in phases
    ]

    execution: dict = {
        "id": exec_id,
        "workflow": req.workflow,
        "task": req.task,
        "status": "queued",
        "model": req.model,
        "target": req.target,
        "createdAt": now,
        "startedAt": None,
        "completedAt": None,
        "pipeline": pipeline,
        "activities": [],
        "findings": [],
    }

    store.executions[exec_id] = execution

    # Launch the execution in the background (with concurrency limit)
    asyncio.create_task(_limited_run(exec_id))

    return execution
