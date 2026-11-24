# ATLAS BioScan Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 1 of ATLAS BioScan as a production-safe foundation: versioned contracts, explicit consent, provenance-aware session state, immutable Human Digital Twin history, a camera-only capture shell, protected Health routes, audited export/deletion, and fail-closed production verification without fabricated body metrics or sensor readiness.

**Architecture:** Reuse the existing ATLAS identity/session boundary, `atlas-platform-controls` Supabase Edge Function, organization-scoped RLS conventions, `HealthExperiencePage`, and Cloudflare verification pipeline. The browser may request a local camera stream, but Phase 1 never persists raw frames and never treats ordinary camera pixels as clinical measurements. All canonical mutations flow through the JWT-protected control plane; rows are organization- and subject-scoped; snapshots are immutable; audit events are emitted server-side. Only `/health/bioscan` and `/health/body-twin` ship in this phase.

**Tech Stack:** TypeScript, React 18, React Router 7, Vite, Vitest, Supabase/PostgreSQL, Supabase Edge Functions, existing ATLAS Cloudflare Worker deployment/verification.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-bioscan-human-digital-twin-design.md`

## Global Constraints

- Preserve `NO DATA → NO CLAIM`.
- Never display BPM, temperature, body-fat percentage, muscle mass, diagnosis, or another measurement without a real source and provenance record.
- Phase 1 is camera-only. Missing depth/LiDAR capability degrades explicitly and does not fabricate depth data.
- Do not persist camera frames, photos, video, blobs, or base64 image payloads in Phase 1. `MediaStream` remains local to the browser.
- Keep `tenant_id = org_id`, active organization membership, and subject scope on canonical BioScan data.
- Browser clients do not directly mutate canonical BioScan tables. Writes go through `atlas-platform-controls`.
- Human Digital Twin snapshots are immutable. A later state requires a new snapshot.
- Authorization, consent, provenance integrity, and subject-scope failures are fail-closed.
- Reuse `audit_logs`; audit payloads must not contain raw images, secrets, bearer tokens, or unnecessary body-detail payloads.
- Implement real loading/empty/active/disabled/denied/error/cancelled/partial/complete states. No fake timers, fake percentages, `href="#"`, console-only actions, or `Coming Soon` controls.
- Reconstruct the approved blue/silver BioScan visual language as responsive UI. The generated concept image is reference art, not the application screen.
- Keep Health OS, CleanScan 3D, Device DNA, and BioScan responsibilities separate; never claim a scanner, wearable, scale, clinical device, EHR, or hospital integration is live without a verified adapter.
- Do not add `/health/body-twin/progress`, `/health/posture`, `/health/physique`, or `/cleanscan/human` in Phase 1.

## Review Focus

1. **Consent revocation race:** consent granted at prepare-time then revoked before capture/complete must block the next transition.
2. **Cross-subject access:** same-organization membership alone must not authorize another subject's BioScan data.
3. **Invalid provenance:** missing/unknown source, blank source ref, invalid confidence, or an estimate mislabeled as measured must be rejected.
4. **Retry/idempotency:** repeated same-state transitions or snapshot retries must not duplicate snapshots or audit facts.
5. **Camera unavailable:** permission denied or missing `mediaDevices` must produce an explicit blocked/degraded UI with no fabricated completion or metrics.

---

### Task 1: Versioned BioScan domain contracts and truth invariants

**Files:**
- Create: `apps/web/src/modules/health/bioscan/bioscanContracts.ts`
- Create: `tests/unit/health-bioscan-contracts.test.ts`

**Interfaces:**
- `BIOSCAN_API_VERSION = 1`.
- `BioScanSessionStatus = 'preparing' | 'capturing' | 'processing' | 'complete' | 'partial' | 'failed' | 'cancelled'`.
- Provenance union: `camera_estimate | depth_sensor | lidar_measurement | wearable | smart_scale | clinical_device | medical_record | user_entered | derived_from_verified_sources`.
- Capture-mode types include real Phase-1 `camera` and reserved future `camera_depth`/`lidar` values without claiming those modes are available.
- Define typed request/response contracts for the design's full API boundary: create/update/complete/fail session, create/read snapshot, timeline, measurements, posture, compare, sensor attachment, provenance resolution, export, and subject deletion.
- Implement pure `canTransitionBioScanSession(from, to)` and `validateBioScanProvenance(input)`.
- Provenance requires supported source, non-empty source ref, confidence `0..1`, timestamp, method version, and explicit estimate semantics.

**TDD:**
- [ ] Write failing tests for transitions, terminal states, source enum, source-ref requirement, confidence bounds, and estimate labeling.
- [ ] Add the invalid-provenance Review Focus case.
- [ ] Run `npm run test:unit -- tests/unit/health-bioscan-contracts.test.ts` and confirm RED.
- [ ] Implement the minimal contract module.
- [ ] Re-run targeted test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit `feat(health): define BioScan v1 contracts`.

### Task 2: Sensitive schema, consent, subject-scoped RLS, and snapshot immutability

**Files:**
- Create: `supabase/migrations/20261005102500_atlas_bioscan_foundation.sql`
- Create: `tests/integration/health-bioscan-schema.test.ts`

**Persistence:**
Create `bioscan_consents`, `bioscan_sessions`, `human_twin_snapshots`, `body_landmarks`, `body_measurements`, `sensor_observations`, and `posture_observations`. Use organization/tenant FKs, `tenant_id = org_id`, subject-user FKs, provenance checks, indexes, RLS, and comments.

**Permissions:**
Register `health.bioscan.read`, `health.bioscan.capture`, `health.bioscan.manage`, `health.bioscan.audit`.
- `owner`, `admin`: read/capture/manage/audit.
- `manager`, `staff`: read/capture only, still subject-scoped.
- Ordinary Health access never implies cross-subject BioScan manage permission.

**Database invariants:**
- Consent states: `granted | revoked | expired`, with explicit `body_scan` scope and timestamps.
- Session status/capture-mode constraints mirror TypeScript.
- Confidence constrained to `0..1` where applicable.
- Measurement rows require source type/ref, measured timestamp, estimate flag, and method version.
- Snapshot UPDATE is rejected by trigger.
- No raw-frame/blob/image table exists.
- Self-subject SELECT requires active membership + read permission; cross-subject SELECT requires manage permission.
- Revoke authenticated-browser INSERT/UPDATE/DELETE on sensitive canonical tables; service role performs controlled writes.

**TDD:**
- [ ] Write migration-contract tests for tables, RLS, permission grants, subject policies, provenance checks, raw-frame absence, mutation revocation, and snapshot immutability.
- [ ] Add the cross-subject Review Focus assertion.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-schema.test.ts` and confirm RED.
- [ ] Implement the idempotent migration.
- [ ] Re-run targeted test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit `feat(health): add BioScan sensitive-data foundation`.

