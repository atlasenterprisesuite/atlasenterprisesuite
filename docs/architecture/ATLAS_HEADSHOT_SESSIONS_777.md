# ATLAS Headshot Sessions — 777 REVIEW

Status: **DESIGN PROPOSAL / NOT IMPLEMENTED / NO-GO for production**
Date: 2026-11-22
Owner: ATLAS Studio / Creator
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Inspected baseline: `main@6f981f7b1eb267b66bd70a2b9582ce7fb114f15d`
Proposed authenticated entrypoint: `/studio/headshots`
Public publishing, real bookings, and provider spending: **NOT AUTHORIZED BY THIS DESIGN**

## 1. Product outcome and limits

Deliver a unified, bilingual (ES/EN), mobile-first headshot workflow for (A) AI-assisted portraits of the consenting subject, (B) retouching an existing authentic photograph, and (C) optionally arranging an in-person photographer session. Serve LinkedIn/business profiles, resumes, executive profiles, staff directories and casting portfolios without implying every output is an unmodified photograph.

The customer can start from an original image, inspect the planned changes, approve any provider cost, generate or perform local edits, compare original/edited versions, explicitly approve one or more deliverables, save them privately, download and delete or revoke delivery access. A business may manage several subjects only under individual access/consent grants.

**Non-goals for v1:** face recognition/identification, biometric templates, attractiveness or demographic scoring, age/race/gender inference, nonconsensual identity replacement, public-face scraping, automatic publication to third-party profiles, speculative paid provider calls, a new payments ledger, a new AI orchestration layer or a separate authentication platform.

The product must never guarantee that a generative model preserves identity perfectly. User approval, clear provenance, and an authentic-original option remain required.

## 2. Verified reuse points

Inspect and reuse rather than duplicate:

| Contract | Existing location | Reuse decision |
| --- | --- | --- |
| ATLAS shell, visual tokens, WCAG expectations | `DESIGN.md`; `apps/web/src/atlas-design-tokens.css`; `apps/web/src/components/AtlasShell.tsx` | Use same shell, tokens, responsive components and navigation |
| Creator entrypoints | `apps/web/src/modules/creator/CreatorStudioPage.tsx`; `apps/web/src/App.tsx` | Add a Headshot Sessions entry linked from Studio, not an independent app |
| Image Lab editor | `apps/web/src/modules/creator/image/ImageLabWorkspace.tsx` | Extract/refactor shared upload, preview, normalized annotation and review primitives only when tests preserve Image Lab |
| Image-edit request validation | `packages/creator/image_edit.ts` | Reuse validation; extend with a domain-level HeadshotSpec rather than weakening general image contracts |
| Auth, role/tenant resolution | `supabase/functions/atlas-creator/_shared/context.ts`; `packages/creator/permissions.ts` | Reuse identity and RBAC; add object-level ownership and consent checks |
| Creator API | `apps/web/src/lib/creatorApi.ts`; `supabase/functions/atlas-creator/index.ts` | Extend existing authenticated API dispatch and its server-side authorization |
| Persisted productions/jobs/assets | `supabase/migrations/20260912_creator_director.sql` | Reuse `creator_productions`, `creator_generation_jobs`, `creator_assets` and private Creator Library |
| Provider execution | `supabase/functions/atlas-creator/_shared/openai_image.ts` | Reuse server-side adapter only after verified readiness, exact model support and explicit charge authorization |
| Creator orchestration | `packages/creator/studio_orchestration.ts` | Respect human-render and human-cost approval; never fork the orchestration control plane |
| Audit and provenance | existing Creator audit plus asset provenance | Extend with consent, asset access, review, download, revocation and deletion events |

Repository findings are code inspection, **not runtime/production verification**. Model availability and tenant entitlements require independent live checks.

## 3. Information architecture and route graph

Authenticated: `/studio` → `/studio/headshots` → `/studio/headshots/new` → `/studio/headshots/:projectId` → `/studio/headshots/:projectId/review`. Reuse `/studio/library` for asset management and `/studio/providers` for provider readiness. Product will add only essential routes and preserve Image Lab at `/studio/create?type=image`.

The Studio Headshots landing screen contains **My projects**, **New headshot**, **My deliveries**, and **Sessions** (only where session capability is actually configured). Each project is clearly marked as draft, waiting for consent, ready, awaiting authorization, queued, rendering, review required, approved, delivered, failed, canceled or deleted. Display only server-backed statuses.

