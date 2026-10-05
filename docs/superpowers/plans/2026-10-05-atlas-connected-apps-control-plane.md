# ATLAS Connected Apps Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one organization-scoped Connected Apps control plane that unifies external-app lifecycle, capability/scopes, access decisions, Work approvals, audit, retention, and agent-safe discovery while preserving existing provider adapters and fail-closed behavior.

**Architecture:** Add a small provider-neutral domain package, extend the canonical `atlas_integration_connections` registry, and expose a new `atlas-connected-apps` Edge Function as the shared policy/lifecycle boundary. Reconcile HubSpot first by reusing its existing OAuth/lifecycle implementation; all other catalog entries remain truthful about unconfigured or unsupported runtime state. UI surfaces live under Settings, Security, and Assistant rather than becoming a new top-level product module.

**Tech Stack:** TypeScript, React, React Router, Supabase/Postgres/RLS, Supabase Edge Functions/Deno, existing ATLAS Identity + `has_identity_permission`, existing Universal Execution Engine/Work approvals, Vitest, Cloudflare production verification.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-connected-apps-control-plane-design.md`

## Global Constraints

- Reuse existing Identity, OAuth state handling, `atlas_integration_connections`, credential sealing, Work approvals, audit, and provider-readiness semantics before creating new primitives.
- Provider-backed capability remains fail-closed until organization authorization, required scopes, credentials, provider verification, and policy conditions are satisfied.
- Browser code must never receive access tokens, refresh tokens, client secrets, signing keys, credential envelopes, or arbitrary provider error bodies.
- OAuth consent never overrides ATLAS RBAC/ABAC or owning-module permissions.
- Consequential capabilities default to `approval_required`; `deny` overrides approval, and approval overrides direct allow.
- A disconnected app must become unusable for new actions immediately even if provider-side token revocation later fails.
- Provider-side deletion/revocation is reported only when verified; ATLAS must not claim third-party deletion without evidence.
- No dynamic arbitrary OAuth scopes supplied by browser clients; scopes come from server-owned provider manifests.
- Existing provider-specific routes remain compatible during migration and continue to use canonical provider-specific adapters.
- No new top-level ATLAS module is created; canonical user surfaces are `/settings/connected-apps`, `/security/external-access`, and `/assistant/apps`.
- TDD is mandatory for every implementation task.
- Required final repository gates: `npm ci`, focused Vitest suites, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run verify:all`.
- Production completion requires merge to `main`, authorized deployment, and global fail-closed verification on the exact deployed SHA.

## Review Focus

1. **Cross-organization connection ID tampering:** a valid connection ID from another org must return `organization_mismatch`/403-equivalent behavior, disclose no provider metadata, and never invoke an adapter.
2. **Connected-but-under-scoped connection:** `state=connected` with a missing capability scope must return `scope_missing`, never call the provider, and surface the missing-scope state in UI.
3. **Stale approval after payload mutation:** changing any bounded consequential action input after approval must change the action digest and yield `approval_invalid` rather than reusing the approval.
4. **Disconnect when provider revoke fails:** ATLAS must stop new local access immediately, retain truthful `revocation_pending`/safe failure evidence, and never relabel provider revocation as successful.
5. **Secret-bearing provider failures:** access token, refresh token, Authorization header, client secret, or provider response body containing them must be sanitized before browser responses, logs, or Connected Apps audit metadata.

---

## File Structure

New domain package:
- `packages/connected-apps/src/types.ts` — canonical states, capabilities, policies, manifests, decisions, safe errors.
- `packages/connected-apps/src/state.ts` — connection transition validation.
- `packages/connected-apps/src/policy.ts` — deterministic policy precedence and consequential defaults.
- `packages/connected-apps/src/manifest.ts` — manifest validation and capability/scope lookup.
- `packages/connected-apps/src/errors.ts` — provider-neutral safe error normalization.
- `packages/connected-apps/src/index.ts` — exports only.

Persistence:
- `supabase/migrations/20261005130000_atlas_connected_apps_control_plane.sql` — connection metadata extensions, permissions, capabilities, policies, access events, data ledger, RLS, indexes.

