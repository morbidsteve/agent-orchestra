"""Findings routes with optional filtering."""

from __future__ import annotations

from fastapi import APIRouter, Query

from backend import store

router = APIRouter(prefix="/api/findings", tags=["findings"])


@router.get("/")
async def list_findings(
    severity: str | None = Query(None, description="Filter by severity"),
    type: str | None = Query(None, description="Filter by finding type"),
    status: str | None = Query(None, description="Filter by status"),
) -> list[dict]:
    """Return all findings, optionally filtered by severity, type, or status."""
    items = list(store.findings.values())

    if severity is not None:
        items = [f for f in items if f.get("severity") == severity]
    if type is not None:
        items = [f for f in items if f.get("type") == type]
    if status is not None:
        items = [f for f in items if f.get("status") == status]

    return items