### Task 3: Governed BioScan v1 control plane

**Files:**
- Modify: `supabase/functions/atlas-platform-controls/index.ts`
- Create: `tests/integration/health-bioscan-platform-controls.test.ts`

**Phase-1 operations:**
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

Contracts for measurements/posture/compare/sensors/provenance exist from Task 1, but no fake endpoint is exposed until its backing feature ships.

**Behavior:**
- Require JWT, `x-atlas-org-id`, active membership, permission, and subject scope.
- Default subject is the authenticated user; another subject requires `health.bioscan.manage`.
- Session creation requires active `body_scan` consent; recheck consent before `capturing`, `processing`, and `complete/partial`.
- Same-state retries are idempotent without duplicate audit events; invalid backwards/terminal transitions return conflict.
- Snapshot creation accepts only complete/partial sessions and enforces one canonical snapshot per session/idempotency key.
- Reject raw image/video/base64 fields and oversized capture payloads.
- Export produces structured subject-owned JSON with provenance/audit-safe metadata only.
- `delete-subject` performs a **hard delete of BioScan-domain rows for that subject in one service-controlled transaction** after authorization. Preserve the independent `audit_logs` record with only organization/user/action/count metadata; do not retain body geometry, measurements, or snapshot payloads as BioScan tombstones.
- Emit applicable spec events: consent granted/revoked, session started/completed/failed, snapshot created/viewed, data exported/deleted. Measurement/sensor events wait for later phases.

