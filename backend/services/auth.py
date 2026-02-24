"""Auth service — manages GitHub and Claude authentication status."""

from __future__ import annotations

import asyncio
import base64
import fcntl
import hashlib
import json
import logging
import os
import pty
import re
import secrets
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

# Module-level login session state (follows orchestrator.py pattern)
_login_session: dict | None = None
_claude_login_session: dict | None = None

# ---------------------------------------------------------------------------
# Claude OAuth 2.0 PKCE constants
# ---------------------------------------------------------------------------
_CLAUDE_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
_CLAUDE_OAUTH_AUTHORIZE_URL = "https://claude.ai/oauth/authorize"
_CLAUDE_OAUTH_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token"
_CLAUDE_OAUTH_REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback"
_CLAUDE_OAUTH_SCOPES = "user:profile user:inference user:sessions:claude_code user:mcp_servers"
_CLAUDE_CREDENTIALS_PATH = os.path.expanduser("~/.claude/.credentials.json")


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
    """Check Claude auth by reading the credentials file directly."""
    cred_path = _CLAUDE_CREDENTIALS_PATH
    try:
        if os.path.isfile(cred_path):
            with open(cred_path) as f:
                data = json.load(f)
            oauth = data.get("claudeAiOauth", {})
            if oauth.get("accessToken"):
                expires_at = oauth.get("expiresAt", 0)
                if expires_at > time.time() * 1000:
                    return {
                        "authenticated": True,
                        "email": oauth.get("email"),
                        "authMethod": "oauth",
                    }
    except (OSError, json.JSONDecodeError, KeyError):
        pass

    # Fallback: try the CLI if available
    if shutil.which("claude"):
        try:
            process = await asyncio.create_subprocess_exec(
                "claude", "auth", "status",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5)
            output = (stdout or b"").decode().strip()

            if process.returncode == 0 and output:
                try:
                    cli_data = json.loads(output)
                    if cli_data.get("loggedIn"):
                        return {
                            "authenticated": True,
                            "email": cli_data.get("email"),
                            "authMethod": cli_data.get("authMethod"),
                        }
                except json.JSONDecodeError:
                    pass
                return {"authenticated": True}
        except (asyncio.TimeoutError, OSError):
            pass

    return {"authenticated": False}


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
# Claude Code OAuth login (direct PKCE — no CLI subprocess)
# ---------------------------------------------------------------------------


async def start_claude_login() -> dict:
    """Generate OAuth PKCE params and return the authorization URL.

    This implements the OAuth 2.0 Authorization Code + PKCE flow directly,
    bypassing the ``claude auth login`` CLI.  The redirect goes to
    Anthropic's server (not localhost), so no port-forwarding is required
    inside Docker.
    """
    global _claude_login_session

    if _claude_login_session and _claude_login_session.get("status") == "pending":
        return {
            "authUrl": _claude_login_session.get("authUrl"),
            "status": "pending",
        }

    # Check if already authenticated
    status = await _get_claude_status()
    if status.get("authenticated"):
        _claude_login_session = {"status": "authenticated"}
        return {"authUrl": None, "status": "already_authenticated"}

    # Generate PKCE code_verifier & code_challenge
    code_verifier = secrets.token_urlsafe(32)
    code_challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )
    state = secrets.token_hex(32)

    params = {
        "code": "true",
        "client_id": _CLAUDE_OAUTH_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": _CLAUDE_OAUTH_REDIRECT_URI,
        "scope": _CLAUDE_OAUTH_SCOPES,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "state": state,
    }
    auth_url = f"{_CLAUDE_OAUTH_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"

    _claude_login_session = {
        "status": "pending",
        "authUrl": auth_url,
        "code_verifier": code_verifier,
        "state": state,
    }

    logger.info("Claude OAuth: generated auth URL (state=%s…)", state[:8])
    return {"authUrl": auth_url, "status": "pending"}


async def submit_claude_auth_code(code: str) -> dict:
    """Exchange the authorization code for tokens and write credentials."""
    global _claude_login_session

    if not _claude_login_session:
        return {"status": "error", "error": "No active login session"}

    code_verifier = _claude_login_session.get("code_verifier")
    state = _claude_login_session.get("state")
    if not code_verifier:
        return {"status": "error", "error": "No PKCE verifier — start login first"}

    try:
        token_body = json.dumps({
            "grant_type": "authorization_code",
            "client_id": _CLAUDE_OAUTH_CLIENT_ID,
            "code": code.strip(),
            "redirect_uri": _CLAUDE_OAUTH_REDIRECT_URI,
            "code_verifier": code_verifier,
            "state": state,
        }).encode()

        req = urllib.request.Request(
            _CLAUDE_OAUTH_TOKEN_URL,
            data=token_body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "claude-code/2.1.52",
            },
            method="POST",
        )

        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(
            None, lambda: urllib.request.urlopen(req, timeout=15),
        )
        result = json.loads(resp.read().decode())

        access_token = result.get("access_token", "")
        refresh_token = result.get("refresh_token", "")
        expires_in = result.get("expires_in", 3600)

        credentials = {
            "claudeAiOauth": {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresAt": int(time.time() * 1000) + (expires_in * 1000),
                "scopes": _CLAUDE_OAUTH_SCOPES.split(" "),
            },
        }

        cred_dir = os.path.dirname(_CLAUDE_CREDENTIALS_PATH)
        os.makedirs(cred_dir, exist_ok=True)
        with open(_CLAUDE_CREDENTIALS_PATH, "w") as f:
            json.dump(credentials, f, indent=2)
        os.chmod(_CLAUDE_CREDENTIALS_PATH, 0o600)

        logger.info("Claude OAuth: tokens written to %s", _CLAUDE_CREDENTIALS_PATH)
        _claude_login_session = {"status": "authenticated"}
        return {"status": "authenticated"}

    except urllib.error.HTTPError as exc:
        body = exc.read().decode() if exc.fp else str(exc)
        logger.error("Claude OAuth token exchange failed: %s %s", exc.code, body)
        _claude_login_session["status"] = "error"
        _claude_login_session["error"] = f"Token exchange failed ({exc.code})"
        return {"status": "error", "error": f"Token exchange failed ({exc.code})"}
    except Exception as exc:
        logger.exception("Claude OAuth token exchange failed")
        _claude_login_session["status"] = "error"
        _claude_login_session["error"] = str(exc)
        return {"status": "error", "error": str(exc)}


def get_claude_login_status() -> dict:
    """Return the current Claude login session state."""
    if _claude_login_session is None:
        return {"status": "none"}
    return {
        "status": _claude_login_session.get("status", "none"),
        "authUrl": _claude_login_session.get("authUrl"),
        "error": _claude_login_session.get("error"),
    }
