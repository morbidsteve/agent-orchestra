"""Auth service — manages GitHub and Claude authentication status."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
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


_GH_HOSTS_PATH = os.path.expanduser("~/.config/gh/hosts.yml")


async def _get_github_status() -> dict:
    """Check GitHub auth by reading the gh hosts config directly."""
    # Fast path: read the config file gh uses
    try:
        if os.path.isfile(_GH_HOSTS_PATH):
            with open(_GH_HOSTS_PATH) as f:
                content = f.read()
            # Simple YAML parse — look for oauth_token and user under github.com
            if "oauth_token:" in content:
                user_match = re.search(r"user:\s*(\S+)", content)
                username = user_match.group(1) if user_match else None
                return {"authenticated": True, "username": username}
    except OSError:
        pass

    # Fallback: try the CLI
    if shutil.which("gh"):
        try:
            process = await asyncio.create_subprocess_exec(
                "gh", "auth", "status",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
            output = (stdout or b"").decode() + (stderr or b"").decode()

            match = re.search(r"Logged in to github\.com.*?as\s+(\S+)", output)
            if match:
                return {"authenticated": True, "username": match.group(1)}
        except (asyncio.TimeoutError, OSError):
            pass

    return {"authenticated": False, "username": None}


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
# GitHub device-flow login (direct API — no CLI subprocess)
# ---------------------------------------------------------------------------

# GitHub OAuth App client_id for the gh CLI (public, well-known)
_GH_CLIENT_ID = "178c6fc778ccc68e1d6a"
_GH_DEVICE_CODE_URL = "https://github.com/login/device/code"
_GH_TOKEN_URL = "https://github.com/login/oauth/access_token"
_GH_SCOPES = "repo,read:org,gist"


async def start_github_login() -> dict:
    """Start GitHub device-flow login via the API directly."""
    global _login_session

    if _login_session and _login_session.get("status") == "pending":
        return {
            "deviceCode": _login_session.get("deviceCode"),
            "verificationUrl": _login_session.get(
                "verificationUrl", "https://github.com/login/device"
            ),
            "status": "pending",
        }

    logger.info("GitHub OAuth: requesting device code")

    try:
        body = urllib.parse.urlencode({
            "client_id": _GH_CLIENT_ID,
            "scope": _GH_SCOPES,
        }).encode()

        req = urllib.request.Request(
            _GH_DEVICE_CODE_URL,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )

        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(
            None, lambda: urllib.request.urlopen(req, timeout=10),
        )
        result = json.loads(resp.read().decode())
        logger.info("GitHub OAuth: device code response keys: %s", list(result.keys()))

        device_code = result.get("device_code")
        user_code = result.get("user_code")
        verification_uri = result.get("verification_uri", "https://github.com/login/device")
        expires_in = result.get("expires_in", 900)
        interval = result.get("interval", 5)

        if not device_code or not user_code:
            logger.error("GitHub OAuth: missing device_code or user_code: %s", result)
            return {"deviceCode": None, "verificationUrl": None, "status": "error"}

        _login_session = {
            "status": "pending",
            "deviceCode": user_code,
            "device_code": device_code,
            "verificationUrl": verification_uri,
            "interval": interval,
            "expires_in": expires_in,
        }

        # Start background polling for the user to complete authorization
        asyncio.create_task(_poll_github_device_flow(device_code, interval, expires_in))

        logger.info("GitHub OAuth: user_code=%s verification_uri=%s", user_code, verification_uri)
        return {
            "deviceCode": user_code,
            "verificationUrl": verification_uri,
            "status": "pending",
        }

    except Exception as exc:
        logger.exception("GitHub OAuth: device code request failed")
        return {"deviceCode": None, "verificationUrl": None, "status": "error",
                "error": str(exc)}


async def _github_fetch_username(token: str) -> str | None:
    """Call the GitHub API to get the authenticated user's login."""
    try:
        req = urllib.request.Request(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "agent-orchestra",
            },
        )
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(
            None, lambda: urllib.request.urlopen(req, timeout=10),
        )
        data = json.loads(resp.read().decode())
        return data.get("login")
    except Exception:
        logger.exception("GitHub OAuth: failed to fetch username")
        return None


def _write_gh_hosts_config(token: str, username: str | None) -> None:
    """Write ~/.config/gh/hosts.yml so the gh CLI is authenticated."""
    hosts_dir = os.path.dirname(_GH_HOSTS_PATH)
    os.makedirs(hosts_dir, exist_ok=True)
    content = (
        "github.com:\n"
        f"    oauth_token: {token}\n"
        f"    user: {username or ''}\n"
        "    git_protocol: https\n"
    )
    with open(_GH_HOSTS_PATH, "w") as f:
        f.write(content)
    os.chmod(_GH_HOSTS_PATH, 0o600)
    logger.info("GitHub OAuth: wrote hosts config to %s", _GH_HOSTS_PATH)


