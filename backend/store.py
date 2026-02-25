"""In-memory state store for executions, agents, findings, and WebSocket connections."""

from __future__ import annotations

import json
import secrets
from typing import Any

from fastapi import WebSocket


# ──────────────────────────────────────────────────────────────────────────────
# State containers (module-level — persist across requests)
# ──────────────────────────────────────────────────────────────────────────────

internal_api_token: str = secrets.token_urlsafe(32)

executions: dict[str, dict[str, Any]] = {}
agents: dict[str, dict[str, Any]] = {}
findings: dict[str, dict[str, Any]] = {}
conversations: dict[str, dict[str, Any]] = {}
screenshots: dict[str, dict[str, Any]] = {}
websocket_connections: dict[str, set[WebSocket]] = {}
console_connections: dict[str, set[WebSocket]] = {}
pending_questions: dict[str, dict[str, Any]] = {}
pending_questions_by_execution: dict[str, list[str]] = {}

# Message history buffers — replayed to late-connecting WebSocket clients
execution_messages: dict[str, list[dict[str, Any]]] = {}  # exec_id → [messages]
console_messages: dict[str, list[dict[str, Any]]] = {}    # conv_id → [messages]

_MESSAGE_BUFFER_CAP = 500

# Dynamic agent tracking
dynamic_agents: dict[str, dict[str, dict[str, Any]]] = {}  # exec_id → agent_id → agent dict
file_activities: dict[str, list[dict[str, Any]]] = {}  # exec_id → [{file, action, agent_id, agent_name, timestamp}]
codebases: dict[str, dict[str, Any]] = {}  # codebase_id → {id, name, path, gitUrl, executionIds, createdAt}

_execution_counter: int = 0
_conversation_counter: int = 0
_screenshot_counter: int = 0
_agent_counter: int = 0
_codebase_counter: int = 0


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def next_execution_id() -> str:
    """Return the next execution ID: exec-001, exec-002, etc."""
    global _execution_counter
    _execution_counter += 1
    return f"exec-{_execution_counter:03d}"


def next_conversation_id() -> str:
    """Return the next conversation ID: conv-001, conv-002, etc."""
    global _conversation_counter
    _conversation_counter += 1
    return f"conv-{_conversation_counter:03d}"


def next_screenshot_id() -> str:
    """Return the next screenshot ID: ss-001, ss-002, etc."""
    global _screenshot_counter
    _screenshot_counter += 1
    return f"ss-{_screenshot_counter:03d}"


def next_agent_id() -> str:
    """Return the next dynamic agent ID: agent-0001, agent-0002, etc."""
    global _agent_counter
    _agent_counter += 1
    return f"agent-{_agent_counter:04d}"


def next_codebase_id() -> str:
    """Return the next codebase ID: codebase-001, codebase-002, etc."""
    global _codebase_counter
    _codebase_counter += 1
    return f"codebase-{_codebase_counter:03d}"


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
    {
        "role": "frontend-dev",
        "name": "Frontend Dev",
        "description": (
            "Frontend specialist handling React components, styling, "
            "UI work, hooks, pages, and Tailwind configuration."
        ),
        "capabilities": ["React", "TypeScript", "Tailwind CSS", "UI/UX"],
        "tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        "color": "#ec4899",
        "icon": "Palette",
    },
    {
        "role": "backend-dev",
        "name": "Backend Dev",
        "description": (
            "Backend specialist handling API endpoints, services, "
            "data models, and server-side logic."
        ),
        "capabilities": ["FastAPI", "Python", "Pydantic", "APIs"],
        "tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        "color": "#8b5cf6",
        "icon": "Server",
    },
    {
        "role": "devops",
        "name": "DevOps",
        "description": (
            "DevOps engineer handling Docker, CI/CD, deployment configuration, "
            "and infrastructure."
        ),
        "capabilities": ["Docker", "CI/CD", "Infrastructure", "Deployment"],
        "tools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        "color": "#eab308",
        "icon": "Container",
    },
]


def init_agents() -> None:
    """Initialize the agent registry with default agent info."""
    for defaults in AGENT_DEFAULTS:
        role = defaults["role"]
        agents[role] = {
            **defaults,
            "isCustom": False,
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
    # Buffer the message so late-connecting clients can replay history
    if execution_id not in execution_messages:
        execution_messages[execution_id] = []
    buf = execution_messages[execution_id]
    buf.append(message)
    if len(buf) > _MESSAGE_BUFFER_CAP:
        del buf[: len(buf) - _MESSAGE_BUFFER_CAP]

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


async def broadcast_console(conversation_id: str, message: dict) -> None:
    """Send a JSON message to every WebSocket subscribed to a conversation."""
    # Buffer the message so late-connecting clients can replay history
    if conversation_id not in console_messages:
        console_messages[conversation_id] = []
    buf = console_messages[conversation_id]
    buf.append(message)
    if len(buf) > _MESSAGE_BUFFER_CAP:
        del buf[: len(buf) - _MESSAGE_BUFFER_CAP]

    connections = console_connections.get(conversation_id, set())
    dead: list[WebSocket] = []
    payload = json.dumps(message)

    for ws in connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)

    for ws in dead:
        connections.discard(ws)
