# ATLAS Universal Execution Engine + POS Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Universal Execution Engine with durable outbox/idempotency/integration-delivery primitives and prove them through an exactly-once POS Sale -> Payment -> Inventory -> Accounting -> CRM pipeline.

**Architecture:** Extend the existing `@atlas/execution` foundation rather than replacing it. Add focused `@atlas/authz`, `@atlas/events`, `@atlas/pos`, `@atlas/inventory`, and `@atlas/crm` workspace packages; retain Accounting ownership in `@atlas/accounting`; persist checkout, outbox, deliveries, exceptions, and domain effects in Supabase/Postgres with RLS. A successful provider authorization is followed by one atomic database commit that persists the sale, workflow/audit state, idempotency result, and `pos.sale.completed.v1` outbox event; downstream consumers execute idempotently and failures become durable integration exceptions without rolling back the completed sale.

**Tech Stack:** TypeScript 5.7, npm workspaces, Vitest 3, Supabase/Postgres, Row Level Security, Supabase Edge Functions (Deno), Web Crypto UUIDs, integer minor-unit money.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-universal-execution-pos-pipeline-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; target branch: `feat/universal-execution-engine`.
- Reconcile with the existing Universal Execution Engine implementation already on the branch; do not create a parallel engine or duplicate existing execution workflow/task tables.
- Business aggregate state, execution workflow state, and integration delivery state are separate contracts.
- A completed paid sale remains `completed` even when a downstream Inventory, Accounting, CRM, or Analytics delivery fails.
- Cross-module propagation uses a transactional outbox; production code must not use `console.*`, browser callbacks, or best-effort HTTP fan-out as durable delivery.
- Checkout idempotency key: tenant + organization + register + `clientCheckoutRequestId`.
- Consumer idempotency key: event ID + consumer name, plus domain source uniqueness.
- Money uses integer minor units (`bigint` in TypeScript; integer/bigint-compatible numeric storage in Postgres) plus currency code. No authoritative POS money uses binary floating-point.
- Production payment status must come from a configured authorized provider adapter. Test doubles must be explicitly test-only.
- All organization-scoped persistence includes tenant/org scope and RLS. Client-provided tenant authority is never trusted without server-side resolution/validation.
- `execution.admin` never implies `pos.transact`, `accounting.post`, or any unrelated domain permission.
- No raw PAN, CVV, reusable payment secret, provider secret, API key, password, certificate, or recovery code may enter domain payloads, outbox rows, audit events, or logs.
- TDD for every task: failing test -> verify RED -> minimal implementation -> focused PASS -> commit.
- Do not merge to `main`, deploy, mutate production, or spend provider credits during this plan.
- Final verification: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.

---

## File Map

### Shared platform packages

- Modify `packages/core/src/index.ts` only when a tenancy primitive is genuinely universal; preserve existing exports.
- Create `packages/authz/package.json` — workspace metadata.
- Create `packages/authz/src/index.ts` — generic policy-evaluation contracts; no domain-role escalation.
- Modify `packages/execution/src/types.ts` — add canonical workflow-state vocabulary needed by the POS proof while preserving compatibility with existing user-facing states.
- Modify `packages/execution/src/index.ts` — re-export compatible shared contracts.
- Create `packages/events/package.json` — workspace metadata.
- Create `packages/events/src/types.ts` — domain-event, outbox, delivery, exception, and idempotency types.
- Create `packages/events/src/idempotency.ts` — deterministic idempotency key builders and conflict comparison helpers.
- Create `packages/events/src/index.ts` — public exports.

### Domain packages

- Create `packages/pos/package.json`.
- Create `packages/pos/src/types.ts` — Money, checkout command/result, sale/payment types.
- Create `packages/pos/src/payment-adapter.ts` — provider-neutral interface and normalized payment result.
- Create `packages/pos/src/checkout.ts` — validation, pricing totals, provider call, atomic-commit request orchestration.
- Create `packages/pos/src/index.ts`.
- Create `packages/inventory/package.json`.
- Create `packages/inventory/src/pos-sale-consumer.ts` — Inventory event consumer contract.
- Create `packages/inventory/src/index.ts`.
- Modify `packages/accounting/src/index.ts` — export POS posting adapter contract.
- Create `packages/accounting/src/pos-sale-posting.ts` — Accounting-owned validation/posting contract.
- Create `packages/crm/package.json`.
- Create `packages/crm/src/pos-sale-consumer.ts` — customer activity consumer contract.
- Create `packages/crm/src/index.ts`.

