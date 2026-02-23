# Agent Orchestra

A multi-agent development system that coordinates specialized AI agents to deliver production-quality software. Define a task, pick a workflow, and let the agents plan, develop, test, secure, and report — all orchestrated through a real-time dashboard.

## Quick Start

**One-liner** (installs dependencies, clones repo, starts servers):

```bash
curl -fsSL https://raw.githubusercontent.com/morbidsteve/agent-orchestra/master/setup.sh | bash
```

**Docker one-liner** (no local dependencies needed):

```bash
docker run --rm -p 5173:5173 -p 8000:8000 $(docker build -q https://github.com/morbidsteve/agent-orchestra.git)
```

Then open **http://localhost:5173**.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Dashboard (React)                      │
│  New Execution ─ Live Pipeline ─ Agents ─ Findings       │
│                    :5173                                  │
└──────────┬──────────────────────┬────────────────────────┘
           │ REST                 │ WebSocket
┌──────────▼──────────────────────▼────────────────────────┐
│                  Backend (FastAPI)                        │
│  Executions ─ Agents ─ Findings ─ Auth ─ WS streaming    │
│                    :8000                                  │
└──────────┬───────────────────────────────────────────────┘
           │ subprocess
┌──────────▼───────────────────────────────────────────────┐
│               Orchestrator (Claude Agent SDK)             │
│  Developer ─ Developer 2 ─ Tester ─ DevSecOps ─ BizDev   │
└──────────────────────────────────────────────────────────┘
```

## Features

- **5 Specialized Agents** — Developer (primary + secondary), Tester, DevSecOps, Business Dev
- **5 Workflows** — Full Pipeline, Code Review, Security Audit, Feature Evaluation, Quick Fix
- **Real-time Streaming** — WebSocket-powered live output from each agent
- **Finding Detection** — Automatic extraction of security and quality findings
- **Project Sources** — Point agents at a local folder, a Git repo URL, or a fresh empty project
- **Model Selection** — Choose between Claude Opus, Sonnet, or Haiku per execution
- **GitHub & Claude Auth** — Integrated device-flow login

## Workflows

| Workflow | Phases | Use Case |
|----------|--------|----------|
| **Full Pipeline** | Plan → Develop → Test → Security → Report | New features, refactors |
| **Code Review** | Plan → Develop + Test + Security (parallel) → Report | PR review |
| **Security Audit** | Plan → Security → Report | Vulnerability scanning |
| **Feature Eval** | Plan → Develop → Report | Feasibility + market analysis |
| **Quick Fix** | Develop → Test → Report | Small bug fixes |

## Tech Stack

| Layer | Stack |
|-------|-------|
| **Frontend** | React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7 |
| **Backend** | Python 3.11+, FastAPI, Pydantic 2, Uvicorn |
| **Testing** | Vitest + React Testing Library (183 tests) |
| **Orchestrator** | Claude Agent SDK, Claude Code CLI |

## Prerequisites

- Python 3.11+
- Node.js 18+
- Git, Make
- (Optional) GitHub CLI (`gh`) for auth integration
- (Optional) Claude Code CLI (`claude`) for live agent execution

The `setup.sh` script will install any missing prerequisites automatically.

## Manual Setup

```bash
git clone https://github.com/morbidsteve/agent-orchestra.git
cd agent-orchestra
make          # installs deps + starts servers
```

This runs:

1. Creates a Python venv and installs backend dependencies
2. Runs `npm install` for the frontend
3. Starts the backend on **http://localhost:8000**
4. Starts the frontend on **http://localhost:5173**

## Docker

Build and run:

```bash
docker build -t agent-orchestra .
docker run --rm -p 5173:5173 -p 8000:8000 agent-orchestra
```

Or the combined one-liner from Quick Start above.

## Project Structure

```
agent-orchestra/
├── backend/                 # FastAPI backend
│   ├── main.py              # App setup, CORS, routers
│   ├── config.py            # Settings (host, port, projects dir)
│   ├── models.py            # Pydantic models
│   ├── store.py             # In-memory state + WebSocket broadcast
│   ├── routes/              # REST + WS endpoints
│   │   ├── executions.py    # Create/list executions
│   │   ├── agents.py        # Agent status
│   │   ├── findings.py      # Security/quality findings
│   │   ├── auth.py          # GitHub + Claude auth
│   │   └── ws.py            # WebSocket streaming
│   └── services/            # Business logic
│       ├── orchestrator.py  # Execution runner + simulation fallback
│       ├── auth.py          # GitHub device flow, Claude CLI
│       └── parser.py        # Finding/phase output parsing
├── orchestra-dashboard/     # React frontend
│   └── src/
│       ├── pages/           # Dashboard, Execution, Agents, Findings, Settings
│       ├── components/      # UI primitives + feature components
│       ├── context/         # Global state (OrchestraContext)
│       ├── hooks/           # useApiData, useWebSocket, etc.
│       └── lib/             # Types, API client, constants, mock data
├── orchestrator.py          # CLI orchestrator (Claude Agent SDK)
├── agents/                  # Agent definitions + system prompts
├── Makefile                 # Build/dev/test/lint targets
├── setup.sh                 # One-liner bootstrap script
└── Dockerfile               # Container build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/executions` | List all executions |
| `GET` | `/api/executions/:id` | Get execution details |
| `POST` | `/api/executions` | Create and start an execution |
| `GET` | `/api/agents` | List agents with status |
| `GET` | `/api/findings` | List findings (filterable) |
| `GET` | `/api/auth/status` | GitHub + Claude auth status |
| `POST` | `/api/auth/github/login` | Start GitHub device flow |
| `WS` | `/api/ws/:execution_id` | Real-time execution streaming |
| `GET` | `/api/health` | Health check |

## Make Targets

```bash
make              # setup + dev (default)
make setup        # install all dependencies
make dev          # start backend + frontend
make test         # run frontend tests
make lint         # ESLint + TypeScript check
make build        # production build
make check        # test + lint + build
make clean        # remove artifacts
make stop         # kill backend server
```

## How It Works

1. **Create an Execution** — Pick a workflow, describe the task, select a model and project source
2. **Pipeline Runs** — The backend spawns the orchestrator, which delegates to specialized agents phase by phase
3. **Live Updates** — WebSocket streams agent output, phase transitions, and finding detections to the dashboard
4. **Results** — View findings, agent activity, modified files, and the final report

When the Claude Agent SDK is not installed, the system falls back to simulated execution so the dashboard remains fully functional for development and demo purposes.

## License

MIT
