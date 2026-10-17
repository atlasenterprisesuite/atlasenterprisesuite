# ATLAS Reconnect Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Chromium Manifest V3 extension that accepts evidence-backed work-search records, validates claim-week/duplicate/evidence constraints, fills supported Florida Reconnect work-search fields, and always stops before certification or submission.

**Architecture:** Add a focused workspace at `apps/reconnect-autofill-extension` with pure TypeScript domain validation, a versioned Reconnect DOM adapter, an ATLAS-styled popup/review surface, and a content-script bridge. Use two Vite builds so the popup is a normal HTML entry while the content script is bundled as a single IIFE; tests run in the repository's existing Vitest/jsdom stack using static Reconnect fixtures.

**Tech Stack:** TypeScript 5.7, Vite 6, Vitest 5/jsdom, Chromium Manifest V3, existing npm workspaces and ATLAS CI conventions. No new runtime dependency is required.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-reconnect-autofill-design.md`

## Global Constraints

- Initial scope is weekly work-search contact entry only; no autonomous claim submission.
- Every populated factual value must be evidence-backed or explicitly user-entered; missing facts remain blank.
- Claim-week bounds are explicit inputs and inclusive; never substitute a later response/rejection date for the original contact date.
- Duplicate fingerprint: normalized claim week + contact date + employer + job title + optional reference number.
- Initial official host allowlist is `https://connect.myflorida.com/*`; no `<all_urls>` permission.
- No credential, MFA/passkey, security-answer, SSN, bank/payment, or unrelated-page capture/persistence.
- Imported records are session-scoped in the first release and removable through `Clear Session Data`.
- Existing destination values are preserved by default; ambiguous or unknown field mappings fail closed.
- `Next`, `Submit`, `Certify`, `Acknowledge`, and equivalent legal/certification controls are never activated by the extension.
- Automated E2E verification uses static/local fixtures only; production automation must not submit a benefit claim.

## Review Focus

1. A valid-looking record with no evidence for a populated field must be blocked or downgraded rather than filled.
2. A changed Reconnect page with two plausible inputs for the same canonical field must fail closed without mutating the page.
3. Existing user-entered destination values must survive autofill unchanged.
4. A final certification/acknowledgment page must never be treated as a work-search form, even if it contains similarly named controls.
5. Clearing session data must remove imported work-search records and diagnostics without touching Reconnect page data.

---

### Task 1: Workspace and canonical work-search validation

**Files:**
- Create: `apps/reconnect-autofill-extension/package.json`
- Create: `apps/reconnect-autofill-extension/tsconfig.json`
- Create: `apps/reconnect-autofill-extension/src/core/types.ts`
- Create: `apps/reconnect-autofill-extension/src/core/validation.ts`
- Create: `apps/reconnect-autofill-extension/src/core/duplicates.ts`
- Test: `tests/unit/reconnect-autofill-validation.test.ts`

**Interfaces:**
- Produces: `WorkSearchRecord`, `EvidenceReference`, `VerificationStatus`, `validateWorkSearchRecord(record)`, `validateWorkSearchBatch(records)`, `createDuplicateFingerprint(record)`.

- [ ] **Step 1: Write failing validation tests** for required canonical fields, evidence-backed populated fields, inclusive week boundaries, outside-week rejection, unsupported/partial states, conflict blocking, and normalized duplicate detection.
- [ ] **Step 2: Run** `npx vitest run tests/unit/reconnect-autofill-validation.test.ts`; expect FAIL because the core modules do not exist.
- [ ] **Step 3: Implement** the exact interfaces above with deterministic fail-closed validation; no network or browser APIs in core modules.
- [ ] **Step 4: Re-run** the focused test; expect PASS.
- [ ] **Step 5: Commit** `feat(reconnect): add evidence-backed work search validation`.

### Task 2: Reconnect destination adapter with mutation guards

**Files:**
- Create: `apps/reconnect-autofill-extension/src/reconnect/adapter.ts`
- Create: `apps/reconnect-autofill-extension/src/reconnect/field-map.ts`
- Create: `tests/fixtures/reconnect/work-search.html`
- Create: `tests/fixtures/reconnect/ambiguous-work-search.html`
- Create: `tests/fixtures/reconnect/final-certification.html`
- Test: `tests/unit/reconnect-autofill-adapter.test.ts`

**Interfaces:**
- Consumes: `WorkSearchRecord` from Task 1.
- Produces: `detectReconnectPage(document, location): ReconnectPageDetection`, `mapReconnectFields(document): FieldMapResult`, `fillReconnectRecord(document, record, options): FillResult`.

- [ ] **Step 1: Write failing fixture tests** proving supported-form detection, semantic label/name/id mapping, ambiguous mapping rejection, unknown-origin rejection, final-certification rejection, existing-value preservation, native `input`/`change` event dispatch, and no click on certification controls.
- [ ] **Step 2: Run** `npx vitest run tests/unit/reconnect-autofill-adapter.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** versioned semantic mapping and transactional preflight: resolve all required target fields before the first mutation; if detection or required mapping is unsafe, return `blocked` and change nothing.
- [ ] **Step 4: Re-run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `feat(reconnect): add fail-closed Reconnect adapter`.

### Task 3: Session store and extension message contract

**Files:**
- Create: `apps/reconnect-autofill-extension/src/core/session.ts`
- Create: `apps/reconnect-autofill-extension/src/core/messages.ts`
- Test: `tests/unit/reconnect-autofill-session.test.ts`

**Interfaces:**
- Consumes: Task 1 validation output.
- Produces: `createSessionStore()`, `importRecords(jsonText)`, `clearSession()`, `ReconnectExtensionMessage`, `ReconnectExtensionResponse`.

- [ ] **Step 1: Write failing tests** for valid JSON import, malformed/unknown-shape rejection, duplicate/outside-week exclusion from ready count, session-only clear behavior, and zero credential/security-field persistence.
- [ ] **Step 2: Run** `npx vitest run tests/unit/reconnect-autofill-session.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** an in-memory store only; do not use `localStorage`, IndexedDB, remote APIs, or persistent `chrome.storage.local`.
- [ ] **Step 4: Re-run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `feat(reconnect): add session-local record store`.

