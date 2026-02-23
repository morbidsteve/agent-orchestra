"""Output parser — converts raw orchestrator text into structured data."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any


# ──────────────────────────────────────────────────────────────────────────────
# Finding detection
# ──────────────────────────────────────────────────────────────────────────────

# Patterns that indicate a finding in the output
_FINDING_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    (re.compile(r"CRITICAL:\s*(.+)", re.IGNORECASE), "critical", "security"),
    (re.compile(r"VULNERABILITY:\s*(.+)", re.IGNORECASE), "high", "security"),
    (re.compile(r"FINDING:\s*(.+)", re.IGNORECASE), "medium", "security"),
    (re.compile(r"SECRET\s+(?:FOUND|DETECTED):\s*(.+)", re.IGNORECASE), "critical", "security"),
    (re.compile(r"CVE-\d{4}-\d+", re.IGNORECASE), "high", "security"),
    (re.compile(r"WARNING:\s*(.+)", re.IGNORECASE), "low", "quality"),
]


def parse_finding(line: str, execution_id: str) -> dict[str, Any] | None:
    """
    Attempt to detect a finding in *line*.

    Returns a finding dict ready for insertion into the store, or None if
    the line does not match any known finding pattern.
    """
    for pattern, severity, finding_type in _FINDING_PATTERNS:
        match = pattern.search(line)
        if match:
            title = match.group(1) if match.lastindex else line.strip()
            return {
                "id": f"find-{uuid.uuid4().hex[:8]}",
                "executionId": execution_id,
                "type": finding_type,
                "severity": severity,
                "status": "open",
                "title": title.strip(),
                "description": line.strip(),
                "file": "",
                "line": None,
                "remediation": "",
                "agent": "devsecops",
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Phase status detection
# ──────────────────────────────────────────────────────────────────────────────

_PHASE_MARKERS: dict[str, list[str]] = {
    "plan": ["plan complete", "planning complete", "analysis complete"],
    "develop": ["development complete", "implementation complete", "code complete"],
    "test": ["all tests passed", "test suite passed", "tests complete"],
    "security": ["security review complete", "audit complete", "scan complete"],
    "report": ["report complete", "summary complete"],
}


def parse_phase_status(line: str) -> str | None:
    """
    Detect whether *line* signals the completion of a pipeline phase.

    Returns the phase name if detected, otherwise None.
    """
    lower = line.lower().strip()
    for phase, markers in _PHASE_MARKERS.items():
        for marker in markers:
            if marker in lower:
                return phase
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Activity detection
# ──────────────────────────────────────────────────────────────────────────────

_FILE_MOD_PATTERN = re.compile(
    r"(?:created|modified|wrote|edited|updated|deleted)\s+(?:file\s+)?['\"]?([^\s'\"]+)['\"]?",
    re.IGNORECASE,
)


def detect_agent_activity(lines: list[str]) -> dict[str, Any] | None:
    """
    Build an activity record from a sequence of output lines.

    Returns a partial activity dict or None if no meaningful activity was
    detected.
    """
    if not lines:
        return None

    files_modified: list[str] = []
    for line in lines:
        match = _FILE_MOD_PATTERN.search(line)
        if match:
            files_modified.append(match.group(1))

    # Only create an activity if there is something to report
    if not files_modified and len(lines) < 3:
        return None

    return {
        "id": f"act-{uuid.uuid4().hex[:8]}",
        "output": lines,
        "filesModified": files_modified,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "completedAt": None,
        "status": "running",
    }
