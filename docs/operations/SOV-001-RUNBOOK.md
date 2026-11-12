# SOV-001 Runbook — offline evidence verification

1. Use Node.js 22+; run `npm run test:sovereignty` locally or in an approved isolated runner.
2. Collect **real** P0 logs from trusted tools and store each evidence file under an evidence root with no secrets.
3. Generate a manifest with `schema_version=atlas.sovereignty.v1`, `release: { sha, environment: "production", issued_at }`, and all P0 check IDs from `P0_CHECKS`. Each check needs `status="pass"`, exact `sha`, and `evidence: {path,sha256}`.
4. After independent approval, have a trusted attestor sign the raw manifest bytes with Ed25519. Pin the public key **outside the untrusted artifact**. Never use ephemeral test keys as production identity.
5. Invoke `sovereign-gate.mjs` with manifest, detached signature, pinned public key, expected commit SHA, evidence root, and optional result output path. Exit 0 means signed file claims are internally consistent; exit 2 is a fail-closed rejection.
6. Even with `ok: true`, `eligible_for_deployment` is always false. The existing release controller must independently verify CI provenance, permissions, live runtime, public routes, RLS/RBAC, backups, the deployed exact SHA and authorization.

**P0 fail/unknown:** block release; preserve audit evidence and continue unrelated work. **P1 warning:** document without manufacturing a pass. **Rollback:** this PR makes no production changes. Do not put key material or personal data into the manifest.
