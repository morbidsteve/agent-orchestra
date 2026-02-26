#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Agent Orchestra — Persistent Claude Code Session
#
# Starts a Claude Code session inside tmux so it stays alive.
# The session reads CLAUDE.md and becomes the multi-agent orchestrator.
#
# Usage:
#   ./orchestra.sh                     # Interactive — opens tmux session
#   ./orchestra.sh "Build auth module" # Sends a task, attaches to watch
#   ./orchestra.sh --detach "Build X"  # Sends a task, runs in background
#   ./orchestra.sh --status            # Check if a session is running
#   ./orchestra.sh --attach            # Reattach to existing session
#   ./orchestra.sh --stop              # Stop the orchestrator session
#   ./orchestra.sh --continue          # Resume the last conversation
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SESSION_NAME="orchestra"
REPO_DIR="${ORCHESTRA_REPO:-$(pwd)}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Agent Orchestra — Persistent Claude Code Session"
    echo ""
    echo "Usage:"
    echo "  ./orchestra.sh                        Start interactive session"
    echo "  ./orchestra.sh \"task description\"      Send a task and watch"
    echo "  ./orchestra.sh --detach \"task\"         Send a task in background"
    echo "  ./orchestra.sh --attach                Reattach to session"
    echo "  ./orchestra.sh --continue              Resume last conversation"
    echo "  ./orchestra.sh --status                Check session status"
    echo "  ./orchestra.sh --stop                  Stop the session"
    echo "  ./orchestra.sh --repo /path/to/repo    Set working directory"
    echo "  ./orchestra.sh --help                  Show this help"
    echo ""
    echo "Slash commands (once inside the session):"
    echo "  /build    Full pipeline: develop → test → security review"
    echo "  /review   Multi-agent code review"
    echo "  /audit    Comprehensive security audit"
    echo "  /feature-eval  Business + technical feature evaluation"
    echo "  /test     Test coverage analysis and improvement"
    echo "  /fix      Bug investigation and fix pipeline"
    echo "  /idea     Business idea exploration"
    echo ""
    echo "Environment:"
    echo "  ORCHESTRA_REPO   Set default repo path (default: current directory)"
}

check_deps() {
    if ! command -v tmux &>/dev/null; then
        echo -e "${RED}Error: tmux is required but not installed.${NC}"
        echo "Install with:"
        echo "  Ubuntu/Debian: sudo apt-get install tmux"
        echo "  macOS:         brew install tmux"
        echo "  Fedora:        sudo dnf install tmux"
        exit 1
    fi

    if ! command -v claude &>/dev/null; then
        echo -e "${RED}Error: claude CLI not found.${NC}"
        echo "Install Claude Code: https://docs.anthropic.com/en/docs/claude-code"
        exit 1
    fi
}

session_exists() {
    tmux has-session -t "$SESSION_NAME" 2>/dev/null
}

start_session() {
    local initial_cmd="$1"
    local detach="$2"

    if session_exists; then
        echo -e "${YELLOW}Session already running.${NC}"
        if [ -n "$initial_cmd" ]; then
            echo -e "${BLUE}Sending task to existing session...${NC}"
            # Send the task as keyboard input to the running claude session
            tmux send-keys -t "$SESSION_NAME" "$initial_cmd" Enter
            if [ "$detach" != "true" ]; then
                tmux attach-session -t "$SESSION_NAME"
            else
                echo -e "${GREEN}Task sent. Run ./orchestra.sh --attach to watch.${NC}"
            fi
        else
            tmux attach-session -t "$SESSION_NAME"
        fi
        return
    fi

    echo -e "${BLUE}Starting Agent Orchestra...${NC}"
    echo -e "  Repo:    ${GREEN}$REPO_DIR${NC}"
    echo -e "  Session: ${GREEN}$SESSION_NAME${NC}"
    echo ""

    # Verify the CLAUDE.md and commands exist
    if [ ! -f "$REPO_DIR/.claude/commands/build.md" ] && [ ! -f "$REPO_DIR/CLAUDE.md" ]; then
        echo -e "${YELLOW}Warning: No CLAUDE.md or .claude/commands/ found in $REPO_DIR${NC}"
        echo "The orchestrator needs these files. Copy them from the claude-code-orchestra template."
        echo ""
    fi

    # Build the claude command
    local claude_cmd="cd $REPO_DIR && claude"

    if [ -n "$initial_cmd" ]; then
        # Start claude with the initial prompt
        claude_cmd="cd $REPO_DIR && claude -p \"$initial_cmd\""
    fi

    # Create tmux session
    tmux new-session -d -s "$SESSION_NAME" -x 200 -y 50 "$claude_cmd; echo 'Session ended. Press any key to restart or Ctrl+C to exit.'; read -n1; exec $0"

    echo -e "${GREEN}Orchestra started.${NC}"

    if [ "$detach" != "true" ]; then
        echo "Attaching to session... (Ctrl+B, D to detach without stopping)"
        sleep 1
        tmux attach-session -t "$SESSION_NAME"
    else
        echo -e "Running in background. Use ${BLUE}./orchestra.sh --attach${NC} to watch."
    fi
}

