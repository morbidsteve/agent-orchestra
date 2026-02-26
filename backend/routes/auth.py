"""Authentication management routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from pydantic import BaseModel

from backend.services.auth import (
    claude_logout,
    get_auth_status,
    get_claude_login_status,
    get_login_session_status,
    github_logout,
    start_claude_login,
    start_github_login,
    submit_claude_auth_code,
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


@router.post("/claude/logout")
async def claude_logout_route() -> dict:
    """Logout from Claude."""
    return await claude_logout()


@router.post("/claude/login")
async def claude_login() -> dict:
    """Initiate Claude Code login flow."""
    try:
        return await start_claude_login()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/claude/status")
async def claude_login_status() -> dict:
    """Poll the current Claude login session progress."""
    return get_claude_login_status()


class ClaudeAuthCodeRequest(BaseModel):
    code: str


@router.post("/claude/callback")
async def claude_auth_callback(request: ClaudeAuthCodeRequest) -> dict:
    """Submit the authentication code from the browser back to the Claude CLI."""
    return await submit_claude_auth_code(request.code)
