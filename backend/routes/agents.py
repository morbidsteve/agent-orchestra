"""Agent information routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException

from backend import store
from backend.models import CreateAgentRequest

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/")
async def list_agents() -> list[dict]:
    """Return all registered agents."""
    return list(store.agents.values())


@router.post("/", status_code=201)
async def create_agent(req: CreateAgentRequest) -> dict:
    """Create a custom agent."""
    # Generate a URL-safe role slug from the name
    role = re.sub(r"[^a-z0-9]+", "-", req.name.lower()).strip("-")
    if not role:
        raise HTTPException(status_code=400, detail="Name must contain at least one alphanumeric character.")
    if role in store.agents:
        raise HTTPException(status_code=409, detail=f"Agent with role '{role}' already exists.")

    agent = {
        "role": role,
        "name": req.name,
        "description": req.description,
        "capabilities": req.capabilities,
        "tools": req.tools,
        "color": req.color,
        "icon": req.icon,
        "isCustom": True,
        "status": "idle",
        "currentExecution": None,
        "completedTasks": 0,
        "successRate": 100.0,
    }
    store.agents[role] = agent
    return agent


@router.delete("/{role}")
async def delete_agent(role: str) -> dict:
    """Delete a custom agent (built-in agents cannot be deleted)."""
    agent = store.agents.get(role)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if not agent.get("isCustom"):
        raise HTTPException(status_code=403, detail="Built-in agents cannot be deleted.")
    del store.agents[role]
    return {"deleted": role}
