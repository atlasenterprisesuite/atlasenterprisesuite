# ATLAS Bank Link + Financial Accounts Core Design

Date: 2026-09-12
Status: Approved design, pending written-spec review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-bank-link-financial-accounts`

## 1. Objective

Build a production-grade financial connection foundation for ATLAS that lets authorized users connect external financial accounts, synchronize normalized transaction data, inspect account state, and reconcile bank activity into Accounting without fabricating live status or duplicating financial sources of truth.

The architecture must also leave a clean extension point for future ATLAS virtual banking / embedded-banking capabilities delivered through an authorized sponsor bank or Banking-as-a-Service provider.

The implementation order for this capability is:

`ATLAS Core -> Financial Accounts Core -> Financial Connection Layer -> Plaid Adapter -> Bank & Cash UI -> Transaction Sync -> Reconciliation -> Audit -> Future Banking/BaaS Adapter`

## 2. Product Ownership and Module Boundaries

This design assigns clear ownership to avoid mixing banking, payments, and accounting responsibilities.

- **ATLAS Finance / Accounting** owns the accounting representation of cash, bank accounts, reconciliation, journals, and the general ledger.
- **ATLAS Bank Link** owns connecting external financial institutions and normalizing authorized external account data.
- **ATLAS Pay** owns payment orchestration and money-movement workflows such as payments, payouts, wallets, payment links, and merchant settlement when those capabilities are implemented.
- **ATLAS Banking** is the future product surface for virtual accounts, ACH, cards, treasury, and other embedded-banking capabilities through regulated partners.
- **ATLAS Core** owns tenancy, organization scope, RBAC, shared audit contracts, identity, shell, error states, and approval primitives.

Accounting must never become the money-movement engine. Bank Link must never become the general ledger. ATLAS Pay must not create an independent duplicate bank-account registry.

## 3. Existing Architecture to Reuse

The current Accounting architecture already defines:

- `/finance/accounting/bank-cash`
- `/finance/accounting/reconciliation`
- tenant and organization scoping
- shared RBAC and audit responsibilities
- a rule that connected-bank status is displayed only after a real authorized connection is verified

The backend code already references `accounting_bank_accounts`. This design formalizes that entity rather than introducing a competing account table for Accounting.

The existing shared core contract `TenantScope` and its `tenantId + organizationId` isolation semantics must be reused for all financial entities and backend authorization checks.

## 4. Architectural Decision

ATLAS will implement a **provider-agnostic Financial Connection Layer** with Plaid as the first external-bank adapter.

Plaid is not the financial domain model. It is one implementation of a provider contract.

Conceptually:

```text
FinancialConnectionProvider
  -> PlaidAdapter
  -> FutureProviderAdapter

FinancialAccountProvider
  -> ExternalConnectedAccountAdapter
  -> FutureBankingPartnerAdapter
```

This keeps the product stable if ATLAS later adds another aggregator, direct bank APIs, treasury providers, or a sponsor-bank/BaaS partner.

## 5. Canonical Navigation

### 5.1 Current financial-account flow

```text
Finance
  -> Accounting
    -> Bank & Cash
      -> Connected Accounts
        -> Connect financial account
        -> Account Detail
          -> Transactions
          -> Reconciliation
          -> Statements
          -> Connection Settings
```

### 5.2 Future banking flow

```text
ATLAS Pay / Banking
  -> Virtual Accounts
    -> Account
      -> Money Movement
      -> Cards
      -> Statements
      -> Controls
