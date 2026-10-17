# ATLAS Financial OS — Day 2: transaction evidence intake

**Scope:** ATLAS Pay canonical `/finance/pay/workspace` + `packages/pay`. No new bank, custodial ledger, money movement, card issuing or live provider claim.

## Verified prerequisite inventory (2026-10-12)

Read-only inspection of the canonical `atlas-core` Supabase production project `ggmanzcgtlrvqfoccgsh` found:
- `public.atlas_pay_provider_connections` exists;
- `public.atlas_pay_accounts` **does not exist**;
- `public.atlas_pay_balance_evidence` **does not exist**;
- the original `20261006190000_atlas_pay_accounts_center.sql` already exists in GitHub but is absent from the production migration history;
- Supabase's development branch shows `MIGRATIONS_FAILED`.

**P0:** Do NOT run this Day 2 migration directly on production ahead of resolving and verifying the Accounts Center baseline. Do NOT set `ATLAS_PAY_TRANSACTION_INGEST_ENABLED=true` or deploy a live event endpoint without complete staging isolation tests and bank/partner approval.

## Architecture

1. An **authorized, provider-specific adapter** verifies a native bank/processor event. The native provider's signature algorithm is not assumed to be HMAC and is deliberately NOT implemented here.
2. The trusted adapter converts only the approved fields into an internal signed envelope. It signs `<unix_seconds>.<raw_json>` with HMAC-SHA256 and a **unique secret stored server-side**.
3. `supabase/functions/_shared/pay-transaction-signature.ts` validates the signature, freshness window (5 minutes), maximum payload size (64 KiB), schema and signed event amount before producing a hash.
4. `supabase/functions/atlas-pay-transaction-ingest/index.ts` requires **Supabase JWT verification** if deployed, keeps `ATLAS_PAY_TRANSACTION_INGEST_ENABLED` false by default, and binds the org and provider exclusively from trusted environment variables.
5. The `atlas_pay_record_transaction_event` database RPC verifies service-role auth, account/connection organization ownership and provider readiness. Its insert and audit occur in one transaction.
6. `atlas_pay_transaction_events` keeps immutable organization-scoped evidence (no card PAN, account routing number, personal name, provider secrets or raw signed payload); repeat IDs return `duplicate` only if all attested fields and payload hash match.

## Staging acceptance tests (must be executed against staging DB, not mocked)

- [ ] Apply and test canonical Accounts Center baseline before the Day 2 migration.
- [ ] Apply the Day 2 migration in an authorized, isolated staging project.
- [ ] Authenticated `pay.read` member can read only own-organization evidence.
- [ ] Different organization, unauthenticated, nonmember, and revoked permissions cannot read any event.
- [ ] Authenticated client cannot INSERT, UPDATE, DELETE or execute the service-only RPC.
- [ ] Service-only RPC rejects mismatched account and provider tenant IDs, unverified provider, unsupported event kind and conflicting replay.
- [ ] Service-only RPC accepts one authenticated event, records one audit row, and handles duplicates without a second audit row.
- [ ] No UPDATE/DELETE succeeds on event evidence, including attempts through elevated roles.
- [ ] Missing or bad secret, disabled feature flag, missing JWT, invalid HMAC, stale timestamp, malformed body or replay are rejected.
- [ ] Verify no unrelated production routes or Finance control-plane regression.

## Installation notes and production hold

To deploy later, `atlas-pay-transaction-ingest` must be built using the repository's shared crypto module and deployed with `verify_jwt=true`; it is deliberately **not** included in the production deployment during Day 2 source work. The environment variables below must be provisioned with authorized provider details and a unique high-entropy key before enabling:

- `ATLAS_PAY_TRANSACTION_INGEST_ENABLED` defaults to false
- `ATLAS_PAY_TRANSACTION_HMAC_SECRET` (server-only, not an external bank provider secret)
- `ATLAS_PAY_TRANSACTION_ORG_ID`
- `ATLAS_PAY_TRANSACTION_PROVIDER_CONNECTION_ID`
- Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

A bank's own webhook signature, OAuth/consent, approved contract and runtime adapter configuration are separate P0 requirements. There is no assertion that Chime or another bank supports direct API access.

## Release path

TDD → PR CI → staging migration + negative-RLS tests → security review → merge → approved Supabase migration/function deployment → Cloudflare exact-SHA verification → bank-provider E2E. **Block** live event intake until every dependent P0 has evidence. A passing GitHub build is insufficient to represent the transaction-ingestion feature as live.
