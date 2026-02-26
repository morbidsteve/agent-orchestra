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
    "develop-2": "developer-2",
    "test": "tester",
    "security": "devsecops",
    "business-eval": "business-dev",
    "report": "developer",
}

# Role metadata for dynamic agent-spawn events (color, icon, display name)
PHASE_AGENTS_INFO: dict[str, dict[str, str]] = {
    "developer": {"name": "Developer", "color": "#3b82f6", "icon": "Terminal"},
    "developer-2": {"name": "Developer 2", "color": "#06b6d4", "icon": "Code"},
    "tester": {"name": "Tester", "color": "#22c55e", "icon": "FlaskConical"},
    "devsecops": {"name": "DevSecOps", "color": "#f97316", "icon": "Shield"},
    "business-dev": {"name": "Business Dev", "color": "#a855f7", "icon": "Briefcase"},
    "frontend-dev": {"name": "Frontend Dev", "color": "#ec4899", "icon": "Palette"},
    "backend-dev": {"name": "Backend Dev", "color": "#8b5cf6", "icon": "Server"},
    "devops": {"name": "DevOps", "color": "#eab308", "icon": "Container"},
}

# ──────────────────────────────────────────────────────────────────────────────
# Phase-specific prompts for the Claude Code CLI
# ──────────────────────────────────────────────────────────────────────────────

_AUTONOMOUS_PREAMBLE = (
    "You are an autonomous agent in the Agent Orchestra pipeline with FULL access to all "
    "Claude Code tools — Read, Edit, Write, Bash, Glob, Grep, Task, EnterPlanMode, and more. "
    "Use whatever tools you need to complete your task thoroughly.\n\n"
    "If you need clarification from the user, call the mcp__orchestra__ask_user tool "
    "with your question (and optionally a list of suggested answers). The question will "
    "appear in the Orchestra dashboard and you will receive the user's reply. Only ask "
    "when truly necessary — prefer making reasonable decisions autonomously.\n\n"
)

