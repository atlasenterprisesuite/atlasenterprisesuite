# ATLAS Hospitality Discover Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the persisted, tenant-safe ATLAS Hospitality Discover catalog, provenance model, search API, and visitor read experience that all later map, commerce, concierge, campaign, and AI work depends on.

**Architecture:** Add a focused `packages/hospitality-discover` domain package, Supabase catalog tables with RLS, a dedicated `atlas-hospitality-discover` Edge Function, and visitor routes nested under the existing Hospitality shell. Public catalog reads are governed separately from partner-owned writes, and every externally sourced mutable fact carries provenance/freshness state.

**Tech Stack:** React 18.3.1, TypeScript 5.7, Vite 6.4.3, Vitest 3.2.6, Supabase Auth/Postgres/RLS/Edge Functions, PostgreSQL full-text search/trigram where available, Cloudflare production deployment.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Target branch: `feat/hospitality-discover-local-commerce`.
- Reuse the existing Hospitality route shell and identity/session boundary.
- Keep Discover separate from privileged `/hospitality/access` authorization and backend operations.
- Do not bulk-copy protected third-party tourism directories, maps, descriptions, ads, coupon artwork, or photography.
- Do not invent business data, ratings, pricing, hours, availability, offers, conversion metrics, or provider readiness.
- Every partner-owned row must be tenant/org scoped; public catalog records require governed ownership/source semantics.
- Externally sourced facts that can become stale must retain source/provenance and verification state.
- Use existing Supabase, audit, identity, GitHub, and Cloudflare patterns rather than parallel infrastructure.
- Run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before declaring this plan complete.

---

## File Structure

- `packages/hospitality-discover/types.ts` — catalog, source, freshness, search, and ranking types.
- `packages/hospitality-discover/permissions.ts` — Discover permission vocabulary and fail-closed checks.
- `packages/hospitality-discover/catalog.ts` — category/region/place/location normalization and freshness helpers.
- `packages/hospitality-discover/search.ts` — deterministic search request normalization and organic ranking rules.
- `supabase/migrations/20260912_hospitality_discover_core.sql` — source, category, region, place, location tables, indexes, and RLS.
- `supabase/functions/atlas-hospitality-discover/_shared/context.ts` — request/session/org resolution.
- `supabase/functions/atlas-hospitality-discover/_shared/repository.ts` — scoped catalog reads.
- `supabase/functions/atlas-hospitality-discover/_shared/errors.ts` — safe normalized errors.
- `supabase/functions/atlas-hospitality-discover/index.ts` — `listCategories`, `listRegions`, `searchPlaces`, `getPlace` router.
- `apps/web/src/lib/hospitalityDiscoverApi.ts` — browser client.
- `apps/web/src/modules/hospitality/discover/DiscoverPage.tsx` — visitor search/list surface.
- `apps/web/src/modules/hospitality/discover/PlaceDetailPage.tsx` — place detail surface.
- `apps/web/src/modules/hospitality/discover/discover.css` — responsive states.
- `apps/web/src/modules/hospitality/HospitalityRoutes.tsx` — add Discover routes without changing Access routes.
- `apps/web/src/modules/hospitality/HospitalitySubnav.tsx` — expose Access and Discover as distinct destinations.
- `tests/unit/hospitality-discover-catalog.test.ts` — domain normalization/freshness tests.
- `tests/unit/hospitality-discover-search.test.ts` — organic search/ranking tests.
- `tests/integration/hospitality-discover-schema.test.ts` — migration/RLS contract tests.
- `tests/integration/hospitality-discover-edge.test.ts` — Edge Function contract tests.
- `tests/integration/hospitality-discover-routes.test.tsx` — visitor route and state tests.

---

### Task 1: Define the Discover domain and permissions

**Files:**
- Create: `packages/hospitality-discover/types.ts`
- Create: `packages/hospitality-discover/permissions.ts`
- Create: `packages/hospitality-discover/catalog.ts`
- Test: `tests/unit/hospitality-discover-catalog.test.ts`

**Interfaces:**
- Produces `HospitalityDiscoverPermission`, `HospitalityVerificationStatus`, `HospitalitySourceRecord`, `HospitalityCategory`, `HospitalityRegion`, `HospitalityPlace`, `HospitalityPlaceLocation`.
- Produces `hasDiscoverPermission(context, permission)` and `requireDiscoverPermission(context, permission)`.
- Produces `freshnessState({ lastVerifiedAt, maxAgeMs, now })` returning `source_verified | stale | unverified`.

- [ ] **Step 1: Write failing domain and permission tests**

