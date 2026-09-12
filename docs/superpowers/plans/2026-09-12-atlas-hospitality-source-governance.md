# ATLAS Hospitality Source Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add governed source ingestion, rights/provenance enforcement, conflict/correction/deletion semantics, media validation, and content moderation for Hospitality Discover data.

**Architecture:** Every external source is represented by a typed adapter contract that declares permitted fields, rights basis, attribution requirements, freshness rules, update semantics, and correction/deletion behavior. Ingestion runs server-side and writes normalized catalog records plus source metadata; partner/public media is stored only through validated references and moderation gates.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Postgres/RLS/Edge Functions/Storage, existing ATLAS audit patterns.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

## Global Constraints

- Depends on Discover Core source/catalog tables.
- Only permitted, licensed, public-with-compatible-terms, partner-supplied, hotel-supplied, government/tourism-authority, or manually verified data may be ingested.
- No protected third-party descriptions, maps, coupon artwork, advertisements, or photography may be copied without rights.
- Source credentials remain server-side.
- Every ingestible field must be explicitly allowed by the source adapter; unknown fields are dropped rather than persisted automatically.
- Source corrections and deletion requests must propagate to affected normalized records or mark them unavailable/conflicted as defined by the source contract.
- Media uploads must be validated by type, size, ownership/rights metadata, and approved storage path.
- Run focused tests plus `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before completion.

---

### Task 1: Define source adapter and rights contracts

**Files:**
- Create: `packages/hospitality-discover/sources.ts`
- Test: `tests/unit/hospitality-sources.test.ts`

**Interfaces:**
- `HospitalitySourceAdapter` exposes `sourceIdentity`, `permittedFields`, `rightsBasis`, `attributionRequirements`, `freshnessPolicy`, `updateSemantics`, `deletionSemantics`, and `normalize(record)`.
- `assertFieldPermitted(adapter, field)` fails closed.
- `sourceFreshness(record, policy, now)` returns normalized verification/freshness state.

- [ ] **Step 1: Write failing source-policy tests**

```ts
expect(() => assertFieldPermitted(adapter, 'private_notes')).toThrow('source_field_not_permitted');
expect(sourceFreshness(oldRecord, { maxAgeMs: 86400000 }, now)).toBe('stale');
expect(adapter.permittedFields).toContain('name');
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-sources.test.ts
```

- [ ] **Step 3: Implement fail-closed source contracts**

`rightsBasis` must be one of `partner_supplied`, `hotel_supplied`, `authorized_api`, `government_public_data`, `tourism_authority`, `licensed_provider`, `compatible_public_data`, `atlas_authored`, or `manual_verification`. The contract must not include a generic unrestricted scraping mode.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-sources.test.ts
npm run typecheck
git add packages/hospitality-discover/sources.ts tests/unit/hospitality-sources.test.ts
git commit -m "feat(hospitality): add Discover source governance contracts"
```

---

### Task 2: Add server-side ingestion and conflict/correction behavior

**Files:**
- Create: `supabase/functions/atlas-hospitality-discover/_shared/source-ingestion.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/_shared/repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-source-ingestion.test.ts`

**Interfaces:**
- `ingestSourceRecords({ sourceId, records })`.
- `applySourceCorrection({ sourceId, externalId, patch })`.
- `applySourceDeletion({ sourceId, externalId })`.
- `resolveSourceConflict({ sourceRecordId, resolution, actor })` requires `hospitality.provenance.review`.

- [ ] **Step 1: Write failing ingestion tests**