Server control plane:
- `supabase/functions/_shared/connected-apps/provider-registry.ts` — server-owned provider catalog/manifests.
- `supabase/functions/_shared/connected-apps/hubspot-adapter.ts` — bridge to existing HubSpot lifecycle/readiness primitives.
- `supabase/functions/_shared/connected-apps/access.ts` — authenticated access evaluation + action digest/approval validation helpers.
- `supabase/functions/_shared/connected-apps/audit.ts` — safe event/data-ledger writes and sanitization.
- `supabase/functions/atlas-connected-apps/index.ts` — normalized control-plane operations.
- `supabase/functions/atlas-crm-hubspot/index.ts` — minimal reconciliation hooks only where needed; do not duplicate OAuth or CRM logic.

Web:
- `apps/web/src/lib/connectedAppsApi.ts` — typed browser client and response normalization.
- `apps/web/src/modules/connected-apps/ConnectedAppsPage.tsx` — catalog/lifecycle surface.
- `apps/web/src/modules/connected-apps/ConnectedAppDetailPage.tsx` — overview, scopes, capabilities, activity, retention, disconnect.
- `apps/web/src/modules/connected-apps/ExternalAccessPage.tsx` — Security governance view.
- `apps/web/src/modules/connected-apps/AssistantAppsPage.tsx` — filtered AI/agent capability view.
- `apps/web/src/modules/connected-apps/connected-apps.css` — responsive/accessibility styling.
- `apps/web/src/App.tsx` — mount protected routes.
- `apps/web/src/components/AtlasShell.tsx` and `apps/web/src/navigation/atlasNavigation.ts` — navigation/deep-link discovery without creating a top-level module.