### Supabase

- Create `supabase/migrations/20260912_execution_outbox_pos_pipeline.sql` — idempotency, outbox, deliveries, exceptions, POS sale/payment tables, minimal Inventory/CRM proof tables, Accounting source-link constraints/RPC support, indexes, RLS, grants, and atomic checkout commit function.
- Create `supabase/functions/atlas-pos-checkout/index.ts` — authenticated POS checkout server boundary.
- Create `supabase/functions/atlas-outbox-dispatch/index.ts` — outbox claim/dispatch boundary with leasing and bounded retries.
- Create `supabase/functions/atlas-integration-resolution/index.ts` — authorized retry/resolve boundary for integration exceptions.

### Tests

- Create `tests/unit/execution-state-separation.test.ts`.
- Create `tests/unit/events-idempotency.test.ts`.
- Create `tests/unit/pos-money-and-checkout.test.ts`.
- Create `tests/unit/pos-payment-adapter.test.ts`.
- Create `tests/unit/inventory-pos-consumer.test.ts`.
- Create `tests/unit/accounting-pos-posting.test.ts`.
- Create `tests/unit/crm-pos-consumer.test.ts`.
- Create `tests/integration/pos-pipeline-schema-contract.test.ts`.
- Create `tests/integration/pos-pipeline-edge-contract.test.ts`.
- Create `tests/integration/pos-pipeline-exactly-once.test.ts`.
- Create `tests/integration/pos-pipeline-accounting-exception.test.ts`.
- Create `tests/integration/pos-pipeline-restart-retry.test.ts`.

---

### Task 1: Separate workflow and delivery state contracts

**Files:**
- Modify: `packages/execution/src/types.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `packages/events/package.json`
- Create: `packages/events/src/types.ts`
- Create: `packages/events/src/index.ts`
- Test: `tests/unit/execution-state-separation.test.ts`

**Interfaces:**
- Consumes: existing execution foundation types.
- Produces: `WorkflowExecutionState`, `IntegrationDeliveryState`, `AtlasDomainEvent<T>`, `IntegrationDelivery`, `IntegrationExceptionRecord`, `IdempotencyRecord`.

- [ ] **Step 1: Write the failing state-separation test**

```ts
import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_EXECUTION_STATES,
  type WorkflowExecutionState
} from '../../packages/execution/src';
import {
  INTEGRATION_DELIVERY_STATES,
  type IntegrationDeliveryState
} from '../../packages/events/src';