Test allowed-field persistence, forbidden-field dropping/rejection, update of an existing external ID without duplication, stale marking, conflicting-source state, correction propagation, deletion/disable behavior, and reviewer-only conflict resolution.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-source-ingestion.test.ts
```

- [ ] **Step 3: Implement idempotent source upserts**

Use stable `(source_name/source_id, source_external_id)` identity. Store checksum/version and retrieved/verified timestamps. Update only fields owned by that source/normalization policy; do not overwrite partner-owned or reviewer-owned fields without explicit merge rules.

- [ ] **Step 4: Implement correction/deletion/conflict semantics**

A source deletion must not silently leave the record `source_verified`. If no other valid source supports the affected fact, mark it `disabled`, `stale`, or remove the normalized field according to the adapter contract. Conflicting trusted sources mark the fact/record `conflicted` until resolved.

- [ ] **Step 5: Add audit events and verify**

```bash
npx vitest run tests/integration/hospitality-source-ingestion.test.ts
npm run test:integration
git add supabase/functions/atlas-hospitality-discover tests/integration/hospitality-source-ingestion.test.ts
git commit -m "feat(hospitality): add governed source ingestion"
```

---

### Task 3: Add media reference validation and moderated storage flow

**Files:**
- Create: `packages/hospitality-discover/media.ts`
- Create: `supabase/migrations/20260912_hospitality_media.sql`
- Create: `supabase/functions/atlas-hospitality-discover/_shared/media.ts`
- Test: `tests/unit/hospitality-media.test.ts`
- Test: `tests/integration/hospitality-media-edge.test.ts`

**Interfaces:**
- Table: `hospitality_media_assets` storing org/partner/place references, storage object reference, media type, dimensions/size metadata, rights basis, moderation state, created/reviewed metadata.
- `validateMediaSubmission(input)` accepts approved MIME types and configured size caps only.
- `reviewMediaAsset(assetId, decision)` requires `hospitality.content.review`.

- [ ] **Step 1: Write failing media validation tests**

```ts
expect(validateMediaSubmission({ mime: 'image/jpeg', sizeBytes: 5000000, rightsBasis: 'partner_supplied' }).allowed).toBe(true);
expect(validateMediaSubmission({ mime: 'application/x-msdownload', sizeBytes: 1000, rightsBasis: 'partner_supplied' }).allowed).toBe(false);
```

Test missing rights basis, oversized upload, cross-org review denial, and unreviewed media excluded from public place responses.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-media.test.ts tests/integration/hospitality-media-edge.test.ts
```

- [ ] **Step 3: Implement schema/RLS and server-side validation**

Allow only configured image/video/document types required by the product; store bytes in approved Supabase Storage paths and persist only object references in business rows. Public APIs return only approved media references.

- [ ] **Step 4: Implement moderation state machine**

Use `pending_review`, `approved`, `rejected`, `disabled`. Reviewer actions record actor, reason, timestamp, and prior/new state in audit logs.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-media.test.ts tests/integration/hospitality-media-edge.test.ts
npm run test:unit
npm run test:integration
git add packages/hospitality-discover/media.ts supabase/migrations/20260912_hospitality_media.sql supabase/functions/atlas-hospitality-discover tests
git commit -m "feat(hospitality): add moderated Discover media"
```

---

### Task 4: Add source/provenance review UI

**Files:**
- Create: `apps/web/src/modules/hospitality/partners/SourceReviewPage.tsx`
- Create: `apps/web/src/modules/hospitality/partners/MediaReviewPage.tsx`
- Modify: `apps/web/src/lib/hospitalityDiscoverApi.ts`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Test: `tests/integration/hospitality-source-review-routes.test.tsx`

**Interfaces:**
- Reviewer-only surfaces expose source status, freshness, conflict state, rights basis, correction/deletion events, and media moderation state.

- [ ] **Step 1: Write failing reviewer UI tests**

Test denied view without provenance/content review permissions, conflict resolution action, stale-source filter, media approval/rejection, empty states, and successful persisted review outcome.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-source-review-routes.test.tsx
```

- [ ] **Step 3: Implement API-backed review surfaces**

Do not expose source credentials or raw private upstream payloads. Review actions call governed server-side operations and render the persisted response state.

- [ ] **Step 4: Verify full phase**

```bash
npx vitest run tests/unit/hospitality-sources.test.ts tests/unit/hospitality-media.test.ts tests/integration/hospitality-source-ingestion.test.ts tests/integration/hospitality-media-edge.test.ts tests/integration/hospitality-source-review-routes.test.tsx
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hospitalityDiscoverApi.ts apps/web/src/modules/hospitality packages/hospitality-discover supabase tests
git commit -m "feat(hospitality): add source and media governance UI"
```

---

## Completion Gate

This plan is complete when data can enter Discover only through declared rights-aware source contracts or authorized partner/manual flows, updates are idempotent, corrections/deletions/conflicts propagate truthfully, public media is rights-tagged and moderated, no source credentials leak, and repository validation passes.