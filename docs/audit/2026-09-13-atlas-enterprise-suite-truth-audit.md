# ATLAS Enterprise Suite — End-to-End Truth Audit and Closure Register

Date: 2026-09-13
Updated with closure evidence: 2026-09-14 UTC
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Authoritative Supabase project: `atlas-core` (`ggmanzcgtlrvqfoccgsh`)

## Audit standard

This audit uses the ATLAS status vocabulary as a control: IDEA / DESIGNED / IMPLEMENTED / TESTED / DEPLOYED / VERIFIED IN PRODUCTION / BLOCKED / EXTERNAL DEPENDENCY / LOCAL-DEMO DATA. No item is promoted to a stronger state without current evidence.

Historical claims are subordinate to current repository, workflow, database, provider, and production evidence. This report is intentionally updated when later evidence disproves an earlier operational assumption.

## Executive verdict

ATLAS is a real, substantial software and backend system. The core repository and authoritative backend are materially operational, but the complete Enterprise Suite is not yet commercially production-ready.

The primary remaining readiness work is controlled convergence plus a small set of genuine external/human gates: Cloudflare deployment credentials, privileged MFA enrollment, GitHub administrative branch protection, Supabase leaked-password protection when plan-supported, and separation of the public commercial surface from the protected Enterprise App.

The correct completion strategy remains controlled convergence, not a mass merge.

## Repository truth

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
- Canonical branch: `main`
- Audited `main` HEAD at audit start: `ea8c347e9421033bee1c39fd279c392fbe2aaad6`
- Audit P0 closure merged through PR #113
- Blocker recovery runbook merged through PR #114
- RLS init-plan optimization merged through PR #115
- Current `main` after PR #115: `0070f800725873cf85ae828715cd780274039a9f`
- Primary backend/control plane: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
- Secondary project `atlas-core-v2` remains non-authoritative until explicitly reconciled and cut over
- Edge target: Cloudflare Workers / Static Assets
- Worker name: `atlas-enterprise-suite-web`
- Public domains: `atlasenterprisesuite.com`, `www.atlasenterprisesuite.com`

## Verified closure evidence

### CI and build pipeline — corrected finding

The original audit incorrectly attributed failed production workflows to unavailable GitHub-hosted `ubuntu-latest` runners and proposed moving the production workflows to `self-hosted`.

Fresh execution evidence disproved that assumption. GitHub-hosted Ubuntu 24.04 runners execute the canonical ATLAS verification and production-readiness workflows successfully with Node 22. A self-hosted runner is not a prerequisite unless a workflow explicitly requests one.

PR #113 exact-head verification on SHA `f6050eac6227809a2bf8fda8387e16b684f70589` passed:

- locked install
- dependency security gate
- typecheck
- unit tests
- integration tests
- production build
- exact SHA recording

PR #113 then merged to `main` as `b55da37762964d0ef12842f1014df51aa2a385e9`.

The resulting `ATLAS Build + Production Readiness Gate` on that exact `main` SHA also passed install, security, typecheck, unit, integration and production build.

Status: **TESTED / main build readiness VERIFIED**.

### Cloudflare deployment — real blocker isolated

The Cloudflare workflow reached `Validate Cloudflare authorization` after all code gates passed. It failed because GitHub Actions received empty values for:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Deployment, worker smoke verification, and ATLAS Manager evidence recording were therefore skipped.

This is a credentials/configuration blocker, not a runner or application-build failure.

Status: **BLOCKED — human credential configuration required**.

### Public production surface

Anonymous access to `www.atlasenterprisesuite.com` redirects to Cloudflare Access. The protected application boundary is therefore functioning, but the commercial website is not yet anonymously reachable.

Required target architecture:

- public: Home, Product/Modules, Contact, Demo, Terms, Privacy, onboarding entry;
- protected: authenticated tenant data, RBAC, audit, Approval Center, privileged ATLAS Assistant actions and Enterprise App modules.

Status: **BLOCKED / architecture-policy configuration pending**.

### Supabase owner bootstrap AAL2

