# F12 TRUNCATE P0 — evidence ledger (NO-GO)
Read-only atlas-core catalog revalidated on 2026-11-02, project ggmanzcgtlrvqfoccgsh.
All seven tables: `audit_logs`, `identity_permissions`, `identity_role_permissions`, `organization_members`, `organization_modules`, `organization_role_permissions`, `organizations`:
- RLS enabled
- `anon` and `authenticated`: effective TRUNCATE=true AND direct TRUNCATE ACL=true
- `service_role`: effective TRUNCATE=true

Prepared SQL `tests/security/atlas-777-f12-truncate-revoke-isolated.sql` only for a **disposable PostgreSQL 17** instance after authentic schema and roles are loaded. It checks table existence/RLS, REVOKEs only TRUNCATE from anon/authenticated, and verifies their effective privileges are false while service_role remains true. Transaction rolls back on failed assertion. No production DDL performed.

Limitations: cannot claim unchanged other privileges without before/after ACL snapshots in disposable PG17; the script does not currently snapshot every ACL entry. PG17/psql executable unavailable in current local runner; no isolated database execution, no TDD RED/GREEN, no exact-SHA CI certification. Do not use the script in production. Requires authentic Supabase Auth bootstrap and independent review before any execution. P0 NO-GO.
