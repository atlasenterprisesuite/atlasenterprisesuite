# ATLAS Network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ATLAS Network as a governed multinational referral, pricing, commission, rank, compliance, and payout subsystem inside Business Suite, with compensation funded only by verified customer revenue and with Finance/Accounting integration boundaries that never fabricate settlement.

**Architecture:** Add a pure TypeScript `@atlas/network` domain package for deterministic money, pricing, CNR, commission, rank, and earnings-claim rules. Persist Network state in Supabase using existing `org_id`, RLS, `has_identity_permission(...)`, and `audit_row_change()` patterns; expose authenticated operations through one `atlas-network` edge function; mount the UI under `Business -> ATLAS Network` using the existing React route/API/CSS patterns. External payouts remain provider-gated: ATLAS may calculate liabilities and approve batches, but `paid` requires real settlement evidence.

**Tech Stack:** TypeScript 5.7, React 18, React Router, Vite 6, Vitest 3, Supabase/PostgreSQL/RLS/Edge Functions, existing ATLAS identity/audit/accounting primitives.

**Spec:** `docs/superpowers/specs/2026-09-16-atlas-network-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; default integration target: `main`.
- ATLAS Network lives inside Business Suite; do not create a standalone application or parallel customer/identity/accounting source of truth.
- Partner enrollment price is exactly `$0`; no commission, bonus, or rank credit is generated solely from recruiting or enrolling another partner.
- No rank may be purchased.
- `CNR = cash_collected - sales_and_indirect_taxes - refunds - chargebacks - credits - noncommissionable_pass_through_fees`.
- Commission pool cap is `min(20% of CNR, 35% of contribution_margin)` and may be lowered by a product-specific cap.
- Launch component maxima are direct `12%`, level 2 `3%`, level 3 `1.5%`, leadership `1.5%`, campaign incentives `2%`; aggregate maximum `20%`.
- Money persisted by Network uses integer minor units; never JavaScript floating-point currency amounts in persistence contracts.
- USD is the corporate base reference currency; local price books preserve transaction currency, captured FX rate/source/timestamp, and translated USD value.
- Historical price-book, rule, FX, rank, and commission-event versions are immutable evidence for prior transactions.
- A payout is never represented as `paid` until an authorized provider or accounting settlement source confirms settlement.
- Empty datasets render empty/configuration states; no fabricated production metrics.
- Every Network table is organization-scoped and protected by RLS; privileged price/rule/rank/payout/compliance changes are audited.
- Public launch in a jurisdiction remains gated by authorized legal/compliance approval for the compensation plan, terms, disclosures, privacy, tax, KYC/payout, and marketing rules.
- Required final repository validation: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`; run `npm run verify:all` when the environment supports all existing repository verification dependencies.

---

## File Structure

Create the domain package:

- `packages/network/package.json` — workspace package metadata.
- `packages/network/src/types.ts` — public domain types and enums.
- `packages/network/src/money.ts` — integer-minor-unit and basis-point helpers.
- `packages/network/src/pricing.ts` — launch catalog and price-book validation.
- `packages/network/src/commissions.ts` — CNR, pool-cap, rule validation, and commission allocation.
- `packages/network/src/ranks.ts` — deterministic rank qualification.
- `packages/network/src/claims.ts` — Earnings Claims Guard domain rules.
- `packages/network/src/index.ts` — package exports.

Create persistence/governance:

- `supabase/migrations/20260916150000_atlas_network_core.sql` — Network tables, indexes, constraints, RLS, audit triggers, price seed.
- `supabase/migrations/20260916150500_atlas_network_governance.sql` — mutation RPCs, commission-event posting, reversals, rank overrides, payout state transitions, hard guards.

Create authenticated API boundary:

- `supabase/functions/atlas-network/index.ts` — operation router.
- `supabase/functions/atlas-network/_shared/context.ts` — authenticated Supabase client and organization/permission context.
- `supabase/functions/atlas-network/_shared/errors.ts` — safe public error model.
- `supabase/functions/atlas-network/_shared/repository.ts` — RLS-backed reads and RPC calls.

Create Business UI:

- `apps/web/src/modules/business/network/NetworkRoutes.tsx` — route graph.
- `apps/web/src/modules/business/network/NetworkHomePage.tsx` — truthful dashboard/empty states.
- `apps/web/src/modules/business/network/NetworkPartnersPage.tsx` — partner list/search/detail entry points.
- `apps/web/src/modules/business/network/NetworkPricingPage.tsx` — versioned launch price book view/admin boundary.
- `apps/web/src/modules/business/network/NetworkCommissionsPage.tsx` — CNR/commission ledger.
- `apps/web/src/modules/business/network/NetworkPayoutsPage.tsx` — payout lifecycle and provider boundary.
- `apps/web/src/modules/business/network/NetworkCompliancePage.tsx` — compliance events and earnings-claim checks.
- `apps/web/src/modules/business/network/NetworkAnalyticsPage.tsx` — data-backed metrics/empty states.
- `apps/web/src/modules/business/network/networkApi.ts` — browser-to-edge-function client.
- `apps/web/src/modules/business/network/network.css` — responsive module styles.
- Modify `apps/web/src/App.tsx` — mount `NetworkRoutes` and add Business card.
- Modify `apps/web/src/modules/registry.ts` only if a top-level module registry entry is required by current navigation behavior; otherwise keep Network nested under Business.

Create tests:

