# ATLAS 777 F17 — authentic migration recovery and CI evidence

## Scope
Source PR #974 tree SHA `ce889fa69aea940e1c705e67906c66293baed551`; continuation baseline `9738ea537f87fdbd1c5501a0179f6d52eb3b213f`. All writes confined to existing branch `audit/atlas-web-777-chain-ledger-20261102`.

## Recovered original Git blobs — exact equality verified
| File | Git blob SHA |
|---|---|
| 20260808183211_atlas_core_schema.sql | 692424bb99bb3dcbe4d7c1da016a018b0f9a28a2 |
| 20260809032705_atlas_identity_foundation.sql | 32ab38e9ec9ad91eb08b1ed7c577af2bcfacac6f |
| 20260809032710_atlas_identity_audit_hardening.sql | 048a989c93690b16a3713c25561f550c547ff95b |
| 20260809032746_atlas_identity_invoker_hardening.sql | a3d4e869ec4e74ee318dfd0cb00877d7e9f0e18d |
| 20260809040445_atlas_identity_member_admin.sql | d7df2c3c47d2400a12574a702d795af1ef55df8e |
| 20260809040925_atlas_identity_hierarchy_locking.sql | 889837e5f4ba7a4b57d5fca8cda7903d7fe15308 |
| 20260821174551_atlas_audit_recursive_secret_redaction.sql | 7b7e2af77dee27edbb2282688f8fde581791b81f |

GitHub tree at `d6e684383106d6f840d9923a64dcd75632dd8ff4` reports these same seven blob hashes. F17 workflow now verifies all seven via `git hash-object` before any database step (commit `6447b2c8bb4d670e85dd55050a8cd7506ec1c95c`). Git blob integrity is not proof of live production DDL equivalence.

## Live atlas-core read-only catalog revalidation
`auth.users`: owner `supabase_auth_admin`, RLS enabled, no anon/authenticated TRUNCATE. Seven public foundation tables: owner `postgres`, RLS enabled, **both anon and authenticated retain effective TRUNCATE**. Production remained unchanged. Auth schema, roles, functions, policies, grants and transitive migration equivalence not fully exported/certified.

## Dependency blocker
`20260808183211_atlas_core_schema.sql` creates foreign keys referencing `auth.users` and uses `auth.uid()`. Recovered ATLAS migrations do not themselves provide a complete authentic Supabase Auth deployment. The existing isolated PG17 workflow starts a bare `postgres:17` service, not Supabase Auth. The F16/F17 workflow intentionally fails closed on missing genuine foundation. Running F12–F14 against synthetic roles/tables would not satisfy authenticity requirements. Additional transitive migrations must be recovered and ordered before a real bootstrap.

## Acceptance
- 7/7 source blobs recovered and verified against original Git tree: PASS.
- Workflow blob-verification step authored: PASS (not executed in CI).
- Authentic Supabase Auth bootstrap: BLOCKED.
- PG17 F12–F14 RED/GREEN and exact ACL equivalence: NOT RUN.
- Tenant A/B RLS and concurrent revocation: NOT RUN.
- CI exact-SHA and required check-runs: NOT CERTIFIED.
- No production DDL, merge, deploy, secrets or spending.

**P0 NO-GO.**
