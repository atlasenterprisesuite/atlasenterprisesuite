# ATLAS BioScan Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 1 of ATLAS BioScan as a production-safe foundation: versioned domain contracts, explicit consent, provenance-aware session state, immutable Human Digital Twin history, a camera-only capture shell, protected Health routes, audited export/deletion, and fail-closed production verification without fabricating body metrics or sensor readiness.

**Architecture:** Reuse the existing ATLAS identity/session boundary, `atlas-platform-controls` Supabase Edge Function, organization-scoped RLS conventions, `HealthExperiencePage`, and Cloudflare production-verification pipeline. The browser may request a local camera stream, but Phase 1 does not persist raw frames or pretend that camera pixels alone produce clinical measurements. All canonical mutations flow through the JWT-protected control plane; persisted rows are organization- and subject-scoped; Human Digital Twin snapshots are immutable; audit events are emitted server-side. Only `/health/bioscan` and `/health/body-twin` ship in this phase. Later routes from the design remain absent until their own implementation phase.

**Tech Stack:** TypeScript, React 18, React Router 7, Vite, Vitest, Supabase/PostgreSQL, Supabase Edge Functions, existing ATLAS Cloudflare Worker deployment/verification.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-bioscan-human-digital-twin-design.md`

## Global Constraints

- Preserve the core truth rule: `NO DATA → NO CLAIM`.
- Never display BPM, temperature, body-fat percentage, muscle mass, diagnosis, or any other measurement unless a real source and provenance record exist.
- Phase 1 is a camera-only capture shell. Missing depth/LiDAR capability degrades explicitly; it does not fabricate a depth result.
- Do not persist raw camera frames, photos, video, or base64 image payloads in Phase 1. The `MediaStream` remains local to the browser.
- Keep `tenant_id = org_id` for canonical persisted BioScan rows and enforce active organization membership.
- Enforce subject scope in addition to organization scope. A same-organization user does not automatically gain access to another subject's BioScan data.
- Browser clients do not directly mutate canonical BioScan tables. Writes go through `atlas-platform-controls`; canonical table INSERT/UPDATE/DELETE privileges stay service-controlled.
- Human Digital Twin snapshots are immutable after creation. A new scan creates a new snapshot.
- Authorization, consent, provenance integrity, and subject-scope failures are fail-closed.
- Reuse the existing ATLAS audit log. Audit payloads must not contain raw images, bearer tokens, secrets, or unnecessary body-detail payloads.
- Use complete UI states: loading, empty, active, disabled, camera-denied, backend-error, cancelled, partial, complete. Do not implement fake timers, fake percentages, `href="#"`, fake console actions, or `Coming Soon` controls.
- Build the approved blue/silver BioScan visual language as responsive product UI. The generated concept image is a visual reference, not a static screen used as the application.
- Keep Health OS, CleanScan 3D, Device DNA, and BioScan responsibilities separate. Phase 1 must not claim that a scanner, wearable, smart scale, clinical device, EHR, or hospital system is connected unless an actual verified adapter exists.
- Do not add `/health/body-twin/progress`, `/health/posture`, `/health/physique`, or `/cleanscan/human` yet. Those belong to later plans.

## Review Focus

Reviewers should explicitly verify these failure paths in addition to the happy path:

1. **Consent revocation race:** consent is granted when a session is prepared, then revoked before capture/complete. The next transition must be rejected; the session cannot become complete.
2. **Cross-subject access:** an authenticated user in the same organization attempts to read another subject's BioScan data without the privileged BioScan-manage permission. RLS/control-plane access must deny it.
3. **Invalid provenance:** a measurement or derived value has a missing/unknown source, blank source reference, invalid confidence, or an estimate incorrectly marked as measured. Validation must reject it rather than silently normalize it.
4. **Retry/idempotency:** a client retries `capturing → capturing`, `complete → complete`, or a snapshot create request. The system must return the canonical result or a controlled conflict without duplicate snapshots or duplicate audit facts.
5. **Camera unavailable:** camera permission is denied, `mediaDevices` is unavailable, or `getUserMedia` fails. UI must show an explicit blocked/degraded state; no session may appear complete and no synthetic values may appear.

---

### Task 1: Versioned BioScan domain contracts and truth invariants

**Files:**
- Create: `apps/web/src/modules/health/bioscan/bioscanContracts.ts`
- Create: `tests/unit/health-bioscan-contracts.test.ts`

**Interfaces:**
- Export `BIOSCAN_API_VERSION = 1`.
- Define `BioScanSessionStatus = 'preparing' | 'capturing' | 'processing' | 'complete' | 'partial' | 'failed' | 'cancelled'`.
- Define the approved provenance union: `camera_estimate | depth_sensor | lidar_measurement | wearable | smart_scale | clinical_device | medical_record | user_entered | derived_from_verified_sources`.
- Define Phase-1 capture mode values, including a real `camera` mode and reserved future `camera_depth` / `lidar` values without claiming those modes are currently available.
- Define typed request/response contracts for the full versioned API boundary required by the spec: create session, update state, complete/fail, create/read snapshot, timeline, measurements, posture observations, compare, sensor attachment, provenance resolution, export, and subject-data deletion.
- Implement pure `canTransitionBioScanSession(from, to)` and `validateBioScanProvenance(input)` helpers.
- Provenance validation must require a supported source type, non-empty source reference, bounded confidence `0..1`, timestamp, `method_version`, and explicit `is_estimate` semantics.
- Camera-derived body geometry values must be tagged as estimates unless a stronger measurement source exists.

**TDD steps:**
- [ ] Write failing unit tests for valid/invalid status transitions, terminal-state behavior, approved provenance values, unsupported source rejection, blank source reference rejection, confidence boundaries, and estimate labeling.
- [ ] Add a failing review-focus test for invalid provenance and confirm it rejects rather than silently downgrades.
- [ ] Run `npm run test:unit -- tests/unit/health-bioscan-contracts.test.ts` and confirm RED because the module does not exist.
- [ ] Implement the smallest domain contract module that satisfies the tests.
- [ ] Re-run the targeted test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit: `feat(health): define BioScan v1 contracts`.

### Task 2: Sensitive-data schema, consent, subject-scoped RLS, and snapshot immutability

**Files:**
- Create: `supabase/migrations/20261005102500_atlas_bioscan_foundation.sql`
- Create: `tests/integration/health-bioscan-schema.test.ts`

**Persistence:**
Create organization/tenant-scoped tables for:

- `bioscan_consents`
- `bioscan_sessions`
- `human_twin_snapshots`
- `body_landmarks`
- `body_measurements`
- `sensor_observations`
- `posture_observations`

Use foreign keys to `public.organizations(id)` and `auth.users(id)`, plus `tenant_id = org_id` checks. Preserve subject ownership on every subject-sensitive table.

**Permissions:**
Register:

- `health.bioscan.read`
- `health.bioscan.capture`
- `health.bioscan.manage`
- `health.bioscan.audit`

Default role grants should remain conservative:

- `owner`, `admin`: read/capture/manage/audit.
- `manager`, `staff`: read/capture only, with subject scope still enforced.
- No role receives cross-subject manage capability merely from ordinary Health access.

**Database invariants:**
- Consent statuses: `granted | revoked | expired` with explicit scope and timestamps.
- Session status/capture-mode checks match the TypeScript contracts.
- Confidence columns are nullable only where the value genuinely has no confidence concept; otherwise constrained to `0..1`.
- Measurement rows require source type, source reference, measured timestamp, estimate flag, and method version.
- Snapshot UPDATE is rejected by a database trigger. New state requires a new snapshot.
- Do not create a raw-frame/blob/image table in Phase 1.
- Enable RLS on every BioScan table.
- Self-subject reads require active organization membership plus `health.bioscan.read`; privileged cross-subject reads require `health.bioscan.manage`.
- Revoke browser INSERT/UPDATE/DELETE privileges on canonical sensitive tables; grant service role the required control-plane access.

**TDD steps:**
- [ ] Write the migration contract test first. Assert table creation, RLS enablement, permission registration, conservative role grants, subject checks, provenance checks, no raw-frame table, browser mutation revocation, and snapshot immutability trigger.
- [ ] Add a failing review-focus assertion that same-org membership alone is insufficient for another subject's rows.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-schema.test.ts` and confirm RED because the migration is absent.
- [ ] Implement the idempotent migration following existing ATLAS migration conventions.
- [ ] Re-run the targeted integration test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit: `feat(health): add BioScan sensitive-data foundation`.

