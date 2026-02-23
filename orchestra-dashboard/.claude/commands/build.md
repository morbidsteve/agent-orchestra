Execute the **Full Pipeline** workflow for the following task:

$ARGUMENTS

## Pipeline Steps

1. **Plan** — Analyze the task. Break into development units. Identify files to create/modify. Decide if work can be parallelized across two developer agents.

2. **Develop** — Spawn developer agent(s) via the Task tool with `subagent_type: "general-purpose"`. Give them specific file paths and clear requirements. Tell them: "You are a senior software engineer. Read CLAUDE.md for project conventions. Use React 19, TypeScript strict, Tailwind CSS 4, and follow the project structure."

3. **Test** — Spawn tester agent: "You are a QA engineer. Write tests using Vitest + React Testing Library. Run `npm test` and report results. Every new component needs a test file." If tests fail, send failures back to the developer agent with the actual error output. Iterate up to 3 times.

4. **Security** — Spawn devsecops agent: "You are a security engineer. Review the code changes for XSS, injection, exposed secrets, and dependency vulnerabilities. Run `npm audit`. Do NOT modify code — report findings only." If critical/high findings, send back to developer for fixes.

5. **Report** — Summarize: what was built, files changed, test results (pass/fail count), security findings and status, any remaining follow-ups.

## Rules
- Delegate ALL implementation work to sub-agents via Task tool
- Quality gates: tests pass, no critical security findings, TypeScript compiles, ESLint passes
- Iterate on failures — max 3 loops before escalating to user
