# ATLAS Hospitality Map & Concierge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a synchronized map/list experience and property-scoped hotel concierge flows on top of the governed Discover catalog.

**Architecture:** Keep geospatial business logic and provider readiness behind adapters. The UI consumes normalized map points and property concierge context; exact user location is optional, consent-based, and transient by default. Concierge context never grants Hospitality Access permissions.

**Tech Stack:** React 18.3.1, TypeScript 5.7, Vite 6.4.3, Vitest 3.2.6, Supabase, PostgreSQL/PostGIS when available, adapter-based map/geocoding/routing providers.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

## Global Constraints

- Depends on `2026-09-12-atlas-hospitality-discover-core.md`.
- Map interaction must have an accessible non-map list equivalent.
- Do not store precise location indefinitely by default.
- Distinguish straight-line distance from route distance.
- Do not show a map/routing provider as connected unless readiness is verified.
- Property concierge context does not imply guest identity, room access, reservation access, or door permissions.
- QR/deep links must not contain reusable privileged tokens or secrets.
- Run focused tests plus `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before completion.

---

### Task 1: Add geospatial request and map adapter contracts

**Files:**
- Create: `packages/hospitality-discover/geo.ts`
- Create: `packages/hospitality-discover/map-provider.ts`
- Test: `tests/unit/hospitality-discover-geo.test.ts`

**Interfaces:**
- `normalizeGeoFilter(input): DiscoverGeoFilter`.
- `distanceKm(a, b): number` for deterministic straight-line calculations when coordinates exist.
- `MapProviderAdapter.readiness(): Promise<MapProviderReadiness>`.
- `MapProviderAdapter.directions?(request): Promise<DirectionsResult>`.

- [ ] **Step 1: Write failing geo tests**

```ts
expect(normalizeGeoFilter({ radiusKm: 999 }).radiusKm).toBe(50);
expect(normalizeGeoFilter({ latitude: 28.5383, longitude: -81.3792 }).center).toEqual({ latitude: 28.5383, longitude: -81.3792 });
expect(distanceKm({ latitude: 28.5383, longitude: -81.3792 }, { latitude: 28.4177, longitude: -81.5812 })).toBeGreaterThan(0);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-discover-geo.test.ts
```

- [ ] **Step 3: Implement normalized bounds/radius logic**

Reject invalid latitude outside `-90..90`, longitude outside `-180..180`, and negative radius. Clamp public radius search to `50 km` for the first milestone.

- [ ] **Step 4: Implement fail-closed provider readiness**

```ts
export type MapProviderReadiness = {
  state: 'not_configured' | 'configured_unverified' | 'ready' | 'degraded' | 'offline';
  checkedAt: string;
  blocker: string | null;
};
```

No adapter may return `ready` merely because an environment variable exists; it must complete the provider's documented non-destructive readiness check when one exists.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-discover-geo.test.ts
npm run typecheck
git add packages/hospitality-discover tests/unit/hospitality-discover-geo.test.ts
git commit -m "feat(hospitality): add Discover geospatial contracts"
```

---

### Task 2: Extend search with bounds/radius queries

**Files:**
- Modify: `supabase/migrations/20260912_hospitality_discover_core.sql`
- Modify: `supabase/functions/atlas-hospitality-discover/_shared/repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-discover-geo-search.test.ts`

**Interfaces:**
- `searchPlaces` accepts `bounds` or `center + radiusKm`.
- Result rows include coordinates only for published locations.
- `distanceKm` is returned only when computed from real coordinates.

- [ ] **Step 1: Write failing geo-search contract tests**

Assert the migration supports indexed location coordinates and the repository scopes searches by bounds/radius rather than loading all rows into memory.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-discover-geo-search.test.ts
```

- [ ] **Step 3: Add indexed geospatial support**

Use PostGIS geography when the extension is available in the project. If PostGIS is not available, use indexed numeric latitude/longitude bounding filters and retain `distanceKm` as straight-line distance. Do not introduce an external geospatial database.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-discover-geo-search.test.ts
npm run test:integration
git add supabase/migrations/20260912_hospitality_discover_core.sql supabase/functions/atlas-hospitality-discover tests/integration/hospitality-discover-geo-search.test.ts
git commit -m "feat(hospitality): add geographic Discover search"
```

---

### Task 3: Build synchronized map/list UI

