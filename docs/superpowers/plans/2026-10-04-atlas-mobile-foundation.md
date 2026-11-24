# ATLAS Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the shared mobile runtime, capability, settings, identity-diagnostics, routing, responsive shell, RBAC and audit foundation required by the ATLAS Mobile Experience.

**Architecture:** Add a focused `packages/mobile-experience` domain for normalized mobile contracts and a thin `atlas-mobile` edge gateway for server-authoritative evidence. Reuse the existing `apps/web` shell, identity/session utilities, route resolver, navigation graph and ATLAS governance; do not create a second application shell or source of truth.

**Tech Stack:** React 18, TypeScript 5.7, React Router, Vitest, Supabase Edge Functions/Deno, existing ATLAS session/RBAC/audit patterns, Vite 6.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-mobile-experience-design.md`

## Global Constraints

- Extend `apps/web`; do not introduce `apps/ios` in this plan.
- Unknown identity, permission, capability or provider evidence must remain unverified/unknown/unsupported; never infer success.
- Tenant/org isolation is server-enforced; client route guards are UX only.
- Reuse `RequireAtlasIdentity`, `atlasSession`, `AtlasShell`, `resolveAtlasExtension`, `atlasNavigation` and existing audit helpers.
- No secrets, raw tokens, cookies, recovery codes or provider credentials in UI, logs or diagnostics.
- Mobile-first layouts must still preserve desktop behavior.
- Every task follows TDD and ends with a focused commit.

## Review Focus

- Safari/iPad browser reports incomplete user-agent or capability data -> runtime becomes `unknown`, never `ios_native`.
- Session token exists but organization resolution fails -> identity shows `unverified/error`, never verified access.
- Browser permission APIs are absent -> permission state is `unsupported` or `unknown`, never granted.
- Cached settings are stale while remote load fails -> show stale/error state and never claim sync success.
- Tablet/phone media-query changes while navigation is open -> shell closes/reflows without trapping scroll or focus.

---

### Task 1: Create normalized mobile domain contracts

**Files:**
- Create: `packages/mobile-experience/types.ts`
- Create: `packages/mobile-experience/runtime.ts`
- Create: `packages/mobile-experience/permissions.ts`
- Create: `packages/mobile-experience/index.ts`
- Test: `tests/unit/mobile-runtime.test.ts`
- Test: `tests/unit/mobile-permissions.test.ts`

**Interfaces:**
- Produces: `MobileRuntimeSnapshot`, `MobileCapabilityState`, `MobilePermissionEvidence`, `normalizeRuntimeSnapshot()`, `normalizePermissionEvidence()`.
- Consumes: no new dependencies; browser/native raw inputs are plain data objects.

- [ ] **Step 1: Write failing runtime tests** asserting web/iPhone/iPad/unknown classification, unknown fallback, stale timestamp preservation and that browser user-agent alone never yields `ios_native`/`ipad_native`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/mobile-runtime.test.ts` and verify failure because the new package does not exist.
- [ ] **Step 3: Implement** `normalizeRuntimeSnapshot(input: RawMobileRuntimeInput): MobileRuntimeSnapshot` in `packages/mobile-experience/runtime.ts` with the spec enums and explicit `runtimeSource` evidence.
- [ ] **Step 4: Run runtime tests** and verify PASS.
- [ ] **Step 5: Write failing permission tests** for `granted | denied | restricted | not_determined | unsupported | unknown`, including missing API -> `unsupported` and malformed input -> `unknown`.
- [ ] **Step 6: Implement** `normalizePermissionEvidence(input: RawPermissionEvidence): MobilePermissionEvidence` in `packages/mobile-experience/permissions.ts`.
- [ ] **Step 7: Run** `npx vitest run tests/unit/mobile-runtime.test.ts tests/unit/mobile-permissions.test.ts` and verify PASS.
- [ ] **Step 8: Commit** `feat: add governed mobile runtime contracts`.

### Task 2: Add the server-authoritative mobile gateway

**Files:**
- Create: `supabase/functions/atlas-mobile/index.ts`
- Reuse: `supabase/functions/_shared/*`
- Test: `tests/integration/mobile-gateway-auth.test.ts`
- Test: `tests/integration/mobile-gateway-evidence.test.ts`

**Interfaces:**
- Consumes: existing authenticated request/session/org resolution and audit helpers from `_shared`.
- Produces: `GET /functions/v1/atlas-mobile?api=status` returning `{ ok, authenticated, organization_id, role, runtime_policy, feature_states }` and `POST ...?api=audit` for allowed metadata-only mobile audit events.

- [ ] **Step 1: Write failing auth tests** proving unauthenticated requests fail closed and authenticated requests cannot select another organization with only a client header.
- [ ] **Step 2: Run** `npx vitest run tests/integration/mobile-gateway-auth.test.ts` and verify FAIL.
- [ ] **Step 3: Implement** the `status` operation by reusing canonical auth/org resolution; do not mint a second session model.
- [ ] **Step 4: Add failing evidence tests** proving missing backend evidence maps to `unverified/unknown` rather than optimistic success.
- [ ] **Step 5: Implement** the normalized evidence response and metadata-only `audit` operation with an allowlist of event names.
- [ ] **Step 6: Run** both gateway integration tests and verify PASS.
- [ ] **Step 7: Commit** `feat: add mobile evidence gateway`.

### Task 3: Add client mobile runtime and gateway service

**Files:**
- Create: `apps/web/src/mobile/runtime.ts`
- Create: `apps/web/src/mobile/client.ts`
- Create: `apps/web/src/mobile/useMobileRuntime.ts`
- Reuse: `apps/web/src/lib/atlasSession.ts`
- Test: `tests/unit/mobile-client.test.ts`

