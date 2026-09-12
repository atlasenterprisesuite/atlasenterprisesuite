# ATLAS Hospitality Assistant & Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured itinerary planning, ATLAS Assistant Discover intents, multilingual/accessibility support, and verified cross-module handoffs to Ride, Pay, CRM, Creator Studio, and Accounting.

**Architecture:** The Assistant never invents local availability. It calls structured Discover operations that return catalog, offer, itinerary, sponsorship, freshness, and integration-readiness data. Cross-module actions use small adapters with explicit readiness/capability states; a handoff is successful only when the destination subsystem returns a confirmed result.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, React 18.3.1, Vite 6.4.3, Supabase Edge Functions/Postgres/RLS, existing ATLAS Assistant/`atlas-copilot` authorization patterns, existing ATLAS module contracts where available.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

## Global Constraints

- Depends on Discover Core; map, commerce, and campaign plans enrich results when implemented.
- ATLAS Assistant must consume structured real data and preserve uncertainty/freshness state.
- Sponsored results must remain distinguishable from organic recommendations in Assistant responses.
- Ride is not booked until Ride confirms it; Pay is not paid until Pay/provider confirms it; booking is not confirmed until the booking source confirms it.
- Discover must not duplicate CRM, Creator Studio, Ride, Pay, or Accounting sources of truth.
- No raw payment credentials, provider secrets, private hotel access material, or hidden sponsorship influence may enter Assistant prompts/responses.
- Initial UI locales: English (`en`), Spanish (`es`), Portuguese (`pt`).
- Accessibility requires keyboard paths, screen-reader-readable results, non-map alternatives, visible focus, and semantic sponsorship labels.
- Run focused tests plus `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before completion.

---

### Task 1: Define structured itinerary domain and constraint engine

**Files:**
- Create: `packages/hospitality-discover/itineraries.ts`
- Test: `tests/unit/hospitality-itineraries.test.ts`

**Interfaces:**
- `normalizeItineraryRequest(input): ItineraryRequest`.
- `buildItinerary({ request, candidates, routing }): ItineraryResult`.
- `ItineraryResult` contains ordered stops, reason codes, verified offers, data freshness notes, and travel estimates only when routing evidence exists.

- [ ] **Step 1: Write failing itinerary tests**

```ts
expect(normalizeItineraryRequest({ partySize: 0, language: 'es' }).partySize).toBe(1);
expect(result.stops.every((stop) => !request.excludedCategories.includes(stop.categoryId))).toBe(true);
expect(noRoutingResult.travelEstimate).toBeNull();
```

Add tests for fixed stops, budget ceiling, time window, accessibility constraints, category preferences, and deal preference without forcing sponsored results.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-itineraries.test.ts
```

- [ ] **Step 3: Implement request normalization and deterministic constraint filtering**

Clamp party size to at least `1`, validate start/end times, normalize language to supported locale/fallback, preserve fixed stops, and fail with `insufficient_verified_data` when required constraints cannot be satisfied from real candidates.

- [ ] **Step 4: Implement ordering and explanation metadata**

Each stop must include machine-readable reason codes such as `category_match`, `budget_match`, `nearby`, `verified_offer`, `fixed_stop`, or `accessibility_match`. Do not add route time/distance when a routing source did not supply it.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-itineraries.test.ts
npm run typecheck
git add packages/hospitality-discover/itineraries.ts tests/unit/hospitality-itineraries.test.ts
git commit -m "feat(hospitality): add structured itinerary engine"
```

---

### Task 2: Add saved itinerary persistence and API

**Files:**
- Create: `supabase/migrations/20260912_hospitality_itineraries.sql`
- Create: `supabase/functions/atlas-hospitality-discover/_shared/itinerary-repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-itinerary-edge.test.ts`

**Interfaces:**
- Table: `hospitality_itineraries` with user/org scope, normalized request JSON, normalized result JSON, locale, created/updated timestamps.
- Operations: `buildItinerary`, `saveItinerary`, `getItinerary`, `updateItinerary`.

- [ ] **Step 1: Write failing persistence/authorization tests**

Test anonymous build without save, authenticated save success, cross-user read denial, cross-org denial, invalid place reference rejection, and saved payload excluding precise location when retention was not explicitly requested.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-itinerary-edge.test.ts
```

- [ ] **Step 3: Implement schema/RLS and API**

