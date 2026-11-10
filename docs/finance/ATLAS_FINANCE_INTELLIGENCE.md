# ATLAS Finance Intelligence

Status: implementation branch `feature/atlas-finance-ai-native`

## Product rule

ATLAS Finance Intelligence is an independent ATLAS implementation of modern AI-native accounting workflows. It may reproduce useful functional patterns, but it must not copy third-party source code, trademarks, proprietary model weights, private APIs, copyrighted visual assets, or confidential data.

## Production baseline

The canonical implementation extends the existing ATLAS Finance and Accounting architecture. It does not create a parallel ledger.

Verified existing production foundations include:

- Supabase organization-scoped persistence and RLS-backed Finance reads.
- Double-entry journal validation and governed posting.
- Accounting period close and lock controls.
- Audit triggers and accounting permission checks.
- AP and AR workspaces.
- Budgeting, multicurrency, intercompany and consolidation foundations.
- Bank-account and reconciliation records.
- Finance Control Center using authenticated organization context.
- Truthful unavailable states instead of fabricated financial data or provider readiness.

The earlier browser-local-storage prototype remains historical prototype scope only. Production Finance work must use the canonical server-side contracts.

## Phase 2 completion contract

Phase 2 is complete only when all of the following are evidenced on this branch and, after review, on `main`:

1. Tenant and organization isolation is enforced by server-side RLS and authorization.
2. Sensitive accounting mutations require explicit RBAC permissions.
3. Posted journals are balanced and protected from silent mutation; corrections use governed reversal/adjustment flows.
4. Closed or locked periods reject ordinary posting and preserve a traceable close/reopen/adjustment history.
5. Audit evidence exists for sensitive accounting writes.
6. Source records and attachments preserve provenance rather than inventing evidence.
7. Trial balance, P&L and balance sheet are derived server-side from posted accounting truth.
8. Finance UI reads the canonical server persistence and never substitutes fabricated balances.
9. Capability and health surfaces report only genuinely available dependencies.
10. Migration away from prototype local persistence is controlled and does not silently merge tenant data.
11. Focused tests, typecheck, full tests and production build pass.
12. Production readiness is not claimed until CI and deployed route/health verification pass.

## AI-native controls

- AI may classify, suggest, detect, explain and draft.
- AI suggestions expose confidence and source evidence.
- Low-confidence or contradictory items remain in review.
- AI cannot silently post, pay, reopen a period, delete accounting evidence, or fabricate a source document.
- Reviewer feedback may improve future suggestions but never weakens accounting controls.
- Every agent action is organization-scoped, permission-scoped, auditable and reversible where the accounting model permits it.

## Service contracts

`/api/finance/capabilities` must describe implemented and enabled Finance capabilities without synthetic readiness.

`/api/finance/health` must reflect real Finance dependencies and must not return a synthetic green state when a required dependency is unavailable.

## Execution order

1. Reuse and harden existing Supabase accounting persistence.
2. Verify RLS and RBAC coverage for Finance tables and RPCs.
3. Verify period locks, reversal and immutable-posting controls.
4. Verify audit coverage and evidence provenance.
5. Complete server-derived financial statements where gaps remain.
6. Connect remaining Finance Intelligence UI to canonical persistence.
7. Add capability/health contracts and focused release tests.
8. Run repository validation and open a PR to `main`.
9. Merge/deploy only after required checks and production verification succeed.

## Non-negotiable accounting controls

- Every posting balances debits and credits.
- AI suggestions expose confidence and source evidence.
- Low-confidence classifications stay in review.
- Payments, destructive changes and period reopenings require explicit authorization.
- Closed-period changes create a traceable adjustment or reopening event.
- No fabricated balances, transactions, vendors, statements or reconciliations.
- Tenant data never crosses organization/entity boundaries.
