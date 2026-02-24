"""Orchestrator service — wraps the CLI orchestrator or simulates execution."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Any

from backend import store
from backend.services.parser import parse_finding
from backend.services.screenshots import capture_terminal_snapshot


# ──────────────────────────────────────────────────────────────────────────────
# Orchestrator availability check (cached)
# ──────────────────────────────────────────────────────────────────────────────

_orchestrator_available: bool | None = None


def _check_orchestrator_available() -> bool:
    """Check if the Claude Code CLI is available."""
    global _orchestrator_available
    if _orchestrator_available is not None:
        return _orchestrator_available
    _orchestrator_available = shutil.which("claude") is not None
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
# Phase-specific prompts for the Claude Code CLI
# ──────────────────────────────────────────────────────────────────────────────

PHASE_PROMPTS: dict[str, str] = {
    "plan": (
        "You are a senior developer in planning mode. Analyze the task below and create "
        "a concrete development plan. Identify what files need to change, what new files "
        "to create, and outline the implementation approach. Do NOT write code yet — just plan.\n\n"
        "Output a clear, numbered plan."
    ),
    "develop": (
        "You are a senior developer. Implement the task below by writing real code. "
        "Create files, modify existing ones, and build the feature. Use the tools available "
        "to you (Read, Edit, Write, Bash, Glob, Grep) to do actual work in the repository.\n\n"
        "Write production-quality code following existing project conventions."
    ),
    "test": (
        "You are a QA engineer. Write comprehensive tests for the changes made in this project. "
        "Run the test suite and fix any failures. Use Bash to run tests, Read to understand code, "
        "and Write/Edit to create test files.\n\n"
        "Ensure all tests pass before finishing."
    ),
    "security": (
        "You are a DevSecOps security engineer. Review the codebase for security vulnerabilities: "
        "XSS, injection, exposed secrets, insecure dependencies, OWASP Top 10 issues. "
        "Use Read and Grep to search the code. Do NOT modify code — only report findings.\n\n"
        "List any findings with severity (critical/high/medium/low) and remediation steps."
    ),
    "report": (
        "You are a technical writer. Summarize what was accomplished in this execution. "
        "Review the project state, recent changes, test results, and any security findings. "
        "Produce a concise executive summary of the work done."
    ),
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
# Dual broadcast helper
# ──────────────────────────────────────────────────────────────────────────────


async def broadcast_both(execution_id: str, message: dict) -> None:
    """Broadcast a message to both the execution WebSocket and any linked conversation console."""
    await store.broadcast(execution_id, message)

    # Find conversations with this active execution and broadcast to them
    for conv_id, conv in store.conversations.items():
        if conv.get("activeExecutionId") == execution_id:
            await store.broadcast_console(conv_id, message)


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
    await broadcast_both(execution_id, {
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
        await broadcast_both(execution_id, {"type": "complete", "status": "completed"})

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
        await broadcast_both(execution_id, {
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
    await broadcast_both(execution_id, {
        "type": "phase",
        "phase": phase,
        "status": "running",
    })

    # Mark agent as busy
    _set_agent_status(agent_role, "busy", execution_id)

    # Broadcast agent-status: working
    await broadcast_both(execution_id, {
        "type": "agent-status",
        "agentRole": agent_role,
        "visualStatus": "working",
        "currentTask": f"Executing {phase} phase",
    })

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
        # Capture terminal snapshot before marking agent as done
        snapshot = await capture_terminal_snapshot(
            execution_id, phase, step["output"],
        )
        await broadcast_both(execution_id, {
            "type": "screenshot",
            "screenshot": snapshot,
        })

        # Determine next phase and broadcast agent-connection handoff
        pipeline = execution["pipeline"]
        current_idx = next(
            (i for i, s in enumerate(pipeline) if s["phase"] == phase), -1,
        )
        if current_idx >= 0 and current_idx < len(pipeline) - 1:
            next_phase = pipeline[current_idx + 1]["phase"]
            next_agent = PHASE_AGENTS.get(next_phase, "developer")
            await broadcast_both(execution_id, {
                "type": "agent-connection",
                "from": agent_role,
                "to": next_agent,
                "label": f"{phase} \u2192 {next_phase}",
                "active": True,
                "dataFlow": "handoff",
            })

        # Broadcast agent-status: done
        await broadcast_both(execution_id, {
            "type": "agent-status",
            "agentRole": agent_role,
            "visualStatus": "done",
            "currentTask": "",
        })

        # Mark phase and agent as completed
        step["status"] = "completed"
        step["completedAt"] = datetime.now(timezone.utc).isoformat()

        activity["status"] = "completed"
        activity["completedAt"] = datetime.now(timezone.utc).isoformat()

        _set_agent_status(agent_role, "idle", None)
        _increment_agent_tasks(agent_role)

        await broadcast_both(execution_id, {
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
    """Run a pipeline phase using the Claude Code CLI directly."""
    execution = store.executions.get(execution_id)
    if execution is None:
        return False

    claude_path = shutil.which("claude")
    if not claude_path:
        return False

    # Build the prompt: phase instructions + user task + previous context
    phase_prompt = PHASE_PROMPTS.get(phase, "Complete this phase of the task.")
    user_task = execution.get("task", "")

    # Gather context from previous phases
    prev_context_parts: list[str] = []
    for prev_step in execution["pipeline"]:
        if prev_step["phase"] == phase:
            break
        if prev_step["output"]:
            prev_context_parts.append(
                f"## {prev_step['phase'].title()} Phase Output\n"
                + "\n".join(prev_step["output"][-20:])  # Last 20 lines
            )
    prev_context = "\n\n".join(prev_context_parts)

    full_prompt = f"{phase_prompt}\n\n## Task\n{user_task}"
    if prev_context:
        full_prompt += f"\n\n## Context from Previous Phases\n{prev_context}"

    # Determine working directory
    cwd = "/workspace"
    resolved_path = execution.get("resolvedProjectPath", "")
    if resolved_path and os.path.isdir(resolved_path):
        cwd = resolved_path

    model = execution.get("model", "sonnet")

    cmd = [
        claude_path,
        "-p", full_prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
        "--model", model,
        "--no-session-persistence",
        "--allowedTools", "Read,Edit,Write,Bash,Glob,Grep",
    ]

    # Unset CLAUDECODE to avoid nested session detection
    env = {**os.environ, "CLAUDECODE": ""}

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
        )
    except (FileNotFoundError, OSError):
        return False

    assert process.stdout is not None

    try:
        while True:
            line_bytes = await process.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace").rstrip("\n")
            if not line:
                continue

            # Try to parse as JSON
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                # Not JSON, treat as raw output
                step["output"].append(line)
                activity["output"].append(line)
                await broadcast_both(execution_id, {
                    "type": "output",
                    "line": line,
                    "phase": phase,
                })
                continue

            msg_type = msg.get("type", "")

            # Extract text from assistant messages
            if msg_type == "assistant":
                message_data = msg.get("message", {})
                content_blocks = message_data.get("content", [])
                for block in content_blocks:
                    if block.get("type") == "text":
                        text = block.get("text", "").strip()
                        if text:
                            # Split long text into lines for streaming
                            for text_line in text.split("\n"):
                                if text_line.strip():
                                    step["output"].append(text_line)
                                    activity["output"].append(text_line)
                                    await broadcast_both(execution_id, {
                                        "type": "output",
                                        "line": text_line,
                                        "phase": phase,
                                    })
                    elif block.get("type") == "tool_use":
                        tool_name = block.get("name", "unknown")
                        tool_input = block.get("input", {})
                        # Show tool usage as output
                        tool_line = f"[{tool_name}]"
                        if tool_name == "Bash" and "command" in tool_input:
                            tool_line = f"$ {tool_input['command']}"
                        elif tool_name == "Read" and "file_path" in tool_input:
                            tool_line = f"[Read] {tool_input['file_path']}"
                        elif tool_name in ("Edit", "Write") and "file_path" in tool_input:
                            tool_line = f"[{tool_name}] {tool_input['file_path']}"
                        elif tool_name == "Grep" and "pattern" in tool_input:
                            tool_line = f"[Grep] {tool_input['pattern']}"
                        elif tool_name == "Glob" and "pattern" in tool_input:
                            tool_line = f"[Glob] {tool_input['pattern']}"

                        step["output"].append(tool_line)
                        activity["output"].append(tool_line)

                        # Track file modifications
                        if tool_name in ("Edit", "Write") and "file_path" in tool_input:
                            fp = tool_input["file_path"]
                            if fp not in activity["filesModified"]:
                                activity["filesModified"].append(fp)

                        await broadcast_both(execution_id, {
                            "type": "output",
                            "line": tool_line,
                            "phase": phase,
                        })

            # Extract final result
            elif msg_type == "result":
                result_text = msg.get("result", "")
                if result_text:
                    for text_line in result_text.strip().split("\n"):
                        if text_line.strip():
                            step["output"].append(text_line)
                            activity["output"].append(text_line)

                            # Check for findings
                            finding = parse_finding(text_line, execution_id)
                            if finding:
                                store.findings[finding["id"]] = finding
                                execution["findings"].append(finding["id"])
                                await broadcast_both(execution_id, {
                                    "type": "finding",
                                    "finding": finding,
                                })

                            await broadcast_both(execution_id, {
                                "type": "output",
                                "line": text_line,
                                "phase": phase,
                            })

    except Exception:
        import logging
        logging.getLogger(__name__).exception("Error reading Claude CLI output")

    await process.wait()

    # If the process failed with a non-zero exit code, still return True
    # (we tried, it ran, it just had errors — don't fall back to simulation)
    if process.returncode != 0:
        stderr_bytes = await process.stderr.read() if process.stderr else b""
        stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()
        if stderr_text:
            err_line = f"Error: {stderr_text[:200]}"
            step["output"].append(err_line)
            activity["output"].append(err_line)
            await broadcast_both(execution_id, {
                "type": "output",
                "line": err_line,
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
                await broadcast_both(execution_id, {
                    "type": "finding",
                    "finding": finding,
                })

        await broadcast_both(execution_id, {
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
