# ATLAS WhatsApp AI Council — Verification Status

Last updated: 2026-09-29
Branch: `feature/atlas-whatsapp-ai-council`
Implementation PR: #559

## Truth states

| State | Status | Evidence |
| --- | --- | --- |
| designed | complete | Approved design spec is in the canonical repository. |
| provider_authorization_pending | cleared | Peach for WhatsApp Business is installed/enabled in ChatGPT and its MCP tools are callable. |
| configured | partial | Provider-neutral config contract exists. The Peach endpoint is supplied through `ATLAS_PEACH_MCP_URL`; no credentials or endpoint are committed as a secret. |
| integration_tested | pending CI | Unit contracts are implemented on the feature branch; canonical GitHub CI must finish successfully before this state can be promoted. |
| end_to_end_verified | **not verified** | Peach outbound messaging was observed by the user, but inbound WhatsApp messages were still returning zero rows through the Peach MCP during the last live checks. |
| production_enabled | **not enabled** | Requires green CI plus authenticated inbound→ChatGPT final synthesis→outbound WhatsApp evidence. |

## Implemented code gates

- Inbound event normalization rejects blank required fields.
- Source allowlist fails closed.
- Duplicate provider message IDs are rejected by the deduplication gate.
- Gemini, Copilot, and other advisory outputs cannot independently create an ATLAS decision.
- A ChatGPT final synthesis is mandatory to emit an `AtlasCouncilDecision`.
- Peach transport configuration is provider-neutral and HTTPS-only.
- Peach MCP URL comes from `ATLAS_PEACH_MCP_URL`; secrets are not stored in source.

## External channel evidence

Observed:
- ChatGPT can invoke Peach MCP tools.
- User reported receiving a Peach-originated WhatsApp message, demonstrating at least one outbound Peach→WhatsApp path.

Not yet observed through the authenticated MCP:
- An inbound WhatsApp message for the target ATLAS conversation.
- A real conversation ID that can be replied to by ATLAS.
- A full inbound→ATLAS→ChatGPT-final→outbound round trip.

## Production gate

Do not label this integration `live`, `connected`, `end_to_end_verified`, or `production_enabled` until all of the following are evidenced:

1. GitHub unit, integration, typecheck, security/audit, and build gates are green.
2. A real inbound WhatsApp message is visible through the authorized Peach connection.
3. ATLAS processes that event once (duplicate replay creates no second action).
4. ChatGPT emits the final synthesis.
5. The final response is delivered to the originating WhatsApp conversation.
6. Audit/provenance data records the provider, message ID, run ID, authority, and delivery result.