- `tests/unit/atlas-network-money.test.ts`
- `tests/unit/atlas-network-pricing.test.ts`
- `tests/unit/atlas-network-commissions.test.ts`
- `tests/unit/atlas-network-ranks.test.ts`
- `tests/unit/atlas-network-claims.test.ts`
- `tests/unit/atlas-network-ui.test.tsx`
- `tests/integration/atlas-network-schema.test.ts`
- `tests/integration/atlas-network-governance.test.ts`
- `tests/integration/atlas-network-api.test.ts`

---

### Task 1: Implement the deterministic Network financial domain

**Files:**
- Create: `packages/network/package.json`
- Create: `packages/network/src/types.ts`
- Create: `packages/network/src/money.ts`
- Create: `packages/network/src/pricing.ts`
- Create: `packages/network/src/commissions.ts`
- Create: `packages/network/src/index.ts`
- Test: `tests/unit/atlas-network-money.test.ts`
- Test: `tests/unit/atlas-network-pricing.test.ts`
- Test: `tests/unit/atlas-network-commissions.test.ts`

**Interfaces:**
- Produces: `applyBasisPoints(amountMinor: number, bps: number): number`
- Produces: `calculateCnrMinor(input: CnrInput): number`
- Produces: `calculateCommissionPoolCapMinor(input: CommissionPoolInput): number`
- Produces: `validateCommissionRules(rules: CommissionRule[], poolCapBps?: number): void`
- Produces: `calculateCommissionAllocation(input: CommissionAllocationInput): CommissionAllocation`
- Produces: `ATLAS_NETWORK_LAUNCH_PRICES: readonly NetworkLaunchPrice[]`
- Produces: `validatePriceBookEntry(entry: NetworkPriceBookEntry): void`

- [ ] **Step 1: Write failing money/CNR tests**

Create `tests/unit/atlas-network-money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyBasisPoints, calculateCnrMinor } from '../../packages/network/src';

describe('ATLAS Network money', () => {
  it('applies basis points using integer minor units', () => {
    expect(applyBasisPoints(10_000, 1200)).toBe(1_200);
    expect(applyBasisPoints(9_999, 150)).toBe(150);
  });

  it('preserves signed reversal values', () => {
    expect(applyBasisPoints(-10_000, 1200)).toBe(-1_200);
  });

  it('calculates commissionable net revenue exactly', () => {
    expect(calculateCnrMinor({
      cashCollectedMinor: 20_000,
      taxesMinor: 1_300,
      refundsMinor: 2_000,
      chargebacksMinor: 500,
      creditsMinor: 200,
      passThroughFeesMinor: 1_000
    })).toBe(15_000);
  });
});
```

- [ ] **Step 2: Run the money test and verify failure**

Run:

```bash
npm test -- tests/unit/atlas-network-money.test.ts
```

Expected: FAIL because `packages/network/src` does not exist.

- [ ] **Step 3: Implement package metadata, public types, and money helpers**

Create `packages/network/package.json`:

```json
{
  "name": "@atlas/network",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
```

Create `packages/network/src/types.ts` with these exact public contracts:

```ts
export type CurrencyCode = string;

export type CnrInput = {
  cashCollectedMinor: number;
  taxesMinor: number;
  refundsMinor: number;
  chargebacksMinor: number;
  creditsMinor: number;
  passThroughFeesMinor: number;
};

export type CommissionComponent = 'direct' | 'level2' | 'level3' | 'leadership' | 'campaign';

export type CommissionRule = {
  component: CommissionComponent;
  rateBps: number;
  qualified: boolean;
};

export type CommissionPoolInput = {
  cnrMinor: number;
  contributionMarginMinor: number;
  productCommissionCapBps?: number | null;
};

export type CommissionAllocationInput = CommissionPoolInput & {
  rules: readonly CommissionRule[];
};

export type CommissionAllocation = {
  cnrMinor: number;
  poolCapMinor: number;
  allocatedMinor: number;
  retainedMinor: number;
  components: Readonly<Record<CommissionComponent, number>>;
};

export type NetworkLaunchPrice = {
  sku: string;
  productName: string;
  billing: 'monthly' | 'annual' | 'enrollment';
  unit: 'user' | 'organization' | 'seat' | 'partner';
  amountMinor: number;
  currency: 'USD';
  floorPrice: boolean;
};

export type NetworkPriceBookEntry = {
  productKey: string;
  billingInterval: 'monthly' | 'annual' | 'enrollment';
  currency: CurrencyCode;
  amountMinor: number;
  baseUsdAmountMinor: number;
  commissionable: boolean;
  productCommissionCapBps?: number | null;
  taxCode: string;
};
```

Create `packages/network/src/money.ts`:

```ts
import type { CnrInput } from './types';

function assertSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
}

export function applyBasisPoints(amountMinor: number, bps: number): number {
  assertSafeInteger(amountMinor, 'amountMinor');
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new Error('bps must be an integer from 0 to 10000');
  const raw = amountMinor * bps / 10_000;
  return raw >= 0 ? Math.floor(raw + 0.5) : Math.ceil(raw - 0.5);
}

export function calculateCnrMinor(input: CnrInput): number {
  for (const [key, value] of Object.entries(input)) assertSafeInteger(value, key);
  return input.cashCollectedMinor - input.taxesMinor - input.refundsMinor - input.chargebacksMinor - input.creditsMinor - input.passThroughFeesMinor;
}
```

- [ ] **Step 4: Add failing launch-pricing tests**

