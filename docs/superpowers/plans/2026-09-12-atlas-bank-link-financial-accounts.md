# ATLAS Bank Link + Financial Accounts Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real ATLAS Bank Link milestone: a provider-agnostic Financial Accounts Core, Plaid sandbox adapter, secure account connection lifecycle, normalized transaction synchronization, Bank & Cash UI, reconciliation assistance, RBAC, RLS, and audit evidence without exposing provider secrets or implying production banking capabilities that are not verified.

**Architecture:** Add a reusable `@atlas/financial-accounts` domain package independent from Accounting and ATLAS Pay. Reuse ATLAS Core tenancy/authorization/audit primitives, Supabase Auth/Postgres/RLS/Edge Function patterns, and the existing Finance shell. The browser talks only to ATLAS/Supabase; provider-specific tokens and calls remain server-side behind a Plaid adapter and normalized repository contracts.

**Tech Stack:** React 18, React Router 7, TypeScript 5.7, Vite 6, Vitest 3, Supabase Auth/Postgres/RLS/Edge Functions, Deno, Plaid Link/Transactions sandbox API, existing ATLAS shell and `authorizedAtlasFetch` client pattern.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-bank-link-financial-accounts-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implementation branch: `feat/atlas-bank-link-financial-accounts`.
- Production-stable branch `main` is not modified directly.
- Do not merge or deploy as part of plan execution unless separately approved after verification.
- Do not enable Plaid production or incur provider charges without explicit user approval.
- Phase 1 and Phase 2 end at Financial Core + Plaid Sandbox validation.
- `accounting_bank_accounts` remains the Accounting-visible bank/cash registry; do not create a competing Accounting bank-account source of truth.
- Financial Accounts Core must support future `atlas_virtual` accounts without claiming that ATLAS is currently a bank.
- ATLAS Finance/Accounting owns accounting representation and reconciliation; Bank Link owns external connectivity; ATLAS Pay owns future money movement.
- No access token, client secret, public-token exchange result, bank credential, routing/account number, or other provider secret may be returned to browser code, committed to Git, or written to user-facing audit payloads.
- A UI state may say `Connected` only after persisted backend verification of the provider connection, account binding, tenant/org scope, and non-fatal provider state.
- A provider outage with valid authorization becomes degraded/sync-delayed, not falsely disconnected.
- Reauthentication preserves historical transactions, completed reconciliations, and ledger evidence.
- Disconnect stops future synchronization but does not delete posted accounting history.
- Banking permissions are separate from Accounting permissions.
- Every financial persistence operation is explicitly organization-scoped; service-role code must still include an `org_id` filter.
- Every webhook and transaction sync path must be idempotent.
- No AI recommendation may silently post or create a ledger entry requiring authorization.
- Desktop, tablet, and mobile states are required for the implemented Bank & Cash surfaces.
- Existing Payables, Payroll, Health, Hospitality, Identity, and shell routes must remain green.
- Completion verification runs: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build`.

---

## File Structure

Create or modify these focused units:

- `packages/financial-accounts/package.json` — workspace package metadata.
- `packages/financial-accounts/src/types.ts` — normalized account, connection, transaction, sync, webhook, provider, and reconciliation types.
- `packages/financial-accounts/src/state.ts` — connection state-machine rules and truthful `Connected` predicate.
- `packages/financial-accounts/src/provider.ts` — provider-agnostic adapter interface and provider error/result contracts.
- `packages/financial-accounts/src/plaid.ts` — pure Plaid response normalization and idempotency helpers; no secrets/environment reads.
- `packages/financial-accounts/src/sync.ts` — transaction-delta merge and deduplication rules.
- `packages/financial-accounts/src/matching.ts` — deterministic reconciliation candidate scoring/classification.
- `packages/financial-accounts/src/index.ts` — public exports.
- `packages/core/src/permissions.ts` — add Banking/Payments permission vocabulary to `AtlasPermission`.
- `supabase/migrations/20260912_financial_accounts_core.sql` — bank-account registry, connections, transactions, sync runs, webhook events, reconciliation items, indexes, constraints, and RLS.
- `supabase/functions/atlas-financial-connections/_shared/context.ts` — authenticated user/org/permission context.
- `supabase/functions/atlas-financial-connections/_shared/errors.ts` — safe error normalization and CORS.
- `supabase/functions/atlas-financial-connections/_shared/repository.ts` — organization-scoped persistence/audit helpers.
- `supabase/functions/atlas-financial-connections/_shared/secret-store.ts` — opaque provider-secret reference storage boundary; no secret values returned from functions.
- `supabase/functions/atlas-financial-connections/providers/plaid.ts` — Plaid HTTP adapter using server-side secrets.
- `supabase/functions/atlas-financial-connections/index.ts` — authenticated `accounts`, `create-link`, `exchange`, `sync`, `reconnect`, `disconnect`, and `audit` request router.
- `supabase/functions/atlas-financial-webhooks/index.ts` — unauthenticated provider webhook ingress with provider validation/idempotency and no browser CORS surface.
- `apps/web/src/lib/financialAccountsApi.ts` — typed browser client using existing ATLAS session behavior.
- `apps/web/src/modules/finance/accounting/BankCashPage.tsx` — Bank & Cash account workspace.
- `apps/web/src/modules/finance/accounting/BankAccountDetailPage.tsx` — account detail, connection state, transactions, and settings actions.
- `apps/web/src/modules/finance/accounting/ReconciliationPage.tsx` — transaction-to-book matching workspace for the implemented slice.
- `apps/web/src/modules/finance/accounting/bank-cash.css` — responsive module styles.
- `apps/web/src/App.tsx` — activate Bank & Cash and Reconciliation routes and Finance/Accounting links.
- `apps/web/src/components/AtlasShell.tsx` — add Bank & Cash navigation entry without duplicating Finance.
- `apps/web/src/main.tsx` — import Bank & Cash styles.
- `tests/unit/financial-accounts-domain.test.ts` — normalized domain/state tests.
- `tests/unit/financial-accounts-sync.test.ts` — transaction dedupe/pending-posted/removal tests.
- `tests/unit/financial-accounts-matching.test.ts` — reconciliation classification tests.
- `tests/unit/core-banking-permissions.test.ts` — permission/admin/scope authorization tests.
- `tests/integration/financial-accounts-schema-contract.test.ts` — migration/RLS/secret-boundary static contract.
- `tests/integration/financial-connections-edge-contract.test.ts` — authenticated Edge Function behavior contract.
- `tests/integration/financial-webhook-contract.test.ts` — webhook verification/idempotency contract.
- `tests/integration/bank-cash-routes.test.tsx` — shell/navigation/state/action UI tests.
- `tests/integration/financial-security-contract.test.ts` — browser/server secret-leak regression scan.

---

### Task 1: Add the Financial Accounts domain and banking permissions

**Files:**
- Create: `packages/financial-accounts/package.json`
- Create: `packages/financial-accounts/src/types.ts`
- Create: `packages/financial-accounts/src/state.ts`
- Create: `packages/financial-accounts/src/provider.ts`
- Create: `packages/financial-accounts/src/index.ts`
- Modify: `packages/core/src/permissions.ts`
- Create: `tests/unit/financial-accounts-domain.test.ts`
- Create: `tests/unit/core-banking-permissions.test.ts`

**Interfaces:**
- Produces `FinancialAccountOrigin`, `FinancialConnectionState`, `FinancialAccount`, `FinancialConnection`, `FinancialTransaction`, `FinancialSyncRun`, `FinancialWebhookEvent`, `FinancialConnectionProvider`, and `ProviderSyncDelta`.
- Produces `canTransitionConnection(from, to)` and `isVerifiedConnected(connection, account)`.
- Extends `AtlasPermission` with `BankingPermission` and `PaymentsPermission`.

- [ ] **Step 1: Write failing domain/state tests**

Create `tests/unit/financial-accounts-domain.test.ts` with assertions equivalent to:

```ts
import { describe, expect, it } from 'vitest';
import {
  CONNECTION_STATES,
  canTransitionConnection,
  isVerifiedConnected,
  type FinancialAccount,
  type FinancialConnection
} from '../../packages/financial-accounts/src';