describe('three-tier execution state separation', () => {
  it('keeps workflow state separate from integration delivery state', () => {
    expect(WORKFLOW_EXECUTION_STATES).toContain('processing');
    expect(WORKFLOW_EXECUTION_STATES).toContain('compensation_required');
    expect(INTEGRATION_DELIVERY_STATES).toEqual([
      'pending', 'dispatched', 'fulfilled', 'retrying', 'failed', 'dead_lettered', 'resolved'
    ]);

    const workflow: WorkflowExecutionState = 'completed';
    const delivery: IntegrationDeliveryState = 'failed';
    expect(workflow).toBe('completed');
    expect(delivery).toBe('failed');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/execution-state-separation.test.ts
```

Expected: FAIL because the new contracts do not exist.

- [ ] **Step 3: Add minimal compatible contracts**

In `packages/execution/src/types.ts`, add without deleting the existing `ExecutionStatus` contract:

```ts
export const WORKFLOW_EXECUTION_STATES = [
  'draft', 'validating', 'ready', 'awaiting_approval', 'queued', 'processing',
  'completed', 'blocked', 'failed', 'retrying', 'cancelled', 'rolled_back',
  'compensation_required'
] as const;
export type WorkflowExecutionState = (typeof WORKFLOW_EXECUTION_STATES)[number];
```

Create `packages/events/src/types.ts` with:

```ts
export const INTEGRATION_DELIVERY_STATES = [
  'pending', 'dispatched', 'fulfilled', 'retrying', 'failed', 'dead_lettered', 'resolved'
] as const;
export type IntegrationDeliveryState = (typeof INTEGRATION_DELIVERY_STATES)[number];

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

export type IntegrationDelivery = {
  id: string;
  eventId: string;
  consumerName: string;
  targetModule: string;
  state: IntegrationDeliveryState;
  attemptCount: number;
  nextRetryAt: string | null;
  lastErrorCode: string | null;
  correlationId: string;
};

export type IntegrationExceptionRecord = {
  id: string;
  eventId: string;
  correlationId: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  targetModule: string;
  operation: string;
  reasonCode: string;
  message: string;
  retryable: boolean;
  requiresHumanAction: boolean;
  status: 'open' | 'resolved';
};
```

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/unit/execution-state-separation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution packages/events tests/unit/execution-state-separation.test.ts
git commit -m "feat: separate execution and delivery states"
```

---

### Task 2: Add shared authorization and idempotency primitives

**Files:**
- Create: `packages/authz/package.json`
- Create: `packages/authz/src/index.ts`
- Create: `packages/events/src/idempotency.ts`
- Modify: `packages/events/src/index.ts`
- Test: `tests/unit/events-idempotency.test.ts`

**Interfaces:**
- Produces: `PolicyContext`, `requirePermissions`, `buildCheckoutIdempotencyKey`, `buildConsumerIdempotencyKey`, `assertIdempotencyPayloadMatch`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCheckoutIdempotencyKey,
  buildConsumerIdempotencyKey,
  assertIdempotencyPayloadMatch
} from '../../packages/events/src';
import { requirePermissions } from '../../packages/authz/src';

describe('authorization and idempotency', () => {
  it('builds stable checkout and consumer keys', () => {
    expect(buildCheckoutIdempotencyKey({
      tenantId: 't1', organizationId: 'o1', registerId: 'r1', clientCheckoutRequestId: 'c1'
    })).toBe('pos-checkout:t1:o1:r1:c1');
    expect(buildConsumerIdempotencyKey('evt-1', 'accounting-pos-sale')).toBe('consumer:evt-1:accounting-pos-sale');
  });

  it('rejects a reused key with a different payload digest', () => {
    expect(() => assertIdempotencyPayloadMatch('abc', 'def')).toThrow('IDEMPOTENCY_CONFLICT');
  });

  it('does not let execution admin substitute for POS permission', () => {
    expect(() => requirePermissions(['execution.admin'], ['pos.transact'])).toThrow('AUTHORIZATION_FAILED');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/events-idempotency.test.ts
```

- [ ] **Step 3: Implement minimal primitives**

`packages/authz/src/index.ts`:

```ts
export type PolicyContext = { grantedPermissions: readonly string[] };
export function requirePermissions(granted: readonly string[], required: readonly string[]) {
  for (const permission of required) {
    if (!granted.includes(permission)) throw new Error(`AUTHORIZATION_FAILED:${permission}`);
  }
}
```

`packages/events/src/idempotency.ts`:

```ts
export function buildCheckoutIdempotencyKey(input: {
  tenantId: string; organizationId: string; registerId: string; clientCheckoutRequestId: string;
}) {
  return `pos-checkout:${input.tenantId}:${input.organizationId}:${input.registerId}:${input.clientCheckoutRequestId}`;
}
export function buildConsumerIdempotencyKey(eventId: string, consumerName: string) {
  return `consumer:${eventId}:${consumerName}`;
}
export function assertIdempotencyPayloadMatch(existingDigest: string, incomingDigest: string) {
  if (existingDigest !== incomingDigest) throw new Error('IDEMPOTENCY_CONFLICT');
}
```

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/unit/events-idempotency.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/authz packages/events tests/unit/events-idempotency.test.ts
git commit -m "feat: add authz and idempotency primitives"
```

---

### Task 3: Introduce integer-money POS domain and checkout validation

**Files:**
- Create: `packages/pos/package.json`
- Create: `packages/pos/src/types.ts`
- Create: `packages/pos/src/checkout.ts`
- Create: `packages/pos/src/index.ts`
- Test: `tests/unit/pos-money-and-checkout.test.ts`

**Interfaces:**
- Produces: `Money`, `CheckoutItem`, `ProcessPOSSaleCommand`, `POSSaleAggregateState`, `calculateSaleSubtotalMinor`, `validateCheckoutCommand`.

- [ ] **Step 1: Write failing money/validation tests**

```ts
import { describe, expect, it } from 'vitest';
import { calculateSaleSubtotalMinor, validateCheckoutCommand } from '../../packages/pos/src';

describe('POS money and checkout validation', () => {
  it('calculates only with integer minor units', () => {
    expect(calculateSaleSubtotalMinor([
      { sku: 'A', quantity: 2, unitPriceMinor: 1099n },
      { sku: 'B', quantity: 1, unitPriceMinor: 250n }
    ])).toBe(2448n);
  });

  it('rejects an empty or non-positive checkout line', () => {
    expect(() => validateCheckoutCommand({
      registerId: 'r1', clientCheckoutRequestId: 'c1', customerId: null,
      currency: 'USD', items: [{ sku: 'A', quantity: 0, unitPriceMinor: 1099n }],
      paymentMethodReference: 'pm_ref'
    })).toThrow('INVALID_CHECKOUT');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/pos-money-and-checkout.test.ts
```

- [ ] **Step 3: Implement POS types and pure validation**

Use these exact authoritative shapes:

```ts
export type Money = { amountMinor: bigint; currency: string };
export type CheckoutItem = { sku: string; quantity: number; unitPriceMinor: bigint };
export type ProcessPOSSaleCommand = {
  registerId: string;
  clientCheckoutRequestId: string;
  customerId: string | null;
  currency: string;
  items: CheckoutItem[];
  paymentMethodReference: string;
};
export type POSSaleAggregateState = 'draft' | 'open' | 'completed' | 'cancelled' | 'refunded';
```

`calculateSaleSubtotalMinor()` sums `unitPriceMinor * BigInt(quantity)`. `validateCheckoutCommand()` rejects empty IDs, non-3-letter uppercase currency, empty items, quantity <= 0, negative prices, and missing payment method reference.

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/unit/pos-money-and-checkout.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/pos tests/unit/pos-money-and-checkout.test.ts
git commit -m "feat: add POS integer money domain"
```

---

### Task 4: Add truthful payment-provider adapter boundary

**Files:**
- Create: `packages/pos/src/payment-adapter.ts`
- Modify: `packages/pos/src/index.ts`
- Test: `tests/unit/pos-payment-adapter.test.ts`

**Interfaces:**
- Produces: `PaymentAuthorizationRequest`, `PaymentAuthorizationResult`, `PaymentProviderAdapter`, `requireConfiguredPaymentProvider`.

- [ ] **Step 1: Write failing adapter tests**

```ts
import { describe, expect, it } from 'vitest';
import { requireConfiguredPaymentProvider, type PaymentProviderAdapter } from '../../packages/pos/src';

describe('POS payment provider boundary', () => {
  it('fails closed when no provider is configured', () => {
    expect(() => requireConfiguredPaymentProvider(null)).toThrow('PAYMENT_PROVIDER_NOT_CONFIGURED');
  });

  it('accepts an explicit adapter without claiming provider truth itself', () => {
    const adapter: PaymentProviderAdapter = {
      name: 'test-only',
      authorize: async () => ({
        status: 'authorized', provider: 'test-only', providerReference: 'p1',
        amountMinor: 1000n, currency: 'USD', authorizedAt: '2026-09-12T18:00:00.000Z'
      })
    };
    expect(requireConfiguredPaymentProvider(adapter)).toBe(adapter);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/pos-payment-adapter.test.ts
```

- [ ] **Step 3: Implement provider-neutral interface**

```ts
export type PaymentAuthorizationRequest = {
  amountMinor: bigint;
  currency: string;
  paymentMethodReference: string;
  idempotencyKey: string;
};
export type PaymentAuthorizationResult = {
  status: 'authorized' | 'declined' | 'ambiguous';
  provider: string;
  providerReference: string | null;
  amountMinor: bigint;
  currency: string;
  authorizedAt: string | null;
};
export interface PaymentProviderAdapter {
  name: string;
  authorize(request: PaymentAuthorizationRequest): Promise<PaymentAuthorizationResult>;
}
export function requireConfiguredPaymentProvider(adapter: PaymentProviderAdapter | null) {
  if (!adapter) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  return adapter;
}
```

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/unit/pos-payment-adapter.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/pos tests/unit/pos-payment-adapter.test.ts
git commit -m "feat: add POS payment provider boundary"
```

---

### Task 5: Add durable schema, RLS, and atomic POS commit RPC

**Files:**
- Create: `supabase/migrations/20260912_execution_outbox_pos_pipeline.sql`
- Test: `tests/integration/pos-pipeline-schema-contract.test.ts`

**Interfaces:**
- Produces tables `execution_idempotency_keys`, `execution_outbox`, `execution_integration_deliveries`, `execution_integration_exceptions`, `pos_sales`, `pos_sale_items`, `pos_payment_results`, `inventory_stock_balances`, `inventory_movements`, `crm_customer_activities`, and Accounting-owned source-linked journal schema if no current journal schema exists.
- Produces RPC `commit_pos_sale_v1(...)`.

- [ ] **Step 1: Write schema-contract test**

The test reads the SQL file and asserts all required tables, RLS enables, uniqueness constraints, and the RPC are present:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_execution_outbox_pos_pipeline.sql', 'utf8');

describe('POS pipeline schema contract', () => {
  it('defines durable integration and POS persistence', () => {
    for (const name of [
      'execution_idempotency_keys', 'execution_outbox', 'execution_integration_deliveries',
      'execution_integration_exceptions', 'pos_sales', 'pos_sale_items', 'pos_payment_results',
      'inventory_stock_balances', 'inventory_movements', 'crm_customer_activities'
    ]) expect(sql).toContain(`public.${name}`);
    expect(sql).toContain('commit_pos_sale_v1');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('client_checkout_request_id');
    expect(sql).toContain('consumer_name');
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/pos-pipeline-schema-contract.test.ts
```

- [ ] **Step 3: Implement the migration**

The migration must enforce:

- sale state check: `draft/open/completed/cancelled/refunded`;
- delivery-state check: `pending/dispatched/fulfilled/retrying/failed/dead_lettered/resolved`;
- outbox unique `event_id`;
- delivery unique `(event_id, consumer_name)`;
- checkout idempotency unique `(tenant_id, org_id, scope_key)`;
- inventory movement source uniqueness preventing double decrement;
- accounting source uniqueness preventing duplicate journal;
- CRM activity source uniqueness preventing duplicate timeline entry;
- organization membership RLS on authenticated reads;
- writes restricted to server-side/service boundaries consistent with the existing execution migration;
- append-only semantics for audit/outbox history where applicable;
- `commit_pos_sale_v1` inserts/returns a sale, payment result, workflow/audit linkage, outbox event, and idempotency result atomically;
- same idempotency key + same payload digest returns the existing sale result;
- same idempotency key + different digest raises an idempotency conflict.

Store money in integer-compatible columns such as `bigint`; convert to/from TypeScript `bigint` as decimal strings across JSON boundaries.

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/integration/pos-pipeline-schema-contract.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912_execution_outbox_pos_pipeline.sql tests/integration/pos-pipeline-schema-contract.test.ts
git commit -m "feat: add durable POS outbox schema"
```

---

### Task 6: Implement authenticated checkout orchestration and atomic commit call

**Files:**
- Modify: `packages/pos/src/checkout.ts`
- Create: `supabase/functions/atlas-pos-checkout/index.ts`
- Test: `tests/integration/pos-pipeline-edge-contract.test.ts`
- Test: `tests/integration/pos-pipeline-exactly-once.test.ts`

**Interfaces:**
- Consumes: `PaymentProviderAdapter`, `buildCheckoutIdempotencyKey`, `requirePermissions`, RPC `commit_pos_sale_v1`.
- Produces: `processPOSSale(command, executionContext, dependencies)` and HTTP/Edge operation `process_sale`.

- [ ] **Step 1: Write failing cross-tenant, permission, decline, and duplicate tests**

Tests must prove:

```ts
expect(crossTenantResult.code).toBe('TENANT_SCOPE_MISMATCH');
expect(noPermissionResult.code).toBe('AUTHORIZATION_FAILED');
expect(declinedResult.completedSale).toBe(false);
expect(first.saleId).toBe(second.saleId);
expect(first.eventId).toBe(second.eventId);
```

Use a named `TestPaymentProvider` only inside test files; never export it from production package code.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/pos-pipeline-edge-contract.test.ts tests/integration/pos-pipeline-exactly-once.test.ts
```

- [ ] **Step 3: Implement minimal checkout flow**

Required order:

```text
resolve authenticated scope
-> require pos.transact
-> validate command
-> build checkout idempotency key
-> compute authoritative subtotal/total inputs
-> require configured payment provider
-> authorize payment
-> if declined: persist/audit rejection only; no completed sale
-> if ambiguous: return reconciliation/blocking result; do not call commit RPC
-> if authorized: call commit_pos_sale_v1 once
-> return persisted sale/workflow/event IDs
```

Do not trust a client-supplied tenant, total, or provider status.

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/integration/pos-pipeline-edge-contract.test.ts tests/integration/pos-pipeline-exactly-once.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/pos supabase/functions/atlas-pos-checkout tests/integration/pos-pipeline-*.test.ts
git commit -m "feat: add atomic POS checkout orchestration"
```

---

### Task 7: Implement durable outbox dispatcher and leasing

**Files:**
- Create: `supabase/functions/atlas-outbox-dispatch/index.ts`
- Extend: `supabase/migrations/20260912_execution_outbox_pos_pipeline.sql` only if a lease column/function is missing; if already committed, create a follow-up migration rather than rewriting applied history.
- Create: `tests/integration/pos-pipeline-restart-retry.test.ts`

**Interfaces:**
- Produces claim operation `claim_execution_outbox_v1(worker_id, lease_seconds, limit)` and delivery update operations.

- [ ] **Step 1: Write failing lease/restart tests**

Tests must assert:

- one pending outbox row can be claimed by only one worker during an active lease;
- expired lease makes work claimable again;
- attempt count and `next_retry_at` persist in the database-facing repository contract;
- recreating the dispatcher process does not lose pending/retrying work.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/pos-pipeline-restart-retry.test.ts
```

- [ ] **Step 3: Implement dispatcher semantics**

Use database claiming equivalent to `FOR UPDATE SKIP LOCKED` inside an RPC/transaction. The dispatcher materializes one delivery row per registered consumer and uses bounded exponential backoff. A consumer error updates durable delivery state; it does not delete the outbox event.

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/integration/pos-pipeline-restart-retry.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-outbox-dispatch supabase/migrations tests/integration/pos-pipeline-restart-retry.test.ts
git commit -m "feat: add durable outbox dispatcher"
```

---

### Task 8: Implement idempotent Inventory, Accounting, and CRM consumers

**Files:**
- Create: `packages/inventory/package.json`
- Create: `packages/inventory/src/pos-sale-consumer.ts`
- Create: `packages/inventory/src/index.ts`
- Create: `packages/accounting/src/pos-sale-posting.ts`
- Modify: `packages/accounting/src/index.ts`
- Create: `packages/crm/package.json`
- Create: `packages/crm/src/pos-sale-consumer.ts`
- Create: `packages/crm/src/index.ts`
- Test: `tests/unit/inventory-pos-consumer.test.ts`
- Test: `tests/unit/accounting-pos-posting.test.ts`
- Test: `tests/unit/crm-pos-consumer.test.ts`

**Interfaces:**
- Inventory consumer: `applyCompletedSaleToInventory(event, repo)`.
- Accounting consumer: `postCompletedSaleToAccounting(event, repo)`.
- CRM consumer: `recordCompletedSaleCustomerActivity(event, repo)`.

- [ ] **Step 1: Write failing exactly-once unit tests**

Inventory test calls the same event twice and expects one movement/decrement. Accounting test calls twice and expects one balanced journal. CRM test calls twice and expects one customer activity and verifies anonymous sale produces none.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/inventory-pos-consumer.test.ts tests/unit/accounting-pos-posting.test.ts tests/unit/crm-pos-consumer.test.ts
```

- [ ] **Step 3: Implement minimal consumers**

All three consumers must:

1. validate event type/schema version;
2. validate tenant/org scope;
3. derive a consumer/source idempotency key;
4. execute the domain effect inside the domain repository transaction;
5. return the existing effect on duplicate delivery;
6. never mutate POS sale state.

Accounting additionally verifies integer minor-unit debit/credit equality and period-open state before insertion.

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/unit/inventory-pos-consumer.test.ts tests/unit/accounting-pos-posting.test.ts tests/unit/crm-pos-consumer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/inventory packages/accounting packages/crm tests/unit/*pos*.test.ts
git commit -m "feat: add POS downstream consumers"
```

---

### Task 9: Persist Accounting locked-period exceptions and authorized resolution

**Files:**
- Create: `supabase/functions/atlas-integration-resolution/index.ts`
- Create: `tests/integration/pos-pipeline-accounting-exception.test.ts`
- Modify migration only through a follow-up file if schema additions are required after Task 5.

**Interfaces:**
- Produces exception reason `ACCOUNTING_PERIOD_LOCKED` and operations `retry_delivery` / `resolve_exception` with explicit authorization.

- [ ] **Step 1: Write failing exception test**

The test must prove:

```ts
expect(sale.status).toBe('completed');
expect(accountingDelivery.state).toBe('failed');
expect(exception.reasonCode).toBe('ACCOUNTING_PERIOD_LOCKED');
expect(exception.requiresHumanAction).toBe(true);
expect(journalCountForSale).toBe(0);
```

After opening/correcting the period and issuing an authorized retry, assert one journal exists, delivery becomes `fulfilled`, exception becomes `resolved`, and the resolution audit event exists.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/integration/pos-pipeline-accounting-exception.test.ts
```

- [ ] **Step 3: Implement failure and resolution semantics**

The dispatcher/Accounting adapter catches the typed locked-period domain error, persists delivery failure and exception state, and leaves the POS aggregate untouched. The resolution Edge Function requires authenticated scope plus execution and Accounting authorization; dismissal alone cannot mark the exception resolved.

- [ ] **Step 4: Run PASS**

```bash
npx vitest run tests/integration/pos-pipeline-accounting-exception.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-integration-resolution tests/integration/pos-pipeline-accounting-exception.test.ts supabase/migrations
git commit -m "feat: add accounting integration exception recovery"
```

---

### Task 10: Prove the complete acceptance matrix and verify the branch

**Files:**
- Modify: `tests/integration/pos-pipeline-exactly-once.test.ts`
- Modify: `tests/integration/pos-pipeline-restart-retry.test.ts`
- Modify: `tests/integration/pos-pipeline-accounting-exception.test.ts`
- Add documentation note to this plan only if the implemented public contract differs for a justified reason; do not weaken acceptance criteria.

**Interfaces:**
- Consumes all prior tasks.
- Produces no new production API; this task is verification and correction only.

- [ ] **Step 1: Ensure the end-to-end tests cover every acceptance criterion**

The suite must explicitly assert:

```text
cross-tenant rejected
missing pos.transact rejected
duplicate checkout returns same sale/event
declined payment creates no completed sale
authorized payment commits sale once
inventory decremented once
accounting journal posted once
CRM activity written once when customer exists
locked period creates durable exception
sale remains completed during accounting failure
correlation/event lineage preserved
audit events exist for sensitive transitions
retry state survives dispatcher restart
no production path substitutes a test payment provider
all money is integer minor units
```

- [ ] **Step 2: Run focused POS pipeline tests**

```bash
npx vitest run \
  tests/unit/execution-state-separation.test.ts \
  tests/unit/events-idempotency.test.ts \
  tests/unit/pos-money-and-checkout.test.ts \
  tests/unit/pos-payment-adapter.test.ts \
  tests/unit/inventory-pos-consumer.test.ts \
  tests/unit/accounting-pos-posting.test.ts \
  tests/unit/crm-pos-consumer.test.ts \
  tests/integration/pos-pipeline-schema-contract.test.ts \
  tests/integration/pos-pipeline-edge-contract.test.ts \
  tests/integration/pos-pipeline-exactly-once.test.ts \
  tests/integration/pos-pipeline-accounting-exception.test.ts \
  tests/integration/pos-pipeline-restart-retry.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run complete repository verification**

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Inspect for prohibited simulation/secrets and state confusion**

Run repository searches equivalent to:

```bash
grep -R "paymentAuthorized = true\|console.warn.*ATLAS_EVENT_BUS\|TODO\|TBD" packages supabase/functions tests || true
grep -R "unitPrice: number\|amountPaid: number" packages/pos supabase/functions/atlas-pos-checkout || true
```

Expected: no production POS execution shortcut, no fake event bus, no placeholder, and no authoritative floating-point POS money field.

- [ ] **Step 5: Commit final corrections only if needed**

```bash
git add packages supabase tests docs/superpowers
git commit -m "test: verify universal execution POS pipeline"
```

Do not create an empty commit if no corrections were required.

---

## Plan Self-Review

### 1. Spec coverage

Every binding requirement in the specification maps to a task:

- three-tier state separation -> Task 1;
- package modularity/authz/events -> Tasks 1-2;
- bigint/minor-unit money -> Task 3;
- truthful provider boundary -> Task 4;
- transactional outbox + atomic sale commit + RLS -> Task 5;
- tenant/authz/idempotent checkout -> Task 6;
- durable leasing/restart retry -> Task 7;
- Inventory/Accounting/CRM exactly-once effects -> Task 8;
- locked-period exception and authorized resolution -> Task 9;
- complete acceptance matrix/full verification -> Task 10.

No accepted requirement is left without an implementation/test task.

### 2. Placeholder scan

The plan contains no `TBD`, `TODO`, “implement later,” generic “add error handling,” or unspecified test instruction. Where SQL is too large to duplicate safely in this plan, the exact invariants, constraints, table names, RPC names, state values, and test assertions are specified.

### 3. Type consistency

Authoritative names used throughout the plan are consistent:

- workflow state: `WorkflowExecutionState`;
- delivery state: `IntegrationDeliveryState`;
- source event: `pos.sale.completed.v1`;
- checkout command: `ProcessPOSSaleCommand`;
- money: `Money { amountMinor: bigint; currency: string }`;
- payment adapter: `PaymentProviderAdapter`;
- locked-period code: `ACCOUNTING_PERIOD_LOCKED`;
- atomic commit RPC: `commit_pos_sale_v1`.

### 4. Scope check

This plan intentionally does not build the POS visual module, refunds, chargebacks, restaurant operations, offline mode, complete Inventory UI, complete CRM UI, or a full Accounting redesign. It proves the shared execution/integration architecture with the minimum real domain persistence necessary to satisfy the approved acceptance criteria.

### 5. Security consistency

- tenant/org scope is revalidated server-side and enforced with RLS;
- generic execution permissions do not imply domain permissions;
- provider secrets/payment secrets are excluded from persisted payloads and audit records;
- human resolution requires real authorization;
- no merge/deploy/provider spend is part of the implementation plan.