User-owned itineraries require `auth.uid()` ownership and applicable org membership. Public build may operate without persistence. Saved results store place references and explanation/freshness metadata rather than copied third-party content.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-itinerary-edge.test.ts
npm run test:integration
git add supabase/migrations/20260912_hospitality_itineraries.sql supabase/functions/atlas-hospitality-discover tests/integration/hospitality-itinerary-edge.test.ts
git commit -m "feat(hospitality): add saved Discover itineraries"
```

---

### Task 3: Add itinerary visitor UI

**Files:**
- Create: `apps/web/src/modules/hospitality/discover/ItinerariesPage.tsx`
- Create: `apps/web/src/modules/hospitality/discover/ItineraryDetailPage.tsx`
- Modify: `apps/web/src/lib/hospitalityDiscoverApi.ts`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Test: `tests/integration/hospitality-itinerary-routes.test.tsx`

**Interfaces:**
- Routes: `/hospitality/discover/itineraries`, `/hospitality/discover/itineraries/:itineraryId`.

- [ ] **Step 1: Write failing UI tests**

Test constraint form validation, build loading/error/success, unsatisfied-constraints state, saved itinerary navigation, editing fixed stops, and an explicit indication when travel time is unavailable rather than guessed.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-itinerary-routes.test.tsx
```

- [ ] **Step 3: Implement API-backed itinerary forms and result cards**

All stop cards link to real place detail routes. Verified offers are rendered only from offer references returned by the API. Sponsored insertions, if later allowed in a specific itinerary surface, use a separate labeled block and never replace required/fixed stops.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-itinerary-routes.test.tsx
npm run typecheck
npm run build
git add apps/web/src/lib/hospitalityDiscoverApi.ts apps/web/src/modules/hospitality tests/integration/hospitality-itinerary-routes.test.tsx
git commit -m "feat(hospitality): add Discover itinerary UI"
```

---

### Task 4: Add ATLAS Assistant Discover tool contract

**Files:**
- Create: `packages/hospitality-discover/assistant-tools.ts`
- Modify: `supabase/functions/atlas-copilot/agentic-core.mjs`
- Test: `tests/unit/hospitality-assistant-tools.test.ts`
- Test: `tests/integration/hospitality-assistant-contract.test.ts`

**Interfaces:**
- Intents: `discover.search_places`, `discover.filter_places`, `discover.find_deals`, `discover.build_itinerary`, `discover.modify_itinerary`, `discover.explain_place`, `discover.concierge_recommend`, `discover.start_directions`, `discover.request_ride`, `discover.redeem_offer`.
- Tool results include `resultKind`, entity references, `verificationStatus`, `freshness`, `sponsorship`, and `integrationState` where relevant.

- [ ] **Step 1: Write failing tool-schema tests**

```ts
expect(DISCOVER_ASSISTANT_INTENTS).toContain('discover.search_places');
expect(DISCOVER_ASSISTANT_INTENTS).toContain('discover.request_ride');
expect(normalizeAssistantResult({ sponsorship: 'sponsored' }).sponsorship).toBe('sponsored');
```

Test that unknown intents fail closed and that result normalization preserves `stale`/`unverified` state.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-assistant-tools.test.ts tests/integration/hospitality-assistant-contract.test.ts
```

- [ ] **Step 3: Implement structured tool definitions and permission mapping**

Read-only place/deal searches use Discover read capability. Saving itineraries, redemptions, and external handoffs require the relevant identity/permission/integration checks. Do not grant Hospitality Access permissions through Assistant Discover tools.

- [ ] **Step 4: Wire the canonical Assistant router to the Discover Edge Function contract**

The Assistant receives normalized responses, not direct unrestricted database access. Sponsored/organic state and data freshness must be included in the tool result so response generation cannot hide them.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-assistant-tools.test.ts tests/integration/hospitality-assistant-contract.test.ts
npm run typecheck
git add packages/hospitality-discover/assistant-tools.ts supabase/functions/atlas-copilot/agentic-core.mjs tests
git commit -m "feat(hospitality): connect Discover to ATLAS Assistant"
```

---

### Task 5: Add fail-closed Ride, Pay, CRM, Creator, and Accounting adapters

**Files:**
- Create: `packages/hospitality-discover/integrations.ts`
- Create: `supabase/functions/atlas-hospitality-discover/_shared/integrations.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/unit/hospitality-integrations.test.ts`
- Test: `tests/integration/hospitality-integration-edge.test.ts`

**Interfaces:**
- `IntegrationState = 'not_configured' | 'configured_unverified' | 'ready' | 'degraded' | 'offline'`.
- `requestRideHandoff(request)` returns confirmed destination-subsystem reference or normalized unavailable state.
- `requestPayHandoff(request)` returns payment/checkout handoff reference only from real Pay capability.
- `syncPartnerToCrm(request)`, `requestCreatorAsset(request)`, `postAccountingEvent(request)` use canonical module contracts when present.

- [ ] **Step 1: Write failing readiness/handoff tests**

```ts
expect(await integrations.ride.request({ destination })).toEqual({ state: 'not_configured', reference: null });
expect(await integrations.pay.request({ amount: 10, currency: 'USD' })).not.toMatchObject({ state: 'paid' });
```

Test that unavailable integrations return normalized state and do not throw raw provider secret/error payloads.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-integrations.test.ts tests/integration/hospitality-integration-edge.test.ts
```

