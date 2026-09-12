# ATLAS Hospitality Wallet Hotel Key — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to execute this master plan. Use an isolated worktree on `feat/hospitality-wallet-hotel-key`, TDD for every behavior change, and independent spec + quality review after every task. Do not merge or deploy production without explicit approval.

**Goal:** Deliver the approved ATLAS Hospitality Wallet Hotel Key architecture in three dependency-ordered milestones while preserving the existing production Hospitality access system and failing closed whenever an external PMS/access/wallet contract is not verified.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`

**Execution branch:** `feat/hospitality-wallet-hotel-key`

## Mandatory execution order

### Milestone A — Core domain, persistence, policy, idempotency

Execute completely:

`docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-key-core.md`

Tasks: 5.

Exit gate:

```text
domain/permissions/policy tests green
→ six new tables + credential extensions defined with RLS
→ shared service repository + service audit defined
→ authenticated wallet-core reads defined
→ full repository gate green
```

Do not apply the migration to production at this milestone unless a separate deployment approval is given. Do not start Milestone B on a red branch.

### Milestone B — PMS connector registry, OPERA/OHIP, secure ingestion, stay projection

Execute completely:

`docs/superpowers/plans/2026-09-12-atlas-hospitality-pms-ingest.md`

Tasks: 5.

Exit gate:

```text
PMS connector contract green
→ OPERA contract evidence captured or explicit fail-closed blocker
→ Mews/Cloudbeds/Infor boundaries fail closed unless verified
→ vendor ingress validates provider auth before payload processing
→ idempotency prevents replay processing
→ stays/room assignments projected
→ wallet eligibility evaluated/audited
→ NO wallet credential issuance yet
```

Milestone B may not call an access-provider Wallet issuance method. Its output is normalized stay/assignment state plus an eligibility decision/evidence.

### Milestone C — Provider Wallet adapters, lifecycle orchestration, guest delivery, UI

Execute completely:

`docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-delivery.md`

Tasks: 8.

Exit gate:

```text
Apple/Google capability selection green
→ SALTO/Vingcard/dormakaba/generic adapters verified-or-blocked
→ check-in issuance orchestrator green
→ room-change replacement sequencing green
→ checkout/cancellation revocation green
→ guest delivery token boundary green
→ versioned automation admin controls green
→ admin + guest UI green/mobile-responsive
→ deterministic end-to-end lifecycle green
→ full repository/security/build gate green
```

Only Milestone C may transition an eligible stay into provider-backed Wallet credential issuance.

## Cross-plan invariants

1. `hospitality_integration_events` is the single replay/idempotency ledger for PMS events.
2. `hospitality_stays` and `hospitality_room_assignments` are the normalized PMS projections; vendor payloads never become the domain model.
3. `hospitality_credential_references` stores provider references/status only; no cryptographic key material.
4. `hospitality_wallet_provisioning_sessions` stores lifecycle metadata; raw guest delivery tokens and raw provider provision tokens are not persisted.
5. `hospitality_automation_policies` defaults disabled and is versioned/audited.
6. `atlas-hospitality-pms-ingest` authenticates the vendor, not an ATLAS user.
7. `atlas-hospitality-access` remains the `verify_jwt=true` authenticated admin API.
8. `atlas-hospitality-wallet-delivery` is a narrowly scoped custom-token exchange for secure guest links and never grants admin operations.
9. Provider readiness is capability-specific. Apple-ready never implies Google-ready and vice versa.
10. SALTO KS never inherits SALTO Space Wallet behavior.
11. Google Hotel Key is never implemented as a generic Google Wallet pass.
12. Room change issues the replacement first and revokes the old credential only after replacement reaches the provider-defined acceptable state.
13. Checkout/cancellation does not mark local credentials revoked until provider evidence exists or a reviewed reconciliation outcome is recorded.
14. If provider issuance succeeds but persistence/audit fails, stop automatic retry and mark `reconciliation_required`.
15. Remote door unlock remains absent from types, APIs, UI, and adapters.

## Task execution protocol

For every task in every milestone:

```text
read spec + current task
→ pre-flight scan of current files and upstream changes
→ write/modify the failing test first
→ run focused test and observe expected RED
→ implement the minimum behavior
→ run focused tests and typecheck
→ inspect diff for secret/scope regressions
→ independent spec review
→ independent code-quality/security review
→ fix findings
→ rerun focused verification
→ commit only task-scoped files
→ update task ledger/checklist
→ continue automatically
```

Do not batch unrelated tasks into one commit. Do not force-reset/force-push approved work. Reconcile current `main` before starting the feature worktree and preserve all already-merged Hospitality fixes.

## Final repository verification gate

After all 18 tasks across the three detailed plans are complete, run from the exact final head:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Additionally run every focused Hospitality Wallet/PMS test named in the three detailed plans. A previously green run on a different SHA is not sufficient.

## Production approval gate

Stop and request explicit approval before any production DDL/function/web deployment. After approval, execute in this order:

```text
1. verify exact final branch SHA again
2. apply 20260912_hospitality_wallet_hotel_key.sql
3. apply 20260912_hospitality_wallet_delivery.sql
4. verify schema/RLS/security advisors
5. deploy atlas-hospitality-access with verify_jwt=true
6. deploy atlas-hospitality-pms-ingest with its vendor-auth boundary configured exactly as reviewed
7. deploy atlas-hospitality-wallet-delivery with custom delivery-token enforcement
8. deploy Cloudflare web from the exact verified SHA
9. verify authenticated admin routes and public guest-token failure/success states
10. perform controlled PMS + access-provider + Wallet device validation property by property
```

A deterministic mock/sandbox pass yields `implementation_verified / production_external_gates_pending`, not `production_ready`. A specific PMS/access-provider/wallet combination becomes `production_ready` only with evidence for authorized PMS event receipt, correct room assignment/mapping, official provider issuance, device Wallet provisioning, supported physical access, checkout/revocation, audit completeness, and no secret leakage.
