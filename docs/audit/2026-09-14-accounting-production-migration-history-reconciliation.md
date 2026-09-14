# Accounting Production Migration History Reconciliation

Date: 2026-09-14 UTC
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Authoritative backend: `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
Source branch inspected: `feat/accounting-100-verification` / PR #73

## Purpose

Recover into canonical source control eight Accounting migrations that are already recorded and effective in authoritative production but were stranded on the highly divergent PR #73 branch.

This reconciliation does **not** apply any database mutation. It restores reproducible migration history using the exact production migration version numbers so the current production database recognizes the versions as already applied, while a clean future environment can replay the same historical chain in order.

## Production migration versions

| Production version | Production name | Recovered source blob from PR #73 | Comparison evidence |
| --- | --- | --- | --- |
| `20260911192327` | `harden_accounting_period_close` | `24061f9e4f2f389ee2fb721ce457b09083721645` | SQL body matches stored production statement; historical source additionally contains two leading documentation comments. |
| `20260912061602` | `accounting_budgeting` | `cd1d40edce6ec054f9f42d3f754f5bea1e5446e6` | Byte-exact Git blob match to stored production SQL when the production statement's final newline is preserved. |
| `20260912062021` | `harden_accounting_budget_delete` | `4eb7875ae7b3b802cb06f9d4f9fb71a6308600c2` | Byte-exact Git blob match to stored production SQL without a final newline. |
| `20260912062356` | `harden_accounting_budget_lifecycle` | `719f861048ff1bdc04dbe74fb9aafd3d697054c7` | Byte-exact Git blob match to stored production SQL without a final newline. |
| `20260912062814` | `accounting_multicurrency` | `aa8d172de0b0755da29599a3c75504caf5c33a03` | Byte-exact Git blob match to stored production SQL when the production statement's final newline is preserved. |
| `20260912065841` | `accounting_intercompany_consolidation` | `ba00687fc879f72dbc31f8dce1bda8acc9e37bed` | Stored production statement and historical source define the same schema, policies, triggers, guards and consolidation/intercompany RPC set; Supabase stored portions in compacted SQL formatting, so the Git blob is not byte-identical. |
| `20260912070014` | `harden_accounting_consolidation_governance` | `dba0d4be5ae523ac2d8e07a4a37421e2e8156f89` | Stored production statement and historical source contain the same policy hardening and governance functions; formatting differs in migration history. |
| `20260912070120` | `accounting_consolidation_workspace` | `54e19c104c5c41d729339eb29f4d22e4f4e7601b` | Stored production statement and historical source contain the same `get_accounting_intercompany_candidates` RPC contract; formatting differs in migration history. |

## Production-side hash verification

For stored migration SQL, Git-blob SHA-1 values were reconstructed in PostgreSQL using the Git blob header (`blob <byte-length>\0`) plus the stored migration text. The four migrations marked byte-exact above matched the PR #73 Git blob SHAs exactly in the appropriate final-newline form.

The period-close source differs only because its source file includes documentation comments that are absent from the stored `schema_migrations.statements` value.

The three consolidation migrations are not represented as byte-exact. Their production-history SQL is compacted relative to the expanded historical files; they were reconciled by the production version/name and the concrete DDL/RLS/trigger/RPC contracts present in both records.

## Recovered canonical filenames

- `supabase/migrations/20260911192327_harden_accounting_period_close.sql`
- `supabase/migrations/20260912061602_accounting_budgeting.sql`
- `supabase/migrations/20260912062021_harden_accounting_budget_delete.sql`
- `supabase/migrations/20260912062356_harden_accounting_budget_lifecycle.sql`
- `supabase/migrations/20260912062814_accounting_multicurrency.sql`
- `supabase/migrations/20260912065841_accounting_intercompany_consolidation.sql`
- `supabase/migrations/20260912070014_harden_accounting_consolidation_governance.sql`
- `supabase/migrations/20260912070120_accounting_consolidation_workspace.sql`

## Safety boundary

- Do not call `apply_migration` for these eight versions on the current authoritative production database; they are already present in `supabase_migrations.schema_migrations`.
- Do not merge PR #73 wholesale as part of this recovery.
- Do not infer that PR #73's UI/package layer is current merely because its historical database migrations were recovered.
- Future clean-environment replay must execute the canonical migration chain and then run Accounting backend gates, tenant-isolation checks and lifecycle tests before being accepted.

## State

Database capability: **DEPLOYED + VERIFIED IN PRODUCTION** before this reconciliation.
Source-control state after this reconciliation: **IMPLEMENTED / pending repository CI and merge to main**.
