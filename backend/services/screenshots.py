"""Screenshot capture service — terminal snapshots and optional browser screenshots."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend import store


async def capture_terminal_snapshot(
    execution_id: str,
    phase: str,
    output_lines: list[str],
    milestone: str = "",
) -> dict[str, Any]:
    """Capture a terminal snapshot (last 20 lines of output)."""
    screenshot_id = store.next_screenshot_id()
    lines = output_lines[-20:] if len(output_lines) > 20 else list(output_lines)

    screenshot: dict[str, Any] = {
        "id": screenshot_id,
        "executionId": execution_id,
        "type": "terminal",
        "phase": phase,
        "milestone": milestone or f"{phase} phase complete",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "terminalLines": lines,
    }
    store.screenshots[screenshot_id] = screenshot
    return screenshot


async def capture_browser_screenshot(
    url: str,
    execution_id: str,
    milestone: str = "",
) -> dict[str, Any] | None:
    """Attempt to capture a browser screenshot using Playwright (optional)."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None

    screenshot_id = store.next_screenshot_id()
    screenshots_dir = Path("/workspace/screenshots")
    screenshots_dir.mkdir(exist_ok=True)
    filepath = screenshots_dir / f"{screenshot_id}.png"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1280, "height": 720})
            await page.goto(url, wait_until="networkidle", timeout=15000)
            await page.screenshot(path=str(filepath))
            await browser.close()
    except Exception:
        return None

    screenshot: dict[str, Any] = {
        "id": screenshot_id,
        "executionId": execution_id,
        "type": "browser",
        "phase": "security",
        "milestone": milestone or "Live product screenshot",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "imageUrl": f"/api/screenshots/{screenshot_id}/image",
    }
    store.screenshots[screenshot_id] = screenshot
    return screenshot
