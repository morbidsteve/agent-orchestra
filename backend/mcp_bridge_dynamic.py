"""
Dynamic MCP Bridge — Exposes spawn_agent, get_agent_status, and ask_user tools
to the orchestrator Claude CLI session via MCP stdio protocol.

Environment variables (set by dynamic_orchestrator.py before launching):
  ORCHESTRA_API_URL — Backend HTTP URL (default: http://127.0.0.1:8000)
  ORCHESTRA_EXECUTION_ID — Current execution ID
  ORCHESTRA_INTERNAL_TOKEN — Shared auth token
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API_URL = os.environ.get("ORCHESTRA_API_URL", "http://127.0.0.1:8000")
EXECUTION_ID = os.environ.get("ORCHESTRA_EXECUTION_ID", "")
TOKEN = os.environ.get("ORCHESTRA_INTERNAL_TOKEN", "")


def _post(path: str, body: dict) -> dict:
    """POST JSON to internal API."""
    url = f"{API_URL}{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Orchestra-Token", TOKEN)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def _get(path: str, timeout: int = 30) -> dict:
    """GET from internal API."""
    url = f"{API_URL}{path}"
    req = urllib.request.Request(url)
    req.add_header("X-Orchestra-Token", TOKEN)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def _long_poll_result(agent_id: str, max_wait: int = 1800) -> dict:
    """Long-poll for agent result. 30s per poll, up to max_wait total."""
    elapsed = 0
    while elapsed < max_wait:
        try:
            result = _get(f"/api/internal/agent/{agent_id}/result", timeout=35)
            if result.get("status") in ("completed", "failed"):
                return result
        except urllib.error.URLError:
            pass
        elapsed += 30
    return {"status": "timeout", "output": "Agent timed out"}


# --- MCP stdio protocol ---

TOOLS = [
    {
        "name": "spawn_agent",
        "description": (
            "Spawn a new agent to work on a specific task. Use role to specify "
            "agent type (developer, tester, security-reviewer, etc). Set wait=true "
            "to block until the agent completes and get its output, or wait=false to "
            "spawn in parallel and check status later."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "role": {
                    "type": "string",
                    "description": (
                        "Agent role: developer, tester, security-reviewer, "
                        "documentation, or any custom role"
                    ),
                },
                "name": {
                    "type": "string",
                    "description": "Human-readable agent name (e.g. 'Backend Developer', 'Test Runner')",
                },
                "task": {
                    "type": "string",
                    "description": "Detailed task description for this agent",
                },
                "wait": {
                    "type": "boolean",
                    "description": (
                        "If true, block until agent completes. If false, return "
                        "agent_id immediately for parallel work."
                    ),
                    "default": True,
                },
            },
            "required": ["role", "name", "task"],
        },
    },
    {
        "name": "get_agent_status",
        "description": "Check the status and output of a previously spawned agent (when wait=false was used).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "string",
                    "description": "The agent ID returned by spawn_agent",
                },
            },
            "required": ["agent_id"],
        },
    },
    {
        "name": "ask_user",
        "description": "Ask the user a clarifying question. Use when you need user input to proceed.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "options": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["question"],
        },
    },
]


def handle_tool_call(tool_name: str, arguments: dict) -> str:
    """Handle an MCP tool call and return the result string."""
    if tool_name == "spawn_agent":
        role = arguments["role"]
        name = arguments["name"]
        task = arguments["task"]
        wait = arguments.get("wait", True)

        result = _post("/api/internal/spawn-agent", {
            "execution_id": EXECUTION_ID,
            "role": role,
            "name": name,
            "task": task,
            "wait": False,  # Always async on the backend; we handle waiting here
            "model": None,
        })
        agent_id = result["agent_id"]

        if wait:
            # Block until agent completes
            poll_result = _long_poll_result(agent_id)
            return json.dumps({
                "agent_id": agent_id,
                "status": poll_result.get("status", "unknown"),
                "output": poll_result.get("output", ""),
            })
        else:
            return json.dumps({
                "agent_id": agent_id,
                "status": "running",
                "message": f"Agent '{name}' spawned. Use get_agent_status to check progress.",
            })

    elif tool_name == "get_agent_status":
        agent_id = arguments["agent_id"]
        result = _get(f"/api/internal/agent/{agent_id}/status")
        return json.dumps(result)

    elif tool_name == "ask_user":
        question = arguments["question"]
        options = arguments.get("options")
        result = _post("/api/internal/question", {
            "id": f"q-{EXECUTION_ID}-ask",
            "execution_id": EXECUTION_ID,
            "question": question,
            "options": options or [],
        })
        question_id = result["id"]
        # Long-poll for answer
        elapsed = 0
        while elapsed < 300:
            try:
                answer_resp = _get(f"/api/internal/question/{question_id}/answer", timeout=35)
                if answer_resp.get("answer"):
                    return answer_resp["answer"]
            except urllib.error.URLError:
                pass
            elapsed += 30
        return "No answer received (timed out)"

    return json.dumps({"error": f"Unknown tool: {tool_name}"})


def main():
    """MCP stdio server main loop. Reads JSON-RPC from stdin, writes to stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = msg.get("method", "")
        msg_id = msg.get("id")

        if method == "initialize":
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {"listChanged": False}},
                    "serverInfo": {"name": "orchestra-dynamic", "version": "0.5.0"},
                },
            }
        elif method == "notifications/initialized":
            continue
        elif method == "tools/list":
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {"tools": TOOLS},
            }
        elif method == "tools/call":
            tool_name = msg["params"]["name"]
            arguments = msg["params"].get("arguments", {})
            try:
                result_text = handle_tool_call(tool_name, arguments)
                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [{"type": "text", "text": result_text}],
                        "isError": False,
                    },
                }
            except Exception as e:
                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [{"type": "text", "text": str(e)}],
                        "isError": True,
                    },
                }
        else:
            if msg_id is not None:
                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32601, "message": f"Unknown method: {method}"},
                }
            else:
                # Notification with no id — skip
                continue

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
