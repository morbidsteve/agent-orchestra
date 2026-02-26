"""Execution management routes."""

from __future__ import annotations

import asyncio
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend import models, store
from backend.config import settings
from backend.models import CreateExecutionRequest
from backend.services.dynamic_orchestrator import run_dynamic_execution
from backend.services.orchestrator import run_execution

router = APIRouter(prefix="/api/executions", tags=["executions"])

# Concurrency limiter — at most 5 executions running simultaneously
_execution_semaphore = asyncio.Semaphore(5)


async def _limited_run(execution_id: str) -> None:
    """Run an execution under the concurrency semaphore.

    Prefers the dynamic orchestrator (Claude CLI session with MCP tools).
    Falls back to the static pipeline if the dynamic orchestrator fails.
    """
    async with _execution_semaphore:
        try:
            await run_dynamic_execution(execution_id)
        except Exception:
            pass  # Fall through to status check below

        # If the dynamic orchestrator didn't complete successfully
        # (it catches its own exceptions internally), fall back to the fixed pipeline.
        execution = store.executions.get(execution_id)
        if execution and execution.get("status") != "completed":
            # Reset execution state for a fresh pipeline run
            execution["status"] = "queued"
            execution["startedAt"] = None
            await run_execution(execution_id)

# ──────────────────────────────────────────────────────────────────────────────
# Workflow → pipeline groups (each group runs in parallel)
# ──────────────────────────────────────────────────────────────────────────────

WORKFLOW_PIPELINES: dict[str, list[list[tuple[str, str]]]] = {
    "full-pipeline": [
        [("plan", "developer")],
        [("develop", "developer"), ("develop-2", "developer-2")],
        [("test", "tester"), ("security", "devsecops")],
        [("report", "developer")],
    ],
    "code-review": [
        [("develop", "developer"), ("test", "tester"), ("security", "devsecops")],
        [("report", "developer")],
    ],
    "security-audit": [
        [("plan", "developer")],
        [("security", "devsecops")],
        [("report", "developer")],
    ],
    "feature-eval": [
        [("plan", "developer")],
        [("develop", "developer"), ("business-eval", "business-dev")],
        [("report", "developer")],
    ],
    "quick-fix": [
        [("develop", "developer")],
        [("test", "tester"), ("security", "devsecops")],
        [("report", "developer")],
    ],
    "turbo-pipeline": [
        [("develop", "developer"), ("develop-2", "developer-2")],
        [("test", "tester"), ("security", "devsecops")],
        [("report", "developer")],
    ],
}


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/")
async def list_executions(conversation_id: str | None = None) -> list[dict]:
    """Return executions, optionally filtered by conversation_id."""
    items = list(store.executions.values())
    if conversation_id is not None:
        items = [e for e in items if e.get("conversationId") == conversation_id]
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
    from backend.services.sandbox import get_sandbox_status

    status = get_sandbox_status()
    if not status.sandboxed and not status.override_active:
        raise HTTPException(
            status_code=403,
            detail=(
                "Agent execution blocked: no container sandbox detected. "
                "Agents run with --dangerously-skip-permissions and need container isolation. "
                "Run inside a devcontainer or Docker, or set ORCHESTRA_ALLOW_HOST=true to override."
            ),
        )

    exec_id = store.next_execution_id()
    now = datetime.now(timezone.utc).isoformat()

    groups = WORKFLOW_PIPELINES.get(req.workflow, WORKFLOW_PIPELINES["full-pipeline"])
    pipeline = []
    for group_idx, group in enumerate(groups):
        for phase, agent_role in group:
            pipeline.append({
                "phase": phase,
                "group": group_idx,
                "status": "pending",
                "agentRole": agent_role,
                "startedAt": None,
                "completedAt": None,
                "output": [],
            })

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
        "conversationId": None,
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


# ──────────────────────────────────────────────────────────────────────────────
# Dynamic agent endpoints
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/{execution_id}/agents")
async def get_execution_agents(execution_id: str) -> list[dict]:
    """List dynamic agents for an execution."""
    agents = store.dynamic_agents.get(execution_id, {})
    # Strip internal fields like result_event
    return [
        {k: v for k, v in agent.items() if k != "result_event"}
        for agent in agents.values()
    ]


@router.get("/{execution_id}/files")
async def get_execution_files(execution_id: str) -> list[dict]:
    """Get file activity for an execution."""
    return store.file_activities.get(execution_id, [])


# ──────────────────────────────────────────────────────────────────────────────
# Codebase CRUD endpoints
# ──────────────────────────────────────────────────────────────────────────────

_codebase_router = APIRouter(prefix="/api/codebases", tags=["codebases"])


@_codebase_router.post("/", status_code=201)
async def create_codebase(req: models.CodebaseRequest) -> dict:
    """Register a codebase (optionally clone from GitHub)."""
    codebase_id = store.next_codebase_id()
    now = datetime.now(timezone.utc).isoformat()

    if req.git_url:
        # Validate URL scheme — only allow https:// to prevent SSRF
        if not req.git_url.startswith("https://"):
            raise HTTPException(status_code=422, detail="Only https:// git URLs are allowed")
        # Clone repo with depth limit and timeout
        clone_dir = Path(os.path.expanduser(settings.PROJECTS_DIR)) / f"codebase-{codebase_id}"
        clone_dir.parent.mkdir(parents=True, exist_ok=True)
        process = await asyncio.create_subprocess_exec(
            "git", "clone", "--depth", "1",
            "--config", "core.hooksPath=/dev/null",
            req.git_url, str(clone_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            await asyncio.wait_for(process.wait(), timeout=120)
        except asyncio.TimeoutError:
            process.kill()
            raise HTTPException(status_code=422, detail="Git clone timed out")
        if process.returncode != 0:
            raise HTTPException(status_code=422, detail="Git clone failed")
        path = str(clone_dir)
    elif req.path:
        # Validate path is within allowed directories
        real_path = os.path.realpath(req.path)
        allowed_roots = [os.path.realpath("/workspace"), os.path.realpath(os.path.expanduser(settings.PROJECTS_DIR))]
        if not any(real_path.startswith(root) for root in allowed_roots):
            raise HTTPException(status_code=422, detail="Path must be within /workspace or projects directory")
        if not os.path.isdir(real_path):
            raise HTTPException(status_code=422, detail=f"Path not found: {req.path}")
        path = real_path
    else:
        path = str(Path(os.path.expanduser(settings.PROJECTS_DIR)) / f"codebase-{codebase_id}")
        Path(path).mkdir(parents=True, exist_ok=True)

    codebase = {
        "id": codebase_id,
        "name": req.name,
        "path": path,
        "gitUrl": req.git_url,
        "executionIds": [],
        "createdAt": now,
    }
    store.codebases[codebase_id] = codebase
    return codebase


@_codebase_router.get("/")
async def list_codebases() -> list[dict]:
    """List all registered codebases."""
    return list(store.codebases.values())
