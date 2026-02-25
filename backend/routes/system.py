"""System management routes."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse

router = APIRouter(prefix="/api/system", tags=["system"])

# Resolve repo root: prefer /workspace (devcontainer), fall back to /app (production Docker)
APP_DIR = Path("/workspace") if Path("/workspace/.git").is_dir() else Path("/app")


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class UpdateRequest(BaseModel):
    """Optional body for POST /update. When *tag* is provided the system
    checks out that specific release tag instead of pulling latest master."""

    tag: str | None = None


# ---------------------------------------------------------------------------
# Subprocess helpers
# ---------------------------------------------------------------------------

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


async def _run_output(cmd: list[str], cwd: str | None = None) -> tuple[int, str, str]:
    """Run a subprocess and return (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode().strip(), stderr.decode().strip()


def _restart() -> None:
    """Replace the current process with a fresh backend instance."""
    os.execv(sys.executable, [sys.executable, "-m", "backend.run"])


# ---------------------------------------------------------------------------
# Helper: resolve current tag & commit
# ---------------------------------------------------------------------------

async def _current_tag() -> str | None:
    """Return the tag name if HEAD points exactly at a tag, else None."""
    rc, out, _ = await _run_output(
        ["git", "-C", str(APP_DIR), "describe", "--tags", "--exact-match", "HEAD"],
    )
    return out if rc == 0 and out else None


async def _current_commit() -> str:
    """Return the abbreviated commit hash for HEAD."""
    _, out, _ = await _run_output(
        ["git", "-C", str(APP_DIR), "rev-parse", "--short", "HEAD"],
    )
    return out


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/tags")
async def system_tags() -> JSONResponse:
    """List all git tags sorted by version descending, with current ref info."""
    # 1. Try to fetch remote tags (best-effort — still list local tags if fetch fails)
    await _run_output(
        ["git", "-C", str(APP_DIR), "fetch", "--tags", "origin"],
    )

    # 2. List tags sorted by version descending
    rc, out, err = await _run_output(
        ["git", "-C", str(APP_DIR), "tag", "--sort=-v:refname"],
    )
    if rc != 0:
        return JSONResponse(
            {"status": "error", "message": f"git tag list failed: {err}"},
            status_code=500,
        )

    tag_names = [t for t in out.splitlines() if t]

    # 3. Get all tags with dates in a single command
    tags: list[dict[str, str]] = []
    if tag_names:
        rc2, ref_out, _ = await _run_output(
            ["git", "-C", str(APP_DIR), "for-each-ref", "--sort=-v:refname",
             "--format=%(refname:short)\t%(creatordate:iso-strict)", "refs/tags/"],
        )
        if rc2 == 0 and ref_out:
            date_map: dict[str, str] = {}
            for line in ref_out.splitlines():
                parts = line.split("\t", 1)
                if len(parts) == 2:
                    date_map[parts[0]] = parts[1]
            tags = [{"name": n, "date": date_map.get(n, "")} for n in tag_names]
        else:
            # Fallback: tags without dates
            tags = [{"name": n, "date": ""} for n in tag_names]

    # 4. Current tag and commit
    current = await _current_tag()
    commit = await _current_commit()

    return JSONResponse({
        "tags": tags,
        "current_tag": current,
        "current_commit": commit,
    })


@router.get("/version")
async def system_version() -> JSONResponse:
    """Return current version info: tag, commit, and whether HEAD is on latest master."""
    # Fetch so we have up-to-date origin/master ref
    await _run(["git", "-C", str(APP_DIR), "fetch", "origin", "master"])

    current = await _current_tag()
    commit = await _current_commit()

    # Compare HEAD with origin/master
    _, head_sha, _ = await _run_output(
        ["git", "-C", str(APP_DIR), "rev-parse", "HEAD"],
    )
    _, master_sha, _ = await _run_output(
        ["git", "-C", str(APP_DIR), "rev-parse", "origin/master"],
    )
    on_latest_master = head_sha == master_sha

    return JSONResponse({
        "current_tag": current,
        "current_commit": commit,
        "on_latest_master": on_latest_master,
    })


@router.post("/update")
async def system_update(body: UpdateRequest | None = None) -> JSONResponse:
    """Pull the latest code (or switch to a specific tag) and reinstall deps."""
    tag = body.tag if body else None

    if tag:
        # --- Tag-based checkout ---
        # 1a. Fetch all tags from origin
        rc, _, err = await _run_output(
            ["git", "-C", str(APP_DIR), "fetch", "--tags", "origin"],
        )
        if rc != 0:
            return JSONResponse(
                {"status": "error", "message": f"git fetch --tags failed: {err}"},
                status_code=500,
            )

        # 1b. Validate the tag exists
        rc, out, _ = await _run_output(
            ["git", "-C", str(APP_DIR), "tag", "-l", "--", tag],
        )
        if rc != 0 or out.strip() != tag:
            return JSONResponse(
                {"status": "error", "message": f"Tag '{tag}' does not exist"},
                status_code=400,
            )

        # 1c. Checkout the tag (detached HEAD)
        rc, err = await _run(["git", "-C", str(APP_DIR), "checkout", f"tags/{tag}"])
        if rc != 0:
            return JSONResponse(
                {"status": "error", "message": f"git checkout {tag} failed: {err}"},
                status_code=500,
            )
    else:
        # --- Latest master (original behaviour) ---
        # 1. Fetch latest from origin
        rc, err = await _run(["git", "-C", str(APP_DIR), "fetch", "origin", "master"])
        if rc != 0:
            return JSONResponse(
                {"status": "error", "message": f"git fetch failed: {err}"},
                status_code=500,
            )

        # 2. Hard-reset to origin/master
        rc, err = await _run(
            ["git", "-C", str(APP_DIR), "reset", "--hard", "origin/master"],
        )
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