const baseConnection: FinancialConnection = {
  id: 'conn-1',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  provider: 'plaid',
  providerConnectionRef: 'item-ref-1',
  status: 'connected',
  consentGrantedAt: '2026-09-12T12:00:00.000Z',
  consentExpiresAt: null,
  lastVerifiedAt: '2026-09-12T12:01:00.000Z',
  lastErrorCode: null,
  lastErrorAt: null,
  createdBy: 'user-1',
  createdAt: '2026-09-12T12:00:00.000Z',
  updatedAt: '2026-09-12T12:01:00.000Z'
};

const account: FinancialAccount = {
  id: 'acct-1',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  origin: 'external_connected',
  provider: 'plaid',
  providerAccountRef: 'provider-account-1',
  connectionId: 'conn-1',
  institutionName: 'Sandbox Bank',
  displayName: 'Checking',
  accountType: 'depository',
  accountSubtype: 'checking',
  currency: 'USD',
  maskLast4: '1234',
  status: 'connected',
  capabilities: ['transactions.read'],
  verifiedAt: '2026-09-12T12:01:00.000Z',
  lastSyncedAt: null,
  createdAt: '2026-09-12T12:01:00.000Z',
  updatedAt: '2026-09-12T12:01:00.000Z'
};

describe('Financial Accounts state model', () => {
  it('uses the approved connection states exactly', () => {
    expect(CONNECTION_STATES).toEqual([
      'pending_authorization', 'connecting', 'connected', 'syncing',
      'action_required', 'reauthentication_required', 'degraded',
      'disconnected', 'failed'
    ]);
  });

  it('does not allow a browser redirect alone to imply connected', () => {
    expect(isVerifiedConnected({ ...baseConnection, lastVerifiedAt: null }, account)).toBe(false);
    expect(isVerifiedConnected(baseConnection, { ...account, verifiedAt: null })).toBe(false);
    expect(isVerifiedConnected(baseConnection, account)).toBe(true);
  });

  it('allows reauthentication without deleting the connection', () => {
    expect(canTransitionConnection('connected', 'reauthentication_required')).toBe(true);
    expect(canTransitionConnection('reauthentication_required', 'connecting')).toBe(true);
  });
});
```

- [ ] **Step 2: Write failing permission tests**

Create `tests/unit/core-banking-permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { authorize, hasPermission } from '../../packages/core/src';

