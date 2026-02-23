Execute a **Multi-Agent Code Review** on the current changes.

$ARGUMENTS

## Steps

1. Identify what changed — run `git diff` and `git status` to understand the scope.

2. Spawn THREE agents IN PARALLEL via the Task tool (they don't depend on each other):

   **Developer reviewer** (`subagent_type: "general-purpose"`):
   "You are a senior engineer reviewing code. Check architecture, code quality, React patterns, TypeScript usage, and Tailwind conventions. Flag issues by severity. Read CLAUDE.md for project standards."

   **Test reviewer** (`subagent_type: "general-purpose"`):
   "You are a QA engineer. Check if tests exist for changed code. Run `npm test`. Verify test quality — are edge cases covered? Are tests testing behavior, not implementation?"

   **Security reviewer** (`subagent_type: "general-purpose"`):
   "You are a security engineer. Review changed files for XSS, injection, secrets exposure, unsafe patterns. Run `npm audit`. Read-only — do NOT modify code."

3. Synthesize findings into a unified review:
   - **Code Quality**: findings from developer reviewer
   - **Test Coverage**: findings from test reviewer
   - **Security**: findings from security reviewer
   - **Verdict**: APPROVE / REQUEST CHANGES / BLOCK with rationale