### Task 3: Governed BioScan v1 control-plane operations

**Files:**
- Modify: `supabase/functions/atlas-platform-controls/index.ts`
- Create: `tests/integration/health-bioscan-platform-controls.test.ts`

**Server API:**
Add a `bioscan-v1-` operation family to the existing authenticated control plane. Reuse `actor()`, active-organization checks, `has_identity_permission`, and server-side `audit()`.

Phase-1 handlers to implement:

- `bioscan-v1-capabilities`
- `bioscan-v1-consent-grant`
- `bioscan-v1-consent-revoke`
- `bioscan-v1-session-create`
- `bioscan-v1-session-transition`
- `bioscan-v1-snapshot-create`
- `bioscan-v1-snapshot-read`
- `bioscan-v1-timeline`
- `bioscan-v1-export`
- `bioscan-v1-delete-subject`

The contracts for measurements, posture, compare, sensor attachment, and provenance resolution exist from Task 1, but no fake endpoint is exposed until its backing behavior is implemented in the appropriate later phase.

**Behavior:**
- Require JWT plus `x-atlas-org-id` and active membership.
- Subject is the authenticated user by default. A different `subject_user_id` requires `health.bioscan.manage`.
- Session create requires active `body_scan` consent.
- Session transitions are validated on the server; consent is rechecked before entering `capturing`, `processing`, or `complete/partial`.
- Same-state retries are idempotent and must not emit duplicate audit events.
- Invalid backward/terminal transitions return a controlled conflict.
- Snapshot create only accepts `complete` or `partial` sessions and enforces one canonical snapshot per session/idempotency key.
- Phase 1 snapshots contain only real session metadata, capture/source summaries, and optional non-image geometry metadata. They do not invent measurements.
- Explicitly reject raw image/video/base64 fields or suspiciously oversized capture payloads.
- Export returns a structured subject-owned JSON package with provenance/audit-safe metadata; it never exports secrets.
- Delete-subject is service-governed and audited. It must define whether rows are hard-deleted or tombstoned according to FK/audit constraints, while preserving the audit log itself.

