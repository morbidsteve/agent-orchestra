"""Auth service — manages GitHub and Claude authentication status."""

from __future__ import annotations

import asyncio
import json
import logging
import os
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
    """Spawn `gh auth login --web` and extract the device code."""
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

    # gh may output the device code to stdout OR stderr depending on TTY.
    # Read from both concurrently.
    device_code: str | None = None
    verification_url = "https://github.com/login/device"

    async def _scan_for_code(
        stream: asyncio.StreamReader | None,
    ) -> tuple[str | None, str | None]:
        """Read lines from a stream looking for the device code and URL."""
        if stream is None:
            return None, None
        code: str | None = None
        url: str | None = None
        try:
            while True:
                line_bytes = await asyncio.wait_for(stream.readline(), timeout=10)
                if not line_bytes:
                    break
                line = line_bytes.decode("utf-8", errors="replace")
                # Match: "one-time code: XXXX-XXXX" or "First copy your one-time code: XXXX-XXXX"
                code_match = re.search(
                    r"code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})", line, re.IGNORECASE
                )
                if code_match:
                    code = code_match.group(1)
                url_match = re.search(
                    r"(https://github\.com/login/device\S*)", line
                )
                if url_match:
                    url = url_match.group(1)
                if code:
                    break
        except asyncio.TimeoutError:
            pass
        return code, url

    try:
        stdout_task = asyncio.create_task(_scan_for_code(process.stdout))
        stderr_task = asyncio.create_task(_scan_for_code(process.stderr))

        done, pending = await asyncio.wait(
            [stdout_task, stderr_task],
            timeout=15,
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in done:
            code, url = task.result()
            if code:
                device_code = code
            if url:
                verification_url = url

        # If we didn't find it in the first stream, check the other
        if not device_code:
            for task in pending:
                try:
                    code, url = await asyncio.wait_for(task, timeout=5)
                    if code:
                        device_code = code
                    if url:
                        verification_url = url
                except asyncio.TimeoutError:
                    task.cancel()

        # Cancel any remaining pending tasks
        for task in pending:
            if not task.done():
                task.cancel()

    except Exception:
        _login_session["status"] = "error"
        _login_session["error"] = "Failed to read device code"

    if device_code:
        _login_session["deviceCode"] = device_code
        _login_session["verificationUrl"] = verification_url
        asyncio.create_task(_monitor_login_process(process))
        return {
            "deviceCode": device_code,
            "verificationUrl": verification_url,
            "status": "pending",
        }
    else:
        _login_session["status"] = "error"
        _login_session["error"] = "Could not extract device code"
        # Clean up the leaked process
        try:
            process.kill()
        except ProcessLookupError:
            pass
        return {"deviceCode": None, "verificationUrl": None, "status": "error"}


async def _monitor_login_process(process: asyncio.subprocess.Process) -> None:
    """Background task: wait for gh login process to complete."""
    global _login_session
    try:
        # Do NOT send \\n to stdin — we are headless; the user authenticates
        # via the device code in their browser.
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
        try:
            process.kill()
        except ProcessLookupError:
            pass
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


# ---------------------------------------------------------------------------
# Claude Code OAuth login
# ---------------------------------------------------------------------------


async def start_claude_login() -> dict:
    """Spawn `claude auth login` and extract the auth URL."""
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

    # Set BROWSER=echo so the CLI prints the auth URL instead of trying
    # to open a browser (which fails in headless Docker environments).
    env = {**os.environ, "BROWSER": "echo"}

    process = await asyncio.create_subprocess_exec(
        "claude", "auth", "login",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )

    _claude_login_session = {
        "process": process,
        "status": "pending",
        "authUrl": None,
    }

    # Scan both streams for the auth URL, returning the instant it's found.
    auth_url: str | None = None

    async def _scan_for_url(
        stream: asyncio.StreamReader | None, name: str,
    ) -> str | None:
        """Read lines and return the first HTTPS URL found."""
        if stream is None:
            return None
        try:
            while True:
                line_bytes = await asyncio.wait_for(stream.readline(), timeout=3)
                if not line_bytes:
                    break
                line = line_bytes.decode("utf-8", errors="replace")
                logger.debug("claude auth login %s: %s", name, line.rstrip())
                url_match = re.search(r"(https://\S+)", line)
                if url_match:
                    return url_match.group(1)
        except asyncio.TimeoutError:
            pass
        return None

    try:
        stdout_task = asyncio.create_task(_scan_for_url(process.stdout, "stdout"))
        stderr_task = asyncio.create_task(_scan_for_url(process.stderr, "stderr"))

        done, pending = await asyncio.wait(
            [stdout_task, stderr_task],
            timeout=8,
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in done:
            result = task.result()
            if result:
                auth_url = result
                break

        # If first stream didn't have the URL, check the other
        if not auth_url:
            for task in pending:
                try:
                    result = await asyncio.wait_for(task, timeout=3)
                    if result:
                        auth_url = result
                except asyncio.TimeoutError:
                    task.cancel()

        for task in pending:
            if not task.done():
                task.cancel()

    except Exception:
        logger.exception("Error reading claude auth login output")
        _claude_login_session["status"] = "error"
        _claude_login_session["error"] = "Timed out waiting for auth URL"

    if auth_url:
        _claude_login_session["authUrl"] = auth_url
        asyncio.create_task(_monitor_claude_login(process))
        return {"authUrl": auth_url, "status": "pending"}
    else:
        _claude_login_session["status"] = "error"
        _claude_login_session["error"] = "Could not extract auth URL"
        # Clean up the leaked process
        try:
            process.kill()
        except ProcessLookupError:
            pass
        return {"authUrl": None, "status": "error"}


async def _drain_stream(stream: asyncio.StreamReader | None) -> None:
    """Read and discard all output from a stream to prevent pipe deadlocks."""
    if stream is None:
        return
    try:
        while True:
            chunk = await asyncio.wait_for(stream.read(4096), timeout=1)
            if not chunk:
                break
    except (asyncio.TimeoutError, Exception):
        pass


async def _monitor_claude_login(process: asyncio.subprocess.Process) -> None:
    """Wait for claude auth login process to complete.

    Also drains stdout/stderr so the process doesn't deadlock on pipe writes.
    """
    global _claude_login_session

    # Keep draining stdout/stderr so the process doesn't block if it
    # outputs prompts (e.g., "Enter code:") after the auth URL.
    drain_out = asyncio.create_task(_drain_stream(process.stdout))
    drain_err = asyncio.create_task(_drain_stream(process.stderr))

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
        drain_out.cancel()
        drain_err.cancel()


async def submit_claude_auth_code(code: str) -> dict:
    """Write the user-provided auth code to the claude login process stdin."""
    global _claude_login_session

    if not _claude_login_session:
        return {"status": "error", "error": "No active login session"}

    process = _claude_login_session.get("process")
    if not process or process.returncode is not None:
        return {"status": "error", "error": "Login process is not running"}

    try:
        process.stdin.write(f"{code}\n".encode())
        await process.stdin.drain()
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
