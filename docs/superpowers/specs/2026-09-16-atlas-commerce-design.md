# ATLAS Commerce — Canonical E-commerce Design Specification

Date: 2026-09-16
Status: Approved architecture; pending implementation plan
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-commerce`
Primary owner: ATLAS Business Suite -> Commerce

## 1. Purpose

ATLAS Commerce is the canonical e-commerce domain for ATLAS Enterprise Suite. It provides a headless commerce core plus a native ATLAS storefront while reusing the existing shared platform, tenant/RBAC model, Universal Execution Engine, POS transaction architecture, Inventory ownership, Accounting ownership, CRM ownership, and production verification controls.

It must not become a parallel business platform or duplicate existing module sources of truth.

Canonical commercial flow:

`Storefront -> Catalog -> Product/Variant -> Cart -> Pricing/Promotions -> Checkout -> Payment -> Order -> Inventory -> Fulfillment -> Accounting -> CRM -> Analytics -> Audit`

ATLAS Commerce owns Catalog, Merchandising, Cart, Checkout orchestration, Orders, Storefront configuration, Promotions, and Fulfillment orchestration. It consumes shared capabilities from other ATLAS domains rather than shadowing them.

## 2. Architectural Decision

Approved approach: **headless ATLAS Commerce core + native storefront + shared transaction/event infrastructure**.

This approach is selected over:

1. making a third-party commerce platform the system of record; or
2. embedding commerce logic directly inside the generic Business Suite shell.

The chosen architecture keeps ATLAS as the canonical business system, supports web/mobile/POS/hospitality/restaurant channels, and preserves one shared source of truth for inventory, customers, accounting, payments, execution, and audit.

## 3. Existing Architecture Reused

Commerce must extend, not replace:

- `packages/core` for tenant and organization primitives;
- shared authentication and authorization boundaries;
- `packages/execution` for workflow/approval/evidence/orchestration;
- `packages/events` / transactional outbox contracts where present;
- `packages/pos` and the approved POS sale/payment integration semantics;
- `packages/inventory` for stock balances and movements;
- `packages/accounting` for journals, revenue, receivables, settlement and reconciliation;
- `packages/crm` for customers and customer activity;
- current audit/security/release/observability capabilities;
- existing Supabase organization/RLS patterns;
- the production Cloudflare verification workflow and verifier.

No new workflow engine, generic event bus, customer master, stock ledger, accounting ledger, or payment truth source may be introduced by Commerce.

## 4. Product Surface and Routes

The canonical route root is `/commerce`.

Initial routes:

- `/commerce` — Commerce dashboard
- `/commerce/products` — products and variants
- `/commerce/products/:productId` — product detail/edit
- `/commerce/collections` — collections/categories/merchandising
- `/commerce/inventory` — commerce-oriented stock view backed by Inventory
- `/commerce/orders` — unified order list
- `/commerce/orders/:orderId` — order detail/timeline
- `/commerce/customers` — commerce customer view backed by CRM
- `/commerce/discounts` — promotions/coupons/rules
- `/commerce/storefront` — storefront configuration
- `/commerce/storefront/navigation` — menus/navigation
- `/commerce/storefront/pages` — content pages
- `/commerce/checkout` — checkout configuration/policies
- `/commerce/fulfillment` — fulfillment queues
- `/commerce/returns` — returns/refunds workflow
- `/commerce/analytics` — commerce analytics
- `/commerce/settings` — currencies, tax, locations, policies, providers

Public storefront routes must be separated from the authenticated enterprise workspace. The design must allow one or more tenant-scoped storefront domains or paths without exposing protected workspace routes.

No empty links, placeholder controls, `href="#"`, fabricated provider states, or nonfunctional buttons are permitted in a production-ready route.

## 5. Module Ownership Boundaries

### Commerce owns

- Product catalog metadata
- Product variants/options
- Collections/categories
- Media references for products and storefront content
- Price lists and merchandising rules
- Promotions/coupons
- Carts and cart lines
- Checkout session state
- Commercial orders and order lines
- Order lifecycle
- Storefront/navigation/page configuration
- Fulfillment orchestration state
- Return/refund request orchestration
- Channel attribution

### Inventory owns

- Authoritative stock balance
- Stock reservations
- Inventory movements
- Location-level availability
- Adjustment audit

Commerce may render Inventory data but must not maintain a second authoritative stock count.

### CRM owns

- Customer master
- Customer identity/profile
- Customer activity timeline
- Lead/account/contact relationships

Commerce stores references to CRM customers and commerce-specific order facts only.

### Accounting owns

- Journals
- Revenue recognition/posting
- Accounts receivable
- Tax payable accounting
- Settlement/reconciliation accounting
- Refund accounting

Commerce may display posting state but must not write a shadow ledger.

### Payments / ATLAS Pay boundary

Commerce defines a provider-neutral payment intent/checkout boundary. Live payment truth comes only from an authorized payment provider adapter or ATLAS Pay when production-ready. Commerce never fabricates `authorized`, `captured`, `settled`, or equivalent provider states.

## 6. Core Data Model

All organization-scoped records must carry `tenant_id` and `org_id`, use appropriate indexes, and enforce RLS consistent with current ATLAS membership patterns.

Minimum Commerce-owned persistence:

### Catalog

- `commerce_products`
- `commerce_product_variants`
- `commerce_product_options`
- `commerce_collections`
- `commerce_collection_products`
- `commerce_product_media`
- `commerce_price_lists`
- `commerce_prices`

### Merchandising

- `commerce_promotions`
- `commerce_promotion_rules`
- `commerce_promotion_effects`
- `commerce_coupon_codes`

### Cart / Checkout

- `commerce_carts`
- `commerce_cart_lines`
- `commerce_checkout_sessions`
- `commerce_checkout_addresses`
- `commerce_checkout_adjustments`

### Orders

- `commerce_orders`
- `commerce_order_lines`
- `commerce_order_adjustments`
- `commerce_order_payments`
- `commerce_order_status_history`

### Storefront

- `commerce_storefronts`
- `commerce_storefront_domains`
- `commerce_storefront_navigation`
- `commerce_storefront_pages`
- `commerce_storefront_settings`

### Fulfillment / Returns

- `commerce_fulfillments`
- `commerce_fulfillment_lines`
- `commerce_return_requests`
- `commerce_return_lines`

References to Inventory, CRM, Accounting, providers, shipping integrations, and media assets must use stable IDs/references rather than copying foreign-domain records into Commerce.

## 7. Money and Pricing

All authoritative monetary values use integer minor units plus ISO currency code.

Example:

```ts
export type Money = {
  amountMinor: bigint;
  currency: string;
};
```

Binary floating-point is not authoritative for product price, discounts, tax, shipping, tips, refunds, payment, margins, or accounting amounts.

The server recomputes authoritative checkout totals. Browser-provided totals are never trusted as the sole amount authority.

Pricing resolution order must be deterministic and auditable. A first implementation may use:

1. base variant price;
2. applicable price list;
3. automatic promotion rules;
4. valid coupon effects;
5. shipping charge;
6. tax calculation;
7. final total.

Every adjustment stores a reason/source reference so the order can explain how the final amount was calculated.

## 8. Product and Asset Policy

ATLAS Commerce must search and reuse ATLAS Library assets before generating or purchasing new media.

Required asset resolution order:

1. existing approved ATLAS Library blueprint;
2. existing product image;
3. existing video;
4. existing audio;
5. existing reusable brand component/template;
6. generate or source a new asset only when no suitable approved asset exists.

Commerce stores asset references and metadata; it must not duplicate binary assets unnecessarily.

Generated assets must be clearly attributable to their generation/source workflow and must not be represented as manufacturer-provided originals unless they are.

## 9. Cart and Checkout State

Cart lifecycle:

`active -> converted | abandoned | expired`

Checkout lifecycle:

`draft -> validating -> ready -> awaiting_payment -> payment_processing -> completed | blocked | failed | expired`

Order lifecycle is independent from checkout lifecycle:

`pending -> confirmed -> processing -> partially_fulfilled -> fulfilled -> cancelled`

Payment and fulfillment states remain separate dimensions. One enum must not conflate order, execution, payment, and delivery reality.

## 10. Order Completion and Domain Event

Electronic checkout follows the same durable principles approved for the POS pipeline.

A successful checkout is not reported as completed until the authoritative transaction persists, at minimum:

1. the order;
2. order lines;
3. final pricing/tax/shipping adjustments;
4. normalized payment result/reference when payment is required;
5. execution/correlation state required to resume/reconcile;
6. audit evidence for the sensitive transition;
7. a transactional outbox event.

Initial event:

`commerce.order.completed.v1`

The event envelope includes tenant, organization, order ID, customer reference when present, line/SKU facts, monetary totals, channel, correlation/causation IDs and actor/system identity. It excludes payment secrets and unnecessary personal data.

## 11. Downstream Consumers

### Inventory

Consumes `commerce.order.completed.v1` to reserve/decrement or otherwise apply the correct stock effect exactly once according to the configured inventory policy.

Duplicate event delivery must not double-decrement stock.

### Accounting

Posts one source-linked accounting effect exactly once using Accounting-owned contracts. Locked accounting periods or missing account configuration create durable integration exceptions; they do not silently change a paid order back to failed.

### CRM

Records a source-linked commerce activity when the order has a real customer reference. Anonymous checkout must not create synthetic customer masters unless an explicit customer-creation policy authorizes it.

### Analytics

Consumes immutable commercial facts/events for revenue/channel/product analytics without becoming the source of transactional truth.

## 12. Idempotency and Concurrency

Idempotency is mandatory at:

- cart mutation where retries can duplicate effects;
- checkout submission;
- payment confirmation handling;
- order commit;
- webhook/provider event ingestion;
- every downstream event consumer.

Checkout idempotency key concept:

`tenant + org + storefront/channel + clientCheckoutRequestId`

A repeated equivalent command returns/recognizes the already-created result. Reuse of an idempotency key with materially different input is rejected as a conflict.

Concurrent checkout, reservation, refund, and provider webhook races must be handled with database-safe transaction/locking semantics rather than browser state assumptions.

## 13. Authentication, Authorization and RBAC

Workspace mutations require authenticated identity, tenant/org membership, Commerce permission, owning-domain permission where applicable, policy validation and provider capability before execution.

Initial Commerce permissions:

- `commerce.read`
- `commerce.catalog.read`
- `commerce.catalog.manage`
- `commerce.orders.read`
- `commerce.orders.manage`
- `commerce.promotions.manage`
- `commerce.storefront.manage`
- `commerce.fulfillment.manage`
- `commerce.returns.manage`
- `commerce.refund`
- `commerce.analytics.read`
- `commerce.admin`

Generic `execution.admin` or generic organization administration must not silently imply sensitive Commerce, payment, refund, Inventory, CRM, or Accounting authority.

Public storefront customers use a separate constrained public/customer session model and never receive enterprise workspace permissions.

## 14. Provider Truthfulness and Fail-Closed Behavior

If a live provider is absent, misconfigured, unverified, unauthorized, expired, unavailable, or returns an ambiguous result, Commerce must fail closed for provider-dependent success claims.

Examples:

- no payment adapter -> no fabricated successful payment;
- no shipping-rate provider -> do not fabricate a live carrier quote;
- no tax provider/configured internal tax rules -> do not claim tax is finalized;
- ambiguous payment timeout -> enter reconciliation, never blindly charge again;
- unavailable inventory authority -> block sale if policy requires authoritative availability rather than inventing stock.

Test/demo adapters are permitted only in clearly scoped test/demo contexts and must never be labeled live.

## 15. Storefront Architecture

The storefront is a channel on top of the Commerce core, not the Commerce database itself.

Required characteristics:

- responsive desktop/tablet/mobile UI;
- accessible keyboard and screen-reader navigation;
- server-authoritative cart/checkout totals;
- tenant/org/storefront isolation;
- reusable ATLAS design system primitives;
- SEO metadata and canonical URLs for public catalog pages;
- configurable navigation and pages;
- collection/product/search interfaces;
- cart and checkout;
- order confirmation and customer order history when authenticated;
- graceful loading, empty, validation, error and unavailable-provider states.

Storefront content editing must never expose secrets, internal execution metadata, private tenant data, or enterprise-only routes.

## 16. Search, Filtering and Merchandising

Product search must search actual indexed product/variant data. Filters must operate on canonical attributes such as collection, price, availability, option, tag and channel visibility.

Collection merchandising may support manual ordering plus governed rules. Search/merchandising ranking must not fabricate inventory or price facts.

## 17. Fulfillment

Initial fulfillment modes:

- ship;
- pickup;
- local delivery/manual delivery when configured.

A fulfillment records source order, lines/quantities, location, status, timestamps, assigned carrier/provider reference when real, and tracking reference when real.

Carrier/provider integrations remain adapter-gated. A fulfillment may exist without a live carrier integration, but it must not claim carrier acceptance/tracking without real provider evidence.

## 18. Returns and Refunds

Return/refund operations are governed, idempotent and audited.

Refund requests must validate:

- order ownership/scope;
- refundable amount;
- prior refunds;
- line/quantity constraints;
- provider payment state;
- operator permission;
- approval policy when required.

A provider refund is not marked successful until the provider adapter returns and persists an authoritative reference/status. Inventory and Accounting effects follow through durable events/consumers and remain separately observable.

## 19. Analytics

Initial Commerce metrics may include:

- gross sales;
- net sales;
- order count;
- average order value;
- units sold;
- gross margin where authoritative cost is available;
- refund value;
- top products/variants;
- channel attribution;
- customer repeat purchase rate;
- cart/checkout conversion when session instrumentation is available;
- inventory exception counts;
- payment/fulfillment integration exceptions.

Analytics must distinguish posted/authoritative facts from incomplete or estimated metrics.

## 20. API and Server Boundaries

Production mutations cross authenticated/server-side boundaries. The browser must not directly control trusted tenant identity, privileged status transitions, provider truth, inventory decrement, accounting posting, or final payment amount.

Server actions/functions resolve authenticated tenant/org context and verify referenced records are inside the same scope before domain execution.

Provider webhooks require signature/authenticity validation, idempotency and safe persistence before effects are applied.

## 21. Audit and Evidence

Append-only audit evidence is required for sensitive transitions including:

- product publish/unpublish;
- price change;
- promotion creation/change;
- checkout accepted/rejected;
- payment authorization/capture result reference;
- order completion/cancellation;
- fulfillment change;
- refund request/result;
- downstream integration failure/retry/resolution;
- privileged configuration/provider changes.

Audit payloads exclude raw secrets, PAN/CVV, reusable payment credentials and unnecessary personal data.

## 22. Error and Integration Exception Model

Provider/domain failures must use stable reason codes and durable exception state where human/system reconciliation is required.

Examples:

- `PAYMENT_PROVIDER_UNAVAILABLE`
- `PAYMENT_RESULT_AMBIGUOUS`
- `INVENTORY_UNAVAILABLE`
- `INVENTORY_CONFLICT`
- `ACCOUNTING_PERIOD_LOCKED`
- `ACCOUNTING_CONFIGURATION_MISSING`
- `FULFILLMENT_PROVIDER_UNAVAILABLE`
- `TAX_CONFIGURATION_MISSING`
- `CROSS_TENANT_SCOPE_DENIED`
- `IDEMPOTENCY_CONFLICT`

Dismissing a UI notification must never itself resolve the underlying integration exception.

## 23. Multi-company and Multi-channel Behavior

Every Commerce record is scoped to one tenant and organization. Storefronts/channels may be configured per organization and must not leak catalog, order, customer, stock, pricing or analytics data across organizations.

Cross-company reporting, if later supported, belongs to governed consolidation/reporting capabilities and does not weaken row-level boundaries.

Channels may include:

- native ATLAS storefront;
- ATLAS POS;
- mobile app;
- marketplace connector;
- hospitality/restaurant ordering;
- social commerce connectors.

External connectors are adapters to the canonical ATLAS Commerce model; they do not become silent alternate systems of record.

## 24. Testing Strategy

### Unit

- pricing arithmetic in minor units;
- promotion eligibility/effects;
- cart state transitions;
- order state transitions;
- permission evaluation;
- provider unavailable/ambiguous semantics;
- idempotency conflicts;
- route/model helpers.

### Integration

- tenant/org RLS isolation;
- cart -> checkout -> payment -> order transaction;
- outbox creation in the same commit boundary;
- Inventory consumer exactly once;
- Accounting consumer exactly once;
- CRM activity exactly once;
- locked-accounting-period exception;
- provider webhook signature/idempotency;
- returns/refunds;
- restart/retry durability.

### Web/E2E

- product browse/search/filter;
- cart add/update/remove;
- checkout validation;
- unavailable provider state;
- successful provider-backed checkout in authorized environment;
- admin product/order/fulfillment workflows;
- responsive desktop/tablet/mobile;
- keyboard navigation and accessibility basics;
- no empty links or fake controls;
- protected workspace and public storefront separation.

### Security

- cross-tenant attempts fail closed;
- privilege escalation attempts fail;
- forged provider callbacks fail;
- secrets are absent from logs/audit/client bundles;
- public storefront cannot access enterprise APIs/routes outside its constrained contract.

## 25. Acceptance Criteria

Commerce v1 is implementation-complete only when automated evidence proves at minimum:

1. canonical `/commerce` routes exist and are navigable;
2. product/variant CRUD respects tenant/org/RBAC;
3. existing ATLAS Library assets can be referenced without duplicating binaries;
4. search and filters operate on real catalog data;
5. cart totals use authoritative server calculations in minor units;
6. checkout rejects cross-tenant and unauthorized requests;
7. missing live payment provider cannot produce fake success;
8. duplicate checkout requests do not create duplicate orders/charges;
9. completed checkout commits order + payment reference + audit + outbox durably;
10. Inventory effect occurs exactly once;
11. Accounting effect occurs exactly once or creates a durable exception;
12. CRM customer activity occurs exactly once when a customer exists;
13. Accounting failure after payment does not rewrite the completed order as unpaid/failed;
14. refunds are permissioned, idempotent and provider-truthful;
15. public storefront and protected workspace remain separated;
16. responsive/accessibility checks pass for critical flows;
17. `npm run typecheck`, relevant tests and production build pass;
18. no fabricated provider/inventory/payment/analytics readiness appears in production UI;
19. deployment verification checks the public domain and ATLAS Network critical routes;
20. deployment is not considered verified when any required production verification fails.

## 26. Deployment and Production Verification — Fail Closed

The deployment mechanism may change, but final verification is mandatory and deployment-neutral.

After any production deployment, ATLAS must verify at minimum:

- `https://www.atlasenterprisesuite.com/`
- `/identity?app=%2Ffinance`
- `/finance`
- `/business/network`
- `/business/network/pricing`
- `/business/network/commissions`
- `/business/network/payouts`
- `/business/network/compliance`
- protected behavior of `/deployment.json`
- Commerce workspace route(s) appropriate to the deployed release;
- public Commerce storefront route(s) when enabled for that tenant/release.

