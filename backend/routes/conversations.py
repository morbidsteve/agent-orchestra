"""Conversation management routes — REST + WebSocket endpoints."""

from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, Field

from backend import store
from backend.config import settings
from backend.models import ConversationMessageRequest, _to_camel
from backend.services.dynamic_orchestrator import run_dynamic_execution
from backend.services.orchestrator import run_execution

router = APIRouter(prefix="/api", tags=["conversations"])

# ──────────────────────────────────────────────────────────────────────────────
# Request models
# ──────────────────────────────────────────────────────────────────────────────


class SendMessageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)
    text: str = Field(max_length=10000)


# ──────────────────────────────────────────────────────────────────────────────
# Workflow → pipeline mapping (mirrors routes/executions.py)
# ──────────────────────────────────────────────────────────────────────────────

WORKFLOW_PIPELINES: dict[str, list[list[tuple[str, str]]]] = {
    "full-pipeline": [
        [("plan", "developer")],
        [("develop", "developer"), ("develop-2", "developer-2")],
        [("test", "tester"), ("security", "devsecops")],
        [("report", "developer")],
    ],
    "code-review": [
        [("develop", "developer"), ("test", "tester"), ("security", "devsecops")],
        [("report", "developer")],
    ],
    "security-audit": [
        [("plan", "developer")],
        [("security", "devsecops")],
        [("report", "developer")],
    ],
    "feature-eval": [
        [("plan", "developer")],
        [("develop", "developer"), ("business-eval", "business-dev")],
        [("report", "developer")],
    ],
    "quick-fix": [
        [("develop", "developer")],
        [("test", "tester"), ("security", "devsecops")],
        [("report", "developer")],
    ],
}

# Patterns that suggest a feature evaluation request
_FEATURE_EVAL_PATTERNS = [
    re.compile(r"\bevaluate\b", re.IGNORECASE),
    re.compile(r"\bshould\s+we\b", re.IGNORECASE),
    re.compile(r"\bfeature\s+eval\b", re.IGNORECASE),
    re.compile(r"\bmarket\s+analysis\b", re.IGNORECASE),
    re.compile(r"\bcompetitive\s+analysis\b", re.IGNORECASE),
    re.compile(r"\bice\s+scor", re.IGNORECASE),
]

