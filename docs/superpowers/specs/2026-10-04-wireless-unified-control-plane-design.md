# ATLAS Wireless Unified Control Plane Design

## Intent

Consolidate MVNO readiness/lifecycle and ATLAS-owned Wireless network readiness/inventory into the existing `atlas-platform-controls` Edge Function. Do not create or keep separate deployable Edge Functions for `atlas-wireless-mvno` or `atlas-wireless-network`.

## Binding rules

1. `atlas-platform-controls` is the only server runtime for MVNO and Wireless network API operations.
2. Browser/UI code may request configuration and read readiness, but may never assert `provider_verified=true`, `state=connected`, `activation_enabled=true`, or equivalent live-carrier truth.
3. Provider verification is server-derived. Configuration alone remains `configured_unverified` and activation remains fail-closed.
4. Existing tenant scoping, JWT/session validation, active organization membership, RBAC permissions, audit evidence, RLS-backed inventory and secret isolation remain mandatory.
5. No carrier/SIM/eSIM activation is claimed unless a later server-side adapter verifies provider credentials plus ATLAS authorization/evidence.
6. `atlas-wireless-commissioning` remains outside this change because it governs infrastructure/hardware commissioning rather than MVNO/provider/network-readiness API consolidation.

## API surface

`atlas-platform-controls` owns these query operations:

- `wireless-mvno-readiness` — GET
- `wireless-mvno-status` — GET; fail-closed until a verified provider adapter exists
- `wireless-mvno-provision` — POST; fail-closed until verified
- `wireless-mvno-activate` — POST; fail-closed until verified
- `wireless-mvno-suspend` — POST; fail-closed until verified
- `wireless-mvno-reconnect` — POST; fail-closed until verified
- `wireless-mvno-revoke` — POST; fail-closed until verified
- `wireless-network-readiness` — GET
- `wireless-network-inventory` — GET

Web clients preserve their current TypeScript response contracts but change the endpoint to `/functions/v1/atlas-platform-controls?api=...`.

## Provider truth boundary

The generic integration configuration endpoint must not accept provider truth from browser input. `integration-upsert` may persist provider ID, connection name, auth kind, endpoint origin, authorization intent/config metadata and secret references, but it must preserve existing server-owned `provider_verified`, verification timestamps and connected truth. For a new connection, `provider_verified=false` and the state cannot become `connected` from client input.

A future explicit server-side verification action may promote a connection only after authenticating the provider and validating required ATLAS authorization/evidence. That future action is outside this change; this change ensures the UI cannot bypass it.

## Security and failure behavior

- JWT verification remains enabled for `atlas-platform-controls`.
- Every Wireless/MVNO operation validates the user, active organization and corresponding `wireless.*` permission.
- Provider secrets remain server-side and are never returned.
- Missing/incomplete credentials => `pending_provider` or `configured_unverified`.
- Configured credentials without verified provider evidence => `provider_verified=false`, `activation_enabled=false`.
- Mutation attempts before readiness => `provider_not_ready` with audit evidence.
- Network readiness never defaults to ready when profile/evidence is absent.

## Repository cleanup

Remove:

- `supabase/functions/atlas-wireless-mvno/index.ts`
- `supabase/functions/atlas-wireless-network/index.ts`
- their function entries from `supabase/config.toml`

Preserve shared modules, migrations, UI pages, routes, permissions and database tables.

## Verification

Tests must prove:

1. both web clients route through `atlas-platform-controls`;
2. separate MVNO/network Edge Function source files no longer exist;
3. platform-controls exposes both operation families and permission gates;
4. generic integration writes cannot set `provider_verified=true` or `connected` from browser input;
5. provider secrets stay server-side and MVNO activation remains disabled without verification;
6. network readiness/inventory remain tenant-scoped and fail-closed;
7. full repository CI remains green before merge/deploy.