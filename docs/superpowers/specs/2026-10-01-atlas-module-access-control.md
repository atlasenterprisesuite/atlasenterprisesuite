# ATLAS Module Access Control — 2026-10-01

## Goal

Make ATLAS navigation and direct-route access truthful for authenticated organizations. A protected module is usable only when the active organization has an active entitlement and the user's role satisfies the module's existing permission vocabulary where one is defined.

## Canonical flow

Identity -> Active organization -> Module entitlement -> RBAC permission -> Navigation -> Route -> Backend/RLS

The browser gate is defense-in-depth and UX truthfulness. It never replaces backend authorization or row-level security.

## Compatibility

Existing active organizations are backfilled with legacy entitlements so this release does not silently remove capabilities they already had. New organizations have no protected-module entitlements until provisioning occurs.

## Fail-closed behavior

- Protected navigation is hidden when the access snapshot cannot be verified.
- Direct protected routes render an access-verification failure or access-denied state.
- Missing, inactive, expired, suspended, or revoked entitlements deny access.
- A configured permission vocabulary must match the user's active role.
- Modules without a mature permission vocabulary preserve membership-based legacy behavior while their backend/RLS controls remain authoritative.

## Audit

Every entitlement insert, update, or delete is copied to an append-only audit table with actor, old row, new row, and timestamp.

## Review passes

1. Architecture: reuse the canonical module registry, existing identity/session boundary, role-permission table, and RLS.
2. Security/UX: fail closed, no browser entitlement writes, direct-route protection, truthful menu filtering, no session deletion for ordinary access denial.
3. Regression/operations: preserve existing organizations, isolate new-organization provisioning, add focused unit/contract tests and require CI before merge/deploy.