Production verification:
- `data/ops/global-production-verification.json`
- `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- focused tests under `tests/unit/` and `tests/integration/`.

---

### Task 1: Provider-neutral Connected Apps domain

**Files:**
- Create: `packages/connected-apps/src/types.ts`
- Create: `packages/connected-apps/src/state.ts`
- Create: `packages/connected-apps/src/policy.ts`
- Create: `packages/connected-apps/src/manifest.ts`
- Create: `packages/connected-apps/src/errors.ts`
- Create: `packages/connected-apps/src/index.ts`
- Test: `tests/unit/connected-apps-domain.test.ts`

**Interfaces:**
- Produces `ConnectedAppState = 'disconnected' | 'authorizing' | 'connected' | 'degraded' | 'expired' | 'revoked' | 'error'`.
- Produces `ConnectedAppAccessLevel = 'read' | 'write' | 'admin' | 'consequential'`.
- Produces `ConnectedAppPolicyEffect = 'allow' | 'approval_required' | 'deny'`.
- Produces `ProviderManifest`, `ProviderCapabilityManifest`, `ConnectedAppPolicy`, `ConnectedAppAccessInput`, `ConnectedAppAccessDecision`, `ConnectedAppSafeErrorCode`.
- Produces `canTransitionConnectedAppState(from, to): boolean`.
- Produces `validateProviderManifest(manifest): ProviderManifest`.
- Produces `evaluateConnectedAppPolicy(input): ConnectedAppAccessDecision`.
- Produces `requiredScopesForCapability(manifest, capabilityCode): readonly string[]`.
- Produces `normalizeConnectedAppError(value): { code: ConnectedAppSafeErrorCode; message: string }`.

- [ ] **Step 1: Write failing domain tests** for all legal/illegal state transitions, manifest duplicate capabilities, missing provider scopes, policy precedence `deny > approval_required > allow`, consequential default `approval_required`, and secret-bearing error sanitization.
- [ ] **Step 2: Run** `npx vitest run tests/unit/connected-apps-domain.test.ts` and confirm FAIL because the package does not exist.
- [ ] **Step 3: Implement the six focused domain files** with pure deterministic functions only; no network, database, browser, or Supabase dependencies.
- [ ] **Step 4: Run** `npx vitest run tests/unit/connected-apps-domain.test.ts` and confirm PASS.
- [ ] **Step 5: Commit** `feat(connected-apps): add provider-neutral domain contracts`.

### Task 2: Canonical persistence, permissions, RLS, and lifecycle metadata

**Files:**
- Create: `supabase/migrations/20261005130000_atlas_connected_apps_control_plane.sql`
- Test: `tests/integration/connected-apps-schema.test.ts`

**Interfaces:**
- Extends `public.atlas_integration_connections` with `authorized_by`, `authorized_at`, `verified_at`, `expires_at`, `revoked_at`, `last_error_code`, `last_error_summary` using `add column if not exists`.
- Creates `public.atlas_connected_app_capabilities`.
- Creates `public.atlas_connected_app_policies`.
- Creates append-only/service-written `public.atlas_connected_app_access_events`.
- Creates `public.atlas_connected_app_data_ledger`.
- Registers exactly the nine `connected_apps.*` permissions from the spec and grants them to `owner`/`admin` via `identity_role_permissions`.
- Browser-readable metadata is RLS-protected; credential tables remain service-only and unchanged.

- [ ] **Step 1: Write failing schema tests** asserting tables, FKs, unique constraints, indexes, permission codes, owner/admin grants, RLS enablement, and absence of any grant exposing `atlas_integration_credentials` to browser roles.
- [ ] **Step 2: Add Review Focus test** proving policy/table design remains org-scoped and no cross-org write policy exists.
- [ ] **Step 3: Run** `npx vitest run tests/integration/connected-apps-schema.test.ts`; expect FAIL.
- [ ] **Step 4: Implement migration** following the existing identity permission and organization-RLS conventions. Use service-only writes for policies/events/ledger unless an authenticated RPC/API path explicitly authorizes mutation.
- [ ] **Step 5: Run** the schema test and existing CRM integration schema tests; expect PASS.
- [ ] **Step 6: Commit** `feat(connected-apps): add governed persistence and permissions`.

### Task 3: Server-owned provider manifest registry

**Files:**
- Create: `supabase/functions/_shared/connected-apps/provider-registry.ts`
- Create: `supabase/functions/_shared/connected-apps/hubspot-adapter.ts`
- Test: `tests/unit/connected-apps-provider-registry.test.ts`
- Reuse: `supabase/functions/_shared/hubspot-connection-lifecycle.ts`

**Interfaces:**
- Produces `listProviderManifests(): readonly ProviderManifest[]`.
- Produces `getProviderManifest(providerId: string): ProviderManifest | null`.
- Produces `ConnectedAppsProviderAdapter` with `verify`, optional `prepareAuth`, optional `completeAuth`, optional `reconnect`, optional `disconnect`, optional `execute`.
- HubSpot adapter delegates OAuth/readiness/revoke behavior to existing HubSpot lifecycle helpers rather than reimplementing them.
- Google/Microsoft/GitHub/Slack/Dropbox may appear as catalog metadata only unless a verified server adapter already exists; catalog status must distinguish `catalog_only` from runtime-ready.

- [ ] **Step 1: Write failing registry tests** for unique provider IDs, unique capability codes, server-owned scopes, adapter availability flags, and HubSpot mapping to existing P0 scopes.
- [ ] **Step 2: Run** `npx vitest run tests/unit/connected-apps-provider-registry.test.ts`; expect FAIL.
- [ ] **Step 3: Implement registry and HubSpot bridge** without changing existing HubSpot semantics.
- [ ] **Step 4: Run** registry tests plus `tests/integration/atlas-crm-hubspot-function.test.ts` and `tests/integration/atlas-crm-hubspot-read-operations.test.ts`; expect PASS/no regression.
- [ ] **Step 5: Commit** `feat(connected-apps): add provider manifest registry and hubspot bridge`.

### Task 4: Shared access decision engine and safe evidence helpers

**Files:**
- Create: `supabase/functions/_shared/connected-apps/access.ts`
- Create: `supabase/functions/_shared/connected-apps/audit.ts`
- Test: `tests/unit/connected-apps-access.test.ts`

**Interfaces:**
- Produces `evaluateConnectedAppAccess(context): Promise<ConnectedAppAccessDecision>`.
- Produces `digestConnectedAppAction(input): Promise<string>` returning lowercase SHA-256 hex.
- Produces `approvalMatchesAction(approval, digest, now): boolean`.
- Produces `sanitizeConnectedAppMetadata(value): Record<string, unknown>`.
- Access order is fixed: actor -> active org membership -> ATLAS permission -> org match -> connection state -> authorization -> verification -> capability -> scopes -> Connected Apps policy -> owning-module permission -> approval -> adapter execution.

- [ ] **Step 1: Write failing access tests** covering every gate and asserting the provider adapter spy is never called before all gates pass.
- [ ] **Step 2: Add Review Focus tests** for cross-org ID tampering, connected-but-missing-scope, stale approval/action digest, and secret-bearing errors.
- [ ] **Step 3: Run** `npx vitest run tests/unit/connected-apps-access.test.ts`; expect FAIL.
- [ ] **Step 4: Implement access/digest/sanitization helpers** using canonical package policy functions and safe metadata allowlisting/redaction.
- [ ] **Step 5: Run** the focused suite; expect PASS.
- [ ] **Step 6: Commit** `feat(connected-apps): add fail-closed access decision engine`.

### Task 5: Connected Apps Edge Function — read and lifecycle operations

**Files:**
- Create: `supabase/functions/atlas-connected-apps/index.ts`
- Test: `tests/integration/connected-apps-function.test.ts`

**Interfaces:**
- POST operations: `catalog.list`, `connection.list`, `connection.get`, `connection.prepare_auth`, `connection.complete_auth`, `connection.verify`, `connection.reconnect`, `connection.disconnect`, `capability.list`.
- Every request uses the authenticated user session and active organization ID supplied by the client; org membership and `connected_apps.*` permission checks are server-authoritative.
- Response connection shape excludes `secret_ref`, credential rows, tokens, arbitrary provider payloads, and unsanitized provider errors.

- [ ] **Step 1: Write failing function contract tests** for supported operations, permission checks, org filtering, safe response fields, unknown provider rejection, and provider catalog truthfulness.
- [ ] **Step 2: Add Review Focus disconnect test**: provider revoke throws, local connection becomes unusable immediately, response records a safe revoke failure/pending state, and no success claim is emitted for provider revocation.
- [ ] **Step 3: Run** `npx vitest run tests/integration/connected-apps-function.test.ts`; expect FAIL.
- [ ] **Step 4: Implement read/lifecycle operations** by reusing `atlas_integration_connections`, provider registry, HubSpot lifecycle bridge, and append-only access evidence.
- [ ] **Step 5: Run** focused function and HubSpot regression suites; expect PASS.
- [ ] **Step 6: Commit** `feat(connected-apps): add shared lifecycle control plane`.

### Task 6: Policy, audit, retention, and deletion-request operations

**Files:**
- Modify: `supabase/functions/atlas-connected-apps/index.ts`
- Test: `tests/integration/connected-apps-governance.test.ts`

**Interfaces:**
- Adds POST operations: `policy.list`, `policy.upsert`, `audit.list`, `retention.list`, `retention.request_delete`.
- `policy.upsert` requires `connected_apps.policy.manage`.
- `audit.list` requires `connected_apps.audit.read`.
- `retention.request_delete` requires `connected_apps.retention.manage` and creates a tracked request; it does not mark provider deletion complete without provider evidence.

- [ ] **Step 1: Write failing governance tests** for permission separation, deny precedence persistence, immutable-style audit rows, transient/cached/persisted ledger states, and truthful deletion-request semantics.
- [ ] **Step 2: Run** `npx vitest run tests/integration/connected-apps-governance.test.ts`; expect FAIL.
- [ ] **Step 3: Implement governance operations** with server-side writes and sanitized output.
- [ ] **Step 4: Run** focused suite; expect PASS.
- [ ] **Step 5: Commit** `feat(connected-apps): add policy audit and retention controls`.

### Task 7: Work OS approval bridge and consequential execution

**Files:**
- Modify: `supabase/functions/atlas-connected-apps/index.ts`
- Create: `supabase/functions/_shared/connected-apps/work-approval.ts`
- Test: `tests/integration/connected-apps-approval-execution.test.ts`
- Reuse: `supabase/functions/atlas-execution/index.ts`
- Reuse: `packages/execution/src/types.ts`

**Interfaces:**
- Adds operations `access.evaluate` and `access.execute`.
- Produces `ensureConnectedAppApproval(input): Promise<{ decision: 'approved' | 'pending'; approvalId: string | null; taskId: string | null; workflowId: string | null }>`.
- Uses the existing Universal Execution Engine operations/tables and the existing `execution_approvals.payload_digest`; it does not create a Connected Apps approval table.
- Approval type is `connected_app_action`; module is `connected-apps`; `required_permission` is the owning capability/module permission required for the bounded action.

- [ ] **Step 1: Write failing flow tests** for read allow, deny, approval-required, approval request creation, approved action execution, rejected/expired approval, and no adapter call on non-approved execution.
- [ ] **Step 2: Add Review Focus stale-approval test** proving modified payload -> different SHA-256 digest -> `approval_invalid`.
- [ ] **Step 3: Run** `npx vitest run tests/integration/connected-apps-approval-execution.test.ts`; expect FAIL.
- [ ] **Step 4: Implement approval bridge** through the existing execution engine and bind the approval to the exact action digest/version.
- [ ] **Step 5: Run** the new suite plus `tests/integration/execution-edge-contract.test.ts`; expect PASS.
- [ ] **Step 6: Commit** `feat(connected-apps): route consequential actions through Work approvals`.

### Task 8: Reconcile HubSpot through the common control plane

**Files:**
- Modify: `supabase/functions/atlas-crm-hubspot/index.ts` only where necessary to publish/reuse canonical connection state.
- Modify: `supabase/functions/_shared/hubspot-connection-lifecycle.ts` only if a small provider-neutral hook is required.
- Test: `tests/integration/connected-apps-hubspot-reconciliation.test.ts`

**Interfaces:**
- Existing HubSpot OAuth callback, health/readiness, refresh, CRM read, and disconnect behavior remain backward compatible.
- Common Connected Apps `connection.get/verify/disconnect` reports the same authoritative HubSpot connection/account/scope state as the existing HubSpot surface.
- No duplicate HubSpot credential or OAuth-state storage is introduced.

- [ ] **Step 1: Write failing reconciliation tests** asserting one canonical connection record, same granted scopes/account identity, consistent verify/disconnect results, and no new credential table/path.
- [ ] **Step 2: Run** the new reconciliation suite and existing HubSpot suites; expect the new assertions to FAIL while old behavior stays green.
- [ ] **Step 3: Add the smallest reconciliation hook** required to converge state without replacing HubSpot internals.
- [ ] **Step 4: Run** all HubSpot + Connected Apps focused suites; expect PASS.
- [ ] **Step 5: Commit** `refactor(connected-apps): reconcile hubspot with shared control plane`.

### Task 9: Typed browser API client

**Files:**
- Create: `apps/web/src/lib/connectedAppsApi.ts`
- Test: `tests/unit/connected-apps-web-api.test.ts`

**Interfaces:**
- Produces `listConnectedApps()`, `getConnectedApp(connectionId)`, `prepareConnectedAppAuth(providerId)`, `verifyConnectedApp(connectionId)`, `reconnectConnectedApp(connectionId)`, `disconnectConnectedApp(connectionId)`, `listConnectedAppPolicies()`, `upsertConnectedAppPolicy(input)`, `listConnectedAppAudit()`, `listConnectedAppRetention()`, `requestConnectedAppDeletion(input)`, `listAssistantConnectedApps()`.
- Uses `authorizedAtlasFetch` and `getActiveAtlasOrganization` exactly like existing authenticated web APIs.
- Normalizers drop unknown secret-like fields instead of forwarding arbitrary JSON.

- [ ] **Step 1: Write failing client tests** for response normalization, safe error handling, organization binding, and secret-field stripping.
- [ ] **Step 2: Run** `npx vitest run tests/unit/connected-apps-web-api.test.ts`; expect FAIL.
- [ ] **Step 3: Implement client** with typed normalized records only.
- [ ] **Step 4: Run** focused suite; expect PASS.
- [ ] **Step 5: Commit** `feat(connected-apps): add typed web client`.

### Task 10: Settings Connected Apps catalog and detail UI

**Files:**
- Create: `apps/web/src/modules/connected-apps/ConnectedAppsPage.tsx`
- Create: `apps/web/src/modules/connected-apps/ConnectedAppDetailPage.tsx`
- Create: `apps/web/src/modules/connected-apps/connected-apps.css`
- Test: `tests/integration/connected-apps-settings-ui.test.tsx`

**Interfaces:**
- Catalog shows provider name, truthful status, safe account/workspace label, capabilities summary, last verification, scope warning, and state-appropriate action.
- Detail tabs/sections: Overview, Permissions & Scopes, Capabilities, Agent & Workflow Access, Activity, Data & Retention, Disconnect.
- Disconnect confirmation explicitly distinguishes future ATLAS access, provider revoke, ATLAS-retained deletion request, and provider-held data.

- [ ] **Step 1: Write failing UI tests** for loading, empty, connected, degraded, expired, catalog-only provider, insufficient scope, error, disabled action, keyboard focus, and disconnect confirmation copy.
- [ ] **Step 2: Add Review Focus UI test** for connected-but-missing-scope: badge/status must not imply the capability is usable.
- [ ] **Step 3: Run** `npx vitest run tests/integration/connected-apps-settings-ui.test.tsx`; expect FAIL.
- [ ] **Step 4: Implement responsive Settings UI** with status conveyed by text/icon as well as color and reduced-motion-safe styles.
- [ ] **Step 5: Run** focused UI suite; expect PASS.
- [ ] **Step 6: Commit** `feat(connected-apps): add settings catalog and connection detail`.

### Task 11: Security External Access and Assistant Apps surfaces

**Files:**
- Create: `apps/web/src/modules/connected-apps/ExternalAccessPage.tsx`
- Create: `apps/web/src/modules/connected-apps/AssistantAppsPage.tsx`
- Test: `tests/integration/connected-apps-security-ai-ui.test.tsx`

**Interfaces:**
- Security view shows inventory, high-risk scopes/capabilities, policy state, approvals/denials, degraded/expired connections, and retention exceptions.
- Assistant Apps shows only connections/capabilities returned by server-side filtered discovery; no token/scope inference from browser-only state.
- Agent-visible model includes provider/app display name, safe account label, connection health, allowed capability codes, approval requirement, and verification freshness.

- [ ] **Step 1: Write failing Security/AI tests** for filtering, permission-gated governance controls, and agent capability visibility.
- [ ] **Step 2: Write secret non-disclosure assertion** over rendered DOM and mocked network-normalized objects.
- [ ] **Step 3: Run** `npx vitest run tests/integration/connected-apps-security-ai-ui.test.tsx`; expect FAIL.
- [ ] **Step 4: Implement both surfaces** using the typed client and no direct provider SDK calls.
- [ ] **Step 5: Run** focused suite; expect PASS.
- [ ] **Step 6: Commit** `feat(connected-apps): add security and assistant app surfaces`.

### Task 12: Routes, navigation, accessibility, and production contract

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/navigation/atlasNavigation.ts`
- Modify: `data/ops/global-production-verification.json`
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Test: `tests/integration/connected-apps-routes.test.tsx`
- Test: `tests/integration/global-production-verification.test.ts`
- Test: `tests/integration/cloudflare-authorized-production-verifier.test.ts`
- Modify accessibility route validation workflow/config only if the current validator enumerates routes explicitly.

