# ATLAS Commerce Core Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first working ATLAS Commerce vertical slice: tenant-scoped catalog, cart, deterministic pricing, fail-closed checkout, durable order commit/outbox, truthful integration delivery state, protected Commerce administration, minimal public storefront, and fail-closed production verification.

**Architecture:** Add a focused `@atlas/commerce` domain package and Commerce Supabase persistence/API while reusing `@atlas/core` tenant scope/permissions, current ATLAS Identity/session patterns, existing execution/audit conventions, Creator/Library asset references, the canonical module registry, and the existing Cloudflare production verifier. Because canonical `packages/pos`, `packages/inventory`, and `packages/crm` domain packages plus an Accounting revenue-posting contract are not present on the current branch, this slice must persist downstream delivery state and explicitly block unavailable adapters instead of inventing successful stock, CRM, accounting, or payment effects.

**Tech Stack:** TypeScript 5.7, React 18, React Router, Vite 6, Vitest 3, Testing Library, Supabase Postgres/RLS, Supabase Edge Functions/Deno, Cloudflare Workers deployment verification.

**Spec:** `docs/superpowers/specs/2026-09-16-atlas-commerce-design.md`

## Global Constraints

- Repository: `atlasenterprisesuite/atlasenterprisesuite`; implementation branch: `feat/atlas-commerce`; integration target: `main` only after all gates pass.
- Do not introduce a second tenant model, customer master, inventory ledger, accounting ledger, workflow engine, or payment truth source.
- All authoritative monetary values are integer minor units plus ISO currency; binary floating point is never authoritative.
- Workspace Commerce mutations require authenticated identity, active organization membership, same-scope checks, and explicit Commerce permission.
- `commerce.admin` may satisfy granular Commerce permissions only; it must not imply Accounting, CRM, Inventory, payment, or generic Execution authority.
- Public storefront reads are constrained to one published storefront and published catalog records. Public clients never receive workspace permissions.
- Browser-provided totals, tenant IDs, organization IDs, payment states, inventory states, and final order states are never trusted as authoritative.
- Payment, shipping, tax, Inventory, Accounting, CRM, or analytics adapters may report success only from an implemented and verified adapter. Missing adapters fail closed with durable reason codes.
- Product/storefront media must reference existing ATLAS Library/Creator assets first. This slice stores asset references and never duplicates binary media or generates replacement media automatically.
- Checkout and provider retries are idempotent. Reusing one idempotency key with materially different input returns `IDEMPOTENCY_CONFLICT`.
- A paid/confirmed order is not rolled back because a later downstream integration fails; the delivery/exception state records that failure separately.
- No production claim is valid from a branch build alone. Production verification occurs only after an authorized deployment of `main`.
- Final deployment verification is fail-closed and must retain checks for `https://www.atlasenterprisesuite.com` plus ATLAS Network critical routes, then add Commerce routes.
- Required final local/CI gates: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run verify:all`.

---

## Slice Boundary

This plan implements the minimum closed Commerce loop:

`Published Product -> Cart -> Server Pricing -> Checkout -> Payment Adapter Gate -> Atomic Order -> commerce.order.completed.v1 -> Durable Integration Deliveries -> Admin Order View`

It also exposes a minimal public catalog/cart route and protected `/commerce` administration. Promotions beyond a deterministic fixed adjustment, advanced fulfillment, returns/refunds, deep analytics, CMS/page builder, marketplace connectors, and live Inventory/Accounting/CRM/provider adapters are separate follow-on slices. They must extend this core rather than bypass it.

---

### Task 1: Commerce Permissions and Domain Foundation

**Files:**
- Modify: `packages/core/src/permissions.ts`
- Create: `packages/commerce/package.json`
- Create: `packages/commerce/src/types.ts`
- Create: `packages/commerce/src/state.ts`
- Create: `packages/commerce/src/index.ts`
- Modify: `tests/unit/core-permissions.test.ts`
- Create: `tests/unit/commerce-domain.test.ts`

**Interfaces:**
- `CommercePermission`
- `Money`, `CommerceProduct`, `CommerceVariant`, `CommerceCart`, `CommerceCheckout`, `CommerceOrder`
- `transitionCart`, `transitionCheckout`, `transitionOrder`

- [ ] **Step 1: Write failing permission/state tests**

```ts
import { describe, expect, it } from 'vitest';
import { hasPermission } from '../../packages/core/src';
import { transitionOrder } from '../../packages/commerce/src';

