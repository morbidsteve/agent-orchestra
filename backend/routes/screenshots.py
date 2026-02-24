"""Screenshot management routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from backend import store
from backend.models import ScreenshotRequest
from backend.services.screenshots import (
    capture_browser_screenshot,
    capture_terminal_snapshot,
)

router = APIRouter(prefix="/api/screenshots", tags=["screenshots"])


@router.get("/")
async def list_screenshots(execution_id: str | None = None) -> list[dict]:
    """Return screenshots, optionally filtered by execution_id."""
    items = list(store.screenshots.values())
    if execution_id:
        items = [s for s in items if s.get("executionId") == execution_id]
    items.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
    return items


@router.post("/", status_code=201)
async def create_screenshot(req: ScreenshotRequest) -> dict:
    """Create a screenshot (internal trigger)."""
    if req.type == "terminal":
        screenshot = await capture_terminal_snapshot(
            execution_id=req.execution_id,
            phase=req.phase,
            output_lines=req.terminal_lines,
            milestone=req.milestone,
        )
        return screenshot
    elif req.type == "browser":
        if not req.url:
            raise HTTPException(status_code=422, detail="URL required for browser screenshots")
        screenshot = await capture_browser_screenshot(
            url=req.url,
            execution_id=req.execution_id,
            milestone=req.milestone,
        )
        if screenshot is None:
            raise HTTPException(
                status_code=503,
                detail="Browser screenshot capture unavailable (Playwright not installed)",
            )
        return screenshot
    else:
        raise HTTPException(status_code=422, detail=f"Unknown screenshot type: {req.type}")


@router.get("/{screenshot_id}")
async def get_screenshot(screenshot_id: str) -> dict:
    """Return a single screenshot by ID."""
    screenshot = store.screenshots.get(screenshot_id)
    if screenshot is None:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return screenshot


@router.get("/{screenshot_id}/image")
async def get_screenshot_image(screenshot_id: str):
    """Serve screenshot image (PNG file for browser, JSON for terminal snapshots)."""
    screenshot = store.screenshots.get(screenshot_id)
    if screenshot is None:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    if screenshot.get("type") == "terminal":
        # Return terminal lines as JSON
        return JSONResponse(content={
            "type": "terminal",
            "terminalLines": screenshot.get("terminalLines", []),
            "phase": screenshot.get("phase", ""),
            "milestone": screenshot.get("milestone", ""),
        })

    # Browser screenshot — serve the PNG file
    filepath = Path("/workspace/screenshots") / f"{screenshot_id}.png"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Screenshot image file not found")
    return FileResponse(str(filepath), media_type="image/png")
