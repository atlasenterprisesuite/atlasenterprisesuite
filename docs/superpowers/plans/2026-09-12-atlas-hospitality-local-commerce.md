# ATLAS Hospitality Local Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add governed offers, coupon/redemption lifecycle, abuse controls, and visitor deal surfaces to Hospitality Discover without inventing payment state or merchant inventory.

**Architecture:** Offers and redemptions live in dedicated Supabase tables and domain helpers. Redemption is a server-side transaction with explicit eligibility, inventory, per-user/session limits, replay protection, partner/place scope, and auditable outcome. ATLAS Pay remains an optional downstream boundary, not the source of offer truth.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Postgres/RLS/Edge Functions, React 18.3.1, Vite 6.4.3.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

## Global Constraints

- Depends on Discover Core; concierge/map are optional consumers, not prerequisites for redemption correctness.
- No raw reusable redemption secret may be returned to unauthorized clients.
- Offer state must derive from persisted start/end/status/inventory/eligibility data.
- Payment state must never be inferred from an offer redemption.
- Redemptions must be idempotent or replay-resistant and auditable.
- Anonymous redemption may use an approved ephemeral/session reference only when product/privacy rules permit it.
- Do not fabricate discount inventory, redemptions, sales, or revenue.
- Run focused tests plus `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before completion.

---

### Task 1: Define offer and redemption domain rules

**Files:**
- Create: `packages/hospitality-discover/offers.ts`
- Create: `packages/hospitality-discover/redemptions.ts`
- Test: `tests/unit/hospitality-offers.test.ts`
- Test: `tests/unit/hospitality-redemptions.test.ts`

**Interfaces:**
- `offerState(offer, now): 'scheduled' | 'active' | 'expired' | 'disabled' | 'sold_out'`.
- `assertOfferEligible(offer, context): void`.
- `buildRedemptionKey({ offerId, userId?, anonymousSessionId? }): string`.
- `canRedeem({ offer, priorRedemptions, context }): { allowed: boolean; reason: string | null }`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
expect(offerState(activeOffer, new Date('2026-09-12T12:00:00Z'))).toBe('active');
expect(offerState(expiredOffer, new Date('2026-09-12T12:00:00Z'))).toBe('expired');
expect(canRedeem({ offer: onePerUserOffer, priorRedemptions: [redeemed], context }).allowed).toBe(false);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-offers.test.ts tests/unit/hospitality-redemptions.test.ts
```

- [ ] **Step 3: Implement deterministic offer state and eligibility**

Eligibility must check status, time window, inventory limit, per-user/session limit, allowed location scope, and supported eligibility fields. Unknown eligibility operators must fail closed with `redemption_rejected`.

- [ ] **Step 4: Implement replay-resistant redemption key construction**

The key is a deterministic server-side hash input reference derived from offer and authorized identity/session context; do not expose secret signing material in browser code.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/hospitality-offers.test.ts tests/unit/hospitality-redemptions.test.ts
npm run typecheck
git add packages/hospitality-discover tests/unit/hospitality-offers.test.ts tests/unit/hospitality-redemptions.test.ts
git commit -m "feat(hospitality): add offer and redemption rules"
```

---

### Task 2: Add offer/redemption schema and RLS

**Files:**
- Create: `supabase/migrations/20260912_hospitality_local_commerce.sql`
- Test: `tests/integration/hospitality-commerce-schema.test.ts`

**Interfaces:**
- Tables: `hospitality_offers`, `hospitality_offer_redemptions`.
- Offer rows reference partner/place and optional location scope.
- Redemption rows reference offer, place, location, campaign, attribution touch, and authenticated/approved anonymous identity reference.

- [ ] **Step 1: Write failing schema tests**

```ts
expect(sql).toContain('create table if not exists public.hospitality_offers');
expect(sql).toContain('create table if not exists public.hospitality_offer_redemptions');
expect(sql).toContain('per_user_limit');
expect(sql).toContain('inventory_limit');
expect(sql).toContain('enable row level security');
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-commerce-schema.test.ts
```

- [ ] **Step 3: Implement constraints, indexes, and uniqueness**

Add checks for non-negative limits, valid start/end ordering, valid status/verification state, and unique replay/idempotency key for accepted redemption attempts. Add indexes on active time window, place, partner, campaign, and redemption key.

- [ ] **Step 4: Add RLS**

Public users may read only published active/scheduled offer metadata allowed by the API. Partner writes require matching active org membership. Redemption inserts must occur through the governed server-side operation; do not expose permissive anonymous direct table inserts.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-commerce-schema.test.ts
npm run test:integration
git add supabase/migrations/20260912_hospitality_local_commerce.sql tests/integration/hospitality-commerce-schema.test.ts
git commit -m "feat(hospitality): add local commerce persistence"
```