describe('banking permissions', () => {
  it('keeps banking permissions independent from accounting', () => {
    expect(hasPermission(['accounting.admin'], 'banking.connect')).toBe(false);
    expect(hasPermission(['banking.admin'], 'banking.connect')).toBe(true);
  });

  it('rejects cross-organization mutations before permission evaluation', () => {
    expect(authorize(
      { scope: { tenantId: 't1', organizationId: 'o1' }, permissions: ['banking.admin'] },
      { scope: { tenantId: 't1', organizationId: 'o2' }, permission: 'banking.disconnect' }
    )).toEqual({ ok: false, reason: 'scope_mismatch' });
  });
});
```

- [ ] **Step 3: Run focused tests and confirm failure**

```bash
npx vitest run tests/unit/financial-accounts-domain.test.ts tests/unit/core-banking-permissions.test.ts
```

Expected: FAIL because the package/types/permissions do not exist.

- [ ] **Step 4: Implement minimal domain package**

Use these exported union values exactly:

```ts
export const CONNECTION_STATES = [
  'pending_authorization', 'connecting', 'connected', 'syncing',
  'action_required', 'reauthentication_required', 'degraded',
  'disconnected', 'failed'
] as const;

export type FinancialAccountOrigin =
  | 'external_connected'
  | 'atlas_virtual'
  | 'treasury_internal';
```

`isVerifiedConnected` must require same tenant/org scope, same connection ID, connection/account status `connected`, and non-null verification timestamps. Do not make `atlas_virtual` operational in this task; it is only a future-compatible origin type.

- [ ] **Step 5: Extend Core permission vocabulary**

Add:

```ts
export type BankingPermission =
  | 'banking.read'
  | 'banking.connect'
  | 'banking.sync'
  | 'banking.disconnect'
  | 'banking.manage'
  | 'banking.admin';

export type PaymentsPermission =
  | 'payments.initiate'
  | 'payments.approve'
  | 'payments.admin';
```

Include both in `AtlasPermission`. Preserve the current namespace-admin behavior: `banking.admin` satisfies `banking.*`; `accounting.admin` does not.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npx vitest run tests/unit/financial-accounts-domain.test.ts tests/unit/core-banking-permissions.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/financial-accounts packages/core/src/permissions.ts tests/unit/financial-accounts-domain.test.ts tests/unit/core-banking-permissions.test.ts
git commit -m "feat(finance): add financial accounts domain and permissions"
```

---

### Task 2: Add transaction sync and deterministic reconciliation matching

**Files:**
- Create: `packages/financial-accounts/src/sync.ts`
- Create: `packages/financial-accounts/src/matching.ts`
- Modify: `packages/financial-accounts/src/index.ts`
- Create: `tests/unit/financial-accounts-sync.test.ts`
- Create: `tests/unit/financial-accounts-matching.test.ts`

**Interfaces:**
- Produces `mergeTransactionDelta(existing, delta): FinancialTransaction[]`.
- Produces `transactionIdentity(provider, providerTransactionRef)`.
- Produces `matchFinancialTransaction(transaction, candidates): ReconciliationMatch`.
- `ReconciliationMatch.status` is exactly `exact_match | suggested_match | needs_review | unmatched`.

- [ ] **Step 1: Write failing sync tests**

Cover new, modified, pending-to-posted, removed, and replayed transactions. Required replay assertion:

```ts
const once = mergeTransactionDelta([], delta);
const twice = mergeTransactionDelta(once, delta);
expect(twice).toEqual(once);
expect(new Set(twice.map((tx) => tx.providerTransactionRef)).size).toBe(twice.length);
```

A pending provider transaction replaced by its posted form must not remain as a duplicate if the delta declares the provider relationship/removal.

- [ ] **Step 2: Write failing matching tests**

Use deterministic candidates with amount/date/reference fields. Required classifications:

```ts
expect(matchFinancialTransaction(bankTx, [exactBookTx]).status).toBe('exact_match');
expect(matchFinancialTransaction(bankTx, [highConfidenceBookTx]).status).toBe('suggested_match');
expect(matchFinancialTransaction(bankTx, [candidateA, candidateB]).status).toBe('needs_review');
expect(matchFinancialTransaction(bankTx, []).status).toBe('unmatched');
```

Define exact match as identical signed amount and posting date plus either exact normalized reference or one unique eligible book candidate. Suggested matches may use a date tolerance of at most 3 calendar days plus amount/reference evidence. Multiple top candidates must never auto-resolve.

- [ ] **Step 3: Run focused tests and confirm failure**

```bash
npx vitest run tests/unit/financial-accounts-sync.test.ts tests/unit/financial-accounts-matching.test.ts
```

Expected: FAIL because sync/matching functions do not exist.

- [ ] **Step 4: Implement pure sync functions**

