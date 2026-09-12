# ATLAS Hospitality Partners, Campaigns & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-scoped partner management, merchant/place ownership, sponsored campaigns, review gates, attribution events, and auditable partner analytics to Hospitality Discover.

**Architecture:** Partner and campaign writes are authenticated, org-scoped, and permission-gated. Sponsored candidates are produced by a separate campaign pipeline and merged only at presentation time with explicit labels; they never modify organic search scores. Analytics aggregates observed events only and preserves the distinction between observed and inferred outcomes.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Postgres/RLS/Edge Functions, React 18.3.1, Vite 6.4.3.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

## Global Constraints

- Depends on Discover Core; offer/campaign links may additionally consume Local Commerce.
- Partner-owned content must be scoped to `org_id` and authorized membership.
- Sponsorship must never alter factual verification state or organic ranking score.
- Every sponsored result must be visibly labeled.
- High-stakes categories are excluded from sponsored ranking.
- Analytics must not claim sales, bookings, rides, payments, or revenue unless a corresponding observed source event exists.
- Do not create a second CRM or general ledger; store references to those systems when integrated.
- Run focused tests plus `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before completion.

---

### Task 1: Define partner, campaign, sponsorship, and attribution domain contracts

**Files:**
- Create: `packages/hospitality-discover/partners.ts`
- Create: `packages/hospitality-discover/campaigns.ts`
- Create: `packages/hospitality-discover/attribution.ts`
- Test: `tests/unit/hospitality-partners.test.ts`
- Test: `tests/unit/hospitality-campaigns.test.ts`
- Test: `tests/unit/hospitality-attribution.test.ts`

**Interfaces:**
- `canPublishPartnerContent(partner): boolean`.
- `campaignState(campaign, now): 'draft' | 'pending_review' | 'scheduled' | 'active' | 'paused' | 'ended' | 'rejected'`.
- `eligibleSponsoredCandidates(campaigns, context): SponsoredCandidate[]`.
- `normalizeAttributionEvent(input): HospitalityAttributionEvent`.

- [ ] **Step 1: Write failing sponsorship separation tests**

```ts
expect(canPublishPartnerContent({ verificationStatus: 'unverified', status: 'active' })).toBe(false);
expect(campaignState(activeCampaign, new Date('2026-09-12T12:00:00Z'))).toBe('active');
expect(eligibleSponsoredCandidates([highStakesCampaign], { categoryRisk: 'high' })).toEqual([]);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-partners.test.ts tests/unit/hospitality-campaigns.test.ts tests/unit/hospitality-attribution.test.ts
```

- [ ] **Step 3: Implement partner verification and campaign state rules**

Partner publication requires approved verification state. Campaign activation requires approved review state, valid time window, active partner, allowed placement, and permitted targeting.

- [ ] **Step 4: Implement attribution event normalization**

Allowed observed event types:

```ts
export type HospitalityAttributionEventType =
  | 'impression'
  | 'sponsored_impression'
  | 'place_opened'
  | 'external_website_clicked'
  | 'phone_clicked'
  | 'directions_started'
  | 'place_saved'
  | 'offer_viewed'
  | 'offer_redeemed'
  | 'itinerary_added'
  | 'ride_handoff'
  | 'payment_handoff'
  | 'booking_handoff';
```

Reject unknown event names; normalize source surface, place/offer/campaign/property references, permitted identity/session reference, timestamp, and consent/privacy metadata.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-partners.test.ts tests/unit/hospitality-campaigns.test.ts tests/unit/hospitality-attribution.test.ts
npm run typecheck
git add packages/hospitality-discover tests/unit/hospitality-partners.test.ts tests/unit/hospitality-campaigns.test.ts tests/unit/hospitality-attribution.test.ts
git commit -m "feat(hospitality): add partner campaign attribution domain"
```

---

### Task 2: Add partner/campaign/attribution schema and RLS

**Files:**
- Create: `supabase/migrations/20260912_hospitality_partners_campaigns.sql`
- Test: `tests/integration/hospitality-partner-schema.test.ts`

