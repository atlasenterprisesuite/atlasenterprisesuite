# Supabase production migration history synchronization

Status: repository history reconciliation only. No production DDL mutation.

Production project `ggmanzcgtlrvqfoccgsh` recorded 319 migrations while the repository had diverged historical filenames and versions. The active `supabase/migrations/` directory is now reconstructed from the production `supabase_migrations.schema_migrations` ledger.

The previous 142 repository SQL files are preserved in `supabase/migrations_legacy_pre_remote_sync/` for auditability. References to those paths must be migrated using the mapping stored in `data/ops/supabase-production-migration-history.json`.

Fail-closed rule: Preview/CI must replay the canonical production migration history before this PR can be considered ready.