Canonical migration:

`supabase/migrations/20260913_harden_atlas_bootstrap_owner_aal2.sql`

The migration was applied to authoritative production and registered as `harden_atlas_bootstrap_owner_aal2`.

Fresh `pg_get_functiondef` confirms that `public.atlas_bootstrap_owner` now requires AAL2 and raises `mfa_aal2_required` otherwise.

Status: **DEPLOYED + VERIFIED IN PRODUCTION**.

### Privileged MFA enrollment

Fresh production evidence shows one enabled platform administrator and zero enabled platform administrators with verified MFA.

The database now enforces AAL2 correctly, but a human administrator must enroll and verify an MFA factor.

Status: **BLOCKED — human identity action required**.

### SECURITY DEFINER review

Supabase Security Advisor reports 13 authenticated-executable `SECURITY DEFINER` RPCs. They were individually inspected rather than changed merely to silence the linter.

Verified guard patterns include combinations of:

- `auth.uid()` authentication
- `auth.jwt()` / AAL2 for privileged mutations
- active organization membership
- `has_identity_permission` role/permission checks
- platform-admin checks for bootstrap/provisioning
- confirmed-email and token-ownership checks for invitation acceptance
- fixed `search_path`

The three identity read RPCs delegate authorization to `has_identity_permission`, which validates active membership for `auth.uid()` and required role permissions. `accept_identity_invitation` validates authenticated identity, confirmed email, token integrity/status/expiry, exact email ownership, active organization, duplicate membership and audit state.

Current evidence does not justify mass conversion to `SECURITY INVOKER` or blanket `REVOKE EXECUTE`.

Status: **REVIEWED / intentional guarded exposure documented; continue regression review when functions change**.

### Leaked-password protection

Supabase Security Advisor still reports leaked-password protection disabled. The available Supabase connector does not expose the Auth-setting mutation, and the feature is plan-dependent.

Status: **BLOCKED / Dashboard-plan dependent**.

### RLS init-plan performance warnings

The original audit recorded six `auth_rls_initplan` warnings. PR #115 introduced the source-controlled migration:

`supabase/migrations/20260914004900_optimize_auth_rls_initplan_v1.sql`

The migration preserves policy names, roles, tenant conditions and accounting write guards while replacing direct repeated `auth.uid()` evaluation with `(select auth.uid())`.

After merge and production migration, fresh `pg_policies` evidence confirms the optimized expressions and a fresh Performance Advisor no longer reports `auth_rls_initplan`.

Status: **DEPLOYED + VERIFIED IN PRODUCTION — 6 → 0 warnings**.

### Remaining database performance debt

Fresh Performance Advisor still reports:

- 27 unindexed foreign keys
- 232 unused-index informational findings

Do not mass-create or mass-delete indexes. Missing FK indexes require table-size/workload/query analysis. Unused-index findings require workload evidence because counters can be young or reset and many indexes are intentional integrity/query-path support.

Status: **P1/P2 — analysis required before mutation**.

### GitHub `main` protection

`main` currently reports `protected: false` and required status checks off. The readable repository ruleset named `Copilot` only enables Copilot code review; it does not require PR-only changes or canonical CI status checks.

The installed GitHub integration lacks repository administration access to branch-protection endpoints and receives HTTP 403 for the protection resource.

Status: **BLOCKED — repository-admin action required**.

## Materially implemented platform surface

Current `main` contains one React/Vite ATLAS application with shared identity, shell, execution, business and vertical capabilities. Current production backend contains active identity/auth, permissions, governance, observability, release control, runtime verification, platform controls, intelligence/copilot, accounting and other domain functions.

Current source deliberately distinguishes demo/research/external-gated states and must continue to avoid presenting unavailable provider connections as live.

## A-Z convergence

`release/atlas-a-z` remains historical integration work, not a branch to bulk merge. Capabilities must be reconciled module by module against current `main`, preserving stronger recent implementations and retiring duplicates only after evidence is preserved.

Priority commercial core remains:

- CRM / revenue
- Accounting GL / AP / AR
- Inventory
- Purchasing
- Sales
- People / HR
- Payroll foundation
- POS foundation
- Projects / Work
- cross-module reporting

## Module registry and ATLAS Universe

Navigation and routing remain fragmented across explicit routes, manual navigation and extension-backed resolution. The next product-shell convergence should introduce one canonical module registry that drives:

- route availability
- navigation
- entitlement/RBAC metadata
- module readiness/status
- ATLAS Assistant context
- search/discovery
- ATLAS Universe visualization

The approved Universe UI must be a shell over the canonical application, not a parallel app.

## Commercial completion gate

ATLAS commercial v1 is complete only when these groups are current-evidence green:

1. **Platform:** canonical runtime, Auth, tenant/company, RBAC, audit, responsive shell, navigation, settings, notifications/search, backup/recovery and observability.
2. **Core Business:** CRM/revenue, Accounting AP/AR/GL, Inventory, Purchasing, Sales, HR, Payroll foundation, POS foundation, Projects/Work and reporting.
3. **Data:** no fake metrics/providers, explicit demo labels, reproducible migrations, required import/export and tenant-isolation evidence.
4. **Operations:** full tests, release pipeline, rollback, production verification, security review and documentation.
5. **Commercial:** anonymous public website/module pages, truthful statuses, Contact/Demo, Terms/Privacy and onboarding.

Advanced Health, Ride, Hospitality, Education, Telecom and Creator/Voice can deepen after the core commercial gate while external dependencies remain truthfully labeled.

## Ordered closure program

### Wave 0 — evidence pipeline

Completed for repository/build evidence through PR #113. Remaining Cloudflare deployment execution is blocked specifically by missing GitHub Actions Cloudflare credentials.

### Wave 1 — security

Completed:

- AAL2 guard on owner bootstrap deployed and verified
- SECURITY DEFINER functions individually reviewed

Remaining:

- human MFA enrollment/verification
- leaked-password protection when supported
- repository-admin protection of `main`

### Wave 2 — canonical convergence

- reconcile A-Z capabilities individually
- consolidate duplicate Intelligence, Ride, Hospitality and execution lines
- retire superseded branches/PRs only after evidence preservation
- keep one canonical implementation per capability

### Wave 3 — product shell

- canonical module registry
- Universe shell integration
- responsive/accessibility verification
- truthful module readiness states

### Wave 4 — public commercial surface

- separate anonymous commercial routes from protected Enterprise App
- Contact/Demo/Terms/Privacy/onboarding
- apex/www DNS/TLS and Access scope verification
- production smoke tests

### Wave 5 — operational hardening

- analyze and address material FK index gaps
- backup/restore rehearsal
- rollback evidence
- recurring production smoke/security checks

## Persistent blocker recovery record

Canonical recovery procedures are maintained in:

`docs/runbooks/atlas-blocker-recovery-runbook.md`

Every recurring incident should update that runbook with symptom, root cause, exact recovery procedure and required evidence.

## Current blockers that require external/human intervention

- configure GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- enroll and verify MFA for the privileged platform administrator
- configure `main` branch/ruleset protection with repository-admin privileges
- enable Supabase leaked-password protection if supported by the project plan
- adjust Cloudflare Access scope so the commercial public surface is anonymous while the Enterprise App remains protected

These blockers must not stop independent source, database analysis, tests, documentation and convergence work that can safely continue.

## Auditor conclusion

The audit no longer identifies GitHub-hosted runner availability as the production blocker. The evidence pipeline is functioning on GitHub-hosted Ubuntu runners, repository/build gates are green, owner bootstrap AAL2 is enforced in production, the SECURITY DEFINER family has been evidence-reviewed, and the six RLS init-plan warnings have been closed in production.

The shortest path to a trustworthy ATLAS now is: configure the real Cloudflare deployment credentials, complete human identity/admin security gates, separate the public and protected surfaces, converge the remaining business capabilities, and then execute exact-SHA production deployment and certification without overstating external-gated modules.