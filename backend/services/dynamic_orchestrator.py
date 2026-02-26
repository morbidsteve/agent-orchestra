"""
Dynamic Orchestrator Service — Launches a single Claude CLI session as the orchestrator,
which uses MCP tools (spawn_agent, ask_user) to dynamically coordinate sub-agents.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

from agents.business_dev import BUSINESS_DEV
from agents.developer import DEVELOPER_PRIMARY, DEVELOPER_SECONDARY
from agents.devsecops import DEVSECOPS
from agents.tester import TESTER
from backend import store
from backend.config import settings
from backend.services.parser import parse_finding

# Agent subprocess timeout (15 minutes)
AGENT_TIMEOUT = 900
# Orchestrator timeout (30 minutes)
ORCHESTRATOR_TIMEOUT = 1800


ORCHESTRATOR_SYSTEM_PROMPT = """\
You are a speed-optimized orchestrator of a multi-agent development team. Think in waves. \
Your default is parallel execution — only go sequential when there is a data dependency. \
Justify every sequential choice.

## Your Tools

- **spawn_agent(role, name, task, wait)**: Spawn a single sub-agent.
  - `wait=false` (DEFAULT): Return immediately with `agent_id`. Use for parallel waves.
  - `wait=true`: Block until done. Use ONLY when the next step needs this agent's output.
- **spawn_agents(agents)**: Batch-spawn multiple agents in one call. Always async.
  - `agents`: Array of `{role, name, task}` objects.
  - Returns all `agent_id`s at once. Use `wait_for_agents` to collect results.
  - **PREFERRED over multiple spawn_agent calls** — fewer round-trips.
- **wait_for_agents(agent_ids)**: Wait for ALL listed agents to complete.
  - Returns all results in one response. Replaces poll-one-at-a-time pattern.
  - **PREFERRED over repeated get_agent_status calls** — one round-trip instead of N.
- **get_agent_status(agent_id)**: Check status/output of a single async agent. Use for progress checks.
- **ask_user(question, options)**: Ask the user when requirements are ambiguous.

## Agent Roles

### developer
Senior software engineer. Primary workhorse for any coding task.
- Spawn for: feature implementation, bug fixes, refactoring, architecture.

### developer-2 (or developer-N)
Secondary developer for parallel independent work on non-overlapping files.
- Spawn for: independent modules, utility code, parallel features.

### tester
QA engineer. MANDATORY after every development wave.
- Spawn for: writing tests, running test suite, coverage, regression checks.

### security-reviewer / devsecops
Security engineer. MANDATORY before any task is considered done.
- Spawn for: vulnerability scanning, secrets detection, dependency audit.
- Read-only — does NOT modify code.

### business-dev
Product strategy expert.
- Spawn for: market research, competitive analysis, feature evaluation.

## Execution Templates — FOLLOW THESE EXACTLY

### Template A — Development (default for feature/fix/refactor tasks)
**Wave 1 — Build**: Use `spawn_agents` to batch-spawn all developers at once. \
For large tasks, include multiple developers with non-overlapping file scopes. \
Then call `wait_for_agents` with all agent_ids to block until the wave completes.
**Wave 2 — Validate**: Use `spawn_agents` to batch-spawn tester AND security-reviewer. \
Pass developer context (summary, files modified, test focus areas) to both. \
Call `wait_for_agents` to block until both complete.
**Wave 3 — Fix-ups** (if needed): If tester or security found issues, spawn developer with \
fix-up task including EXACT error messages. Then re-run tester/security on affected areas.

### Template B — Review / Audit
**Wave 1**: Use `spawn_agents` to batch-spawn developer + tester + security-reviewer. \
Each reviews independently. Call `wait_for_agents` for all. Synthesize into APPROVE / REQUEST CHANGES / BLOCK.

### Template C — Feature Evaluation
**Wave 1**: Use `spawn_agents` to batch-spawn developer (feasibility) + business-dev (market analysis). \
Call `wait_for_agents` for both. Synthesize ICE score + BUILD/DEFER/INVESTIGATE recommendation.

