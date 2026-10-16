# ATLAS Banking Core — Phase 1 (non-custodial foundation)

Status: source code proposed for review; NOT an operational bank transfer service.

## Existing architecture reused
- packages/core for policy logic and existing Vitest unit test conventions.
- Existing accounting_entities, accounting_bank_accounts, accounting_transactions, journal_entries and journal_lines for future reconciled ledger integration. Do not create duplicate ledgers.
- Existing authentication, organization RBAC/RLS and audit requirements must gate every future endpoint.

## Security gates (fail closed)
Transfer intent validation requires scoped identity, distinct accounts, integer USD cents, unique idempotency key, account ownership evidence, consent, fresh step-up authentication, approved banking rail and verified transferable balance. SpotMe/overdraft is never transferable balance. Provider-reported snapshots are not live available balance proof.

## Critical blockers
- No approved ODFI/sponsor bank or direct ACH/RTP/FedNow access.
- No production bank authorization or ownership-verification adapter.
- No durable idempotency persistence, signed webhook intake, settlement reconciliation, audit trail or multi-tenant RLS verified for transfers.
- No legal/compliance assessment for applicable payment activities.

## Acceptance sequence
1. Unit policy tests pass.
2. Build a scoped transfer-intent table with RLS, immutable audit, unique idempotency constraint and strict state transitions.
3. Add a mock rail for non-production integration tests only; never represent a mock as a real transfer.
4. Obtain bank rail access and verify bank capabilities for each account.
5. Implement real adapter with server-side secrets, replay-safe signed events, retries, returns and double-entry reconciliation.
6. Run security/integration/E2E and production exact-SHA verification before enabling live funds.

No funds are moved by Phase 1. The Chime to Uber Pro Card $18.49 transfer remains unexecuted.
