"""
Multi-Agent Orchestrator

The master agent that coordinates developer, tester, devsecops, and business-dev
agents. Receives high-level tasks and delegates to specialists based on the work needed.

Usage:
    # Feature development (full pipeline)
    python orchestrator.py "Build a user authentication module with OAuth2 support"

    # Specific workflow
    python orchestrator.py --workflow=security-audit

    # Business analysis
    python orchestrator.py --workflow=feature-eval "Add real-time collaboration"

    # Code review on a PR
    python orchestrator.py --workflow=code-review --target=feature/auth-module
"""

import asyncio
import argparse
import os
import sys
import json
from datetime import datetime
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Agent SDK import — install with: pip install claude-agent-sdk
# ──────────────────────────────────────────────────────────────────────────────
try:
    from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition
except ImportError:
    print("Error: claude-agent-sdk not installed.")
    print("Install with: pip install claude-agent-sdk")
    sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────────
# Import agent definitions
# ──────────────────────────────────────────────────────────────────────────────
from agents.developer import DEVELOPER_PRIMARY, DEVELOPER_SECONDARY
from agents.tester import TESTER
from agents.devsecops import DEVSECOPS
from agents.business_dev import BUSINESS_DEV


# ──────────────────────────────────────────────────────────────────────────────
# Orchestrator system prompts for different workflows
# ──────────────────────────────────────────────────────────────────────────────

WORKFLOW_PROMPTS = {
    "full-pipeline": """You are the chief architect of a multi-agent development system.
You have access to specialized agents that you coordinate to deliver high-quality software.

## Your Agents
- **developer**: Senior engineer for critical-path features
- **developer-2**: Engineer for parallel/independent work
- **tester**: QA specialist for testing and quality validation
- **devsecops**: Security engineer for vulnerability review
- **business-dev**: Product strategist for market and business context

## Your Workflow
For the task given to you, execute this pipeline:

### Phase 1: Planning
- Analyze the task requirements
- If the task involves a new feature, optionally ask business-dev for market context
- Break the work into development tasks
- Decide if work can be parallelized across both developers

### Phase 2: Development
- Assign tasks to developer (and developer-2 if parallelizable)
- Review their output for completeness

### Phase 3: Quality
- Send the completed code to tester for comprehensive testing
- If tests fail, send failures back to the developer for fixes
- Iterate until tests pass

### Phase 4: Security
- Send the final code to devsecops for security review
- If critical/high findings exist, send back to developer for remediation
- Re-review after fixes

### Phase 5: Summary
Produce a final report:
- What was built
- Test results (pass/fail, coverage)
- Security findings and their status
- Any remaining follow-ups

## Guidelines
- Be efficient — don't use agents unnecessarily
- If the task is a simple fix, you might only need one developer and the tester
- Always run tests and security review before declaring done
- Coordinate to avoid file conflicts between parallel developers
""",

    "code-review": """You are a code review coordinator managing specialized reviewers.

## Your Agents
- **developer**: Reviews code quality, architecture, and implementation
- **tester**: Validates test coverage and correctness
- **devsecops**: Reviews security implications

## Your Workflow
1. Identify the files/changes to review (from the target branch or recent commits)
2. Send to all three reviewers IN PARALLEL — they don't depend on each other
3. Synthesize findings into a unified review with severity ratings
4. Provide a clear APPROVE / REQUEST CHANGES / BLOCK recommendation

Keep the review focused and actionable. No nitpicking on style unless it impacts
readability or maintainability.
""",

    "security-audit": """You are a security audit coordinator.

## Your Agents
- **devsecops**: Primary security reviewer
- **developer**: Assists with understanding complex code paths

## Your Workflow
1. Have devsecops perform a comprehensive security audit of the entire codebase
2. For any complex findings, ask developer to explain the code's intent
3. Produce a security audit report with:
   - Executive summary
   - Findings by severity (CRITICAL → LOW)
   - Specific remediation steps for each
   - Prioritized fix order
   - Overall security posture assessment
""",

    "feature-eval": """You are a feature evaluation coordinator.

## Your Agents
- **business-dev**: Market research and strategic analysis
- **developer**: Technical feasibility assessment

## Your Workflow
1. Ask business-dev to analyze the feature's market opportunity, competitive landscape,
   and go-to-market potential
2. Ask developer to assess technical feasibility, estimate complexity, and identify
   architecture implications
3. Synthesize into a feature evaluation:
   - Market opportunity (from business-dev)
   - Technical feasibility (from developer)
   - ICE score (Impact × Confidence × Ease)
   - Recommendation: BUILD / DEFER / INVESTIGATE FURTHER
   - If BUILD: suggested phasing and MVP scope
""",

    "test-suite": """You are a test quality coordinator.

## Your Agents
- **tester**: Writes and runs tests
- **developer**: Provides context on untested code

## Your Workflow
1. Have tester analyze current test coverage across the project
2. Identify gaps — untested modules, missing edge cases, no integration tests
3. Have tester write tests to close the most critical gaps
4. Run the full suite and report results
5. If any new tests fail, coordinate with developer to determine if it's a
   test issue or a real bug
""",
}


