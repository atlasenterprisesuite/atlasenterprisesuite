# AUTH RED #1007 — consumer boundary audit

P0 NO-GO. No merge, deployment, production change or real user data.

## Inputs and reproducibility

Audited PR HEAD: `df05ff5902ce2c52ad1ef897a15580e8bb22f98f`.
GitHub reports the PR open, draft and mergeable. The previous seven
successful workflows belong to that SHA only; new commits require new CI.

Four changed source/test files were retrieved from that exact SHA using
the GitHub connector and overlaid into an isolated local worktree based on
`6f7bc8bf7ccb4c50afb347281c934b4cf1925786`. Other local dependencies were
not a complete checkout of PR HEAD. Consequently local test results are
focused reproduction evidence, not whole-repository exact-SHA certification.

## Findings

- The router returns an empty requested-capability set when no capabilities
  were explicitly requested. This is valid routing-only output.
- The handoff rejects that empty set with
  `control_plane_capability_request_required`. No inferred fallback is needed:
  a route decision must not become an executable permission grant.
- Explicit route support does not bypass required actor permission checks.
- A different ready capability or orchestration module is rejected.
- GitHub default-branch code searches for `routeSemanticIntent` and
  `validateAtlasControlPlaneHandoff` returned definitions, owner metadata and
  tests at `e84d93d8e6d3a2f17da3fbbbe8c5d6ea8ee30b12`. Local `rg` found
  the same categories. These searches do not demonstrate an authenticated
  API-to-dispatch production consumer. Indexed search can omit dynamic
  consumers and is not an exhaustive runtime trace.
- `source: server` and supplied actor permissions are inputs to a pure
  contract validator. These unit tests do not prove JWT verification,
  database membership, revocation or an unforgeable server trust boundary.

## Change and validation

Five composition regressions connect the real router to the real handoff:
empty capabilities denied; missing actor permissions denied; substituted
capability denied; switched module denied; explicit authorized chain accepted.
No new production source repair was justified by these passing scenarios.

Focused command:

```sh
vitest run tests/unit/atlas-control-plane-contract.test.ts tests/unit/atlas-control-plane-facades.test.ts tests/unit/atlas-control-plane-source-contract.test.ts
```

Result: 3 files / 36 tests passed locally. `git diff --check` and
`npm run typecheck` passed on the reconstructed worktree.
Synthetic fixture labels such as `payroll:canonical-record` and `audit-1`
are assertions about contract behavior, not external completion evidence.

## Remaining gates

1. Run repository CI on the new PR SHA and inspect executed test steps.
2. Independently review required checks and ruleset enforcement.
3. Trace or implement a separately scoped real authenticated consumer using
   existing execution/context/policy APIs; verify the caller cannot submit
   trusted context or capability grants.
4. Prove denial before dispatch, tenant/organization isolation and live
   permission revocation using an isolated authenticated integration.

Inventory #994 remains documentation; AUTH RED belongs to #1007.
