Execute a **Feature Evaluation** for the following feature idea:

$ARGUMENTS

## Steps

1. Spawn business-dev agent (`subagent_type: "general-purpose"`):
   "You are a product strategy expert. Evaluate this feature for the Orchestra Dashboard — a web UI for AI-powered multi-agent development systems. Analyze:
   - Market demand: Do developers need this? Search for similar tools and user feedback.
   - Competitive landscape: How do GitHub Copilot Workspace, Cursor Composer, Devin handle this?
   - Strategic fit: Does this make the dashboard more valuable to engineering teams?
   - Go-to-market: How would we position this feature?
   Provide an ICE score (Impact x Confidence x Ease, each 1-10)."

2. Spawn developer agent (`subagent_type: "general-purpose"`):
   "You are a senior React/TypeScript engineer. Assess technical feasibility of this feature:
   - Architecture impact: What components/modules need to change?
   - Complexity estimate: How many files, what patterns?
   - Dependencies: Any new libraries needed?
   - Risks: What could go wrong technically?
   Read the current codebase to give an informed assessment."

3. Synthesize into a feature evaluation:
   - Market opportunity (from business-dev)
   - Technical feasibility (from developer)
   - Combined ICE score
   - Recommendation: **BUILD** / **DEFER** / **INVESTIGATE FURTHER**
   - If BUILD: suggested MVP scope and phasing
