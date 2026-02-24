"""System management routes."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from fastapi import APIRouter
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse

router = APIRouter(prefix="/api/system", tags=["system"])

APP_DIR = Path("/app")


async def _run(cmd: list[str], cwd: str | None = None) -> tuple[int, str]:
    """Run a subprocess and return (returncode, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    return proc.returncode, stderr.decode().strip()


def _restart() -> None:
    """Replace the current process with a fresh backend instance."""
    os.execv(sys.executable, [sys.executable, "-m", "backend.run"])


@router.post("/update")
async def system_update() -> JSONResponse:
    """Pull the latest code from origin/master and reinstall dependencies."""
    # 1. Fetch latest from origin
    rc, err = await _run(["git", "-C", str(APP_DIR), "fetch", "origin", "master"])
    if rc != 0:
        return JSONResponse(
            {"status": "error", "message": f"git fetch failed: {err}"},
            status_code=500,
        )

    # 2. Hard-reset to origin/master
    rc, err = await _run(["git", "-C", str(APP_DIR), "reset", "--hard", "origin/master"])
    if rc != 0:
        return JSONResponse(
            {"status": "error", "message": f"git reset failed: {err}"},
            status_code=500,
        )

    # 3. Reinstall Python deps (if requirements.txt exists)
    requirements = APP_DIR / "requirements.txt"
    if requirements.exists():
        rc, err = await _run(
            ["pip", "install", "--user", "-q", "-r", str(requirements)],
        )
        if rc != 0:
            return JSONResponse(
                {"status": "error", "message": f"pip install failed: {err}"},
                status_code=500,
            )

    # 4. Reinstall Node deps (if package.json exists)
    dashboard_dir = APP_DIR / "orchestra-dashboard"
    if (dashboard_dir / "package.json").exists():
        rc, err = await _run(["npm", "ci", "--silent"], cwd=str(dashboard_dir))
        if rc != 0:
            return JSONResponse(
                {"status": "error", "message": f"npm ci failed: {err}"},
                status_code=500,
            )

    # Schedule a restart 1 second after the response is sent
    loop = asyncio.get_event_loop()

    def _schedule_restart() -> None:
        loop.call_later(1, _restart)

    return JSONResponse(
        {"status": "ok"},
        background=BackgroundTask(_schedule_restart),
    )
