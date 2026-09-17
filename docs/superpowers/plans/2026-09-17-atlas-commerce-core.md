# ATLAS Commerce Core Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first working ATLAS Commerce vertical slice: tenant-scoped catalog, cart, deterministic pricing, fail-closed checkout, durable order commit/outbox, truthful integration-delivery state, protected Commerce administration, minimal public storefront, and fail-closed production verification.

**Architecture:** Add a focused `@atlas/commerce` domain package and Commerce Supabase persistence/API while reusing `@atlas/core`, ATLAS Identity/session patterns, existing execution/audit conventions, Creator/Library asset references, the canonical module registry, and the current Cloudflare verifier. Canonical `packages/pos`, `packages/inventory`, and `packages/crm` business-domain packages and an Accounting revenue-posting contract are not present on this branch, so missing downstream adapters must remain durably blocked/unavailable instead of reporting fabricated success.

**Tech Stack:** TypeScript 5.7, React 18, React Router, Vite 6, Vitest 3, Testing Library, Supabase Postgres/RLS, Supabase Edge Functions/Deno, Cloudflare Workers deployment verification.

**Spec:** `docs/superpowers/specs/2026-09-16-atlas-commerce-design.md`

## Global Constraints

- Repository: `atlasenterprisesuite/atlasenterprisesuite`; branch: `feat/atlas-commerce`; integration target: `main` only after all gates pass.
- Reuse existing tenant, organization, auth, audit, execution, session, module-registry, deployment, and production-verification boundaries.
- Current database tenancy convention for new dual-scope records is `tenant_id uuid` + `org_id uuid`, both referencing `public.organizations(id)`, with `tenant_id = org_id` until a distinct tenant entity is canonical. Do not invent a text tenant identifier in persistence.
- No second customer master, stock ledger, accounting ledger, workflow engine, or payment truth source.
- Money is integer minor units plus ISO currency. Binary floating point is never authoritative.
- Workspace mutations require authenticated identity, active organization membership, same-scope checks, and explicit Commerce permission.
- `commerce.admin` grants only the Commerce namespace; it never implies Accounting, CRM, Inventory, payments, or generic Execution authority.
- Public storefront reads are limited to a published storefront and published catalog data; public clients never inherit workspace permissions.
- Browser totals, tenant/org IDs, provider states, stock states, and final order states are untrusted inputs.
- Missing payment/tax/shipping/Inventory/Accounting/CRM/analytics adapters fail closed with durable reason codes.
- Commerce stores ATLAS Library/Creator asset references first and never duplicates media binaries or auto-generates replacements in this slice.
- Checkout and provider retries are idempotent. Reusing one idempotency key with materially different input returns `IDEMPOTENCY_CONFLICT`.
- A completed order remains completed when a downstream delivery fails; delivery/exception state represents the failure separately.
- A branch build is not production evidence. Production is verified only after authorized deployment of `main`.
- Final deployment verification is fail-closed for `www.atlasenterprisesuite.com`, the existing ATLAS Network critical routes, and the Commerce shell.
- Required final gates: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run verify:all`.

## Slice Boundary

This plan implements:

`Published Product -> Cart -> Server Pricing -> Checkout -> Payment Gate -> Atomic Order -> commerce.order.completed.v1 -> Durable Deliveries -> Admin Order View`

Advanced promotions, fulfillment, returns/refunds, deep analytics, CMS/page builder, marketplace connectors, and real payment/Inventory/Accounting/CRM adapters are separate follow-on slices that must consume this core.

---

### Task 1: Commerce Permissions and Domain Foundation

**Files:** Modify `packages/core/src/permissions.ts`; create `packages/commerce/package.json`, `packages/commerce/src/types.ts`, `packages/commerce/src/state.ts`, `packages/commerce/src/index.ts`; modify `tests/unit/core-permissions.test.ts`; create `tests/unit/commerce-domain.test.ts`.

- [ ] Write failing tests proving `commerce.admin -> commerce.orders.manage` and `commerce.admin !-> accounting.post`, plus valid/invalid order transitions.

```ts
expect(hasPermission(['commerce.admin'], 'commerce.orders.manage')).toBe(true);
expect(hasPermission(['commerce.admin'], 'accounting.post')).toBe(false);
expect(transitionOrder('pending', 'confirmed')).toBe('confirmed');
expect(() => transitionOrder('fulfilled', 'pending')).toThrow('invalid_order_transition');
```

- [ ] Run `npx vitest run tests/unit/core-permissions.test.ts tests/unit/commerce-domain.test.ts`; expect FAIL.
- [ ] Add `CommercePermission` to `AtlasPermission` with: `commerce.read`, `commerce.catalog.read`, `commerce.catalog.manage`, `commerce.orders.read`, `commerce.orders.manage`, `commerce.promotions.manage`, `commerce.storefront.manage`, `commerce.fulfillment.manage`, `commerce.returns.manage`, `commerce.refund`, `commerce.analytics.read`, `commerce.admin`.
- [ ] Create `@atlas/commerce` with `exports: "./src/index.ts"`; define `Money`, product/variant/cart/checkout/order contracts and separate order/payment/fulfillment/integration states.
- [ ] Implement explicit `transitionCart`, `transitionCheckout`, `transitionOrder` maps; reject undeclared transitions.
- [ ] Re-run focused tests; expect PASS.
- [ ] Commit: `feat: add ATLAS Commerce domain foundation`.

---

### Task 2: Deterministic Pricing and Cart Engine

**Files:** Create `packages/commerce/src/pricing.ts`, `packages/commerce/src/cart.ts`, `tests/unit/commerce-pricing.test.ts`; modify `packages/commerce/src/index.ts`.

- [ ] Write a failing test using two units at `1250n`, `-500n` adjustment, `300n` shipping, `161n` tax; expect subtotal `2500n` and total `2461n`. Add mixed-currency and negative-total rejection tests.
- [ ] Run `npx vitest run tests/unit/commerce-pricing.test.ts`; expect FAIL.
- [ ] Implement `priceCart` in deterministic order: base variant price -> validated adjustments -> shipping -> tax. Validate positive quantities, non-negative base prices, same currency, and final total `>= 0n`.
- [ ] Implement immutable `addCartLine`, `setCartLineQuantity`, `removeCartLine`; never accept a browser-provided authoritative final total.
- [ ] Re-run focused tests; expect PASS.
- [ ] Commit: `feat: add deterministic Commerce pricing`.

---

### Task 3: Commerce Schema, RLS, Asset References, Outbox, and Delivery State

**Files:** Create `supabase/migrations/20260917130000_atlas_commerce_core.sql`, `tests/integration/commerce-schema.test.ts`.

**Tables:** `commerce_products`, `commerce_product_variants`, `commerce_product_media`, `commerce_storefronts`, `commerce_carts`, `commerce_cart_lines`, `commerce_checkout_sessions`, `commerce_orders`, `commerce_order_lines`, `commerce_order_adjustments`, `commerce_order_payments`, `commerce_order_status_history`, `commerce_idempotency_keys`, `commerce_outbox_events`, `commerce_integration_deliveries`, `commerce_integration_exceptions`.

- [ ] Write a failing migration-contract test that checks all tables, RLS, `tenant_id`, `org_id`, active `organization_members` policies, asset references, and absence of `bytea` media storage.
- [ ] Run `npx vitest run tests/integration/commerce-schema.test.ts`; expect FAIL.
- [ ] Implement `tenant_id uuid not null references public.organizations(id)` and `org_id uuid not null references public.organizations(id)` on organization-owned records, with `check (tenant_id = org_id)` under the current tenancy contract.
- [ ] Use RLS membership predicates against `organization_members.org_id`; do not grant browser mutation rights to payment/order-commit/outbox/delivery/exception/idempotency tables.
- [ ] `commerce_product_media` stores `asset_source`, `asset_id`, `media_type`; allowed sources: `library_blueprint`, `library_image`, `library_video`, `library_audio`, `creator_asset`. No media blob column.
- [ ] Add one idempotency row per `(tenant_id, org_id, channel, idempotency_key)` and one delivery per `(event_id, target_module)`.
- [ ] Re-run focused test; expect PASS.
- [ ] Commit: `feat: add Commerce core persistence and RLS`.

---

### Task 4: Payment Boundary and Fail-Closed Checkout

**Files:** Create `packages/commerce/src/payment.ts`, `packages/commerce/src/checkout.ts`, `tests/unit/commerce-checkout.test.ts`; modify `packages/commerce/src/index.ts`.

- [ ] Write failing tests proving `UnavailablePaymentAdapter.authorize(...)` rejects with `PAYMENT_PROVIDER_UNAVAILABLE`, ambiguous results map to `PAYMENT_RESULT_AMBIGUOUS`, and `prepareCheckout` recomputes totals server-side.
- [ ] Run `npx vitest run tests/unit/commerce-checkout.test.ts`; expect FAIL.
- [ ] Implement provider-neutral `PaymentAdapter`; normalized success contains only provider, safe provider reference, state, amount minor, currency, timestamp.
- [ ] Runtime default is unavailable. Tests may inject an explicitly named test adapter; production code never simulates authorization.
- [ ] Decline creates no completed order. Ambiguous provider outcome blocks/reconciles and never blindly retries a charge.
- [ ] Re-run focused tests; expect PASS.
- [ ] Commit: `feat: add fail-closed Commerce checkout boundary`.

---

### Task 5: Atomic Order Commit, Idempotency, History, and `commerce.order.completed.v1`

**Files:** Create `supabase/migrations/20260917133000_atlas_commerce_order_commit.sql`, `packages/commerce/src/order.ts`, `tests/unit/commerce-order.test.ts`, `tests/integration/commerce-order-commit.test.ts`; modify `packages/commerce/src/index.ts`.

- [ ] Write failing tests for `canonicalCheckoutFingerprint`: equivalent normalized commands produce the same fingerprint; SKU/quantity/amount/customer/channel changes produce a different fingerprint.
- [ ] Write SQL-contract assertions requiring `commerce_orders`, lines, payment result/reference, status history, idempotency row, and `commerce_outbox_events` in `commerce_commit_order` before return.
- [ ] Run the two focused tests; expect FAIL.
- [ ] Implement `public.commerce_commit_order(...)` as `security definer`, fixed `search_path`, executable only by `service_role`.
- [ ] Lock/check the idempotency key. Equivalent retry returns the existing order. Different fingerprint raises `IDEMPOTENCY_CONFLICT`.
- [ ] Persist monetary columns as `bigint` minor units and create outbox event type exactly `commerce.order.completed.v1` in the same transaction.
- [ ] Re-run focused tests; expect PASS.
- [ ] Commit: `feat: add atomic Commerce order commit`.

---

### Task 6: Authenticated and Public Commerce Edge API

**Files:** Create `supabase/functions/atlas-commerce/index.ts`, `supabase/functions/atlas-commerce/operations.ts`, `tests/unit/atlas-commerce-api.test.ts`.

**Workspace operations:** `catalog.list`, `catalog.upsert`, `orders.list`, `orders.get`, `checkout.prepare`, `checkout.submit`.
**Public reads:** `storefront.catalog`, `storefront.product`.

- [ ] Write failing source/behavior tests requiring `auth.getUser`, active `organization_members`, server-derived scope, Commerce permission checks, and a separate public read-only path.
- [ ] Run `npx vitest run tests/unit/atlas-commerce-api.test.ts`; expect FAIL.
- [ ] Follow `atlas-execution` context style: Bearer token -> user -> active membership -> `orgId`; derive `tenantId = orgId` under the current tenancy contract. Ignore caller-supplied trusted tenant scope.
- [ ] Public operations resolve a published storefront by safe public identifier and return published products only; they never reuse workspace mutation permissions.
- [ ] `checkout.submit` recomputes pricing, invokes the payment boundary, then calls `commerce_commit_order`. Runtime payment unavailable -> blocker, not success. Zero-total order may complete only when policy explicitly allows it.
- [ ] Re-run focused test; expect PASS.
- [ ] Commit: `feat: add governed Commerce API`.

---

### Task 7: Durable Downstream Delivery with Truthful Unavailable Adapters

**Files:** Create `packages/commerce/src/integrations.ts`, `supabase/functions/atlas-commerce-dispatch/index.ts`, `tests/unit/commerce-integrations.test.ts`; modify `packages/commerce/src/index.ts`.

**Targets:** `inventory`, `accounting`, `crm`, `analytics`.

- [ ] Write failing tests proving default Inventory and Accounting adapters reject with `INVENTORY_ADAPTER_UNAVAILABLE` and `ACCOUNTING_ADAPTER_UNAVAILABLE`; add CRM/analytics equivalents where no canonical writer exists.
- [ ] Run `npx vitest run tests/unit/commerce-integrations.test.ts`; expect FAIL.
- [ ] Define delivery states `pending | dispatched | fulfilled | retrying | failed | dead_lettered | resolved`, event/correlation IDs, stable error code, retryability, and target adapter contract.
- [ ] Dispatcher claims pending work with database-safe leasing/update semantics and respects unique `(event_id,target_module)` delivery identity.
- [ ] Missing adapter persists failed/blocked delivery and a `commerce_integration_exceptions` row. It does not alter a completed order to failed.
- [ ] Re-run focused test; expect PASS.
- [ ] Commit: `feat: add durable Commerce integration delivery`.

---

### Task 8: Protected Commerce Administration and Canonical Registration

**Files:** Create `apps/web/src/modules/commerce/CommerceRoutes.tsx`, `CommerceHomePage.tsx`, `ProductsPage.tsx`, `OrdersPage.tsx`, `OrderDetailPage.tsx`, `commerceApi.ts`, `commerce.css`, `tests/unit/commerce-routes.test.tsx`; modify `apps/web/src/modules/registry.ts`, `apps/web/src/extensions/resolveAtlasExtension.tsx`, `tests/unit/module-registry.test.ts`.

- [ ] Write failing registry/routing tests requiring module `{ id: 'commerce', title: 'ATLAS Commerce', navLabel: 'Commerce', area: 'Business', route: '/commerce', readiness: 'partial', requiresAuth: true, showInNavigation: true }` and protected routes `/commerce`, `/commerce/products`, `/commerce/orders`, `/commerce/orders/:id`.
- [ ] Run `npx vitest run tests/unit/module-registry.test.ts tests/unit/commerce-routes.test.tsx`; expect FAIL.
- [ ] Implement `commerceApi` using `getActiveAtlasOrganization` + `authorizedAtlasFetch('/functions/v1/atlas-commerce', ...)`, with stable error parsing and no provider credentials in browser storage.
- [ ] Implement truthful loading/empty/error/blocked states. Products search returned records. Orders render business state, payment state, and integration delivery state separately. No fake metrics, empty links, or dead buttons.
- [ ] Mount Commerce behind `RequireAtlasIdentity` in the extension resolver and register it once in the canonical module registry.
- [ ] Re-run focused tests; expect PASS.
- [ ] Commit: `feat: add ATLAS Commerce administration`.

---

### Task 9: Minimal Public Storefront, Product, and Cart Routes

**Files:** Create `apps/web/src/modules/commerce/storefront/PublicStorefrontPage.tsx`, `PublicProductPage.tsx`, `PublicCartPage.tsx`, `tests/unit/commerce-storefront.test.tsx`; modify `apps/web/src/extensions/resolveAtlasExtension.tsx`.

**Routes:** `/shop/:storefrontSlug`, `/shop/:storefrontSlug/products/:productSlug`, `/shop/:storefrontSlug/cart`.

- [ ] Write failing tests that public shop routes do not use `RequireAtlasIdentity`, display only API-returned published records, and expose loading/empty/error states.
- [ ] Run `npx vitest run tests/unit/commerce-storefront.test.tsx`; expect FAIL.
- [ ] Implement public views on the public Commerce read operations. Render only approved asset references returned by the API. Cart totals are display values; server checkout remains authoritative.
- [ ] If payment runtime is unavailable, show an explicit checkout blocker and do not create a fake order/payment/success screen.
- [ ] Re-run focused test; expect PASS.
- [ ] Commit: `feat: add minimal ATLAS Commerce storefront`.

---

### Task 10: Production Verification and Fail-Closed Release Gate

**Files:** Modify `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`, `.github/workflows/cloudflare-deploy.yml`, `tests/integration/cloudflare-authorized-production-verifier.test.ts`; create `tests/integration/commerce-release-gate.test.ts`.

- [ ] First extend tests to require preservation of `/business/network`, `/business/network/pricing`, `/business/network/commissions`, `/business/network/payouts`, `/business/network/compliance`, plus Commerce `/commerce`.
- [ ] Run `npx vitest run tests/integration/cloudflare-authorized-production-verifier.test.ts tests/integration/commerce-release-gate.test.ts`; expect FAIL before verifier changes.
- [ ] Add `/commerce` to both direct production probing and the authorized runtime verifier. Add `/shop/<smoke-slug>` only if a deterministic published production smoke storefront actually exists; never invent a slug to satisfy CI.
- [ ] Keep final production-domain verification after both deployment methods. It must not be conditional on direct Wrangler vs Cloudflare GitHub App.
- [ ] Fail non-zero if root, Identity shell, Finance, Commerce, any critical Network route, deployment-path protection, or authorized fallback verification fails. No warning-only downgrade.
- [ ] Re-run focused verifier tests; expect PASS.
- [ ] Run full gates:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run verify:all
```

