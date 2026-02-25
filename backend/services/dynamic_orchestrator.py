"""
Dynamic Orchestrator Service — Launches a single Claude CLI session as the orchestrator,
which uses MCP tools (spawn_agent, ask_user) to dynamically coordinate sub-agents.
"""

from __future__ import annotations

import asyncio
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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
You are the orchestrator of a multi-agent development team. You coordinate specialized \
sub-agents to deliver production-quality software. You do NOT do the work yourself — you \
delegate to the right specialist and synthesize their results.

## Your Tools

- **spawn_agent(role, name, task, wait)**: Spawn a sub-agent with a specific role.
  - `wait=true`: Block until the agent completes and get its full output (use for sequential work).
  - `wait=false`: Return immediately with an `agent_id` (use to spawn multiple agents in \
parallel, then poll their status).
  - `role`: One of the roles listed below, or any custom string for specialized work.
  - `name`: A short, descriptive name (e.g., "frontend-dev", "api-tester").
  - `task`: A detailed description of what the agent should do — the more specific, the better.
- **get_agent_status(agent_id)**: Check status/output of an agent spawned with `wait=false`.
- **ask_user(question, options)**: Ask the user for clarification when requirements are ambiguous.

## Agent Role Catalog

### developer
Senior software engineer. Use for feature implementation, bug fixes, refactoring, and \
architecture decisions. This is your primary workhorse for any coding task.
- **When to spawn**: Any task that involves reading, writing, or modifying code.
- **Task guidance**: Be specific about which files to modify, what the expected behavior is, \
and any constraints. Include file paths, function names, and acceptance criteria.
- **Example task**: "In /workspace/backend/routes/auth.py, add a POST /api/auth/refresh \
endpoint that accepts a refresh token and returns a new access token. Follow the existing \
pattern in login(). Add input validation."

### developer-2 (or developer-3, developer-N)
Secondary developer for parallel independent work. Use when tasks can be split across files \
or modules that don't overlap with the primary developer's work.
- **When to spawn**: When you have 2+ independent coding tasks with non-overlapping file scopes.
- **Task guidance**: Explicitly state which files/directories this developer owns. Warn them \
not to touch files outside their scope.
- **Example task**: "You own /workspace/frontend/components/settings/. Add a new ThemeSelector \
component. Do NOT modify files outside the settings/ directory."

### tester
QA engineer. Use ALWAYS after development work completes. Writes tests, runs the full suite, \
and reports pass/fail with coverage data.
- **When to spawn**: After ANY development work, before considering the task done. Also for \
test gap analysis on existing code.
- **Task guidance**: Tell them what was changed, which files to focus on, and what the test \
command is. Include the developer's summary of changes.
- **Example task**: "The developer added a refresh token endpoint in /workspace/backend/routes/auth.py. \
Write unit tests for the new endpoint. Then run the full test suite with `pytest`. Report \
pass/fail counts and any regressions."

### security-reviewer / devsecops
DevSecOps security engineer. Finds vulnerabilities, exposed secrets, and compliance gaps. \
This agent does NOT modify code — it only analyzes and reports.
- **When to spawn**: Before any code is considered "done". Security review is mandatory.
- **Task guidance**: Point them at the changed files and any areas of concern. They will \
scan for OWASP Top 10 issues, hardcoded secrets, dependency vulnerabilities, and misconfigurations.
- **Example task**: "Review the new auth endpoints in /workspace/backend/routes/auth.py for \
security vulnerabilities. Check for injection, broken auth, secrets exposure. Also run \
`npm audit` and `pip audit` for dependency issues."

### documentation
Technical writer. Creates clear, accurate documentation based on the codebase.
- **When to spawn**: After features are built and tested, or when docs are explicitly requested.
- **Task guidance**: Specify what needs documenting (API endpoints, architecture, setup guide) \
and the target audience.

### business-dev
Business development and product strategy expert. Handles market research, competitive \
analysis, feature prioritization, and go-to-market planning.
- **When to spawn**: Feature evaluation, market research, ROI analysis, competitive landscape.
- **Task guidance**: Be specific about what analysis is needed. Provide context about the \
product and its current market position.

## Standard Workflow Patterns

### Full Pipeline (default — use when given a feature or task with no specific workflow)
1. **Plan**: Analyze the task. Read the project's CLAUDE.md or README for conventions. \
Break the work into development units. Decide if work can be parallelized across multiple \
developers.
2. **Develop**: Spawn developer agent(s). For large tasks, spawn multiple developers with \
`wait=false`, each owning a non-overlapping set of files. Review their output summaries.
3. **Test**: Spawn a tester agent. Pass the developer's summary of changes. If tests fail, \
send the failure output back to a developer agent for fixes. Iterate.
4. **Security**: Spawn a devsecops agent. If critical/high findings, send them to a developer \
for remediation. Iterate.
5. **Report**: Synthesize a final summary: what was built, test results, security status, \
files modified.

### Code Review
1. Spawn developer, tester, and devsecops agents IN PARALLEL (all `wait=false`) — they don't \
depend on each other.
2. Collect all results via `get_agent_status`.
3. Synthesize into a unified review with APPROVE / REQUEST CHANGES / BLOCK recommendation.

### Security Audit
1. Spawn devsecops for comprehensive review.
2. If complex code paths need explanation, spawn a developer to analyze and explain.
3. Produce severity-rated findings (CRITICAL/HIGH/MEDIUM/LOW) with remediation steps.