`mergeTransactionDelta` must be side-effect free and keyed by `(provider, providerTransactionRef)`. Removed references are deleted from the returned provider cache view; Accounting/ledger records are not deleted by this function.

- [ ] **Step 5: Implement deterministic matching**

Return structured evidence:

```ts
export type ReconciliationMatch = {
  status: 'exact_match' | 'suggested_match' | 'needs_review' | 'unmatched';
  candidateIds: string[];
  confidence: number;
  reasons: string[];
};
```

No function in this package posts a journal entry.

- [ ] **Step 6: Run tests**

```bash
npx vitest run tests/unit/financial-accounts-sync.test.ts tests/unit/financial-accounts-matching.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/financial-accounts/src tests/unit/financial-accounts-sync.test.ts tests/unit/financial-accounts-matching.test.ts
git commit -m "feat(finance): add idempotent bank sync and reconciliation matching"
```

---

### Task 3: Add canonical Supabase financial persistence and RLS

**Files:**
- Create: `supabase/migrations/20260912_financial_accounts_core.sql`
- Create: `tests/integration/financial-accounts-schema-contract.test.ts`

**Interfaces:**
- Produces `accounting_bank_accounts`, `financial_connections`, `financial_transactions`, `financial_sync_runs`, `financial_webhook_events`, and `accounting_reconciliation_items`.
- Uses existing `organizations`, `organization_members`, `auth.uid()`, and `audit_logs` patterns.

- [ ] **Step 1: Write a failing schema contract test**

Create a test that reads the SQL migration and asserts all canonical table names, RLS, active organization membership checks, unique provider identifiers, and absence of secret-bearing columns:

