# ATLAS Monetization Engine 777 — Phase F1

Status: **candidate / NOT PRODUCTION READY**. Date: 2026-11-18.

## Reuse inventory
- Existing `packages/commerce` implements cart, server pricing, checkout, payment gating and order state.
- `supabase/functions/atlas-commerce` exposes governed commerce operations.
- `packages/creator/content_intelligence.ts` supplies editorial drafts and distribution seeds.
- No new store, checkout provider, tenant table or provider subscription is necessary for this phase.

## Delivered scope
- Pure `evaluateDigitalProductLaunch()` evidence evaluation in `packages/commerce/src/digital-product-gate.ts`.
- Verifies tenant match, product/version identity, timestamp shape and <= request time, HTTPS provenance pointers and four verified categories: demand, rights, quality and approval.
- Missing/invalid evidence => `NO_GO`; locally satisfied assertions => `REVIEW_REQUIRED`, **never `GO`**.
- `executable: false` always: not a publishing/payment/authorization mechanism.
- Unit tests: `tests/unit/digital-product-gate.test.ts`.

## Trust boundary
`verified: true` is caller-provided and **NOT proof** of verification. Before any external operation, an authenticated server must verify source provenance and evidence digests, signed approvals, tenant entitlements/RLS, asset rights, audit trail and idempotent payment and publication state. Do not expose this evaluator as a permission to publish.

## Required gates
1. CI exact-head `npm run verify:all`, P0 security scan and reviewer approval.
2. Server-side verified evidence persistence with RLS, RBAC, revocation and lineage.
3. Sandbox commercial E2E with tenant isolation, payment truth, refunds and delivery.
4. Explicit launch authorization, deployment attestation, production exact-SHA and E2E.
5. Until all gates have evidence: **P0 NO-GO; do not merge or deploy**.

## Next slice
Connect evidence records to existing creator and commerce entities through a server API with verified provenance, implement tests for multi-tenant isolation and replay/idempotency. Product pilot: bilingual small-business finance starter kit; no actual demand or revenue claim.
