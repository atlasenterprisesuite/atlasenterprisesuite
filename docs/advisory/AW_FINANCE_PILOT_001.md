# AW Finance Advisory Solutions — ATLAS Pilot 001

Date: 2026-10-09
Owner: ATLAS Advisory Office
Canonical firm slug: `aw-finance-advisory-solutions`
Firm number: `001`
Status: **pilot preparation; not certified for live customer onboarding**

## Purpose

Use AW Finance Advisory Solutions as the first **tenant/firm using ATLAS**, not as a
fake client record inside its own client list. Reuse ATLAS Advisory Office, CRM,
Accounting/AR, Work OS, Identity/RBAC, Business Launch 360, and the ATLAS site stack.
Do not create another deployment, finance ledger, user database, or AI gateway.

Existing read-only production inspection (2026-10-09): one AW Finance firm,
two `advisory_clients`, six `advisory_engagements`, one organization-scoped
commercial launch intake, and one firm membership. These are *pre-existing records*;
their identities, commercial significance, correctness and business ownership
have not been independently verified. Never overwrite, count as pilot successes,
or clone them for tests.

## Services under validation

1. Bookkeeping: client intake, engagement, document request, close/reconciliation,
   work approvals, Accounting source of truth.
2. Accounting support: chart of accounts, AR/AP, bank reconciliation, monthly reporting.
3. Tax preparation: intake and tax workflow, year-specific eligibility and consent;
   no unsupported e-filing or licensed-professional claims.
4. Financial advisory: evidence-based budgeting and cash-flow planning, no implied
   regulated-investment adviser or tax certification.
5. Business consulting/administrative services: CRM-to-engagement,
   tasks, milestones and measurable delivery.
6. Business Launch 360: public inquiry → approved quotation → acceptance
   reference → engagement → AR draft → approval → payment evidence;
   each provider-backed action remains fail closed.

## Staged test journeys — synthetic data only

| ID | Journey | Required outcome | Gate |
| --- | --- | --- | --- |
| PILOT-01 | Sign in as authorized firm owner | Existing firm 001 visible; other firm hidden | P0 |
| PILOT-02 | Attempt anonymous / inactive / other-org / other-firm access to launch intake | Denied with zero leaked rows | P0 |
| PILOT-03 | Create and retrieve synthetic client in dedicated test tenant | Correct org_id/firm_id and audit attribution | P0 |
| PILOT-04 | Create synthetic engagement attached to that client | Invalid cross-firm client ID rejected | P0 |
| PILOT-05 | Upload/request synthetic tax or bookkeeping documents | Private storage and per-client access proven; otherwise blocked | P0 |
| PILOT-06 | Quote → accept → convert synthetic launch intake | No conversion without positive quote and acceptance evidence | P0 |
| PILOT-07 | Billing bridge → AR draft → approval → ledger | No invented revenue, double invoice, or unapproved money movement | P0 |
| PILOT-08 | As client/delegate, attempt read of a second client's documents | Denied; portal stays disabled until tested | P0 |
| PILOT-09 | Dashboard on phone/tablet/desktop, keyboard and screen reader | Critical flows usable, without inert buttons | P1 |
| PILOT-10 | Provider unavailable, revoked or stale | Explicit unavailable; no fake success status | P0 |
| PILOT-11 | CI, CodeQL, migration drift, exact SHA, authenticated E2E | All required release evidence present | P0 |

**Do not use production for test fixtures.** Provision an approved isolated staging
tenant/branch with a non-production authorization context. Prior to any paid
Supabase branch or project, obtain current cost and required purchase confirmation.

## Current gaps / evidence

- **Observed P0:** `advisory_launch_intakes_read` on the connected
  Supabase project checks `advisory.read` for the organization but does not
  require membership of that specific firm. Patch:
  `20261009234500_advisory_launch_intakes_firm_scope_rls.sql`.
- The connected production DB has `RLS enabled` on Advisory tables. This
  alone does not prove negative cross-tenant behavior.
- The repo has an Advisory UI, routes, client/engagement APIs and tests. No
  authenticated end-to-end result was obtained in this review.
- DB migration versions may differ from repository filenames; compare
  `supabase_migrations.schema_migrations` / source before applying any new DDL.
- Cloudflare remains the sole public production release target. The separate
  Vercel `atlas-auth-recovery` project is not a reason to create an automatic
  production Deploy Hook.
- Client Portal, external e-sign, governed documents, calendar, payments,
  media/print fulfillment and publishing require their own authorized tests.
- Do not use the firm name to imply LLC registration, licenses, or regulatory status.

## Release decision / acceptance

**Block launch** while any P0 lacks reproducible evidence. Merge only through
a reviewed PR after migration ordering, tests, CodeQL, CI and RLS negative
tests pass. Apply in staging first; check no loss of legitimate owner access.
After release, record the deployed exact SHA and verify production HTTP,
authenticated sign-in and pilot flows independently.

Completion evidence template:
`check_id | environment | tenant/firm | actor role | expected | observed | artifact URL | exact SHA | timestamp | reviewer`.

Proposed measurable pilot targets (not achievements):
- All P0 isolation/security tests passing.
- No synthetic data in production.
- 100% of test service engagements traceable to client, staff, permissions and audit.
- No simulated approval, revenue, bank connection, payment, or provider verification.
- Baseline median time from inquiry to approved engagement recorded, then target
  improvement assessed from observed data.

## Operational sequence

1. Review and merge P0 firm-scoped intake RLS fix (after CI and negative tests).
2. Reconcile database migration drift and tenant identity readiness.
3. Create isolated test identities and synthetic clients, with approved staging cost.
4. Run PILOT-01 through PILOT-11 and attach failures as issues with repro.
5. Repair missing flows in existing ATLAS modules; avoid parallel replacements.
6. Conduct one supervised real AW Finance internal workflow with explicit consent,
   then decide on public onboarding using recorded evidence.
