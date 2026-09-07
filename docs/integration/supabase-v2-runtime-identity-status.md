# ATLAS Supabase v2 Runtime Identity — Verification Status

Date: 2026-09-07

## Target

- Supabase project: `atlas-core-v2`
- Project ref: `qawxltbplsxcjvwxdkes`
- Region: `us-east-1`
- Integration branch: `feat/supabase-v2-runtime`
- Target branch: `release/atlas-a-z`
- `main` is not part of this integration wave.

## Runtime contract

The web runtime now resolves authenticated identity through the canonical `atlas_identity_context()` RPC. A ready identity contains:

- `userId`
- `tenantId`
- `tenantName`
- `organizationId`
- `organizationName`
- `role`
- effective `permissions[]`

The runtime does not infer `tenantId` from `organizationId` and no longer reconstructs effective permissions through separate client-side membership/role/override queries.

## Defects found by authenticated E2E

### Recursive identity RLS

The first E2E exposed recursive RLS evaluation: membership helpers joined `organizations`/`tenants`, whose policies called the same membership helpers. Fixed by private `SECURITY DEFINER` membership probes behind public `SECURITY INVOKER` wrappers.

Migration: `20260907203112_fix_identity_rls_recursion_v1.sql`.

### Audit correlation UUID mismatch

The next E2E reached the first governed accounting write and exposed a type mismatch: `audit_logs.correlation_id` is UUID while three functions inserted `gen_random_uuid()::text`.

Fixed in:

- `private.accounting_audit`
- `public.ingest_bank_transaction_service`
- `public.set_bank_provider_state_service`

Migration: `20260907203250_fix_audit_correlation_uuid_v1.sql`.

## Verification evidence

### Dependency-free identity contract

Command:

```sh
node --experimental-strip-types --test tests/self/atlas-identity-contract.test.mjs
```

Fresh result: **3 tests passed, 0 failed**.

### Minimal strict TypeScript verification

A strict local harness using the exact modified Identity source/context/contract and narrow React/Supabase type stubs was executed with:

```sh
tsc -p tsconfig.json
```

Fresh result: **exit 0**.

This proves the modified Identity slice type-checks, but is not a substitute for the full repository typecheck/build.

### Supabase self checks

Fresh aggregate:

- total: **58**
- passed: **58**
- failed: **0**

### Security Advisor

Fresh result: **0 security lints**.

### Authenticated rollback-only E2E

`supabase/tests/identity-accounting-e2e.sql` creates two temporary authenticated users and two independent tenant/org scopes inside a transaction, then rolls everything back.

Fresh result: all five invariants passed:

1. User 1 resolves only tenant/org 1.
2. User 2 resolves only tenant/org 2.
3. User 1 cannot read tenant 2 accounting data through RLS.
4. User 1 can create and post a balanced governed journal in its own scope.
5. A tenant 2 account cannot be referenced inside a tenant 1 journal.

Post-run cleanup check: **0 persisted `e2e-%` tenants**.

## Environment contract

`apps/web/.env.example` points development at Supabase v2 using only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No service-role or server-only secret belongs in `VITE_*` configuration or the repository.

## Remaining gate

The repository already contains ATLAS Forge local CI. Its canonical pipeline is:

1. `npm ci`
2. `npm run typecheck`
3. `npm run test:unit`
4. `npm run test:integration`
5. `npm audit --audit-level=high`
6. `npm run build`

Forge records exact source SHA evidence and is suitable as the self-hosted verification layer requested when GitHub Actions cannot allocate a runner.

A full Forge run is **not yet verified for this branch** because this session does not have an authenticated clean local checkout of the private repository. The feature must remain unmerged until full repo CI/Forge is green or equivalent complete evidence is obtained.

## Truth state

- Supabase v2 tenancy/RLS/Accounting E2E: **verified**
- Identity contract slice: **verified by dependency-free tests and minimal strict typecheck**
- Full repository typecheck/tests/build: **pending Forge/GitHub runner**
- Production deployment/readiness: **not claimed**
