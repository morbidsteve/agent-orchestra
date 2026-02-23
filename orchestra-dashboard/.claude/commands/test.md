Execute the **Test Suite** workflow to analyze and improve test coverage.

$ARGUMENTS

## Steps

1. Spawn tester agent (`subagent_type: "general-purpose"`):
   "You are a QA engineer. Analyze test coverage for the orchestra-dashboard project:
   - Run `npm test` to see current test status
   - Run `npm run test:coverage` for coverage report
   - Identify untested components and modules
   - Find missing edge case tests
   - Find missing integration tests
   - Prioritize gaps by risk (business-critical paths first)
   Use Vitest + React Testing Library. Follow the project's testing conventions from CLAUDE.md."

2. Have the tester agent write tests to close the most critical gaps.

3. Run the full suite again to verify:
   - `npm test` passes
   - Coverage improved
   - No regressions

4. If any new tests fail, spawn a developer agent to determine if it's a test issue or a real bug.

5. Report:
   - Coverage before/after
   - Tests added (count and which components)
   - Any bugs discovered
   - Remaining untested paths
