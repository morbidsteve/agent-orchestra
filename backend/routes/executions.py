"""Execution management routes."""

from __future__ import annotations

import asyncio
import os
import subprocess
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend import store
from backend.config import settings
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

    resolved_path = ""
    project_source_dict = None

    if req.project_source is not None:
        ps = req.project_source
        project_source_dict = {"type": ps.type, "path": ps.path}

        if ps.type == "local":
            abs_path = os.path.abspath(ps.path)
            if not os.path.isdir(abs_path):
                raise HTTPException(status_code=422, detail=f"Local path not found: {abs_path}")
            resolved_path = abs_path

        elif ps.type == "git":
            repo_name = ps.path.rstrip("/").rsplit("/", 1)[-1]
            if repo_name.endswith(".git"):
                repo_name = repo_name[:-4]
            if not repo_name:
                raise HTTPException(status_code=422, detail="Invalid git URL")
            clone_dir = os.path.join(settings.PROJECTS_DIR, f"{exec_id}_{repo_name}")
            os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
            try:
                subprocess.run(
                    ["git", "clone", "--depth", "1", ps.path, clone_dir],
                    check=True, capture_output=True, timeout=120,
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
                raise HTTPException(status_code=422, detail=f"Failed to clone: {exc}")
            resolved_path = clone_dir

        elif ps.type == "new":
            new_dir = os.path.join(settings.PROJECTS_DIR, exec_id)
            os.makedirs(new_dir, exist_ok=True)
            resolved_path = new_dir

    execution: dict = {
        "id": exec_id,
        "workflow": req.workflow,
        "task": req.task,
        "status": "queued",
        "model": req.model,
        "target": req.target,
        "projectSource": project_source_dict,
        "resolvedProjectPath": resolved_path,
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
