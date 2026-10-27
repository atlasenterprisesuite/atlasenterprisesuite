# ATLAS GPS 5D — Master execution graph / P0 ledger
Evidence base: branch `feat/gps5d-idrive-tdd-777-20261027`, commit `7b30bb53c4decb2ce4781b72f52246ed9c4ec14a`.
Status: DOCUMENTARY ONLY. No tests, runner, merge, deploy or production validation claimed.

## Verified inventory (at evidence SHA)
- `apps/web/src/modules/gps/gps5dIrvDomain.ts`: pure validation, tenant-aware client filtering, timeline, simulation; client flags are not trusted authorization.
- `tests/unit/gps5d-idrive-contract.test.ts`: Vitest negative contract (synthetic records).
- `tests/sql/gps5d-idrive-rls-isolated.fixture.sql`: PostgreSQL synthetic fixture with transactional rollback; not Supabase production schema.
- `scripts/gps5d/offline-runner-preflight.sh`: intentionally blocks execution, even if its namespace smoke check passes.
- `.github/workflows/gps5d-isolated-tdd.yml`: manual-only workflow that intentionally fails closed, not a runnable offline test suite.
- `apps/web/src/modules/gps/Gps4DPage.tsx`: current GPS UI and externally loaded map assets; integration of GPS5D domain not established.
- `package.json`: `test:unit` invokes Vitest; `typecheck` invokes web typecheck; `postinstall` invokes Render-specific installer.
- `.github/workflows/atlas-local-ai-bootstrap.yml`: existing self-hosted workflow, **not reusable as an isolated runner**: it requests OIDC, calls Supabase and installs persistent runtime.

## Dependency graph and independent tracks
```
A: exact-SHA checkout + verified immutable dependencies + offline runner provision
   -> B: isolation attestation (network, filesystem, secrets, process, cleanup)
      -> C: disposable PostgreSQL 15+ -> SQL fixture + rollback/cleanup tests
      -> D: Vitest GPS5D unit contracts + web typecheck
      -> E: reproducible logs and SHA evidence -> P0 runner gate review
F: independent source/licensing provenance review -> approved real development records
G: GPS4D integration contract -> UI tests + accessible timeline -> E2E
C + D + E + F + G -> approved merge gate -> staged deployment -> production verification
```
C and D may run in parallel ONLY after A and B are certified. F and G can be developed independently with synthetic fixtures, but cannot be certified as production-ready before source permissions and E2E evidence.

## P0 blocking conditions
1. No demonstrated fully materialized exact-SHA checkout on an isolated execution host.
2. No independently attested egress-deny policy; `unshare --net` smoke check alone is insufficient (IPv6, DNS, host processes, namespace boundaries).
3. No audited immutable offline dependency bundle / install-script bypass and SBOM or checksum provenance.
4. No disposable PostgreSQL 15+ cluster with documented local-only socket, cleanup, no production credentials.
5. No executable exact-SHA Vitest/typecheck/PostgreSQL results or full CI evidence.
6. Workflow exists only on feature branch and intentionally fails closed; do not enable via main or dispatch without authorization.

## TDD acceptance contracts (not yet executed)
- Runner rejects mismatched SHA, dirty tree, any forbidden credentials, missing binaries/deps, failed isolation attestations; no network or production side effects.
- PostgreSQL: tenant A cannot read B; anonymous denied; revoked member denied; unpublished/unlicensed denied; forbidden INSERT/UPDATE/DELETE denied; duplicate keys denied; transaction rollback removes fixture roles/schema; failure leaves no residual cluster.
- Unit: invalid provenance, coordinates, years and scenario arithmetic denied; client access defaults deny; timeline requires membership.
- Integration: UI consumes only server-authorized rows; does not claim real construction projects or observed traffic from simulation; accessibility labels and keyboard timeline verified.
- Evidence: immutable checkout SHA, dependency hashes, runner image digest, network policy proof, command exit codes, redacted logs, cleanup evidence and reviewer decision.

## Safe next action
Obtain or provision an authorized disposable offline runner with independently enforced network egress denial and preinstalled verified dependencies; certify A/B without invoking production. Only then execute C/D and record real results. No merge, deploy, spending, secret access or production actions authorized.
