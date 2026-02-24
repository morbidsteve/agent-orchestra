"""Filesystem browsing routes."""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Query

from backend.config import settings
from backend.models import BrowseResponse

router = APIRouter(prefix="/api/filesystem", tags=["filesystem"])

MAX_ENTRIES = 200


def _is_dir_safe(path: str) -> bool:
    """Check if path is a directory, swallowing OS errors."""
    try:
        return os.path.isdir(path)
    except OSError:
        return False


@router.get("/browse", response_model=BrowseResponse)
async def browse_directory(path: str = Query(default="")) -> BrowseResponse:
    """List subdirectories at the given path.

    Security: resolves symlinks via os.path.realpath() and verifies the
    resolved path starts with BROWSE_ROOT to prevent directory traversal.
    """
    browse_root = os.path.realpath(settings.BROWSE_ROOT)

    # Default to browse root when no path supplied
    if not path:
        path = browse_root

    resolved = os.path.realpath(path)

    # Security: ensure resolved path is within the browse root.
    # Normalise prefix so "/" doesn't become "//" when os.sep is appended.
    root_prefix = browse_root if browse_root.endswith(os.sep) else browse_root + os.sep
    if not (resolved == browse_root or resolved.startswith(root_prefix)):
        raise HTTPException(status_code=400, detail="Path is outside the browsable root")

    if not os.path.isdir(resolved):
        raise HTTPException(status_code=400, detail="Path is not a directory")

    try:
        entries = os.listdir(resolved)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    except OSError:
        raise HTTPException(status_code=400, detail="Cannot access the specified directory")

    # Filter to directories only, skip hidden dirs, sort alphabetically
    dirs: list[str] = sorted(
        name for name in entries
        if not name.startswith(".")
        and _is_dir_safe(os.path.join(resolved, name))
    )

    truncated = len(dirs) > MAX_ENTRIES
    if truncated:
        dirs = dirs[:MAX_ENTRIES]

    # Compute parent (None if at browse root)
    if resolved != browse_root:
        raw_parent = os.path.dirname(resolved)
        parent = raw_parent if (raw_parent == browse_root or raw_parent.startswith(root_prefix)) else None
    else:
        parent = None

    return BrowseResponse(
        current=resolved,
        parent=parent,
        directories=dirs,
        truncated=truncated,
    )
