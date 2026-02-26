#!/usr/bin/env bash
set -euo pipefail

trap 'err "Something went wrong on line $LINENO. Check the output above for details."' ERR

# ── Constants ─────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/morbidsteve/agent-orchestra.git"
REPO_DIR="agent-orchestra"
MIN_PYTHON="3.11"
MIN_NODE="18"

if [ -t 1 ]; then
    BLUE='\033[0;34m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    BLUE='' GREEN='' YELLOW='' RED='' BOLD='' NC=''
fi

log()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERR]${NC}  $*" >&2; }

is_interactive() { [ -t 0 ]; }

confirm() {
    local prompt="$1"
    if is_interactive; then
        read -r -p "$(echo -e "${BOLD}${prompt} [y/N]${NC} ")" answer
        [[ "$answer" =~ ^[Yy]$ ]]
    else
        warn "Non-interactive mode — proceeding automatically"
        return 0
    fi
}

# Returns 0 (true) if $1 >= $2 using numeric segment comparison.
version_gte() {
    local IFS='.'
    local -a ver1=($1) ver2=($2)
    local i max=${#ver2[@]}
    for (( i=0; i<max; i++ )); do
        local a="${ver1[$i]:-0}"
        local b="${ver2[$i]:-0}"
        if (( a > b )); then return 0; fi
        if (( a < b )); then return 1; fi
    done
    return 0
}

detect_os() {
    local uname_s
    uname_s="$(uname -s)"
    case "$uname_s" in
        Darwin)
            OS="macos"
            PKG_MGR="brew"
            ;;
        Linux)
            OS="linux"
            if [ -f /etc/os-release ]; then
                # shellcheck disable=SC1091
                . /etc/os-release
                case "${ID:-}" in
                    ubuntu|debian|pop|linuxmint)  PKG_MGR="apt" ;;
                    fedora)                        PKG_MGR="dnf" ;;
                    rhel|centos|rocky|alma)        PKG_MGR="yum" ;;
                    amzn)                          PKG_MGR="yum" ;;
                    arch|manjaro|endeavouros)      PKG_MGR="pacman" ;;
                    *)
                        err "Unrecognized Linux distro: ${ID:-unknown}"
                        err "Supported: Ubuntu, Debian, Fedora, RHEL/CentOS, Arch"
                        exit 1
                        ;;
                esac
            else
                err "Cannot detect Linux distribution (/etc/os-release missing)."
                exit 1
            fi
            ;;
        *)
            err "Unsupported OS: $uname_s. This script supports macOS and Linux."
            exit 1
            ;;
    esac
}

install_pkg() {
    local name="$1"; shift
    case "$PKG_MGR" in
        brew)    brew install "$@" ;;
        apt)     sudo apt-get install -y "$@" ;;
        dnf)     sudo dnf install -y "$@" ;;
        yum)     sudo yum install -y "$@" ;;
        pacman)  sudo pacman -S --noconfirm "$@" ;;
    esac
}

ensure_homebrew() {
    [[ "$OS" != "macos" ]] && return 0
    if command -v brew &>/dev/null; then
        ok "Homebrew found"
        return 0
    fi
    log "Homebrew is required on macOS for installing dependencies."
    if confirm "Install Homebrew?"; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Add brew to PATH for Apple Silicon
        if [ -f /opt/homebrew/bin/brew ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
        ok "Homebrew installed"
    else
        err "Cannot continue without Homebrew on macOS."
        exit 1
    fi
}

ensure_git() {
    if command -v git &>/dev/null; then
        ok "git found"
        return 0
    fi
    log "git is not installed."
    if confirm "Install git?"; then
        install_pkg "git" git
        ok "git installed"
    else
        err "git is required. Please install it and re-run."
        exit 1
    fi
}

ensure_python() {
    local py_cmd="python3"
    if command -v python3 &>/dev/null; then
        local py_ver
        py_ver="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
        if version_gte "$py_ver" "$MIN_PYTHON"; then
            ok "Python $py_ver found"
            return 0
        fi
        warn "Python $py_ver is below the minimum ($MIN_PYTHON)."
    else
        log "Python 3 not found."
    fi

    if confirm "Install Python $MIN_PYTHON+?"; then
        case "$PKG_MGR" in
            apt)
                local sys_ver=""
                if command -v python3 &>/dev/null; then
                    sys_ver="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
                fi
                if [ -n "$sys_ver" ] && ! version_gte "$sys_ver" "$MIN_PYTHON"; then
                    log "Adding deadsnakes PPA for Python $MIN_PYTHON..."
                    sudo apt-get update -qq
                    sudo apt-get install -y software-properties-common
                    sudo add-apt-repository -y ppa:deadsnakes/ppa
                    sudo apt-get update -qq
                    sudo apt-get install -y python3.11 python3.11-venv
                    py_cmd="python3.11"
                else
                    sudo apt-get update -qq
                    sudo apt-get install -y python3 python3-pip python3-venv
                fi
                ;;
            brew)
                brew install python@3.11
                ;;
            dnf)
                sudo dnf install -y python3.11 python3.11-pip || sudo dnf install -y python3 python3-pip
                ;;
            yum)
                sudo yum install -y python3 python3-pip
                ;;
            pacman)
                sudo pacman -S --noconfirm python python-pip
                ;;
        esac
    else
        err "Python $MIN_PYTHON+ is required. Please install it and re-run."
        exit 1
    fi

    # Verify after install
    local final_ver
    final_ver="$($py_cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')" || true
    if [ -z "$final_ver" ] || ! version_gte "$final_ver" "$MIN_PYTHON"; then
        err "Python $MIN_PYTHON+ could not be installed. Found: ${final_ver:-none}"
        exit 1
    fi
    ok "Python $final_ver installed"
}