def build_agent_definitions(agents_to_include: list[str] | None = None) -> dict:
    """
    Build the agents dict for the Agent SDK.
    Optionally filter to only include specific agents.
    """
    all_agents = {
        "developer": DEVELOPER_PRIMARY,
        "developer-2": DEVELOPER_SECONDARY,
        "tester": TESTER,
        "devsecops": DEVSECOPS,
        "business-dev": BUSINESS_DEV,
    }

    if agents_to_include:
        return {k: v for k, v in all_agents.items() if k in agents_to_include}
    return all_agents


# Map workflows to the agents they need (avoids loading unused agents)
WORKFLOW_AGENTS = {
    "full-pipeline": None,  # All agents
    "code-review": ["developer", "tester", "devsecops"],
    "security-audit": ["developer", "devsecops"],
    "feature-eval": ["developer", "business-dev"],
    "test-suite": ["developer", "tester"],
}


async def run_orchestrator(
    task: str,
    workflow: str = "full-pipeline",
    target: str | None = None,
    repo_path: str = ".",
    model: str = "sonnet",
    verbose: bool = False,
):
    """
    Run the multi-agent orchestrator.

    Args:
        task: The high-level task description
        workflow: Which workflow to use (full-pipeline, code-review, etc.)
        target: Optional target (branch name, file path, etc.)
        repo_path: Path to the repository to work on
        model: Model for the orchestrator (agents use their own configured models)
        verbose: Print detailed agent output
    """
    # Build the orchestrator prompt
    system_prompt = WORKFLOW_PROMPTS.get(workflow, WORKFLOW_PROMPTS["full-pipeline"])

    # Add target context if provided
    task_prompt = task
    if target:
        task_prompt += f"\n\nTarget: {target}"
    task_prompt += f"\n\nRepository path: {os.path.abspath(repo_path)}"

    # Select agents for this workflow
    agent_names = WORKFLOW_AGENTS.get(workflow)
    agents = build_agent_definitions(agent_names)

    # Convert our agent dicts to AgentDefinition objects
    agent_definitions = {}
    for key, agent_config in agents.items():
        agent_definitions[key] = AgentDefinition(
            name=agent_config["name"],
            description=agent_config["description"],
            prompt=agent_config["prompt"],
            tools=agent_config["tools"],
            model=agent_config.get("model", "sonnet"),
        )

    print(f"{'─' * 60}")
    print(f"  Agent Orchestra — {workflow}")
    print(f"  Task: {task[:80]}{'...' if len(task) > 80 else ''}")
    print(f"  Agents: {', '.join(agent_definitions.keys())}")
    print(f"  Model (orchestrator): {model}")
    print(f"  Repo: {os.path.abspath(repo_path)}")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'─' * 60}\n")

    # Run the orchestrator
    result_text = ""
    async for message in query(
        prompt=f"{system_prompt}\n\n## Task\n{task_prompt}",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Task"],
            agents=agent_definitions,
            model=model,
            permission_mode="acceptEdits",
            cwd=os.path.abspath(repo_path),
        ),
    ):
        # Stream output
        if hasattr(message, "content"):
            for block in message.content:
                if hasattr(block, "text"):
                    if verbose:
                        print(block.text)

        if hasattr(message, "result"):
            result_text = message.result

    print(f"\n{'═' * 60}")
    print("  ORCHESTRATOR REPORT")
    print(f"{'═' * 60}")
    print(result_text)
    print(f"{'═' * 60}")
    print(f"  Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═' * 60}\n")

    return result_text


def main():
    parser = argparse.ArgumentParser(
        description="Multi-Agent Development Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Build a feature (full pipeline: dev → test → security)
  python orchestrator.py "Build a REST API for user management"

  # Review code on a branch
  python orchestrator.py --workflow=code-review --target=feature/auth

  # Security audit the whole project
  python orchestrator.py --workflow=security-audit

  # Evaluate a feature idea
  python orchestrator.py --workflow=feature-eval "Add real-time collaboration"

  # Improve test coverage
  python orchestrator.py --workflow=test-suite "Increase coverage to 80%"

Workflows:
  full-pipeline    Full dev cycle: plan → build → test → security review
  code-review      Multi-perspective code review
  security-audit   Comprehensive security assessment
  feature-eval     Business + technical feature evaluation
  test-suite       Test gap analysis and coverage improvement
        """,
    )

    parser.add_argument(
        "task",
        nargs="?",
        default="Analyze the project and provide a health assessment.",
        help="The task to execute (default: project health check)",
    )
    parser.add_argument(
        "--workflow",
        choices=list(WORKFLOW_PROMPTS.keys()),
        default="full-pipeline",
        help="Workflow to execute (default: full-pipeline)",
    )
    parser.add_argument(
        "--target",
        help="Target branch, file, or module for the task",
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Path to the repository (default: current directory)",
    )
    parser.add_argument(
        "--model",
        default="sonnet",
        choices=["haiku", "sonnet", "opus"],
        help="Model for the orchestrator agent (default: sonnet)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print detailed agent output as they work",
    )

    args = parser.parse_args()

    # Verify API key
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable not set.")
        print("Export it with: export ANTHROPIC_API_KEY=your-key-here")
        sys.exit(1)

    asyncio.run(
        run_orchestrator(
            task=args.task,
            workflow=args.workflow,
            target=args.target,
            repo_path=args.repo,
            model=args.model,
            verbose=args.verbose,
        )
    )


if __name__ == "__main__":
    main()
