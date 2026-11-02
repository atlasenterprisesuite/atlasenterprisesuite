# ATLAS 777 — F10 Foundation authentic bootstrap provenance (NO-GO)

Source commit PR #974: `ce889fa69aea940e1c705e67906c66293baed551`. This is a **read-only dependency manifest**, not a runnable certified bootstrap.

## Recovered original SQL in repository
1. `tests/security/recovered/20260808183211_atlas_core_schema.sql` — blob `692424bb99bb3dcbe4d7c1da016a018b0f9a28a2`: creates organizations, organization_members, organization_modules, audit_logs (identity PK), RLS and base tenant functions. Requires authentic `auth.users` and `auth.uid()` **before** loading.
2. `tests/security/recovered/20260809032705_atlas_identity_foundation.sql` — blob `32ab38e9ec9ad91eb08b1ed7c577af2bcfacac6f`: identity_permissions, identity_role_permissions, organization_role_permissions, has_identity_permission; depends on (1) and Supabase Auth.
3. `tests/security/recovered/20260809032710_atlas_identity_audit_hardening.sql` — blob `048a989c93690b16a3713c25561f550c547ff95b`.
4. `tests/security/recovered/20260809032746_atlas_identity_invoker_hardening.sql` — blob `a3d4e869ec4e74ee318dfd0cb00877d7e9f0e18d`.
5. `tests/security/recovered/20260809040445_atlas_identity_member_admin.sql` — blob `d7df2c3c47d2400a12574a702d795af1ef55df8e`.
6. `tests/security/recovered/20260809040925_atlas_identity_hierarchy_locking.sql` — blob `889837e5f4ba7a4b57d5fca8cda7903d7fe15308`.
7. `tests/security/recovered/20260821174551_atlas_audit_recursive_secret_redaction.sql` — blob `7b7e2af77dee27edbb2282688f8fde581791b81f`: audit_row_change and recursive redaction.
8. `supabase/migrations/20260923201500_atlas_people_core.sql` — consumer, **only after** all prerequisites and verified policies.

## Fail-closed preflight
- `tests/security/atlas-777-foundation-preflight.sql`: catalog dependencies, RLS, audit identity, SECURITY DEFINER contract, effective TRUNCATE grants.
- `tests/security/atlas-777-people-real-dependencies.sql`: prerequisite gate.
- Workflow `.github/workflows/atlas-777-isolated-postgres.yml` must not be weakened or made green with placeholder auth/permission functions.
- Recovered files are source candidates, **not yet verified as the production-equivalent schema**. Supabase Auth SQL and effective production grants/ownership need independent read-only provenance before any PG17 replay.

## Actual failed execution
GitHub Actions run `41449636724`, job `125291352654`: engine and negative preflight passed; People prerequisites failed with `P0_PEOPLE_REAL_MIGRATION_DEPENDENCIES_MISSING`. No changes to production.

## Remaining P0
Authentic Supabase Auth bootstrap; complete transitive DDL; grants/ownership/TRUNCATE parity; tenant A/B negative RLS tests; concurrent revocation; exact-SHA CI; independent Ruleset enforcement evidence.

**NO-GO.** Do not merge or deploy.
