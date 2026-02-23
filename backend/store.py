"""In-memory state store for executions, agents, findings, and WebSocket connections."""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket


# ──────────────────────────────────────────────────────────────────────────────
# State containers (module-level — persist across requests)
# ──────────────────────────────────────────────────────────────────────────────

executions: dict[str, dict[str, Any]] = {}
agents: dict[str, dict[str, Any]] = {}
findings: dict[str, dict[str, Any]] = {}
websocket_connections: dict[str, set[WebSocket]] = {}

_execution_counter: int = 0


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def next_execution_id() -> str:
    """Return the next execution ID: exec-001, exec-002, etc."""
    global _execution_counter
    _execution_counter += 1
    return f"exec-{_execution_counter:03d}"


# ──────────────────────────────────────────────────────────────────────────────
# Agent defaults
# ──────────────────────────────────────────────────────────────────────────────

AGENT_DEFAULTS: list[dict[str, Any]] = [
    {
        "role": "developer",
        "name": "Developer (Primary)",
        "description": (
            "Senior software engineer handling architecture decisions, "
            "complex implementations, and code quality."
        ),
        "capabilities": ["Architecture", "Implementation", "Refactoring", "Code Review"],
        "tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        "color": "#3b82f6",
        "icon": "Terminal",
    },
    {
        "role": "developer-2",
        "name": "Developer (Secondary)",
        "description": (
            "Software engineer handling independent modules and "
            "parallel features without conflicts."
        ),
        "capabilities": ["Utilities", "Independent Services", "Parallel Features"],
        "tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        "color": "#06b6d4",
        "icon": "Code",
    },
    {
        "role": "tester",
        "name": "Tester",
        "description": (
            "QA engineer writing comprehensive tests, running test suites, "
            "and performing coverage analysis."
        ),
        "capabilities": [
            "Unit Tests",
            "Integration Tests",
            "Coverage Analysis",
            "Regression Checks",
        ],
        "tools": ["Read", "Bash", "Grep", "Glob"],
        "color": "#22c55e",
        "icon": "FlaskConical",
    },
    {
        "role": "devsecops",
        "name": "DevSecOps",
        "description": (
            "Security engineer finding vulnerabilities, exposed secrets, "
            "and compliance gaps."
        ),
        "capabilities": [
            "Secret Scanning",
            "Dependency Audit",
            "Code Security",
            "Infrastructure Review",
        ],
        "tools": ["Read", "Bash", "Grep", "Glob"],
        "color": "#f97316",
        "icon": "Shield",
    },
    {
        "role": "business-dev",
        "name": "Business Dev",
        "description": (
            "Business development and product strategy expert for "
            "market analysis and feature prioritization."
        ),
        "capabilities": [
            "Market Analysis",
            "Competitive Research",
            "Feature Prioritization",
            "GTM Strategy",
        ],
        "tools": ["WebSearch", "WebFetch", "Read"],
        "color": "#a855f7",
        "icon": "Briefcase",
    },
]


def init_agents() -> None:
    """Initialize the agent registry with default agent info."""
    for defaults in AGENT_DEFAULTS:
        role = defaults["role"]
        agents[role] = {
            **defaults,
            "status": "idle",
            "currentExecution": None,
            "completedTasks": 0,
            "successRate": 100.0,
        }


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket broadcasting
# ──────────────────────────────────────────────────────────────────────────────


async def broadcast(execution_id: str, message: dict) -> None:
    """Send a JSON message to every WebSocket subscribed to *execution_id*."""
    connections = websocket_connections.get(execution_id, set())
    dead: list[WebSocket] = []
    payload = json.dumps(message)

    for ws in connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)

    # Clean up broken connections
    for ws in dead:
        connections.discard(ws)