**TDD:**
- [ ] Write failing contract tests for auth, org scope, permission, subject scope, consent recheck, operation allowlist, raw-frame rejection, deletion semantics, audit calls, and idempotency.
- [ ] Add consent-race and retry/idempotency Review Focus tests.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-platform-controls.test.ts` and confirm RED.
- [ ] Implement handlers with minimal changes to the existing control plane.
- [ ] Re-run targeted test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit `feat(health): add governed BioScan v1 control plane`.

### Task 4: Browser API boundary and repository view model

**Files:**
- Create: `apps/web/src/modules/health/bioscan/bioscanApi.ts`
- Create: `apps/web/src/modules/health/bioscan/bioscanRepository.ts`
- Create: `tests/integration/health-bioscan-data-boundary.test.ts`

**Boundary:**
- Reuse `getActiveAtlasOrganization()` and `authorizedAtlasFetch()`.
- Send mutations and audited sensitive reads through `/functions/v1/atlas-platform-controls?api=bioscan-v1-*` with `x-atlas-org-id`.
- Never POST directly to `/rest/v1/bioscan_*`.
- Never serialize/upload `MediaStream`, `Blob`, `File`, image bytes, or base64 data in Phase 1.
- Preserve provenance in repository view models; no React state inside repository code.

**TDD:**
- [ ] Write failing tests for canonical session/control-plane use and absence of direct-table writes/raw-media serialization.
- [ ] Add 401/403/409 and malformed-response tests.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-data-boundary.test.ts` and confirm RED.
- [ ] Implement API/repository modules.
- [ ] Re-run targeted test and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit `feat(health): add BioScan browser data boundary`.

### Task 5: Camera-only BioScan capture UI

**Files:**
- Create: `apps/web/src/modules/health/bioscan/useCameraCapture.ts`
- Create: `apps/web/src/modules/health/bioscan/BioScanPage.tsx`
- Create: `apps/web/src/modules/health/bioscan/bioscan.css`
- Create: `tests/integration/health-bioscan-ui.test.tsx`

**UI states:** capabilities check, consent required, requesting camera, camera ready, camera denied/unavailable, preparing, capturing, processing metadata, complete, partial, failed/cancelled, backend unavailable.

**Camera behavior:**
- Call `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })`.
- Stop all tracks on cancel/unmount.
- No frame capture/upload/persistence.
- Missing depth shows factual `Camera-only mode`; it does not block camera capture.
- Progress reflects actual state transitions, not a fake timer.
- Metrics with no source show `Not measured`; never copy poster/reference values into product data.
- Include keyboard focus, screen-reader live status, non-color-only errors, and reduced-motion behavior.

**TDD:**
- [ ] Write failing UI tests for consent, camera ready, permission denial, absent `mediaDevices`, cancel cleanup, no fabricated metrics, and track cleanup.
- [ ] Add the camera-unavailable Review Focus case and assert no false completion/metrics.
- [ ] Run `npm run test:integration -- tests/integration/health-bioscan-ui.test.tsx` and confirm RED.
- [ ] Implement hook/page/CSS in ATLAS blue/silver spatial identity.
- [ ] Re-run targeted test and confirm GREEN.
- [ ] Run `npm run typecheck` and `npm run build`.
- [ ] Commit `feat(health): build camera-only BioScan experience`.

### Task 6: Real Human Digital Twin history surface

**Files:**
- Create: `apps/web/src/modules/health/bioscan/BodyTwinPage.tsx`
- Modify: `apps/web/src/modules/health/bioscan/bioscan.css`
- Modify: `tests/integration/health-bioscan-ui.test.tsx`

**Behavior:**
- Load only authorized immutable snapshot history.
- Show stored timestamp, session status, capture mode, source summary, and confidence summary.
- Empty history shows no avatar or metrics.
- Selecting a snapshot exposes provenance/session metadata. Do not render a fake 3D model when no real geometry exists.
- Provide data-table/text alternatives for accessibility.

**TDD:**
- [ ] Add failing tests for empty history, multiple snapshots, selection, provenance visibility, backend error, and absence of fabricated metrics.
- [ ] Run targeted UI test and confirm RED.
- [ ] Implement timeline/detail UI.
- [ ] Re-run targeted test and confirm GREEN.
- [ ] Commit `feat(health): add immutable Body Twin history`.

### Task 7: Protected Health routes and entry points