**Interfaces:**
- Tables: `hospitality_partners`, `hospitality_campaigns`, `hospitality_attribution_events`.
- Partner rows may reference canonical CRM and billing customer identifiers.
- Campaign rows reference partner and optional place/offer/property targeting.

- [ ] **Step 1: Write failing schema tests**

```ts
for (const table of ['hospitality_partners','hospitality_campaigns','hospitality_attribution_events']) {
  expect(sql).toContain(`create table if not exists public.${table}`);
}
expect(sql).toContain('enable row level security');
expect(sql).toContain('organization_members');
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-partner-schema.test.ts
```

- [ ] **Step 3: Implement constraints and indexes**

Add checks for valid partner type/status/verification, campaign review/status/billing model, campaign start/end ordering, and allowed attribution event types. Index `org_id`, `partner_id`, `campaign_id`, `place_id`, `offer_id`, `property_context_id`, event type, and event timestamp.

- [ ] **Step 4: Implement RLS**

Partner and campaign mutation requires matching active org membership. Review/verification actions remain additionally permission-checked server-side. Raw analytics events are not generally public-readable; partner analytics access is scoped to the owning org.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-partner-schema.test.ts
npm run test:integration
git add supabase/migrations/20260912_hospitality_partners_campaigns.sql tests/integration/hospitality-partner-schema.test.ts
git commit -m "feat(hospitality): add partner campaign analytics persistence"
```

---

### Task 3: Add partner CRUD and review API

**Files:**
- Create: `supabase/functions/atlas-hospitality-discover/_shared/partner-repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-partner-edge.test.ts`

**Interfaces:**
- `getPartner`, `upsertPlace`, `upsertLocation`, `verifyPartner`, `reviewPlace`.
- All write operations require exact Discover permissions and matching org scope.

- [ ] **Step 1: Write failing authorization tests**

Test cross-org denial, unverified partner publish denial, permitted same-org draft mutation, reviewer verification success, and reviewer denial without `hospitality.partner.verify`.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-partner-edge.test.ts
```

- [ ] **Step 3: Implement scoped partner/place mutation**

Every repository query must bind `org_id`. Place overlays owned by a partner may update only partner-controlled fields; provenance/source verification fields require reviewer permission and cannot be overwritten by normal partner users.

- [ ] **Step 4: Implement verification/review audit events**

Record actor, org, partner/place reference, prior state, new state, timestamp, and review reason/reference. Do not include secrets or private provider credentials.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-partner-edge.test.ts
npm run test:integration
git add supabase/functions/atlas-hospitality-discover tests/integration/hospitality-partner-edge.test.ts
git commit -m "feat(hospitality): add governed partner management API"
```

---

### Task 4: Add campaign lifecycle, sponsored candidate API, and review gates

**Files:**
- Create: `supabase/functions/atlas-hospitality-discover/_shared/campaign-repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Modify: `packages/hospitality-discover/search.ts`
- Test: `tests/integration/hospitality-campaign-edge.test.ts`
- Test: `tests/unit/hospitality-discover-search.test.ts`

**Interfaces:**
- `createCampaign`, `updateCampaign`, `reviewCampaign`, `listSponsoredCandidates`.
- `searchPlaces` remains organic-only.

- [ ] **Step 1: Write failing separation tests**

```ts
expect(rankOrganicPlace(sponsoredPlace, request)).toBe(rankOrganicPlace(unsponsoredEquivalent, request));
expect(sponsoredResults.every((r) => r.sponsorshipLabel === 'Sponsored')).toBe(true);
```

