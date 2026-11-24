# ATLAS Cloudflare MCP integration — security contract

Status: DESIGN ONLY. This document does not grant access or activate any Cloudflare operation.

## Scope
- Connect to the official Cloudflare MCP endpoint through user-authorized OAuth.
- Default to discovery and read-only diagnostics; no implicit trust of remotely advertised tools.
- Explicit allowlist for each read-only tool after manual review of its schema and effects.
- Never allow deployment, DNS writes, WAF changes, secret reads, token issuance, or account mutation in diagnostic mode.
- Store tokens only in an approved secret store; never in source, logs, browser bundles, or pull requests.
- Fail closed on missing authorization, endpoint mismatch, expired tokens, ambiguous permissions, or unknown tools.
- Record request IDs, timestamp, actor, tool name and sanitized outcome; redact credentials and sensitive payloads.
- Require automated negative tests for blocked write actions, unknown tools, missing auth and unexpected endpoint.
- Require CI success and exact-SHA production verification before a separately authorized deployment.

## Acceptance gates
1. OAuth login and revocation are validated in a nonproduction environment.
2. Read-only tool schemas and scopes are reviewed and pinned.
3. No MCP tool execution is allowed by default until the allowlist is approved.
4. Security and regression tests pass.
5. Human owner approves any production deployment separately.

Do not equate MCP connectivity with Cloudflare account authorization or production verification.