- [ ] Any failure blocks integration. If all pass, commit `ci: verify Commerce and ATLAS Network fail closed`.
- [ ] Open/review PR `feat/atlas-commerce -> main`. Merge only with required checks passing. After authorized `main` deployment, record fresh deployed SHA + verifier result. Do not call Commerce production-verified before this evidence exists.

---

## Acceptance Criteria

1. `@atlas/commerce` uses canonical scope/permission primitives.
2. Commerce admin cannot grant another namespace.
3. Catalog/cart/order money uses integer minor units.
4. Server checkout recomputes totals.
5. Missing payment configuration fails closed.
6. Equivalent checkout retries yield one order; conflicting reuse is rejected.
7. Order facts, payment reference/history, idempotency and `commerce.order.completed.v1` commit atomically.
8. Downstream delivery is durable and unique per event/target.
9. Missing downstream adapters remain unavailable/failed, never fulfilled.
10. Product media references existing ATLAS Library/Creator assets and stores no duplicate binary.
11. `/commerce` is canonical, identity-protected, and has functioning Products/Orders states.
12. `/shop/:storefrontSlug` is public without workspace mutation authority.
13. No `href="#"`, fake provider success, fake stock, fake accounting posting, fake CRM activity, or fake production evidence.
14. Full repository verification passes.
15. Production verification is deployment-method-independent and fail-closed for the public domain, critical ATLAS Network routes, and Commerce.

## Explicit Follow-On Plans

After this slice is stable, create separate plans for real Inventory reservation/decrement, Accounting sale/refund posting, CRM customer/activity, ATLAS Pay or an authorized payment provider, advanced promotions/collections, fulfillment, returns/refunds, storefront CMS/SEO, and Commerce analytics. Each must consume these core contracts rather than introduce a parallel source of truth.