```ts
import { describe, expect, it } from 'vitest';
import { freshnessState } from '../../packages/hospitality-discover/catalog';
import { hasDiscoverPermission, requireDiscoverPermission } from '../../packages/hospitality-discover/permissions';

it('fails closed for missing write permission', () => {
  const actor = { permissions: ['hospitality.discover.read'] as const };
  expect(hasDiscoverPermission(actor, 'hospitality.place.manage')).toBe(false);
  expect(() => requireDiscoverPermission(actor, 'hospitality.place.manage')).toThrow('authorization_denied');
});

it('marks old source facts stale', () => {
  expect(freshnessState({
    lastVerifiedAt: '2026-09-01T00:00:00Z',
    maxAgeMs: 24 * 60 * 60 * 1000,
    now: new Date('2026-09-12T00:00:00Z')
  })).toBe('stale');
});
```

- [ ] **Step 2: Run the tests and verify failure**

```bash
npx vitest run tests/unit/hospitality-discover-catalog.test.ts
```

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement the permission vocabulary**

```ts
export type HospitalityDiscoverPermission =
  | 'hospitality.discover.read'
  | 'hospitality.discover.save'
  | 'hospitality.discover.itinerary.manage'
  | 'hospitality.offer.redeem'
  | 'hospitality.partner.read'
  | 'hospitality.partner.manage'
  | 'hospitality.place.manage'
  | 'hospitality.offer.manage'
  | 'hospitality.campaign.manage'
  | 'hospitality.analytics.read'
  | 'hospitality.partner.verify'
  | 'hospitality.content.review'
  | 'hospitality.offer.review'
  | 'hospitality.campaign.review'
  | 'hospitality.provenance.review';
```

`requireDiscoverPermission` must throw `authorization_denied` when neither the exact permission nor `*` is present.

- [ ] **Step 4: Implement normalized catalog/source types and freshness logic**

Use verification values exactly:

```ts
export const DISCOVER_VERIFICATION_STATES = [
  'unverified', 'partner_asserted', 'source_verified',
  'atlas_verified', 'stale', 'conflicted', 'disabled'
] as const;
```

`freshnessState` must return `unverified` for a missing timestamp, `stale` when `now - lastVerifiedAt > maxAgeMs`, otherwise `source_verified`.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npx vitest run tests/unit/hospitality-discover-catalog.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/hospitality-discover tests/unit/hospitality-discover-catalog.test.ts
git commit -m "feat(hospitality): add Discover catalog domain"
```

---

### Task 2: Add catalog persistence, indexes, and RLS

**Files:**
- Create: `supabase/migrations/20260912_hospitality_discover_core.sql`
- Test: `tests/integration/hospitality-discover-schema.test.ts`

**Interfaces:**
- Produces tables `hospitality_source_records`, `hospitality_categories`, `hospitality_regions`, `hospitality_places`, `hospitality_place_locations`.
- `hospitality_places` references a source record and optional partner/org ownership.
- `hospitality_place_locations` stores latitude/longitude, timezone, hours JSON, freshness timestamp, and source reference.

- [ ] **Step 1: Write a failing migration contract test**

```ts
const required = [
  'hospitality_source_records',
  'hospitality_categories',
  'hospitality_regions',
  'hospitality_places',
  'hospitality_place_locations'
];
for (const table of required) expect(sql).toContain(`create table if not exists public.${table}`);
expect(sql).toContain('enable row level security');
expect(sql).toContain('organization_members');
expect(sql).toContain('auth.uid()');
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-discover-schema.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the schema**

Include database checks for verification states and status values; add unique normalized slugs for categories/regions and a stable slug per place. Add indexes for `category_id`, `region_id`, `org_id`, `status`, `verification_status`, latitude/longitude, and a generated/searchable text document using supported PostgreSQL capabilities already enabled in the Supabase project.

- [ ] **Step 4: Implement RLS and public-read boundaries**

Catalog rows marked public/published may be selected through governed read policies. Partner-owned writes require an active matching `organization_members` row and remain additionally permission-checked in the Edge Function. Source/provenance mutation must never be open to anonymous clients.

- [ ] **Step 5: Verify the migration contract**

```bash
npx vitest run tests/integration/hospitality-discover-schema.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260912_hospitality_discover_core.sql tests/integration/hospitality-discover-schema.test.ts
git commit -m "feat(hospitality): add Discover catalog persistence"
```

---

### Task 3: Implement deterministic organic search

**Files:**
- Create: `packages/hospitality-discover/search.ts`
- Test: `tests/unit/hospitality-discover-search.test.ts`

**Interfaces:**
- Produces `normalizeSearchRequest(input): DiscoverSearchRequest`.
- Produces `rankOrganicPlace(place, request): number`.
- Sponsorship is absent from `DiscoverSearchRequest` and must not affect `rankOrganicPlace`.

- [ ] **Step 1: Write failing search tests**

```ts
expect(normalizeSearchRequest({ q: '  tacos  ', limit: 999 }).q).toBe('tacos');
expect(normalizeSearchRequest({ q: '', limit: 999 }).limit).toBe(50);
expect(rankOrganicPlace(freshVerifiedPlace, request)).toBeGreaterThan(rankOrganicPlace(stalePlace, request));
expect(JSON.stringify(normalizeSearchRequest({ q: 'parks' }))).not.toContain('sponsor');
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-discover-search.test.ts
```