**Audit events:**
Emit the applicable required events: consent granted/revoked, session started/completed/failed, snapshot created/viewed, data exported/deleted. Do not emit `measurement.viewed` or `sensor.connected` until those features exist.

**TDD steps:**
- [ ] Write static/integration contract tests first for authentication, organization scoping, permission checks, consent recheck, allowed operations, subject scope, audit calls, raw-frame rejection, and idempotency paths.
- [ ] Add the consent-revocation-race review-focus test.
- [ ] Add the retry/idempotency review-focus test.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-platform-controls.test.ts` and confirm RED.
- [ ] Implement the control-plane handlers with minimal changes to the existing function.
- [ ] Re-run the targeted test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit: `feat(health): add governed BioScan v1 control plane`.

### Task 4: Browser BioScan API boundary and repository view model

**Files:**
- Create: `apps/web/src/modules/health/bioscan/bioscanApi.ts`
- Create: `apps/web/src/modules/health/bioscan/bioscanRepository.ts`
- Create: `tests/integration/health-bioscan-data-boundary.test.ts`

**Client boundary:**
- Use `getActiveAtlasOrganization()` and `authorizedAtlasFetch()` from the canonical session module.
- Send mutations and audited sensitive reads through `/functions/v1/atlas-platform-controls?api=bioscan-v1-*` with `x-atlas-org-id`.
- Do not POST directly to `/rest/v1/bioscan_*` or any other sensitive canonical table.
- Do not upload `MediaStream`, `Blob`, `File`, image bytes, or base64 payloads in Phase 1.
- Normalize server responses into a small view model for the UI. Preserve source/provenance fields rather than stripping them.
- Keep the repository independently testable; no React state inside the repository.

**TDD steps:**
- [ ] Write failing tests asserting use of the canonical authenticated session/control plane and absence of direct table mutation/raw media serialization.
- [ ] Add tests for backend 401/403/409 and malformed-response propagation.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-data-boundary.test.ts` and confirm RED.
- [ ] Implement API/repository modules.
- [ ] Re-run the targeted test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit: `feat(health): add BioScan browser data boundary`.

### Task 5: Camera-only BioScan capture experience

