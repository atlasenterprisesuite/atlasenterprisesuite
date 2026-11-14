# ATLAS 777 — Robotics F21 chain continuity contract

Status: P0 NO-GO. This file unifies the **traceability chain**, not Git branches or production deployments.

## Canonical chain

1. **Identity** — caller-scoped verified JWT, never client-supplied actor or service_role.
2. **Authorization** — active organization, active membership, effective role permission, and verified tenant/org mapping.
3. **Persistence** — original Robotics SQL, RLS/ACL and unprivileged access; no permissive shortcuts.
4. **Revocation** — deterministic membership and role-permission revocation ordering across concurrent transactions.
5. **Execution** — reuse existing ATLAS Universal Execution contracts, simulation only; no physical actuation.
6. **Evidence** — negative tests, isolated PostgreSQL 17, Vitest, typecheck and GitHub Actions exact HEAD SHA.
7. **Release** — P0 fail closed until all gates proven; no merge, deploy, spending or production changes.

## Immutable handoff references

- Robotics PR #970, branch `feat/robotics-simulation-tdd-777-20261101`.
- F19 original SQL concurrency: `tests/robotics/f19_original_sql_transaction_proof.py`.
- F19 guarded SQL: `tests/robotics/f19_guarded_sql_gate.py`.
- F20 evidence ledger: `docs/robotics/atlas-777-f20-evidence-ledger-20261102.md`.
- F21 JWT/scoped-client/missing-membership negative tests: `tests/unit/robotics-h-series-supabase-auth.test.ts`.
- Supabase adapter: `packages/robotics/h-series-supabase-auth.ts`.
- Server execution boundary: `packages/robotics/h-series-server-access.ts`.
- Isolated PostgreSQL CI: `.github/workflows/robotics-postgres-revocation.yml`.

## Verification checkpoint

At inspection, HEAD `7eb312865e733ff20de678ccde6423727460e0bd` had 6/8 workflows successful and 2 still in progress. This document creates a new commit: **revalidate all required checks against the resulting HEAD**. Green on an older SHA never certifies a newer one.

## Unresolved P0

Authentic atlas-core JWT-scoped SQL execution and permission registration; production-parity tenant mapping; unprivileged RLS positive/negative proof; role-permission revocation concurrency on authentic schema; final exact-SHA CI. Never interpret isolated green tests as production certification.

## Continuation rule

For every next cycle: fetch PR HEAD first, inspect current CI/reviews, reuse existing files, add narrowly scoped reproducible tests and fixes, record exact SHA and outstanding P0; stop on unverified controls. Do not create a parallel Robotics executor or merge any branches automatically.
