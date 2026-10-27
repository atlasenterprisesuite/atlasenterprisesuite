# ATLAS 777 — PostgreSQL behavioral harness specification (NOT EXECUTED)

Source SHA: 30f5d17247164a6b841b0bae83720fdd1d106457
State: P0 OPEN. No database, Vitest or shell commands launched.

## Forensic SQL review
The existing read-only catalog script has BEGIN READ ONLY, timeout constraints, catalog SELECTs, and ROLLBACK. It reads metadata only. **It is not certified for arbitrary databases:** use of 'public.organization_members'::regclass raises an error if schema absent; no upfront assertion restricts the target database; read-only transactions do not establish no network egress; metadata output can expose implementation or secrets embedded in function definitions. Output MUST stay private.

Before any execution, restrict connection to explicit disposable local socket and verified test DB. Refuse hostnames, TCP, production URLs, service-role keys or generic environment DATABASE_URL. Ensure a per-run Unix socket and PGDATA under temporary directory with strict permissions. Verify process namespace and egress restrictions independently. Require successful proof that connection fails to any external target.

## Harness design (not executable yet)
- One controller orchestrates two independent psql sessions, each with dedicated transaction and a barrier (rather than sleep-based timing).
- Create synthetic organizations A and B, actors A1/A2/B1, a revoked actor, permissions and a ledger ONLY in temporary test database after verifying real schema.
- Prepare migration application under one transaction; set role to service_role for authorized RPC calls; use anon/authenticated for denied calls. Restore roles after each case.
- Test concurrently: A1 and A2 each reserve 0.70 against daily 1.00; exactly one approval, and sum reservations <= 1.00.
- Test at fixed synthetic clock values straddling UTC midnight and varying session TimeZone; require coherent period lock even with held transactions. Do not assume SET TIME ZONE alone controls now(); use injectable test clock or qualified fixture.
- Test trace retry identical values same ID; varying actor, limit, reserve, tenant => denied without new row.
- Test membership revoked between policy check and reservation (and before outbound dispatch); assert fail-closed and no payload leaves mock adapter.
- Test tenant B cannot read/write A's rows under nonprivileged roles; separately verify grants on SECURITY DEFINER RPC.
- Inject exception within reservation transaction; verify ledger and audit unchanged after ROLLBACK.
- Inspect logs, error bodies and telemetry for synthetic sentinel secrets; never print actual credentials.

## Acceptance and evidence
Runner attestation, no-egress evidence, exact Git SHA, postgres version, catalog schema hash, migration hash, psql commands and exit codes, per-test pass/fail, transaction IDs, concurrency barrier trace, rollback row counts, CI run IDs. No invented successes.

## RED contract limitations
Existing static tests are not behavioral; regexes can reject safe SQL alternatives or pass unsafe SQL. Do not weaken requirements merely to make them green. Use separate DB-backed tests once isolation is certified; leave existing RED tests as diagnostic only.

## Remaining blockers
Original organization_members DDL and all ALTER/TRIGGER/RLS/GRANT history not located in indexed repo results. A complete authorized schema export is required before forward-only migration. No isolated PostgreSQL, dependency bundle, runner egress attestation or credentials suitable for a disposable replica are established.
