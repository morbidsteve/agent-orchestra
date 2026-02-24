"""WebSocket endpoint for real-time execution streaming."""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend import store
from backend.config import settings
from backend.routes.internal import cleanup_question

router = APIRouter(tags=["websocket"])

_MAX_CONNECTIONS_PER_EXECUTION = 10


@router.websocket("/api/ws/{execution_id}")
async def execution_ws(websocket: WebSocket, execution_id: str) -> None:
    """
    Stream execution updates to the client in real time.

    On connect the WebSocket is registered to receive broadcasts for the
    given *execution_id*.  Messages from the client are accepted for future
    client-to-server commands but currently ignored.
    """
    # Validate origin before accepting the connection
    origin = websocket.headers.get("origin", "")
    if origin and origin not in settings.ALLOWED_ORIGINS:
        await websocket.close(code=4003)
        return

    # Enforce per-execution connection limit
    existing = store.websocket_connections.get(execution_id, set())
    if len(existing) >= _MAX_CONNECTIONS_PER_EXECUTION:
        await websocket.close(code=4004)
        return

    await websocket.accept()

    # Register this connection
    if execution_id not in store.websocket_connections:
        store.websocket_connections[execution_id] = set()
    store.websocket_connections[execution_id].add(websocket)

    # Replay buffered messages so the client sees history it missed
    for msg in store.execution_messages.get(execution_id, []):
        await websocket.send_text(json.dumps(msg))

    # Send a snapshot of the current execution state so the client knows
    # whether the execution already completed before the WS connected
    execution = store.executions.get(execution_id)
    if execution:
        await websocket.send_text(json.dumps({
            "type": "execution-snapshot",
            "execution": {
                "id": execution["id"],
                "status": execution["status"],
                "pipeline": execution["pipeline"],
            },
        }))

    # Replay any unanswered pending questions for this execution
    for qid in store.pending_questions_by_execution.get(execution_id, []):
        q = store.pending_questions.get(qid)
        if q and q["answer"] is None:
            await websocket.send_text(json.dumps({
                "type": "clarification",
                "questionId": q["id"],
                "question": q["question"],
                "options": q["options"],
                "required": True,
            }))

    try:
        while True:
            # Keep the connection alive; read any incoming messages
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # Handle clarification responses from the dashboard
                if message.get("type") == "clarification-response":
                    qid = message.get("questionId", "")
                    answer = message.get("answer", "")
                    entry = store.pending_questions.get(qid)
                    if entry and entry["answer"] is None and entry.get("execution_id") == execution_id:
                        entry["answer"] = answer
                        entry["event"].set()
                        cleanup_question(qid)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        # Clean up on disconnect
        conns = store.websocket_connections.get(execution_id)
        if conns is not None:
            conns.discard(websocket)
            if not conns:
                del store.websocket_connections[execution_id]
