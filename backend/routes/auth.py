"""Authentication management routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.services.auth import (
    get_auth_status,
    get_login_session_status,
    github_logout,
    start_github_login,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status")
async def auth_status() -> dict:
    """Return combined GitHub + Claude auth status."""
    return await get_auth_status()


@router.post("/github/login")
async def github_login() -> dict:
    """Initiate GitHub device flow login."""
    try:
        return await start_github_login()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/github/status")
async def github_login_status() -> dict:
    """Poll the current GitHub login session progress."""
    return get_login_session_status()


@router.post("/github/logout")
async def github_logout_route() -> dict:
    """Logout from GitHub."""
    return await github_logout()
