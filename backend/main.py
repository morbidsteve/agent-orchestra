"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import store
from backend.config import settings
from backend.routes import (
    agents,
    auth,
    conversations,
    executions,
    filesystem,
    findings,
    internal,
    internal_dynamic,
    screenshots,
    system,
    ws,
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan — initialize state on startup."""
    import logging

    from backend.services.sandbox import get_sandbox_status

    store.init_agents()

    status = get_sandbox_status()
    logger = logging.getLogger("backend.main")
    if status.sandboxed:
        logger.info("Sandbox: running inside %s — agents enabled", status.container_type)
    elif status.override_active:
        logger.warning("Sandbox: NOT in a container but ORCHESTRA_ALLOW_HOST=true — agents enabled (unsafe)")
    else:
        logger.warning(
            "Sandbox: NOT in a container — agent execution will be BLOCKED. "
            "Use a devcontainer/Docker or set ORCHESTRA_ALLOW_HOST=true to override."
        )

    yield


app = FastAPI(title="Agent Orchestra API", lifespan=lifespan)

# ──────────────────────────────────────────────────────────────────────────────
# CORS
# ──────────────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# ──────────────────────────────────────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────────────────────────────────────

app.include_router(executions.router)
app.include_router(agents.router)
app.include_router(findings.router)
app.include_router(ws.router)
app.include_router(auth.router)
app.include_router(filesystem.router)
app.include_router(conversations.router)
app.include_router(screenshots.router)
app.include_router(system.router)
app.include_router(internal.router)
app.include_router(internal_dynamic.router)
app.include_router(executions._codebase_router)


# ──────────────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health_check() -> dict:
    """Health-check endpoint."""
    return {"status": "ok"}


@app.get("/api/debug/orchestrator")
async def debug_orchestrator() -> dict:
    """Debug endpoint — shows orchestrator availability info."""
    import shutil
    import os
    from backend.services.orchestrator import _check_orchestrator_available

    claude_path = shutil.which("claude")
    return {
        "claude_cli_found": claude_path is not None,
        "claude_cli_path": claude_path,
        "orchestrator_available": _check_orchestrator_available(),
        "CLAUDECODE_env": os.environ.get("CLAUDECODE", "<not set>"),
        "PATH": os.environ.get("PATH", ""),
    }
