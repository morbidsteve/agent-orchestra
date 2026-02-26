"""Container sandbox detection — ensures agents run inside a container."""

from __future__ import annotations

import functools
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SandboxStatus:
    """Result of sandbox/container detection."""
    sandboxed: bool
    container_type: str | None
    override_active: bool


def detect_sandbox() -> SandboxStatus:
    """Detect whether the process is running inside a container.

    Checks (in order):
    1. DEVCONTAINER env var (VS Code devcontainer)
    2. ORCHESTRA_CONTAINER env var (explicit opt-in)
    3. /.dockerenv file (Docker)
    4. /proc/1/cgroup contents (cgroup-based detection)
    5. BACKEND_HOST=0.0.0.0 (common container binding)
    """
    override = os.environ.get("ORCHESTRA_ALLOW_HOST", "").lower() == "true"

    # 1. VS Code devcontainer
    if os.environ.get("DEVCONTAINER"):
        return SandboxStatus(sandboxed=True, container_type="devcontainer", override_active=override)

    # 2. Explicit container marker
    if os.environ.get("ORCHESTRA_CONTAINER"):
        return SandboxStatus(sandboxed=True, container_type="orchestra-container", override_active=override)

    # 3. Docker marker file
    if Path("/.dockerenv").exists():
        return SandboxStatus(sandboxed=True, container_type="docker", override_active=override)

    # 4. cgroup-based detection
    try:
        cgroup = Path("/proc/1/cgroup").read_text()
        if "docker" in cgroup or "kubepods" in cgroup or "containerd" in cgroup:
            return SandboxStatus(sandboxed=True, container_type="cgroup-container", override_active=override)
    except (FileNotFoundError, PermissionError):
        pass

    # 5. Binding to 0.0.0.0 suggests container
    if os.environ.get("BACKEND_HOST") == "0.0.0.0":
        return SandboxStatus(sandboxed=True, container_type="network-inferred", override_active=override)

    return SandboxStatus(sandboxed=False, container_type=None, override_active=override)


@functools.lru_cache(maxsize=1)
def get_sandbox_status() -> SandboxStatus:
    """Cached singleton — computed once per process."""
    return detect_sandbox()


def require_sandbox(action: str) -> None:
    """Raise RuntimeError if not sandboxed and no override is active.

    Call this before any operation that grants agents unrestricted filesystem access.
    """
    status = get_sandbox_status()
    if not status.sandboxed and not status.override_active:
        raise RuntimeError(
            f"Sandbox required for: {action}. "
            "Agent Orchestra spawns Claude Code with --dangerously-skip-permissions, "
            "which grants unrestricted filesystem access. This is only safe inside a container. "
            "Run inside a devcontainer or Docker, or set ORCHESTRA_ALLOW_HOST=true to override."
        )
