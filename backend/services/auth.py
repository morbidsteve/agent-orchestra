"""Auth service — manages GitHub and Claude authentication status."""

from __future__ import annotations

import asyncio
import re
import shutil

# Module-level login session state (follows orchestrator.py pattern)
_login_session: dict | None = None


async def get_auth_status() -> dict:
    """Get combined GitHub + Claude auth status by running CLI commands."""
    github = await _get_github_status()
    claude = await _get_claude_status()
    return {"github": github, "claude": claude}


async def _get_github_status() -> dict:
    """Run `gh auth status` and parse the output."""
    if not shutil.which("gh"):
        return {"authenticated": False, "username": None, "error": "gh CLI not installed"}

    try:
        process = await asyncio.create_subprocess_exec(
            "gh", "auth", "status",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
        output = (stdout or b"").decode() + (stderr or b"").decode()

        # gh auth status outputs to stderr on success
        match = re.search(r"Logged in to github\.com.*?as\s+(\S+)", output)
        if match:
            return {"authenticated": True, "username": match.group(1)}
        return {"authenticated": False, "username": None}
    except (asyncio.TimeoutError, OSError):
        return {"authenticated": False, "username": None, "error": "Failed to check status"}


async def _get_claude_status() -> dict:
    """Run `claude auth status` and parse the output."""
    if not shutil.which("claude"):
        return {"authenticated": False, "error": "Claude CLI not installed"}

    try:
        process = await asyncio.create_subprocess_exec(
            "claude", "auth", "status",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
        output = (stdout or b"").decode() + (stderr or b"").decode()

        # If exit code is 0, consider authenticated
        if process.returncode == 0:
            return {"authenticated": True, "status": output.strip()}
        return {"authenticated": False, "status": output.strip()}
    except (asyncio.TimeoutError, OSError):
        return {"authenticated": False, "error": "Failed to check status"}


async def start_github_login() -> dict:
    """Spawn `gh auth login --web` and extract the device code from stderr."""
    global _login_session

    if _login_session and _login_session.get("status") == "pending":
        return {
            "deviceCode": _login_session.get("deviceCode"),
            "verificationUrl": _login_session.get("verificationUrl", "https://github.com/login/device"),
            "status": "pending",
        }

    if not shutil.which("gh"):
        raise RuntimeError("gh CLI not installed")

    process = await asyncio.create_subprocess_exec(
        "gh", "auth", "login", "--web", "-h", "github.com",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    _login_session = {
        "process": process,
        "status": "pending",
        "deviceCode": None,
        "verificationUrl": "https://github.com/login/device",
    }

    # Read stderr to find the device code
    device_code = None
    try:
        assert process.stderr is not None
        while True:
            line_bytes = await asyncio.wait_for(process.stderr.readline(), timeout=15)
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace")
            code_match = re.search(r"one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})", line, re.IGNORECASE)
            if code_match:
                device_code = code_match.group(1)
                _login_session["deviceCode"] = device_code
                break
    except asyncio.TimeoutError:
        _login_session["status"] = "error"
        _login_session["error"] = "Timed out waiting for device code"

    if device_code:
        # Send Enter to trigger browser open, then monitor process in background
        asyncio.create_task(_monitor_login_process(process))
        return {
            "deviceCode": device_code,
            "verificationUrl": "https://github.com/login/device",
            "status": "pending",
        }
    else:
        _login_session["status"] = "error"
        _login_session["error"] = "Could not extract device code"
        return {"deviceCode": None, "verificationUrl": None, "status": "error"}


async def _monitor_login_process(process: asyncio.subprocess.Process) -> None:
    """Background task: send Enter to stdin and wait for process to complete."""
    global _login_session
    try:
        if process.stdin:
            process.stdin.write(b"\n")
            await process.stdin.drain()

        await asyncio.wait_for(process.wait(), timeout=300)  # 5 min timeout

        if process.returncode == 0:
            # Login succeeded — get username
            status = await _get_github_status()
            if _login_session:
                _login_session["status"] = "authenticated"
                _login_session["username"] = status.get("username")
        else:
            if _login_session:
                _login_session["status"] = "error"
                _login_session["error"] = "Login process failed"
    except asyncio.TimeoutError:
        if _login_session:
            _login_session["status"] = "error"
            _login_session["error"] = "Login timed out"
    except Exception:
        if _login_session:
            _login_session["status"] = "error"
            _login_session["error"] = "Unexpected error during login"


def get_login_session_status() -> dict:
    """Return the current login session state."""
    if _login_session is None:
        return {"status": "none"}
    return {
        "status": _login_session.get("status", "none"),
        "deviceCode": _login_session.get("deviceCode"),
        "username": _login_session.get("username"),
        "error": _login_session.get("error"),
    }


async def github_logout() -> dict:
    """Run `gh auth logout -h github.com`."""
    global _login_session
    _login_session = None

    if not shutil.which("gh"):
        return {"success": False, "error": "gh CLI not installed"}

    try:
        process = await asyncio.create_subprocess_exec(
            "gh", "auth", "logout", "-h", "github.com", "-y",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(process.communicate(), timeout=10)
        return {"success": process.returncode == 0}
    except (asyncio.TimeoutError, OSError):
        return {"success": False, "error": "Failed to logout"}
