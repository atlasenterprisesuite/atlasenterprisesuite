# ATLAS 777 — Supabase Genome Recovery

Status: **read-only metadata fingerprint captured; encrypted recovery exporter implemented; actual backup/restore NOT yet executed.**

## Production source (verified 2026-11-13)

- Canonical project: `atlas-core` / `ggmanzcgtlrvqfoccgsh` (ACTIVE_HEALTHY).
- PostgreSQL: 317 tables, 340 SQL functions, 682 RLS policies, 251 triggers.
- Supabase migrations: 321. Edge Functions: 100 / 100 available Free slots.
- Storage: 5 buckets, 2 object metadata rows.
- Source drift: 66 of the 100 deployed Edge Functions have **no matching function directory** in the public GitHub `main` branch. This does not prove they have no source elsewhere.
- Migration drift: 321 remote applied versions versus 142 SQL files in GitHub `main`; **302 remote versions have no exact matching version** in that directory. The two histories are not interchangeable and must be reconciled before a restore. This does not mean the live database is missing schema.
- Snapshot of deployed function **bundle SHA256** and versions: [genome-live-20261113.json](genome-live-20261113.json). These are not Git commit SHAs and do not include source code, tokens or user data.

## No-cost production capacity resolution

The private wireless line intake uses PostgreSQL RPC on the existing canonical project; it does **not** require a 101st Edge Function. Its backend exists, but the web frontend in PR #1048 remains draft until authenticated E2E and exact-SHA deployment evidence exist.

## Recover code + database without a second hosted project

1. On a trusted Windows computer, install PowerShell 7, Supabase CLI v3, Docker and `age`. Verify command help. Authenticate using `supabase login` **locally**; do not share passwords or tokens.
2. Generate an `age` key locally: `age-keygen -o "$HOME/atlas-age-key.txt"`. Keep the private key offline; use only the public recipient (`age1...`) in the command.
3. Run `scripts/export-atlas-supabase-genome.ps1 -AgeRecipient 'age1YOUR_PUBLIC_RECIPIENT'`.
4. The exporter downloads remote configuration, migration history, all 100 Edge Function sources, roles/schema and database data (unless `-SchemaOnly`), verifies file presence, computes SHA256 and encrypts the archive. Temporary plaintext is removed on success/failure.
5. Decrypt **only** in a secure isolated environment, verify all SHA256 entries, and test a restore with negative RLS/Auth/tenant tests before considering it a usable recovery.

**Important:** Storage object bytes, Auth provider settings, project API keys, runtime secrets, and Vault encryption-root-key handling need separate secure export. The CLI's managed-schema exclusions and function import-map limitations must be handled during restoration. A ZIP of source files alone is **not** a full hosted clone.

**Never** commit the decrypted exports to this public repository. Never pause/delete existing projects or upgrade the plan to make a copy without explicit cost and dependency review.

References: [Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [CLI v3](https://supabase.com/docs/reference/cli/supabase-pull), [hosted clone restrictions](https://supabase.com/docs/guides/platform/clone-project).