**Interfaces:**
- Mounts protected `/settings/connected-apps`, `/settings/connected-apps/:connectionId`, `/security/external-access`, `/assistant/apps`.
- Adds discoverable Settings/Security/Assistant navigation without registering a new top-level module.
- Adds the three stable shell routes (`/settings/connected-apps`, `/security/external-access`, `/assistant/apps`) to fail-closed production verification; dynamic detail route is exercised in integration tests, not as a deterministic public canary.

- [ ] **Step 1: Write failing route/navigation tests** for Identity protection, deep-link resolution, no duplicate top-level module, and expected navigation labels.
- [ ] **Step 2: Extend production contract tests first** to require the three stable Connected Apps surfaces in both static and authorized verifiers.
- [ ] **Step 3: Run** the three focused route/verification suites; expect FAIL.
- [ ] **Step 4: Mount routes/navigation and update fail-closed route contracts**.
- [ ] **Step 5: Extend accessibility route coverage** for Connected Apps Settings and Security surfaces if route enumeration is explicit.
- [ ] **Step 6: Run** focused route, production-verifier, navigation-intelligence, and accessibility contract tests; expect PASS.
- [ ] **Step 7: Commit** `feat(connected-apps): mount governed surfaces and production gates`.

### Task 13: Whole-feature verification and regression closure

