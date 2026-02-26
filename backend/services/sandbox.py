"""Container sandbox detection — ensures agents run inside a container."""

from __future__ import annotations

import functools
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SandboxStatus:
    """Result of sandbox/container detection."""
    sandboxed: bool
    container_type: str | None
    override_active: bool
    docker_available: bool
    execution_mode: str


def _check_docker_available() -> bool:
    """Check whether Docker is available by running `docker info`.

    Returns True if `docker info` exits successfully within 5 seconds.
    """
    try:
        result = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def _compute_execution_mode(
    sandboxed: bool,
    override_active: bool,
    docker_available: bool,
) -> str:
    """Determine the execution mode based on environment.

    Returns one of: "native", "host-override", "docker-wrap", "blocked".
    """
    if sandboxed:
        return "native"
    if override_active:
        return "host-override"
    if docker_available:
        return "docker-wrap"
    return "blocked"


def detect_sandbox() -> SandboxStatus:
    """Detect whether the process is running inside a container.

    Checks (in order):
    1. DEVCONTAINER env var (VS Code devcontainer)
    2. ORCHESTRA_CONTAINER env var (explicit opt-in)
    3. /.dockerenv file (Docker)
    4. /proc/1/cgroup contents (cgroup-based detection)
    5. BACKEND_HOST=0.0.0.0 (common container binding)

    Also checks Docker availability for bare-metal auto-containerization.
    """
    override = os.environ.get("ORCHESTRA_ALLOW_HOST", "").lower() == "true"

    # 1. VS Code devcontainer
    if os.environ.get("DEVCONTAINER"):
        docker = _check_docker_available()
        mode = _compute_execution_mode(True, override, docker)
        return SandboxStatus(
            sandboxed=True, container_type="devcontainer",
            override_active=override, docker_available=docker,
            execution_mode=mode,
        )

    # 2. Explicit container marker
    if os.environ.get("ORCHESTRA_CONTAINER"):
        docker = _check_docker_available()
        mode = _compute_execution_mode(True, override, docker)
        return SandboxStatus(
            sandboxed=True, container_type="orchestra-container",
            override_active=override, docker_available=docker,
            execution_mode=mode,
        )

    # 3. Docker marker file
    if Path("/.dockerenv").exists():
        docker = _check_docker_available()
        mode = _compute_execution_mode(True, override, docker)
        return SandboxStatus(
            sandboxed=True, container_type="docker",
            override_active=override, docker_available=docker,
            execution_mode=mode,
        )

    # 4. cgroup-based detection
    try:
        cgroup = Path("/proc/1/cgroup").read_text()
        if "docker" in cgroup or "kubepods" in cgroup or "containerd" in cgroup:
            docker = _check_docker_available()
            mode = _compute_execution_mode(True, override, docker)
            return SandboxStatus(
                sandboxed=True, container_type="cgroup-container",
                override_active=override, docker_available=docker,
                execution_mode=mode,
            )
    except (FileNotFoundError, PermissionError):
        pass

    # 5. Binding to 0.0.0.0 suggests container
    if os.environ.get("BACKEND_HOST") == "0.0.0.0":
        docker = _check_docker_available()
        mode = _compute_execution_mode(True, override, docker)
        return SandboxStatus(
            sandboxed=True, container_type="network-inferred",
            override_active=override, docker_available=docker,
            execution_mode=mode,
        )

    # Not sandboxed — check Docker for auto-containerization
    docker = _check_docker_available()
    mode = _compute_execution_mode(False, override, docker)
    return SandboxStatus(
        sandboxed=False, container_type=None,
        override_active=override, docker_available=docker,
        execution_mode=mode,
    )


@functools.lru_cache(maxsize=1)
def get_sandbox_status() -> SandboxStatus:
    """Cached singleton — computed once per process."""
    return detect_sandbox()


def require_execution_capability(action: str) -> str:
    """Check execution capability and return the execution mode.

    Returns the execution mode string ("native", "host-override", "docker-wrap").
    Raises RuntimeError only when mode is "blocked" (bare metal, no Docker, no override).
    """
    status = get_sandbox_status()
    if status.execution_mode == "blocked":
        raise RuntimeError(
            f"Execution blocked for: {action}. "
            "Agent Orchestra spawns Claude Code with --dangerously-skip-permissions, "
            "which grants unrestricted filesystem access. This is only safe inside a container. "
            "Install Docker to enable automatic containerization, "
            "or set ORCHESTRA_ALLOW_HOST=true to override."
        )
    return status.execution_mode


def require_sandbox(action: str) -> None:
    """Raise RuntimeError if not sandboxed and no override is active.

    Call this before any operation that grants agents unrestricted filesystem access.
    Backward-compatible wrapper around require_execution_capability().
    """
    require_execution_capability(action)
