# ATLAS Gemini Connected App

## Purpose

Connect Gemini to the existing ATLAS MCP server without introducing a paid browser-automation dependency.

## Runtime contract

ATLAS exposes:

- `GET /integrations/gemini` — redacted readiness descriptor.
- `POST /mcp` — existing governed MCP endpoint.
- `ATLAS_MCP_GEMINI_TOKEN` — server-side Gemini credential. It must never be returned by the readiness endpoint or written to client-side logs.
- `ATLAS_PUBLIC_ORCHESTRATOR_URL` — HTTPS public origin used to derive the MCP URL.

The readiness endpoint reports one of:

- `configuration_missing`
- `runtime_not_ready`
- `ready_for_authorization`

It always reports `connected: false` and `verified: false`. Only authenticated evidence from Gemini may advance those states in a future connection ledger.

## Gemini setup

Gemini custom Connected Apps accept an MCP server URL. ATLAS intentionally does not advertise Dynamic Client Registration yet. Use Gemini's Advanced features credential flow with the authorized ATLAS Gemini credential.

The MCP URL is the `mcpUrl` returned by `GET /integrations/gemini`.

## Security

- Do not expose `ATLAS_MCP_GEMINI_TOKEN` in the web UI, repository, screenshots, CI logs, or public diagnostics.
- Gemini maps to the registered `atlas-gemini-analyst` actor and must remain least-privilege.
- A healthy HTTP route is not proof that Gemini is connected.
- Do not report `Connected` or `Verified` until Google completes authorization and ATLAS has corresponding runtime evidence.
- Write-capable tools remain governed by ATLAS permissions and approval policy.

## Verification

1. `/readyz` must be ready.
2. `/integrations/gemini` must return `ready_for_authorization`.
3. The response must contain an HTTPS `mcpUrl` ending in `/mcp`.
4. The response must not contain the Gemini token.
5. Connect the URL in Gemini Connected Apps and complete Google authorization.
6. Run an MCP `initialize`, `tools/list`, and a least-privilege read call.
7. Only then record authenticated connection evidence.
