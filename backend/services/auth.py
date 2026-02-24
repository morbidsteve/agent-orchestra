"""Auth service — manages GitHub and Claude authentication status."""

from __future__ import annotations

import asyncio
import fcntl
import json
import logging
import os
import pty
import re
import shutil

logger = logging.getLogger(__name__)

# Module-level login session state (follows orchestrator.py pattern)
_login_session: dict | None = None
_claude_login_session: dict | None = None


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
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5)
        output = (stdout or b"").decode().strip()

        if process.returncode == 0 and output:
            # claude auth status outputs JSON: {"loggedIn": true, "email": "...", ...}
            try:
                data = json.loads(output)
                if data.get("loggedIn"):
                    return {
                        "authenticated": True,
                        "email": data.get("email"),
                        "authMethod": data.get("authMethod"),
                    }
            except json.JSONDecodeError:
                pass
            # Fallback: exit 0 means authenticated even if output isn't JSON
            return {"authenticated": True}
        return {"authenticated": False}
    except (asyncio.TimeoutError, OSError):
        return {"authenticated": False, "error": "Failed to check status"}


# ---------------------------------------------------------------------------
# GitHub device-flow login
# ---------------------------------------------------------------------------


async def start_github_login() -> dict:
    """Spawn `gh auth login --web` in a PTY and extract the device code."""
    global _login_session

    if _login_session and _login_session.get("status") == "pending":
        return {
            "deviceCode": _login_session.get("deviceCode"),
            "verificationUrl": _login_session.get(
                "verificationUrl", "https://github.com/login/device"
            ),
            "status": "pending",
        }

    if not shutil.which("gh"):
        raise RuntimeError("gh CLI not installed")

    # Use a PTY so the CLI outputs its device code properly.
    master_fd, slave_fd = pty.openpty()
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    process = await asyncio.create_subprocess_exec(
        "gh", "auth", "login", "--web", "-h", "github.com",
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
    )

    os.close(slave_fd)

    _login_session = {
        "process": process,
        "master_fd": master_fd,
        "status": "pending",
        "deviceCode": None,
        "verificationUrl": "https://github.com/login/device",
    }

    device_code: str | None = None
    verification_url = "https://github.com/login/device"
    loop = asyncio.get_event_loop()
    buf = ""

    async def _read_chunk() -> str:
        try:
            data = await asyncio.wait_for(
                loop.run_in_executor(None, os.read, master_fd, 4096),
                timeout=3,
            )
            return data.decode("utf-8", errors="replace")
        except (asyncio.TimeoutError, OSError):
            return ""

    try:
        deadline = loop.time() + 15
        while loop.time() < deadline:
            chunk = await _read_chunk()
            if chunk:
                buf += chunk
                logger.debug("gh auth login pty: %s", chunk.rstrip())
                code_match = re.search(
                    r"code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})", buf, re.IGNORECASE,
                )
                if code_match:
                    device_code = code_match.group(1)
                url_match = re.search(
                    r"(https://github\.com/login/device\S*)", buf,
                )
                if url_match:
                    verification_url = url_match.group(1)
                if device_code:
                    break
            else:
                await asyncio.sleep(0.2)
    except Exception:
        _login_session["status"] = "error"
        _login_session["error"] = "Failed to read device code"

    if device_code:
        _login_session["deviceCode"] = device_code
        _login_session["verificationUrl"] = verification_url
        asyncio.create_task(_monitor_github_login_pty(process, master_fd))
        return {
            "deviceCode": device_code,
            "verificationUrl": verification_url,
            "status": "pending",
        }
    else:
        _login_session["status"] = "error"
        _login_session["error"] = "Could not extract device code"
        try:
            process.kill()
        except ProcessLookupError:
            pass
        os.close(master_fd)
        return {"deviceCode": None, "verificationUrl": None, "status": "error"}


async def _monitor_github_login_pty(
    process: asyncio.subprocess.Process,
    master_fd: int,
) -> None:
    """Background: drain the PTY and wait for gh login to complete."""
    global _login_session
    loop = asyncio.get_event_loop()

    async def _drain() -> None:
        while True:
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(None, os.read, master_fd, 4096),
                    timeout=2,
                )
            except (asyncio.TimeoutError, OSError):
                if process.returncode is not None:
                    break
                await asyncio.sleep(0.5)

    drain_task = asyncio.create_task(_drain())

    try:
        await asyncio.wait_for(process.wait(), timeout=300)
        if process.returncode == 0:
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
        try:
            process.kill()
        except ProcessLookupError:
            pass
    finally:
        drain_task.cancel()
        try:
            os.close(master_fd)
        except OSError:
            pass


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


# ---------------------------------------------------------------------------
# Claude Code OAuth login
# ---------------------------------------------------------------------------


