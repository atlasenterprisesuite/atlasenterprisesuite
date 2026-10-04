# ATLAS WhatsApp AI Council Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed, provider-neutral WhatsApp orchestration core where ChatGPT is the only final synthesis authority and Peach is an adapter, not the brain.

**Architecture:** Extend `@atlas/core` with focused orchestration primitives rather than creating a new service before the transport is proven. Normalize inbound WhatsApp events, enforce allowlists and idempotency, collect advisory outputs, and refuse to emit an ATLAS decision unless a ChatGPT final synthesis is present.

**Tech Stack:** TypeScript, Vitest, existing npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-whatsapp-ai-council-design.md`

## Global Constraints

- ChatGPT is always the final synthesis authority for ATLAS development.
- Advisory model output is never an ATLAS decision by itself.
- Provider secrets are not committed to Git.
- WhatsApp transport stays behind an adapter boundary.
- Duplicate inbound events must not create duplicate ATLAS actions.
- Unauthorized conversations must not trigger ATLAS.
- The integration must not be reported as live until a real inbound and outbound WhatsApp E2E succeeds.
- The Peach MCP endpoint is configuration, never a hard-coded production secret or authority source.

## Review Focus

- Duplicate delivery of the same provider message ID must be rejected without a second decision.
- An advisory-only run must never finalize an ATLAS decision.
- Empty or malformed inbound text must fail normalization rather than create an action.
- An unallowlisted WhatsApp source must fail closed.
- Provider failure must not transfer final authority away from ChatGPT.

---

### Task 1: Inbound event normalization and authorization

**Files:**
- Create: `packages/core/src/whatsapp-ai-council.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/unit/whatsapp-ai-council.test.ts`

**Interfaces:**
- Produces: `normalizeWhatsAppEvent(input)`, `authorizeWhatsAppSource(event, allowlist)`, `NormalizedWhatsAppEvent`.
- Consumes: none.

- [ ] Write failing unit tests for normalized valid events, malformed text, and unauthorized sources.
- [ ] Run `npm test -- tests/unit/whatsapp-ai-council.test.ts`; expected RED because module/API does not exist.
- [ ] Implement the minimal types and functions.
- [ ] Run the focused test; expected PASS.
- [ ] Run `npm test`; expected full suite PASS.
- [ ] Commit.

### Task 2: Idempotency and final-authority gate

**Files:**
- Modify: `packages/core/src/whatsapp-ai-council.ts`
- Test: `tests/unit/whatsapp-ai-council.test.ts`

**Interfaces:**
- Consumes: `NormalizedWhatsAppEvent`.
- Produces: `MessageDeduplicator`, `finalizeAtlasDecision(input)`, `AtlasCouncilDecision`.

- [ ] Add failing tests for duplicate provider IDs, advisory-only runs, and a valid ChatGPT-finalized decision.
- [ ] Run focused test; expected RED on missing APIs.
- [ ] Implement minimal in-memory deduplication and final-authority gate.
- [ ] Run focused test; expected PASS.
- [ ] Run `npm test`; expected full suite PASS.
- [ ] Commit.

### Task 3: Provider-neutral Peach adapter configuration contract

**Files:**
- Create: `packages/core/src/whatsapp-provider.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/unit/whatsapp-provider.test.ts`

**Interfaces:**
- Consumes: external provider configuration.
- Produces: `WhatsAppProviderConfig`, `createPeachProviderConfig(env)`, `WhatsAppProviderAdapter`.

- [ ] Write failing tests proving the MCP endpoint is supplied by configuration and invalid/non-HTTPS endpoints are rejected.
- [ ] Run focused test; expected RED because module/API does not exist.
- [ ] Implement the minimal adapter contract and Peach config factory without credentials in source.
- [ ] Run focused test; expected PASS.
- [ ] Run `npm test`; expected full suite PASS.
- [ ] Commit.

### Task 4: Verification and production-state truth

**Files:**
- Create: `docs/integrations/whatsapp-ai-council-status.md`
- Test: existing suite.

**Interfaces:**
- Consumes: Tasks 1–3 and real Peach/WhatsApp evidence.
- Produces: explicit state record.

- [ ] Document code/test state separately from external E2E state.
- [ ] Record current external evidence: Peach MCP accessible; outbound WhatsApp observed by user; inbound Peach MCP retrieval still unverified/empty.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Do not mark `end_to_end_verified` or `production_enabled` unless a real inbound event and reply are independently observed.
- [ ] Commit.
