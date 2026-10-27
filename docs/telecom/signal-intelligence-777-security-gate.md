# Signal Intelligence 777 — Security gate and provider contract

Baseline: cb3bc62c4fbfda321bb45f206486f98ba2ebe35e. Status: P0 BLOCKED, static-only. No live provider, database migration, or production traffic.

## Reuse
- Carrier Control Plane is the mandatory boundary between Connect and telecom providers.
- Reuse packages/core/src/evidence.ts for evidence evaluation.
- Reuse the server-authenticated Supabase pattern in supabase/functions/atlas-creator/_shared/context.ts, including auth.getUser and active organization_members; do not trust client-supplied role, user ID, permissions, or tenant.
- Existing public.audit_logs is shared; verify actual DDL, policies, constraints and privileges before writing a migration. No new audit_logs schema is assumed.

## P0 findings in initial MVP
1. analyzeSignal accepts a caller-constructed SignalContext. This is only safe as an internal pure function after server-side authorization; never expose it directly.
2. ProviderEvidence booleans and source strings are caller-controlled. They are not authenticated provider responses; fail closed and never label as verified from a client payload.
3. No durable audit, consent, retention, RLS, or transactional atomicity exists yet.
4. Prefix is not location, identity or current carrier; never claim live origin or subscriber.
5. Existing Vitest configuration loads jsdom and tests/setup.ts; inspect transitive hooks before running tests. Root postinstall executes scripts/install-render-local-ai.mjs; do not install dependencies without reviewing it.
6. The original regex matches 'paths have ever crossed' but not 'our paths have ever crossed' reliably? Explicitly test variants and avoid assuming NLP confidence.
7. Never put raw SMS, subscriber identity claims or phone numbers into audit logs.

## Provider adapter — design only, disabled
interface AuthorizedLookupAdapter {
  readiness(): Promise<{authorized: boolean; contracted: boolean; noCharge: boolean}>;
  lookup(e164: string, orgId: string, requestId: string): Promise<{
    lineType?: string; carrier?: string; spamReport?: boolean;
    provider: string; providerReference: string; observedAt: string;
  }>;
}
Gate: server-only credentials; allowlisted endpoint and provider; explicit contractual entitlement; budget=0; network disabled until all gates pass. A demo adapter must return providerStatus=not_connected, never verified.

## Required negative TDD before live integration
- expired/revoked membership; spoofed actor/role/organization; cross-tenant access
- invalid and premium-rate numbers; Unicode control characters; oversized SMS
- provider response spoofing; replay; forged timestamps; expired evidence; forged webhook
- simultaneous requests with same idempotency key; audit write failure rolls back investigation
- service-role leakage; missing consent; retention expiry; rate-limit and enumeration attempts
- SMS never sent to external providers without separate authorization; no GPS/camera tracking

## Transactional SQL — NOT YET AUTHORIZED
After verifying actual organization_members and audit_logs definitions: add tenant-scoped investigation records and consent receipts, RLS deny-by-default, server-only transactional RPC that rechecks auth.uid(), active membership and permissions inside the transaction, inserts investigation and audit atomically, and returns only redacted evidence. Test under isolated ephemeral PostgreSQL; rollback on any error.

## Acceptance
P0 remains open until verified auth integration, provider provenance, transactional persistence, negative tests, isolated Vitest/typecheck, exact-SHA CI, and E2E. No merge/deploy or paid lookup.