describe('Commerce authorization and state', () => {
  it('keeps Commerce admin inside the Commerce namespace', () => {
    expect(hasPermission(['commerce.admin'], 'commerce.orders.manage')).toBe(true);
    expect(hasPermission(['commerce.admin'], 'accounting.post')).toBe(false);
  });

  it('allows only declared order transitions', () => {
    expect(transitionOrder('pending', 'confirmed')).toBe('confirmed');
    expect(() => transitionOrder('fulfilled', 'pending')).toThrow('invalid_order_transition');
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run tests/unit/core-permissions.test.ts tests/unit/commerce-domain.test.ts`

Expected: FAIL because Commerce permissions/package/state helpers do not exist.

- [ ] **Step 3: Add Commerce permissions to the shared namespace-safe permission model**

Add to `packages/core/src/permissions.ts`:

```ts
export type CommercePermission =
  | 'commerce.read'
  | 'commerce.catalog.read'
  | 'commerce.catalog.manage'
  | 'commerce.orders.read'
  | 'commerce.orders.manage'
  | 'commerce.promotions.manage'
  | 'commerce.storefront.manage'
  | 'commerce.fulfillment.manage'
  | 'commerce.returns.manage'
  | 'commerce.refund'
  | 'commerce.analytics.read'
  | 'commerce.admin';
```

Include `CommercePermission` in `AtlasPermission`. Preserve `hasAtlasPermission` namespace behavior.

- [ ] **Step 4: Create the Commerce package and state contracts**

`packages/commerce/package.json`:

```json
{
  "name": "@atlas/commerce",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": "./src/index.ts"
}
```

In `types.ts`, define `Money` with `amountMinor: bigint`, ISO currency, scoped product/variant/cart/checkout/order contracts, and separate order/payment/fulfillment/integration states. `state.ts` must implement explicit transition maps; no catch-all transition.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/core-permissions.test.ts tests/unit/commerce-domain.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/permissions.ts packages/commerce tests/unit/core-permissions.test.ts tests/unit/commerce-domain.test.ts
git commit -m "feat: add ATLAS Commerce domain foundation"
```

---

### Task 2: Deterministic Pricing and Cart Engine

**Files:**
- Create: `packages/commerce/src/pricing.ts`
- Create: `packages/commerce/src/cart.ts`
- Modify: `packages/commerce/src/index.ts`
- Create: `tests/unit/commerce-pricing.test.ts`

**Interfaces:**
- `priceCart(input): PricedCart`
- `addCartLine`, `setCartLineQuantity`, `removeCartLine`
- `PricingAdjustment`

- [ ] **Step 1: Write failing pricing tests**

```ts
import { describe, expect, it } from 'vitest';
import { priceCart } from '../../packages/commerce/src';

describe('Commerce pricing', () => {
  it('prices in integer minor units', () => {
    const result = priceCart({
      currency: 'USD',
      lines: [{ variantId: 'v1', quantity: 2, unitPriceMinor: 1250n }],
      adjustments: [{ code: 'WELCOME', amountMinor: -500n }],
      shippingMinor: 300n,
      taxMinor: 161n
    });
    expect(result.subtotalMinor).toBe(2500n);
    expect(result.totalMinor).toBe(2461n);
  });

  it('rejects mixed currency pricing', () => {
    expect(() => priceCart({ currency: 'USD', lines: [], adjustments: [], shippingMinor: 0n, taxMinor: 0n, sourceCurrency: 'EUR' })).toThrow('currency_mismatch');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/unit/commerce-pricing.test.ts`

Expected: FAIL because pricing/cart helpers do not exist.

- [ ] **Step 3: Implement minimal deterministic pricing**

Pricing order for this slice is variant base price -> explicit validated adjustment -> shipping -> tax. `priceCart` validates positive quantities, non-negative base prices, one currency, and prevents a negative final total. Every adjustment carries a stable code/source reference.

- [ ] **Step 4: Implement immutable cart helpers**

Cart mutation helpers return new cart values, preserve scope/storefront identity, and never accept a final total supplied by a browser.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/unit/commerce-pricing.test.ts`

```bash
git add packages/commerce/src tests/unit/commerce-pricing.test.ts
git commit -m "feat: add deterministic Commerce pricing"
```

---

### Task 3: Commerce Core Schema, RLS, Asset References, and Durable Delivery Tables

**Files:**
- Create: `supabase/migrations/20260917130000_atlas_commerce_core.sql`
- Create: `tests/integration/commerce-schema.test.ts`

**Produces:**
- Catalog: `commerce_products`, `commerce_product_variants`, `commerce_product_media`
- Storefront: `commerce_storefronts`
- Cart/checkout: `commerce_carts`, `commerce_cart_lines`, `commerce_checkout_sessions`
- Orders: `commerce_orders`, `commerce_order_lines`, `commerce_order_adjustments`, `commerce_order_payments`, `commerce_order_status_history`
- Reliability: `commerce_idempotency_keys`, `commerce_outbox_events`, `commerce_integration_deliveries`, `commerce_integration_exceptions`

- [ ] **Step 1: Write failing migration-contract tests**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260917130000_atlas_commerce_core.sql', 'utf8');

describe('Commerce persistence contract', () => {
  it('creates scoped tables and enables RLS', () => {
    for (const table of ['commerce_products','commerce_carts','commerce_orders','commerce_outbox_events','commerce_integration_deliveries']) {
      expect(sql).toContain(`public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });
  it('stores existing media references rather than binary blobs', () => {
    expect(sql).toContain('asset_source');
    expect(sql).toContain('asset_id');
    expect(sql).not.toContain('bytea');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/integration/commerce-schema.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement tables, constraints, indexes, and RLS**

Every organization-owned table carries `org_id uuid not null references public.organizations(id)` and `tenant_id text not null`. RLS read policies require an active `organization_members` row for `auth.uid()`. Browser roles do not receive direct mutation grants for order/payment/outbox/delivery/exception/idempotency tables; server boundaries own those transitions.

`commerce_product_media` stores only references such as:

```sql
asset_source text not null check (asset_source in ('library_blueprint','library_image','library_video','library_audio','creator_asset')),
asset_id text not null,
media_type text not null check (media_type in ('image','video','audio','blueprint'))
```

This enforces the first-slice asset policy: existing ATLAS assets are referenced; Commerce does not generate or duplicate binaries.

- [ ] **Step 4: Add uniqueness/idempotency constraints**

At minimum: variant SKU unique within `(tenant_id, org_id, storefront/channel scope)` where applicable; one idempotency result per `(tenant_id, org_id, channel, idempotency_key)`; one downstream delivery per `(event_id, target_module)`.

- [ ] **Step 5: Run contract tests and commit**

Run: `npx vitest run tests/integration/commerce-schema.test.ts`

```bash
git add supabase/migrations/20260917130000_atlas_commerce_core.sql tests/integration/commerce-schema.test.ts
git commit -m "feat: add Commerce core persistence and RLS"
```

---

### Task 4: Payment Boundary and Fail-Closed Checkout Service

**Files:**
- Create: `packages/commerce/src/payment.ts`
- Create: `packages/commerce/src/checkout.ts`
- Modify: `packages/commerce/src/index.ts`
- Create: `tests/unit/commerce-checkout.test.ts`

**Interfaces:**
- `PaymentAdapter.authorize(input)`
- `UnavailablePaymentAdapter`
- `prepareCheckout`
- `evaluatePaymentResult`

- [ ] **Step 1: Write failing checkout tests**

```ts
import { describe, expect, it } from 'vitest';
import { UnavailablePaymentAdapter, prepareCheckout } from '../../packages/commerce/src';

describe('Commerce checkout provider truth', () => {
  it('fails closed when payment is required and no live adapter exists', async () => {
    const adapter = new UnavailablePaymentAdapter();
    await expect(adapter.authorize({ amountMinor: 1000n, currency: 'USD', paymentMethodReference: 'pm-ref' }))
      .rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
  });

  it('recomputes server totals instead of accepting a client total', () => {
    const checkout = prepareCheckout({ currency: 'USD', lines: [{ variantId: 'v1', quantity: 1, unitPriceMinor: 1000n }], adjustments: [], shippingMinor: 0n, taxMinor: 65n });
    expect(checkout.totalMinor).toBe(1065n);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/unit/commerce-checkout.test.ts`

- [ ] **Step 3: Implement provider-neutral payment types**

A successful normalized result contains only safe provider metadata: state, provider name, provider transaction/reference ID, amount, currency, timestamp. Raw PAN, CVV, reusable token secrets, or credentials are forbidden.

- [ ] **Step 4: Implement fail-closed semantics**

No configured adapter -> `PAYMENT_PROVIDER_UNAVAILABLE`. Ambiguous result -> `PAYMENT_RESULT_AMBIGUOUS` and reconciliation/block state. Declined payment creates no completed order. Tests may use an explicitly named test double; runtime default must never simulate authorization.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/unit/commerce-checkout.test.ts`

```bash
git add packages/commerce/src tests/unit/commerce-checkout.test.ts
git commit -m "feat: add fail-closed Commerce checkout boundary"
```

---

### Task 5: Atomic Order Commit, Idempotency, Audit History, and Outbox Event

**Files:**
- Create: `supabase/migrations/20260917133000_atlas_commerce_order_commit.sql`
- Create: `packages/commerce/src/order.ts`
- Modify: `packages/commerce/src/index.ts`
- Create: `tests/unit/commerce-order.test.ts`
- Create: `tests/integration/commerce-order-commit.test.ts`

**Produces:** `public.commerce_commit_order(...)` and event `commerce.order.completed.v1`.

- [ ] **Step 1: Write failing idempotency/order tests**

Test `canonicalCheckoutFingerprint` to produce the same digest input for semantically identical ordered payloads and a different value when amount/SKU/quantity/customer/channel changes. Test order completion requires an acceptable payment result when total > 0.

- [ ] **Step 2: Write failing SQL transaction-contract assertions**

The integration test must assert the SQL function writes all of these inside the function body before returning: `commerce_orders`, `commerce_order_lines`, `commerce_order_payments`, `commerce_order_status_history`, `commerce_idempotency_keys`, `commerce_outbox_events` with `commerce.order.completed.v1`.

- [ ] **Step 3: Implement the SQL commit function**

The function is `security definer`, fixes `search_path`, is executable only by `service_role`, locks/checks the idempotency key, rejects a reused key with a different request fingerprint, persists order facts plus safe payment reference, records history, creates the outbox event, and returns the existing result for an equivalent retry.

- [ ] **Step 4: Preserve money as integer minor units in persistence**

Use `bigint` columns for monetary minor units and a constrained ISO currency text field. Do not use `real`/`double precision` for authoritative amounts.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/unit/commerce-order.test.ts tests/integration/commerce-order-commit.test.ts`

```bash
git add packages/commerce/src/order.ts packages/commerce/src/index.ts supabase/migrations/20260917133000_atlas_commerce_order_commit.sql tests/unit/commerce-order.test.ts tests/integration/commerce-order-commit.test.ts
git commit -m "feat: add atomic Commerce order commit"
```

---

### Task 6: Authenticated/Public Commerce Edge API

**Files:**
- Create: `supabase/functions/atlas-commerce/index.ts`
- Create: `supabase/functions/atlas-commerce/operations.ts`
- Create: `tests/unit/atlas-commerce-api.test.ts`

**Operations:**
- Workspace: `catalog.list`, `catalog.upsert`, `orders.list`, `orders.get`, `checkout.prepare`, `checkout.submit`
- Public read: `storefront.catalog`, `storefront.product`

- [ ] **Step 1: Write failing source/behavior contract tests**

Assert the function resolves the authenticated user with `auth.getUser`, resolves active organization membership server-side, validates Commerce permissions, never trusts body `tenant_id`, and exposes public operations through a separate read-only code path.

- [ ] **Step 2: Implement context and permission resolution following `atlas-execution` patterns**

Authenticated mutation flow:

`Bearer token -> auth.getUser -> organization_members(active) -> server-derived org/tenant -> Commerce permission -> operation`.

Public storefront flow takes a storefront slug/public identifier only, resolves a published storefront server-side, and selects published catalog records. It never shares the workspace mutation context.

- [ ] **Step 3: Implement checkout submission**

`checkout.submit` recomputes pricing, invokes the configured payment adapter boundary, and calls `commerce_commit_order`. The default runtime adapter is unavailable, so checkout returns a stable provider blocker until a real authorized payment adapter is configured. Free orders may complete only when the authoritative total is exactly zero and policy explicitly allows it.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/unit/atlas-commerce-api.test.ts`

```bash
git add supabase/functions/atlas-commerce tests/unit/atlas-commerce-api.test.ts
git commit -m "feat: add governed Commerce API"
```

---

### Task 7: Durable Downstream Delivery and Truthful Unavailable Adapters

**Files:**
- Create: `packages/commerce/src/integrations.ts`
- Modify: `packages/commerce/src/index.ts`
- Create: `supabase/functions/atlas-commerce-dispatch/index.ts`
- Create: `tests/unit/commerce-integrations.test.ts`

**Targets:** `inventory`, `accounting`, `crm`, `analytics`.

- [ ] **Step 1: Write failing integration-delivery tests**

```ts
import { describe, expect, it } from 'vitest';
import { unavailableCommerceIntegration } from '../../packages/commerce/src';

describe('Commerce downstream truth', () => {
  it('does not fabricate missing Inventory or Accounting adapters', async () => {
    await expect(unavailableCommerceIntegration('inventory').deliver({ eventId: 'e1' } as any))
      .rejects.toMatchObject({ code: 'INVENTORY_ADAPTER_UNAVAILABLE' });
    await expect(unavailableCommerceIntegration('accounting').deliver({ eventId: 'e1' } as any))
      .rejects.toMatchObject({ code: 'ACCOUNTING_ADAPTER_UNAVAILABLE' });
  });
});
```

- [ ] **Step 2: Implement shared Commerce delivery contract**

Define target, delivery state (`pending | dispatched | fulfilled | retrying | failed | dead_lettered | resolved`), stable error code, retryability, correlation/event IDs, and adapter interface.

- [ ] **Step 3: Implement dispatcher persistence semantics**

The dispatcher claims pending outbox events/deliveries using database-safe leasing/update semantics. For targets without a current canonical adapter, persist failed/blocked delivery plus `commerce_integration_exceptions`; do not mutate the completed order back to failed. Duplicate dispatch of one `(event_id,target_module)` cannot create a duplicate delivery.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/unit/commerce-integrations.test.ts`

```bash
git add packages/commerce/src supabase/functions/atlas-commerce-dispatch tests/unit/commerce-integrations.test.ts
git commit -m "feat: add durable Commerce integration delivery"
```

---

### Task 8: Protected Commerce Administration and Canonical Module Registration

**Files:**
- Create: `apps/web/src/modules/commerce/CommerceRoutes.tsx`
- Create: `apps/web/src/modules/commerce/CommerceHomePage.tsx`
- Create: `apps/web/src/modules/commerce/ProductsPage.tsx`
- Create: `apps/web/src/modules/commerce/OrdersPage.tsx`
- Create: `apps/web/src/modules/commerce/OrderDetailPage.tsx`
- Create: `apps/web/src/modules/commerce/commerceApi.ts`
- Create: `apps/web/src/modules/commerce/commerce.css`
- Modify: `apps/web/src/modules/registry.ts`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `tests/unit/module-registry.test.ts`
- Create: `tests/unit/commerce-routes.test.tsx`

- [ ] **Step 1: Write failing registry/routing tests**

Require a module definition:

```ts
{
  id: 'commerce',
  title: 'ATLAS Commerce',
  navLabel: 'Commerce',
  area: 'Business',
  route: '/commerce',
  readiness: 'partial',
  requiresAuth: true,
  showInNavigation: true
}
```

Testing Library must resolve `/commerce`, `/commerce/products`, `/commerce/orders`, `/commerce/orders/:id`; the resolver must mount the route family behind `RequireAtlasIdentity`.

- [ ] **Step 2: Implement browser API wrapper**

Follow the existing `crmApi` pattern: obtain the active organization for workspace calls, use `authorizedAtlasFetch('/functions/v1/atlas-commerce', ...)`, parse stable error codes, and never store credentials or sensitive provider state in browser storage.

- [ ] **Step 3: Implement truthful pages**

Dashboard shows only values returned by the API; if data is absent, render explicit empty/unavailable states. Products support real search/filter over returned records. Orders show business order state separately from payment and downstream integration state. No fake charts, placeholder metrics, `href="#"`, or dead buttons.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/unit/module-registry.test.ts tests/unit/commerce-routes.test.tsx`

```bash
git add apps/web/src/modules/commerce apps/web/src/modules/registry.ts apps/web/src/extensions/resolveAtlasExtension.tsx tests/unit/module-registry.test.ts tests/unit/commerce-routes.test.tsx
git commit -m "feat: add ATLAS Commerce administration"
```

---

### Task 9: Minimal Public Storefront, Product View, and Cart

**Files:**
- Create: `apps/web/src/modules/commerce/storefront/PublicStorefrontPage.tsx`
- Create: `apps/web/src/modules/commerce/storefront/PublicProductPage.tsx`
- Create: `apps/web/src/modules/commerce/storefront/PublicCartPage.tsx`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Create: `tests/unit/commerce-storefront.test.tsx`

**Routes:**
- `/shop/:storefrontSlug`
- `/shop/:storefrontSlug/products/:productSlug`
- `/shop/:storefrontSlug/cart`

- [ ] **Step 1: Write failing public-route tests**

Assert public `/shop/...` routes do not use `RequireAtlasIdentity`, render only API-provided published products, and preserve explicit loading/empty/error states.

- [ ] **Step 2: Implement public catalog/product/cart views**

Use the public read operations from `atlas-commerce`. Product media renders only returned approved asset references/URLs. The cart uses Commerce cart/pricing semantics; UI totals are display values, never final payment authority.

- [ ] **Step 3: Add checkout blocker UI**

When runtime payment capability is unavailable, the cart/checkout UI must state that checkout cannot complete and must not create a fake order, fake payment reference, or success screen.

- [ ] **Step 4: Verify responsive/accessibility states and commit**

Run: `npx vitest run tests/unit/commerce-storefront.test.tsx`

```bash
git add apps/web/src/modules/commerce/storefront apps/web/src/extensions/resolveAtlasExtension.tsx tests/unit/commerce-storefront.test.tsx
git commit -m "feat: add minimal ATLAS Commerce storefront"
```

---

### Task 10: Production Verification, ATLAS Network Preservation, and Release Gate

**Files:**
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `tests/integration/cloudflare-authorized-production-verifier.test.ts`
- Create: `tests/integration/commerce-release-gate.test.ts`

- [ ] **Step 1: Extend failing verifier tests before workflow changes**

Add assertions that the deployment workflow and authorized verifier retain all existing critical Network routes:

```text
/business/network
/business/network/pricing
/business/network/commissions
/business/network/payouts
/business/network/compliance
```

and add Commerce shell checks for `/commerce` plus public storefront shell route `/shop/atlas` only if the implementation provides a deterministic published smoke storefront. If no production smoke storefront record exists, verify `/commerce` at deployment time and keep storefront data readiness as a separate runtime assertion; never fabricate a slug merely to make the test green.

- [ ] **Step 2: Preserve deployment-method independence**

The production-domain verification step remains after both deployment modes. It must not be conditional on `direct-wrangler` vs `cloudflare-native-github-app` for the final public-domain check.

- [ ] **Step 3: Keep fail-closed semantics**

A failed root, Identity shell, `/finance`, `/commerce`, any critical ATLAS Network route, protected deployment-path invariant, or authorized-runtime fallback causes the workflow to exit non-zero. Do not downgrade these to warnings.

- [ ] **Step 4: Run focused verifier tests**

Run: `npx vitest run tests/integration/cloudflare-authorized-production-verifier.test.ts tests/integration/commerce-release-gate.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full verification**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run verify:all
```

Expected: all commands exit 0. Any failure blocks merge/deployment.

- [ ] **Step 6: Commit release-gate changes**

```bash
git add supabase/functions/atlas-cloudflare-production-http-verify/index.ts .github/workflows/cloudflare-deploy.yml tests/integration/cloudflare-authorized-production-verifier.test.ts tests/integration/commerce-release-gate.test.ts
git commit -m "ci: verify Commerce and ATLAS Network fail closed"
```

- [ ] **Step 7: Integration and production evidence**

Open/review the PR from `feat/atlas-commerce` to `main`. Merge only after required checks pass. The authorized `main` deployment must then pass the existing Cloudflare deployment workflow and fresh production probes. Record the deployed commit SHA and verifier result; do not call Commerce production-verified without that evidence.

---

## Acceptance Criteria for This Plan

This slice is complete only when all are true:

1. `@atlas/commerce` exists and uses core tenant/permission primitives.
2. Commerce admin permissions cannot grant another namespace.
3. Catalog/cart/order money uses integer minor units.
4. Server checkout recomputes totals.
5. Missing payment configuration fails closed.
6. Equivalent checkout retries return one committed order; conflicting reuse is rejected.
7. Order, order lines, payment reference/history, idempotency record, and `commerce.order.completed.v1` are committed together through the server-controlled transaction boundary.
8. Downstream Inventory/Accounting/CRM/Analytics delivery state is durable and exactly-once per event/target.
9. Missing downstream adapters are displayed/persisted as unavailable/failed, never fulfilled.
10. Product media references existing ATLAS Library/Creator assets; Commerce stores no binary duplicate.
11. `/commerce` is registered canonically, requires Identity, and has functioning Products/Orders views with truthful loading/empty/error states.
12. `/shop/:storefrontSlug` is public and cannot access workspace mutation permissions.
13. No `href="#"`, fabricated provider success, fake stock, fake accounting posting, fake CRM activity, or fake production evidence exists.
14. Full repository verification passes.
15. Production verification remains independent of deployment method and fail-closed for `www.atlasenterprisesuite.com`, critical ATLAS Network routes, and the Commerce shell.

## Explicit Follow-On Plans

After this core slice is stable, create separate specifications/plans for: (1) real Inventory reservation/decrement adapter after the canonical Inventory domain lands; (2) Accounting sale/refund posting against an Accounting-owned revenue contract; (3) CRM customer/activity adapter without synthetic customers; (4) ATLAS Pay or another authorized payment-provider adapter; (5) collections/promotions/coupons; (6) fulfillment/shipping/pickup/local delivery; (7) returns/refunds; (8) storefront CMS/navigation/SEO; and (9) Commerce analytics. These follow-on slices must consume the core contracts created here and may not replace them with parallel sources of truth.