Create `tests/unit/atlas-network-pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ATLAS_NETWORK_LAUNCH_PRICES, validatePriceBookEntry } from '../../packages/network/src';

describe('ATLAS Network launch pricing', () => {
  it('contains the approved launch prices', () => {
    const bySku = Object.fromEntries(ATLAS_NETWORK_LAUNCH_PRICES.map((price) => [price.sku, price]));
    expect(bySku['atlas-core-monthly'].amountMinor).toBe(2_900);
    expect(bySku['atlas-pro-monthly'].amountMinor).toBe(5_900);
    expect(bySku['atlas-business-monthly'].amountMinor).toBe(14_900);
    expect(bySku['atlas-enterprise-monthly'].amountMinor).toBe(99_900);
    expect(bySku['atlas-network-partner'].amountMinor).toBe(0);
    expect(bySku['atlas-enterprise-monthly'].floorPrice).toBe(true);
  });

  it('rejects invalid currency, negative price, and cap above 20 percent', () => {
    expect(() => validatePriceBookEntry({ productKey: 'x', billingInterval: 'monthly', currency: 'usd', amountMinor: 100, baseUsdAmountMinor: 100, commissionable: true, productCommissionCapBps: 2000, taxCode: 'standard' })).toThrow();
    expect(() => validatePriceBookEntry({ productKey: 'x', billingInterval: 'monthly', currency: 'USD', amountMinor: -1, baseUsdAmountMinor: 100, commissionable: true, taxCode: 'standard' })).toThrow();
    expect(() => validatePriceBookEntry({ productKey: 'x', billingInterval: 'monthly', currency: 'USD', amountMinor: 100, baseUsdAmountMinor: 100, commissionable: true, productCommissionCapBps: 2001, taxCode: 'standard' })).toThrow();
  });
});
```

- [ ] **Step 5: Implement approved price catalog and price validation**

Create `packages/network/src/pricing.ts` with the approved USD launch catalog, storing dollars as cents:

```ts
import type { NetworkLaunchPrice, NetworkPriceBookEntry } from './types';

export const ATLAS_NETWORK_LAUNCH_PRICES = [
  { sku: 'atlas-free', productName: 'ATLAS Free', billing: 'monthly', unit: 'user', amountMinor: 0, currency: 'USD', floorPrice: false },
  { sku: 'atlas-core-monthly', productName: 'ATLAS Core', billing: 'monthly', unit: 'user', amountMinor: 2900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-core-annual', productName: 'ATLAS Core', billing: 'annual', unit: 'user', amountMinor: 29000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-pro-monthly', productName: 'ATLAS Pro', billing: 'monthly', unit: 'user', amountMinor: 5900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-pro-annual', productName: 'ATLAS Pro', billing: 'annual', unit: 'user', amountMinor: 59000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-business-monthly', productName: 'ATLAS Business', billing: 'monthly', unit: 'organization', amountMinor: 14900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-business-annual', productName: 'ATLAS Business', billing: 'annual', unit: 'organization', amountMinor: 149000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-enterprise-monthly', productName: 'ATLAS Enterprise', billing: 'monthly', unit: 'organization', amountMinor: 99900, currency: 'USD', floorPrice: true },
  { sku: 'atlas-enterprise-annual', productName: 'ATLAS Enterprise', billing: 'annual', unit: 'organization', amountMinor: 999000, currency: 'USD', floorPrice: true },
  { sku: 'atlas-business-seat', productName: 'Business additional seat', billing: 'monthly', unit: 'seat', amountMinor: 3900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-business-seat-annual', productName: 'Business additional seat', billing: 'annual', unit: 'seat', amountMinor: 39000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-enterprise-seat', productName: 'Enterprise additional seat', billing: 'monthly', unit: 'seat', amountMinor: 2900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-enterprise-seat-annual', productName: 'Enterprise additional seat', billing: 'annual', unit: 'seat', amountMinor: 29000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-network-partner', productName: 'ATLAS Network Partner', billing: 'enrollment', unit: 'partner', amountMinor: 0, currency: 'USD', floorPrice: false }
] as const satisfies readonly NetworkLaunchPrice[];

export function validatePriceBookEntry(entry: NetworkPriceBookEntry): void {
  if (!/^[A-Z]{3}$/.test(entry.currency)) throw new Error('currency must be an uppercase ISO-style three-letter code');
  if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor < 0) throw new Error('amountMinor must be a non-negative safe integer');
  if (!Number.isSafeInteger(entry.baseUsdAmountMinor) || entry.baseUsdAmountMinor < 0) throw new Error('baseUsdAmountMinor must be a non-negative safe integer');
  if (entry.productCommissionCapBps != null && (!Number.isInteger(entry.productCommissionCapBps) || entry.productCommissionCapBps < 0 || entry.productCommissionCapBps > 2000)) throw new Error('product commission cap must be between 0 and 2000 bps');
  if (!entry.productKey.trim() || !entry.taxCode.trim()) throw new Error('productKey and taxCode are required');
}
```

- [ ] **Step 6: Add failing commission-engine tests**

