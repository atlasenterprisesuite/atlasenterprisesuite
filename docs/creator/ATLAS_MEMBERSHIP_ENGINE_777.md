# ATLAS Membership Engine — 777 REVIEW

Status: DESIGN / NOT PRODUCTION VERIFIED. No live payments enabled.

## Existing reuse targets (verify implementation before wiring)
- packages/pay/src/index.ts: provider and environment contracts
- packages/creator/types.ts: creator permissions
- apps/web/src/services/atlas-max/entitlements.ts: entitlement state patterns
- apps/web/src/lib/atlasSession.ts: authenticated organization context
- Supabase RLS and Edge Functions; ATLAS Evidence Engine

## Acceptance criteria
1. Multi-tenant membership plans belong to a verified creator/organization; server derives identity from JWT, never request body.
2. Pricing, currency, trial length, cancellation, auto-renewal, tax and payout terms are disclosed before explicit checkout consent.
3. Webhook signature is verified against raw body; replayed events are idempotent and out-of-order events cannot restore revoked access.
4. Entitlements are granted only after provider-confirmed payment/trial status, and revoked on cancellation expiry, chargeback or provider suspension as policy requires.
5. Cross-tenant reads and writes are denied by RLS and server-side authorization. Audit events exclude secrets and sensitive payment data.
6. Webhook outage, missing provider credentials, ambiguous status and reconciliation mismatch fail closed for paid access and do not cause duplicate charges.
7. Responsive accessible UI supports keyboard, screen readers, clear error/retry states, and user-managed cancellation.
8. TDD: tests for tenant isolation, duplicate webhook, stale webhook, trial conversion, cancellation, refund, unauthorized premium access, and provider outage.
9. CI passes tests, lint, typecheck, security scans, and migration checks; production release requires exact-SHA, smoke and E2E evidence.

## Rollout gates
P0: authorization/RLS, payment correctness, signature/idempotency, audit, cancellation, exact-SHA. Block merge/deploy when failed.
P1: optional creator analytics and badges can remain warning-only.

## Delivery sequence
Inventory existing routes, schema, tests and billing adapters; write failing tests; implement migration and backend entitlement/webhook services; implement UI; run CI; open review PR; only then seek explicit authorization for merge/deploy. No deployment is authorized by this document.