The canonical production verifier remains the shared verifier; Commerce must extend its route/check manifest rather than create an unrelated verification service.

**Policy: fail closed.** If the public domain, any required ATLAS Network critical route, required Commerce route, security expectation, release identity expectation, or deployment protection check fails, the workflow is red and the deployment must not be labeled verified.

A warning-only mode may exist only as an explicit non-production/local diagnostic option. It is not the default and cannot satisfy the production verification gate.

## 27. Release Truth and Observability

Commerce release evidence must record:

- target commit/release identity;
- build/test result;
- migration result;
- production verification result;
- failing route/check when blocked;
- correlation/run identifiers;
- deployed environment;
- rollback/recovery decision when applicable.

Operational dashboards must distinguish application success from downstream integration exceptions.

## 28. Non-Goals for First Slice

The first implementation slice does not require:

- replacing Shopify/WooCommerce/etc. for every external merchant on day one;
- marketplace publishing to every marketplace;
- autonomous carrier purchasing;
- autonomous tax filing;
- full loyalty/gift-card/subscription engine;
- global multi-warehouse optimization;
- restaurant table management;
- hotel room booking;
- cryptocurrency settlement;
- production payment credentials that have not been explicitly authorized/configured.

Those can be added as governed Commerce capabilities after the canonical transaction path is stable.

