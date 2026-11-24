# AW Finance Advisory 777 — isolated E2E revocation gate

Status: **NO-GO**. This is a test specification, not executed evidence.

## Preconditions (fail closed)

- Run only against a disposable PostgreSQL/Supabase-compatible local instance with no production URL, tokens, credentials, customer data, outbound network, or paid services.
- Verify the complete migration order and that the corrective migration `20261028090000_aw_finance_advisory_rpc_firm_membership.sql` is the effective last definition of all three RPCs.
- Create synthetic organizations A and B, firms A1 and A2 under A and B1 under B, users U1/U2, synthetic clients and engagements.
- Use real authenticated JWT contexts, not only string inspection. Assert `auth.uid()` resolves to the intended test user. Never use service_role for the subject calls.
- Ensure every test runs in an isolated transaction or resets fixtures; capture SQLSTATE, row counts, audit counts, and before/after snapshots. No network or external providers.

## Negative scenarios

1. Unauthenticated: deny bootstrap, client creation, engagement creation, and launch evidence.
2. U1 active in organization A and firm A1 with advisory.manage: allow valid synthetic create_client, create_engagement, and launch evidence on A1.
3. U1 active in organization A but not member of firm A2: deny all three write RPCs on A2, even with advisory.manage; assert zero new rows and audit events.
4. U1 member of A1 but not organization B: deny all three write RPCs targeting B1; zero new rows.
5. Revoke A1 firm membership (status inactive) after a successful request, reuse the same authenticated session, and deny all three write RPCs; assert no mutations.
6. Restore firm membership, revoke organization A membership, reuse same session, and deny all three RPCs; assert no mutations.
7. Attempt engagement with client from A2 or B1: deny; no cross-firm/cross-org foreign key leakage.
8. Attempt evidence on engagement in A2 or B1: deny; no cross-scope update.
9. Test concurrent revocation and write with deterministic locking; assert writes cannot commit after effective revocation under the chosen isolation/locking contract.
10. Test direct table INSERT/UPDATE/DELETE as authenticated U1: deny; only controlled RPCs may write.

## Additional P0 design gates

- `advisory_actor_org()` selects the first active organization by UUID, not an explicitly bound request organization. Multi-org users need an unambiguous trusted org binding before certification.
- The bootstrap RPC currently inserts firm membership with `on conflict do nothing`; assess reactivation and unauthorized enrollment semantics.
- Verify firm_id/org_id referential consistency: independent foreign keys do not establish same-org relationships. Test attempted mismatched inserts via privileged paths and require composite constraints or equivalent database validation.
- Audit SECURITY DEFINER function ownership, `search_path`, EXECUTE grants, and possible search-path hijack. Do not use production database to verify.
- Define expected revocation semantics for already-running transactions and cached identity permissions; measure against the requirement, not assumptions.

## Release evidence

Attach local database engine/version, isolated-environment attestation, exact SHA, migration hashes, executed commands, test output, SQLSTATEs, and rollback proof. Require GREEN for every negative scenario and no unresolved P0 before merge or deployment.