**Files:**
- Create: `apps/web/src/modules/health/bioscan/useCameraCapture.ts`
- Create: `apps/web/src/modules/health/bioscan/BioScanPage.tsx`
- Create: `apps/web/src/modules/health/bioscan/bioscan.css`
- Create: `tests/integration/health-bioscan-ui.test.tsx`

**UI state machine:**
Implement explicit states for:

- checking capabilities
- consent required
- requesting camera
- camera ready
- camera denied/unavailable
- session preparing
- capturing
- processing metadata
- complete
- partial
- failed/cancelled
- backend unavailable

**Camera behavior:**
- Use `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })`.
- Stop all local tracks on cancel/unmount.
- Do not capture/upload raw frames in this phase.
- If no depth capability exists, show a factual `Camera-only mode` notice. Do not block the session solely because depth/LiDAR is unavailable.
- UI progress reflects actual server/client states, not a timed animation pretending to be scan completion.
- Metrics without a real source render `Not measured`; do not populate the visual-reference values from the generated poster.
- Provide clear truth/provenance messaging and link to Body Twin history when a snapshot exists.
- Implement keyboard focus, screen-reader status announcements, non-color-only error states, and `prefers-reduced-motion` behavior.

**TDD steps:**
- [ ] Write failing UI tests for consent gate, successful camera readiness, camera permission denial, unavailable `mediaDevices`, cancelled capture, no fabricated values, and cleanup of tracks.
- [ ] Add the camera-unavailable review-focus test and assert no `COMPLETE 100%`/synthetic metrics appear.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-ui.test.tsx` and confirm RED.
- [ ] Implement the hook/page/CSS with the approved ATLAS blue/silver spatial visual language.
- [ ] Re-run the targeted UI test and confirm GREEN.
- [ ] Run `npm run typecheck` and `npm run build`.
- [ ] Commit: `feat(health): build camera-only BioScan experience`.

### Task 6: Real Human Digital Twin history surface

**Files:**
- Create: `apps/web/src/modules/health/bioscan/BodyTwinPage.tsx`
- Modify: `apps/web/src/modules/health/bioscan/bioscan.css`
- Modify: `tests/integration/health-bioscan-ui.test.tsx`

**UI behavior:**
- Load only authorized immutable snapshot history from the BioScan v1 timeline/read operations.
- Show capture timestamp, session status, capture mode, source summary, and confidence summary exactly as stored.
- Empty state: no saved snapshots means no avatar/measurements are invented.
- Selecting a snapshot exposes provenance/session metadata and an explicit Phase-1 note that full 3D mesh/Ghost Compare arrives only when real geometry exists in the later Human Digital Twin phase.
- Do not create a fake 3D body model as a placeholder.
- Keep data-table/text alternatives for accessibility.

**TDD steps:**
- [ ] Add failing tests for empty history, one/multiple snapshots, selection, provenance visibility, error state, and absence of fabricated body metrics.
- [ ] Run the targeted UI test and confirm RED.
- [ ] Implement the minimal real timeline/detail surface.
- [ ] Re-run the targeted UI test and confirm GREEN.
- [ ] Commit: `feat(health): add immutable Body Twin history`.

### Task 7: Protected routes and Health OS entry points

**Files:**
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/modules/experience/HealthExperiencePage.tsx`
- Modify: `tests/integration/health-routes.test.tsx`

**Routing:**
- Register `/health/bioscan` → `BioScanPage` behind `RequireAtlasIdentity`.
- Register `/health/body-twin` → `BodyTwinPage` behind `RequireAtlasIdentity`.
- Add a real BioScan card to the Health experience only after both routes resolve.
- Do not expose future progress/posture/physique/CleanScan-human routes in this phase.
- Preserve all current Health Frontiers, Neuroplasticity, Jaque Mate/Sentinel, and existing research routes.

**TDD steps:**
- [ ] Add failing route tests for authenticated route registration and Health card navigation.
- [ ] Add a source-contract assertion that both BioScan routes are wrapped in `RequireAtlasIdentity`.
- [ ] Verify unauthenticated navigation resolves through the existing identity gate rather than rendering sensitive data.
- [ ] Run `npm run test:integration -- tests/integration/health-routes.test.tsx tests/integration/health-bioscan-ui.test.tsx` and confirm RED before routing changes.
- [ ] Implement routes and navigation.
- [ ] Re-run targeted tests and confirm GREEN.
- [ ] Commit: `feat(health): route BioScan and Body Twin`.