Create `tests/unit/atlas-network-commissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateCommissionAllocation, calculateCommissionPoolCapMinor, validateCommissionRules } from '../../packages/network/src';

const launchRules = [
  { component: 'direct', rateBps: 1200, qualified: true },
  { component: 'level2', rateBps: 300, qualified: true },
  { component: 'level3', rateBps: 150, qualified: true },
  { component: 'leadership', rateBps: 150, qualified: true },
  { component: 'campaign', rateBps: 200, qualified: true }
] as const;

describe('ATLAS Network commission engine', () => {
  it('uses the lower of 20% CNR or 35% contribution margin', () => {
    expect(calculateCommissionPoolCapMinor({ cnrMinor: 100_000, contributionMarginMinor: 40_000 })).toBe(14_000);
    expect(calculateCommissionPoolCapMinor({ cnrMinor: 100_000, contributionMarginMinor: 100_000 })).toBe(20_000);
  });

  it('rejects aggregate rules above 20 percent', () => {
    expect(() => validateCommissionRules([...launchRules, { component: 'campaign', rateBps: 1, qualified: true }])).toThrow();
  });

  it('constrains actual allocation to the margin-funded pool', () => {
    const allocation = calculateCommissionAllocation({ cnrMinor: 100_000, contributionMarginMinor: 40_000, rules: launchRules });
    expect(allocation.poolCapMinor).toBe(14_000);
    expect(allocation.allocatedMinor).toBe(14_000);
    expect(Object.values(allocation.components).reduce((sum, amount) => sum + amount, 0)).toBe(14_000);
  });

  it('does not redistribute unqualified components', () => {
    const rules = launchRules.map((rule) => rule.component === 'campaign' ? { ...rule, qualified: false } : rule);
    const allocation = calculateCommissionAllocation({ cnrMinor: 100_000, contributionMarginMinor: 100_000, rules });
    expect(allocation.components.campaign).toBe(0);
    expect(allocation.allocatedMinor).toBe(18_000);
    expect(allocation.retainedMinor).toBe(2_000);
  });
});
```

- [ ] **Step 7: Implement commission allocation**

Create `packages/network/src/commissions.ts` using `applyBasisPoints`. `validateCommissionRules` must reject duplicate components, negative/non-integer rates, and an aggregate rate above 2000 bps. `calculateCommissionPoolCapMinor` must return zero for non-positive CNR or non-positive contribution margin and otherwise calculate:

```ts
const revenueCap = applyBasisPoints(cnrMinor, Math.min(2000, productCommissionCapBps ?? 2000));
const marginCap = applyBasisPoints(contributionMarginMinor, 3500);
return Math.max(0, Math.min(revenueCap, marginCap));
```

For qualifying rules, calculate nominal component amounts with `applyBasisPoints(cnrMinor, rateBps)`. If their sum exceeds the pool cap, scale each qualifying component by `poolCap / nominalTotal`, round deterministically to minor units, and assign any one-cent rounding remainder in this order: `direct`, `level2`, `level3`, `leadership`, `campaign`, without ever exceeding the pool cap. Unqualified components are zero and their unused share is retained by the company.

- [ ] **Step 8: Export package and run unit tests**

Create `packages/network/src/index.ts`:

```ts
export * from './types';
export * from './money';
export * from './pricing';
export * from './commissions';
```

Run:

```bash
npm test -- tests/unit/atlas-network-money.test.ts tests/unit/atlas-network-pricing.test.ts tests/unit/atlas-network-commissions.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/network tests/unit/atlas-network-money.test.ts tests/unit/atlas-network-pricing.test.ts tests/unit/atlas-network-commissions.test.ts
git commit -m "feat(network): add pricing and commission domain"
```

---

### Task 2: Create the organization-scoped Network persistence model

**Files:**
- Create: `supabase/migrations/20260916150000_atlas_network_core.sql`
- Test: `tests/integration/atlas-network-schema.test.ts`

**Interfaces:**
- Consumes: existing `public.organizations(id)`, `auth.users(id)`, `public.is_org_member(uuid)`, `public.has_identity_permission(uuid,text)`, `public.audit_row_change()`.
- Produces tables: `network_partners`, `network_referral_links`, `network_attributions`, `network_price_books`, `network_product_prices`, `network_commission_rules`, `network_commission_events`, `network_payout_batches`, `network_partner_rank_history`, `network_compliance_events`.

- [ ] **Step 1: Write schema-presence and security tests**

Create `tests/integration/atlas-network-schema.test.ts` that reads the migration as text and asserts the migration contains all ten table declarations, `enable row level security` for each table, `org_id uuid not null references public.organizations(id)`, audit triggers for privileged/mutable tables, and these checks:

```ts
expect(sql).toContain("check (pool_cap_bps between 0 and 2000)");
expect(sql).toContain("check (margin_cap_bps between 0 and 3500)");
expect(sql).toContain("check (currency ~ '^[A-Z]{3}$')");
expect(sql).toContain("create policy network_partners_read");
expect(sql).toContain("public.is_org_member(org_id)");
expect(sql).toContain("public.has_identity_permission(org_id,'network.partners.manage')");
```

- [ ] **Step 2: Run schema test and verify failure**

