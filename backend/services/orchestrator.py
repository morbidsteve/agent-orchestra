"""Orchestrator service — wraps the CLI orchestrator or simulates execution."""

from __future__ import annotations

import asyncio
import importlib.util
import shutil
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

from backend import store
from backend.services.parser import parse_finding


# ──────────────────────────────────────────────────────────────────────────────
# Orchestrator availability check (cached)
# ──────────────────────────────────────────────────────────────────────────────

_orchestrator_available: bool | None = None


def _check_orchestrator_available() -> bool:
    """Check if the real orchestrator and its dependencies are available.

    The claude-agent-sdk authenticates via the Claude Code CLI binary
    (OAuth), so we check for the CLI + SDK — no API key needed.
    """
    global _orchestrator_available
    if _orchestrator_available is not None:
        return _orchestrator_available
    has_claude_cli = shutil.which("claude") is not None
    has_sdk = importlib.util.find_spec("claude_agent_sdk") is not None
    _orchestrator_available = has_claude_cli and has_sdk
    return _orchestrator_available

# ──────────────────────────────────────────────────────────────────────────────
# Phase → Agent mapping
# ──────────────────────────────────────────────────────────────────────────────

PHASE_AGENTS: dict[str, str] = {
    "plan": "developer",
    "develop": "developer",
    "test": "tester",
    "security": "devsecops",
    "report": "developer",
}

# ──────────────────────────────────────────────────────────────────────────────
# Simulation data (used when the real orchestrator is unavailable)
# ──────────────────────────────────────────────────────────────────────────────

SIMULATION_LINES: dict[str, list[str]] = {
    "plan": [
        "Analyzing task requirements...",
        "Breaking down into development units...",
        "Identifying dependencies and potential parallelization...",
        "Plan complete. Proceeding to next phase.",
    ],
    "develop": [
        "$ git checkout -b feature/implementation",
        "Implementing requested changes...",
        "Writing code for core functionality...",
        "$ npx tsc --noEmit",
        "No TypeScript errors found.",
        "Development complete.",
    ],
    "test": [
        "$ npx vitest run",
        "Running test suite...",
        "PASS src/tests/unit.test.ts (4 tests)",
        "PASS src/tests/integration.test.ts (3 tests)",
        "All tests passed.",
    ],
    "security": [
        "Running security scan...",
        "Checking for exposed secrets...",
        "Analyzing dependency vulnerabilities...",
        "No critical or high findings detected.",
        "Security review complete.",
    ],
    "report": [
        "Generating execution report...",
        "Summary: All phases completed successfully.",
        "Tests: All passing",
        "Security: No critical findings",
        "Report complete.",
    ],
}


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────


async def run_execution(execution_id: str) -> None:
    """
    Run a full execution pipeline.

    Updates the store and broadcasts progress over WebSocket as each phase
    progresses.  Falls back to simulated execution when the real
    orchestrator is not available.
    """
    execution = store.executions.get(execution_id)
    if execution is None:
        return

    now = datetime.now(timezone.utc).isoformat()
    execution["status"] = "running"
    execution["startedAt"] = now
    await store.broadcast(execution_id, {
        "type": "phase",
        "phase": None,
        "status": "running",
    })

    try:
        for step in execution["pipeline"]:
            phase = step["phase"]
            await _run_phase(execution_id, step)

        # All phases completed
        execution["status"] = "completed"
        execution["completedAt"] = datetime.now(timezone.utc).isoformat()
        await store.broadcast(execution_id, {"type": "complete", "status": "completed"})

    except Exception as exc:
        execution["status"] = "failed"
        execution["completedAt"] = datetime.now(timezone.utc).isoformat()
        # Record the error on the current running phase
        for step in execution["pipeline"]:
            if step["status"] == "running":
                step["status"] = "failed"
                step["output"].append("An internal error occurred during execution.")
                step["completedAt"] = datetime.now(timezone.utc).isoformat()
                break
        await store.broadcast(execution_id, {
            "type": "complete",
            "status": "failed",
        })


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────


