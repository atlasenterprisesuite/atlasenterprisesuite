# Authorize.net eCheck.Net for ATLAS Pay

Date: 2026-09-18  
Status: Server adapter integrated behind a fail-closed feature gate; customer-facing eCheck checkout is not yet enabled.

## Purpose

ATLAS Commerce reuses the existing provider-neutral ATLAS Pay boundary. Authorize.net eCheck.Net is implemented as one payment adapter rather than a second payment system.

The implementation supports ACH/eCheck checkout through Authorize.net tokenized payment data. ATLAS must not receive, persist, log, or audit raw bank account or routing numbers.

## Runtime architecture

Implemented server flow:

`Authorize.net Accept.js opaque payment nonce -> ATLAS Commerce -> Authorize.net transaction API -> normalized payment result -> atomic Commerce order commit`

The Commerce server accepts only an Authorize.net opaque payment reference, validates that it uses `COMMON.ACCEPT.INAPP.PAYMENT`, then submits an `authCaptureTransaction`.

Customer-facing Accept.js bank-data collection is not enabled by this change. The existing public storefront cart therefore remains blocked rather than collecting bank information or fabricating a successful checkout. Enabling public eCheck checkout requires the merchant Public Client Key, a reviewed ACH authorization UX, public checkout scoping, and post-submission reconciliation.

Provider responses are normalized into the shared Commerce payment states. Only explicit accepted results with a provider transaction reference can complete a positive-total order. Declines, failures, provider unavailability, timeouts, held results, malformed responses, and ambiguous outcomes fail closed.

## Secrets

Authorize.net credentials are server-only and reuse the existing Supabase Vault-backed ATLAS secret store.

Required Vault secret names are organization-scoped:

- `authorize_net_{org_id}_api_login_id`
- `authorize_net_{org_id}_transaction_key`

Each ATLAS organization therefore resolves its own merchant credentials; one tenant cannot silently reuse another tenant's Authorize.net account.

Do not place either value in browser environment variables, source files, GitHub commits, logs, screenshots, or client storage.

Non-secret runtime configuration:

- `ATLAS_AUTHORIZE_NET_ECHECK_ENABLED=true`
- `ATLAS_AUTHORIZE_NET_ENVIRONMENT=sandbox|production`
- `ATLAS_AUTHORIZE_NET_CURRENCY=USD`

The feature gate defaults to disabled.

## Provider setup

Production activation requires an Authorize.net merchant account with eCheck.Net enabled and approved. Until that external provider state is real and both Vault secrets are present, `/commerce/settings/payments` reports **Setup required** and checkout remains blocked.

Use sandbox first. Switch to production only after merchant approval, production credentials, and provider-side eCheck capability are confirmed.

## Security controls

- Raw routing and account-number payloads are rejected by the ATLAS adapter.
- Payment amount is recomputed server-side from canonical Commerce pricing.
- Merchant credentials are read only from the service-role-only ATLAS secret store.
- A hashed checkout idempotency value is passed as the provider `refId`; the raw checkout key is not exposed as provider metadata.
- Authorize.net duplicate-window protection is enabled in addition to the Commerce idempotency record.
- Ambiguous network/provider outcomes are not retried as successful charges.
- Provider status surfaces readiness booleans only; it never returns credential values.

## Operational verification

Before enabling production:

1. Confirm eCheck.Net approval in the Authorize.net merchant account.
2. Store the two credentials in ATLAS Vault under the exact organization-scoped names above.
3. Run with `ATLAS_AUTHORIZE_NET_ENVIRONMENT=sandbox` and execute a sandbox eCheck transaction using an Accept.js opaque nonce.
4. Verify the order stores only provider name, transaction reference, normalized state, amount, currency, and timestamps.
5. Confirm no bank account/routing values appear in logs, audit evidence, database records, browser storage, or test snapshots.
6. Enable the production environment and feature gate only after the production account is approved.
7. Run the repository typecheck, unit/integration tests, build, production deployment, and the fail-closed production verifier for `www.atlasenterprisesuite.com`, Commerce, and critical ATLAS Network routes.

## Settlement and returns

An accepted eCheck transaction is not the same as irreversible settlement. ACH/eCheck transactions can later be returned or charged back. ATLAS must preserve the provider transaction reference for reconciliation, and a later reconciliation/webhook capability must update downstream financial status when Authorize.net reports a return or other post-submission change.

Until that reconciliation path is implemented and verified, ATLAS must not present an eCheck as permanently settled merely because the initial transaction request was accepted.
