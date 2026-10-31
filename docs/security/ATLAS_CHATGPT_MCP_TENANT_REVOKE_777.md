# ATLAS 777 — ChatGPT MCP identity, tenant binding and revocation (NO-GO)

**Status:** isolated branch-only implementation contract; not an enabled ChatGPT app, Supabase integration, live OAuth provider, or production release.

## Reuse before invention

Existing ATLAS source already verifies users and active `public.organization_members` memberships via Supabase user-scoped clients in:
- `supabase/functions/atlas-creator/_shared/context.ts`
- `supabase/functions/atlas-hospitality-access/_shared/context.ts`
- `supabase/functions/atlas-ride-compliance/_shared/context.ts`

ATLAS Ride's slice uses `tenantId = organizationId` as a compatibility binding. This isolated read-only catalog follows that narrow rule **only** until a canonical global tenant-mapping contract is proven. No broader tenancy architecture is inferred.

## Proposed server-only wiring (NOT deployed)

1. The trusted OAuth issuer signs a short-lived RS256 access token with `sub`, `jti`, `iss`, `aud`, time claims and `atlas:apps:read`. The server pins issuer and JWKS origin.
2. `createAtlasJwtVerifier` validates the signature, time claims, expected issuer and audience, and scope.
3. `createAtlasChatGptSupabaseDirectory` requires a separately supplied **live issuer-session verifier** and looks up a unique server-issued token binding by exact `(issuer, subject, token_id)`.
4. The binding maps to an internal ATLAS user and organization. The directory re-reads `public.organization_members` for the matching active `(user_id, org_id)` and `public.organizations.active = true`.
5. `isRevoked` re-runs the live checks. Logout, revocation, expired grant, removed membership, disabled organization, duplicate binding, backend failure, or absent verifier DENY.
6. The isolated MCP adapter only supports `atlas.apps.catalog` (29 identities, all `not_connected`). Client-supplied tenant/org inputs cannot pick a tenant.

The `serviceRoleKey` is a privileged **server-only** injected dependency, never a browser key or public environment variable. Do not mount the adapter until live issuer session verification and safe server-only runtime isolation are proven.

## Proposed grant storage — schema contract, NOT a migration

A new table is necessary because no existing canonical OAuth `(issuer,subject,jti)` → internal user + organization binding was established in the reviewed repository. The current adapter references `public.atlas_chatgpt_oauth_grants`, which is **not currently proven to exist in any environment**. Before deployment, prepare an independently reviewed migration using `supabase migration new` in a certified isolated checkout, then validate exact SQL and RLS/grants locally.

Required columns:

| Column | Type | Constraint |
| --- | --- | --- |
| issuer | text | canonical trusted HTTPS issuer; mandatory exact match |
| subject | text | non-empty, bounded, issuer-scoped |
| token_id | text | non-empty, bounded (JWT jti, **never bearer token**) |
| user_id | uuid | trusted internal user, FK to auth.users |
| org_id | uuid | FK to organizations |
| expires_at | timestamptz | required future grant expiration |
| revoked_at | timestamptz nullable | immediately invalidates access |
| session_revoked_at | timestamptz nullable | updated from trusted issuer session lifecycle |

Enforce unique `(issuer,subject,token_id)` for every issuer, including single-issuer deployments. The directory now mandates an exact trusted issuer parameter and refuses grants issued by another authority. A database migration and controlled issuer tests are still required. Restrict the table to trusted service-only principals; explicitly **REVOKE** access from `PUBLIC`, `anon` and `authenticated`, enable RLS, and audit issuance/revocation. Never use user metadata or JWT tenant claims as authoritative membership. Implement issuer logout/revocation synchronization and operational audit before any real tokens are issued. Do not use `SECURITY DEFINER` as a shortcut.

## Verification evidence

- `tests/unit/chatgpt-supabase-directory.test.ts`: two distinct organizations, grant binding, issuer collision denial, membership removal, organization disabled, grant expiry, duplicate binding, issuer-session invalidation, backend failures and invalid inputs.
- `tests/integration/chatgpt-oauth-two-organizations.test.ts`: signed RS256 JWT → verifier → mock PostgREST directory → HTTP MCP catalog; attempts to swap organization identifiers and token IDs, then revokes the session and membership.
- These are **isolated injection-based integration tests**, not PostgreSQL, real IdP, hosted ChatGPT, or browser E2E. No claim of production end-to-end verification.

## Hard release gates (P0)

- [ ] A real trusted OAuth issuer, signing keys/JWKS pinning, client flow and introspection/session-validation contract are confirmed.
- [ ] The proposed grant-store schema and access rules are migrated and independently checked in a throwaway database using two real tenant fixtures and transactional rollback.
- [ ] Token grant issuance, change/revocation events and audit chain are implemented atomically, with concurrency and lost-update tests.
- [ ] Cross-tenant, role downgrade, membership removal, replay, token rotation, DB outage, issuer outage and leaked-claim negative E2E pass.
- [ ] Branch exact-SHA Vitest, typecheck, security scans and CI all pass; verify production against exact deployed SHA.
- [ ] A separately reviewed server-only route is authorized; only then consider merge and deploy.

**Release disposition: P0 OPEN / FAIL CLOSED / NO MERGE / NO DEPLOY.**