```bash
npm test -- tests/integration/atlas-network-schema.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create core schema with hard database constraints**

In `20260916150000_atlas_network_core.sql`, use `org_id` to match existing accounting conventions. Required constraints include:

```sql
create table if not exists public.network_partners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_code text not null,
  status text not null default 'active' check (status in ('pending','active','held','suspended','closed')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  payout_currency text not null check (payout_currency ~ '^[A-Z]{3}$'),
  sponsor_partner_id uuid references public.network_partners(id) on delete set null,
  current_rank text not null default 'partner' check (current_rank in ('partner','builder','leader','director','global_ambassador')),
  compliance_status text not null default 'clear' check (compliance_status in ('clear','review','held','restricted')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id),
  unique (org_id, partner_code)
);
```

All monetary columns use `bigint` minor units. `network_commission_events` must contain `source_transaction_id text not null`, `source_line_id text not null`, `rule_id uuid not null`, signed `cnr_amount_minor bigint not null`, signed `commission_amount_minor bigint not null`, `commission_rate_bps integer not null check (...)`, `status` constrained to `estimated|pending|available|held|paid|reversed`, `reversal_of_event_id`, and a unique idempotency constraint over organization/source line/partner/component/rule/reversal identity.

`network_product_prices` must persist local amount, base USD amount, commissionability, product cap, tax code, and captured price-book version. `network_attributions` must preserve policy version and `evidence_json jsonb not null default '{}'::jsonb`.

- [ ] **Step 4: Seed the approved USD launch price book idempotently**

Insert a single active `GLOBAL-USD-LAUNCH-V1` book per organization only through an admin RPC in Task 3; do **not** insert rows for every organization globally from the migration. The migration may define a reusable immutable JSON constant in SQL comments/tests, but organization-specific rows are created on demand by the authorized bootstrap RPC.

- [ ] **Step 5: Add RLS and audit triggers**

For every table:

```sql
alter table public.<table> enable row level security;
```

Read policies use `public.is_org_member(org_id)` except partner-sensitive data where the select predicate is additionally limited to self or a privileged permission. Writes must use the exact permission relevant to the operation. Do not grant broad browser `insert/update/delete` on commission events or payout settlement state; those mutations happen through guarded RPCs in Task 3.

Attach:

```sql
create trigger <table>_audit
after insert or update or delete on public.<table>
for each row execute function public.audit_row_change();
```

to price books/prices, commission rules/events, payout batches, rank history, and compliance events.

- [ ] **Step 6: Run schema test**

```bash
npm test -- tests/integration/atlas-network-schema.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add supabase/migrations/20260916150000_atlas_network_core.sql tests/integration/atlas-network-schema.test.ts
git commit -m "feat(network): add governed persistence schema"
```

---

### Task 3: Add guarded RPCs for pricing, commissions, ranks, and payouts

**Files:**
- Create: `supabase/migrations/20260916150500_atlas_network_governance.sql`
- Test: `tests/integration/atlas-network-governance.test.ts`

**Interfaces:**
- Produces RPC: `bootstrap_network_launch_price_book(organization_uuid uuid)`
- Produces RPC: `create_network_partner(organization_uuid uuid, country_code_value text, payout_currency_value text, sponsor_partner_uuid uuid)`
- Produces RPC: `post_network_commission_event(...)`
- Produces RPC: `reverse_network_commission_event(event_uuid uuid, reason_value text)`
- Produces RPC: `override_network_partner_rank(...)`
- Produces RPC: `transition_network_payout_batch(batch_uuid uuid, next_status text, provider_reference_value text)`
- Produces RPC: `record_network_compliance_event(...)`

- [ ] **Step 1: Write governance migration tests**

Create a text-level migration test asserting each RPC exists and contains authorization checks. Minimum assertions:

```ts
expect(sql).toContain("has_identity_permission(organization_uuid,'network.pricing.manage')");
expect(sql).toContain("has_identity_permission(organization_uuid,'network.commissions.manage_rules')");
expect(sql).toContain("has_identity_permission(organization_uuid,'network.payouts.approve')");
expect(sql).toContain("has_identity_permission(organization_uuid,'network.compliance.manage')");
expect(sql).toContain("Authentication required");
expect(sql).toContain("Recruitment alone is not commissionable");
expect(sql).toContain("Paid status requires settlement evidence");
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/integration/atlas-network-governance.test.ts
```

- [ ] **Step 3: Implement bootstrap pricing RPC**

The RPC must require `network.pricing.manage`, create one versioned active USD launch price book for the organization, and upsert the exact approved SKUs/amounts from Task 1. It must create `atlas-network-partner` at zero price and mark enrollment noncommissionable.

- [ ] **Step 4: Implement partner enrollment guard**

`create_network_partner` requires authentication and organization membership. It creates no invoice, no fee, no commission event, and no rank credit. If a sponsor is supplied, verify sponsor and new partner share the organization and reject self-sponsorship/cycles detectable from the current sponsor chain.

- [ ] **Step 5: Implement commission posting and reversal guards**

`post_network_commission_event` must require a verified source transaction/line identifier, rule version, captured CNR, contribution margin, and component. It must reject component rates above their launch maximum unless a future rule version explicitly lowers them; it must never exceed the calculated pool cap. It must be idempotent on the source/partner/component/rule key.

`reverse_network_commission_event` never edits the original event. It creates a signed reversing row linked by `reversal_of_event_id` and requires a non-empty reason.

- [ ] **Step 6: Implement payout lifecycle guard**

Allow only:

```text
accruing -> pending_review -> approved -> processing -> paid
pending_review -> held
approved -> held
processing -> failed
held -> pending_review
failed -> approved
approved|processing -> cancelled (only before settlement)
paid -> reversed (only with settlement reversal evidence)
```

Require `network.payouts.approve` for approval/hold/release/cancel actions. Require non-empty `provider_reference_value` or accounting settlement reference when moving to `paid`. Reject direct `accruing -> paid` and all fabricated settlement transitions.

- [ ] **Step 7: Implement rank override/compliance RPCs**

Manual rank override requires `network.compliance.manage` or an explicitly stronger Network admin permission, reason code, effective date, and history insertion. Compliance-event creation never deletes old evidence and can place payout batches/partner status on hold without asserting fraud as fact.

- [ ] **Step 8: Run governance tests and commit**

```bash
npm test -- tests/integration/atlas-network-governance.test.ts