```ts
const sql = readFileSync('supabase/migrations/20260912_financial_accounts_core.sql', 'utf8');
expect(sql).toContain('create table if not exists public.accounting_bank_accounts');
expect(sql).toContain('create table if not exists public.financial_connections');
expect(sql).toContain('create table if not exists public.financial_transactions');
expect(sql).toContain('create table if not exists public.financial_sync_runs');
expect(sql).toContain('create table if not exists public.financial_webhook_events');
expect(sql).toContain('create table if not exists public.accounting_reconciliation_items');
expect(sql).toContain('organization_members');
expect(sql).toContain('auth.uid()');
expect(sql).not.toMatch(/access_token\s+(text|varchar)|client_secret\s+(text|varchar)|bank_password/i);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/financial-accounts-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement `accounting_bank_accounts` and connection tables**

Use `org_id uuid not null references public.organizations(id) on delete cascade`. If the repository does not yet have a persisted `tenant_id` column convention, organization membership remains the database isolation key while domain records preserve `tenantId` in application contracts; do not invent a second tenant table.

Required database state check:

```sql
status text not null check (status in (
  'pending_authorization','connecting','connected','syncing','action_required',
  'reauthentication_required','degraded','disconnected','failed'
))
```

`accounting_bank_accounts.origin` is constrained to `external_connected`, `atlas_virtual`, `treasury_internal`; this milestone inserts only `external_connected`.

- [ ] **Step 4: Add uniqueness and idempotency constraints**

At minimum:

```sql
unique (org_id, provider, provider_account_ref)
unique (org_id, provider, provider_transaction_ref)
unique (provider, provider_event_key)
```

Use a unique `(org_id, bank_account_id, book_transaction_id)` or equivalent canonical pair for reconciliation items so replay cannot duplicate a match.

- [ ] **Step 5: Add RLS and grants**

Enable RLS for every financial table. Authenticated read policies require an active `organization_members` row for the row `org_id`. Do not grant direct authenticated writes to sensitive connection/webhook/sync tables; server-side functions perform mutations after permission checks. Browser-readable tables may receive `select` only where required.

- [ ] **Step 6: Add table comments documenting secret boundaries**

For `financial_connections`, explicitly document that durable provider access tokens are not stored in browser-readable columns. For `accounting_bank_accounts`, document that full account/routing numbers are not stored in this table.

- [ ] **Step 7: Run contract/integration tests**

```bash
npx vitest run tests/integration/financial-accounts-schema-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260912_financial_accounts_core.sql tests/integration/financial-accounts-schema-contract.test.ts
git commit -m "feat(finance): add financial accounts persistence and RLS"
```

---

### Task 4: Implement provider contract, Plaid normalization, and safe secret boundary

**Files:**
- Create: `packages/financial-accounts/src/plaid.ts`
- Modify: `packages/financial-accounts/src/provider.ts`
- Modify: `packages/financial-accounts/src/index.ts`
- Create: `supabase/functions/atlas-financial-connections/_shared/secret-store.ts`
- Create: `supabase/functions/atlas-financial-connections/providers/plaid.ts`
- Create: `tests/unit/financial-accounts-plaid.test.ts`

**Interfaces:**
- `FinancialConnectionProvider.createLinkSession(input)`.
- `FinancialConnectionProvider.exchangeAuthorization(input)`.
- `FinancialConnectionProvider.discoverAccounts(input)`.
- `FinancialConnectionProvider.verifyConnection(input)`.
- `FinancialConnectionProvider.syncTransactions(input)`.
- `FinancialConnectionProvider.disconnect(input)`.
- `normalizePlaidAccount(raw)` and `normalizePlaidTransaction(raw)` are pure functions.
- `ProviderSecretStore.put(connectionId, secret)` returns an opaque reference; `get(reference)` is server-only.

- [ ] **Step 1: Write failing Plaid normalization tests**

Use synthetic provider fixtures only. Assert normalized account output contains institution/display/type/subtype/currency/mask and never contains credential fields:

```ts
const normalized = normalizePlaidAccount(rawAccount, {
  institutionName: 'Plaid Sandbox',
  connectionId: 'conn-1',
  organizationId: 'org-1',
  tenantId: 'tenant-1'
});
expect(normalized.maskLast4).toBe('0000');
expect(JSON.stringify(normalized)).not.toMatch(/access_token|public_token|password|routing|account_number/i);
```

Add transaction normalization tests for pending, posted, merchant, amount, ISO currency, and provider transaction reference.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/financial-accounts-plaid.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement pure normalization and provider contract**

Do not import Deno or environment variables into `packages/financial-accounts`. The package remains deterministic and testable under Vitest.

- [ ] **Step 4: Implement server-side Plaid HTTP adapter**

Read `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` only inside the Edge Function provider layer. For this milestone accept `PLAID_ENV=sandbox`; any attempt to use production without separately authorized configuration must fail closed with `provider_environment_not_authorized`.

Use Plaid endpoints corresponding to Link token creation, public-token exchange, account discovery, transaction sync, and item removal through server-side `fetch`. Normalize all provider responses before persistence.

- [ ] **Step 5: Implement secret-store boundary**

The default implementation stores durable provider authorization only in server-authorized storage keyed by an opaque reference. If a dedicated encrypted secret service is not configured in the validation environment, the Edge Function must return `provider_secret_store_not_configured` rather than placing the access token into `financial_connections` or the browser.

- [ ] **Step 6: Run tests**

```bash
npx vitest run tests/unit/financial-accounts-plaid.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/financial-accounts/src supabase/functions/atlas-financial-connections/_shared/secret-store.ts supabase/functions/atlas-financial-connections/providers/plaid.ts tests/unit/financial-accounts-plaid.test.ts
git commit -m "feat(finance): add Plaid adapter and secret boundary"
```

---

### Task 5: Implement authenticated connection lifecycle Edge Function

**Files:**
- Create: `supabase/functions/atlas-financial-connections/_shared/context.ts`
- Create: `supabase/functions/atlas-financial-connections/_shared/errors.ts`
- Create: `supabase/functions/atlas-financial-connections/_shared/repository.ts`
- Create: `supabase/functions/atlas-financial-connections/index.ts`
- Create: `tests/integration/financial-connections-edge-contract.test.ts`

**Interfaces:**
- Browser operations: `accounts`, `create-link`, `exchange`, `sync`, `reconnect`, `disconnect`, `audit`.
- `resolveFinancialContext(req)` returns authenticated `userId`, `orgId`, role, and banking permissions.
- Repository mutations always receive `orgId` as an explicit first argument.

- [ ] **Step 1: Write failing Edge contract tests**

Read the function source and assert bearer auth, `organization_members`, banking permission checks, explicit `.eq('org_id', orgId)` mutations, audit writes, and absence of provider secret output names.

```ts
expect(context).toContain("req.headers.get('authorization')");
expect(context).toContain("from('organization_members')");
expect(repository).toContain(".eq('org_id', orgId)");
expect(repository).toContain("from('audit_logs')");
expect(index).not.toMatch(/return.*access_token|JSON\.stringify\([^)]*access_token/i);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/financial-connections-edge-contract.test.ts
```

Expected: FAIL because the function does not exist.

- [ ] **Step 3: Implement context and permission mapping**

Reuse the Hospitality/ATLAS pattern: authenticate the bearer token, resolve one active organization membership, and map owner/admin/platform_admin to all banking permissions; ordinary active members receive `banking.read` only until a canonical persisted permission assignment exists. Domain helpers still use Core `authorize` where scope is available.

- [ ] **Step 4: Implement repository helpers**

Provide typed functions for listing accounts/transactions, creating/updating connections, upserting accounts, writing sync runs, writing audit rows, and marking disconnected/reauthentication/degraded states. Every read/write includes `org_id` filtering.

- [ ] **Step 5: Implement lifecycle router**

Required semantics:

```text
accounts      -> banking.read
create-link   -> banking.connect
exchange      -> banking.connect
sync          -> banking.sync
reconnect     -> banking.connect
 disconnect    -> banking.disconnect