continue_session() {
    if session_exists; then
        echo -e "${YELLOW}A session is already running. Attaching...${NC}"
        tmux attach-session -t "$SESSION_NAME"
        return
    fi

    echo -e "${BLUE}Resuming last conversation...${NC}"

    local claude_cmd="cd $REPO_DIR && claude --continue"

    tmux new-session -d -s "$SESSION_NAME" -x 200 -y 50 "$claude_cmd; echo 'Session ended. Press any key.'; read -n1"
    sleep 1
    tmux attach-session -t "$SESSION_NAME"
}

# ── Parse arguments ──────────────────────────────────────────────────────────
DETACH="false"
TASK=""
ACTION="start"

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            usage
            exit 0
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        --attach)
            ACTION="attach"
            shift
            ;;
        --stop)
            ACTION="stop"
            shift
            ;;
        --continue)
            ACTION="continue"
            shift
            ;;
        --detach)
            DETACH="true"
            shift
            ;;
        --repo)
            REPO_DIR="$2"
            shift 2
            ;;
        *)
            TASK="$1"
            shift
            ;;
    esac
done

check_deps

# ── Container sandbox check ──────────────────────────────────────────────────
# orchestra.sh launches Claude Code sessions that spawn agents with
# --dangerously-skip-permissions, so this warning is more relevant here
# than in setup.sh (which just installs deps + starts the web UI).
_in_container=false
if [ -n "${DEVCONTAINER:-}" ] || [ -n "${ORCHESTRA_CONTAINER:-}" ]; then
    _in_container=true
elif [ -f "/.dockerenv" ]; then
    _in_container=true
elif [ -f "/proc/1/cgroup" ] && grep -qE "docker|kubepods|containerd" /proc/1/cgroup 2>/dev/null; then
    _in_container=true
fi

if [ "$_in_container" = false ] && [ "${ORCHESTRA_ALLOW_HOST:-}" != "true" ]; then
    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  WARNING: No container sandbox detected                     ║${NC}"
    echo -e "${YELLOW}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  orchestra.sh launches Claude Code sessions that spawn      ║${NC}"
    echo -e "${YELLOW}║  agents with unrestricted filesystem access.                ║${NC}"
    echo -e "${YELLOW}║                                                             ║${NC}"
    echo -e "${YELLOW}║  Recommended: use a devcontainer or Docker.                 ║${NC}"
    echo -e "${YELLOW}║  To suppress:  export ORCHESTRA_ALLOW_HOST=true             ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    if [ -t 0 ]; then
        read -r -p "$(echo -e "${YELLOW}Continue without container sandbox? [y/N]${NC} ")" answer
        if [[ ! "$answer" =~ ^[Yy]$ ]]; then
            echo -e "${RED}Aborted.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Non-interactive bare-metal run blocked. Set ORCHESTRA_ALLOW_HOST=true to override.${NC}"
        exit 1
    fi
fi

case $ACTION in
    start)
        start_session "$TASK" "$DETACH"
        ;;
    status)
        if session_exists; then
            echo -e "${GREEN}Orchestra is running.${NC}"
            echo "  Session: $SESSION_NAME"
            tmux list-panes -t "$SESSION_NAME" -F "  Window: #{window_name}  Size: #{pane_width}x#{pane_height}" 2>/dev/null || true
        else
            echo -e "${YELLOW}Orchestra is not running.${NC}"
            echo "Start with: ./orchestra.sh"
        fi
        ;;
    attach)
        if session_exists; then
            tmux attach-session -t "$SESSION_NAME"
        else
            echo -e "${YELLOW}No session running.${NC} Start with: ./orchestra.sh"
        fi
        ;;
    stop)
        if session_exists; then
            tmux kill-session -t "$SESSION_NAME"
            echo -e "${GREEN}Orchestra stopped.${NC}"
        else
            echo -e "${YELLOW}No session running.${NC}"
        fi
        ;;
    continue)
        continue_session
        ;;
esac
