# ADR-SOV-002 — Offline Git source continuity

**Status:** implementation candidate; no production cutover.

## Decision
Extend the existing ATLAS Manager and SOV-001 Evidence Gate with a self-contained, local Git bundle of the canonical main branch. A trusted release controller supplies the exact commit SHA independently of the backup. Verification checks the bundle SHA-256 and branch ref, then validates the bundle against an empty bare Git repository without contacting GitHub.

Restoration clones into a new directory only and verifies the restored HEAD. Reports distinguish source bundle verification, source restoration, and runtime/data restoration as separate facts.

## Security and scope
- A Git bundle can preserve the committed main history but does not back up PostgreSQL, object storage, domain registration, secrets, Git LFS, submodules, CI runners, node_modules or provider APIs.
- A SHA-256 sidecar is not a cryptographic signature: an attacker able to rewrite both files can forge it. Existing SOV-001 pinned Ed25519 validation should authenticate any trusted release attestation.
- Git history itself can contain sensitive material. Store offline copies encrypted; limit access and never upload them to a public artifact service.
- A clean worktree and exact SHA are required; existing output paths are never overwritten.
- Never report production recovered or independent from a source-only clone. P0 release, RLS/RBAC, backup/restore, deployment and exact-SHA runtime checks remain with ATLAS Manager.

## Rollout
1. Local deterministic Git fixtures and negative tests.
2. CI against exact PR head SHA using the existing npm test:sovereignty suite.
3. Authenticated offline main-bundle restore drill with encrypted artifact custody.
4. Separately test database/objects/secrets and provider failover; no DNS or production change in this PR.