_MAX_CONSOLE_CONNECTIONS = 10


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def _make_message(
    role: str,
    text: str,
    content_type: str = "text",
    *,
    execution_ref: str | None = None,
    screenshot_ref: str | None = None,
    business_eval: dict[str, Any] | None = None,
    clarification: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a conversation message dict."""
    return {
        "id": f"msg-{uuid.uuid4().hex[:8]}",
        "role": role,
        "contentType": content_type,
        "text": text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "executionRef": execution_ref,
        "screenshotRef": screenshot_ref,
        "businessEval": business_eval,
        "clarification": clarification,
    }


def _detect_workflow(text: str) -> str:
    """Detect workflow type from user message text."""
    for pattern in _FEATURE_EVAL_PATTERNS:
        if pattern.search(text):
            return "feature-eval"
    return "full-pipeline"


def _create_execution_record(
    workflow: str,
    task: str,
    model: str = "sonnet",
) -> dict[str, Any]:
    """Create an execution record in the store (mirrors routes/executions.py logic)."""
    exec_id = store.next_execution_id()
    now = datetime.now(timezone.utc).isoformat()

    groups = WORKFLOW_PIPELINES.get(workflow, WORKFLOW_PIPELINES["full-pipeline"])
    pipeline = []
    for group_idx, group in enumerate(groups):
        for phase, agent_role in group:
            pipeline.append({
                "phase": phase,
                "group": group_idx,
                "status": "pending",
                "agentRole": agent_role,
                "startedAt": None,
                "completedAt": None,
                "output": [],
            })

    # Create an isolated project directory so agents don't work inside
    # the Orchestra codebase itself.
    project_dir = os.path.join(settings.PROJECTS_DIR, exec_id)
    os.makedirs(project_dir, exist_ok=True)

    execution: dict[str, Any] = {
        "id": exec_id,
        "workflow": workflow,
        "task": task,
        "status": "queued",
        "model": model,
        "target": "",
        "projectSource": None,
        "resolvedProjectPath": project_dir,
        "createdAt": now,
        "startedAt": None,
        "completedAt": None,
        "pipeline": pipeline,
        "activities": [],
        "findings": [],
    }

    store.executions[exec_id] = execution
    return execution


async def _handle_user_message(
    conversation: dict[str, Any],
    text: str,
    model: str = "sonnet",
) -> dict[str, Any]:
    """Process a user message and generate orchestra response.

    Detects workflow type, creates execution, adds messages to conversation,
    and launches the execution in background.
    Returns the orchestra response message.
    """
    workflow = _detect_workflow(text)
    execution = _create_execution_record(workflow, text, model)
    exec_id = execution["id"]

    # Link execution to conversation
    conversation["activeExecutionId"] = exec_id

    # Create execution-start message
    if workflow == "feature-eval":
        response_text = (
            f"Starting feature evaluation for: {text}\n"
            f"I'll analyze the market, competition, and provide an ICE score."
        )
    else:
        groups = WORKFLOW_PIPELINES.get(workflow, WORKFLOW_PIPELINES["full-pipeline"])
        phase_names = [phase for group in groups for phase, _ in group]
        response_text = (
            f"Starting {workflow} execution for: {text}\n"
            f"Phases: {', '.join(phase_names)}"
        )

    exec_start_msg = _make_message(
        "orchestra",
        response_text,
        "execution-start",
        execution_ref=exec_id,
    )
    conversation["messages"].append(exec_start_msg)

    # Launch execution in background — prefer dynamic orchestrator with fallback
    async def _run_with_fallback(eid: str) -> None:
        try:
            await run_dynamic_execution(eid)
        except FileNotFoundError:
            # Claude CLI not available — fall back to the fixed pipeline
            await run_execution(eid)
        except Exception:
            # Other dynamic orchestrator errors — also fall back
            exc = store.executions.get(eid)
            if exc and exc.get("status") == "failed":
                # Reset so the fixed pipeline can run cleanly
                exc["status"] = "queued"
                exc["startedAt"] = None
                exc["completedAt"] = None
            await run_execution(eid)

    asyncio.create_task(_run_with_fallback(exec_id))

    return exec_start_msg


# ──────────────────────────────────────────────────────────────────────────────
# REST Routes
# ──────────────────────────────────────────────────────────────────────────────


@router.post("/conversations", status_code=201)
async def create_conversation(req: ConversationMessageRequest) -> dict:
    """Create a new conversation with the first user message."""
    conv_id = store.next_conversation_id()
    now = datetime.now(timezone.utc).isoformat()

    conversation: dict[str, Any] = {
        "id": conv_id,
        "title": req.text[:80] + ("..." if len(req.text) > 80 else ""),
        "createdAt": now,
        "updatedAt": now,
        "model": req.model,
        "projectSource": (
            {"type": req.project_source.type, "path": req.project_source.path}
            if req.project_source
            else None
        ),
        "messages": [],
        "activeExecutionId": None,
    }

    # Add user message
    user_msg = _make_message("user", req.text)
    conversation["messages"].append(user_msg)

    store.conversations[conv_id] = conversation

    # Generate orchestra response (creates execution, adds messages)
    await _handle_user_message(conversation, req.text, req.model)

    conversation["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return conversation


@router.get("/conversations")
async def list_conversations() -> list[dict]:
    """Return all conversations, sorted by updatedAt descending."""
    items = list(store.conversations.values())
    items.sort(key=lambda c: c.get("updatedAt", ""), reverse=True)
    return items


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str) -> dict:
    """Return a single conversation by ID."""
    conversation = store.conversations.get(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, req: SendMessageRequest) -> dict:
    """Send a message to an existing conversation."""
    conversation = store.conversations.get(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Add user message
    user_msg = _make_message("user", req.text)
    conversation["messages"].append(user_msg)

    # Generate orchestra response
    model = conversation.get("model", "sonnet")
    await _handle_user_message(conversation, req.text, model)

    conversation["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return conversation


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket — Console
# ──────────────────────────────────────────────────────────────────────────────


@router.websocket("/ws/console/{conversation_id}")
async def console_ws(websocket: WebSocket, conversation_id: str) -> None:
    """Bidirectional WebSocket for conversation console updates.

    On connect: register in store.console_connections[conversation_id].
    On disconnect: remove from console_connections.
    On receive: parse JSON and handle user messages.
    """
    # Validate origin
    origin = websocket.headers.get("origin", "")
    if origin and origin not in settings.ALLOWED_ORIGINS:
        await websocket.close(code=4003)
        return

    # Enforce per-conversation connection limit
    existing = store.console_connections.get(conversation_id, set())
    if len(existing) >= _MAX_CONSOLE_CONNECTIONS:
        await websocket.close(code=4004)
        return

    await websocket.accept()

    # Register this connection
    if conversation_id not in store.console_connections:
        store.console_connections[conversation_id] = set()
    store.console_connections[conversation_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "user-message":
                    # Handle user message sent via WebSocket
                    text = message.get("text", "").strip()
                    if text:
                        conversation = store.conversations.get(conversation_id)
                        if conversation:
                            user_msg = _make_message("user", text)
                            conversation["messages"].append(user_msg)
                            # Broadcast user message to all console clients
                            await store.broadcast_console(conversation_id, {
                                "type": "console-text",
                                "text": text,
                                "messageId": user_msg["id"],
                            })
                            # Generate response
                            model = conversation.get("model", "sonnet")
                            await _handle_user_message(conversation, text, model)

                elif msg_type == "clarification-response":
                    # Handle clarification response
                    conversation = store.conversations.get(conversation_id)
                    if conversation:
                        response_text = message.get("text", "")
                        resp_msg = _make_message("user", response_text)
                        conversation["messages"].append(resp_msg)

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass
    finally:
        conns = store.console_connections.get(conversation_id)
        if conns is not None:
            conns.discard(websocket)
            if not conns:
                del store.console_connections[conversation_id]
