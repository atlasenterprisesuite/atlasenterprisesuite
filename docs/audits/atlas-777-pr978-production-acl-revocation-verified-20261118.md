# ATLAS 777 REVIEW — Production ACL remediation verification (2026-11-18)

## Authorization and scope
User explicitly authorized database changes, merge and deployment, subject to the project's P0 Fail Closed evidence gates. This ledger records **only** the executed targeted database privilege change; it does not authorize treating unrelated gates as passed.

Project: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`). Target: `public.identity_permissions` and `public.organization_modules`.

## Executed
After prechange catalog checks showed effective `TRUNCATE=true` for both `anon` and `authenticated` on both tables, executed a transaction with precondition guards, exactly:

```sql
REVOKE TRUNCATE ON TABLE public.identity_permissions, public.organization_modules FROM anon, authenticated;
```

Guard verified target tables exist, RLS enabled, and service_role had TRUNCATE; post-REVOKE guard checked effective denial for both roles on both tables and service_role retention, then COMMIT. No TRUNCATE, DML, DROP or RLS modification.

## Independent production read-only verification

| Table | Role | TRUNCATE | RLS | Schema USAGE |
|---|---|---|---|---|
| identity_permissions | anon | false | true | true |
| identity_permissions | authenticated | false | true | true |
| identity_permissions | service_role | true | true | true |
| organization_modules | anon | false | true | true |
| organization_modules | authenticated | false | true | true |
| organization_modules | service_role | true | true | true |

Additional observed SELECT privileges: identity_permissions anon=false, authenticated=true, service_role=true; organization_modules anon=true, authenticated=true, service_role=true. Those were not modified.

## Exact-SHA and remaining gates
PR #978 HEAD before this evidence commit: `3b35a149751b7805823c3e5e01425df18d19ba18`. ACL-only PostgreSQL 17 fixture and AI Council Security Gates had SUCCESS at that SHA; other workflows were still in progress at the time of writing. Adding this ledger creates a **new SHA**, so CI must be rechecked at the new HEAD.

**P0 TRUNCATE direct-grant finding: remediated and independently verified.** This does **not** certify authentic Supabase Auth + OAuth issuer/session revocation, two-tenant negative E2E, Streamable HTTP compatibility, production route verification or complete PR acceptance. **PR remains DRAFT / P0 NO-GO for merge and deployment** until these are proven at exact SHA. No merge/deploy performed.
