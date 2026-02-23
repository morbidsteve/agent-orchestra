"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import store
from backend.config import settings
from backend.routes import agents, auth, executions, findings, ws


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan — initialize state on startup."""
    store.init_agents()
    yield


app = FastAPI(title="Agent Orchestra API", lifespan=lifespan)

# ──────────────────────────────────────────────────────────────────────────────
# CORS
# ──────────────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
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


# ──────────────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health_check() -> dict:
    """Health-check endpoint."""
    return {"status": "ok"}
