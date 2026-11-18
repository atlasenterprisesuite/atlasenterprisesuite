# ATLAS SOV-003 — Backup readiness (offline)
Status: candidate. This tool only validates local manifest/backup consistency. It **does not restore PostgreSQL**, use production data or certify a live service. The synthetic test archive begins with PGDMP but is not restorable. Even an intact actual PGDMP header is not proof of restorable content.

## Verification
Run `node --test tools/sovereignty/tests/backup-readiness.test.mjs`.
Call the checker with `--manifest manifest.json --archive test.dump --commit <exact-40-char-sha>`. Only isolated-test environments are accepted. Backup metadata validation is strictly separate from live release permission.

## P0 follow-up
1. Build disposable isolated PostgreSQL source/target using synthetic data; no production credentials.
2. Create real `pg_dump -Fc`, verify `pg_restore --list`, restore to a different disposable target.
3. Test schema, migrations, rows, roles, RLS/tenant isolation, auth, extensions and constraints.
4. Prove backup encryption, offsite separation, RPO/RTO and immutable signed evidence.
5. Reconcile with ATLAS Evidence Engine; require exact SHA, approved release and production E2E checks before release.

No Supabase, Cloudflare, DNS, database or production mutation in this change.