## 29. Initial Implementation Slice

The first slice should prove the canonical loop with minimum duplication:

`Catalog -> Product Detail -> Cart -> Checkout -> real-or-blocked Payment Adapter -> Order Commit -> Outbox -> Inventory -> Accounting -> CRM -> Admin Order Detail`

It should include the `/commerce` shell, product/order routes, required persistence, RLS/RBAC, core tests and production verification extension. Broader storefront CMS, advanced promotions, returns UI and external channels follow once this loop is green.

## 30. Self-Review

### Placeholder scan

No required production behavior relies on `TBD`, `TODO`, fabricated provider success, fake telemetry, empty navigation or invented stock/payment states.

### Internal consistency

Commerce owns catalog/cart/order/storefront orchestration while Inventory, CRM, Accounting and payment providers retain their canonical domain truth. Checkout/order/payment/fulfillment/integration states are intentionally separate.

### Scope check

The full Commerce product is broad, but the implementation boundary is decomposed: the first plan implements one end-to-end canonical transaction loop plus the Commerce shell and production gate. Advanced channels/features are follow-on slices.

### Ambiguity resolution

- ATLAS Commerce is the canonical commerce domain, not a third-party platform wrapper.
- money is integer minor units plus currency;
- provider-dependent success fails closed without real provider evidence;
- tenant/org/RLS/RBAC boundaries are mandatory;
- assets are reused from the ATLAS Library before new generation;
- transactional outbox/idempotent consumers are required for downstream effects;
- public storefront and protected enterprise workspace are distinct security surfaces;
- production verification is fail-closed and must include the public domain plus ATLAS Network critical routes regardless of deployment method.

### Compatibility

This design extends the current ATLAS commercial architecture and the previously approved POS execution pattern. It must reconcile and reuse any verified Inventory/CRM/Accounting/POS work already present in branches or historical A-Z work rather than create a third implementation.