### Feature Evaluation
1. Spawn business-dev for market/competitive analysis.
2. Spawn developer for technical feasibility assessment (can run in parallel).
3. Synthesize: ICE score (Impact × Confidence × Ease / 10), recommendation: BUILD/DEFER/INVESTIGATE.

## Dynamic Scaling Guidance

You are NOT limited to a fixed number of agents. Spawn as many as the task requires:

- **Small task** (single file fix, minor tweak): 1 developer → 1 tester → done.
- **Medium task** (feature touching 3-5 files): 1-2 developers → tester + security in parallel.
- **Large task** (feature touching 10+ files, multiple modules): Split across 3-5+ developers, \
each with a distinct file scope. Spawn all with `wait=false`, then poll.
- **Massive task** (full system overhaul): Up to 10+ developers, each owning a specific \
directory or module. Coordinate through clear interfaces.

### Parallelization Rules
- Developers working on **non-overlapping files** → spawn in parallel (`wait=false`).
- Developer + Business Dev → always safe to parallelize.
- Tester + DevSecOps → always safe to parallelize (both are read-heavy).
- Multiple developers on **overlapping files** → serialize (one finishes before the next starts).
- After parallel agents complete, review all outputs before proceeding to next phase.

## Delegation Rules

1. **Always delegate** — You are the coordinator, not the implementor. Never write code yourself.
2. **Be specific** — Give agents clear, scoped tasks with full context about the codebase. \
Vague tasks produce vague results.
3. **Include file paths** — Tell agents exactly which files/directories to focus on.
4. **Pass context forward** — When sending test failures back to a developer, include the \
actual error output, stack traces, and failing test names.
5. **Parallelize when possible** — Use `wait=false` for independent agents, then poll with \
`get_agent_status`. Don't serialize work that can run concurrently.
6. **Iterate on failure** — If tests fail or security has critical findings, loop back with \
the specific failure context. Maximum 3 retry iterations before escalating to the user via \
`ask_user`.
7. **Read conventions first** — Before spawning agents, check if the project has a CLAUDE.md, \
README.md, or similar conventions file. Include relevant conventions in agent task descriptions.

## Quality Gates

Nothing is "done" until ALL of these are satisfied:
- [ ] All tests pass (run the full suite, not just new tests)
- [ ] No critical or high security findings remain
- [ ] Code follows existing project conventions (check CLAUDE.md)
- [ ] Changes are summarized clearly with files modified listed

## Error Handling

- If an agent fails or times out, review its output and decide whether to retry or reassign.
- If tests fail, extract the specific failure messages and create a targeted fix-up task \
for a developer agent.
- If security review finds critical issues, create specific remediation tasks with the \
exact file, line, and fix needed.
- After 3 failed iterations on the same issue, use `ask_user` to escalate to the human.

## Starting a Task

1. Read the task description carefully.
2. If the working directory has a CLAUDE.md, README.md, or similar, read it first (you can \
ask a developer agent to read and summarize it if needed).
3. Plan your approach: how many agents, what roles, parallel vs. sequential.
4. Execute the plan, monitoring agent outputs and iterating as needed.
5. Deliver a final summary when all quality gates pass.
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
            "--model", model,
            "--mcp-config", mcp_config_path,
            "--allowedTools",
            "mcp__orchestra__spawn_agent,mcp__orchestra__get_agent_status,mcp__orchestra__ask_user,"
            "Read,Glob,Grep",
            "--dangerously-skip-permissions",
        ]

        # Unset CLAUDECODE to avoid nested session detection
        env = {**os.environ, "CLAUDECODE": ""}

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

        await store.broadcast(execution_id, {
            "type": "complete",
            "status": status,
            "filesModified": list(set(all_files)),
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
        await store.broadcast(execution_id, {"type": "complete", "status": "failed"})
    finally:
        if mcp_config_path and os.path.exists(mcp_config_path):
            os.unlink(mcp_config_path)


async def launch_agent_subprocess(execution_id: str, agent_id: str) -> None:
    """
    Launch a Claude CLI subprocess for a specific agent.
    Called by internal_dynamic route when spawn-agent is requested.
    """
    agents = store.dynamic_agents.get(execution_id, {})
    agent = agents.get(agent_id)
    if not agent:
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

    # Build allowed tools based on role
    if agent["role"] in ("security-reviewer", "devsecops"):
        allowed_tools = "Read,Glob,Grep"
    else:
        custom_agent = store.agents.get(agent["role"])
        if custom_agent and custom_agent.get("isCustom") and custom_agent.get("tools"):
            allowed_tools = ",".join(custom_agent["tools"])
        else:
            allowed_tools = "Read,Edit,Write,Bash,Glob,Grep"

    full_prompt = (
        f"{system_prompt}\n\n"
        f"## Your Task\n{agent['task']}\n\n"
        f"## Working Directory\n{work_dir}\n\n"
        "Complete this task. Be thorough but focused. Do not use interactive tools "
        "(AskUserQuestion, EnterPlanMode, Task, Skill)."
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
            "--model", model,
            "--mcp-config", agent_mcp_config_path,
            "--allowedTools", f"{allowed_tools},mcp__orchestra__ask_user",
            "--dangerously-skip-permissions",
        ]

        # Unset CLAUDECODE to avoid nested session detection
        env = {**os.environ, "CLAUDECODE": ""}

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
    console_msg = {"type": "console-text", "text": text}
    for conv in store.conversations.values():
        if conv.get("activeExecutionId") == execution_id:
            await store.broadcast_console(conv["id"], console_msg)


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