Expected: FAIL because search helpers do not exist.

- [ ] **Step 3: Implement request normalization and organic scoring**

Normalize query text, category/region filters, open-now request, budget, language, bounds/radius inputs, offset, and limit. Clamp limit to `1..50`. Score only text/category/geography/data-quality/freshness/user constraints from the spec; do not include campaign or paid fields.

- [ ] **Step 4: Verify tests**

```bash
npx vitest run tests/unit/hospitality-discover-search.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/hospitality-discover/search.ts tests/unit/hospitality-discover-search.test.ts
git commit -m "feat(hospitality): add deterministic Discover search"
```

---

### Task 4: Add the Discover Edge Function read API

**Files:**
- Create: `supabase/functions/atlas-hospitality-discover/_shared/context.ts`
- Create: `supabase/functions/atlas-hospitality-discover/_shared/repository.ts`
- Create: `supabase/functions/atlas-hospitality-discover/_shared/errors.ts`
- Create: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-discover-edge.test.ts`

**Interfaces:**
- `listCategories()` returns published categories.
- `listRegions()` returns published regions.
- `searchPlaces(request)` returns normalized result items plus pagination metadata.
- `getPlace(placeId)` returns one published place and its approved locations/source state.

- [ ] **Step 1: Write failing Edge Function contract tests**

Assert the router accepts only the four read operations, imports the repository/error modules, does not reference Hospitality Access credential code, and returns normalized error codes such as `place_not_found` and `source_unavailable`.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-discover-edge.test.ts
```

Expected: FAIL because the Edge Function does not exist.

- [ ] **Step 3: Implement safe request parsing and repository reads**

All published catalog reads must select only allowed fields. Do not return internal moderation notes, private partner metadata, secret source credentials, or raw upstream payloads. Search queries use normalized server-side filters and deterministic ordering.

- [ ] **Step 4: Implement safe errors**

Map invalid requests to `invalid_request`, missing records to `place_not_found`, database failures to `source_unavailable`, and unexpected failures to `internal_error`. Response bodies must not expose stack traces or authorization headers.

- [ ] **Step 5: Verify the Edge contract**

```bash
npx vitest run tests/integration/hospitality-discover-edge.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-hospitality-discover tests/integration/hospitality-discover-edge.test.ts
git commit -m "feat(hospitality): add Discover catalog API"
```

---

### Task 5: Add visitor Discover routes and list/detail UI

**Files:**
- Create: `apps/web/src/lib/hospitalityDiscoverApi.ts`
- Create: `apps/web/src/modules/hospitality/discover/DiscoverPage.tsx`
- Create: `apps/web/src/modules/hospitality/discover/PlaceDetailPage.tsx`
- Create: `apps/web/src/modules/hospitality/discover/discover.css`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalitySubnav.tsx`
- Test: `tests/integration/hospitality-discover-routes.test.tsx`

**Interfaces:**
- Browser client exposes `searchPlaces`, `getPlace`, `listCategories`, `listRegions`.
- Routes: `/hospitality/discover` and `/hospitality/discover/places/:placeId`.

- [ ] **Step 1: Write failing route/UI tests**

```tsx
expect(screen.getByRole('heading', { name: /Discover/i })).toBeInTheDocument();
expect(screen.getByRole('searchbox')).toBeInTheDocument();
expect(screen.getByText(/No places match/i)).toBeInTheDocument();
```

Add tests for loading, API error, stale source badge, category filter, and place detail navigation.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-discover-routes.test.tsx
```

Expected: FAIL because routes/components do not exist.

- [ ] **Step 3: Implement the browser client and routes**

Add Discover imports before the `/hospitality/*` catch-all. Preserve every existing Access route exactly. Do not move Access pages behind public catalog permissions.

- [ ] **Step 4: Implement functional search/list/detail states**

The search box updates the request, filters update API parameters, place cards link to detail pages, and all loading/empty/error/success/stale states render from real response state. Do not seed fake metrics or sample merchants into production UI.

- [ ] **Step 5: Verify responsive/accessibility-critical behavior and full build**

```bash
npx vitest run tests/integration/hospitality-discover-routes.test.tsx
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/hospitalityDiscoverApi.ts apps/web/src/modules/hospitality tests/integration/hospitality-discover-routes.test.tsx
git commit -m "feat(hospitality): add Discover visitor experience"
```

---

## Completion Gate

This plan is complete when the core catalog can be persisted and read safely; search and filters operate on governed data; the visitor list/detail routes are functional; Access remains unchanged; provenance/freshness is visible; no third-party content has been copied without rights; and all focused plus full repository validation commands above pass on the exact branch head.