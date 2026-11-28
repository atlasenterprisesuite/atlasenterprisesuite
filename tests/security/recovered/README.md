# Recovered authoritative foundation sources

Status: P0 OPEN; source recovery only, not an executable or certified bootstrap.

Recovered on 2026-11-02 from the atlas-core migration history (project ggmanzcgtlrvqfoccgsh), selecting migration SQL, never application/user rows:

1. `20260808183211_atlas_core_schema.sql`: original organizations, memberships, audit_logs, helper functions, RLS policies and grants.
2. `20260809032705_atlas_identity_foundation.sql`: original identity permission catalog, role defaults, organization overrides, authorization functions, RLS and grants.

The files preserve returned statement text without SQL rewrites. Static role/permission seeds are part of the original migration, not production tenant records. These are historical sources, not a claim that their original security definitions match the current hardened production catalog.

Do not run these files against production or add them to the production migrations directory. They are not automatically loaded by the isolated workflow yet.

## Remaining bootstrap gates

- Recover the native Supabase Auth schema/roles and authenticated identity functions from authoritative definitions. Do not replace auth.users or auth.uid with permissive stubs.
- Recover and order subsequent hardening migrations, including audit_row_change and redact_atlas_audit_jsonb, owners, ACLs, triggers and transitive dependencies.
- Validate the resulting bootstrap in PostgreSQL 17 before wiring it into the existing fail-closed prerequisite gate.
- Execute the original People and Advisory migrations, then authenticated A/B isolation, permission/membership revocation and concurrent transaction tests.
- Verify CI at the resulting exact revision; source inspection and mocked contracts are not database runtime evidence.

The existing unconditional certification rejection and prerequisite checks remain enabled. No merge, deployment, paid resource, production DDL or application-data read is authorized by this recovery.