### Task 4: Popup, review overlay, and content-script bridge

**Files:**
- Create: `apps/reconnect-autofill-extension/popup.html`
- Create: `apps/reconnect-autofill-extension/src/popup.ts`
- Create: `apps/reconnect-autofill-extension/src/popup.css`
- Create: `apps/reconnect-autofill-extension/src/content.ts`
- Create: `apps/reconnect-autofill-extension/src/reconnect/review-overlay.ts`
- Test: `tests/unit/reconnect-autofill-ui.test.ts`
- Test: `tests/integration/reconnect-autofill-flow.test.ts`

**Interfaces:**
- Consumes: session/message contracts and adapter from Tasks 1–3.
- Produces: popup actions `Import`, `Fill current record`, `Fill verified contacts`, `Clear Session Data`; page review overlay with filled/missing/blocked summary.

- [ ] **Step 1: Write failing UI/integration tests** for empty/loading/verified/partial/blocked/filled/mapping-changed/error states, claim-week display, evidence counts, keyboard semantics, screen-reader status text, and the full import → validate → fill fixture → review flow.
- [ ] **Step 2: Run** `npx vitest run tests/unit/reconnect-autofill-ui.test.ts tests/integration/reconnect-autofill-flow.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** accessible DOM UI with ATLAS visual tokens local to the extension; message the content script only after validation, fill records sequentially, and return focus to the review status after each operation.
- [ ] **Step 4: Re-run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `feat(reconnect): add local autofill review experience`.

### Task 5: Manifest V3 packaging and least-privilege build

**Files:**
- Create: `apps/reconnect-autofill-extension/public/manifest.json`
- Create: `apps/reconnect-autofill-extension/vite.popup.config.ts`
- Create: `apps/reconnect-autofill-extension/vite.content.config.ts`
- Create: `apps/reconnect-autofill-extension/scripts/verify-package.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/unit/reconnect-autofill-manifest.test.ts`

**Interfaces:**
- Produces: loadable `apps/reconnect-autofill-extension/dist/` with popup, single bundled `content.js`, and Manifest V3 metadata.

- [ ] **Step 1: Write failing manifest/package tests** requiring `manifest_version: 3`, `https://connect.myflorida.com/*` only, no `<all_urls>`, no external code/eval permissions, popup entry, content script entry, and absence of persistent storage permission.
- [ ] **Step 2: Run** `npx vitest run tests/unit/reconnect-autofill-manifest.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** workspace scripts: `typecheck`, two-pass Vite build (popup first; content IIFE second with `emptyOutDir: false`), and package verifier that asserts required output files and manifest constraints.
- [ ] **Step 4: Add root scripts** `typecheck:reconnect`, `build:reconnect`, and `verify:reconnect`; include `npm run verify:reconnect` in `verify:all` without changing the existing production web build semantics.
- [ ] **Step 5: Run** `npm run verify:reconnect`; expect PASS.
- [ ] **Step 6: Commit** `build(reconnect): package least-privilege MV3 extension`.

### Task 6: Dedicated CI and whole-repository verification

**Files:**
- Create: `.github/workflows/atlas-reconnect-autofill-ci.yml`
- Modify only test/build configuration if required by verified failures.

**Interfaces:**
- Produces: PR evidence for domain tests, fixture integration, extension typecheck/build/package security, and repository regression gates.

- [ ] **Step 1: Add CI** triggered on PR changes under the extension, reconnect tests/fixtures, plan/spec, root package files, or this workflow; use Node 22, `npm ci`, focused Vitest suites, `npm run verify:reconnect`, and `npm run typecheck`.
- [ ] **Step 2: Run focused suite locally**: `npx vitest run tests/unit/reconnect-autofill-*.test.ts tests/integration/reconnect-autofill-flow.test.ts`; expect all PASS.
- [ ] **Step 3: Run** `npm run verify:reconnect`; expect PASS and a loadable extension bundle.
- [ ] **Step 4: Run** `npm run verify:all`; repair only failures attributable to this branch and require all canonical gates PASS.
- [ ] **Step 5: Update/open the implementation PR** with spec, plan, TDD evidence and package instructions; do not claim deployment because this first increment is a local extension, not a production web route.
- [ ] **Step 6: Require CI success** before merge; final acceptance is the exact merged source revision plus successful CI/package evidence. Loading the extension into the user's browser remains a user/device action.

## Self-review result

Coverage checked against all 20 spec sections. The plan covers canonical evidence/schema semantics, week validation, duplicate detection, unsupported/conflicting evidence, local session retention, official-origin allowlisting, destination mapping, non-overwrite behavior, event dispatch, human-review boundaries, accessible ATLAS UI, Manifest V3 packaging, static-fixture E2E, and dedicated CI. The first increment intentionally does not add Gmail parsing, ATLAS cloud persistence, Supabase, authentication, CAPTCHA handling, or autonomous benefit submission; those remain outside scope or future producer integrations. Interface names are consistent across tasks, and every Review Focus condition is assigned to a concrete unit/integration test.