### 3.1 Individual AI headshot journey

1. Authenticate and resolve active organization; select `AI portrait` or `Authentic retouch`.
2. Collect usage purpose and subject authority. For a minor, require appropriate guardian/organizational authorization where applicable; never assume platform account ownership is proof.
3. Upload JPEG/PNG/WebP, size >0 and ≤15 MiB, or choose camera capture only after explicit browser camera permission. Validate actual content signature, decode, dimensions, orientation and size server-side; reject malicious or unrecognized files.
4. Show a local-only input preview; allow crop, background framing, color correction and non-destructive local editing. Existing source remains unchanged. No hidden EXIF sharing.
5. Configure style with natural presets such as Corporate, Business Casual, Creative, Editorial and Casting. Default `preserveIdentity=true`; preserve facial likeness, natural skin features, proportions and age. Do not create beautification scores.
6. Preview a full specification with intended operations, engine readiness, estimated charge and explicit processing destination. Show no "Generate" until consent, entitlement, readiness and human authorization are verified.
7. Create idempotent `creator_production` and `creator_generation_job`; run via existing server-side provider adapter; retry only safe/transient failures with bounded retry and dedupe. A provider timeout is not a completed delivery.
8. On successful output validation and private persistence, show side-by-side original/variant review, provenance, identity-change warning and optional re-edit. Require explicit user selection and approval; output may be rejected.
9. Export accepted sizes as separate derivatives and record their original/output SHA-256. Permit download and optional short-lived explicitly authorized sharing; no automatic social publishing.
10. Permit project deletion and consent revocation. Cancel future processing, invalidate delivery grants and enqueue deletion across owned storage with audit receipt, accounting for documented legal holds.

### 3.2 Authentic photograph mode

Must offer local crop, orientation, exposure/white balance adjustments and resize/download without requiring a paid provider. Clearly label edits as non-generative when no generative operation occurred. Avoid inventing facial details and do not claim resolution improvements without actual quality evidence.

### 3.3 Photographer session booking (phase 2, separate gate)

Use existing CRM customer/contact records, existing Calendar/event integration where authorized, and existing Commerce/Pay settlement contracts where available. Avoid introducing a second CRM, calendar or ledger. A provider-independent request may be stored as **requested**, never **confirmed**, until an actual capacity source confirms the slot. Record timezone, venue/remote modality, staff assignment, package, no-show/cancellation terms, subject consent and delivery SLA. Resolve concurrent holds transactionally; dedupe calendar/payment webhooks by stable event ID; handle cancellation/refund separately and only after verified authority.

## 4. Headshot specification

```ts
type HeadshotMode = 'authentic-retouch' | 'ai-assisted' | 'photographer-session';
type HeadshotPurpose = 'professional' | 'team-directory' | 'creative' | 'casting';
type HeadshotStatus =
  | 'draft' | 'awaiting-consent' | 'ready' | 'authorization-required'
  | 'queued' | 'rendering' | 'review-required' | 'approved'
  | 'delivered' | 'failed' | 'canceled' | 'deleted';

interface HeadshotSpec {
  kind: 'headshot';
  schemaVersion: 1;
  mode: HeadshotMode;
  purpose: HeadshotPurpose;
  subjectConsentId: string;
  sourceAssetId: string;
  preserveIdentity: true;
  preset: 'corporate' | 'business-casual' | 'creative' | 'editorial' | 'casting';
  instructions: string;
  background: { mode: 'keep' | 'replace'; color?: string };
  crop: { aspectRatio: '1:1' | '4:5' | '8:10'; subjectCentered: boolean };
  output: { formats: ('jpeg' | 'png' | 'webp')[]; targetPixels?: [number, number] };
  visibility: 'private' | 'explicit-share';
  costAuthorizationId?: string;
  version: number;
}
```

All client-provided IDs, authorization flags and organization attributes are **untrusted**. Server resolves owner, organization and consent binding. Separate stored `purpose` and granted disclosure permissions; do not grant organization-wide access to subjects simply because they share a tenant.

## 5. Persistence and APIs

