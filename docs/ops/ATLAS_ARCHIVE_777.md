# ATLAS Archive 777 — committed-source continuity (Phase 1)

**Classification:** source archive CLI and local restoration verification; **not** full disaster recovery.
**Owner/control plane:** ATLAS Manager. **Status:** software-level only until a real protected storage target and independent recovery drill are proven.

## Why

Cloudflare's announced retention of Worker versions and Pages deployments is separate from ATLAS's source of truth. Older provider version URLs can disappear. ATLAS must retain its own reproducible source history and independent recovery evidence. A Git bundle preserves only Git refs and commits present in the local clone; it does **not** back up Cloudflare-deployed Worker bundles, mutable data, runtime configurations, secret values, or personal records.

## Commands

Requirements: Node 20+ and Git. Run from a **full, clean, non-shallow Git clone** whose current HEAD is attached to a branch. Use a private directory outside the repository and with appropriate encryption/access controls:

~~~bash
node scripts/atlas-archive-777.mjs snapshot --repo . --output /path/to/private/atlas-archives
node scripts/atlas-archive-777.mjs verify --manifest /path/to/private/atlas-archives/atlas-archive-EXAMPLE.json
node --test tests/node/atlas-archive-777.test.mjs
~~~

The first command produces a unique .bundle and .json manifest. The manifest records HEAD SHA, branch, byte count and SHA-256. Snapshot generation verifies that an independent temporary clone can recover the same branch HEAD. The second command re-checks size, digest and independent clone restoration. VERIFIED_LOCAL means **only this Git archive** was locally checked. Never report production ready, offsite backed up or disaster recovery verified based on this result.

The CLI **fails closed** for a shallow clone, dirty/untracked files, destination inside the worktree, invalid manifest, digest mismatch or unrecoverable branch SHA. All backup files, including historical commits, may contain sensitive information if it was ever committed: do not upload or commit archives to a public repository or unprotected artifact store. The utility never copies live secrets stores and never triggers a deployment.

## Mandatory next gates (P0 until verified)

1. **Git source recovery:** create a full clone including required historical refs; export to an owner-controlled, encrypted, access-controlled location; record immutable digest and periodically restore on a separate machine. A single copy stored only on GitHub or Cloudflare is not provider-independent.
2. **Cloudflare edge history:** record authoritative deployment/version IDs, Worker source/artifacts where contractually accessible, route/binding/compatibility settings, custom domains, and release SHA. Never treat a version inventory as a deployable backup; test actual redeployment in isolated staging. Preserve secrets only through an authorized secrets-management/rekey procedure.
3. **Supabase backend:** use provider-authorized, tested backups for database and storage, with consistent migration state and proper separation of tenants. Include Auth/Storage/Edge Functions policies and external integrations in recovery planning. Never copy raw production data into GitHub Actions artifacts.
4. **Knowledge and user files:** inventory each authorized source, retention rule, export format, consent, deletion requirements and encrypted backup target. Do not claim ChatGPT conversation history is automatically accessible.
5. **Continuity/recovery:** verify restoration of source + configuration + data + key rotation on a non-production target, with tenant/RBAC/RLS and exact-SHA assertions; retain dated audit results and mark P0 NO-GO when evidence is missing.

For this phase the tests are wired into the repository's existing npm run test:node glob. No new provider credential, paid service, cloud workflow, or live backup destination is provisioned. Never configure automatic export of personal data without explicit authority and a verified secure destination.
