Execute the **Bug Fix Pipeline** for the following issue:

$ARGUMENTS

## Steps

1. **Investigate** — Spawn developer agent (`subagent_type: "general-purpose"`):
   "You are a senior engineer. Investigate this bug in the orchestra-dashboard project:
   - Read the relevant source files
   - Reproduce the issue if possible (check tests, try to understand the code path)
   - Identify the root cause
   - Propose a fix
   - Implement the fix
   - Write a regression test that would have caught this bug
   Follow project conventions from CLAUDE.md."

2. **Test** — Spawn tester agent (`subagent_type: "general-purpose"`):
   "You are a QA engineer. The developer just fixed a bug. Run `npm test` to verify:
   - The regression test passes
   - No existing tests broke
   - Edge cases around the fix are covered"

3. **Security check** — If the bug was in a security-sensitive area, spawn devsecops:
   "You are a security engineer. A bug was just fixed. Review the fix for security implications. Could the original bug have been exploited? Does the fix introduce new vulnerabilities?"

4. Report: root cause, fix applied, test results, security status.