Prefer `creator_productions.production_spec_json.kind='headshot'` for project configuration, `creator_generation_jobs` for execution and `creator_assets` for versioned output, with existing audit logs and private `creator-assets` storage. Reuse existing consent and delivery-grant primitives if present; **only if no canonical equivalent exists**, add normalized consent and expiring-grant tables with `organization_id`, `subject_id`, `project_id`, purpose, version, revoked_at, authorizing_actor and timestamps. Booking entities are phase 2 and must first map to calendar/commerce schemas.

Proposed API actions under the existing `atlas-creator` dispatcher: `headshots.create`, `headshots.get`, `headshots.update`, `headshots.consent`, `headshots.quote`, `headshots.submit`, `headshots.review`, `headshots.export`, `headshots.share`, `headshots.revoke`, `headshots.delete`. They are design contracts, **not routes currently deployed**. Use structured validation on every API boundary, user/subject/tenant/asset binding, optimistic concurrency `expectedVersion`, server-generated idempotency keys and unforgeable short-lived signed URLs.

Mutation response includes `project_id`, `version`, `status`, `request_id`, `audit_event_id`. Successful render response additionally includes `creator_asset_id`, provider/model identification, measured dimensions, output hash, persisted timestamp and provenance. Never mark successful if storage/audit fails. Signed asset previews must avoid passing raw unrestricted bucket paths directly from the browser.

## 6. Security, consent and authentic provenance

P0 release controls:
- Zero Trust: signed session, canonical membership, per-action Creator permission, per-project owner or explicit subject grant, independent RLS and backend enforcement. A member in the same organization must not automatically access another person's unshared portraits.
- All original/output images private by default; short-lived links scoped to a recipient and revocable. Test anonymous, different-tenant, same-tenant unauthorized and expired-link access.
- Before third-party AI transmission: subject consent specifically covering vendor processing, privacy notice, named purpose, retention and any charge. Consent changes are versioned and auditable; withdrawal prevents future processing.
- No model training opt-in by default. No biometric identification, automated sensitive-trait inference or face embedding index. Do not upload user faces to analytics/crash reporting.
- Remove unnecessary EXIF, GPS and device metadata from exported derivatives by default; retain originals in protected storage only for the agreed retention period. Subject can request erasure with verifiable completion receipt unless documented legal obligation prevents it.
- Validate image MIME signature, decoding, bounded size/pixel count and output contents; disallow SVG/HTML/polyglot uploads. Use private buckets, anti-abuse quotas and rate limiting.
- Detect potential face/likeness changes by user review and configurable quality checks; do not guarantee automatic identity matching or classify individuals using facial recognition.
- Persist provenance: source asset hash, transformation mode, provider/model/version, operator, consent reference, output hash, timestamp, approval and export history. Claims of C2PA/content credentials only after actual signing/verification exists.
- No public-link sharing, casting delivery, publishing or payment charge without an explicit user action and the relevant authorized integration.
- Provider readiness and cost limit enforced on the server; estimate and authorize before any paid render. Idempotent billing/usage records; no silent paid fallback.

P1 concerns: international localization, optional branded template library, batch operations, print delivery, advanced offline draft caching (without persisting unencrypted photos), and export presets for additional destinations.

## 7. UX / design system

Visual identity: existing ATLAS midnight surfaces with cyan/blue accents, violet used sparingly, shared design tokens and visible provider/status badges as semantic status only. Mobile-first card grid, keyboard-accessible wizard, desktop split preview+controls and sticky action summary. Meet WCAG 2.2 AA; 44px targets; keyboard/reader labels; focus management; 320/768/1024/1440px layouts; reduced motion; ES/EN.

Key screens: dashboard (real project counts or empty state); consent/subject notice; upload/camera; image composer (selected style, cropping, identity preservation); provider/budget authorization; progress (server-backed job with cancellation where supported); before/after review; library/export; privacy/delete; bookings (gated). Never show sample outputs as customer-owned or generated outputs.

Preset targets: square profile `1:1`; vertical professional `4:5`; casting `8:10`. Export actual pixel dimensions and quality metadata; require separate renderer validation for high-resolution print, do not equate CSS scaling with print-ready image.

All represented controls must perform real actions or be visibly disabled with an explanation. Support empty, error, loading, success, offline and retry states. A disconnected engine still permits local cropping and prompt/spec export; it does not claim remote generation succeeded.

## 8. State transitions and reliability