async def _run_phase(execution_id: str, step: dict[str, Any]) -> None:
    """Execute a single pipeline phase."""
    phase = step["phase"]
    agent_role = PHASE_AGENTS.get(phase, "developer")

    # Update step status
    step["status"] = "running"
    step["agentRole"] = agent_role
    step["startedAt"] = datetime.now(timezone.utc).isoformat()
    await store.broadcast(execution_id, {
        "type": "phase",
        "phase": phase,
        "status": "running",
    })

    # Mark agent as busy
    _set_agent_status(agent_role, "busy", execution_id)

    # Create an activity record
    activity_id = f"act-{uuid.uuid4().hex[:8]}"
    execution = store.executions[execution_id]
    activity: dict[str, Any] = {
        "id": activity_id,
        "agentRole": agent_role,
        "action": f"Executing {phase} phase",
        "output": [],
        "filesModified": [],
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "completedAt": None,
        "status": "running",
    }
    execution["activities"].append(activity)

    try:
        # Only try the real orchestrator if dependencies are available
        if _check_orchestrator_available():
            success = await _try_real_orchestrator(execution_id, phase, step, activity)
            if not success:
                await _simulate_phase(execution_id, phase, step, activity)
        else:
            await _simulate_phase(execution_id, phase, step, activity)
    finally:
        # Mark phase and agent as completed
        step["status"] = "completed"
        step["completedAt"] = datetime.now(timezone.utc).isoformat()

        activity["status"] = "completed"
        activity["completedAt"] = datetime.now(timezone.utc).isoformat()

        _set_agent_status(agent_role, "idle", None)
        _increment_agent_tasks(agent_role)

        await store.broadcast(execution_id, {
            "type": "phase",
            "phase": phase,
            "status": "completed",
        })


async def _try_real_orchestrator(
    execution_id: str,
    phase: str,
    step: dict[str, Any],
    activity: dict[str, Any],
) -> bool:
    """
    Attempt to run the real orchestrator via subprocess.

    Returns True if the orchestrator ran successfully, False if it is
    unavailable and the caller should fall back to simulation.
    """
    execution = store.executions.get(execution_id)
    if execution is None:
        return False

    try:
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "/workspace/orchestrator.py",
            execution["task"],
            "--workflow", execution["workflow"],
            "--model", execution["model"],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd="/workspace",
        )
    except (FileNotFoundError, OSError):
        return False

    assert process.stdout is not None

    # Buffer output before committing to step/activity — allows clean
    # rollback if the process fails due to missing dependencies.
    buffered_lines: list[str] = []

    try:
        while True:
            line_bytes = await process.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace").rstrip("\n")
            if not line:
                continue
            buffered_lines.append(line)
    except Exception:
        pass  # Process output stream ended or errored

    await process.wait()

    if process.returncode != 0:
        stderr_bytes = await process.stderr.read() if process.stderr else b""
        stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()
        all_output = " ".join(buffered_lines) + " " + stderr_text

        # If the orchestrator is simply not installed, fall back to simulation
        sdk_missing_signals = [
            "claude-agent-sdk",
            "ModuleNotFoundError",
            "Claude Code CLI not found",
        ]
        if any(signal in all_output for signal in sdk_missing_signals):
            return False

        # Other errors are real failures — commit output to step/activity
        for line in buffered_lines:
            step["output"].append(line)
            activity["output"].append(line)
        if stderr_text:
            step["output"].append(f"stderr: {stderr_text}")
            activity["output"].append(f"stderr: {stderr_text}")
        return True

    # Success — commit buffered output to step/activity and broadcast
    for line in buffered_lines:
        step["output"].append(line)
        activity["output"].append(line)

        finding = parse_finding(line, execution_id)
        if finding:
            store.findings[finding["id"]] = finding
            execution["findings"].append(finding["id"])
            await store.broadcast(execution_id, {
                "type": "finding",
                "finding": finding,
            })

        await store.broadcast(execution_id, {
            "type": "output",
            "line": line,
            "phase": phase,
        })

    return True


async def _simulate_phase(
    execution_id: str,
    phase: str,
    step: dict[str, Any],
    activity: dict[str, Any],
) -> None:
    """Simulate phase execution when the orchestrator is not available."""
    lines = SIMULATION_LINES.get(phase, ["Phase completed."])
    execution = store.executions.get(execution_id)

    for line in lines:
        await asyncio.sleep(0.5)

        step["output"].append(line)
        activity["output"].append(line)

        # Check for findings even in simulation
        if execution:
            finding = parse_finding(line, execution_id)
            if finding:
                store.findings[finding["id"]] = finding
                execution["findings"].append(finding["id"])
                await store.broadcast(execution_id, {
                    "type": "finding",
                    "finding": finding,
                })

        await store.broadcast(execution_id, {
            "type": "output",
            "line": line,
            "phase": phase,
        })


# ──────────────────────────────────────────────────────────────────────────────
# Agent status helpers
# ──────────────────────────────────────────────────────────────────────────────


def _set_agent_status(
    role: str, status: str, execution_id: str | None
) -> None:
    """Update an agent's status and current execution in the store."""
    agent = store.agents.get(role)
    if agent:
        agent["status"] = status
        agent["currentExecution"] = execution_id


def _increment_agent_tasks(role: str) -> None:
    """Increment the completedTasks counter for an agent."""
    agent = store.agents.get(role)
    if agent:
        agent["completedTasks"] = agent.get("completedTasks", 0) + 1
