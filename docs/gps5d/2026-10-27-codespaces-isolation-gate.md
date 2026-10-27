# GPS 5D Codespaces isolation gate — DESIGN ONLY
Evidence baseline: `e83ca04c9479f7815c5fd9edd32723f05eb84c64`.
Codespaces configuration added at `.devcontainer/gps5d/devcontainer.json`; its creation commit was `1bd609835d1e5e3e0e2d1ac9246bef8e287556bb`.

## Phase A: preparation (network allowed, NO tests)
- This profile does not run postCreateCommand, npm install, Docker, PostgreSQL, or test commands.
- No forwarded ports are requested; automatic forwarding for 3000 and 5432 is suppressed. This is **not** an outbound network block.
- Codespaces VM may have outbound network and a GitHub token. Never run untrusted repository scripts or RLS fixture here.
- The base image is tagged rather than pinned by digest: resolve and record immutable image digest before certification. Image availability, toolchain, and costs are not verified.
- Require explicit user approval before creating a Codespace, since compute/storage usage can be billable.
- No GitHub connector Codespaces lifecycle action was discovered in this session.

## Phase B: isolated test environment (not implemented)
- Build or obtain a reviewed image pinned by digest with PostgreSQL 15+, Node, npm, Vitest, TypeScript and dependencies with verified hashes.
- Stage a clean exact-SHA checkout as read-only. The `postinstall` script must not execute during preparation; audit any transitive lifecycle scripts.
- Execute inside a separate disposable VM or hardened sandbox with externally enforced deny-all egress, no DNS/IPv4/IPv6, no GitHub socket/token, no cloud metadata endpoint, no Docker host socket, no mounted secrets, no privileged mode, and no forwarded ports.
- Use an ephemeral local-only PostgreSQL socket/data directory; execute the SQL fixture under a disposable nonproduction superuser, verify RLS/rollback and cleanup. Run focused Vitest and typecheck only after isolation attestation.
- Record SHA, image digest, lockfile hash, negative network probes, process privileges, command exit statuses, sanitized logs and cleanup attestations.
- `scripts/gps5d/offline-runner-preflight.sh` intentionally fails closed; do not bypass it and do not treat a network namespace smoke test as proof.
- The GitHub Actions GPS5D workflow also intentionally fails closed; do not dispatch or merge to default branch without separate authorization.

## Open P0
No Codespace created; no isolated runner provisioned; no PostgreSQL/Vitest/typecheck executed; no CI pass or production integration certified.
