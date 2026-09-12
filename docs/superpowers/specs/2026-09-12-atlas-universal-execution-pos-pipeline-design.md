# ATLAS Universal Execution Engine + POS Pipeline — Design Specification

Date: 2026-09-12
Status: Approved architecture; binding implementation specification
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/universal-execution-engine`
Owner: ATLAS shared platform / Universal Execution Engine
Primary proof: POS Sale -> Payment -> Inventory -> Accounting -> CRM

## 1. Purpose

This specification hardens the existing Universal Execution Engine foundation and proves it with one financially meaningful closed loop: a POS checkout that completes exactly once, persists durable execution state, and propagates idempotent downstream effects without allowing a later integration failure to invalidate a completed paid sale.

It supplements `docs/superpowers/specs/2026-09-12-atlas-universal-execution-engine-design.md`. Where this specification is more specific for the POS proof, this document is authoritative.

The approved architectural approach is:

**Approach A — shared execution kernel + transactional outbox + module adapters.**

The canonical path is:

`INTENT -> TENANT -> AUTHN -> AUTHZ -> VALIDATION -> CONCURRENCY -> APPROVAL -> IDEMPOTENCY -> DOMAIN EXECUTION -> ATOMIC COMMIT -> OUTBOX -> DOWNSTREAM DELIVERY -> EXCEPTION/RETRY -> AUDIT -> NEXT ACTION`

## 2. Existing Repository Baseline

The branch already contains:

- `packages/execution` with execution types, state machine, adapter, approval, evidence, store, and engine primitives;
- `supabase/migrations/20260912_universal_execution_engine.sql` with execution workflows/tasks/steps/dependencies/evidence/approvals/audit tables and RLS;
- `supabase/functions/atlas-execution/index.ts` as the authenticated server-side execution boundary;
- unit and integration tests for the execution foundation.

This work extends those assets. It must not create a parallel workflow engine, duplicate the existing execution tables, or replace stronger current behavior.

## 3. Locked Architectural Decisions

### 3.1 Atomic POS commit boundary

A successful electronic checkout is not considered durable until one database transaction commits all of the following:

1. the authoritative POS sale;
2. its sale items;
3. the verified payment result/reference;
4. the execution workflow/task state needed to resume/reconcile;
5. the audit event for the sensitive transition;
6. the `SaleCompleted` outbox event.

If that transaction fails, the sale is not reported as completed.

Once it succeeds, later Inventory, Accounting, CRM, or Analytics failures do not roll the sale back. They are represented as integration delivery failures and, when needed, integration exceptions.

### 3.2 Three-tier state separation

ATLAS must not overload one status enum to describe three different realities.

**Business aggregate state** describes the domain record:

- POS sale: `draft | open | completed | cancelled | refunded`.

**Execution workflow state** describes orchestration:

- `draft | validating | ready | awaiting_approval | queued | processing | completed | blocked | failed | retrying | cancelled | rolled_back | compensation_required`.

**Integration delivery state** describes one downstream consumer delivery:

- `pending | dispatched | fulfilled | retrying | failed | dead_lettered | resolved`.

Example:

```text
Sale: completed
Workflow: completed
Inventory delivery: fulfilled
Accounting delivery: failed
CRM delivery: fulfilled
```

The UI must be able to say: `Sale completed. Accounting posting requires attention.`

### 3.3 Transactional outbox

Cross-module work is initiated from durable outbox rows created in the same transaction as the source-domain commit. No production path may rely on `console.log`, in-memory events, browser callbacks, or best-effort HTTP fan-out as proof of downstream delivery.

### 3.4 Idempotency

Idempotency is mandatory at two boundaries:

- checkout command: `tenant + organization + register + clientCheckoutRequestId`;
- event consumer: `eventId + consumerName`.

Domain effects also use natural source uniqueness where possible:

- inventory movement: unique source `(source_module, source_entity_type, source_entity_id, sku)`;
- accounting journal: unique source `(source_module, source_entity_type, source_entity_id, posting_type)`;
- CRM activity: unique source `(source_module, source_entity_type, source_entity_id, activity_type)`.

A retry returns or confirms the already-created effect instead of creating a duplicate.

### 3.5 Financial precision

All monetary values use integer minor units plus ISO currency code.

```ts
export type Money = {
  amountMinor: bigint;
  currency: string;
};
```

No POS, tax, tip, discount, refund, payment, or journal amount in the new pipeline may use binary floating-point as the authoritative monetary representation.

### 3.6 Provider truthfulness

The production checkout path may only report `authorized`, `captured`, `settled`, `connected`, or equivalent provider states when an authorized provider adapter returned that state and its provider reference was persisted.

Test adapters are allowed only in tests and must be named and scoped explicitly as test doubles. If no payment provider is configured in a runtime environment, the production boundary returns a provider-configuration blocker; it must not silently simulate success.

## 4. Package Boundaries

The approved target package ownership is:

```text
packages/core
  tenancy and minimal universal primitives