audit         -> banking.manage or banking.admin
```

`exchange` sequence is fixed: validate authenticated org -> exchange temporary token server-side -> store durable secret behind opaque ref -> discover accounts -> persist connection/account rows -> verify provider state -> write audit -> return normalized connection/account payload. If verification fails, persist `failed` or `action_required`; do not return `Connected`.

- [ ] **Step 6: Implement reconnect/disconnect preservation rules**

Reconnect updates authorization/verification metadata without replacing account IDs or deleting historical transactions. Disconnect revokes/removes the provider item when supported, marks the connection/account `disconnected`, stops sync eligibility, and leaves historical rows intact.

- [ ] **Step 7: Run focused tests and typecheck**

```bash
npx vitest run tests/integration/financial-connections-edge-contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/atlas-financial-connections tests/integration/financial-connections-edge-contract.test.ts
git commit -m "feat(finance): add governed bank connection lifecycle API"
```

---

### Task 6: Implement Plaid webhook ingress and idempotent transaction sync

**Files:**
- Create: `supabase/functions/atlas-financial-webhooks/index.ts`
- Modify: `supabase/functions/atlas-financial-connections/_shared/repository.ts`
- Create: `tests/integration/financial-webhook-contract.test.ts`
- Modify: `tests/unit/financial-accounts-sync.test.ts`

**Interfaces:**
- Webhook ingress accepts Plaid provider events only when provider validation succeeds.
- `provider_event_key` is persisted before event effects are applied.
- Sync records a `financial_sync_runs` row for started/succeeded/failed execution.

- [ ] **Step 1: Write failing webhook contract tests**

Assert the webhook function does not expose broad browser CORS, persists/checks idempotency before processing, loads connections by provider reference + org binding, and calls normalized sync logic.

Required static checks:

```ts
expect(index).toContain('financial_webhook_events');
expect(index).toMatch(/provider_event_key|idempotency/i);
expect(index).not.toContain("access-control-allow-origin: '*'");
expect(index).not.toMatch(/console\.log\([^)]*(access_token|secret)/i);
```

- [ ] **Step 2: Add replay and pending-to-posted domain tests**

A duplicate event key produces no second transaction mutation. A transaction sync cursor may advance only after the page/delta has been persisted successfully.

- [ ] **Step 3: Run and confirm failure**

```bash
npx vitest run tests/integration/financial-webhook-contract.test.ts tests/unit/financial-accounts-sync.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement webhook validation and idempotency**

Derive a deterministic event key from provider-supported identifiers and stable event fields when a unique event ID is unavailable. Insert/claim the event row under a uniqueness constraint before executing sync. Duplicate conflict returns successful no-op semantics rather than reapplying mutations.

- [ ] **Step 5: Implement transaction sync orchestration**

Use Plaid transaction-sync cursor pagination. Persist added/modified rows by `(org_id, provider, provider_transaction_ref)`, apply provider removals only to the normalized financial transaction cache, and update account `last_synced_at` after success. Provider errors map valid connections to `degraded` or `reauthentication_required` according to normalized error class.

- [ ] **Step 6: Record sync evidence**

Persist start/end status, cursor/reference, added/modified/removed counts, and safe error code in `financial_sync_runs`. Never persist raw provider response bodies if they can contain sensitive values.

- [ ] **Step 7: Run tests**

```bash
npx vitest run tests/integration/financial-webhook-contract.test.ts tests/unit/financial-accounts-sync.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/atlas-financial-webhooks supabase/functions/atlas-financial-connections/_shared/repository.ts tests/integration/financial-webhook-contract.test.ts tests/unit/financial-accounts-sync.test.ts
git commit -m "feat(finance): add idempotent financial webhook sync"
```

---

### Task 7: Build the Bank & Cash browser API, routes, and connection-state UI

**Files:**
- Create: `apps/web/src/lib/financialAccountsApi.ts`
- Create: `apps/web/src/modules/finance/accounting/BankCashPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/BankAccountDetailPage.tsx`
- Create: `apps/web/src/modules/finance/accounting/bank-cash.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/main.tsx`
- Create: `tests/integration/bank-cash-routes.test.tsx`

**Interfaces:**
- `getFinancialAccounts()`.
- `createFinancialLinkSession()`.
- `exchangeFinancialAuthorization(publicToken, metadata)`.
- `syncFinancialAccount(connectionId)`.
- `reconnectFinancialAccount(connectionId)`.
- `disconnectFinancialAccount(connectionId)`.
- Routes: `/finance/accounting/bank-cash` and `/finance/accounting/bank-cash/:accountId`.

- [ ] **Step 1: Write failing route tests**

Render `App` under `MemoryRouter`. Assert the shared shell, Bank & Cash heading, truthful empty state when no API session/data is configured, and active links from Finance/Accounting.

Add a mocked connected-account case where the UI shows:

```text
Sandbox Bank
Checking •••• 1234
Connected
Verified by ATLAS
```

