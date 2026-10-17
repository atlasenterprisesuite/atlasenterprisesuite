# Sovereign DNS persistent storage — deployment gate

Migration: `supabase/migrations/20261017000100_atlas_dns_sovereign_control_plane.sql`

The migration defines durable zone snapshots, atomic optimistic versioning and an event inserted in the same PostgreSQL transaction. It is committed to the feature branch **but has not been applied to any database**.

## Integration requirements (P0)
1. Review the migration against existing ATLAS tenant identity and role tables. Use the established tenant membership authority, not caller-provided tenant IDs.
2. Implement a trusted API endpoint that verifies the session, organization membership and `dns_admin`/owner role; validate the zone and records with `validateZoneChange`; never expose database credentials to browsers.
3. Create a narrowly scoped server-side execution identity with RLS policies or tightly controlled BYPASSRLS only if necessary, and grant `EXECUTE` on `atlas_dns_commit_zone` to that role only. As committed, **all client access is revoked and RLS denies access by default**; the function cannot be used until a reviewed server authorization path exists.
4. In the server, call the transaction RPC instead of the development in-memory adapter. Do not use separate audit calls for persistent mutations: the RPC commits snapshot + audit together.
5. Test two-tenant isolation, unauthorized access, concurrent updates, transaction rollback on audit failure, migration rollback, backup restore, and record validation. Confirm CI and staging results before production.
6. Do not deploy authoritative DNS or activate checkout until operational and commercial gates are verified.

## Known limitations
- This is database DDL, not a running DNS service or completed API integration.
- Existing zone validator has limited IPv6 and DNS label validation; it is not yet sufficient for arbitrary public DNS traffic. Harden and test before live service.
- Supabase remains a transitional managed dependency until ATLAS-operated PostgreSQL hosting and backups have been built and verified.