packages/authz
  shared permission/policy evaluation contracts

packages/execution
  workflow/task state, approvals, evidence, orchestration, retries

packages/events
  domain-event envelope, outbox/delivery contracts, consumer idempotency

packages/pos
  sale/cart/payment-checkout domain and payment adapter boundary

packages/inventory
  stock balance and inventory movement domain

packages/accounting
  accounting domain; POS posting adapter must use accounting-owned contracts

packages/crm
  customer activity domain
```

`packages/execution` must not import Inventory, Accounting, or CRM persistence internals. It coordinates through module adapters and durable event contracts.

For compatibility, existing execution-layer exports may remain available while responsibilities are moved into focused packages; consumers must not be broken solely to satisfy directory aesthetics.

## 5. Authorization and Tenant Boundary

Every sensitive mutation follows the strictest applicable authorization boundary:

`authenticated identity -> tenant/org membership -> execution permission -> owning-domain permission -> workflow/approval policy -> provider capability -> execute`

The client does not supply trusted tenant authority. Server-side context resolves the active tenant/organization from authenticated membership/session context and validates any referenced record belongs to the same scope.

Database RLS remains a defense-in-depth boundary. Cross-tenant and cross-organization requests fail closed before domain execution.

Initial POS permissions for the proof:

- `pos.read`
- `pos.transact`
- `pos.refund`
- `pos.admin`

Accounting posting continues to require Accounting-owned authorization. Generic `execution.admin` does not imply `accounting.post`, `pos.transact`, or any other domain permission.

## 6. Domain Event Contract

The shared event envelope is:

```ts
export interface AtlasDomainEvent<TPayload> {
  eventId: string;
  eventType: string;
  tenantId: string;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  causationId: string | null;
  occurredAt: string;
  actorId: string;
  schemaVersion: number;
  payload: TPayload;
}
```

The first source event is `pos.sale.completed.v1`.

Its payload contains references and normalized commercial facts required by downstream consumers; it does not contain payment secrets or raw provider tokens.

## 7. Persistence Extensions

The existing execution schema remains authoritative for workflow/task/approval/evidence/audit state.

A follow-up migration adds the durable integration layer:

- `execution_idempotency_keys`;
- `execution_outbox`;
- `execution_integration_deliveries`;
- `execution_integration_exceptions`.

The POS proof also requires authoritative domain persistence. New tables must be owned by their domains and must not be disguised as execution records:

### POS

- `pos_sales`;
- `pos_sale_items`;
- `pos_payment_results`.

### Inventory

- `inventory_stock_balances`;
- `inventory_movements`.

### Accounting

The POS posting adapter must align with the Accounting design and use Accounting-owned journal contracts. If a production journal schema already exists when implementation begins, reuse it. If it does not, the proof may introduce the minimum Accounting-owned `accounting_journal_entries` and `accounting_journal_lines` schema required for a balanced, source-linked sale posting. It must not create an execution-owned shadow journal.

### CRM

- `crm_customer_activities` for source-linked customer timeline activity.

Every organization-scoped table carries `org_id` and `tenant_id`, has supporting indexes, and enforces RLS consistent with current organization membership patterns.

## 8. POS Checkout Command

The production command contract is conceptually:

```ts
export type CheckoutItem = {
  sku: string;
  quantity: number;
  unitPriceMinor: bigint;
};