- [ ] **Step 3: Implement canonical-adapter discovery and fail-closed defaults**

Reuse existing module/API contracts when they exist. Where a destination module lacks a callable production contract, return `not_configured` with an explicit blocker; do not create a duplicate ledger, CRM, ride engine, payment processor, or media generator inside Hospitality.

- [ ] **Step 4: Add observed handoff attribution**

On a confirmed handoff request, record only the observed `ride_handoff`, `payment_handoff`, or applicable event. A handoff event is not proof of completed ride/payment/booking.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-integrations.test.ts tests/integration/hospitality-integration-edge.test.ts
npm run test:unit
npm run test:integration
git add packages/hospitality-discover/integrations.ts supabase/functions/atlas-hospitality-discover tests
git commit -m "feat(hospitality): add governed cross-module handoffs"
```

---

### Task 6: Add locale architecture and accessibility-critical verification

**Files:**
- Create: `apps/web/src/modules/hospitality/discover/i18n.ts`
- Create: `apps/web/src/modules/hospitality/discover/locales/en.ts`
- Create: `apps/web/src/modules/hospitality/discover/locales/es.ts`
- Create: `apps/web/src/modules/hospitality/discover/locales/pt.ts`
- Modify: `apps/web/src/modules/hospitality/discover/*.tsx`
- Modify: `apps/web/src/modules/hospitality/partners/*.tsx`
- Test: `tests/integration/hospitality-discover-i18n-a11y.test.tsx`

**Interfaces:**
- `discoverText(locale)` returns the complete ATLAS-authored Discover UI dictionary for `en`, `es`, or `pt`, falling back to `en`.

- [ ] **Step 1: Write failing locale/accessibility tests**

Test English/Spanish/Portuguese labels, English fallback, keyboard reachability of search/filter/results, semantic `Sponsored` labeling, visible textual stale/unverified state, and list access when map is absent.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-discover-i18n-a11y.test.tsx
```

- [ ] **Step 3: Implement locale dictionaries and remove hard-coded Discover UI strings**

Partner descriptions remain in their source language unless a translated field with provenance exists. Do not silently machine-translate partner legal terms at render time.

- [ ] **Step 4: Implement accessibility-critical semantics**

Use native controls where possible, labeled regions/forms, `aria-live` for async result count/status updates, visible focus, semantic headings, textual offer terms, and a non-map result list.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-discover-i18n-a11y.test.tsx
npm run typecheck
npm run build
git add apps/web/src/modules/hospitality tests/integration/hospitality-discover-i18n-a11y.test.tsx
git commit -m "feat(hospitality): add Discover i18n and accessibility"
```

---

### Task 7: Add final readiness gates and production-truth verification

**Files:**
- Create: `docs/hospitality/DISCOVER_READINESS.md`
- Create: `tests/integration/hospitality-discover-security-contract.test.ts`
- Create: `.github/workflows/hospitality-discover-ci.yml`

**Interfaces:**
- Readiness document tracks separately: source validated, schema applied, Edge Function deployed, route reachable, provider configured, provider verified, campaign active, offer active, analytics observed, public edge verified.

- [ ] **Step 1: Write failing security contract tests**

Assert no Discover browser file references service-role keys/provider secrets, no room-access credential material is imported into Discover, partner/campaign writes require server-side operations, and integration states never default to `ready`.

- [ ] **Step 2: Run focused security tests**

```bash
npx vitest run tests/integration/hospitality-discover-security-contract.test.ts
```

Expected: FAIL until the contract file/checks are in place.

- [ ] **Step 3: Add CI workflow**

Workflow commands:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

The workflow validates source only; its success must not be described as public production deployment.

- [ ] **Step 4: Create `DISCOVER_READINESS.md` with explicit gates**

Document the exact distinction between implemented code, applied migrations, deployed Edge Function/UI, configured external providers, verified external providers, and public-edge verification. Include known blockers as concrete evidence references rather than generic `live` status.

- [ ] **Step 5: Run full repository verification**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: PASS on the exact branch head before merge/deploy is proposed.

- [ ] **Step 6: Commit**

```bash
git add docs/hospitality/DISCOVER_READINESS.md tests/integration/hospitality-discover-security-contract.test.ts .github/workflows/hospitality-discover-ci.yml
git commit -m "test(hospitality): add Discover production readiness gates"
```

---

## Completion Gate

This plan is complete when itineraries consume structured real catalog data, Assistant intents use governed Discover tools, sponsorship/freshness remain visible, Ride/Pay/CRM/Creator/Accounting handoffs fail closed unless their destination capability is verified, `en/es/pt` UI and accessibility-critical paths are tested, and source validation plus production-truth gates are explicit.