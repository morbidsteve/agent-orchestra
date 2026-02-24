"""Internal API endpoints for the MCP bridge question/answer relay."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from backend import store


async def _verify_token(x_orchestra_token: str = Header()) -> None:
    """Verify the internal API shared secret."""
    if x_orchestra_token != store.internal_api_token:
        raise HTTPException(status_code=403, detail="Invalid token")


router = APIRouter(prefix="/api/internal", tags=["internal"], dependencies=[Depends(_verify_token)])


def cleanup_question(question_id: str) -> None:
    """Remove an answered question from the store."""
    entry = store.pending_questions.pop(question_id, None)
    if entry:
        exec_id = entry.get("execution_id", "")
        qlist = store.pending_questions_by_execution.get(exec_id, [])
        if question_id in qlist:
            qlist.remove(question_id)
            if not qlist:
                store.pending_questions_by_execution.pop(exec_id, None)


class QuestionPayload(BaseModel):
    id: str = Field(max_length=64)
    execution_id: str = Field(max_length=64)
    question: str = Field(max_length=10000)
    options: list[str] = Field(default=[], max_length=20)


class AnswerPayload(BaseModel):
    answer: str = Field(max_length=10000)


@router.post("/question")
async def post_question(payload: QuestionPayload) -> dict[str, str]:
    """Store a pending question and broadcast it via the execution WebSocket."""
    if len(store.pending_questions) >= 100:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"error": "Too many pending questions"})

    entry: dict[str, Any] = {
        "id": payload.id,
        "execution_id": payload.execution_id,
        "question": payload.question,
        "options": payload.options,
        "answer": None,
        "event": asyncio.Event(),
    }
    store.pending_questions[payload.id] = entry

    if payload.execution_id not in store.pending_questions_by_execution:
        store.pending_questions_by_execution[payload.execution_id] = []
    store.pending_questions_by_execution[payload.execution_id].append(payload.id)

    # Broadcast to execution WebSocket so the dashboard shows the question
    await store.broadcast(payload.execution_id, {
        "type": "clarification",
        "questionId": payload.id,
        "question": payload.question,
        "options": payload.options,
        "required": True,
    })

    return {"id": payload.id}


@router.get("/question/{question_id}/answer")
async def get_answer(question_id: str) -> Any:
    """Long-poll for an answer to a pending question. Returns 200 with answer or 204 if timeout."""
    from fastapi.responses import JSONResponse

    entry = store.pending_questions.get(question_id)
    if entry is None:
        return JSONResponse(status_code=404, content={"error": "Question not found"})

    if entry["answer"] is not None:
        return {"answer": entry["answer"]}

    # Wait up to 30 seconds for the answer
    try:
        await asyncio.wait_for(entry["event"].wait(), timeout=30)
        return {"answer": entry["answer"]}
    except asyncio.TimeoutError:
        return JSONResponse(status_code=204, content=None)


@router.post("/question/{question_id}/answer")
async def post_answer(question_id: str, payload: AnswerPayload) -> dict[str, str]:
    """REST fallback for submitting an answer (if WebSocket is unavailable)."""
    entry = store.pending_questions.get(question_id)
    if entry is None:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"error": "Question not found"})

    entry["answer"] = payload.answer
    entry["event"].set()
    cleanup_question(question_id)

    return {"status": "ok"}