git add supabase/migrations/20260916150500_atlas_network_governance.sql tests/integration/atlas-network-governance.test.ts
git commit -m "feat(network): add commission and payout governance"
```

---

### Task 4: Implement rank qualification and Earnings Claims Guard

**Files:**
- Create: `packages/network/src/ranks.ts`
- Create: `packages/network/src/claims.ts`
- Modify: `packages/network/src/index.ts`
- Test: `tests/unit/atlas-network-ranks.test.ts`
- Test: `tests/unit/atlas-network-claims.test.ts`

**Interfaces:**
- Produces: `qualifyPartnerRank(input: RankQualificationInput): PartnerRank`
- Produces: `evaluateEarningsClaim(input: EarningsClaimInput): EarningsClaimDecision`

- [ ] **Step 1: Write rank tests**

Use a versioned launch policy that never includes personal purchase volume. Tests must prove that a partner cannot qualify by self-purchases alone and that compliance status `held|restricted` prevents advancement.

Example expectation:

```ts
expect(qualifyPartnerRank({ activeThirdPartyCustomers: 0, trailingCnrMinor: 1_000_000, retentionBps: 10_000, chargebackBps: 0, complianceStatus: 'clear', qualifiedOrganizationDepth: 0 })).toBe('partner');
```

Define launch thresholds in code as conservative operational thresholds, clearly labeled `ATLAS_NETWORK_LAUNCH_RANK_POLICY_V1`, so they can be versioned later:

```ts
partner: 0 customers / 0 CNR
builder: 5 active third-party customers / $500 trailing CNR / 70% retention
leader: 20 customers / $2,500 CNR / 75% retention / depth 1
director: 75 customers / $10,000 CNR / 80% retention / depth 2
global_ambassador: 250 customers / $50,000 CNR / 85% retention / depth 3
```

Use minor USD reference units for this launch policy and document that regional qualification policy changes require a new version.

- [ ] **Step 2: Implement deterministic rank policy**

Rank evaluation chooses the highest fully satisfied rank. Chargeback rate must be <= 500 bps for `builder`, <= 400 for `leader`, <= 300 for `director`, <= 250 for `global_ambassador`. A non-clear compliance status caps the result at `partner`.

- [ ] **Step 3: Write Earnings Claims Guard tests**

Test at minimum:

```ts
expect(evaluateEarningsClaim({ text: 'Join today and earn $10,000 every month guaranteed', evidenceAvailable: false, approvedTemplate: false }).allowed).toBe(false);
expect(evaluateEarningsClaim({ text: 'Commissions vary and are based on verified customer sales. See the current earnings disclosure.', evidenceAvailable: true, approvedTemplate: true }).allowed).toBe(true);
```

- [ ] **Step 4: Implement claims guard**

Block guaranteed-income language, unsupported numeric earnings/lifestyle claims, and content lacking an approved template when it contains earnings representations. Return structured reasons such as `guaranteed_income`, `unsupported_numeric_claim`, `missing_disclosure`, `evidence_unavailable`. Do not attempt to determine legal compliance; return `requiresComplianceReview: true` for jurisdiction-sensitive claims.

- [ ] **Step 5: Export, test, and commit**

```bash
npm test -- tests/unit/atlas-network-ranks.test.ts tests/unit/atlas-network-claims.test.ts

git add packages/network/src/ranks.ts packages/network/src/claims.ts packages/network/src/index.ts tests/unit/atlas-network-ranks.test.ts tests/unit/atlas-network-claims.test.ts
git commit -m "feat(network): add rank and earnings claim controls"
```

---

### Task 5: Build the authenticated `atlas-network` edge API

**Files:**
- Create: `supabase/functions/atlas-network/index.ts`
- Create: `supabase/functions/atlas-network/_shared/context.ts`
- Create: `supabase/functions/atlas-network/_shared/errors.ts`
- Create: `supabase/functions/atlas-network/_shared/repository.ts`
- Test: `tests/integration/atlas-network-api.test.ts`

**Interfaces:**
- Consumes RPCs from Task 3.
- Produces authenticated JSON operations: `summary`, `partners.list`, `partner.enroll`, `pricing.list`, `pricing.bootstrap`, `commissions.list`, `payouts.list`, `payouts.transition`, `compliance.list`, `compliance.record`, `claim.evaluate`, `analytics.summary`.

- [ ] **Step 1: Write API contract tests**

Verify the edge source:

- requires `Authorization` header;
- uses a user-scoped Supabase client for ordinary requests;
- never returns service-role credentials;
- allowlists operation names;
- returns `401` for no auth, `403` for permission failures, `400` for invalid payloads, and `500` with a safe generic message for unexpected failures;
- does not expose raw Postgres error details to clients.

- [ ] **Step 2: Implement request context**

Follow the repository's existing edge-function pattern:

```ts
const authorization = req.headers.get('authorization') || '';
const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { authorization } }
});
```

Resolve the current user through the client and require an explicit `organization_id` in the request body. RLS remains the primary data barrier; API permission checks are defense in depth.

- [ ] **Step 3: Implement repository methods**

Read methods query only Network tables for the supplied organization and use pagination limits. Mutation methods call the guarded RPCs; do not reproduce sensitive state-transition logic in TypeScript.

- [ ] **Step 4: Implement claim evaluation operation**

`claim.evaluate` imports `evaluateEarningsClaim` from `packages/network/src` and returns the decision without publishing content automatically. A blocked result remains blocked until compliant evidence/template conditions are met.

- [ ] **Step 5: Test and commit**

```bash
npm test -- tests/integration/atlas-network-api.test.ts

