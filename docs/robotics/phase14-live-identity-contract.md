# Robotics F14 — live atlas-core authorization contract (read-only evidence)

## Scope
Inspected **atlas-core** (project ref ggmanzcgtlrvqfoccgsh), not atlas-core-v2. All queries were SELECT only; no data or schema changes.

## Verified production metadata
- public.has_identity_permission(uuid,text): SQL function, STABLE, SECURITY INVOKER (prosecdef=false), returns boolean, EXECUTE available to authenticated.
- Actual named parameters: `o uuid, p text` (not p_org_id/p_permission, nor org_id/permission_code).
- Definition checks active `organization_members` for `auth.uid()`; first applies `organization_role_permissions.allowed` override, then `identity_role_permissions` defaults, else false.
- `identity_permissions` rows for `execution.read`: **none**.
- `identity_role_permissions` rows for `execution.read`: **none**.
- `organization_role_permissions` rows for `execution.read`: **zero**.
- Thus the catalog's new live permission gate denies all existing users in this observed database. This is an intentional fail-closed outcome, not readiness.
- Adapted packages/robotics/h-series-supabase-auth.ts RPC call to `has_identity_permission({o: orgId,p:'execution.read'})`.

## Remaining blockers
1. Decide and review authorization policy for execution.read; author a migration in isolated PostgreSQL and test before any atlas-core write. No production permission grants.
2. Validate tenantId=orgId against authoritative tenancy model, not compatibility assumption.
3. Verify RLS-scoped Supabase client actually uses caller's bearer token and cannot be substituted with service_role.
4. Implement deterministic PostgreSQL two-session membership/role revocation tests. Current live SELECT metadata does not prove concurrency.
5. Run Vitest, typecheck, and CI at exact HEAD, and record independent results.
6. No merge, deploy or hardware operations. P0 NO-GO.
