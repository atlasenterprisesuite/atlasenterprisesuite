# ATLAS 777 — Unified execution chain (predeploy contract)

Status: P0 NO-GO. This document links independent workstreams; it does not merge branches or grant permissions.

## Sources of truth
- Browser PR #976: `feat/atlas-sovereign-browser-free-777-20261102`; adapter `packages/execution/src/sovereign-browser.ts`.
- Robotics PR #970: `feat/robotics-simulation-tdd-777-20261101`; isolated guard `docs/robotics/f19-guarded-auth-isolated.sql`.
- Each PR must be revalidated against its own current HEAD; no cross-branch SHA equivalence.

## Shared execution contract
1. Derive verified actor from trusted identity, never from request payload.
2. Bind actor, tenant, organization, workflow and step to authorization.
3. Check active membership and effective permission immediately before execution.
4. Serialize permission/membership revocation with operations; fail closed on races.
5. Enforce domain and action allowlists. Browser writes/clicks remain denied until approval and network interception are certified.
6. Emit scoped audit evidence without credentials or document contents.
7. Require negative tests, positive authorized-path tests, PostgreSQL 17 isolated proof, and exact-SHA CI before promotion.

## Evidence and open P0
- Robotics #970 `8ac270c113451f3aa48d625527d0ff028735f651`: eight CI workflows succeeded. Fixture-only authorization and membership concurrency are NOT real JWT, RLS, effective-role revocation certification.
- Browser #976 `07af34b3684cb348af17773264a4f3dcbd7b48ad`: browser SSRF fixture repaired; CI must be rechecked. Hostname filtering is NOT DNS/IP/request-interception SSRF certification.
- No shared runtime adapter or end-to-end cross-executor authorization proof has been implemented.
- No merge, deploy, production credentials, new infrastructure or paid services authorized.

## Acceptance gate
P0 remains NO-GO until the real identity and revocation contract is integrated, cross-executor tests run, exact-SHA checks pass, and security review accepts the resulting evidence.
