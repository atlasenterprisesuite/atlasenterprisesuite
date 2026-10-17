# ATLAS Mobile Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved ATLAS Mobile Experience through independently testable foundation, Assistant, evidence/support and Apple-native bridge increments, followed by one exact-revision production verification gate.

**Architecture:** Execute four focused implementation plans in dependency order. Web/mobile functionality extends the canonical `apps/web` + Supabase architecture; Apple-native capabilities remain focused Swift bridges and cannot be called production-ready until an actual native host/device proves them.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest, Supabase/Postgres/RLS/Edge Functions, Swift Package Manager, existing ATLAS Cloudflare deployment path.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-mobile-experience-design.md`

## Global Constraints

- Canonical repo: `atlasenterprisesuite/atlasenterprisesuite`; integration target: `main`.
- Reuse ATLAS identity, tenancy, RBAC, audit, Assistant, Knowledge and provider architecture.
- No connected/verified/granted/paid/active/restored success state without authenticated evidence.
- No fake native capability from responsive web.
- No second identity, billing, assistant, audit or deployment source of truth.
- TDD for implementation tasks; focused commits; full verification before merge/deploy claims.
- Web production completion requires Cloudflare deployment and exact-revision public verification.
- Native readiness requires actual supported Apple runtime verification; source/tests alone are insufficient.

## Review Focus

- Web browser on iPhone/iPad must never be classified as a native ATLAS app without bridge evidence.
- Cross-tenant requests must fail server-side even if client UI state is manipulated.
- Stale provider/billing/identity snapshots must visibly degrade to stale/unverified rather than retain green success state.
- Offline/retry paths must not duplicate mutations, messages, purchases or destructive actions.
- Production verification must prove the deployed commit SHA rather than infer success from CI/build alone.

---

### Task 1: Implement the mobile foundation

**Files:**
- Plan: `docs/superpowers/plans/2026-10-04-atlas-mobile-foundation.md`

**Interfaces:**
- Produces: mobile runtime/capability contracts, `atlas-mobile` gateway, consolidated settings routes, responsive shell integration and identity diagnostics.

- [ ] **Step 1: Execute every task** in `2026-10-04-atlas-mobile-foundation.md` in order with its TDD/commit gates.
- [ ] **Step 2: Verify** that foundation plan's full typecheck/unit/integration/navigation/build gate passes before Task 2 begins.

### Task 2: Implement Assistant continuity and history

**Files:**
- Plan: `docs/superpowers/plans/2026-10-04-atlas-mobile-assistant.md`

**Interfaces:**
- Consumes: runtime/settings foundation from Task 1.
- Produces: mobile/tablet Assistant history/search/resume, acknowledgement-safe sending and current provider evidence.

- [ ] **Step 1: Execute every task** in `2026-10-04-atlas-mobile-assistant.md`.
- [ ] **Step 2: Verify** focused Assistant tests plus typecheck/build before Task 3 begins.

### Task 3: Implement privacy, billing evidence, diagnostics and mobile help

**Files:**
- Plan: `docs/superpowers/plans/2026-10-04-atlas-mobile-evidence-support.md`

**Interfaces:**
- Consumes: mobile gateway/settings foundation from Task 1 and canonical Knowledge/session/audit systems.
- Produces: RLS-scoped preferences, truthful privacy state, fail-closed billing evidence, redacted diagnostics and `/knowledge/mobile`.

- [ ] **Step 1: Execute every task** in `2026-10-04-atlas-mobile-evidence-support.md`.
- [ ] **Step 2: Verify** migrations/RLS, unit/integration suites, typecheck and build before Task 4 begins.

### Task 4: Implement Apple native bridges without creating a parallel app

**Files:**
- Plan: `docs/superpowers/plans/2026-10-04-atlas-mobile-apple-native.md`

**Interfaces:**
- Consumes: shared mobile contracts from Tasks 1/3.
- Produces: Apple runtime/permission/action bridge, isolated StoreKit bridge and strict native payload envelope.

- [ ] **Step 1: Execute every source-testable task** in `2026-10-04-atlas-mobile-apple-native.md`.
- [ ] **Step 2: Keep actual device-only items explicitly unverified** until a real supported ATLAS Apple host/device is available.
- [ ] **Step 3: Do not create `apps/ios`** merely to satisfy the plan; that requires a separate approved host-app spec if/when bridge integration proves it necessary.

### Task 5: Close missing account/preferences/about surfaces

**Files:**
- Create: `apps/web/src/modules/settings/AccountSettingsPage.tsx`
- Create: `apps/web/src/modules/settings/PreferencesSettingsPage.tsx`
- Create: `apps/web/src/modules/settings/AboutSettingsPage.tsx`
- Modify: `apps/web/src/modules/settings/MobileSettingsRoutes.tsx`
- Reuse: `apps/web/src/mobile/preferences.ts`
- Reuse: `apps/web/src/lib/atlasSession.ts`
- Test: `tests/integration/mobile-account-preferences-about.test.tsx`

**Interfaces:**
- Consumes: persisted mobile preferences and safe authenticated account/org metadata.
- Produces: real `/settings/account`, `/settings/preferences`, `/settings/about` pages.

- [ ] **Step 1: Write failing UI tests** proving account page uses safe current identity/org values, preferences persist/reload, and About shows only available app/build/runtime metadata.
- [ ] **Step 2: Implement** `AccountSettingsPage` without creating a second profile datastore; unsupported account edits link to the canonical identity/account flow.
- [ ] **Step 3: Implement** `PreferencesSettingsPage` using the RLS-backed preference service from Task 3.
- [ ] **Step 4: Implement** `AboutSettingsPage` using real build/runtime values and explicit `Unavailable` labels when metadata is absent.
- [ ] **Step 5: Wire** all three routes in `MobileSettingsRoutes.tsx` and remove their foundation placeholders.
- [ ] **Step 6: Run** the focused integration test and verify PASS.
- [ ] **Step 7: Commit** `feat: complete mobile account preferences and about settings`.

### Task 6: Validate diagnostics transmission boundary

**Files:**
- Modify: `apps/web/src/modules/settings/DiagnosticsPage.tsx`
- Modify: `supabase/functions/atlas-mobile/index.ts`
- Test: `tests/integration/mobile-diagnostics-transmission-boundary.test.tsx`

**Interfaces:**
- Consumes: redacted `DiagnosticBundle` from Task 3.
- Produces: local preview/export always; external submission only when a real configured support target exists.

- [ ] **Step 1: Write failing tests** proving no support provider -> external submission disabled with `Not configured`, while redacted local copy/export remains available.
- [ ] **Step 2: Ensure** gateway returns explicit `support_target_state: configured | not_configured | unavailable` and never acknowledges an external send it did not perform.
- [ ] **Step 3: If a configured target exists**, test accepted/rejected provider response and audit only real accepted transmissions; otherwise keep the feature gated.
- [ ] **Step 4: Run** the focused test and verify PASS.
- [ ] **Step 5: Commit** `fix: enforce diagnostics transmission boundary`.

### Task 7: Whole-branch verification before integration

**Files:**
- Modify only defects revealed by verification.

**Interfaces:**
- Produces: merge candidate with complete evidence log; does not itself prove production deployment.

- [ ] **Step 1: Run** `npm ci`.
- [ ] **Step 2: Run** `npm run typecheck`.
- [ ] **Step 3: Run** `npm run test:unit`.
- [ ] **Step 4: Run** `npm run test:integration`.
- [ ] **Step 5: Run** `npm run verify:navigation`.
- [ ] **Step 6: Run** `npm run build`.
- [ ] **Step 7: Run** Swift tests for every Apple bridge package changed/created.
- [ ] **Step 8: Browser-verify** `/assistant`, `/settings/*`, `/knowledge/mobile` at phone/tablet/desktop widths, including offline/error/unverified states.
- [ ] **Step 9: Security-review** diagnostics redaction, cross-tenant RLS/API behavior and billing/identity fail-closed labels.
- [ ] **Step 10: Commit verification fixes** in focused commits and re-run affected gates.

### Task 8: Canonical integration and web production verification

**Files:**
- No product code unless release verification exposes a regression.

**Interfaces:**
- Produces: exact Git/CI/deployment/public-route evidence for the web portion only.

- [ ] **Step 1: Open/update a focused implementation PR** targeting `main` with the completed test evidence.
- [ ] **Step 2: Resolve review findings** and require the repository's applicable CI/security gates to pass.
- [ ] **Step 3: Merge only the reviewed exact head SHA** through the canonical Git path.
- [ ] **Step 4: Deploy web changes** through the existing authorized Cloudflare production workflow.
- [ ] **Step 5: Capture the deployed revision/manifest** and prove it corresponds to the merged commit.
- [ ] **Step 6: Verify public production routes** `/assistant`, `/settings/account`, `/settings/preferences`, `/settings/privacy`, `/settings/security`, `/settings/billing`, `/settings/diagnostics`, `/settings/about`, `/knowledge/mobile` for non-404/non-500 behavior and truthful auth gates.
- [ ] **Step 7: Re-check sensitive labels** in production: no verified/granted/paid/active/restored state without current evidence.
- [ ] **Step 8: Mark only the web portion complete** when exact revision + production behavior are both proven.
- [ ] **Step 9: Keep Apple device-only capabilities separately `evidence-needed`** until actual native host/device verification exists.