`draft -> awaiting-consent -> ready -> authorization-required? -> queued -> rendering -> review-required -> approved -> delivered`. Failure, cancel and delete are explicit, auditable transitions. Verify transition guards server-side. A consent revocation during queued/rendering should cancel best-effort, block subsequent delivery and initiate provider-side deletion where supported. Ensure refresh/resume reflects persisted job state, not a client timer. Use existing ATLAS orchestration patterns rather than inventing a separate worker system.

Exactly-once external side effects are not assumed: use idempotency keys, reconciliation, persisted event dedupe and compensation for partial failures. Treat provider availability and payment failure as explicit terminal/recoverable states. Keep original input immutable and all versions traceable.

## 9. 777 REVIEW delivery plan

**RUN HSS-001 — Reuse / TDD.** Map reusable Image Lab primitives, authentication, asset storage, audit and business/calendar contracts. Write failing tests for schema validation, ownership, privacy, uploads, consent, generator readiness and size presets. Capture baseline commit SHA and affected code.

**RUN HSS-002 — Functional individual vertical slice.** Implement authenticated `/studio/headshots`, subject consent, local authentic-retouch flow, persistence, library, download and deletion. Verify real data path and accessibility without external spending. This is the first independently releasable slice if every P0 is green.

**RUN HSS-003 — Governed AI images.** Wire existing `atlas-creator` image adapter with verified model entitlement, quote, explicit paid approval, job idempotency, private persistence, human review, provenance and output export. Deny execution if provider unavailable.

**RUN HSS-004 — Photographer sessions and teams.** Only after mapping existing CRM, Calendar, Commerce, Finance and authorization controls; integrate real capacity, scheduling, settlement, staff/subject grants and deletion processes. No phantom appointments/payments.

**RUN HSS-005 — Evidence / deployment.** Full typecheck/tests/build, privacy and RLS matrix, responsive visual QA, GitHub CI, review, merge authorization, deploy and E2E against exact deployed SHA. Roll out incrementally using feature flags and a real rollback plan.

### Acceptance matrix

| ID | Blocking gate | Evidence required | Current state |
| --- | --- | --- | --- |
| HSS-P0-01 | Authorized owner/consenting subject | Consent record + API tests | UNVERIFIED |
| HSS-P0-02 | Isolation between organizations AND users | RLS, API negative tests | UNVERIFIED |
| HSS-P0-03 | Real upload, decode, preview, private persistence | Functional E2E + asset row | UNVERIFIED |
| HSS-P0-04 | Local edit, immutable original, correct export | Image binary/metadata test | UNVERIFIED |
| HSS-P0-05 | Provider readiness, quote and paid approval | Runtime probe + denied-spend tests | UNVERIFIED |
| HSS-P0-06 | Render lifecycle, idempotency, retries | Job/audit/provenance E2E | UNVERIFIED |
| HSS-P0-07 | Review, delivery grant and revocation | Access-expiration/deletion tests | UNVERIFIED |
| HSS-P0-08 | Accessible responsive UI | Keyboard, WCAG and viewport checks | UNVERIFIED |
| HSS-P0-09 | Security/privacy/EXIF/retention | Threat model + tests | UNVERIFIED |
| HSS-P0-10 | CI, merge, production and exact-SHA E2E | GitHub workflow + deploy evidence | UNVERIFIED |

**P0 fail closed.** P1 warnings must be documented and owned. The PR containing this document **does not implement or satisfy** the acceptance matrix.

## 10. Product/operational metrics

Track only consent-safe events: authenticated projects created, valid-upload rate, time to user-approved deliverable, output rejection/revision rate, completed job rate, failed job reasons, 95th-percentile end-to-end latency, per-job actual external spend vs authorization, deletion SLA, accessibility defects, booking confirmation lag and unauthorized-access test results. Avoid tracking facial traits, identities or contents in analytics.

Success requires an actual consenting user completing upload → local/AI edit → review → private download, with all backend evidence attached. Dashboards must show zero/unknown instead of invented usage.

## 11. Explicit status / follow-up

This document is a **design artifact only**. No Headshot UI, consent implementation, database migration, provider credentials, completed generation, reservation, payment, CI verification, production merge or production deployment is claimed here. Keep a draft PR until implementation and evidence are ready; do not merge this design and present it as a shipped feature.

Next engineering action: deliver HSS-001/HSS-002 as a narrow, test-backed vertical slice, preserving all existing Creator behaviors.
