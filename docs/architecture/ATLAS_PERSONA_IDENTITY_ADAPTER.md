# ATLAS Identity — Persona proofing adapter | 777 REVIEW

**Status: adapter implementation only. Not connected, not production-ready. P0 NO-GO.**

Repository contract: packages/compliance/persona.ts. No new sign-in system: ATLAS Supabase Auth, organization membership, RBAC and audit remain the source of truth. A ChatGPT/other organization's inquiry ID or verification URL must never be reused in ATLAS.

## End-to-end contract and next implementation boundary

1. Enrollment (blocked until ATLAS-owned Persona Sandbox account and approved credentials exist): authenticated ATLAS actor, active organization, explicit permission and consent. Server pre-creates an inquiry for the configured template and persists an opaque, tenant-scoped link between inquiry, subject, organization, purpose, environment and policy version. Never let the browser choose a template or another person's inquiry.
2. Client flow (not yet wired): open the Persona-hosted page or properly pinned SDK for this ATLAS-created inquiry. Browser onComplete is only a UI hint; it is not an identity decision.
3. Webhook (pure adapter implemented): call ONLY `verifyAndResolvePersonaInquiryEvent` with the untouched raw body, `Persona-Signature` header, server-only secret and server-owned inquiry/reference/template binding. The API validates the HMAC and 5-minute timestamp tolerance before returning a decision; the unsigned parser is intentionally private. Rotating signatures are accepted; missing/bad HMACs fail closed.
4. Durable ingestion (not yet wired): unique provider event ID, monotonic ordering by event creation time, idempotent atomic transaction, tenant-scoped mapping, audit and outbox. Respond 2xx only after durable acceptance. Unknown or stale events may not modify proofing decisions.
5. Authorization (separate): approved Persona inquiry may mark a *specific* proofing requirement satisfied. It must never issue an ATLAS session, elevate permissions, bypass MFA, authorize financial movement or automatically restore Ride eligibility. A manual review and tenant policy may still be required.
6. Sensitive data: no documents, face images, raw webhook bodies, birth dates or biometrics in application logs or ATLAS data tables. Configure appropriate retention/deletion, legal notices, consent, vendor agreement and special handling for minors.

## Verifiable scope

Unit coverage: signature success, forged signatures, body tamper, replay, future timestamp, secret rotation; unsigned/forged approvals rejected by the only public verdict API; status distinctions and cross-subject/inquiry/template mismatch. Synthetic fixtures only.

The server must not serialize, log or expose the raw Persona payload; it can contain sensitive attributes. `PersonaVerifiedEvent` is only a provider proofing result, never a session or permission grant. For historical events, persist provider event ID and `data.attributes.created-at` to enforce idempotency and event ordering after the provider account is configured.

Local check command: npx vitest run tests/unit/persona-verification.test.ts

**Outstanding P0 controls:** ATLAS-owned sandbox onboarding and pricing approval; backend query/migration with real tenant isolation and least-privilege RLS; authenticated API endpoints; safe webhook durable queue; provider sandbox verification; exact-SHA CI; independent security review; privacy/legal approval; E2E and production readiness verification. Do not merge/deploy as ready before these controls pass.

Persona 2026-09-29 docs:
- https://docs.withpersona.com/webhooks-best-practices
- https://docs.withpersona.com/2026-09-29/tutorial-embedded-flow-inquiry-template
- https://docs.withpersona.com/2026-09-29/api-reference/inquiries

## CI evidence ledger

- Previous scope SHA `0a11b64a43f302932d9232d4a05342ad1a25475c`: GitHub checks green; build readiness, typecheck, unit/integration suites and CodeQL passed. Specifically 8 Persona unit tests, 1,553 total unit and 998 integration tests passed in the reported CI logs.
- New signed-only API changes: CI on the newest commit must be checked separately; **do not transpose previous SHA evidence**.