PHASE_PROMPTS: dict[str, str] = {
    "plan": (
        f"{_AUTONOMOUS_PREAMBLE}"
        "You are a senior developer in planning mode. Analyze the task below and create "
        "a concrete development plan. Identify what files need to change, what new files "
        "to create, and outline the implementation approach. Do NOT write code yet — just plan.\n\n"
        "Output a clear, numbered plan. Do NOT wait for approval — output your plan and "
        "consider this phase complete so the pipeline can proceed autonomously."
    ),
    "develop": (
        f"{_AUTONOMOUS_PREAMBLE}"
        "You are a senior developer. Implement the task below by writing real code. "
        "Create files, modify existing ones, and build the feature. Use the tools available "
        "to you (Read, Edit, Write, Bash, Glob, Grep) to do actual work in the repository.\n\n"
        "Write production-quality code following existing project conventions.\n\n"
        "## Output Format (REQUIRED)\n"
        "End your response with:\n"
        "## SUMMARY — what you built/changed\n"
        "## FILES MODIFIED — full paths, one per line\n"
        "## FILES CREATED — new files, one per line\n"
        "## TEST FOCUS — what the tester should verify\n"
    ),
    "test": (
        f"{_AUTONOMOUS_PREAMBLE}"
        "You are a QA engineer. Write comprehensive tests for the changes made in this project. "
        "Run the test suite and fix any failures. Use Bash to run tests, Read to understand code, "
        "and Write/Edit to create test files.\n\n"
        "Ensure all tests pass before finishing.\n\n"
        "## Output Format (REQUIRED)\n"
        "End your response with:\n"
        "## TEST RESULTS — pass/fail counts\n"
        "## FAILURES — for each: test name, file, exact error message, stack trace, likely cause\n"
        "## VERDICT — PASS or FAIL\n"
    ),
    "security": (
        f"{_AUTONOMOUS_PREAMBLE}"
        "You are a DevSecOps security engineer. Review the codebase for security vulnerabilities: "
        "XSS, injection, exposed secrets, insecure dependencies, OWASP Top 10 issues. "
        "Use Read and Grep to search the code. Do NOT modify code — only report findings.\n\n"
        "List any findings with severity (critical/high/medium/low) and remediation steps.\n\n"
        "## Output Format (REQUIRED)\n"
        "End your response with:\n"
        "## FINDINGS — severity-rated list with file paths and remediation\n"
        "## VERDICT — PASS or BLOCK\n"
    ),
    "develop-2": (
        f"{_AUTONOMOUS_PREAMBLE}"
        "You are a secondary developer working IN PARALLEL with the primary developer. "
        "The primary developer is handling the main feature implementation. Your job is to "
        "handle supporting and independent work:\n"
        "- Utility functions, helpers, and shared modules\n"
        "- Configuration files and environment setup\n"
        "- Type definitions and interfaces\n"
        "- Test infrastructure and fixtures (not the tests themselves)\n"
        "- Independent modules that support the main feature\n\n"
        "CRITICAL: Do NOT modify files that the primary developer is likely working on. "
        "Focus on NEW files and clearly independent supporting code. If there is no "
        "independent supporting work needed, review the codebase for improvements and "
        "prepare the project structure for the main feature."
    ),
    "business-eval": (
        f"{_AUTONOMOUS_PREAMBLE}"
        "You are a business development and product strategy expert. Evaluate the feature "
        "from a market and business perspective. Analyze:\n"
        "- Competitive landscape and existing solutions\n"
        "- Market demand and user need\n"
        "- Strategic fit with the product\n"
        "- Implementation complexity vs business value\n\n"
        "Provide an ICE score (Impact 1-10, Confidence 1-10, Ease 1-10) and a "
        "BUILD / DEFER / INVESTIGATE recommendation with clear reasoning."
    ),
    "report": (
        f"{_AUTONOMOUS_PREAMBLE}"
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
    from backend.services.sandbox import require_execution_capability

    try:
        exec_mode = require_execution_capability("run_execution")
    except RuntimeError as exc:
        execution = store.executions.get(execution_id)
        if execution:
            execution["status"] = "failed"
            execution["completedAt"] = datetime.now(timezone.utc).isoformat()
            await broadcast_both(execution_id, {
                "type": "complete",
                "status": "failed",
                "message": str(exc),
            })
        return

    print(f"[ORCH] run_execution called for {execution_id}", flush=True)
    execution = store.executions.get(execution_id)
    if execution is None:
        print(f"[ORCH] execution {execution_id} NOT FOUND in store!", flush=True)
        return

    # Store exec_mode for use by _try_real_orchestrator
    execution["_exec_mode"] = exec_mode

    now = datetime.now(timezone.utc).isoformat()
    execution["status"] = "running"
    execution["startedAt"] = now
    await broadcast_both(execution_id, {
        "type": "phase",
        "phase": None,
        "status": "running",
    })

    try:
        # Group pipeline steps and execute groups in parallel
        groups: list[list[dict[str, Any]]] = []
        current_group: list[dict[str, Any]] = []
        current_group_idx = execution["pipeline"][0]["group"] if execution["pipeline"] else 0

        for step in execution["pipeline"]:
            if step["group"] != current_group_idx:
                groups.append(current_group)
                current_group = []
                current_group_idx = step["group"]
            current_group.append(step)
        if current_group:
            groups.append(current_group)

        for group in groups:
            if len(group) == 1:
                await _run_phase(execution_id, group[0])
            else:
                await asyncio.gather(*[
                    _run_phase(execution_id, step) for step in group
                ])

        # All phases completed
        execution["status"] = "completed"
        execution["completedAt"] = datetime.now(timezone.utc).isoformat()
        await broadcast_both(execution_id, {"type": "complete", "status": "completed"})

    except Exception as exc:
        import traceback
        print(f"[ORCH] run_execution FAILED: {exc}", flush=True)
        traceback.print_exc()
        execution["status"] = "failed"
        execution["completedAt"] = datetime.now(timezone.utc).isoformat()
        # Record the error on ALL running phases (parallel execution may have multiple)
        for step in execution["pipeline"]:
            if step["status"] == "running":
                step["status"] = "failed"
                step["output"].append("An internal error occurred during execution.")
                step["completedAt"] = datetime.now(timezone.utc).isoformat()
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
    agent_role = step.get("agentRole") or PHASE_AGENTS.get(phase, "developer")

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

    # Broadcast agent-spawn so Office view shows agents appearing dynamically
    agent_info = PHASE_AGENTS_INFO.get(agent_role, {})
    await broadcast_both(execution_id, {
        "type": "agent-spawn",
        "agent": {
            "id": agent_role,
            "executionId": execution_id,
            "role": agent_role,
            "name": agent_info.get("name", agent_role),
            "task": f"Executing {phase} phase",
            "status": "running",
            "output": [],
            "filesModified": [],
            "filesRead": [],
            "color": agent_info.get("color", "#6b7280"),
            "icon": agent_info.get("icon", "Bot"),
            "spawnedAt": datetime.now(timezone.utc).isoformat(),
            "completedAt": None,
        },
    })

    # Broadcast agent-status: working
    await broadcast_both(execution_id, {
        "type": "agent-status",
        "agentRole": agent_role,
        "visualStatus": "working",
        "currentTask": f"Executing {phase} phase",
    })

    # Broadcast orchestrator → agent connection (for office visualization)
    await broadcast_both(execution_id, {
        "type": "agent-connection",
        "from": "orchestrator",
        "to": agent_role,
        "label": f"Delegating {phase}",
        "active": True,
        "dataFlow": "broadcast",
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
        cli_available = _check_orchestrator_available()
        print(f"[ORCH] Phase {phase}: CLI available={cli_available}, "
              f"claude path={shutil.which('claude')}", flush=True)
        if cli_available:
            try:
                success = await asyncio.wait_for(
                    _try_real_orchestrator(execution_id, phase, step, activity),
                    timeout=900,  # 15 minutes per phase
                )
            except asyncio.TimeoutError:
                step["output"].append(f"Phase {phase} timed out after 15 minutes.")
                activity["output"].append(f"Phase {phase} timed out after 15 minutes.")
                await broadcast_both(execution_id, {
                    "type": "output",
                    "line": f"Phase {phase} timed out after 15 minutes.",
                    "phase": phase,
                })
                success = True  # Don't fall back to simulation
            print(f"[ORCH] Phase {phase}: _try_real_orchestrator returned {success}",
                  flush=True)
            if not success:
                print(f"[ORCH] Phase {phase}: FALLING BACK TO SIMULATION", flush=True)
                await _simulate_phase(execution_id, phase, step, activity)
        else:
            print(f"[ORCH] Phase {phase}: CLI NOT AVAILABLE, using simulation", flush=True)
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

        # Broadcast agent-connection handoff to next group
        pipeline = execution["pipeline"]
        current_group_idx = step.get("group", 0)
        next_group_steps = [
            s for s in pipeline if s.get("group", 0) == current_group_idx + 1
        ]
        for next_step in next_group_steps:
            next_agent = next_step.get("agentRole") or PHASE_AGENTS.get(next_step["phase"], "developer")
            await broadcast_both(execution_id, {
                "type": "agent-connection",
                "from": agent_role,
                "to": next_agent,
                "label": f"{phase} \u2192 {next_step['phase']}",
                "active": True,
                "dataFlow": "handoff",
            })

        # Deactivate orchestrator → agent connection
        await broadcast_both(execution_id, {
            "type": "agent-connection",
            "from": "orchestrator",
            "to": agent_role,
            "label": "",
            "active": False,
            "dataFlow": "broadcast",
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
        print("[ORCH] _try_real_orchestrator: claude binary NOT FOUND on PATH", flush=True)
        return False

    # Build the prompt: phase instructions + user task + previous context
    phase_prompt = PHASE_PROMPTS.get(phase, "Complete this phase of the task.")
    user_task = execution.get("task", "")

    # Gather context from previous groups (not parallel peers)
    current_group = step.get("group", 0)
    prev_context_parts: list[str] = []
    for prev_step in execution["pipeline"]:
        if prev_step.get("group", 0) >= current_group:
            break
        if prev_step["output"]:
            prev_context_parts.append(
                f"## {prev_step['phase'].title()} Phase Output\n"
                + "\n".join(prev_step["output"][-200:])
            )
    prev_context = "\n\n".join(prev_context_parts)

    # Determine working directory — use resolvedProjectPath if set,
    # otherwise fall back to the current process working directory.
    # (In Docker the app lives at /app, in devcontainer at /workspace)
    resolved_path = execution.get("resolvedProjectPath", "")
    if resolved_path and os.path.isdir(resolved_path):
        cwd = resolved_path
    else:
        cwd = os.getcwd()

    # Enrich with project context
    from backend.services.project_context import build_project_context
    project_ctx = build_project_context(cwd)

    full_prompt = f"{phase_prompt}\n\n## Task\n{user_task}"
    if project_ctx:
        full_prompt += f"\n\n{project_ctx}"
    if prev_context:
        full_prompt += f"\n\n## Context from Previous Phases\n{prev_context}"

    model = execution.get("model", "sonnet")

    # Create temporary MCP config for the ask_user bridge
    import tempfile
    mcp_bridge_path = os.path.join(os.path.dirname(__file__), "..", "mcp_bridge.py")
    mcp_bridge_path = os.path.abspath(mcp_bridge_path)
    api_url = os.environ.get("ORCHESTRA_API_URL", "http://127.0.0.1:8000")

    mcp_config = {
        "mcpServers": {
            "orchestra": {
                "command": "python",
                "args": [mcp_bridge_path],
                "env": {
                    "ORCHESTRA_EXECUTION_ID": execution_id,
                    "ORCHESTRA_API_URL": api_url,
                    "ORCHESTRA_INTERNAL_TOKEN": store.internal_api_token,
                },
            }
        }
    }

    mcp_config_file = tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", prefix="mcp_config_", delete=False,
    )
    json.dump(mcp_config, mcp_config_file)
    mcp_config_file.close()
    mcp_config_path = mcp_config_file.name

    cmd = [
        claude_path,
        "-p", full_prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
        "--model", model,
        "--no-session-persistence",
        "--mcp-config", mcp_config_path,
    ]

    # Unset CLAUDECODE to avoid nested session detection
    env = {**os.environ, "CLAUDECODE": ""}

    # Docker-wrap if needed
    exec_mode = execution.get("_exec_mode", "native")
    if exec_mode == "docker-wrap":
        from backend.services.docker_runner import ensure_image, wrap_command_in_docker
        if not await ensure_image(execution_id):
            step["output"].append("[Docker] Failed to build agent image")
            activity["output"].append("[Docker] Failed to build agent image")
            return False
        cmd, env, cwd = wrap_command_in_docker(cmd, env, cwd, mcp_config_path)

    print(f"[ORCH] Running Claude CLI: {claude_path} (cwd={cwd}, model={model})",
          flush=True)
    print(f"[ORCH] Command: {' '.join(cmd[:6])}...", flush=True)

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
        )
        print(f"[ORCH] Claude CLI process started (pid={process.pid})", flush=True)
    except (FileNotFoundError, OSError) as exc:
        print(f"[ORCH] FAILED to start Claude CLI: {exc}", flush=True)
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
                        elif tool_name == "mcp__orchestra__ask_user":
                            q = tool_input.get("question", "")
                            tool_line = f"[Asking user] {q}"

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

    except asyncio.CancelledError:
        # Kill subprocess if our coroutine is cancelled (e.g., parallel peer failed)
        process.kill()
        await process.wait()
        raise
    except Exception as exc:
        print(f"[ORCH] Error reading Claude CLI output: {exc}", flush=True)
    finally:
        # Ensure subprocess is cleaned up
        if process.returncode is None:
            process.kill()
            await process.wait()

    if process.returncode is None:
        await process.wait()
    print(f"[ORCH] Claude CLI exited with code {process.returncode}", flush=True)

    # Clean up temp MCP config
    try:
        os.unlink(mcp_config_path)
    except OSError:
        pass

    # Clean up rewritten Docker MCP config if docker-wrap was used
    exec_mode = execution.get("_exec_mode", "native")
    if exec_mode == "docker-wrap":
        from backend.services.docker_runner import cleanup_rewritten_mcp_config
        cleanup_rewritten_mcp_config(cmd)

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