```

The future banking surface must reuse the same Financial Accounts Core rather than create a parallel financial-account system.

## 6. User Experience

### 6.1 Bank & Cash overview

The Bank & Cash workspace presents financial accounts available to the active tenant and organization.

Each account card or row may display only data actually available from the active adapter, including:

- institution name
- account display name
- account type / subtype
- masked last four digits
- currency
- verified connection status
- available/current balance when authorized and available
- last successful sync time
- action-required state when applicable

The primary CTA is **Connect financial account**.

### 6.2 Successful connection confirmation

After a backend-verified connection succeeds, ATLAS renders a confirmation surface using ATLAS visual identity.

Example semantics:

```text
Account successfully connected
Institution / Account Name •••• 1234
Connected through Plaid
Verified by ATLAS · Sep 12, 2026 · 08:44 EDT
```

The timestamp must derive from a persisted verification event. It must not be decorative copy.

Full account numbers, credentials, access tokens, or provider secrets are never displayed.

### 6.3 Responsive behavior

**Desktop**
- sidebar navigation
- account list
- account detail panel / route
- transaction and reconciliation workspaces optimized for dense data

**Tablet**
- two-level account-list/detail navigation
- collapsible filters and actions

**Mobile**
- vertical account state summary
- account identity and verification information
- transaction list and status controls
- large primary Connect/Reconnect CTA
- destructive actions visually separated

All states must work on desktop, tablet, and mobile.

## 7. Connection State Machine

Canonical UI/backend connection states:

- `pending_authorization`
- `connecting`
- `connected`
- `syncing`
- `action_required`
- `reauthentication_required`
- `degraded`
- `disconnected`
- `failed`

A UI badge may say **Connected** only when all applicable verification conditions pass:

```text
authorization valid
+ backend financial connection exists
+ provider account verification succeeds
+ tenant/organization binding is valid
+ no fatal provider state is active
```

A successful browser redirect alone is not sufficient.

### 7.1 Provider outage

A temporary provider outage must not automatically convert a valid account into `disconnected`.

Use a degraded state such as:

`Connected · Sync delayed`

when authorization remains valid but fresh synchronization is temporarily unavailable.

### 7.2 Reauthentication

When provider consent expires or the institution requires new authentication:

- preserve the financial account record
- preserve historical transactions
- preserve completed reconciliations
- preserve ledger references
- change connection state to `reauthentication_required`
- offer **Reconnect**

### 7.3 Disconnect

Disconnect is a sensitive action.

Before executing it, ATLAS must explain that new transaction sync, balance refresh, and dependent automations will stop.

Disconnecting a provider does not delete historical accounting records, posted journal entries, or completed reconciliation evidence.

## 8. Core Domain Contracts

The core model must not assume every account comes from Plaid.

### 8.1 FinancialAccount

Required conceptual fields:

- `id`
- `tenant_id`
- `organization_id`
- `origin`
- `provider`
- `provider_account_ref`
- `institution_name`
- `display_name`
- `account_type`
- `account_subtype`
- `currency`
- `mask_last4`
- `status`
- `capabilities`
- `verified_at`
- `last_synced_at`
- `created_at`
- `updated_at`

Canonical `origin` values:

- `external_connected`
- `atlas_virtual`
- `treasury_internal`

For the first implementation cycle, only `external_connected` is operational.

### 8.2 FinancialConnection

Conceptual fields:

- `id`
- `tenant_id`
- `organization_id`
- `provider`
- `provider_connection_ref`
- `status`
- `consent_granted_at`
- `consent_expires_at`
- `last_verified_at`
- `last_error_code`
- `last_error_at`
- `created_by`
- `created_at`
- `updated_at`

Provider secrets are excluded from this public/domain record.

### 8.3 FinancialTransaction

Normalized fields should include:

- `id`
- `tenant_id`
- `organization_id`
- `financial_account_id`
- `provider`
- `provider_transaction_ref`
- `authorized_at`
- `posted_at`
- `description`
- `merchant_name`
- `amount`
- `currency`
- `pending`
- `provider_category`
- `source_metadata`
- `created_at`
- `updated_at`

Provider transaction identifiers must be preserved for deduplication and lineage.

## 9. Supabase Persistence

The canonical persistence model will use the existing Supabase platform.

Required entities:

- `accounting_bank_accounts`
- `financial_connections`
- `financial_transactions`
- `financial_sync_runs`
- `financial_webhook_events`
- `accounting_reconciliation_items`
- financial/audit events using the shared audit architecture or a compatible canonical financial audit table if the common audit persistence is not yet available

### 9.1 `accounting_bank_accounts`

This remains the Accounting-visible registry of cash and bank accounts.

It must be formalized through a canonical migration if the table is not already created by another reconciled migration at implementation time.

It must not contain provider access tokens or financial credentials.

### 9.2 RLS and tenancy

Every persisted financial record must be scoped by tenant and organization where applicable.

Production isolation must be enforced in the database/backend, not only by client-side filters.

Policies must prevent a user authorized for Organization A from querying, mutating, reconnecting, or disconnecting accounts belonging to Organization B.

Service-role operations must still explicitly bind work to the resolved tenant and organization rather than relying on unrestricted access.

## 10. Provider Contract

The initial provider abstraction must support at least these operations conceptually:

- create link/authorization session
- exchange temporary authorization result server-side
- discover authorized accounts
- verify connection state
- request/synchronize transaction deltas
- refresh/reconnect authorization
- disconnect/revoke provider connection when supported
- normalize provider errors
- process provider webhook events

Provider-specific response shapes must be translated into ATLAS domain contracts before reaching Accounting UI/components.

## 11. Plaid Adapter

Plaid is the first FinancialConnectionProvider implementation.

### 11.1 Connect flow

```text
User selects Connect account
-> ATLAS backend validates identity, scope, and banking.connect permission
-> backend creates Plaid link session
-> browser receives temporary link token
-> user completes Plaid Link / institution authentication / consent
-> browser returns temporary authorization result
-> backend exchanges temporary result for durable provider authorization
-> backend discovers accounts
-> backend creates/updates FinancialConnection and FinancialAccount records
-> backend verifies scope and provider state
-> backend emits audit event
-> UI renders Connected only after backend confirmation
```

### 11.2 Secret handling

The durable Plaid access token must never be returned to the browser or committed to the repository.

Secrets belong only in authorized backend secret storage and server-side execution environments.

The product domain stores opaque references needed to locate or operate on the secret without exposing it to users or frontend code.

## 12. Backend / Edge Functions

Expected server-side responsibilities may be implemented as focused Supabase Edge Functions or equivalent existing backend patterns.

Logical endpoints/functions include:

- create provider link session
- exchange provider public/temporary token
- list/verify discovered accounts
- trigger authorized sync
- reconnect connection
- disconnect connection
- provider webhook receiver

No sensitive provider operation should depend on browser-only enforcement.

## 13. Webhooks and Idempotency

A dedicated Plaid webhook handler will conceptually follow:

```text
Webhook
-> validate expected provider request
-> authenticate/verify provider requirements
-> normalize event metadata
-> persist event receipt
-> check idempotency
-> resolve FinancialConnection + tenant/org
-> process event
-> schedule or execute required sync/update
-> record result
-> emit audit/operational evidence
```

Webhook processing must be safe against retries and duplicate delivery.

`financial_webhook_events` requires a durable provider event identifier or deterministic idempotency key where the provider does not supply one directly.

Repeated delivery must not create duplicate financial transactions.

Failures must be visible for controlled retry and diagnostics.

## 14. Transaction Synchronization

The UI must not call Plaid directly every time Bank & Cash opens.

The canonical flow is:

```text
Provider
-> Financial Connection Layer
-> normalized ATLAS financial data
-> Finance / Accounting / Reconciliation UI
```

Sync must correctly handle:

- new transactions
- modified transactions
- pending-to-posted changes
- provider-deleted/removed transactions when applicable
- pagination/cursor continuation
- retry after transient errors
- idempotent replay

Sync evidence belongs in `financial_sync_runs` with status, start/end timestamps, relevant cursor/reference data, counts, and normalized error information.

## 15. Reconciliation Matching

Bank transactions may be matched against existing book transactions using a deterministic matching engine with optional AI-assisted recommendations.

Matching signals may include:

- amount
- transaction/posting date
- reference text
- merchant/payee/payer
- bill or invoice relationship
- historical matching rules

Recommended status model:

- `exact_match`
- `suggested_match`
- `needs_review`
- `unmatched`

Semantics:

```text
Exact match
-> auto-match only when deterministic rules and policy permit