**Files:**
- Modify only files directly implicated by failing verification caused by Connected Apps.
- Update implementation docs only if runtime behavior differs from an already approved exact wording; do not weaken the spec to make tests pass.

**Interfaces:**
- Produces a green implementation branch with no fabricated provider-readiness claims and no secret leakage.

- [ ] **Step 1: Run focused suites**:
  `npx vitest run tests/unit/connected-apps-domain.test.ts tests/unit/connected-apps-provider-registry.test.ts tests/unit/connected-apps-access.test.ts tests/unit/connected-apps-web-api.test.ts tests/integration/connected-apps-schema.test.ts tests/integration/connected-apps-function.test.ts tests/integration/connected-apps-governance.test.ts tests/integration/connected-apps-approval-execution.test.ts tests/integration/connected-apps-hubspot-reconciliation.test.ts tests/integration/connected-apps-settings-ui.test.tsx tests/integration/connected-apps-security-ai-ui.test.tsx tests/integration/connected-apps-routes.test.tsx`.
- [ ] **Step 2: Run HubSpot/execution regressions**: `npx vitest run tests/integration/atlas-crm-hubspot-function.test.ts tests/integration/atlas-crm-hubspot-read-operations.test.ts tests/integration/execution-edge-contract.test.ts`.
- [ ] **Step 3: Run** `npm run typecheck`; expect PASS.
- [ ] **Step 4: Run** `npm run test:unit`; expect PASS.
- [ ] **Step 5: Run** `npm run test:integration`; expect PASS.
- [ ] **Step 6: Run** `npm run verify:all`; expect PASS including build/security/edge verification.
- [ ] **Step 7: Inspect git diff** for accidental credentials, unrelated refactors, duplicate integration primitives, placeholder data, `href="#"`, `Coming Soon`, or optimistic connected states.
- [ ] **Step 8: Commit** any verification-only repair as a focused commit; otherwise do not create a no-op commit.