export type ProcessPOSSaleCommand = {
  registerId: string;
  clientCheckoutRequestId: string;
  customerId: string | null;
  currency: string;
  items: CheckoutItem[];
  paymentMethodReference: string;
};
```

The server recomputes authoritative subtotal, tax, discounts, tip, and total from permitted domain inputs. A client-provided total is never the sole authority for the amount to charge.

## 9. Payment Adapter Boundary

`packages/pos` defines a provider-neutral payment interface. A production adapter returns a normalized result containing:

- status;
- provider name;
- provider transaction/reference ID;
- authorized amount in minor units;
- currency;
- authorization timestamp;
- safe evidence/reference fields.

Raw PAN, CVV, bank credentials, provider secret keys, and reusable payment secrets are never persisted by this pipeline.

Ambiguous provider outcomes are not retried blindly. They enter an explicit reconciliation/blocking path until provider state is resolved.

## 10. Atomic Commit Semantics

After provider authorization succeeds, the server invokes one database transaction/RPC that:

1. verifies the idempotency key is not already committed;
2. creates or returns the authoritative sale;
3. persists sale items and normalized payment result;
4. persists/updates execution workflow state;
5. appends the audit event;
6. writes the `pos.sale.completed.v1` outbox row;
7. records the committed idempotency result;
8. commits atomically.

A repeated request with the same key and equivalent command returns the previously committed sale. A repeated key with a materially different command is rejected as an idempotency conflict.

## 11. Outbox Dispatch and Delivery Leasing

An outbox dispatcher claims pending events using database-safe leasing semantics so concurrent workers do not deliver the same event simultaneously.

Each target consumer receives an `execution_integration_deliveries` row.

Delivery behavior:

```text
pending -> dispatched -> fulfilled
pending/dispatched -> retrying -> dispatched
retrying -> failed -> dead_lettered
failed/dead_lettered -> resolved (authorized human/system resolution)
```

Retries use bounded exponential backoff and preserve attempt count, last error code, next retry time, correlation ID, event ID, and consumer name.

## 12. Inventory Consumer

The Inventory consumer handles `pos.sale.completed.v1` and, inside one Inventory-owned transaction:

- validates tenant/org and SKU scope;
- checks consumer idempotency;
- locks/updates stock rows safely;
- creates one inventory movement per sale line/source key;
- records fulfillment of the delivery.

Duplicate event delivery must not decrement stock twice.

If stock state is inconsistent after a completed paid sale, Inventory records an integration exception rather than altering the paid sale state. The exception provides an explicit reconciliation action.

## 13. Accounting Consumer

The Accounting consumer handles `pos.sale.completed.v1` and posts one balanced source-linked journal entry.

At minimum the proof validates:

- debits equal credits in minor units;
- source sale uniqueness prevents duplicate journals;
- the accounting period is open before posting;
- account/currency configuration is valid.

If the period is locked, the consumer creates/updates the Accounting delivery as failed and persists an integration exception with reason code `ACCOUNTING_PERIOD_LOCKED`, `requires_human_action = true`, and no duplicate journal.

The sale remains completed.

Authorized resolution may post to an explicitly permitted period or retry after the period/configuration issue is corrected. Resolution itself is audited.

## 14. CRM Consumer

When the sale has a customer reference, CRM writes one source-linked `purchase_completed` activity to the customer timeline. Anonymous sales do not create synthetic customers.

Duplicate delivery must not create duplicate activities.

## 15. Integration Exception Contract

A durable exception contains at minimum:

- `id`;
- tenant/organization;
- source module/entity type/entity ID;
- target module;
- operation;
- reason code;
- human-readable message;
- retryable;
- requires human action;
- status;
- attempt count;
- next retry time;
- assigned user when applicable;
- event ID;
- correlation ID;
- created/updated/resolved timestamps;
- resolver and resolution note when resolved.

No exception may be considered resolved merely because a user dismissed the UI notification; the underlying delivery/domain condition must be reconciled or explicitly closed under an authorized policy.

## 16. Audit Requirements

Sensitive transitions produce append-only audit evidence, including:

- checkout request accepted/rejected;
- payment authorization result reference;
- atomic sale completion;
- downstream fulfillment/failure;
- exception creation;
- retry/dead-letter transition;
- human resolution;
- accounting posting;
- refund/compensation when later introduced.

Audit payloads must exclude secrets and unnecessary personal/payment data.

## 17. Failure Semantics

### Before atomic sale commit

Validation, authorization, payment decline, or persistence failure means no completed sale is reported.

### After atomic sale commit

Downstream integration failures never silently disappear and do not rewrite the completed sale to failed/partial. They create delivery failure state and, when policy requires, an integration exception.

### Ambiguous payment result

If the provider may have authorized/captured but the response is uncertain, the command enters reconciliation. ATLAS must not issue a blind second charge.

## 18. Acceptance Criteria

The implementation is complete only when automated tests prove:

1. cross-tenant checkout is rejected;
2. a user without `pos.transact` is rejected;
3. duplicate checkout requests return the same committed sale;
4. a declined payment creates no completed sale;
5. an authorized payment commits the sale exactly once;
6. stock is decremented exactly once;
7. the Accounting journal is posted exactly once;
8. CRM customer activity is written exactly once when a customer exists;
9. a locked accounting period creates a durable integration exception;
10. the sale remains `completed` despite the Accounting delivery failure;
11. event/correlation lineage is preserved end-to-end;
12. the audit trail records every sensitive transition required by this spec;
13. retries survive process restart because work and idempotency state are durable;
14. no simulated provider is represented as live/connected/authorized in a production path;
15. monetary arithmetic and persisted amounts use integer minor units.

## 19. Non-Goals

This slice does not implement:

- full POS visual navigation or every POS menu;
- refunds, chargebacks, tips, gift cards, loyalty, restaurant tables, or offline POS;
- complete Inventory, CRM, or Accounting user experiences;
- a new payment processor;
- production provider credentials;
- automatic accounting-period reopening;
- broad migration of Payroll, Health, Ride, Hospitality, or Projects to the new integration-delivery contract.

Those are follow-on slices after this proof is stable.

## 20. Required Verification

Before proposing integration:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Focused tests must also cover the SQL/RLS contract, checkout orchestration, outbox leasing, each consumer, idempotency conflicts, locked-period exception behavior, and restart/retry behavior.

No merge to `main`, deployment, external provider charge, or production infrastructure mutation is implied by this specification.

## 21. Self-Review

### Placeholder scan

No `TBD`, `TODO`, fake production provider state, fake evidence, or unspecified success path is permitted by this design.

### Internal consistency

The design deliberately separates sale state, workflow state, and delivery state. A completed paid sale therefore remains completed while a downstream Accounting delivery can independently fail and enter exception handling.

### Scope check

This is one bounded architectural proof: shared integration hardening plus the POS closed loop. Full POS UI, full Inventory, full CRM, full Accounting UI, and additional module adoption remain outside this plan.

### Ambiguity resolution

- `bigint`/integer minor units are authoritative for money.
- transactional outbox is mandatory; direct best-effort fan-out is not an acceptable substitute.
- production payment success requires a configured real provider adapter; tests use explicit test doubles only.
- downstream retries are idempotent and durable.
- generic execution authorization never grants domain permissions.
- Accounting locked-period behavior creates an exception and leaves the sale completed.

### Compatibility check

This design extends the existing execution foundation on `feat/universal-execution-engine`; it does not replace the established execution workflow/task schema or create a second engine.
