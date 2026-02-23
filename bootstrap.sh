#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Agent Orchestra — One-Command Bootstrap
#
# Sets up everything on a fresh Ubuntu/Debian VM:
#   - Python 3.11+, pip, venv
#   - Claude Agent SDK
#   - Project structure
#   - Convenience aliases
#
# Usage:
#   curl -sSL <your-hosted-url>/bootstrap.sh | bash
#   — or —
#   chmod +x bootstrap.sh && ./bootstrap.sh
#
# After running, just:
#   export ANTHROPIC_API_KEY=your-key
#   orchestra "Build a user auth module"
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

INSTALL_DIR="${AGENT_ORCHESTRA_DIR:-$HOME/agent-orchestra}"
VENV_DIR="$INSTALL_DIR/.venv"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Agent Orchestra — Bootstrap Setup      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. System dependencies ───────────────────────────────────────────────────
info "Checking system dependencies..."

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
fi

install_python() {
    case "$OS" in
        ubuntu|debian)
            info "Installing Python on Ubuntu/Debian..."
            sudo apt-get update -qq
            sudo apt-get install -y -qq python3 python3-pip python3-venv git curl >/dev/null 2>&1
            ;;
        fedora|rhel|centos|rocky|alma)
            info "Installing Python on RHEL-family..."
            sudo dnf install -y python3 python3-pip git curl >/dev/null 2>&1
            ;;
        amzn)
            info "Installing Python on Amazon Linux..."
            sudo yum install -y python3 python3-pip git curl >/dev/null 2>&1
            ;;
        darwin)
            info "macOS detected..."
            if command -v brew &>/dev/null; then
                brew install python3 git 2>/dev/null || true
            else
                warn "Homebrew not found. Install Python 3.11+ manually: https://python.org"
            fi
            ;;
        *)
            warn "Unknown OS ($OS). Make sure Python 3.11+, pip, and git are installed."
            ;;
    esac
}

# Check for Python 3.11+
if command -v python3 &>/dev/null; then
    PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)

    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 11 ]; then
        ok "Python $PY_VERSION found"
    else
        warn "Python $PY_VERSION found, but 3.11+ recommended. Attempting upgrade..."
        install_python
    fi
else
    info "Python not found. Installing..."
    install_python
fi

# Verify
python3 --version >/dev/null 2>&1 || fail "Python 3 installation failed. Install manually and re-run."
ok "Python $(python3 --version 2>&1 | awk '{print $2}') ready"

# ── 2. Create project directory ──────────────────────────────────────────────
info "Setting up project at $INSTALL_DIR..."

if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/orchestrator.py" ]; then
    warn "Existing installation found at $INSTALL_DIR"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Keeping existing installation. Updating dependencies only..."
    fi
fi

mkdir -p "$INSTALL_DIR"/{agents,workflows,ci}

# ── 3. Create virtual environment ────────────────────────────────────────────
info "Creating virtual environment..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q
ok "Virtual environment created at $VENV_DIR"

# ── 4. Install dependencies ─────────────────────────────────────────────────
info "Installing Claude Agent SDK..."
pip install claude-agent-sdk -q
ok "Dependencies installed"

# ── 5. Copy project files (if this script is in the project directory) ───────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

copy_if_exists() {
    local src="$1"
    local dest="$2"
    if [ -f "$SCRIPT_DIR/$src" ]; then
        cp "$SCRIPT_DIR/$src" "$dest"
        return 0
    fi
    return 1
}

copy_dir_if_exists() {
    local src="$1"
    local dest="$2"
    if [ -d "$SCRIPT_DIR/$src" ]; then
        cp -r "$SCRIPT_DIR/$src"/* "$dest/" 2>/dev/null || true
        return 0
    fi
    return 1
}

info "Copying project files..."
copy_if_exists "orchestrator.py" "$INSTALL_DIR/orchestrator.py" || warn "orchestrator.py not found next to bootstrap.sh — you'll need to copy it manually"
copy_if_exists "requirements.txt" "$INSTALL_DIR/requirements.txt" || true
copy_if_exists "CLAUDE.md.template" "$INSTALL_DIR/CLAUDE.md.template" || true
copy_if_exists "SETUP.md" "$INSTALL_DIR/SETUP.md" || true
copy_dir_if_exists "agents" "$INSTALL_DIR/agents" || warn "agents/ not found — copy manually"
copy_dir_if_exists "ci" "$INSTALL_DIR/ci" || true
copy_dir_if_exists "workflows" "$INSTALL_DIR/workflows" || true

# Create __init__.py files if missing
touch "$INSTALL_DIR/agents/__init__.py"
touch "$INSTALL_DIR/workflows/__init__.py"

ok "Project files in place"

# ── 6. Create convenience wrapper ───────────────────────────────────────────
info "Creating 'orchestra' CLI wrapper..."

cat > "$INSTALL_DIR/orchestra" << 'WRAPPER'
#!/usr/bin/env bash
# Convenience wrapper for the Agent Orchestra
# Usage: orchestra "Build a feature"
#        orchestra --workflow=security-audit
#        orchestra --help

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.venv/bin/activate"

# Check for API key
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "Error: ANTHROPIC_API_KEY not set."
    echo ""
    echo "Set it with:"
    echo "  export ANTHROPIC_API_KEY=your-key-here"
    echo ""
    echo "Or add to your shell profile:"
    echo "  echo 'export ANTHROPIC_API_KEY=your-key-here' >> ~/.bashrc"
    exit 1
fi

python3 "$SCRIPT_DIR/orchestrator.py" "$@"
WRAPPER

chmod +x "$INSTALL_DIR/orchestra"

# ── 7. Add to PATH (optional) ───────────────────────────────────────────────
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
fi

PATH_LINE="export PATH=\"$INSTALL_DIR:\$PATH\""

if [ -n "$SHELL_RC" ]; then
    if ! grep -qF "agent-orchestra" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# Agent Orchestra" >> "$SHELL_RC"
        echo "$PATH_LINE" >> "$SHELL_RC"
        ok "Added to PATH in $SHELL_RC"
    else
        ok "PATH already configured in $SHELL_RC"
    fi
fi

# Also export for this session
export PATH="$INSTALL_DIR:$PATH"

# ── 8. Verify installation ──────────────────────────────────────────────────
info "Verifying installation..."

source "$VENV_DIR/bin/activate"
python3 -c "import claude_agent_sdk; print('Agent SDK imported successfully')" 2>/dev/null \
    && ok "Claude Agent SDK verified" \
    || warn "SDK import check failed — may need manual verification"

# ── 9. Summary ───────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║            Setup Complete!                   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Install location:  $INSTALL_DIR"
echo "  Python venv:       $VENV_DIR"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Set your API key:"
echo "     export ANTHROPIC_API_KEY=your-key-here"
echo ""
echo "  2. (Optional) Copy CLAUDE.md to your repo:"
echo "     cp $INSTALL_DIR/CLAUDE.md.template /your/repo/CLAUDE.md"
echo ""
echo "  3. Run it:"
echo "     orchestra \"Build a user auth module\""
echo "     orchestra --workflow=security-audit --repo=/your/repo"
echo "     orchestra --workflow=feature-eval \"Add real-time collab\""
echo "     orchestra --help"
echo ""
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo -e "  ${YELLOW}⚠ ANTHROPIC_API_KEY is not set yet.${NC}"
    echo "    Set it before running orchestra."
    echo ""
fi
echo "  For full docs: cat $INSTALL_DIR/SETUP.md"
echo ""
