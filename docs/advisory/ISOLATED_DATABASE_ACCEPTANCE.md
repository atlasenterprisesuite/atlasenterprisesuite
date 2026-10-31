# Advisory isolated database acceptance contract

Status: P0 OPEN. Specification only; no database or remote CI execution certified.

Reuse `.github/workflows/advisory-office-ci.yml`. Its current checks do not provision PostgreSQL or prove transactional revocation. Executor control tests use command doubles and do not certify OS isolation.

## Required execution environment

- Disposable Linux runner with supported Node and PostgreSQL server/client binaries provisioned before the disconnected stage. No production secrets or real customer data.
- Permission to create a new network namespace. Denial must stop execution; never fall back to the host network.
- PostgreSQL and its test clients must run inside the same disconnected namespace using a private Unix socket directory, with TCP listening disabled. A PostgreSQL service container outside that namespace is not automatically reachable or acceptable.
- Ephemeral database, synthetic users, organizations and firm memberships only. Implement the actual auth schema, roles and grants required by migrations; never replace permission functions with always-true stubs.
- Apply the dependency-complete migration chain with SQL errors fatal. Record PostgreSQL version, ordered migrations and source commit. Missing Supabase extensions or roles are blockers, not skipped assertions.
- Separate owner role for migration setup and authenticated non-owner role for permission tests. Verify role attributes and effective grants before testing SECURITY DEFINER/RLS behavior.
- Separate connections for competing transactions. Explicit barriers and bounded lock/statement timeouts; do not rely on sleeps for ordering.
- Cleanup on success and failure; no persisted credentials or production database URL in logs or artifacts.

## Required proof

1. Active user with memberships in A and B can select authorized A explicitly. Missing, forged or inactive selection fails closed. Client headers alone never establish authority.
2. Cross-organization and cross-firm reads and writes are denied; assert affected row counts and persisted state using the setup owner after the operation.
3. Organization and firm membership revocations committed before authorization deny subsequent writes.
4. Concurrent write/revocation interleavings have an explicit serialization contract. An already-authorized write may serialize before revocation; a write ordered after committed revocation must fail. Confirm both outcomes with transaction barriers and final state checks.
5. Permission revocation and relevant role changes follow the same documented contract; membership-only locking is not a complete permission-revocation proof.
6. Denied writes leave no partial business records or misleading verified evidence. Assert actual SQLSTATEs, rollback and absence of unintended rows.
7. Record exact source SHA and dirty status. Report skipped, failed, blocked and passed separately. No database proof can be inferred from static SQL assertions or executor doubles.

## Remaining implementation

The current runner executes focused Vitest tests only. It does not start PostgreSQL, apply migrations, create database fixtures or run concurrent transactions. Those capabilities and a trusted tenant-binding/locking correction remain required before P0 closure. The existing legacy multi-org resolver remains fail-closed.

No merge, deploy, external database access or paid provisioning is authorized by this contract.
