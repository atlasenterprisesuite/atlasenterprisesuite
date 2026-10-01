# ATLAS Global Accounts Design

Date: 2026-09-29
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Owner: ATLAS Pay
Status: Approved, canonicalized for current main

## Goal

Create the canonical ATLAS Pay foundation as an authenticated, organization-scoped, read-first financial workspace. It must show only persisted, evidence-backed account and capability information and must fail closed when an external financial provider is not configured.

## Canonical architecture

Reuse React 18, React Router, the existing ATLAS module registry/navigation, Supabase session helpers, organization/RLS patterns, shared shell, and `--atlas-*` design tokens. Do not introduce a second shell, auth system, database client, or financial source of truth.

Current canonical main does not contain a complete ATLAS Pay module, so this work establishes it at `/pay` with readiness `external-gated`.

## First-cycle routes

- `/pay`
- `/pay/accounts`
- `/pay/accounts/:accountId`
- `/pay/activity`
- `/pay/compliance`

Other actions such as Send, Receive, Exchange and Cards may appear only as disabled or unavailable capability states until an authorized external provider is independently verified.

## Data model

Create organization-scoped Supabase tables with RLS:

- `pay_capabilities`: provider, country, currency, product type, operation, readiness/eligibility state, safe reason, verification timestamp.
- `pay_accounts`: provider reference, type, country, currency, status, display name, masked identifier, integer minor-unit balances, balance timestamp and metadata.
- `pay_activity`: normalized read-side account/provider events, integer minor-unit amounts/fees, status, description and timestamps.
- `pay_compliance_states`: provider-backed eligibility/compliance state and safe reason without provider secrets.

Allowed readiness vocabulary: `unconfigured`, `configuration_required`, `provider_sandbox`, `provider_verified`, `eligible`, `restricted`, `suspended`, `unavailable`.

No seeded production balances, invented account identifiers, raw card data, full bank credentials, or provider secrets are permitted.

## Web data boundary

Create `apps/web/src/lib/payApi.ts` using the existing authenticated Supabase access patterns. Expose read methods for workspace, accounts, account detail, activity and compliance. Responses must identify real provenance and distinguish unavailable, empty, stale, restricted and verified states.

## UI

Create ATLAS Pay pages/components with existing shell and design tokens. The home page shows only real persisted balances/accounts or a truthful configuration/empty state. Accounts shows masked identifiers and evidence-backed status. Activity filters real persisted events. Compliance renders verified, pending/evidence-needed, restricted, suspended and unavailable states.

The visual direction uses the supplied reference only for product intent: international coverage, currency/account cards, geographic context, mobile-first quick actions. It is not a pixel copy.

## Registry and navigation

Add canonical module definition:

- id `pay`
- title `ATLAS Pay`
- area `Finance`
- route `/pay`
- readiness `external-gated`
- requiresAuth `true`
- showInNavigation `true`

Add route/navigation nodes through the existing navigation engine.

## Security and truthfulness

Every Pay route requires authentication. All data is organization-scoped and protected by RLS. Monetary values use integer minor units. External provider state must be evidence-backed. ATLAS Pay must not present regulated services as live unless the relevant authorized provider and compliance prerequisites are verified.

## Finance and Accounting boundary

ATLAS Pay is the owner of provider/account operational truth. Finance may consume verified balance visibility and Accounting may consume finalized events later. Neither may create a shadow Pay balance.

## Verification

Required before merge: typecheck, focused tests, unit tests, integration tests, navigation verification, design verification, and production build. Production-ready claims additionally require deployment, route, auth, migration/RLS and provider evidence.

## Acceptance

The first cycle is complete when ATLAS Pay is a canonical external-gated module; Pay home, Accounts, Activity, Compliance and account detail are functional; persistence is org-scoped with RLS; the UI uses real data or truthful empty/error states; and provider-dependent actions remain fail-closed.