**Files:**
- Create: `apps/web/src/modules/hospitality/discover/MapPage.tsx`
- Create: `apps/web/src/modules/hospitality/discover/DiscoverMap.tsx`
- Create: `apps/web/src/modules/hospitality/discover/DiscoverResultList.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Modify: `apps/web/src/modules/hospitality/discover/discover.css`
- Test: `tests/integration/hospitality-discover-map.test.tsx`

**Interfaces:**
- Route: `/hospitality/discover/map`.
- Selecting a card selects the matching map point.
- Selecting a point focuses the matching card.
- Search/filter state is shared between map and list.

- [ ] **Step 1: Write failing synchronization tests**

```tsx
await user.click(screen.getByRole('button', { name: /Place A/i }));
expect(screen.getByTestId('map-point-place-a')).toHaveAttribute('aria-selected', 'true');
```

Also test empty results, provider-unavailable state, keyboard list navigation, and a visible list when map rendering is unavailable.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-discover-map.test.tsx
```

- [ ] **Step 3: Implement map/list state without hard-wiring provider business logic**

`DiscoverMap` receives normalized points and selection callbacks only. Provider SDK/bootstrap code stays behind a thin map-provider integration boundary so replacing providers does not change place/search domain logic.

- [ ] **Step 4: Add user-location consent behavior**

The UI must work without precise location. When location is granted, pass coordinates into the search request in memory; do not persist them to the catalog or analytics tables by default.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-discover-map.test.tsx
npm run typecheck
npm run build
git add apps/web/src/modules/hospitality tests/integration/hospitality-discover-map.test.tsx
git commit -m "feat(hospitality): add synchronized Discover map"
```

---

### Task 4: Add property concierge persistence and API

**Files:**
- Create: `supabase/migrations/20260912_hospitality_concierge.sql`
- Create: `packages/hospitality-discover/concierge.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/_shared/repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-concierge.test.ts`

**Interfaces:**
- Table: `hospitality_concierge_contexts`.
- Operation: `getConciergeContext({ propertySlug })`.
- Context exposes approved categories, partner/offer references, locale defaults, branding-safe text/media references, and property location.

- [ ] **Step 1: Write failing concierge scope tests**

Assert a published property concierge context can be read by slug while private configuration, internal notes, room identifiers, provider credentials, and reservation PII are absent from the response.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-concierge.test.ts
```

- [ ] **Step 3: Implement schema and RLS**

Property admins/authorized partner users may manage contexts only for their org/property. Public reads return only fields explicitly marked publishable.

- [ ] **Step 4: Implement `getConciergeContext`**

Return `concierge_not_found` for unknown slugs and `concierge_disabled` for disabled contexts. Never infer guest stay or room assignment from a property slug.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-concierge.test.ts
npm run test:integration
git add packages/hospitality-discover/concierge.ts supabase/migrations/20260912_hospitality_concierge.sql supabase/functions/atlas-hospitality-discover tests/integration/hospitality-concierge.test.ts
git commit -m "feat(hospitality): add property concierge context"
```

---

### Task 5: Add concierge landing and QR/deep-link behavior

**Files:**
- Create: `apps/web/src/modules/hospitality/discover/ConciergePage.tsx`
- Create: `packages/hospitality-discover/deep-links.ts`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Test: `tests/integration/hospitality-concierge-routes.test.tsx`
- Test: `tests/unit/hospitality-deep-links.test.ts`

**Interfaces:**
- Route: `/hospitality/discover/concierge/:propertySlug`.
- `buildDiscoverDeepLink({ kind, idOrSlug, campaignId? })` returns canonical ATLAS HTTPS paths only.

- [ ] **Step 1: Write failing deep-link tests**

```ts
expect(buildDiscoverDeepLink({ kind: 'concierge', idOrSlug: 'hotel-a' })).toBe('/hospitality/discover/concierge/hotel-a');
expect(() => buildDiscoverDeepLink({ kind: 'concierge', idOrSlug: '../admin' })).toThrow('invalid_deep_link');
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-deep-links.test.ts tests/integration/hospitality-concierge-routes.test.tsx
```

- [ ] **Step 3: Implement safe canonical deep links and concierge UI**

The page shows property context, approved discovery categories, places/offers when present, language selection, and honest empty/degraded states. No Access UI/actions may be rendered from concierge context.

- [ ] **Step 4: Verify full phase**

```bash
npx vitest run tests/unit/hospitality-deep-links.test.ts tests/integration/hospitality-discover-map.test.tsx tests/integration/hospitality-concierge.test.ts tests/integration/hospitality-concierge-routes.test.tsx
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/hospitality-discover apps/web/src/modules/hospitality supabase/migrations/20260912_hospitality_concierge.sql supabase/functions/atlas-hospitality-discover tests
git commit -m "feat(hospitality): add hotel Discover concierge"
```

---

## Completion Gate

This plan is complete when geographic filtering works on persisted coordinates, map/list state is synchronized and accessible, the product works without precise location permission, concierge context is property-scoped and isolated from room-access privileges, deep links are safe, and repository validation passes.