async def start_claude_login() -> dict:
    """Spawn `claude auth login` in a PTY and extract the auth URL.

    Uses a pseudo-terminal because the Claude CLI reads interactive input
    from /dev/tty, not stdin.  A plain pipe would never deliver the auth
    code to the process.
    """
    global _claude_login_session

    if _claude_login_session and _claude_login_session.get("status") == "pending":
        return {
            "authUrl": _claude_login_session.get("authUrl"),
            "status": "pending",
        }

    if not shutil.which("claude"):
        raise RuntimeError("Claude CLI not installed")

    # Check if already authenticated — no need to spawn login
    status = await _get_claude_status()
    if status.get("authenticated"):
        _claude_login_session = {"status": "authenticated"}
        return {"authUrl": None, "status": "already_authenticated"}

    # Create a pseudo-terminal so the CLI thinks it has a real terminal.
    master_fd, slave_fd = pty.openpty()

    # Make the master non-blocking so async reads don't stall the event loop.
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    env = {**os.environ, "BROWSER": "echo"}

    process = await asyncio.create_subprocess_exec(
        "claude", "auth", "login",
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        env=env,
    )

    # Close the slave end in the parent — only the child uses it.
    os.close(slave_fd)

    _claude_login_session = {
        "process": process,
        "master_fd": master_fd,
        "status": "pending",
        "authUrl": None,
    }

    # Read PTY output until we find an HTTPS URL.
    loop = asyncio.get_event_loop()
    auth_url: str | None = None
    buf = ""

    async def _read_chunk() -> str:
        """Read available bytes from the PTY master (non-blocking)."""
        try:
            data = await asyncio.wait_for(
                loop.run_in_executor(None, os.read, master_fd, 4096),
                timeout=3,
            )
            return data.decode("utf-8", errors="replace")
        except (asyncio.TimeoutError, OSError):
            return ""

    try:
        deadline = asyncio.get_event_loop().time() + 10
        while asyncio.get_event_loop().time() < deadline:
            chunk = await _read_chunk()
            if chunk:
                buf += chunk
                logger.debug("claude auth login pty: %s", chunk.rstrip())
                url_match = re.search(r"(https://\S+)", buf)
                if url_match:
                    auth_url = url_match.group(1)
                    break
            else:
                await asyncio.sleep(0.2)
    except Exception:
        logger.exception("Error reading claude auth login output")

    if auth_url:
        _claude_login_session["authUrl"] = auth_url
        asyncio.create_task(_monitor_claude_login_pty(process, master_fd))
        return {"authUrl": auth_url, "status": "pending"}
    else:
        _claude_login_session["status"] = "error"
        _claude_login_session["error"] = "Could not extract auth URL"
        try:
            process.kill()
        except ProcessLookupError:
            pass
        os.close(master_fd)
        return {"authUrl": None, "status": "error"}


async def _monitor_claude_login_pty(
    process: asyncio.subprocess.Process,
    master_fd: int,
) -> None:
    """Background: drain the PTY and wait for the process to exit."""
    global _claude_login_session
    loop = asyncio.get_event_loop()

    async def _drain_pty() -> None:
        """Keep reading from the PTY so the process never blocks on writes."""
        while True:
            try:
                data = await asyncio.wait_for(
                    loop.run_in_executor(None, os.read, master_fd, 4096),
                    timeout=2,
                )
                if data:
                    logger.debug("claude pty drain: %s", data.decode("utf-8", errors="replace").rstrip())
            except (asyncio.TimeoutError, OSError):
                if process.returncode is not None:
                    break
                await asyncio.sleep(0.5)

    drain_task = asyncio.create_task(_drain_pty())

    try:
        await asyncio.wait_for(process.wait(), timeout=300)
        if process.returncode == 0:
            if _claude_login_session:
                _claude_login_session["status"] = "authenticated"
        else:
            if _claude_login_session:
                _claude_login_session["status"] = "error"
                _claude_login_session["error"] = "Login failed"
    except asyncio.TimeoutError:
        if _claude_login_session:
            _claude_login_session["status"] = "error"
            _claude_login_session["error"] = "Login timed out"
        try:
            process.kill()
        except ProcessLookupError:
            pass
    finally:
        drain_task.cancel()
        try:
            os.close(master_fd)
        except OSError:
            pass


async def submit_claude_auth_code(code: str) -> dict:
    """Write the auth code to the PTY so the Claude CLI receives it."""
    global _claude_login_session

    if not _claude_login_session:
        return {"status": "error", "error": "No active login session"}

    master_fd = _claude_login_session.get("master_fd")
    process = _claude_login_session.get("process")
    if not master_fd or not process or process.returncode is not None:
        return {"status": "error", "error": "Login process is not running"}

    try:
        os.write(master_fd, f"{code}\n".encode())
        return {"status": "submitted"}
    except Exception as e:
        logger.exception("Failed to submit auth code")
        return {"status": "error", "error": str(e)}


def get_claude_login_status() -> dict:
    """Return the current Claude login session state."""
    if _claude_login_session is None:
        return {"status": "none"}
    return {
        "status": _claude_login_session.get("status", "none"),
        "authUrl": _claude_login_session.get("authUrl"),
        "error": _claude_login_session.get("error"),
    }