git add supabase/functions/atlas-network tests/integration/atlas-network-api.test.ts
git commit -m "feat(network): add authenticated network API"
```

---

### Task 6: Mount ATLAS Network inside Business and implement truthful UI states

**Files:**
- Create: `apps/web/src/modules/business/network/NetworkRoutes.tsx`
- Create: `apps/web/src/modules/business/network/NetworkHomePage.tsx`
- Create: `apps/web/src/modules/business/network/NetworkPartnersPage.tsx`
- Create: `apps/web/src/modules/business/network/NetworkPricingPage.tsx`
- Create: `apps/web/src/modules/business/network/NetworkCommissionsPage.tsx`
- Create: `apps/web/src/modules/business/network/NetworkPayoutsPage.tsx`
- Create: `apps/web/src/modules/business/network/NetworkCompliancePage.tsx`
- Create: `apps/web/src/modules/business/network/NetworkAnalyticsPage.tsx`
- Create: `apps/web/src/modules/business/network/networkApi.ts`
- Create: `apps/web/src/modules/business/network/network.css`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/unit/atlas-network-ui.test.tsx`

**Interfaces:**
- Browser API call: `networkRequest<T>(operation: NetworkOperation, organizationId: string, payload?: Record<string, unknown>): Promise<T>`.
- Route base: `/business/network`.

- [ ] **Step 1: Write route/UI tests**

Using `MemoryRouter`, assert:

- Business Home contains an enabled `ATLAS Network` card to `/business/network`;
- `/business/network` exposes links to Customers, Partners, Referrals, Pricing, Commissions, Payouts, Ranks, Compliance, Analytics;
- loading, empty, error, and configured data states are distinguishable;
- payout UI never renders `Paid` from an estimated/pending row;
- partner enrollment copy shows `$0`/free and contains no recruiting-income promise.

- [ ] **Step 2: Implement `networkApi.ts`**

Use the existing environment/provider conventions. The client must fail closed when Supabase function configuration/session is unavailable and surface a configuration state rather than fake data.

- [ ] **Step 3: Implement `NetworkRoutes.tsx`**

Follow the existing `CrmRoutes` pattern and mount these exact routes:

```tsx
<Route path="/business/network" element={<NetworkHomePage />} />
<Route path="/business/network/customers" element={<NetworkPartnersPage mode="customers" />} />
<Route path="/business/network/partners" element={<NetworkPartnersPage mode="partners" />} />
<Route path="/business/network/referrals" element={<NetworkPartnersPage mode="referrals" />} />
<Route path="/business/network/pricing" element={<NetworkPricingPage />} />
<Route path="/business/network/commissions" element={<NetworkCommissionsPage />} />
<Route path="/business/network/payouts" element={<NetworkPayoutsPage />} />
<Route path="/business/network/ranks" element={<NetworkPartnersPage mode="ranks" />} />
<Route path="/business/network/compliance" element={<NetworkCompliancePage />} />
<Route path="/business/network/analytics" element={<NetworkAnalyticsPage />} />
```

If customers/referrals/ranks need distinct pages during implementation because the shared page becomes unclear, split them without changing route contracts.

- [ ] **Step 4: Integrate into `App.tsx`**

Import `NetworkRoutes`, render it in the application route tree under the same authentication boundary used for sensitive Business modules, and add this card to `BusinessHome`:

```tsx
<Link className="module-card enabled" to="/business/network">
  <span>Growth · Distribution</span>
  <strong>ATLAS Network</strong>
  <p>Governed customer referrals, pricing, commissions, partner operations and compliance.</p>
</Link>
```

- [ ] **Step 5: Implement pages with real states**

Each page must have:

- `loading`: request in progress;
- `empty`: no rows/configuration;
- `error`: actionable failure text without invented values;
- `success`: API-backed rows only.

Pricing shows launch USD amounts from API/database, not a duplicated hardcoded browser catalog after backend integration. Analytics renders metrics only when returned from source data. Payouts distinguish estimated/pending/available/held/paid/reversed.

- [ ] **Step 6: Implement responsive CSS**

Use existing ATLAS visual primitives/classes where possible. Add module-specific layout only for Network tables, status chips, filters, breadcrumbs, mobile card/table fallback, and action bars. Verify usable widths at desktop, tablet, and mobile breakpoints; no horizontal-only workflow may be required for core actions.

- [ ] **Step 7: Run UI tests and commit**

```bash
npm test -- tests/unit/atlas-network-ui.test.tsx

git add apps/web/src/modules/business/network apps/web/src/App.tsx tests/unit/atlas-network-ui.test.tsx
git commit -m "feat(network): add Business Network workspace"
```

---

### Task 7: Connect Network liabilities to Accounting and preserve the real payout boundary

**Files:**
- Modify or extend through new migration: `supabase/migrations/20260916151000_atlas_network_accounting.sql`
- Test: `tests/integration/atlas-network-accounting.test.ts`
- Modify if required: `packages/network/src/types.ts`

**Interfaces:**
- Produces RPC: `post_network_commission_liability(event_uuid uuid, expense_account_uuid uuid, payable_account_uuid uuid, entity_uuid uuid)`
- Produces RPC: `settle_network_payout_accounting(batch_uuid uuid, cash_account_uuid uuid, payable_account_uuid uuid, entity_uuid uuid, settlement_reference text)`