async def _poll_github_device_flow(
    device_code: str, interval: int, expires_in: int,
) -> None:
    """Background: poll GitHub until the user authorizes or the code expires."""
    global _login_session
    loop = asyncio.get_event_loop()
    deadline = loop.time() + expires_in

    while loop.time() < deadline:
        await asyncio.sleep(interval)

        try:
            body = urllib.parse.urlencode({
                "client_id": _GH_CLIENT_ID,
                "device_code": device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            }).encode()

            req = urllib.request.Request(
                _GH_TOKEN_URL,
                data=body,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method="POST",
            )

            resp = await loop.run_in_executor(
                None, lambda: urllib.request.urlopen(req, timeout=10),
            )
            result = json.loads(resp.read().decode())

            if "access_token" in result:
                access_token = result["access_token"]
                token_type = result.get("token_type", "bearer")
                logger.info("GitHub OAuth: got access token (type=%s)", token_type)

                # Fetch username from the GitHub API
                username = await _github_fetch_username(access_token)

                # Write the gh hosts config directly
                _write_gh_hosts_config(access_token, username)

                if _login_session:
                    _login_session["status"] = "authenticated"
                    _login_session["username"] = username
                logger.info("GitHub OAuth: authenticated as %s", username)
                return

            error = result.get("error")
            if error == "authorization_pending":
                continue
            elif error == "slow_down":
                interval += 5
                continue
            elif error in ("expired_token", "access_denied"):
                logger.warning("GitHub OAuth: %s", error)
                if _login_session:
                    _login_session["status"] = "error"
                    _login_session["error"] = f"Device flow: {error}"
                return
            else:
                logger.warning("GitHub OAuth: unexpected poll response: %s", result)
                continue

        except Exception:
            logger.exception("GitHub OAuth: poll error")
            continue

    # Expired
    if _login_session:
        _login_session["status"] = "error"
        _login_session["error"] = "Device code expired"


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

    logger.info(
        "Claude OAuth: generated auth URL — state=%s… verifier_len=%d challenge=%s…",
        state[:8], len(code_verifier), code_challenge[:8],
    )
    return {"authUrl": auth_url, "status": "pending"}


def _clean_auth_code(raw: str) -> str:
    """Strip URL fragments, query‐param tails, and whitespace from a pasted code."""
    cleaned = raw.strip()
    # If user pasted a full callback URL, extract the code param
    if cleaned.startswith("http"):
        parsed = urllib.parse.urlparse(cleaned)
        qs = urllib.parse.parse_qs(parsed.query)
        if "code" in qs:
            cleaned = qs["code"][0]
    # Strip trailing fragment or extra &params
    cleaned = cleaned.split("#")[0].split("&")[0].strip()
    return cleaned


async def submit_claude_auth_code(code: str) -> dict:
    """Exchange the authorization code for tokens and write credentials."""
    global _claude_login_session

    if not _claude_login_session:
        return {"status": "error", "error": "No active login session"}

    code_verifier = _claude_login_session.get("code_verifier")
    state = _claude_login_session.get("state")
    if not code_verifier:
        return {"status": "error", "error": "No PKCE verifier — start login first"}

    cleaned_code = _clean_auth_code(code)
    logger.info(
        "Claude OAuth: exchanging code (first 8 chars: %s…, length: %d, state: %s…)",
        cleaned_code[:8], len(cleaned_code), (state or "")[:8],
    )

    try:
        token_payload = {
            "grant_type": "authorization_code",
            "client_id": _CLAUDE_OAUTH_CLIENT_ID,
            "code": cleaned_code,
            "redirect_uri": _CLAUDE_OAUTH_REDIRECT_URI,
            "code_verifier": code_verifier,
            "state": state,
        }
        token_body = json.dumps(token_payload).encode()

        logger.info(
            "Claude OAuth: POST %s  redirect_uri=%s  code_verifier length=%d",
            _CLAUDE_OAUTH_TOKEN_URL, _CLAUDE_OAUTH_REDIRECT_URI, len(code_verifier),
        )

        req = urllib.request.Request(
            _CLAUDE_OAUTH_TOKEN_URL,
            data=token_body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://claude.ai/",
                "Origin": "https://claude.ai",
            },
            method="POST",
        )

        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(
            None, lambda: urllib.request.urlopen(req, timeout=15),
        )
        result = json.loads(resp.read().decode())
        logger.info("Claude OAuth: token exchange succeeded, keys: %s", list(result.keys()))

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

        logger.info("Claude OAuth: credentials written to %s", _CLAUDE_CREDENTIALS_PATH)
        _claude_login_session = {"status": "authenticated"}
        return {"status": "authenticated"}

    except urllib.error.HTTPError as exc:
        body = exc.read().decode() if exc.fp else str(exc)
        logger.error("Claude OAuth token exchange failed: %s %s", exc.code, body)
        # Keep the session alive so the user can retry with a new code
        _claude_login_session["status"] = "pending"
        _claude_login_session["error"] = f"Token exchange failed ({exc.code}): {body}"
        return {"status": "error", "error": f"Token exchange failed ({exc.code}): {body}"}
    except Exception as exc:
        logger.exception("Claude OAuth token exchange failed")
        _claude_login_session["status"] = "pending"
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
