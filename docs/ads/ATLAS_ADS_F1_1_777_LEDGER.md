# ATLAS Ads Intelligence — F1.1 evidence ledger

Date: 2026-11-02
Base main SHA (observed): e84d93d8e6d3a2f17da3fbbbe8c5d6ea8ee30b12
Scope: predeploy, documentation and TDD contract only. NO-GO.

## Reuse evidence
- packages/advisory/src/providerReadiness.ts: paid_media authorization, verified provider state and revocation vocabulary.
- packages/core/src/crm.ts: CRM provider contracts and typed records.
- packages/commerce/src/integrations.ts: adapter interface, explicit unavailable adapters and delivery state machine.
- packages/analytics/src/index.ts: source provenance, demo vs verified, gated metrics.
- packages/core/src/permissions.ts: canonical permission types; Ads permission requires separate design and server enforcement.
- apps/web/src/modules/registry.ts and apps/web/src/assistant/routeContext.ts: Revenue Operations registration and /revenue route.
- package.json: Vitest unit/integration and typecheck scripts (not executed in this phase).

## Design contract
Ads owns campaign drafts, creatives, audience eligibility references, budget ceilings, approval and idempotency keys. CRM owns contacts/leads; Commerce owns sales/orders; Analytics owns metrics and provenance; Advisory Provider Readiness owns verified external paid-media capability. No new identity store or analytics silo. External publish/spend disabled by default.

## TDD cases (all pending execution)
- ADS-01: cross-tenant read/write denied.
- ADS-02: user without publish permission denied.
- ADS-03: unverified or revoked paid_media provider denied.
- ADS-04: spend exceeding approved ceiling denied.
- ADS-05: authorization revoked mid-session denied at execution time.
- ADS-06: duplicate idempotency key cannot publish or charge twice.
- ADS-07: demo/unverified analytics cannot be presented as live.
- ADS-08: provider error preserves auditable failure and does not claim success.
- ADS-09: concurrent budget reservations cannot exceed ceiling.
- ADS-10: organization change invalidates previous authorization context.

## P0 gates
- Verify current branch HEAD after commit; check CI on exact SHA.
- Inspect real RevOps implementation, server auth/RLS schema and existing test fixtures before code changes.
- Add failing tests, implement minimal isolated code, run unit/integration/typecheck and negative PG17 RLS tests.
- Confirm external authorization, spend approval and audit evidence before any provider activation.
- No merge, deployment, secrets, charges or production writes.

## Evidence status
Documentation authored only; no tests executed; no CI certified; no production claims. P0 NO-GO.
