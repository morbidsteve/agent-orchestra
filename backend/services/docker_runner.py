"""Docker runner — wraps agent commands in `docker run` for bare-metal execution."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import tempfile
from pathlib import Path
from typing import Any

from backend.config import settings

logger = logging.getLogger(__name__)

# Lock to prevent concurrent image builds
_build_lock = asyncio.Lock()
_image_ready = False


async def ensure_image(execution_id: str | None = None) -> bool:
    """Ensure the agent Docker image exists, building it if necessary.

    Returns True if image is ready, False if build failed.
    Broadcasts build progress via WebSocket if execution_id is provided.
    """
    global _image_ready

    if _image_ready:
        return True

    async with _build_lock:
        # Double-check after acquiring lock
        if _image_ready:
            return True

        image = settings.AGENT_DOCKER_IMAGE

        # Check if image already exists
        proc = await asyncio.create_subprocess_exec(
            "docker", "image", "inspect", image,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        if proc.returncode == 0:
            _image_ready = True
            logger.info("Docker image %s already exists", image)
            return True

        # Image doesn't exist — build it
        # Find the Dockerfile (repo root)
        dockerfile_dir = Path(__file__).resolve().parent.parent.parent
        dockerfile = dockerfile_dir / "Dockerfile"
        if not dockerfile.exists():
            logger.error("Dockerfile not found at %s", dockerfile)
            return False

        logger.info("Building Docker image %s from %s ...", image, dockerfile_dir)

        # Broadcast build start
        if execution_id:
            from backend import store
            await store.broadcast(execution_id, {
                "type": "output",
                "line": f"[Docker] Building image {image} (first run only)...",
                "phase": "docker-build",
            })

        build_proc = await asyncio.create_subprocess_exec(
            "docker", "build", "-t", image, str(dockerfile_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        assert build_proc.stdout is not None
        while True:
            line = await build_proc.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace").strip()
            if text and execution_id:
                from backend import store
                await store.broadcast(execution_id, {
                    "type": "output",
                    "line": f"[Docker] {text}",
                    "phase": "docker-build",
                })

        await build_proc.wait()
        if build_proc.returncode == 0:
            _image_ready = True
            logger.info("Docker image %s built successfully", image)
            return True
        else:
            logger.error("Docker image build failed (exit code %d)", build_proc.returncode)
            return False


def _is_macos() -> bool:
    """Check if running on macOS (needed for Docker networking differences)."""
    return platform.system() == "Darwin"


def _rewrite_mcp_config(
    mcp_config_path: str,
    api_url: str,
) -> str:
    """Rewrite MCP config for use inside the Docker container.

    - Rewrites bridge script paths from host paths to /app/backend/... inside container
    - Rewrites API URL for Docker networking (host.docker.internal on macOS)

    Returns path to the rewritten temp file.
    """
    with open(mcp_config_path) as f:
        config = json.load(f)

    for server_name, server in config.get("mcpServers", {}).items():
        args = server.get("args", [])
        new_args = []
        for arg in args:
            # Rewrite host paths to container paths
            # e.g., /home/user/project/backend/mcp_bridge_dynamic.py -> /app/backend/mcp_bridge_dynamic.py
            if "mcp_bridge" in arg and arg.endswith(".py"):
                filename = Path(arg).name
                new_args.append(f"/app/backend/{filename}")
            else:
                new_args.append(arg)
        server["args"] = new_args

        # Rewrite API URL in env
        env = server.get("env", {})
        if "ORCHESTRA_API_URL" in env:
            env["ORCHESTRA_API_URL"] = api_url

    # Write rewritten config to new temp file
    fd, rewritten_path = tempfile.mkstemp(suffix=".json", prefix="docker-mcp-")
    with os.fdopen(fd, "w") as f:
        json.dump(config, f)
    os.chmod(rewritten_path, 0o600)

    return rewritten_path


def wrap_command_in_docker(
    cmd: list[str],
    env: dict[str, str],
    cwd: str,
    mcp_config_path: str | None = None,
) -> tuple[list[str], dict[str, str], str]:
    """Wrap a claude CLI command in `docker run`.

    Args:
        cmd: The original command (e.g., ["claude", "-p", "...", ...])
        env: Environment variables for the process
        cwd: Working directory on the host
        mcp_config_path: Path to MCP config file (will be rewritten for container)

    Returns:
        (docker_cmd, docker_env, docker_cwd) — drop-in replacement for create_subprocess_exec
    """
    image = settings.AGENT_DOCKER_IMAGE
    use_macos = _is_macos()

    # Docker networking
    # Linux: --network host (container shares host network)
    # macOS: use host.docker.internal to reach host services
    if use_macos:
        api_url = f"http://host.docker.internal:{settings.PORT}"
    else:
        api_url = f"http://127.0.0.1:{settings.PORT}"

    # Rewrite MCP config if provided
    rewritten_mcp_path: str | None = None
    if mcp_config_path:
        rewritten_mcp_path = _rewrite_mcp_config(mcp_config_path, api_url)

    # Build docker run command
    docker_cmd: list[str] = ["docker", "run", "--rm"]

    # Network mode
    if not use_macos:
        docker_cmd.extend(["--network", "host"])

    # Volume mounts
    docker_cmd.extend(["-v", f"{cwd}:/workspace"])

    # Mount Claude credentials directory
    claude_dir = Path.home() / ".claude"
    if claude_dir.exists():
        docker_cmd.extend(["-v", f"{claude_dir}:/home/orchestra/.claude:ro"])

    # Mount Claude CLI config file (~/.claude.json is separate from ~/.claude/)
    claude_json = Path.home() / ".claude.json"
    if claude_json.exists():
        docker_cmd.extend(["-v", f"{claude_json}:/home/orchestra/.claude.json:ro"])

    # Mount GitHub credentials (read-only)
    gh_dir = Path.home() / ".config" / "gh"
    if gh_dir.exists():
        docker_cmd.extend(["-v", f"{gh_dir}:/home/orchestra/.config/gh:ro"])

    # Mount rewritten MCP config
    if rewritten_mcp_path:
        docker_cmd.extend(["-v", f"{rewritten_mcp_path}:{rewritten_mcp_path}:ro"])

    # Environment variables
    docker_cmd.extend(["-e", "ORCHESTRA_CONTAINER=1"])
    docker_cmd.extend(["-e", "CLAUDECODE="])

    # Working directory inside container
    docker_cmd.extend(["-w", "/workspace"])

    # Image
    docker_cmd.append(image)

    # The actual command — normalize binary path and rewrite mcp config path
    for i, arg in enumerate(cmd):
        if i == 0:
            # cmd[0] may be a host-specific path like /Users/.../bin/claude.
            # Inside the container, use just the binary name.
            docker_cmd.append(Path(arg).name)
        elif mcp_config_path and arg == mcp_config_path and rewritten_mcp_path:
            docker_cmd.append(rewritten_mcp_path)
        else:
            docker_cmd.append(arg)

    # The docker command runs on the host, so use host env (minus CLAUDECODE)
    # cwd doesn't matter for docker run (the -w flag inside handles it)
    docker_env = {k: v for k, v in env.items() if k != "CLAUDECODE"}

    return docker_cmd, docker_env, cwd


def cleanup_rewritten_mcp_config(cmd: list[str]) -> None:
    """Clean up any rewritten MCP config temp files referenced in a docker command."""
    for arg in cmd:
        if arg.startswith("/tmp/docker-mcp-") and arg.endswith(".json"):
            try:
                os.unlink(arg)
            except OSError:
                pass
