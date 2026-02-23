# Agent Orchestra — Setup Guide

## Quick Start

### 1. Install

```bash
cd agent-orchestra
pip install -r requirements.txt
```

You'll need an Anthropic API key:
```bash
export ANTHROPIC_API_KEY=your-key-here
```

### 2. Configure Your Project

Copy the CLAUDE.md template to your project root and fill it in:
```bash
cp CLAUDE.md.template /path/to/your/repo/CLAUDE.md
```

This file is how all agents learn your project's conventions, tech stack, and standards.

### 3. Run from the Terminal

```bash
# Full development pipeline (plan → build → test → security review)
python orchestrator.py "Build a REST API for user management with CRUD endpoints"

# Code review a branch
python orchestrator.py --workflow=code-review --target=feature/auth --repo=/path/to/repo

# Security audit
python orchestrator.py --workflow=security-audit --repo=/path/to/repo

# Evaluate a feature idea (business + technical analysis)
python orchestrator.py --workflow=feature-eval "Add real-time collaboration to the editor"

# Improve test coverage
python orchestrator.py --workflow=test-suite --repo=/path/to/repo "Get coverage to 80%"

# Use a more powerful model for the orchestrator
python orchestrator.py --model=opus "Redesign the authentication architecture"

# Verbose mode to see agent work in real-time
python orchestrator.py -v "Fix the race condition in the payment processor"
```

### 4. Set Up CI/CD (Optional)

Copy the GitHub Actions workflows:
```bash
cp ci/pr-review.yml /path/to/your/repo/.github/workflows/
cp ci/nightly-audit.yml /path/to/your/repo/.github/workflows/
```

Add your API key as a repository secret:
  Settings → Secrets and variables → Actions → New repository secret
  Name: ANTHROPIC_API_KEY

Now every PR gets an automated multi-agent review, and nightly audits will
create issues for any security findings.


## Architecture Overview

```
orchestrator.py          ← Master agent (coordinates everything)
├── agents/
│   ├── developer.py     ← 2 developer agents (primary + secondary)
│   ├── tester.py        ← QA specialist
│   ├── devsecops.py     ← Security engineer
│   └── business_dev.py  ← Product strategist
├── ci/
│   ├── pr-review.yml    ← GitHub Actions: PR review
│   └── nightly-audit.yml ← GitHub Actions: scheduled audit
└── workflows/           ← Custom workflow definitions (extensible)
```

### How It Works

1. You give the orchestrator a task and pick a workflow
2. The orchestrator reads your CLAUDE.md to understand the project
3. It delegates to specialist agents based on the workflow
4. Each agent works in its own isolated context with restricted tools
5. The orchestrator synthesizes results into a final report

### Workflows

| Workflow | Agents Used | When to Use |
|----------|-------------|-------------|
| `full-pipeline` | All 5 | Building features end-to-end |
| `code-review` | dev, tester, devsecops | Reviewing PRs or branches |
| `security-audit` | dev, devsecops | Security assessments |
| `feature-eval` | dev, business-dev | Evaluating what to build next |
| `test-suite` | dev, tester | Improving test coverage |


## Customization

### Adding a New Agent

1. Create a new file in `agents/` following the existing pattern
2. Add it to `build_agent_definitions()` in `orchestrator.py`
3. Add it to relevant workflows in `WORKFLOW_AGENTS`

### Adding a New Workflow

1. Add a prompt to `WORKFLOW_PROMPTS` in `orchestrator.py`
2. Add the agent list to `WORKFLOW_AGENTS`
3. Add the workflow name to the argparse choices

### Adjusting Models Per Agent

Edit the `"model"` field in any agent definition:
- `"haiku"` — Fast and cheap, good for routine tasks (linting, simple tests)
- `"sonnet"` — Balanced, good default for most work
- `"opus"` — Most capable, use for complex architecture and reasoning


## Cost Management

Rough cost guidance (varies by task complexity):

| Workflow | Typical Duration | Approximate Cost |
|----------|-----------------|------------------|
| code-review | 2-5 min | $0.50 - $2.00 |
| security-audit | 3-8 min | $1.00 - $3.00 |
| feature-eval | 2-5 min | $0.50 - $2.00 |
| test-suite | 5-15 min | $2.00 - $5.00 |
| full-pipeline | 10-30 min | $3.00 - $10.00 |

Tips to reduce costs:
- Use `haiku` for the tester agent if your test framework gives clear output
- Use `code-review` workflow for PRs instead of `full-pipeline`
- Only include agents that are needed (the workflow system handles this)