**Files:**
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/modules/experience/HealthExperiencePage.tsx`
- Modify: `tests/integration/health-routes.test.tsx`

**Routing:**
- `/health/bioscan` → `BioScanPage` behind `RequireAtlasIdentity`.
- `/health/body-twin` → `BodyTwinPage` behind `RequireAtlasIdentity`.
- Add a real BioScan card to Health only after both routes resolve.
- Preserve Health Frontiers, Neuroplasticity, Jaque Mate/Sentinel, and current research routes.
- Do not expose later-phase progress/posture/physique/CleanScan-human routes.

**TDD:**
- [ ] Add failing tests for protected route registration and Health-card navigation.
- [ ] Assert both routes use `RequireAtlasIdentity` and unauthenticated navigation reaches the existing identity gate.
- [ ] Run `npm run test:integration -- tests/integration/health-routes.test.tsx tests/integration/health-bioscan-ui.test.tsx` and confirm RED before routing changes.
- [ ] Implement routes/navigation.
- [ ] Re-run targeted tests and confirm GREEN.
- [ ] Commit `feat(health): route BioScan and Body Twin`.

### Task 8: Production fail-closed route/API verification

**Files:**
- Modify: `data/ops/global-production-verification.json`
- Modify: `tests/integration/global-production-verification.test.ts`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`

**Verification:**
- Increment production-verification contract version.
- Add `/health/bioscan` and `/health/body-twin` as required SPA route shells only after route implementation. A 200 shell never counts as authenticated data access.
- Add exact-main-SHA Cloudflare route probes for both paths.
- Add both to the authorized production verifier result.
- Add an API-negative probe: unauthenticated `atlas-platform-controls?api=bioscan-v1-capabilities` must fail auth and must never return sensitive success data.
- Preserve `/api/v1/health`, HSTS, CSP, exact-SHA convergence, and existing Network/Work/Health gates.
- Do not claim depth/wearable/clinical/medical-record readiness.

**TDD:**
- [ ] Update production verification tests first and confirm RED.
- [ ] Implement contract/workflow/authorized-verifier changes.
- [ ] Run `npm run test:integration -- tests/integration/global-production-verification.test.ts` and confirm GREEN.
- [ ] Run `npm run typecheck`.
- [ ] Commit `test(health): gate BioScan production readiness`.

### Task 9: Full verification, PR, CI, merge, deploy, and E2E evidence

**Pre-code branch safety:**
- [ ] Before Task 1 code changes, confirm the implementation branch contains current `main`; reconcile without losing this approved spec/plan.
- [ ] If using an isolated worktree/feature branch, carry the approved spec/plan into it and preserve evidence.

**Repository verification:**
- [ ] Run targeted BioScan unit/integration suites.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run test:integration`.
- [ ] Run `npm run build`.
- [ ] Run `npm run verify:all` in the same environment used by CI.
- [ ] Inspect final diff for secrets, accidentally persisted raw media, fake metrics, stale placeholders, and unrelated refactors.

**PR / CI:**
- [ ] Update PR #638 title/body or supersede it with a single implementation PR so no stale `docs-only` language remains.
- [ ] Require existing CI/consensus/security checks to succeed before merge.
- [ ] Repair real failures; do not treat required pending/queued/skipped checks as success.
- [ ] Verify final PR head SHA immediately before merge.

**Merge / deploy / E2E:**
- [ ] Merge only the verified head SHA using the normal repository policy.
- [ ] Confirm Cloudflare deploy runs for that exact `main` SHA.
- [ ] Confirm `/api/v1/health` healthy JSON and root HSTS/CSP.
- [ ] Confirm `/health/bioscan` and `/health/body-twin` serve the exact deployed SHA.
- [ ] Confirm unauthenticated BioScan API access fails closed.
- [ ] Confirm authenticated UI entry requires ATLAS Identity + active organization.
- [ ] Confirm no synthetic BPM/temperature/body-fat/muscle-mass appears without a source.
- [ ] Record production evidence before declaring Phase 1 complete.

## Phase Boundary After This Plan

Completion establishes BioScan Foundation only. Separate follow-up plans cover:

1. **Human Digital Twin Geometry:** real landmarks/mesh, replay metadata, Ghost Compare.
2. **Fitness + Posture:** posture observations, physique dashboard, Muscle Map, progress deltas.
3. **Sensor Fusion:** wearables/scales/Device DNA/Health OS observations and source conflict handling.
4. **ATLAS Mirror:** spatial presentation on capable hardware.

Every later phase must preserve consent, subject scope, provenance, audit, accessibility, and `NO DATA → NO CLAIM`.