## Context Forwarding Protocol — MANDATORY

After EVERY agent completes, you MUST:
1. Call `get_agent_status(agent_id)` to retrieve full output.
2. Extract: summary, files modified/created, issues, test focus areas.
3. When spawning downstream agents, INCLUDE this context in their task description.

Example of a well-formed tester task WITH context:
```
The developer completed the following changes:
SUMMARY: Added refresh token endpoint in /workspace/backend/routes/auth.py
FILES MODIFIED: /workspace/backend/routes/auth.py, /workspace/backend/models/token.py
FILES CREATED: /workspace/backend/services/token_refresh.py
TEST FOCUS: Test the POST /api/auth/refresh endpoint — valid token, expired token, \
malformed token, missing token. Also verify existing login tests still pass.

Your job: Write tests covering the above focus areas, then run the FULL test suite.
```

## Retry Protocol — ENFORCED

When an agent reports failures:

1. **Test failures**: Extract EXACT error messages, failing test names, and stack traces \
from tester output. Spawn developer with a fix-up task that includes these exact errors. \
After developer completes, re-spawn tester to verify. Max 3 retries.

2. **Security findings (CRITICAL/HIGH)**: Extract exact findings with file paths and line \
numbers. Spawn developer with specific remediation task. After fix, re-spawn security \
reviewer to verify. Max 3 retries.

3. **Escalation**: After 3 failed retries on the same issue, call `ask_user` with the \
exact error context and ask for guidance.

CRITICAL: Always include the EXACT error messages in fix-up tasks. "Tests failed" is NOT \
sufficient — include the actual failure output.

## Parallelization Rules

- Developers on non-overlapping files → parallel (`wait=false`)
- Developer + Business Dev → always parallel
- Tester + Security → always parallel (both read-heavy)
- Multiple developers on overlapping files → sequential
- After parallel wave completes, review ALL outputs before next wave

## Quality Gates — ALL must pass before reporting done

- [ ] All tests pass (full suite, not just new tests)
- [ ] No critical or high security findings
- [ ] Code follows project conventions
- [ ] Files modified are listed clearly

## Starting a Task

