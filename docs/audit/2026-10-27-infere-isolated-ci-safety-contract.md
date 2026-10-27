# ATLAS 777 — Infere isolated CI safety contract

Status: DESIGN ONLY / P0 OPEN. This document is NOT a runnable GitHub Actions workflow.
Branch baseline: 7133b7f40382bf6a82ae8bd1406ae6b2879c15a1

## Prohibited reuse

Do not invoke `.github/workflows/atlas-local-ai-bootstrap.yml`. It requires self-hosted execution, OIDC, privileged host setup, Supabase production calls, and runtime provisioning.

Do not use `npm run verify:all`, `npm run build`, production verification tasks, or `npm ci` without an audited install policy. Root `postinstall` invokes `scripts/install-render-local-ai.mjs`; it can fetch model binaries when `RENDER=true`. The lockfile contains install scripts and npm registry tarball URLs.

## Proposed manual CI security gate (NOT YET CERTIFIED)

* Require workflow_dispatch ONLY, branch restriction and exact HEAD SHA assertion.
* Restrict permissions to `contents: read`; disable OIDC and repository/environment secrets; avoid self-hosted runners.
* Pin every third-party GitHub Action to its immutable full commit SHA and verify its source and transitive behavior.
* Audit the dependency lockfile and installation scripts; install from approved, integrity-checked offline artifact with lifecycle scripts disabled.
* Block egress by an independently verified runner-level policy BEFORE tests. Shell-level curl blocking or a single firewall rule is not sufficient.
* Use ephemeral filesystem and process namespace; prohibit docker socket, privileged containers and persistent caches; no Supabase keys or production env.
* Execute only `vitest run tests/unit/atlas-infere-routing-security-777.test.ts tests/unit/atlas-unified-ai-chat-routing.test.ts` after isolation proof.
* Typecheck with no build/deploy/postinstall; preserve exit status, logs, input SHA and SHA-256 artifacts.
* Do not mark success if any isolation attestation, test evidence or exact SHA is unavailable.

## Negative tests to add before implementing

1. Explicit route outside allowlist => forbidden; nonempty invalid allowlist => deny all.
2. Fallback must require tenant-scoped privacy classification, provider region approval, consent and an authorized destination; no transmission if absent.
3. Revoked membership or permission between routing and external dispatch => deny.
4. Cross-tenant conversation history and request metadata => deny without leaking content.
5. Budget reserve concurrently in two sessions => at most available allotment; same trace idempotent but changed reservation terms fail closed.
6. UTC-midnight reservation races => single UTC period key matching usage window; no double authorization.
7. Budget RPC identity spoofing => deny; service-role caller must bind actor and tenant to verified authorization context.
8. Errors, model telemetry, logs and artifacts => no bearer tokens, privileged keys, customer prompts or provider secrets.
9. Ambiguous provider timeout => no unauthorized replay or second paid dispatch.
10. PostgreSQL RLS behavior and SECURITY DEFINER function privileges => verify in disposable PostgreSQL with nonprivileged tenant roles; static SQL inspection alone is insufficient.

## Evidence requirements

GitHub run URL, exact commit SHA, immutable action SHA, dependency integrity manifest, no-egress attestation, exit codes, test counts, negative test evidence, privacy gate trace (synthetic only), SQL concurrency logs and rollback proof.

## Stop conditions

No full checkout with verified Git blobs, no isolated prebuilt dependencies, unverifiable outbound restrictions, any configured production key, unexpected scripts, unsafe privileged runner, or unknown changes to HEAD. Remain P0 open. Never merge, deploy, pay, or call Infere.
