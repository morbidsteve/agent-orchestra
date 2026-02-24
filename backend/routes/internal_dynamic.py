"""
Internal API routes for dynamic agent spawning and management.
Called by the MCP bridge (mcp_bridge_dynamic.py) — NOT by the frontend directly.
"""

from __future__ import annotations

import asyncio
import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException

from backend import models, store
from backend.services.dynamic_orchestrator import launch_agent_subprocess

router = APIRouter(prefix="/api/internal", tags=["internal-dynamic"])

MAX_AGENTS_PER_EXECUTION = 20


def _verify_token(token: str | None) -> None:
    if not token or not hmac.compare_digest(token, store.internal_api_token):
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/spawn-agent")
async def spawn_agent(
    req: models.SpawnAgentRequest,
    x_orchestra_token: str | None = Header(None),
):
    """Spawn a new dynamic agent for an execution."""
    _verify_token(x_orchestra_token)

    agent_id = store.next_agent_id()
    now = datetime.now(timezone.utc).isoformat()

    # Determine agent color based on role
    role_colors = {
        "developer": "#3b82f6",
        "tester": "#22c55e",
        "security-reviewer": "#f97316",
        "devsecops": "#f97316",
        "documentation": "#8b5cf6",
        "business-dev": "#a855f7",
    }
    role_icons = {
        "developer": "Code2",
        "tester": "TestTube2",
        "security-reviewer": "Shield",
        "devsecops": "Shield",
        "documentation": "FileText",
        "business-dev": "TrendingUp",
    }

    agent = {
        "id": agent_id,
        "executionId": req.execution_id,
        "role": req.role,
        "name": req.name,
        "task": req.task,
        "status": "pending",
        "output": [],
        "filesModified": [],
        "filesRead": [],
        "color": role_colors.get(req.role, "#6b7280"),
        "icon": role_icons.get(req.role, "Bot"),
        "spawnedAt": now,
        "completedAt": None,
        "model": req.model,
        "result_event": asyncio.Event(),
    }

    # Store agent (cap per execution)
    if req.execution_id not in store.dynamic_agents:
        store.dynamic_agents[req.execution_id] = {}
    if len(store.dynamic_agents[req.execution_id]) >= MAX_AGENTS_PER_EXECUTION:
        raise HTTPException(status_code=429, detail=f"Max {MAX_AGENTS_PER_EXECUTION} agents per execution")
    store.dynamic_agents[req.execution_id][agent_id] = agent

    # Broadcast agent-spawn event
    spawn_msg = {
        "type": "agent-spawn",
        "agent": {k: v for k, v in agent.items() if k != "result_event"},
    }
    await store.broadcast(req.execution_id, spawn_msg)
    # Also broadcast to linked console
    for conv in store.conversations.values():
        if conv.get("activeExecutionId") == req.execution_id:
            await store.broadcast_console(conv["id"], spawn_msg)

    # Launch agent subprocess in background
    asyncio.create_task(launch_agent_subprocess(req.execution_id, agent_id))

    return {"agent_id": agent_id, "status": "pending"}


@router.get("/agent/{agent_id}/status")
async def get_agent_status(
    agent_id: str,
    x_orchestra_token: str | None = Header(None),
):
    """Get current status of a dynamic agent."""
    _verify_token(x_orchestra_token)

    for exec_id, agents in store.dynamic_agents.items():
        if agent_id in agents:
            agent = agents[agent_id]
            return {
                "agent_id": agent_id,
                "status": agent["status"],
                "output": "\n".join(agent["output"][-50:]),  # Last 50 lines
                "filesModified": agent["filesModified"],
                "filesRead": agent["filesRead"],
            }

    raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")


@router.get("/agent/{agent_id}/result")
async def get_agent_result(
    agent_id: str,
    x_orchestra_token: str | None = Header(None),
):
    """Long-poll for agent completion. Waits up to 30s per call."""
    _verify_token(x_orchestra_token)

    agent = None
    for exec_id, agents in store.dynamic_agents.items():
        if agent_id in agents:
            agent = agents[agent_id]
            break

    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    # If already done, return immediately
    if agent["status"] in ("completed", "failed"):
        return {
            "agent_id": agent_id,
            "status": agent["status"],
            "output": "\n".join(agent["output"][-100:]),
            "filesModified": agent["filesModified"],
        }

    # Wait up to 30s for completion
    try:
        await asyncio.wait_for(agent["result_event"].wait(), timeout=30)
    except asyncio.TimeoutError:
        pass

    return {
        "agent_id": agent_id,
        "status": agent["status"],
        "output": "\n".join(agent["output"][-100:]) if agent["status"] in ("completed", "failed") else "",
        "filesModified": agent.get("filesModified", []),
    }
