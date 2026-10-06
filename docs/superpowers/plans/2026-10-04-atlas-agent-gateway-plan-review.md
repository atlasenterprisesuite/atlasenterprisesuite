# ATLAS Agent Gateway Plan Self-Review Amendments

This file is a binding companion to `docs/superpowers/plans/2026-10-04-atlas-agent-gateway.md`. It records gaps found during the required writing-plans self-review before implementation. Executors must read and implement both files as one plan.

## Self-review result

Spec coverage is otherwise represented in Tasks 1-9 of the primary plan. The following requirements needed explicit task-level instructions rather than relying on inference.

### Amendment A — Canonical setup/detail routes and Settings alias

**Applies to primary Task 6 and Task 8.**

**Files:**
- Modify: `apps/web/src/work/WorkRoutes.tsx`
- Modify: `apps/web/src/work/WorkSubnav.tsx` only if navigation requires a direct setup entry; do not add duplicate state.
- Create or extract focused components only if `WorkConnectionsPage.tsx` becomes unwieldy:
  - `apps/web/src/work/WorkConnectionSetupPage.tsx`
  - `apps/web/src/work/WorkConnectionDetailPage.tsx`
- Modify the repository's existing Settings route owner only if required to add a redirect alias.
- Modify: `tests/integration/work-runtime-pages.test.tsx`
- Modify: `tests/unit/work-production-verification.test.ts`
- Modify: `tests/integration/global-production-verification.test.ts`

- [ ] Write failing routing tests requiring:
  - `/work/connections` -> canonical connection center;
  - `/work/connections/new` -> setup/discovery flow;
  - `/work/connections/:connectionId` -> sanitized detail/test/repair view;
  - `/settings/integrations` -> redirect/alias to `/work/connections` if the Settings router supports the alias without creating a parallel module.
- [ ] Run `npx vitest run tests/integration/work-runtime-pages.test.tsx` and verify RED for the new routes.
- [ ] Add the routes using the existing Work shell and the same Agent Gateway API/state; no duplicate persistence or alternate connection model.
- [ ] Add `/work/connections/new` to P0 route verification alongside `/work/connections`; the parameterized detail route is verified through route tests rather than a fake public ID.
- [ ] Re-run the focused UI and production contract tests; expect PASS.

### Amendment B — Connection authorization semantics

**Applies to primary Task 5.**

The spec names proposed logical permissions `work.connections.read/create/verify/repair/revoke/admin`, while the current execution edge uses the established `ExecutionPermission` namespace (`execution.read`, `execution.write`, `execution.approve`, `execution.audit`, `execution.admin`) and the existing HubSpot subsystem separately enforces `integrations.*`/`crm.*` permissions.

Implementation must not silently invent a second identity/RBAC store. Use this rule:

- Work Agent Gateway entry operations are guarded by the canonical execution permissions already resolved by `atlas-execution`.
- Provider-specific HubSpot authorization/testing continues to honor the existing `integrations.*`/`crm.*` checks owned by `atlas-crm-hubspot`.
- If the repository already has a canonical extensible permission registry suitable for `work.connections.*`, add the six logical permissions there with tests and map them to roles; otherwise keep them as normalized audit/action labels in this release and document that the enforcement is provided by the existing canonical permission layers. Do not create a parallel permission table solely for Agent Gateway.
- `revoke` remains a mutation and must not become executable through read permission.

Add tests proving a caller with read-only execution permission cannot begin/repair/revoke a connection and that provider-specific HubSpot permissions are not bypassed by Work-level access.

### Amendment C — Structured observability without secrets

**Applies to primary Task 5.**

**Files:**
- Modify: `supabase/functions/atlas-execution/agent-gateway.ts`
- Modify: `supabase/functions/atlas-execution/index.ts` only as needed for correlation IDs.
- Modify: `tests/unit/atlas-execution-agent-gateway.test.ts`

- [ ] Write a failing test for a sanitized operation event containing only approved dimensions: provider, mechanism, transport, health transition, operation, result, duration bucket, opaque org/tenant/correlation identifiers, and runtime kind when applicable.
- [ ] Assert the event excludes `external_ref`, token, cookie, authorization header, ciphertext, IV, password, recovery values and raw provider error body.
- [ ] Implement a small structured event helper that uses existing logging/audit facilities; do not introduce a second telemetry backend.
- [ ] Re-run the focused gateway tests; expect PASS.

### Amendment D — Workflow-bound evidence

**Applies to primary Task 5 and Task 7.**

When `verify_work_connection` or `test_work_connection` runs with a canonical workflow/task/step context, successful verified outcomes must bind to `execution_evidence` using the existing evidence recorder semantics. Standalone connection-center checks continue to store latest sanitized state on `execution_connection_refs` plus event history in `execution_audit_events`; they do not create a shadow evidence table.

- [ ] Add failing tests for both modes:
  - standalone check -> connection metadata + audit only;
  - workflow-bound check -> connection metadata + audit + verified `execution_evidence` linked to the supplied canonical workflow/task/step after server-side scope validation.
- [ ] Reject client-supplied workflow/task/step identifiers that do not resolve inside the authenticated org+tenant.
- [ ] Implement with existing `execution_evidence`; do not create a connection-evidence table.
- [ ] Re-run gateway and execution edge tests; expect PASS.

### Amendment E — Review Focus closure

Before Task 9 PR creation, verify these exact user-facing failure classes have an automated test:

1. `hubspot.com.evil.example` is unsupported.
2. `active + reauth_required` is not ready.
3. same provider/domain in another tenant cannot satisfy routing.
4. existing connected HubSpot state is reused without duplicate OAuth or credential copying.
5. no secret-bearing fields or raw provider errors escape normalized responses, audit, logs or client rendering.

If any one lacks a test, add the missing test before opening the PR.
