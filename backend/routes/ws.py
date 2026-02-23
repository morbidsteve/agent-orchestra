"""WebSocket endpoint for real-time execution streaming."""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend import store
from backend.config import settings

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

    try:
        while True:
            # Keep the connection alive; read any incoming messages
            data = await websocket.receive_text()
            # Future: handle client→server commands here
            try:
                _message = json.loads(data)
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
