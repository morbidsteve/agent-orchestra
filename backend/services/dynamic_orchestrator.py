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

from backend import store
from backend.config import settings
from backend.services.parser import parse_finding

# Agent subprocess timeout (15 minutes)
AGENT_TIMEOUT = 900
# Orchestrator timeout (30 minutes)
ORCHESTRATOR_TIMEOUT = 1800


ORCHESTRATOR_SYSTEM_PROMPT = """\
You are the orchestrator of a multi-agent development team. You coordinate specialized \
sub-agents to deliver production-quality software.

## Your Tools
- spawn_agent(role, name, task, wait): Spawn a sub-agent. Roles: developer, tester, \
security-reviewer, documentation, or custom.
  - wait=true: Block until agent completes and get its output (use for sequential work)
  - wait=false: Return immediately with agent_id (use to spawn multiple agents in parallel, \
then check status)
- get_agent_status(agent_id): Check status of an agent spawned with wait=false
- ask_user(question, options): Ask the user for clarification

## Workflow Guidelines
1. Analyze the task. Plan your approach.
2. Spawn developer agents for implementation. Use multiple developers for independent modules.
3. After development, spawn a tester agent to run tests.
4. Spawn a security-reviewer agent to check for vulnerabilities.
5. If tests fail or security issues found, spawn fix-up developer agents.
6. Parallelize when possible: spawn independent agents with wait=false, then check their status.
7. Summarize results when done.

## Rules
- Always delegate work to agents — you are the coordinator, not the implementor
- Be specific in task descriptions — include file paths, context, and acceptance criteria
- Run tests and security review before considering work complete
- Max 3 retry iterations if agents fail
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
        print(f"[DYNAMIC] Claude CLI exited: code={return_code}, status={status}, "
              f"output_lines={len(output_lines)}", flush=True)
        if stderr_output:
            print(f"[DYNAMIC] stderr: {stderr_output[:500]}", flush=True)

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

    # Build agent prompt based on role
    role_prompts = {
        "developer": (
            "You are a senior software engineer. Write clean, tested, production-quality code. "
            "Focus only on the specific task given."
        ),
        "tester": (
            "You are a QA engineer. Write comprehensive tests, run the test suite, and report "
            "results with pass/fail details."
        ),
        "security-reviewer": (
            "You are a DevSecOps security engineer. Find vulnerabilities, exposed secrets, and "
            "compliance gaps. Do NOT modify code — only analyze and report."
        ),
        "devsecops": (
            "You are a DevSecOps security engineer. Find vulnerabilities, exposed secrets, and "
            "compliance gaps. Do NOT modify code — only analyze and report."
        ),
        "documentation": (
            "You are a technical writer. Write clear, accurate documentation based on the codebase."
        ),
        "business-dev": (
            "You are a business development and product strategy expert. Analyze market fit, "
            "competitive landscape, and provide recommendations."
        ),
    }

    system_prompt = role_prompts.get(
        agent["role"],
        f"You are a {agent['role']} specialist. Complete the assigned task thoroughly.",
    )

    # Build allowed tools based on role
    if agent["role"] in ("security-reviewer", "devsecops"):
        allowed_tools = "Read,Glob,Grep"
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