### Task 14: PR, CI, merge, deploy, and fail-closed E2E verification

**Files:**
- No product-code changes unless a real CI/deployment defect attributable to this feature is found.

**Interfaces:**
- Production truth is the exact merged `main` SHA and its authorized Cloudflare/global-verification evidence.

- [ ] **Step 1: Open implementation PR** from the isolated implementation branch to `main` with spec + plan links and explicit provider-readiness boundaries.
- [ ] **Step 2: Require green PR CI** including build/readiness, CodeQL/security, accessibility, unit/integration, and any repository-required checks.
- [ ] **Step 3: Review changed files and unresolved review threads**; fix only evidence-backed defects.
- [ ] **Step 4: Merge only when required checks are green** and record the exact merge SHA.
- [ ] **Step 5: Verify production deployment workflow** for that exact SHA; do not treat a branch deployment as production evidence.
- [ ] **Step 6: Require global fail-closed verification PASS** for `https://www.atlasenterprisesuite.com`, existing ATLAS Network P0 routes, `/settings/connected-apps`, `/security/external-access`, and `/assistant/apps`.
- [ ] **Step 7: Verify HubSpot provider readiness separately** using its real authenticated readiness evidence if configured; if not configured, report the provider as gated/unverified while still allowing the Connected Apps core to be production-verified.
- [ ] **Step 8: Verify E2E user flow**: Identity -> Settings Connected Apps -> HubSpot/catalog state -> detail/scopes -> access evaluation -> Work approval for a deterministic consequential fake/approved test path -> audit/retention evidence -> disconnect semantics.
- [ ] **Step 9: Mark Connected Apps production-complete only with exact evidence** for code, CI, merged SHA, deploy, routes, and global verifier. Never convert missing external-provider configuration into a false failure or false success claim.

## Self-Review Results

- **Spec coverage:** all spec sections map to Tasks 1-14; Phase 4 broader provider expansion remains intentionally outside the first implementation slice except for catalog-compatible contracts.
- **Step scan:** each task has an independent red/green TDD cycle and a reviewable deliverable; no implementation body is prescribed where tests/signatures are sufficient.
- **Type consistency:** domain types flow from `packages/connected-apps` -> shared Edge helpers -> `atlas-connected-apps` -> web normalizers; Work approval uses the existing execution approval digest/status model.
- **Review Focus:** all five high-risk conditions have explicit tests in Tasks 2, 4, 5, 7, and 10.
- **Proportion:** the plan fixes interfaces, files, tests, gates, and sequencing without transcribing implementation bodies.
