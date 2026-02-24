"""MCP stdio server that bridges agent ask_user calls to the Orchestra backend."""

from __future__ import annotations

import os
import uuid

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("orchestra")

_API_URL = os.environ.get("ORCHESTRA_API_URL", "http://127.0.0.1:8000")
_EXECUTION_ID = os.environ.get("ORCHESTRA_EXECUTION_ID", "")
_INTERNAL_TOKEN = os.environ.get("ORCHESTRA_INTERNAL_TOKEN", "")


@mcp.tool()
async def ask_user(question: str, options: list[str] | None = None) -> str:
    """Ask the user a question and wait for their answer.

    Use this when you need clarification from the user before proceeding.
    The question will appear in the Orchestra dashboard and the user can
    reply with one of the provided options or free-form text.

    Args:
        question: The question to ask the user.
        options: Optional list of suggested answers the user can pick from.
    """
    question_id = f"q-{uuid.uuid4().hex}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{_API_URL}/api/internal/question",
            json={
                "id": question_id,
                "execution_id": _EXECUTION_ID,
                "question": question,
                "options": options or [],
            },
            headers={"X-Orchestra-Token": _INTERNAL_TOKEN},
        )
        resp.raise_for_status()

    # Long-poll for the answer (30s per poll, 5 min total)
    async with httpx.AsyncClient(timeout=35) as client:
        for _ in range(10):  # 10 × 30s = 5 min
            try:
                resp = await client.get(
                    f"{_API_URL}/api/internal/question/{question_id}/answer",
                    headers={"X-Orchestra-Token": _INTERNAL_TOKEN},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("answer", "No answer provided")
                # 204 = no answer yet, keep polling
            except httpx.TimeoutException:
                continue
            except httpx.HTTPError:
                break

    return "(No response from user — timed out after 5 minutes. Proceed with your best judgment.)"


if __name__ == "__main__":
    mcp.run()