The mock payload must include real verification timestamps in the test fixture. Add a degraded payload and assert `Connected · Sync delayed`, not `Disconnected`.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/bank-cash-routes.test.tsx
```

Expected: FAIL because routes/components do not exist.

- [ ] **Step 3: Implement `financialAccountsApi.ts`**

Reuse `getActiveAtlasOrganization()` and `authorizedAtlasFetch()` from `atlasSession.ts`. All requests go to `/functions/v1/atlas-financial-connections`; the browser never calls Plaid REST endpoints directly.

- [ ] **Step 4: Implement Bank & Cash overview**

Required states: loading, empty/configuration, ready, connecting, permission denied, degraded, reauthentication required, disconnected, failed. Show institution, display name, type/subtype, mask, currency, verified state, and last sync only when present.

The CTA text is `Connect financial account`. Do not render balances when the payload lacks authorized balance data.

- [ ] **Step 5: Implement account detail/settings actions**

Detail shows transactions and connection status. Reconnect appears only for `reauthentication_required`/`action_required`; Disconnect requires a confirmation surface explaining that future sync stops while historical Accounting evidence remains.

- [ ] **Step 6: Wire routes/navigation**

In `App.tsx`, activate `/finance/accounting/bank-cash` and account detail route. Update `FinanceHome` and `AccountingHome` so Bank & Cash is an enabled module rather than part of the disabled remaining-routes card. Add one shell nav entry `Bank & Cash`; do not create a second Finance module tree.

- [ ] **Step 7: Add responsive styles**

Desktop: account list + dense detail affordances. Tablet below 900px: single-column/two-level detail navigation. Mobile below 640px: vertical status/account/action cards, horizontally safe transaction rows, full-width primary CTA, destructive Disconnect separated from Connect/Reconnect.

- [ ] **Step 8: Run route tests and build**

```bash
npx vitest run tests/integration/bank-cash-routes.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/financialAccountsApi.ts apps/web/src/modules/finance/accounting/BankCashPage.tsx apps/web/src/modules/finance/accounting/BankAccountDetailPage.tsx apps/web/src/modules/finance/accounting/bank-cash.css apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/main.tsx tests/integration/bank-cash-routes.test.tsx
git commit -m "feat(finance): add Bank and Cash connected accounts workspace"
```

---

### Task 8: Add the reconciliation workspace and audit visibility

**Files:**
- Create: `apps/web/src/modules/finance/accounting/ReconciliationPage.tsx`
- Modify: `apps/web/src/lib/financialAccountsApi.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/modules/finance/accounting/bank-cash.css`
- Create: `tests/integration/financial-reconciliation-route.test.tsx`
- Modify: `tests/unit/financial-accounts-matching.test.ts`

**Interfaces:**
- Route: `/finance/accounting/reconciliation`.
- API returns bank transactions and eligible book transaction candidates scoped to active org.
- UI renders `exact_match`, `suggested_match`, `needs_review`, `unmatched` without auto-posting journals.

- [ ] **Step 1: Write failing reconciliation route tests**

Mock one exact, one suggested, one ambiguous, and one unmatched item. Assert visible labels and that ambiguous/suggested items require a user action before a match is persisted.

```ts
expect(screen.getByText('Exact match')).toBeInTheDocument();
expect(screen.getByText('Suggested match')).toBeInTheDocument();
expect(screen.getByText('Needs review')).toBeInTheDocument();
expect(screen.getByText('Unmatched')).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /post journal/i })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/financial-reconciliation-route.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement reconciliation data endpoint in the existing financial Edge Function**

Add `reconciliation` read operation requiring `banking.read`, retrieving normalized bank transactions plus existing Accounting transaction candidates for the same `org_id`. Apply the pure matching function server-side or reproduce its exact deterministic contract using the shared package import.

Add `match` mutation requiring an appropriate implemented authorization boundary (`banking.manage` for this milestone) and persist only the reconciliation relationship. Do not create or post new journals in this task.

- [ ] **Step 4: Implement Reconciliation page**

Provide account/date filters, bank transaction list, suggested candidate display, confirm/unmatch actions, calculated status, and empty/error states. Keep all totals derived from loaded records.

- [ ] **Step 5: Surface audit evidence**

Account detail and reconciliation may show safe audit entries for connect/reconnect/disconnect/sync/match operations through the existing `audit` operation. Display actor/time/action/result/reference; do not display provider secrets or raw request bodies.

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run tests/unit/financial-accounts-matching.test.ts tests/integration/financial-reconciliation-route.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/finance/accounting/ReconciliationPage.tsx apps/web/src/lib/financialAccountsApi.ts apps/web/src/App.tsx apps/web/src/modules/finance/accounting/bank-cash.css supabase/functions/atlas-financial-connections tests/integration/financial-reconciliation-route.test.tsx tests/unit/financial-accounts-matching.test.ts
git commit -m "feat(finance): add bank reconciliation workspace"
```

---

### Task 9: Harden security, regressions, and sandbox readiness gates

**Files:**
- Create: `tests/integration/financial-security-contract.test.ts`
- Modify: `tests/integration/bank-cash-routes.test.tsx`
- Modify only if needed: existing CI workflow that owns canonical branch validation; do not create a duplicate deploy pipeline solely for Bank Link.

- [ ] **Step 1: Add secret-leak regression test**

Scan browser Finance source, normalized package output fixtures, and financial Edge response construction for forbidden secret material:

```ts
const browser = [
  readFileSync('apps/web/src/lib/financialAccountsApi.ts', 'utf8'),
  readFileSync('apps/web/src/modules/finance/accounting/BankCashPage.tsx', 'utf8'),
  readFileSync('apps/web/src/modules/finance/accounting/BankAccountDetailPage.tsx', 'utf8')
].join('\n');