1. Read the task carefully. Decide which Template (A/B/C) applies.
2. Plan your waves. Spawn Wave 1 agents with `wait=false`.
3. Poll agents. Extract context from completed agents.
4. Spawn Wave 2 with rich context. Continue until all quality gates pass.
5. Deliver final summary: what was built, test results, security status, files modified.
"""


async def run_dynamic_execution(execution_id: str) -> None:
    """
    Launch a single Claude CLI session as the orchestrator.
    The orchestrator uses MCP tools to spawn and manage sub-agents.
    """
    print(f"[DYNAMIC] run_dynamic_execution called for {execution_id}", flush=True)
    execution = store.executions.get(execution_id)
    if not execution:
        print(f"[DYNAMIC] execution {execution_id} NOT FOUND in store!", flush=True)
        return

    from backend.services.sandbox import require_execution_capability

    try:
        exec_mode = require_execution_capability("run_dynamic_execution")
    except RuntimeError as exc:
        execution["status"] = "failed"
        execution["completedAt"] = datetime.now(timezone.utc).isoformat()
        await _broadcast_output(execution_id, f"[Sandbox] {exc}", "orchestrator")
        sandbox_fail_msg = {"type": "complete", "status": "failed"}
        await store.broadcast(execution_id, sandbox_fail_msg)
        # Also broadcast sandbox failure to console WebSocket
        for conv in store.conversations.values():
            if conv.get("activeExecutionId") == execution_id:
                await store.broadcast_console(conv["id"], sandbox_fail_msg)
        return

    execution["status"] = "running"
    execution["startedAt"] = datetime.now(timezone.utc).isoformat()
    await store.broadcast(execution_id, {"type": "phase", "phase": "orchestrator", "status": "running"})

    # Determine working directory
    work_dir = (
        execution.get("resolvedProjectPath")
        or execution.get("projectDir")
        or execution.get("target")
        or "/workspace"
    )
    if not os.path.isdir(work_dir):
        work_dir = "/workspace"

    # Build MCP config for the orchestrator session
    mcp_bridge_path = str(Path(__file__).parent.parent / "mcp_bridge_dynamic.py")
    mcp_config = {
        "mcpServers": {
            "orchestra": {
                "command": "python",
                "args": [mcp_bridge_path],
                "env": {
                    "ORCHESTRA_API_URL": f"http://127.0.0.1:{settings.PORT}",
                    "ORCHESTRA_EXECUTION_ID": execution_id,
                    "ORCHESTRA_INTERNAL_TOKEN": store.internal_api_token,
                },
            }
        }
    }

    mcp_config_path = ""
    try:
        # Write MCP config to temp file
        fd, mcp_config_path = tempfile.mkstemp(suffix=".json", prefix="orchestra-mcp-")
        mcp_config_file = os.fdopen(fd, "w")
        json.dump(mcp_config, mcp_config_file)
        mcp_config_file.close()
        os.chmod(mcp_config_path, 0o600)

        task = execution.get("task", "")
        model = execution.get("model", settings.DEFAULT_MODEL)

        full_prompt = (
            f"{ORCHESTRATOR_SYSTEM_PROMPT}\n\n"
            f"## Current Task\n{task}\n\n"
            f"## Working Directory\n{work_dir}\n\n"
            "Begin by analyzing the task and deciding how to delegate. Spawn agents as needed."
        )

        cmd = [
            "claude",
            "-p", full_prompt,
            "--output-format", "stream-json",
            "--verbose",
            "--model", model,
            "--mcp-config", mcp_config_path,
            "--dangerously-skip-permissions",
        ]

        # Unset CLAUDECODE to avoid nested session detection
        env = {**os.environ, "CLAUDECODE": ""}

        # Docker-wrap if running on bare metal with Docker available
        if exec_mode == "docker-wrap":
            from backend.services.docker_runner import ensure_image, wrap_command_in_docker
            if not await ensure_image(execution_id):
                execution["status"] = "failed"
                execution["completedAt"] = datetime.now(timezone.utc).isoformat()
                await _broadcast_output(execution_id, "[Docker] Failed to build agent image", "orchestrator")
                docker_fail_msg = {"type": "complete", "status": "failed"}
                await store.broadcast(execution_id, docker_fail_msg)
                # Also broadcast Docker failure to console WebSocket
                for conv in store.conversations.values():
                    if conv.get("activeExecutionId") == execution_id:
                        await store.broadcast_console(conv["id"], docker_fail_msg)
                return
            cmd, env, work_dir = wrap_command_in_docker(cmd, env, work_dir, mcp_config_path)

        print(f"[DYNAMIC] Launching Claude CLI: model={execution.get('model')}, cwd={work_dir}", flush=True)
        print(f"[DYNAMIC] Command: {' '.join(cmd[:8])}...", flush=True)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=work_dir,
            env=env,
        )
        print(f"[DYNAMIC] Claude CLI started (pid={process.pid})", flush=True)

        output_lines: list[str] = []

        async def read_stream() -> None:
            assert process.stdout is not None
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    continue

                try:
                    msg = json.loads(text)
                except json.JSONDecodeError:
                    # Plain text output
                    output_lines.append(text)
                    await _broadcast_output(execution_id, text, "orchestrator")
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "assistant":
                    # Extract text content from assistant messages
                    for block in msg.get("message", {}).get("content", []):
                        if block.get("type") == "text":
                            for line_text in block["text"].split("\n"):
                                if line_text.strip():
                                    output_lines.append(line_text)
                                    await _broadcast_output(execution_id, line_text, "orchestrator")
                        elif block.get("type") == "tool_use":
                            tool_name = block.get("name", "")
                            tool_input = block.get("input", {})
                            # Broadcast tool use info
                            if "spawn_agent" in tool_name:
                                agent_info = (
                                    f"[Orchestrator] Spawning {tool_input.get('role', 'agent')}: "
                                    f"{tool_input.get('name', 'unnamed')} — "
                                    f"{tool_input.get('task', '')[:100]}"
                                )
                                output_lines.append(agent_info)
                                await _broadcast_output(execution_id, agent_info, "orchestrator")

                elif msg_type == "result":
                    # Final result
                    result_text = msg.get("result", "")
                    if isinstance(result_text, str):
                        for line_text in result_text.split("\n"):
                            if line_text.strip():
                                output_lines.append(line_text)
                                await _broadcast_output(execution_id, line_text, "orchestrator")

                    # Check for findings in recent output
                    for ol in output_lines[-20:]:
                        finding = parse_finding(ol, execution_id)
                        if finding:
                            store.findings[finding["id"]] = finding
                            execution.setdefault("findings", []).append(finding["id"])

        try:
            await asyncio.wait_for(read_stream(), timeout=ORCHESTRATOR_TIMEOUT)
        except asyncio.TimeoutError:
            process.kill()
            output_lines.append("[Orchestrator timed out after 30 minutes]")
            await _broadcast_output(execution_id, "[Orchestrator timed out]", "orchestrator")

        await process.wait()

        # Determine final status
        return_code = process.returncode
        stderr_output = ""
        if process.stderr:
            stderr_bytes = await process.stderr.read()
            stderr_output = stderr_bytes.decode("utf-8", errors="replace").strip()
        status = "completed" if return_code == 0 else "failed"
        execution["status"] = status
        execution["completedAt"] = datetime.now(timezone.utc).isoformat()

        # Diagnostic logging
        agents_spawned = len(store.dynamic_agents.get(execution_id, {}))
        print(f"[DYNAMIC] Claude CLI exited: code={return_code}, status={status}, "
              f"output_lines={len(output_lines)}, agents_spawned={agents_spawned}", flush=True)
        if stderr_output:
            # Log first 1000 chars of stderr for better diagnostics
            print(f"[DYNAMIC] stderr (first 1000 chars): {stderr_output[:1000]}", flush=True)
        if return_code != 0:
            print(f"[DYNAMIC] Non-zero exit — last 5 output lines: "
                  f"{output_lines[-5:] if output_lines else '(none)'}", flush=True)

        # Collect all dynamic agent file modifications
        all_files: list[str] = []
        for agent in store.dynamic_agents.get(execution_id, {}).values():
            all_files.extend(agent.get("filesModified", []))

        complete_msg = {
            "type": "complete",
            "status": status,
            "filesModified": list(set(all_files)),
        }
        await store.broadcast(execution_id, complete_msg)
        # Also broadcast completion to console WebSocket
        for conv in store.conversations.values():
            if conv.get("activeExecutionId") == execution_id:
                await store.broadcast_console(conv["id"], complete_msg)
                # Add a result summary message to the conversation
                summary = "\n".join(output_lines[-10:]) if output_lines else "Execution completed."
                response_msg = {
                    "id": f"msg-{uuid.uuid4().hex[:8]}",
                    "role": "orchestra",
                    "contentType": "text",
                    "text": summary,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "executionRef": execution_id,
                }
                conv["messages"].append(response_msg)
                await store.broadcast_console(conv["id"], {
                    "type": "conversation-update",
                    "message": response_msg,
                })

    except FileNotFoundError:
        print("[DYNAMIC] Claude CLI not found — will fall back", flush=True)
        execution["status"] = "queued"
        execution["startedAt"] = None
        raise
    except Exception as exc:
        print(f"[DYNAMIC] Orchestrator exception: {exc}", flush=True)
        execution["status"] = "failed"
        execution["completedAt"] = datetime.now(timezone.utc).isoformat()
        await _broadcast_output(execution_id, "[Orchestrator error]", "orchestrator")
        error_complete_msg = {"type": "complete", "status": "failed"}
        await store.broadcast(execution_id, error_complete_msg)
        # Also broadcast failure to console WebSocket
        for conv in store.conversations.values():
            if conv.get("activeExecutionId") == execution_id:
                await store.broadcast_console(conv["id"], error_complete_msg)
    finally:
        if mcp_config_path and os.path.exists(mcp_config_path):
            os.unlink(mcp_config_path)
        # Clean up rewritten Docker MCP config if docker-wrap was used
        if exec_mode == "docker-wrap":
            from backend.services.docker_runner import cleanup_rewritten_mcp_config
            cleanup_rewritten_mcp_config(cmd)


async def launch_agent_subprocess(execution_id: str, agent_id: str) -> None:
    """
    Launch a Claude CLI subprocess for a specific agent.
    Called by internal_dynamic route when spawn-agent is requested.
    """
    agents = store.dynamic_agents.get(execution_id, {})
    agent = agents.get(agent_id)
    if not agent:
        return

    from backend.services.sandbox import require_execution_capability

    try:
        exec_mode = require_execution_capability("launch_agent_subprocess")
    except RuntimeError as exc:
        agent["status"] = "failed"
        agent["output"].append(f"[Sandbox] {exc}")
        agent["completedAt"] = datetime.now(timezone.utc).isoformat()
        if "result_event" in agent:
            agent["result_event"].set()
        await _broadcast_agent_event(execution_id, agent_id, "agent-complete", {
            "agentId": agent_id,
            "status": "failed",
            "filesModified": [],
        })
        return

    agent["status"] = "running"

    # Broadcast status update
    await _broadcast_agent_event(execution_id, agent_id, "agent-output", {
        "agentId": agent_id,
        "line": f"[{agent['name']}] Starting: {agent['task'][:100]}...",
    })

    execution = store.executions.get(execution_id, {})
    work_dir = (
        execution.get("resolvedProjectPath")
        or execution.get("projectDir")
        or execution.get("target")
        or "/workspace"
    )
    if not os.path.isdir(work_dir):
        work_dir = "/workspace"

    model = agent.get("model") or execution.get("model", settings.DEFAULT_MODEL)

    # Build agent prompt based on role — use rich prompts from agents module
    role_prompts = {
        "developer": DEVELOPER_PRIMARY["prompt"],
        "developer-2": DEVELOPER_SECONDARY["prompt"],
        "tester": TESTER["prompt"],
        "security-reviewer": DEVSECOPS["prompt"],
        "devsecops": DEVSECOPS["prompt"],
        "documentation": (
            "You are a technical writer. Write clear, accurate documentation based on the codebase."
        ),
        "business-dev": BUSINESS_DEV["prompt"],
    }

    system_prompt = role_prompts.get(agent["role"])
    if not system_prompt:
        # Check store for a custom agent matching this role
        custom_agent = store.agents.get(agent["role"])
        if custom_agent and custom_agent.get("isCustom"):
            caps = ", ".join(custom_agent.get("capabilities") or [])
            system_prompt = (
                f"You are a {custom_agent['name']} specialist. "
                f"{custom_agent.get('description', '')}"
            )
            if caps:
                system_prompt += f"\n\nYour capabilities: {caps}"
        else:
            system_prompt = f"You are a {agent['role']} specialist. Complete the assigned task thoroughly."

    # Enrich prompt with project context
    from backend.services.project_context import build_project_context
    project_ctx = build_project_context(work_dir)

    full_prompt = (
        f"{system_prompt}\n\n"
        f"## Your Task\n{agent['task']}\n\n"
        f"## Working Directory\n{work_dir}\n\n"
    )
    if project_ctx:
        full_prompt += f"{project_ctx}\n\n"
    full_prompt += (
        "You have full access to all Claude Code tools. Use whatever you need to complete "
        "this task thoroughly. If you need to ask the user a question, use the "
        "mcp__orchestra__ask_user tool — it routes through the Orchestra dashboard.\n\n"
        "## Output Format (REQUIRED)\n"
        "When you complete your work, end your response with these sections:\n"
        "## SUMMARY — what you built/changed\n"
        "## FILES MODIFIED — full paths, one per line\n"
        "## FILES CREATED — new files, one per line\n"
        "## ISSUES — any problems or concerns\n"
        "## NEXT STEPS — what downstream agents should focus on\n"
    )

    agent_mcp_config_path = ""
    try:
        # Agent gets the basic ask_user MCP bridge (not spawn_agent)
        mcp_bridge_path = str(Path(__file__).parent.parent / "mcp_bridge.py")
        mcp_config: dict[str, Any] = {
            "mcpServers": {
                "orchestra": {
                    "command": "python",
                    "args": [mcp_bridge_path],
                    "env": {
                        "ORCHESTRA_API_URL": f"http://127.0.0.1:{settings.PORT}",
                        "ORCHESTRA_EXECUTION_ID": execution_id,
                        "ORCHESTRA_INTERNAL_TOKEN": store.internal_api_token,
                    },
                }
            }
        }

        fd, agent_mcp_config_path = tempfile.mkstemp(suffix=".json", prefix=f"agent-{agent_id}-")
        mcp_config_file = os.fdopen(fd, "w")
        json.dump(mcp_config, mcp_config_file)
        mcp_config_file.close()
        os.chmod(agent_mcp_config_path, 0o600)

        cmd = [
            "claude",
            "-p", full_prompt,
            "--output-format", "stream-json",
            "--verbose",
            "--model", model,
            "--mcp-config", agent_mcp_config_path,
            "--dangerously-skip-permissions",
        ]

        # Unset CLAUDECODE to avoid nested session detection
        env = {**os.environ, "CLAUDECODE": ""}

        # Docker-wrap if needed
        if exec_mode == "docker-wrap":
            from backend.services.docker_runner import ensure_image, wrap_command_in_docker
            if not await ensure_image(execution_id):
                agent["status"] = "failed"
                agent["output"].append("[Docker] Failed to build agent image")
                agent["completedAt"] = datetime.now(timezone.utc).isoformat()
                if "result_event" in agent:
                    agent["result_event"].set()
                await _broadcast_agent_event(execution_id, agent_id, "agent-complete", {
                    "agentId": agent_id, "status": "failed", "filesModified": [],
                })
                return
            cmd, env, work_dir = wrap_command_in_docker(cmd, env, work_dir, agent_mcp_config_path)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=work_dir,
            env=env,
        )

        async def read_agent_stream() -> None:
            assert process.stdout is not None
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    continue

                try:
                    msg = json.loads(text)
                except json.JSONDecodeError:
                    agent["output"].append(text)
                    await _broadcast_agent_event(execution_id, agent_id, "agent-output", {
                        "agentId": agent_id,
                        "line": text,
                    })
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "assistant":
                    for block in msg.get("message", {}).get("content", []):
                        if block.get("type") == "text":
                            for lt in block["text"].split("\n"):
                                if lt.strip():
                                    agent["output"].append(lt)
                                    await _broadcast_agent_event(
                                        execution_id, agent_id, "agent-output",
                                        {"agentId": agent_id, "line": lt},
                                    )
                        elif block.get("type") == "tool_use":
                            tool_name = block.get("name", "")
                            tool_input = block.get("input", {})
                            # Track file operations
                            _track_file_activity(
                                execution_id, agent_id, agent["name"], tool_name, tool_input,
                            )

                elif msg_type == "result":
                    result_text = msg.get("result", "")
                    if isinstance(result_text, str):
                        for lt in result_text.split("\n"):
                            if lt.strip():
                                agent["output"].append(lt)
                                await _broadcast_agent_event(
                                    execution_id, agent_id, "agent-output",
                                    {"agentId": agent_id, "line": lt},
                                )

        try:
            await asyncio.wait_for(read_agent_stream(), timeout=AGENT_TIMEOUT)
        except asyncio.TimeoutError:
            process.kill()
            agent["output"].append(f"[{agent['name']} timed out after 15 minutes]")

        await process.wait()

        agent["status"] = "completed" if process.returncode == 0 else "failed"
        agent["completedAt"] = datetime.now(timezone.utc).isoformat()

    except FileNotFoundError:
        agent["status"] = "failed"
        agent["output"].append("[Error: Claude CLI not found — running in simulation mode]")
        # Simulation fallback
        agent["output"].append(f"[Simulated] {agent['name']} completed task: {agent['task'][:80]}")
        agent["status"] = "completed"
        agent["completedAt"] = datetime.now(timezone.utc).isoformat()
    except Exception:
        agent["status"] = "failed"
        agent["output"].append("[Agent error]")
        agent["completedAt"] = datetime.now(timezone.utc).isoformat()
    finally:
        if agent_mcp_config_path and os.path.exists(agent_mcp_config_path):
            os.unlink(agent_mcp_config_path)
        # Clean up rewritten Docker MCP config if docker-wrap was used
        if exec_mode == "docker-wrap":
            from backend.services.docker_runner import cleanup_rewritten_mcp_config
            cleanup_rewritten_mcp_config(cmd)

        # Signal completion
        if "result_event" in agent:
            agent["result_event"].set()

        # Broadcast agent-complete
        await _broadcast_agent_event(execution_id, agent_id, "agent-complete", {
            "agentId": agent_id,
            "status": agent["status"],
            "filesModified": agent.get("filesModified", []),
        })


def _track_file_activity(
    execution_id: str,
    agent_id: str,
    agent_name: str,
    tool_name: str,
    tool_input: dict,
) -> None:
    """Track file read/write activity from agent tool calls."""
    action_map = {
        "Read": "read",
        "Edit": "edit",
        "Write": "create",
        "Bash": None,  # Can't determine file from bash
        "Glob": "read",
        "Grep": "read",
    }
    action = action_map.get(tool_name)
    if not action:
        return

    file_path = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("pattern", "")
    if not file_path:
        return

    agent = store.dynamic_agents.get(execution_id, {}).get(agent_id)
    if agent:
        if action in ("edit", "create"):
            if file_path not in agent["filesModified"]:
                agent["filesModified"].append(file_path)
        elif action == "read":
            if file_path not in agent["filesRead"]:
                agent["filesRead"].append(file_path)

    activity = {
        "file": file_path,
        "action": action,
        "agentId": agent_id,
        "agentName": agent_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if execution_id not in store.file_activities:
        store.file_activities[execution_id] = []
    store.file_activities[execution_id].append(activity)

    # Broadcast file activity (fire-and-forget)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(store.broadcast(execution_id, {"type": "file-activity", **activity}))
    except RuntimeError:
        pass


async def _broadcast_output(execution_id: str, text: str, phase: str) -> None:
    """Broadcast output line to execution and linked console WebSockets."""
    msg = {"type": "output", "line": text, "phase": phase}
    await store.broadcast(execution_id, msg)
    # Also broadcast as console-text to linked conversations
    console_msg = {
        "type": "console-text",
        "text": text,
        "messageId": f"out-{uuid.uuid4().hex[:8]}",
    }
    sent_to = 0
    for conv in store.conversations.values():
        if conv.get("activeExecutionId") == execution_id:
            await store.broadcast_console(conv["id"], console_msg)
            sent_to += 1
    if sent_to == 0:
        logger.warning(
            "_broadcast_output: no linked conversation found for exec %s",
            execution_id,
        )


async def _broadcast_agent_event(
    execution_id: str,
    agent_id: str,
    event_type: str,
    data: dict,
) -> None:
    """Broadcast agent event to execution and linked console WebSockets."""
    msg = {"type": event_type, **data}
    await store.broadcast(execution_id, msg)
    for conv in store.conversations.values():
        if conv.get("activeExecutionId") == execution_id:
            await store.broadcast_console(conv["id"], msg)
