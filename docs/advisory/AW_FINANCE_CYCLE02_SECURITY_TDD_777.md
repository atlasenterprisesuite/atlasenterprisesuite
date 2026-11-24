# AW Finance Advisory — Cycle 02: Security-first verification contract

Date: 2026-10-28
Status: IN PROGRESS / NO-GO
Base commit: `6f7bc8bf7ccb4c50afb347281c934b4cf1925786`
Branch: `feat/aw-finance-advisory-cycle02-tdd-777-20261028`
Scope: isolated specification and negative TDD plan. No production data, payments, deploy, merge, or live provider calls.

## Observed evidence
- `docs/advisory/ATLAS_ADVISORY_OFFICE.md` documents organization-scoped persistence, RLS, authenticated RPC writes and a deny-by-default client portal.
- `packages/advisory/src/index.ts` defines `assertAdvisoryScope`, roles, permissions, firm/client/engagement types.
- `apps/web/src/modules/advisory/AdvisoryOfficePage.tsx` currently renders zero counts and empty readiness evidence, not authenticated live metrics.
- Exact base-SHA GitHub commit status: `Vercel – atlas-enterprise-suite-live` = failure; several other Vercel contexts = success. Status is not a proof of production deployment.

## Mandatory negative tests (must fail closed)
1. An unauthenticated request cannot read firm, client, engagement or report records.
2. A user from organization A cannot read or mutate organization B's records, even when supplying B's client, firm or engagement IDs.
3. A member of organization A who lacks membership in firm X cannot read or mutate firm X's records.
4. A revoked or expired member/session loses access on subsequent requests, including cached or replayed requests.
5. A client/client_delegate cannot enumerate or access another client's records within the same firm.
6. A caller cannot select an arbitrary organization via request body, query parameter, header or forged identity claim.
7. Writes with mismatched firm/client/engagement foreign keys are rejected atomically and audited without leaking other tenants' data.
8. A missing, malformed or duplicate idempotency key does not produce duplicate invoice or payment events.
9. Service-role and SECURITY DEFINER paths cannot bypass tenant checks through a browser-accessible endpoint.
10. Unverified integrations and absent financial data render unavailable/unknown, never success, paid, signed, shipped or real revenue.
11. Audit events are immutable to ordinary users and never expose sensitive payroll/tax values in logs.
12. Unauthorized approval cannot trigger payroll, tax filing, bank transfer or external communications.

## Positive verification gates
- Inspect exact file/function implementations, migration history, grants, RLS policies and RPC execution context before running tests.
- Execute focused tests only in a confirmed isolated environment without production credentials or external network effects.
- Verify typecheck and relevant CI on the exact branch HEAD SHA.
- Compare actual authenticated records with dashboard aggregates; replace hard-coded metrics only after permission and data-source tests pass.
- Validate Accounting/AR bridge against canonical ledger, with replay and cross-tenant tests.
- Verify deployed exact-SHA and production HTTP/E2E separately. Never infer release readiness from a merged PR or unrelated deployment status.

## Release decision
NO-GO until every P0 security gate, exact-SHA CI, build, deployment and E2E check has documented GREEN evidence. This file is a test contract, not a claim that the tests have run.