Test campaign activation denied before review and high-stakes sponsored query returns zero candidates.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-discover-search.test.ts tests/integration/hospitality-campaign-edge.test.ts
```

- [ ] **Step 3: Implement campaign lifecycle and separate sponsored query**

Do not add campaign columns to organic scoring. Sponsored candidates are filtered by active state, approved review, partner verification, geography/category/property targeting, placement type, and high-stakes exclusion.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-discover-search.test.ts tests/integration/hospitality-campaign-edge.test.ts
npm run typecheck
git add packages/hospitality-discover/search.ts supabase/functions/atlas-hospitality-discover tests
git commit -m "feat(hospitality): add reviewed sponsored campaigns"
```

---

### Task 5: Add attribution ingestion and observed analytics aggregation

**Files:**
- Create: `supabase/functions/atlas-hospitality-discover/_shared/analytics-repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-analytics-edge.test.ts`

**Interfaces:**
- `recordAttributionEvent(event)`.
- `getPartnerAnalytics({ partnerId, from, to })` returns observed counts grouped by event type and campaign/place/offer references.

- [ ] **Step 1: Write failing analytics tests**

Test event validation, campaign/org scoping, duplicate impression deduplication key behavior where supplied, and that analytics responses label metrics as observed event counts rather than revenue/sales.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-analytics-edge.test.ts
```

- [ ] **Step 3: Implement minimal-event ingestion and aggregation**

Store only the minimum permitted context. `getPartnerAnalytics` must count persisted observed events and must not derive money values from click/redemption counts. Revenue joins belong to the Accounting/Pay integration plan and only when real transaction references exist.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-analytics-edge.test.ts
npm run test:integration
git add supabase/functions/atlas-hospitality-discover tests/integration/hospitality-analytics-edge.test.ts
git commit -m "feat(hospitality): add observed partner analytics"
```

---

### Task 6: Build partner, campaign, and analytics UI

**Files:**
- Create: `apps/web/src/modules/hospitality/partners/PartnersPage.tsx`
- Create: `apps/web/src/modules/hospitality/partners/PartnerPlacesPage.tsx`
- Create: `apps/web/src/modules/hospitality/partners/PartnerOffersPage.tsx`
- Create: `apps/web/src/modules/hospitality/partners/CampaignsPage.tsx`
- Create: `apps/web/src/modules/hospitality/partners/PartnerAnalyticsPage.tsx`
- Create: `apps/web/src/modules/hospitality/partners/partners.css`
- Modify: `apps/web/src/lib/hospitalityDiscoverApi.ts`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Test: `tests/integration/hospitality-partner-routes.test.tsx`

**Interfaces:**
- Routes: `/hospitality/partners`, `/hospitality/partners/places`, `/hospitality/partners/offers`, `/hospitality/partners/campaigns`, `/hospitality/partners/analytics`.

- [ ] **Step 1: Write failing CRUD/review/analytics UI tests**

Test form validation, save success/error, disabled publish for unverified partner, sponsored label visibility, campaign pending-review state, empty analytics state, and permission-based action visibility.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-partner-routes.test.tsx
```

- [ ] **Step 3: Implement real API-backed forms and tables**

Search/filter/table controls must affect real loaded data. Save buttons call the governed API and show persisted response state. No dashboard metric is hard-coded.

- [ ] **Step 4: Verify full phase**

```bash
npx vitest run tests/unit/hospitality-partners.test.ts tests/unit/hospitality-campaigns.test.ts tests/unit/hospitality-attribution.test.ts tests/integration/hospitality-partner-schema.test.ts tests/integration/hospitality-partner-edge.test.ts tests/integration/hospitality-campaign-edge.test.ts tests/integration/hospitality-analytics-edge.test.ts tests/integration/hospitality-partner-routes.test.tsx
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hospitalityDiscoverApi.ts apps/web/src/modules/hospitality/partners apps/web/src/modules/hospitality/HospitalityRoutes.tsx tests
git commit -m "feat(hospitality): add partner campaigns and analytics UI"
```

---

## Completion Gate

This plan is complete when partner CRUD is org-scoped, verification/review gates work, sponsored candidates are separate and visibly labeled, high-stakes categories cannot be monetized through ranking, attribution stores observed events, analytics does not invent outcomes, and full repository validation passes.