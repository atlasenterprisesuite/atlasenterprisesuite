# ATLAS Initial Owner Bootstrap

**Status:** provider/human gate after authenticated workspace deployment  
**Target backend:** Supabase `atlas-core-v2` (`qawxltbplsxcjvwxdkes`)

## Current verified state

As of 2026-09-09, the v2 project is healthy but intentionally contains no real Auth user, tenant or organization fixture. The application must not fabricate an authenticated owner and must never insert a password into repository files, migrations, application logs or business tables.

The first real owner requested for ATLAS is the account whose email is `winder.aranguren@gmail.com`. The email identifies the intended account, but authorization is not granted by comparing email strings in frontend code.

## Secure activation sequence

1. Deploy the `/identity` surface with the v2 Supabase URL and publishable key configured at runtime.
2. Winder creates/recovers the Supabase Auth account using a provider-supported secure Auth flow and enters the password only in the secure browser/provider UI.
3. Confirm the resulting `auth.users.id` belongs to the intended authenticated account. Do not request or copy the password.
4. Invoke the existing service-role-only `public.bootstrap_atlas_tenant_service(...)` contract with that authenticated actor ID to create the initial ATLAS tenant, organization and `owner` membership.
5. Enable only approved organization module codes through governed backend administration. The initial bootstrap contract enables only `core`; product modules must be enabled deliberately rather than assumed live.
6. Verify `public.atlas_identity_context()` returns exactly one tenant/organization scope for the account.
7. Verify RLS prevents the owner session from reading another tenant or organization.
8. Verify `/app`, `/app/identity` and representative permitted modules through the real browser session.
9. Record the verification evidence in the ATLAS release/manager evidence path before describing master access as production-ready.

## Master semantics

For v2 foundation, `owner` is the highest business role inside the bootstrapped tenant/organization. Platform-wide administrator privileges are a separate governed capability and must not be simulated by disabling RLS, using a service-role key in the browser, or granting access because an email matches a hard-coded value.

If a later platform-admin contract is approved, it must be implemented in Supabase with auditable role/permission semantics and tested independently.

## Human/provider dependency

The currently connected Supabase management interface does not expose an Auth invite, password-reset or user-creation action. Therefore the exact step that requires Winder to interact is account creation/recovery in the deployed secure Auth UI/provider flow. All repository, route, permission and deployment work can continue independently until that point.

## Prohibited shortcuts

- Do not ask Winder to send a password in chat.
- Do not write directly to `auth.users` to manufacture the owner account.
- Do not expose a service-role key to the browser.
- Do not hard-code `winder.aranguren@gmail.com` as an authorization check.
- Do not mark a module enabled merely because a launcher tile exists.
- Do not call the owner account verified until the real Auth session + identity context + RLS checks pass.
