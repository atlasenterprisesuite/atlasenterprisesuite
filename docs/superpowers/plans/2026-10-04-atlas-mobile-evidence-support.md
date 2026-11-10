# ATLAS Mobile Evidence, Privacy, Billing, Diagnostics and Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement persisted mobile preferences/privacy controls, evidence-backed billing state, redacted support diagnostics and contextual ATLAS mobile help without inventing provider success.

**Architecture:** Extend the mobile gateway from the foundation plan with organization/user-scoped preference, entitlement and diagnostic operations. Persist only ATLAS-owned settings in Supabase with RLS; keep OS permissions and external billing as provider evidence, not user-editable truth. Integrate contextual help into Knowledge Atlas while keeping support bundles metadata-only by default.

**Tech Stack:** React 18, TypeScript 5.7, Supabase Postgres/RLS, Supabase Edge Functions, Vitest, existing Knowledge Atlas and ATLAS audit/session utilities.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-mobile-experience-design.md`

## Global Constraints

- `granted`, `verified`, `paid`, `active` and `restored` require current authenticated evidence.
- OS permission state is observed, never overridden by tenant policy or a database toggle.
- Provider receipts/tokens remain server-side and never enter browser-visible diagnostics.
- Diagnostic bundles exclude conversation content by default and require explicit user selection to add optional details.
- Preferences are scoped to the authenticated user and active organization and protected by RLS.
- Help content describes actual ATLAS behavior and clearly distinguishes web from native-only capabilities.

## Review Focus

- Preference row exists for another org with the same user -> it must not be readable or writable in the active org.
- Billing provider response is stale or malformed -> normalized state is `unverified/provider_error`, not active.
- Diagnostics contain nested `authorization`, `cookie`, `token` or API-key-like fields -> all are redacted recursively.
- User cancels support submission after preview -> no external transmission/audit success event occurs.
- Help article describes a native capability while running on web -> UI labels `Requires ATLAS iOS app` rather than presenting an enabled action.

---

### Task 1: Persist mobile user preferences with RLS

**Files:**
- Create: `supabase/migrations/20261004090000_mobile_user_preferences.sql`
- Modify: `supabase/functions/atlas-mobile/index.ts`
- Create: `apps/web/src/mobile/preferences.ts`
- Test: `tests/integration/mobile-preferences-rls.test.ts`
- Test: `tests/unit/mobile-preferences.test.ts`

**Interfaces:**
- Produces table: `mobile_user_preferences(id, user_id, organization_id, preferences, privacy, created_at, updated_at)` with unique `(user_id, organization_id)`.
- Produces gateway operations: `GET ?api=preferences`, `PUT ?api=preferences`.
- Produces client functions: `loadMobilePreferences()`, `saveMobilePreferences(input)`.

- [ ] **Step 1: Write failing RLS tests** proving same-user cross-org isolation, unauthenticated denial and owner-only update.
- [ ] **Step 2: Create migration** with UUID primary key, JSONB defaults, timestamps, unique scope and RLS policies tied to canonical authenticated user/org context.
- [ ] **Step 3: Run** `npx vitest run tests/integration/mobile-preferences-rls.test.ts` and verify PASS in the repository's migration test harness.
- [ ] **Step 4: Write failing unit tests** for normalization of persisted preferences and unknown fields being ignored rather than trusted.
- [ ] **Step 5: Extend** `atlas-mobile` with read/update operations that validate an allowlisted payload and emit metadata-only audit events on successful changes.
- [ ] **Step 6: Implement** `loadMobilePreferences()` / `saveMobilePreferences()` through `authorizedAtlasFetch`.
- [ ] **Step 7: Run** focused tests and verify PASS.
- [ ] **Step 8: Commit** `feat: persist mobile preferences with rls`.

### Task 2: Implement Privacy settings with observed permission evidence

**Files:**
- Create: `apps/web/src/modules/settings/PrivacySettingsPage.tsx`
- Create: `apps/web/src/mobile/permissionObserver.ts`
- Modify: `apps/web/src/modules/settings/MobileSettingsRoutes.tsx`
- Test: `tests/unit/mobile-permission-observer.test.ts`
- Test: `tests/integration/mobile-privacy-settings.test.tsx`

**Interfaces:**
- Consumes: `normalizePermissionEvidence()` from the mobile package and persisted ATLAS privacy preferences from Task 1.
- Produces: `observeBrowserPermission(type): Promise<MobilePermissionEvidence>` for microphone/camera/location/notifications where browser APIs allow observation.

- [ ] **Step 1: Write failing observer tests** for supported query, denied, prompt/not-determined, absent API, thrown browser error and unsupported permission name.
- [ ] **Step 2: Implement** `observeBrowserPermission()` without triggering permission prompts merely to render the settings page.
- [ ] **Step 3: Run** observer tests and verify PASS.
- [ ] **Step 4: Write failing UI tests** proving observed OS state is separate from ATLAS preference toggles and unknown/unsupported are rendered literally.
- [ ] **Step 5: Implement** `PrivacySettingsPage` with point-of-use explanations and no automatic permission request on page load.
- [ ] **Step 6: Wire** `/settings/privacy` to the real page and persist only ATLAS-owned preferences.
- [ ] **Step 7: Run** focused tests and verify PASS.
- [ ] **Step 8: Commit** `feat: add truthful mobile privacy controls`.

### Task 3: Add fail-closed billing entitlement normalization

**Files:**
- Create: `packages/mobile-experience/billing.ts`
- Modify: `packages/mobile-experience/index.ts`
- Modify: `supabase/functions/atlas-mobile/index.ts`
- Create: `apps/web/src/mobile/billing.ts`
- Create: `apps/web/src/modules/settings/BillingSettingsPage.tsx`
- Modify: `apps/web/src/modules/settings/MobileSettingsRoutes.tsx`
- Test: `tests/unit/mobile-billing-evidence.test.ts`
- Test: `tests/integration/mobile-billing-route.test.tsx`

**Interfaces:**
- Produces: `BillingEntitlementSnapshot` with `active_verified | trial_verified | past_due_verified | canceled_verified | pending | unverified | provider_error | unsupported_runtime`.
- Produces: `normalizeBillingEvidence(raw, now)` and gateway `GET ?api=entitlements`.
- Consumes: only canonical ATLAS billing/provider evidence that the server can actually access; absence returns `unverified`.

- [ ] **Step 1: Write failing unit tests** for valid current evidence, stale evidence, malformed provider state, missing provider and explicit provider error.
- [ ] **Step 2: Implement** `normalizeBillingEvidence()` with an explicit freshness threshold constant and no optimistic fallback.
- [ ] **Step 3: Run** unit tests and verify PASS.
- [ ] **Step 4: Add failing gateway tests** proving no evidence -> `unverified`, provider exception -> `provider_error`, and client input cannot declare itself paid.
- [ ] **Step 5: Extend** `atlas-mobile?api=entitlements` to read only server-side canonical evidence; if no canonical provider adapter is configured, return `unverified` rather than creating a fake adapter.
- [ ] **Step 6: Implement** `BillingSettingsPage` showing evidence source/time and disabling restore/purchase controls on web when no authorized provider operation exists.
- [ ] **Step 7: Run** focused tests and verify PASS.
- [ ] **Step 8: Commit** `feat: add evidence backed billing status`.

### Task 4: Build recursive diagnostic redaction and preview

**Files:**
- Create: `packages/mobile-experience/diagnostics.ts`
- Modify: `packages/mobile-experience/index.ts`
- Modify: `supabase/functions/atlas-mobile/index.ts`
- Create: `apps/web/src/mobile/diagnostics.ts`
- Create: `apps/web/src/modules/settings/DiagnosticsPage.tsx`
- Modify: `apps/web/src/modules/settings/MobileSettingsRoutes.tsx`
- Test: `tests/unit/mobile-diagnostics-redaction.test.ts`
- Test: `tests/integration/mobile-diagnostics-preview.test.tsx`

**Interfaces:**
- Produces: `DiagnosticBundle`, `redactDiagnosticValue(value)`, `buildDiagnosticBundle(input)`.
- Produces gateway operation: `POST ?api=diagnostics` only when the user explicitly submits a previewed bundle.

- [ ] **Step 1: Write failing redaction tests** for nested objects/arrays containing authorization headers, cookies, JWT-like tokens, passwords, API keys, recovery codes and ordinary non-secret IDs.
- [ ] **Step 2: Implement** recursive redaction with a fixed sensitive-key matcher and token-pattern redaction; preserve structure but replace sensitive values with `[REDACTED]`.
- [ ] **Step 3: Run** unit tests and verify PASS.
- [ ] **Step 4: Write failing UI tests** for category preview, optional-details opt-in, cancel-without-submit and successful metadata-only submission.
- [ ] **Step 5: Implement** `DiagnosticsPage` using app/build/runtime/route/correlation/readiness information actually available in ATLAS.
- [ ] **Step 6: Extend** gateway submission to re-redact server-side before any persistence/forwarding and emit an audit event only after accepted submission.
- [ ] **Step 7: Run** focused tests and verify PASS.
- [ ] **Step 8: Commit** `feat: add redacted support diagnostics`.

### Task 5: Add ATLAS-specific contextual mobile help

**Files:**
- Create: `apps/web/src/modules/knowledge/mobileHelp.ts`
- Create: `apps/web/src/modules/knowledge/MobileHelpPage.tsx`
- Modify: `apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/navigation/atlasNavigation.ts`
- Test: `tests/unit/mobile-help-content.test.ts`
- Test: `tests/integration/mobile-help-route.test.tsx`

**Interfaces:**
- Produces route: `/knowledge/mobile`.
- Produces: `MOBILE_HELP_TOPICS` with topic id, title, platform scope, current ATLAS capability requirement, troubleshooting steps and freshness metadata.

- [ ] **Step 1: Write failing content tests** requiring every topic to declare `platforms`, `capability`, `updatedAt` and no OpenAI/ChatGPT branding presented as ATLAS functionality.
- [ ] **Step 2: Implement** ATLAS-owned help topics for Assistant continuity, account/settings, privacy, identity recovery, billing evidence, diagnostics and web-vs-native capability boundaries.
- [ ] **Step 3: Run** content tests and verify PASS.
- [ ] **Step 4: Write failing route test** for search/filter, contextual links and native-required labels on web.
- [ ] **Step 5: Implement** `MobileHelpPage` and link it from `KnowledgeAtlasPage`, settings errors and the navigation graph.
- [ ] **Step 6: Run** focused tests and verify PASS.
- [ ] **Step 7: Commit** `feat: add contextual ATLAS mobile help`.

### Task 6: Evidence/support verification

**Files:**
- Modify only if verification identifies a defect in Tasks 1-5.

**Interfaces:**
- Produces: production-candidate evidence/support slice without unsupported success claims.

- [ ] **Step 1: Run** all new mobile unit and integration tests.
- [ ] **Step 2: Run** `npm run typecheck`.
- [ ] **Step 3: Run** `npm run test:unit`.
- [ ] **Step 4: Run** `npm run test:integration`.
- [ ] **Step 5: Run** `npm run build`.
- [ ] **Step 6: Inspect** rendered privacy/billing/diagnostics/help states for phone/tablet/desktop and verify no provider/native capability is represented as live without evidence.
- [ ] **Step 7: Commit verification fixes, if any** as `fix: close mobile evidence verification gaps`.