expect(browser).not.toMatch(/PLAID_SECRET|access_token|bank_password|full_account_number|routing_number/i);
```

Environment variable names may exist server-side; literal secret values may not exist anywhere in Git.

- [ ] **Step 2: Add negative UI/state tests**

Verify: expired consent cannot show `Connected`; provider outage shows degraded; failed exchange never creates success confirmation; disconnect confirmation states history preservation; empty/no-provider state does not fabricate balances.

- [ ] **Step 3: Run targeted security/regression tests**

```bash
npx vitest run tests/integration/financial-security-contract.test.ts tests/integration/bank-cash-routes.test.tsx tests/integration/financial-connections-edge-contract.test.ts tests/integration/financial-webhook-contract.test.ts
```

If the new security scan passes on first run, retain it as a regression test; do not introduce unsafe code merely to force red/green theater.

- [ ] **Step 4: Run existing Accounting/Payables regression tests**

```bash
npx vitest run tests/unit/accounting-payables.test.ts tests/integration/payables-route.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run complete repository verification**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: all PASS before requesting review.

- [ ] **Step 6: Perform responsive verification**

Run the app locally and inspect these widths with browser devtools or the available visual test harness:

```text
1440px desktop
1024px tablet landscape
768px tablet portrait
390px mobile
```

Verify Bank & Cash overview, connected/degraded/reauth states, account detail, transaction list, reconciliation, reconnect, and disconnect confirmation. Record any defects as code/test fixes before review.

- [ ] **Step 7: Validate Plaid Sandbox only when authorized sandbox credentials are available**

Execute the critical path:

```text
Finance -> Accounting -> Bank & Cash
-> Connect financial account
-> Plaid Sandbox consent
-> backend exchange
-> backend verified Connected
-> account discovery
-> transaction sync
-> reconciliation
-> reauthentication test state
-> reconnect
-> disconnect
-> audit evidence
```

If sandbox credentials are absent, report the provider-dependent gate as `blocked: sandbox credentials/configuration required`; do not simulate a successful connected state and do not enable production.

- [ ] **Step 8: Confirm production remains gated**

No Plaid production environment, paid provider plan, real bank connection, ACH/card capability, virtual-account issuance, sponsor-bank/BaaS integration, or production deployment is enabled by this plan.

- [ ] **Step 9: Commit final hardening changes**

```bash
git add tests/integration/financial-security-contract.test.ts tests/integration/bank-cash-routes.test.tsx
git commit -m "test(finance): harden Bank Link security and readiness gates"
```

---

### Task 10: Final branch review and implementation handoff evidence

**Files:**
- Modify only when review finds a concrete defect.
- Do not merge or deploy in this task.

- [ ] **Step 1: Review branch scope**

```bash
git diff --stat main...feat/atlas-bank-link-financial-accounts
git diff --check main...feat/atlas-bank-link-financial-accounts
```

Expected: no whitespace errors and no unrelated ATLAS subsystem refactor.

- [ ] **Step 2: Review domain boundaries**

Confirm by code inspection:

```text
@atlas/financial-accounts has no React dependency
@atlas/financial-accounts has no Plaid secret/environment reads
Accounting UI consumes normalized financial data
browser code has no Plaid REST endpoint usage
Edge functions bind every mutation to org_id
reconciliation does not post journals
atlas_virtual exists only as a future-compatible type/state and not as a live account issuer
```

- [ ] **Step 3: Run final verification again after review fixes**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: PASS.

- [ ] **Step 4: Record truthful readiness evidence**

Report separately:

```text
Code/build status
Unit/integration status
Migration/RLS contract status
Plaid Sandbox status
Plaid Production status
Deployment status
Public production route status
```

A green build does not imply Plaid Sandbox or production is connected. A green sandbox does not imply production authorization.

- [ ] **Step 5: Stop before merge/deploy**

Leave `feat/atlas-bank-link-financial-accounts` ready for independent final review. Merge to `main`, provider production configuration, and deployment require their own explicit approval/evidence gates.

---

## Self-Review Results

- **Spec coverage:** Financial Accounts Core, provider abstraction, Plaid, secure token exchange boundary, account discovery, connection state machine, Supabase persistence, RLS, banking permissions, audit, webhooks, idempotent transaction sync, Bank & Cash UI, reconnect/disconnect, reconciliation, negative tests, responsive behavior, sandbox rollout, production gates, and future BaaS compatibility each map to an implementation task.
- **Placeholder scan:** no `TBD`, `TODO`, `implement later`, or invented vendor-production behavior is used. Missing production credentials or a configured encrypted secret store are explicit fail-closed runtime blockers rather than fake implementations.
- **Type consistency:** connection states, permission names, account origins, reconciliation statuses, route names, provider name `plaid`, and API operations are consistent across tasks.
- **Scope check:** the plan implements one subsystem through a single shared lifecycle. Future virtual banking/BaaS, ACH, cards, lending, deposit custody, and real money movement remain separate future projects.
- **Architecture fit:** the plan follows the repository's existing focused package + Supabase Edge Function shared-module + React route/test patterns and reuses ATLAS Identity, organization membership, audit, Finance shell, and verification commands.