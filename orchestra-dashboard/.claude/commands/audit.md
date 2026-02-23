Execute a **Comprehensive Security Audit** of this project.

$ARGUMENTS

## Steps

1. Spawn devsecops agent (`subagent_type: "general-purpose"`):
   "You are a DevSecOps security engineer. Perform a full security audit of the orchestra-dashboard project:
   - Scan all source files for hardcoded secrets, API keys, tokens
   - Run `npm audit` for dependency vulnerabilities
   - Check for XSS vectors (dangerouslySetInnerHTML, unsanitized renders)
   - Review any API calls for injection risks
   - Check CORS and CSP configuration
   - Review environment variable handling (VITE_* prefix exposure)
   - Check for sensitive data in localStorage/sessionStorage
   - Rate findings: CRITICAL / HIGH / MEDIUM / LOW / INFO
   Read-only — do NOT modify any code."

2. If complex findings need context, spawn a developer agent to explain the code's intent.

3. Produce the audit report:
   - Executive summary
   - Findings by severity (CRITICAL down to LOW)
   - Specific remediation steps for each finding
   - Prioritized fix order
   - Overall security posture (RED / YELLOW / GREEN)
