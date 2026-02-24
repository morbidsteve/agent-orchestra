# Agent Orchestra

[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue)](https://python.org)
[![React 19](https://img.shields.io/badge/react-19-61dafb)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A multi-agent development system where you describe what you want to build in plain language, and five specialized AI agents plan, develop, test, secure, and ship it — orchestrated in real time through a conversational interface.

<!-- TODO: screenshots -->

## Getting Started

The fastest path is the [Trail of Bits devcontainer](https://github.com/trailofbits/claude-code-devcontainer):

```bash
devc .                 # build and start the container
devc shell             # open a shell inside it
make                   # install deps + start backend & frontend
```

Then open **http://localhost:5173** and start typing.

<details>
<summary>Alternative: run locally without a devcontainer</summary>

Requires Python 3.11+, Node.js 18+, Git, and Make.

```bash
git clone https://github.com/morbidsteve/agent-orchestra.git
cd agent-orchestra
make
```

Or use the setup script (installs missing prerequisites automatically):

```bash
curl -fsSL https://raw.githubusercontent.com/morbidsteve/agent-orchestra/master/setup.sh | bash
```

</details>

<details>
<summary>Alternative: Docker</summary>

```bash
docker build -t agent-orchestra .
docker run --rm -p 5173:5173 -p 8000:8000 agent-orchestra
```

</details>

---

## Features

### Conversational Console

The primary interface at `/` is a chat-style console. Describe what you want — "add OAuth login to the backend," "run a security audit on the payments module," "evaluate whether we should add real-time collaboration" — and the orchestrator detects your intent, selects the right workflow, and executes it.

The split-panel layout puts the conversation on the left and a live context panel on the right, showing execution progress, agent activity, and screenshot captures as work happens. No forms, no dropdowns — just type.

### Agent Office

A visual node graph at `/office` shows all five agents (Developer, Developer 2, Tester, DevSecOps, Business Dev) arranged around a central Orchestrator hub. Each node reflects real-time status: idle pulse, working spin with glow, or completed checkmark. Animated SVG connection lines visualize data handoffs between agents as a pipeline runs.

A mini-view of the Agent Office is also embedded in the Console's context panel for quick reference.

### Screenshot System

Terminal snapshots are captured automatically after each pipeline phase, and browser screenshots are taken via Playwright during the security phase to capture the running product. View them in a timeline, a lightbox, or as a carousel in the console context panel.

### Business Dev Evaluation

Type something like "evaluate whether we should add real-time collaboration" and the system spawns a Business Dev agent. A progressive card fills in live: Market Research, Competitive Analysis, ICE Score, and a final recommendation of **BUILD**, **DEFER**, or **INVESTIGATE** with reasoning.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Console (React 19)                        │
│  Chat Interface  |  Agent Office  |  Screenshot Timeline    │
│                       :5173                                 │
└───────────┬───────────────────────┬─────────────────────────┘
            │ REST                  │ WebSocket
┌───────────▼───────────────────────▼─────────────────────────┐
│                  Backend (FastAPI)                           │
│  Conversations ─ Executions ─ Screenshots ─ Auth ─ WS       │
│                       :8000                                 │
└───────────┬─────────────────────────────────────────────────┘
            │ subprocess
┌───────────▼─────────────────────────────────────────────────┐
│              Orchestrator (Claude Agent SDK)                 │
│  Developer ─ Developer 2 ─ Tester ─ DevSecOps ─ BizDev      │
└─────────────────────────────────────────────────────────────┘
```

The Console sends messages over REST; the backend creates or resumes a conversation, spawns the orchestrator as a subprocess, and streams agent output back to the browser over a WebSocket.

## Routes

| Path | Page | Purpose |
|------|------|---------|
| `/` | Console | Primary conversational interface |
| `/dashboard` | Dashboard | Execution overview and pipeline status |
| `/office` | Agent Office | Live agent node-graph visualization |
| `/executions/:id` | Execution Detail | Deep dive into a single run |
| `/agents` | Agents | Agent management and status |
| `/findings` | Findings | Security and quality findings |
| `/settings` | Settings | GitHub and Claude Code authentication |

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/conversations` | Start a new conversation |
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id` | Get conversation details |
| `POST` | `/api/conversations/:id/messages` | Send a message |
| `WS` | `/api/ws/console/:id` | Real-time console streaming |
| `POST` | `/api/executions` | Create and start an execution |
| `GET` | `/api/executions` | List all executions |
| `GET` | `/api/executions/:id` | Get execution details |
| `WS` | `/api/ws/:execution_id` | Real-time execution streaming |
| `GET` | `/api/screenshots` | List screenshots |
| `POST` | `/api/screenshots` | Upload a screenshot |
| `GET` | `/api/screenshots/:id` | Get screenshot metadata |
| `GET` | `/api/screenshots/:id/image` | Get screenshot image |
| `GET` | `/api/agents` | List agents with status |
| `POST` | `/api/agents` | Register an agent |
| `DELETE` | `/api/agents/:role` | Remove an agent |
| `GET` | `/api/findings` | List findings (filterable) |
| `GET` | `/api/auth/status` | Auth status (GitHub + Claude) |
| `POST` | `/api/auth/github/login` | Start GitHub device flow |
| `POST` | `/api/auth/claude/login` | Start Claude OAuth flow |
| `GET` | `/api/filesystem/browse` | Browse project files |
| `GET` | `/api/health` | Health check |

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7 |
| Backend | Python 3.11+, FastAPI, Pydantic 2, Uvicorn |
| Testing | Vitest + React Testing Library |
| Orchestrator | Claude Agent SDK, Claude Code CLI |

## Make Targets

```bash
make              # install deps + start dev servers (default)
make setup        # install Python + Node dependencies only
make dev          # start backend + frontend
make test         # run frontend test suite
make lint         # ESLint + TypeScript type check
make build        # production build
make check        # test + lint + build (all quality gates)
make clean        # remove .venv, node_modules, dist
make stop         # kill the background backend process
```

## Workflows

The orchestrator supports five workflows. When you use the Console, it selects the right one automatically based on your message. You can also trigger them explicitly via the API.

| Workflow | Phases | When to use |
|----------|--------|-------------|
| Full Pipeline | Plan > Develop > Test > Security > Report | New features, refactors |
| Code Review | Plan > Develop + Test + Security (parallel) > Report | PR reviews |
| Security Audit | Plan > Security > Report | Vulnerability scanning |
| Feature Eval | Plan > BizDev + Developer > Report | Feasibility and market analysis |
| Quick Fix | Develop > Test > Report | Small bug fixes |

## License

MIT