**Interfaces:**
- Consumes: `MobileRuntimeSnapshot` from `packages/mobile-experience`, `authorizedAtlasFetch()` and existing active organization/session state.
- Produces: `captureWebRuntime(): MobileRuntimeSnapshot`, `getMobileStatus()`, `useMobileRuntime()`.

- [ ] **Step 1: Write failing tests** for browser capability capture, unsupported APIs and gateway error normalization.
- [ ] **Step 2: Run** `npx vitest run tests/unit/mobile-client.test.ts` and verify FAIL.
- [ ] **Step 3: Implement** `captureWebRuntime()` using only observable browser facts; native state remains impossible without bridge evidence.
- [ ] **Step 4: Implement** `getMobileStatus()` through `authorizedAtlasFetch('/functions/v1/atlas-mobile?api=status')` and fail closed on malformed responses.
- [ ] **Step 5: Implement** `useMobileRuntime()` to combine local capability detection with server evidence while retaining explicit loading/error/stale state.
- [ ] **Step 6: Run** the focused test and verify PASS.
- [ ] **Step 7: Commit** `feat: expose mobile runtime state to web`.

### Task 4: Create consolidated settings routes and shell

**Files:**
- Create: `apps/web/src/modules/settings/MobileSettingsRoutes.tsx`
- Create: `apps/web/src/modules/settings/MobileSettingsLayout.tsx`
- Create: `apps/web/src/modules/settings/mobileSettings.css`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/navigation/atlasNavigation.ts`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/integration/mobile-settings-routes.test.tsx`
- Test: `tests/integration/atlas-mobile-shell.test.tsx`

**Interfaces:**
- Consumes: `RequireAtlasIdentity`, `useMobileRuntime()`, existing ATLAS navigation and shell patterns.
- Produces routes: `/settings/account`, `/settings/preferences`, `/settings/privacy`, `/settings/security`, `/settings/billing`, `/settings/diagnostics`, `/settings/about`.

- [ ] **Step 1: Write failing route tests** asserting every settings route resolves behind identity and unknown routes do not silently redirect to success screens.
- [ ] **Step 2: Run** `npx vitest run tests/integration/mobile-settings-routes.test.tsx` and verify FAIL.
- [ ] **Step 3: Implement** `MobileSettingsRoutes` and `MobileSettingsLayout` with responsive phone/tablet navigation, loading/empty/error/unsupported states and placeholders that are explicitly `Unavailable` until later plans wire real domain actions.
- [ ] **Step 4: Register** the settings family in `resolveAtlasExtension.tsx` before generic fallthrough and add searchable nodes in `atlasNavigation.ts`.
- [ ] **Step 5: Write failing shell tests** for phone drawer close-on-navigation, iPad/tablet layout, Escape close, desktop media transition and body overflow restoration.
- [ ] **Step 6: Modify** `AtlasShell.tsx` only where needed to expose a Settings entry and preserve existing accessibility/mobile-nav behavior.
- [ ] **Step 7: Run** both integration tests and verify PASS.
- [ ] **Step 8: Commit** `feat: add consolidated mobile settings routes`.

### Task 5: Implement identity diagnostics without secret exposure

**Files:**
- Create: `apps/web/src/modules/settings/IdentityDiagnosticsPage.tsx`
- Create: `apps/web/src/mobile/identityDiagnostics.ts`
- Reuse: `apps/web/src/identity/IdentityPage.tsx`
- Reuse: `apps/web/src/lib/atlasSession.ts`
- Modify: `apps/web/src/modules/settings/MobileSettingsRoutes.tsx`
- Test: `tests/unit/mobile-identity-diagnostics.test.ts`
- Test: `tests/integration/mobile-identity-diagnostics-route.test.tsx`

**Interfaces:**
- Produces: `classifyIdentityDiagnostics(input): IdentityDiagnosticSnapshot` with states `verified | unverified | expired | unavailable | error`.
- Consumes: only safe session/org/MFA evidence already exposed by canonical identity utilities or the mobile gateway.

- [ ] **Step 1: Write failing unit tests** for verified, expired, token-without-org, unavailable and malformed evidence; assert serialized output contains no token/cookie/header fields.
- [ ] **Step 2: Implement** `classifyIdentityDiagnostics()` and a redacted snapshot type.
- [ ] **Step 3: Run** the unit test and verify PASS.
- [ ] **Step 4: Write failing route test** proving the UI labels unknown evidence as unverified and never renders raw access token values.
- [ ] **Step 5: Implement** `IdentityDiagnosticsPage` and wire it to `/settings/security` with links to the existing `/identity` recovery surface rather than duplicating sign-in.
- [ ] **Step 6: Run** focused tests and verify PASS.
- [ ] **Step 7: Commit** `feat: add fail-closed identity diagnostics`.

### Task 6: Full foundation verification

**Files:**
- Modify only if verification exposes a defect in files owned by Tasks 1-5.

**Interfaces:**
- Produces: verified foundation branch state suitable for the next mobile plans.

- [ ] **Step 1: Run** `npm run typecheck` and require exit 0.
- [ ] **Step 2: Run** `npm run test:unit` and require exit 0.
- [ ] **Step 3: Run** `npm run test:integration` and require exit 0.
- [ ] **Step 4: Run** `npm run verify:navigation` and require exit 0.
- [ ] **Step 5: Run** `npm run build` and require exit 0.
- [ ] **Step 6: Confirm** no new route claims native Apple capability and no verified/granted labels appear without evidence.
- [ ] **Step 7: Commit verification-only fixes, if any** as `fix: close mobile foundation verification gaps`.
