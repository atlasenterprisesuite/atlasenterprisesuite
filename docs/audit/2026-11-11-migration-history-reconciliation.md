# ATLAS Core migration history — reconciliation preparation

Status: **P0 OPEN — recovery/replay not verified for execution**
Canonical source inspected: `569b6934d27a3f67963977179f3ec2d1f91818df`.
Authoritative backend: `atlas-core` (`ggmanzcgtlrvqfoccgsh`).

This extends the existing
[Accounting history recovery](2026-09-14-accounting-production-migration-history-reconciliation.md)
and the existing `scripts/verify-edge-source.mjs` source checks. The source check
validates entrypoints and nonempty SQL; it does not establish live migration
alignment. The new audit is a dedicated read-only comparison, not a replacement
production verifier or an automatic migration executor.

## Observed evidence

The Supabase check for merged PR #1034 reported `Remote migration versions not
found in local migrations directory.` A separate preview project reported a
Postgres connection timeout; a timeout does not prove a migration defect.

| Comparison | Result |
| --- | ---: |
| Remote recorded migrations | 319 |
| Local SQL files | 142 |
| Remote versions absent locally | 300 |
| Local files whose version is not recorded remotely | 123 |
| Duplicate local version prefixes | 2 (`20260912`, `20260920160000`) |
| Local versions shorter than the required 14-digit timestamp | 15 |
| Existing version matches with different source hashes | 8 |
| Same-name/different-version pairs with identical trimmed SQL | 84 |
| Same-name/different-version pairs with different trimmed SQL | 18 |

The paired counts are not counts of unique migrations: a historical name can
appear more than once. All categories may overlap and must not be added together.

All 319 remote records retain their original SQL statements (about 1.77 MB).
The inspected SQL produced zero Sentinel P0 credential findings and no matches
for additional token/private-key patterns. This is a source scan, not a complete
security certification. Raw SQL is not included in the committed inventory.

An additional offline PostgreSQL AST comparison parsed all 319 sources. Ignoring
all parser location fields, 94 same-name/different-version pairs had equal ASTs; 8 pairs
remained different. AST equality is not proof of authorization, runtime behavior,
or successful replay. The executable gate intentionally uses the stricter body
hashes and never treats a candidate rename as aligned migration history.

## Reproduce the safe audit

The inventory stores only version/name/SHA-256 metadata, export time and source
revision. Hashes cover joined stored statements separated by semicolon/newline,
with only outer whitespace trimmed. They do not normalize comments or SQL bodies.

```bash
node scripts/audit-supabase-migration-history.mjs \
  --project-id ggmanzcgtlrvqfoccgsh \
  --inventory docs/audit/evidence/2026-11-11-atlas-core-migration-inventory.json \
  --output /tmp/atlas-migration-audit.json
```

The observed exit code is **1**, with `status: blocked`. A stale, future-dated,
empty, wrong-project or malformed inventory also blocks. The 24-hour freshness
limit requires a fresh read-only export before using the audit for later work.
Exit 0 means a fresh **snapshot** aligns; it never attests a live database.
The committed report is historical evidence, not a continuously current status.

## Concrete recovery sequence

1. Recover original SQL under the authoritative version IDs, preserving hashes,
   source provenance and a reversible Git diff. Reuse the earlier Accounting
   recovery approach. Do not add placeholder/comment-only migrations.
2. Review all eight same-version source differences and the eight differing AST
   pairs. Prove each mapping before retiring a local alias. Keep unmatched local
   work classified as unverified, rather than marking it applied remotely.
3. Prove the proposed full chain on an isolated PostgreSQL/Supabase environment,
   including required extensions, RLS, tenant isolation and existing backend gates.
   No Docker or `psql` executable was available in this session, and creating a
   network-isolated namespace with `unshare -n` was denied by the environment.
   Replay has not been run. Parsing SQL does not substitute for executing this gate.
4. Re-export production history, verify the plan has not drifted, and review the
   exact diff before any source recovery merge that could trigger remote SQL.
5. Observe Supabase deployment checks and canonical production verification.

No `migration repair`, `db push`, reset, schema DDL, history-table write or
production SQL replay was performed. Existing migrations were not renamed,
deleted or marked applied. This PR prepares a verifiable recovery; it does not
close the production migration P0.

### Concrete source repair

`20261009155301_atlas_certificate_existing_oidc_evidence_adapter.sql` was missing
the semicolon after the closing `$function$` delimiter. PostgreSQL parsing failed
at the following `REVOKE`. Adding that terminator repairs the local SQL syntax;
the resulting full SQL AST matches the already-recorded production source when
all parser location fields are excluded. No remote SQL execution is needed for
this source repair. Its body hash still differs because source comments/formatting
are preserved, so the stricter hash audit continues to show that difference.

The initial AST comparison retained an `arg_location` position field, overstating
different pairs as 10. Removing all parser position fields corrects the result
to eight; this correction does not change the strict SHA-256 audit or its P0.

Parsing the remaining local SQL also found malformed dollar delimiters and a
missing final block semicolon in `tax_import_source_mapping`, inside
`20260921201000_tax_productive_core.sql`. The proposed source-only repair restores
`as $$ ... end; $$;` without changing the function logic. After both repairs,
all 142 local files parse with pglast v8.7. This parser check is not a PostgreSQL 17
execution or a PL/pgSQL runtime/schema/authorization test; isolated replay is
still required. The tax migration remains unverified against live history.

## Validation of this preparation

- 15 focused unit/CLI checks passed, including a real filesystem/child-process
  path that returns exit 0 only for aligned evidence, exit 1 for drift and exit 2
  when an output would overwrite its input inventory.
- Full `npm test`: 2,569 Vitest tests in 538 files, 8 Node security tests and
  13 Local Core tests passed (2,590 assertions/tests across those runners).
- After the two SQL source repairs, 29 focused audit/certificate/tax checks passed;
  the final full `npm test` again passed all 2,590 tests.
- Final changed-source Sentinel scan: zero P0, 15 P1 `SECURITY_DEFINER` declarations
  in the existing Tax migration, zero P2. These declarations were not introduced
  or changed by the delimiter repair; their authorization intent remains subject
  to review. Node syntax check and `git diff --check` passed.
- The actual migration audit returned `blocked` / exit 1. This is the expected
  truthful result of the history inspection, not a passing migration release.

## Other closure boundaries

- PR #1034 web deployment passed its canonical P0/P1 exact-SHA gate. That does
  not certify the separate migration history. A fresh independent run during
  this follow-up again passed health/security headers and the global fail-closed
  gate for `569b6934d27a3f67963977179f3ec2d1f91818df`, with
  `production_commit_sha_verified: true` and `p1_warning_count: 0`.
- Siri still requires creating/running the shortcut on the user's iPhone.
  A web response cannot establish that Siri executed a voice command.
- Health advisors returned no notices at inspection. Security advisors returned
  informational RLS-without-policy notices and warnings requiring intent review,
  not automatic grant/policy changes. References:
  [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  [authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