---

### Task 3: Implement offer reads and redemption transaction

**Files:**
- Create: `supabase/functions/atlas-hospitality-discover/_shared/commerce-repository.ts`
- Modify: `supabase/functions/atlas-hospitality-discover/index.ts`
- Test: `tests/integration/hospitality-redemption-edge.test.ts`

**Interfaces:**
- `listActiveOffers(request)`.
- `getOffer(offerId)`.
- `redeemOffer(request, actorContext)`.
- Normalized errors: `offer_not_found`, `offer_inactive`, `offer_expired`, `offer_limit_reached`, `redemption_rejected`.

- [ ] **Step 1: Write failing Edge Function tests**

Test successful redemption, expired offer rejection, sold-out rejection, replay rejection/idempotent same-result behavior, cross-org partner write denial, and absence of raw secret material in responses.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-redemption-edge.test.ts
```

- [ ] **Step 3: Implement transaction-safe redemption**

The operation must load the offer inside a transaction/atomic database function or equivalent protected server-side path, verify current inventory and limits, create one accepted redemption, update inventory/count only once, and return a normalized redemption reference/status.

- [ ] **Step 4: Add audit event construction**

Audit payload includes actor/session reference as permitted, offer/place/location, campaign/attribution references, decision, reason, and timestamp. It must exclude reusable codes, signing secrets, authorization headers, and payment credentials.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/integration/hospitality-redemption-edge.test.ts
npm run test:integration
git add supabase/functions/atlas-hospitality-discover tests/integration/hospitality-redemption-edge.test.ts
git commit -m "feat(hospitality): add governed offer redemption"
```

---

### Task 4: Add Deals and Offer Detail UI

**Files:**
- Create: `apps/web/src/modules/hospitality/discover/DealsPage.tsx`
- Create: `apps/web/src/modules/hospitality/discover/OfferDetailPage.tsx`
- Modify: `apps/web/src/lib/hospitalityDiscoverApi.ts`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Modify: `apps/web/src/modules/hospitality/discover/discover.css`
- Test: `tests/integration/hospitality-deals-routes.test.tsx`

**Interfaces:**
- Routes: `/hospitality/discover/deals` and `/hospitality/discover/deals/:offerId`.
- Browser client adds `listActiveOffers`, `getOffer`, `redeemOffer`.

- [ ] **Step 1: Write failing visitor UI tests**

Test active deal rendering, expired/disabled state, no-deals empty state, eligibility denial, redeem success, duplicate/replay response, and disabled redemption while request is pending.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-deals-routes.test.tsx
```

- [ ] **Step 3: Implement functional offer lifecycle UI**

Render verified state, terms, validity, eligible locations, inventory-limited messaging only when real data supports it, and a redeem action only when the API reports redeemability. Do not render a payment success message unless ATLAS Pay separately confirms payment.

- [ ] **Step 4: Verify full phase**

```bash
npx vitest run tests/unit/hospitality-offers.test.ts tests/unit/hospitality-redemptions.test.ts tests/integration/hospitality-commerce-schema.test.ts tests/integration/hospitality-redemption-edge.test.ts tests/integration/hospitality-deals-routes.test.tsx
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hospitalityDiscoverApi.ts apps/web/src/modules/hospitality supabase/functions/atlas-hospitality-discover tests
git commit -m "feat(hospitality): add Discover deals experience"
```

---

## Completion Gate

This plan is complete when offers have real persisted lifecycle state, redemption is server-side and replay-resistant, limits/inventory are enforced atomically, visitor deal routes work, no payment or revenue state is fabricated, and all repository validation passes.