ensure_node() {
    if command -v node &>/dev/null; then
        local node_ver
        node_ver="$(node --version | sed 's/^v//')"
        local node_major="${node_ver%%.*}"
        if version_gte "$node_major" "$MIN_NODE"; then
            ok "Node.js $node_ver found"
            return 0
        fi
        warn "Node.js $node_ver is below the minimum (v$MIN_NODE)."
    else
        log "Node.js not found."
    fi

    if confirm "Install Node.js $MIN_NODE+?"; then
        case "$PKG_MGR" in
            brew)   brew install node ;;
            apt)    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
                    sudo apt-get install -y nodejs ;;
            dnf)    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
                    sudo dnf install -y nodejs ;;
            yum)    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
                    sudo yum install -y nodejs ;;
            pacman) sudo pacman -S --noconfirm nodejs npm ;;
        esac
    else
        err "Node.js $MIN_NODE+ is required. Please install it and re-run."
        exit 1
    fi

    # Verify after install
    if ! command -v node &>/dev/null; then
        err "Node.js installation failed. Please install manually and re-run."
        exit 1
    fi
    local final_ver
    final_ver="$(node --version | sed 's/^v//')"
    ok "Node.js $final_ver installed"
}

ensure_make() {
    if command -v make &>/dev/null; then
        ok "make found"
        return 0
    fi
    log "make is not installed."
    if confirm "Install make?"; then
        case "$PKG_MGR" in
            apt)     sudo apt-get install -y build-essential ;;
            brew)    xcode-select --install 2>/dev/null || true ;;
            dnf)     sudo dnf install -y make ;;
            yum)     sudo yum install -y make ;;
            pacman)  sudo pacman -S --noconfirm make ;;
        esac
        ok "make installed"
    else
        err "make is required. Please install it and re-run."
        exit 1
    fi
}

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Agent Orchestra — Setup               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

detect_os
log "Detected OS: $OS ($PKG_MGR)"
echo ""

log "Checking prerequisites..."
ensure_homebrew
ensure_git
ensure_python
ensure_node
ensure_make
echo ""

if [ -f "Makefile" ] && grep -q "orchestra-dashboard" "Makefile" 2>/dev/null; then
    log "Already inside the repository"
elif [ -d "$REPO_DIR" ] && [ -f "$REPO_DIR/Makefile" ]; then
    log "Found existing $REPO_DIR/ — updating..."
    cd "$REPO_DIR"
    git pull --ff-only
else
    log "Cloning $REPO_URL ..."
    git clone "$REPO_URL"
    cd "$REPO_DIR"
fi
echo ""

log "Ready to go! Running setup..."
echo ""
echo "  * Python dependencies will be installed in a local .venv"
echo "  * Node modules will be installed in orchestra-dashboard/node_modules"
echo "  * Backend will start on http://localhost:8000"
echo "  * Frontend will start on http://localhost:5173"
echo ""

# Clean up broken venv if it exists
if [ -d ".venv" ] && [ ! -x ".venv/bin/python" ]; then
    warn "Found broken .venv (no python binary) — removing and recreating"
    rm -rf .venv
fi

# ── Container sandbox check ──────────────────────────────────────────────────
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
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  WARNING: No container sandbox detected                     ║${NC}"
    echo -e "${RED}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${RED}║  Agent Orchestra spawns AI agents with unrestricted         ║${NC}"
    echo -e "${RED}║  filesystem access (--dangerously-skip-permissions).        ║${NC}"
    echo -e "${RED}║                                                             ║${NC}"
    echo -e "${RED}║  Running on bare metal means agents can read, write, and    ║${NC}"
    echo -e "${RED}║  delete ANY file on your system.                            ║${NC}"
    echo -e "${RED}║                                                             ║${NC}"
    echo -e "${RED}║  Recommended: use the devcontainer or Docker instead.       ║${NC}"
    echo -e "${RED}║  To proceed anyway: export ORCHESTRA_ALLOW_HOST=true        ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    if is_interactive; then
        if ! confirm "Continue without container sandbox?"; then
            err "Aborted. Use a devcontainer or Docker for safe operation."
            exit 1
        fi
        warn "Proceeding without container sandbox at user's request."
    else
        err "Non-interactive bare-metal install blocked. Set ORCHESTRA_ALLOW_HOST=true to override."
        exit 1
    fi
fi

make