- [ ] **Step 1: Write accounting-boundary tests**

Assert the migration:

- checks `accounting.post` before creating journal entries;
- rejects closed/locked accounting periods using the same accounting period controls already present in the repository;
- posts equal debit/credit amounts;
- records Network source identifiers on the accounting linkage record;
- cannot settle a batch without a non-empty settlement reference;
- never marks the Network payout `paid` merely because a journal draft exists.

- [ ] **Step 2: Create a Network-to-accounting link table**

Create `network_accounting_links` with `org_id`, `commission_event_id` or `payout_batch_id`, `journal_entry_id`, `link_type`, `created_by`, timestamps, and uniqueness preventing duplicate posting.

- [ ] **Step 3: Post commission liability**

After a commission becomes financially eligible, the RPC creates a balanced posted journal using existing accounting primitives:

```text
Dr Commission Expense
Cr Partner Commission Payable
```

The amount is the signed eligible commission amount in the entity functional currency using a registered/captured FX path when required. Do not invent an FX rate.

- [ ] **Step 4: Post payout settlement**

Only after real settlement evidence exists:

```text
Dr Partner Commission Payable
Cr Cash / Settlement Clearing
```

Provider fees and FX gain/loss remain separate journal lines/accounts and must not be hidden inside commission expense.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/integration/atlas-network-accounting.test.ts

git add supabase/migrations/20260916151000_atlas_network_accounting.sql tests/integration/atlas-network-accounting.test.ts packages/network/src/types.ts
git commit -m "feat(network): integrate commission liabilities with accounting"
```

---

### Task 8: Add end-to-end economic invariants and regression verification

**Files:**
- Create: `tests/integration/atlas-network-economic-invariants.test.ts`
- Modify only if failures reveal implementation defects in Task 1-7 files.

**Interfaces:**
- Verifies the complete model without requiring a live payout provider.

- [ ] **Step 1: Add economic invariant tests**

Cover these cases with deterministic fixtures:

1. A `$100.00` CNR sale with sufficient margin and all launch components qualifying can allocate at most `$20.00`.
2. The same sale with `$40.00` contribution margin allocates at most `$14.00`.
3. A noncommissionable SKU generates zero commission.
4. Partner enrollment generates zero commission and zero rank production.
5. A refund creates a reversing commission event linked to the original event rather than editing it.
6. A chargeback after payout creates an offset/reversal path rather than deleting history.
7. A local-currency sale preserves the captured FX record and does not recalculate historical commission from a new rate.
8. Cross-organization reads/writes are rejected by RLS/permission predicates.
9. Duplicate commission source keys are idempotent.
10. `paid` payout status is impossible without settlement evidence.
11. Blocked earnings claims cannot be published through ATLAS tooling.
12. No UI analytics test relies on fabricated sample production metrics.

- [ ] **Step 2: Run Network-focused test suite**

```bash
npm test -- tests/unit/atlas-network-money.test.ts tests/unit/atlas-network-pricing.test.ts tests/unit/atlas-network-commissions.test.ts tests/unit/atlas-network-ranks.test.ts tests/unit/atlas-network-claims.test.ts tests/unit/atlas-network-ui.test.tsx tests/integration/atlas-network-schema.test.ts tests/integration/atlas-network-governance.test.ts tests/integration/atlas-network-api.test.ts tests/integration/atlas-network-accounting.test.ts tests/integration/atlas-network-economic-invariants.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run repository-wide validation**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: all PASS. If the environment supports all external/system verification dependencies, additionally run:

```bash
npm run verify:all
```

Do not claim production-ready status if any required command fails.

- [ ] **Step 4: Perform route and state verification**

Verify at minimum:

```text
/business/network
/business/network/customers
/business/network/partners
/business/network/referrals
/business/network/pricing
/business/network/commissions
/business/network/payouts
/business/network/ranks
/business/network/compliance
/business/network/analytics
```

For each, verify no 404/500, authentication boundary, back navigation, desktop/tablet/mobile layout, loading/empty/error/success states, and permission-denied behavior.

- [ ] **Step 5: Security and truthfulness review**

Search the diff for:

```text
href="#"
console.log(
Coming Soon
SUPABASE_SERVICE_ROLE_KEY
sk-
paid: true
Math.random(
```

Review every match. Secrets must not be committed. `Coming Soon`/fake placeholders must not substitute buildable functionality. Random/demo values must never appear as production metrics. Service-role usage is prohibited in the browser and must be narrowly justified if used in an edge function.

- [ ] **Step 6: Commit verification additions**

```bash
git add tests/integration/atlas-network-economic-invariants.test.ts
git commit -m "test(network): enforce economic and governance invariants"
```

---

## Implementation Order and Review Gates

Execute Tasks 1 through 8 in order. Each task is independently reviewable and should not be merged forward when its focused tests fail.

The first production-capable release is still gated after code completion by:

1. a configured Supabase environment with the Network migrations applied;
2. authorized organization identity/RBAC assignments;
3. real commerce/payment source integration producing collected revenue and refund/chargeback evidence;
4. configured accounting accounts/entity/period controls;
5. a real payout provider or accounting settlement source before any payout can become `paid`;
6. legal/compliance approval for each launch jurisdiction;
7. verified earnings disclosure data before numeric income representations are allowed.

Until those dependencies exist, the UI must expose truthful configuration states and the implementation stops at the real dependency boundary.
