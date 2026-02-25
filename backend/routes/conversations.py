"""Conversation management routes — REST + WebSocket endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import subprocess
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

logger = logging.getLogger(__name__)

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
    "dev-only": [
        [("develop", "developer")],
    ],
    "dev-test": [
        [("develop", "developer")],
        [("test", "tester")],
    ],
    "dev-security": [
        [("develop", "developer")],
        [("security", "devsecops")],
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

# Patterns for workflow detection
_SECURITY_AUDIT_PATTERNS = [
    re.compile(r"\bsecurity\s+audit\b", re.IGNORECASE),
    re.compile(r"\bvulnerability\s+scan\b", re.IGNORECASE),
    re.compile(r"\bpenetration\s+test\b", re.IGNORECASE),
    re.compile(r"\bfind\s+vulnerabilit", re.IGNORECASE),
]

_DEV_SECURITY_PATTERNS = [
    re.compile(r"\bauth", re.IGNORECASE),
    re.compile(r"\bpassword", re.IGNORECASE),
    re.compile(r"\bcredential", re.IGNORECASE),
    re.compile(r"\btokens?\b", re.IGNORECASE),
    re.compile(r"\bencrypt", re.IGNORECASE),
    re.compile(r"\bapi\s*key", re.IGNORECASE),
    re.compile(r"\blogin\b", re.IGNORECASE),
]

_CODE_REVIEW_PATTERNS = [
    re.compile(r"\breview\b", re.IGNORECASE),
    re.compile(r"\baudit\s+code\b", re.IGNORECASE),
    re.compile(r"\bcheck\s+code\b", re.IGNORECASE),
    re.compile(r"\blook\s+at\b", re.IGNORECASE),
]

_DEV_ONLY_PATTERNS = [
    re.compile(r"\bfix\b.*\btypo\b", re.IGNORECASE),
    re.compile(r"\brename\b", re.IGNORECASE),
    re.compile(r"\badd\s+comment\b", re.IGNORECASE),
    re.compile(r"\bupdate\s+text\b", re.IGNORECASE),
    re.compile(r"\bchange\s+color\b", re.IGNORECASE),
]

_FULL_PIPELINE_PATTERNS = [
    re.compile(r"\bthorough\b", re.IGNORECASE),
    re.compile(r"\bcomprehensive\b", re.IGNORECASE),
    re.compile(r"\bfull\s+review\b", re.IGNORECASE),
    re.compile(r"\bproduction\s+ready\b", re.IGNORECASE),
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
    # Feature evaluation (existing patterns)
    for pattern in _FEATURE_EVAL_PATTERNS:
        if pattern.search(text):
            return "feature-eval"

    # Security audit — check before dev-security since it's more specific
    for pattern in _SECURITY_AUDIT_PATTERNS:
        if pattern.search(text):
            return "security-audit"

    # Explicit full pipeline triggers
    for pattern in _FULL_PIPELINE_PATTERNS:
        if pattern.search(text):
            return "full-pipeline"

    # Very long prompts suggest complex tasks → full pipeline
    if len(text) > 300:
        return "full-pipeline"

    # Code review
    for pattern in _CODE_REVIEW_PATTERNS:
        if pattern.search(text):
            return "code-review"

    # Short/simple tasks → dev-only
    if len(text) < 50:
        for pattern in _DEV_ONLY_PATTERNS:
            if pattern.search(text):
                return "dev-only"

    # Security-sensitive development
    for pattern in _DEV_SECURITY_PATTERNS:
        if pattern.search(text):
            return "dev-security"

    # Default: dev + test (most tasks need dev + test, not 4 agents)
    return "dev-test"


def _create_execution_record(
    workflow: str,
    task: str,
    model: str = "sonnet",
    project_source: dict[str, str] | None = None,
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

    # Resolve project directory from project source
    project_dir = os.path.join(settings.PROJECTS_DIR, exec_id)
    source_record: dict[str, str] | None = None

    if project_source and project_source.get("type") == "git":
        git_url = project_source.get("path", "")
        if git_url and git_url.startswith("https://"):
            # Extract repo name for a friendlier directory name
            repo_name = git_url.rstrip("/").split("/")[-1].removesuffix(".git")
            clone_dir = os.path.join(settings.PROJECTS_DIR, f"{exec_id}_{repo_name}")
            try:
                result = subprocess.run(
                    ["git", "clone", "--depth", "1",
                     "--config", "core.hooksPath=/dev/null",
                     git_url, clone_dir],
                    capture_output=True, timeout=120,
                )
                if result.returncode == 0:
                    project_dir = clone_dir
                    source_record = {"type": "git", "path": git_url}
                else:
                    logger.warning("git clone failed for %s: %s", git_url, result.stderr.decode(errors="replace"))
                    os.makedirs(project_dir, exist_ok=True)
            except (subprocess.TimeoutExpired, OSError) as exc:
                logger.warning("git clone error for %s: %s", git_url, exc)
                os.makedirs(project_dir, exist_ok=True)
        else:
            logger.warning("Rejected non-https git URL: %s", git_url)
            os.makedirs(project_dir, exist_ok=True)

    elif project_source and project_source.get("type") == "local":
        local_path = project_source.get("path", "")
        real_path = os.path.realpath(local_path) if local_path else ""
        allowed_roots = [
            os.path.realpath("/workspace"),
            os.path.realpath(settings.PROJECTS_DIR),
        ]
        if real_path and os.path.isdir(real_path) and any(
            real_path == root or real_path.startswith(root + os.sep)
            for root in allowed_roots
        ):
            project_dir = real_path
            source_record = {"type": "local", "path": real_path}
        else:
            logger.warning("Rejected local path (not found or outside allowed roots): %s", local_path)
            os.makedirs(project_dir, exist_ok=True)

    else:
        # type == "new" or None — isolated empty directory (current behavior)
        os.makedirs(project_dir, exist_ok=True)

    execution: dict[str, Any] = {
        "id": exec_id,
        "workflow": workflow,
        "task": task,
        "status": "queued",
        "model": model,
        "target": "",
        "projectSource": source_record,
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
    project_source: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Process a user message and generate orchestra response.

    Detects workflow type, creates execution, adds messages to conversation,
    and launches the execution in background.
    Returns the orchestra response message.
    """
    workflow = _detect_workflow(text)
    execution = _create_execution_record(workflow, text, model, project_source)
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
        except Exception:
            pass  # Fall through to status check below

        # If the dynamic orchestrator didn't complete successfully (it catches
        # its own exceptions internally), fall back to the fixed pipeline.
        execution = store.executions.get(eid)
        if execution and execution.get("status") != "completed":
            # Reset execution state for a fresh pipeline run
            execution["status"] = "queued"
            execution["startedAt"] = None
            execution["completedAt"] = None
            for step in execution.get("pipeline", []):
                step["status"] = "pending"
                step["output"] = []
                step["startedAt"] = None
                step["completedAt"] = None
            # Only clear dynamic state if no agents were actually spawned
            has_dynamic_agents = bool(store.dynamic_agents.get(eid))
            if not has_dynamic_agents:
                store.dynamic_agents.pop(eid, None)
                store.file_activities.pop(eid, None)
            store.execution_messages.pop(eid, None)
            for conv in store.conversations.values():
                if conv.get("activeExecutionId") == eid:
                    store.console_messages.pop(conv["id"], None)
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

    # Build project source dict from request
    ps = (
        {"type": req.project_source.type, "path": req.project_source.path}
        if req.project_source
        else None
    )

    # Generate orchestra response (creates execution, adds messages)
    await _handle_user_message(conversation, req.text, req.model, ps)

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

    # Replay buffered console messages so the client sees history it missed
    for msg in store.console_messages.get(conversation_id, []):
        await websocket.send_text(json.dumps(msg))

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
                    # Route the answer back to the waiting agent
                    question_id = message.get("questionId", "")
                    answer = message.get("answer", "")
                    entry = store.pending_questions.get(question_id)
                    if entry and entry["answer"] is None:
                        entry["answer"] = answer
                        entry["event"].set()
                        from backend.routes.internal import cleanup_question
                        cleanup_question(question_id)
                    # Also record as a conversation message
                    conversation = store.conversations.get(conversation_id)
                    if conversation and answer:
                        resp_msg = _make_message("user", answer)
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
