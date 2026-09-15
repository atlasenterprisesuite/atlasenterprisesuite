# ATLAS OS Settings P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persistent, tenant-safe personal OS settings and organization policy with a protected responsive `/settings` workspace.

**Architecture:** PostgreSQL RPCs derive identity and organization membership server-side, normalize and version-check writes, and record audit history. The implementation reuses `atlas_user_preferences`, `organization_settings`, and `audit_logs`; OS-specific state is namespaced under `os` rather than creating parallel settings or audit tables. The React workspace calls only the RPCs through the existing authenticated ATLAS fetch helper and calculates an effective policy from personal preferences plus organization restrictions.

**Tech Stack:** TypeScript, React 18, Vitest, Supabase/PostgreSQL RLS and RPC, existing ATLAS Identity/session client.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-os-settings-p1-design.md`

## Global Constraints

- Never trust tenant identifiers from browser input.
- Organization writes require owner/admin authorization.
- Reuse canonical settings/audit rails rather than duplicate them.
- Native adapter status remains fail-closed and `not_verified` without evidence.
- All OS settings writes use optimistic versions and produce audit records.
- UI must expose loading/error/success/conflict states and be responsive.
- No capability is marked production-complete from code/CI alone.

---

### Task 1: Domain contract

**Files:**
- Create: `packages/core/src/os-settings.ts`
- Test: `tests/unit/os-settings-p1.test.ts`

**Interfaces:**
- Produces: `normalizePersonalOsSettings`, `normalizeOrganizationOsPolicy`, `effectiveOsSettings`, `canManageOrganizationOsSettings`.

- [x] **Step 1: Write the failing unit contract** importing the OS settings model and asserting bounded retention, notification allow-listing and stricter organization policy.
- [x] **Step 2: Confirm the contract initially cannot resolve `packages/core/src/os-settings`.**
- [x] **Step 3: Implement the minimal typed settings model and normalization helpers.**
- [ ] **Step 4: Run the unit suite and require PASS.**
- [x] **Step 5: Commit the task implementation.**

### Task 2: Durable tenant-safe persistence

**Files:**
- Create: `supabase/migrations/20260915100000_os_settings_p1.sql`
- Test: `tests/unit/os-settings-p1.test.ts`

**Interfaces:**
- Produces RPC `get_os_settings()` and `update_os_settings(p_scope text, p_settings jsonb, p_expected_version bigint)`.

- [x] **Step 1: Add contract assertions for `auth.uid()`, membership derivation, version conflicts, owner/admin organization writes, and reuse of canonical settings/audit rails.**
- [x] **Step 2: Add OS version counters to existing personal/organization settings, preserve unrelated JSON keys, implement normalization RPC helpers, versioned writes and `audit_logs` events.**
- [ ] **Step 3: Apply the migration to a verification environment and exercise two users/two organizations.**
- [ ] **Step 4: Record migration and denial evidence before production promotion.**

### Task 3: Authenticated web client

**Files:**
- Create: `apps/web/src/modules/os/settingsApi.ts`
- Test: `tests/unit/os-settings-p1.test.ts`

**Interfaces:**
- Produces: `getOsSettings`, `savePersonalOsSettings`, `saveOrganizationOsPolicy`.

- [x] **Step 1: Add source contract proving writes do not submit an organization identifier.**
- [x] **Step 2: Implement RPC wrappers on `authorizedAtlasFetch` with version-conflict normalization.**
- [ ] **Step 3: Run unit tests and typecheck.**

### Task 4: Protected responsive workspace

**Files:**
- Create: `apps/web/src/modules/os/OsSettingsPage.tsx`
- Create: `apps/web/src/modules/os/os-settings.css`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/unit/os-settings-p1.test.ts`

**Interfaces:**
- Consumes: settings API and domain normalization/effective-policy functions.
- Produces: authenticated route `/settings`.

- [x] **Step 1: Add route/UI source contract for identity protection, truthful adapter status and responsive CSS.**
- [x] **Step 2: Implement loading/error/conflict/success UI, personal preferences, admin-only organization policy, effective preview, reload and JSON export.**
- [x] **Step 3: Add Settings to global navigation.**
- [ ] **Step 4: Run `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build`.**
- [x] **Step 5: Open draft PR #163 and require CI evidence before merge/deploy.**

### Task 5: Production verification

**Files:**
- Update evidence documentation only after verified deployment.

- [ ] **Step 1: Verify `/settings` through a real authenticated production session.**
- [ ] **Step 2: Verify personal persistence after reload and a stale-version conflict.**
- [ ] **Step 3: Verify member cannot change organization policy while owner/admin can.**
- [ ] **Step 4: Verify a second user and second organization cannot read or mutate foreign settings.**
- [ ] **Step 5: Verify audit rows persist and responsive behavior on mobile/tablet/desktop.**
- [ ] **Step 6: Only then consider changing `os.settings` maturity from `planned-or-existing-unverified`.**