### Task 8: Production fail-closed route and API verification

**Files:**
- Modify: `data/ops/global-production-verification.json`
- Modify: `tests/integration/global-production-verification.test.ts`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`

**Verification contract:**
- Increment the production-verification contract version.
- Add `/health/bioscan` and `/health/body-twin` as required SPA route shells only after the routes exist. A 200 shell must not be interpreted as authenticated data access.
- Extend the direct Cloudflare exact-SHA probes to both routes.
- Extend the authorized runtime verifier to probe both route shells and include explicit result fields.
- Add a fail-closed BioScan API security probe: calling the JWT-protected `atlas-platform-controls?api=bioscan-v1-capabilities` without a valid user JWT must return an authentication/authorization failure, never a successful sensitive payload.
- Preserve `/api/v1/health`, HSTS, CSP, exact-SHA convergence, and existing Network/Work/Health gates.
- Do not claim depth sensor, wearable, clinical-device, or medical-record readiness in verification.

**TDD steps:**
- [ ] Update the production-verification integration test first with the two new route shells and the BioScan auth-negative assertion; confirm RED.
- [ ] Implement the contract/workflow/authorized-verifier changes.
- [ ] Run `npm run test:integration -- tests/integration/global-production-verification.test.ts` and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit: `test(health): gate BioScan production readiness`.

### Task 9: Full verification, PR conversion, CI, merge, deploy, and E2E evidence

**Files:**
- Modify only defects exposed by verification.
- Update PR #638 metadata/body after implementation so it no longer describes the branch as documentation-only.

**Pre-implementation branch safety:**
- [ ] Before Task 1 code changes, confirm the feature branch still contains the current `main` head or reconcile it with current `main` without discarding the approved spec/plan.
- [ ] If execution is moved to an isolated worktree/feature branch, carry the approved spec and this plan into that branch and preserve commit history/evidence.

**Repository verification:**
- [ ] Run targeted BioScan unit/integration suites.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run test:integration`.
- [ ] Run `npm run build`.
- [ ] Run `npm run verify:all` in the same environment CI uses.
- [ ] Inspect the final diff for secrets, raw image assets accidentally persisted as user data, fake metrics, stale placeholders, and unrelated refactors.

**PR / CI:**
- [ ] Update PR #638 title/body or supersede it with one implementation PR whose scope is clearly BioScan Foundation; do not leave contradictory `docs-only` language.
- [ ] Require the repository's existing CI/consensus/security checks to complete successfully before merge.
- [ ] Inspect failing jobs individually and repair real defects; do not mark completion from a queued/pending/skipped check that is required by policy.
- [ ] Verify the final PR head SHA immediately before merge.

**Merge / deploy / production:**
- [ ] Merge only the verified head SHA using the repository's normal merge policy.
- [ ] Confirm the Cloudflare deployment workflow runs for that exact `main` SHA.
- [ ] Confirm `/api/v1/health` returns the required healthy JSON contract and the public root retains HSTS/CSP.
- [ ] Confirm `/health/bioscan` and `/health/body-twin` serve the deployed exact SHA.
- [ ] Confirm unauthenticated BioScan API access fails closed.
- [ ] Confirm authenticated BioScan page entry requires ATLAS Identity and active organization access.
- [ ] Confirm no synthetic BPM/temperature/body-fat/muscle-mass values appear with no source data.
- [ ] Record production-verification evidence before declaring Phase 1 complete.

## Phase Boundary After This Plan

Completion of this plan establishes the BioScan Foundation only. The following remain separate approved follow-up implementation plans, not implicit work inside Phase 1:

1. **Human Digital Twin Geometry:** real landmarks/mesh visualization, replay metadata, Ghost Compare.
2. **Fitness + Posture:** posture observations, physique dashboard, Muscle Map, progress deltas.
3. **Sensor Fusion:** wearables, scales, Device DNA/Health OS observations with source conflict handling.
4. **ATLAS Mirror:** spatial presentation mode on capable hardware.

Each later plan must preserve the same consent, subject scope, provenance, audit, accessibility, and `NO DATA → NO CLAIM` invariants.