High-confidence candidate
-> Suggested match

Ambiguous candidates
-> Needs review

No candidate
-> Unmatched
```

AI recommendations must not silently create or post accounting entries that require authorization.

Material or sensitive workflows may route through the ATLAS Approval Center before ledger-affecting execution.

## 16. RBAC

Banking permissions are separated from Accounting permissions.

Initial banking permission vocabulary:

- `banking.read`
- `banking.connect`
- `banking.sync`
- `banking.disconnect`
- `banking.manage`
- `payments.initiate`
- `payments.approve`
- `payments.admin`

Existing Accounting permissions remain authoritative for ledger and accounting workflows.

UI permission checks improve UX but do not replace backend authorization.

Sensitive server-side operations must validate the authenticated actor, tenant, organization, and required permission.

## 17. Audit and Evidence

Sensitive events must produce auditable evidence using the shared ATLAS audit contract or its canonical persisted implementation.

At minimum audit:

- connection initiated
- connection completed
- connection failed
- account discovered / bound
- sync initiated/completed/failed
- reauthentication required
- reconnect completed
- disconnect initiated/completed
- permission-denied sensitive action

Audit records should include, where applicable:

- event ID
- tenant ID
- organization ID
- actor ID
- action
- entity type
- entity ID
- provider
- before/after state
- timestamp
- correlation ID

Provider credentials and raw secrets must never be stored in audit payloads.

## 18. Error Handling

Every financial data surface must explicitly support:

- loading
- empty
- ready
- connecting
- syncing
- permission denied
- degraded provider
- action required
- reauthentication required
- disconnected
- recoverable validation error
- non-recoverable provider error

Recoverable actions must preserve enough state for the user to retry without losing unrelated accounting history.

## 19. Future ATLAS Virtual Banking / Embedded Banking

This design prepares ATLAS for future virtual accounts without claiming that ATLAS is currently a bank.

The future implementation must use an authorized sponsor bank / BaaS or other legally appropriate regulated structure unless ATLAS independently obtains the necessary regulatory authority.

Potential future capabilities:

- virtual account / account number issuance
- routing number support where the partner provides it
- ACH credits/debits
- transfers
- cards
- statements
- treasury controls
- savings or goal accounts
- business subaccounts
- settlement controls

Future account creation conceptually becomes:

```text
Apply
-> KYC/KYB
-> sanctions/AML/fraud controls
-> partner approval
-> provider creates account
-> ATLAS receives virtual-account reference
-> FinancialAccount(origin=atlas_virtual)
-> authorized money-movement capabilities exposed
```

ATLAS must not display a virtual account as open/active until the regulated provider confirms it.

## 20. Regulatory and Safety Boundary

The first Bank Link milestone is data connectivity and reconciliation infrastructure, not an ATLAS banking license and not unrestricted money movement.

Money-movement capabilities require separate approval and implementation gates covering, as applicable:

- KYC / KYB
- AML / sanctions screening
- fraud controls
- limits
- custody / safeguarding model
- settlement
- dispute/error handling
- consumer/business disclosures
- sponsor-bank requirements
- applicable state/federal regulatory obligations

No future provider should be represented as active before contracts, credentials, authorization, and technical verification are complete.

## 21. Testing Strategy

Implementation must use TDD for the financial domain and critical integration behavior.

### 21.1 Unit tests

Required coverage includes:

- financial connection state transitions
- provider normalization
- tenant/organization scope predicates
- permission predicates
- transaction deduplication
- pending-to-posted transition handling
- idempotency-key behavior
- reconciliation exact/suggested/ambiguous/unmatched classification
- sanitization of sensitive provider data

### 21.2 Database / RLS tests

Verify:

- Organization A cannot read Organization B financial accounts
- Organization A cannot modify Organization B connections
- unauthorized actors cannot disconnect accounts
- service/backend functions bind operations to explicit tenant/org context
- uniqueness constraints prevent duplicate provider-account and provider-transaction records within the intended scope

### 21.3 Integration tests

Required flows:

1. Bank & Cash route renders inside the canonical ATLAS shell.
2. Connect action requires `banking.connect`.
3. Provider sandbox authorization completes through backend verification.
4. Verified accounts become visible to the correct organization only.
5. Duplicate webhooks do not duplicate transactions.
6. Transaction delta sync handles new, modified, pending, posted, and removed records.
7. Reauthentication preserves historical records.
8. Disconnect stops new sync without deleting posted accounting evidence.
9. Reconciliation can match imported bank activity to book transactions.
10. Existing Payables and Accounting routes remain functional.

### 21.4 E2E critical path

At minimum:

```text
Open ATLAS
-> Finance
-> Accounting
-> Bank & Cash
-> Connect financial account
-> complete provider sandbox authorization
-> receive backend verified Connected state
-> inspect transactions
-> reconcile an eligible transaction
-> trigger reauthentication test state
-> reconnect
-> disconnect
-> verify audit evidence
```

Desktop, tablet, and mobile fidelity checks are mandatory.

### 21.5 Negative tests

Must verify:

- manipulated callbacks do not create connections
- invalid provider events are rejected
- duplicate webhooks are idempotent
- expired consent does not remain visually `Connected`
- provider outage becomes degraded, not incorrectly disconnected
- one organization cannot enumerate another organization's bank accounts
- access tokens and secrets never appear in frontend payloads, logs intended for users, committed code, or audit payloads

## 22. CI and Verification Gates

The existing repository verification commands remain authoritative and should be extended rather than replaced.

Before implementation can be considered ready:

1. dependency/security audit passes at the configured threshold
2. typecheck passes
3. unit tests pass
4. integration tests pass
5. production build passes
6. database migrations apply cleanly in the target validation environment
7. RLS/security tests pass
8. provider sandbox critical path passes
9. no visible dead controls or placeholder links exist in the implemented scope
10. no secret scanning violations exist
11. responsive verification passes for desktop/tablet/mobile
12. existing Accounting/Payables flows do not regress

Production readiness additionally requires authorized provider production credentials, deployment verification, health checks, and route smoke testing.

## 23. Rollout Plan

### Phase 1 — Financial Core

Implement:

- domain contracts
- provider abstraction
- Supabase schema and RLS
- Bank & Cash account registry UI
- connection state model
- permissions and audit contracts

No production external-bank connection is claimed.

### Phase 2 — Plaid Sandbox

Implement and verify:

- Plaid adapter
- link-session creation
- secure token exchange
- account discovery
- webhook handling
- transaction sync
- account detail
- reconciliation flow

Sandbox status must be clearly distinguished from production.

### Phase 3 — Plaid Production

Only after explicit authorization to use production credentials and any applicable provider costs:

- configure authorized secrets
- confirm callback/webhook domains
- complete provider production requirements
- run production smoke tests
- verify health and observability
- enable real connected-account state

No paid provider credits or charges may be initiated without explicit user approval.

### Phase 4 — ATLAS Banking / BaaS

Separate future project:

- select sponsor-bank/BaaS architecture
- complete legal/compliance prerequisites
- implement provider adapter behind FinancialAccountProvider
- add virtual accounts / ACH / cards / treasury only when technically and regulatorily authorized

## 24. Definition of Done — Bank Link Milestone

Bank Link is complete only when an authorized user can execute this real workflow in the intended validation environment:

```text
Finance
-> Accounting
-> Bank & Cash
-> Connect account
-> provider consent/authentication
-> backend verification
-> verified account displayed
-> transaction synchronization
-> transaction inspection
-> reconciliation
-> reauthentication handling
-> disconnect
-> audit inspection
```

The milestone must preserve:

- tenant/org isolation
- backend RBAC
- idempotency
- secret safety
- auditability
- deterministic connection status
- Accounting consistency
- responsive UI
- regression safety

A marketing screen, static connected badge, mocked production account, or successful redirect without backend verification does not satisfy Definition of Done.

## 25. Non-Goals for This Implementation Cycle

The first Bank Link implementation does **not** include:

- ATLAS acting as a chartered bank
- production virtual account issuance
- ACH initiation unless separately approved and designed
- card issuance
- lending / credit underwriting
- consumer deposit custody
- unrestricted payment execution
- simulated production connections
- fabricated balances or transaction metrics

Interfaces may be designed to accommodate these later, but controls that depend on unavailable regulated infrastructure remain absent or explicitly disabled/configuration-gated.

## 26. Success Criteria

This design succeeds when ATLAS has one provider-agnostic financial-account architecture that:

- connects authorized external accounts through a real provider adapter
- never exposes provider secrets to the browser
- normalizes financial data before Accounting consumes it
- preserves tenant and organization boundaries
- verifies connection state server-side
- synchronizes transactions idempotently
- reconciles external activity to book records without fabricating ledger impact
- records sensitive operations in audit evidence
- reuses the canonical Finance/Accounting architecture
- can later accept a regulated Banking/BaaS provider without replacing the Financial Accounts Core

The architecture must remain truthful: `Connected`, `Live`, `Verified`, and future `ATLAS Virtual Account` states represent verified conditions only.