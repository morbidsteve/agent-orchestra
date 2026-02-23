Execute a **Feature Ideation** session for the Orchestra Dashboard.

$ARGUMENTS

## Steps

1. Spawn business-dev agent (`subagent_type: "general-purpose"`):
   "You are a product strategy expert. Brainstorm feature ideas for the Orchestra Dashboard — a web UI for AI-powered multi-agent development systems. The target users are engineering teams who want visibility into their AI agent workflows.

   Research and ideate:
   - What do developers want from AI development tool dashboards? Search for user feedback, forum discussions, and product reviews of similar tools.
   - What are the gaps in existing tools (GitHub Copilot Workspace, Cursor, Devin)?
   - What would make this dashboard indispensable for an engineering team?

   Generate 5-7 feature ideas. For each, provide:
   - Name and one-line description
   - User problem it solves
   - ICE score (Impact x Confidence x Ease, each 1-10)
   - Priority ranking

   Sort by ICE score descending. Be specific and actionable."

2. Spawn developer agent (`subagent_type: "general-purpose"`):
   "You are a senior React/TypeScript engineer. Read the current orchestra-dashboard codebase and suggest 3-5 technical improvements or features that would make the codebase better. Consider: performance, developer experience, architecture, missing infrastructure. Be specific about what you'd build and why."

3. Synthesize:
   - Combined ranked list of ideas (business + technical)
   - Top 3 recommendations with rationale
   - Suggested build order
