"""Agent information routes."""

from __future__ import annotations

from fastapi import APIRouter

from backend import store

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/")
async def list_agents() -> list[dict]:
    """Return all registered agents."""
    return list(store.agents.values())
