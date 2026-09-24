# ATLAS Neural Integrity System — Architecture Design

Date: 2026-09-16
Status: Proposed for implementation after human review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-neural-integrity`

## 1. Purpose

ATLAS already has strong subsystem tests, canonical module metadata, identity boundaries, Supabase-backed services, Cloudflare deployment verification, and evidence recording. The remaining risk is cross-system drift: a module can exist in the registry but not resolve correctly, a route can bypass its intended identity boundary, an orchestrator can be healthy while still using non-durable memory, or a custom domain can be reachable without proving that it serves the exact commit that was deployed.

The Neural Integrity System closes those gaps by treating the ATLAS ecosystem like a living organism and a tree:

- roots / marrow = durable data, migrations, tenant scope and secrets;
- trunk / spinal cord = routing, module registry and shared transport;
- brain = Sovereign AI Orchestrator and governance;
- nerves / branches = module routes, APIs, integrations and provider adapters;
- skin / bark = Cloudflare Worker and security headers;
- senses / growth rings = tests, probes, readiness and evidence.

The system must turn this analogy into executable contracts. A connection is not considered healthy because a file exists; it is healthy only when the relevant contract is tested and, where applicable, verified against the deployed runtime.

## 2. Scope

This implementation closes four concrete gaps:

1. Replace the Sovereign AI Orchestrator's implicit in-memory production path with an explicit durable persistence path backed by Supabase and a fail-closed production readiness contract.
2. Remove unreachable legacy routing from `apps/web/src/main.tsx` so the root router has one authoritative path for each top-level route family.
3. Upgrade production verification from "the custom domain responds" to "the custom domain serves the exact Git commit that this workflow deployed".
4. Add a repository-wide Neural Integrity verification layer that checks module registry, route ownership, authentication boundaries, runtime readiness contracts and deployment attestation as one system.

The work must preserve current module behavior and must not weaken ATLAS Identity, RLS, approval gates, Cloudflare protections, or existing production evidence semantics.

## 3. Current-state findings

### 3.1 Orchestrator persistence

`createAtlasRuntime()` currently defaults to `InMemoryPersistence`, whose `durable` flag is false. The HTTP runtime calls `createAtlasRuntime()` without injecting a durable adapter. The readiness contract correctly returns `503` with `persistence_not_durable`, so the current code is fail-closed but not production-ready as a standalone sovereign runtime.

### 3.2 Root routing

`apps/web/src/main.tsx` returns `<App />` before legacy `/voice` routing code and a second Hospitality fallback. That code is unreachable. Canonical Voice routing already exists under `/studio/voice`; the dead path is architectural residue and must be removed rather than reactivated.

### 3.3 Custom-domain verification

The Cloudflare workflow now verifies `https://www.atlasenterprisesuite.com` and critical production routes after deploy. That is a substantial improvement. However `apps/web/public/deployment.json` contains a static deployment probe rather than the current `GITHUB_SHA`, so route reachability alone does not prove that the custom domain is serving the exact commit deployed by the current workflow.

### 3.4 Cross-system verification

Existing tests cover module registry shape, registry-driven shell navigation, Identity routes, Galaxy routing, Cloudflare contracts, Manager evidence, orchestrator readiness and many module-specific flows. There is no single fail-closed contract that traverses the ecosystem from module metadata through routing/auth and then ties production evidence back to an exact source commit.

## 4. Chosen architecture

Use an additive verification layer and small targeted repairs. Do not replace the existing router, module registry, deployment pipeline, Supabase architecture or orchestration contracts.

### 4.1 Durable orchestrator persistence

Add `SupabasePersistence` behind the existing `PersistencePort` interface.

The adapter is server-only. It is never imported by browser code and never exposes privileged credentials to the web bundle.

Environment contract:

- `ATLAS_PERSISTENCE_MODE=supabase` selects durable mode.
- `SUPABASE_URL` is required in durable mode.
- `SUPABASE_SERVICE_ROLE_KEY` is required in durable mode and remains server-only.
- `ATLAS_PERSISTENCE_MODE=memory` is permitted only for local/test execution.
- when no mode is supplied, the standalone HTTP runtime must fail closed for production-style startup rather than silently claim readiness.

Persistence tables:

- `atlas_orchestrator_tasks`
- `atlas_orchestrator_events`

Every row carries tenant and organization scope. Task identity is unique within scope. Events are append-only at the application contract level. Reads and updates always filter by tenant + organization + task id.

A new migration creates the tables, indexes, constraints and RLS policies. The service-role adapter still applies explicit scope predicates on every operation; RLS remains defense in depth for non-service-role access. No browser client receives service-role access.

`createAtlasRuntime()` remains injectable for tests. The HTTP entrypoint resolves the persistence implementation from environment and exposes durable readiness truthfully.

### 4.2 Root router cleanup

`RootRouter` keeps only three decisions:

- `/hospitality*` -> `HospitalityRoutes`
- `/ride*` -> `RideRoutes`
- everything else -> `App`

Remove unused `AtlasShell` and `AtlasVoicePage` imports from `main.tsx`. Do not create a new `/voice` route. Canonical Voice remains `/studio/voice` behind the existing ATLAS Identity contract.

### 4.3 Exact deployment attestation

Before the production build, CI generates `apps/web/public/deployment.json` for that workflow run with:

- service name;
- `commit_sha = GITHUB_SHA`;
- source = `github-main`;
- target = Cloudflare Workers static assets;
- build/run metadata safe for public exposure.

After deploy, the workflow fetches `/deployment.json` from:

1. the directly deployed `workers.dev` URL when direct Wrangler mode is used;
2. `https://www.atlasenterprisesuite.com/deployment.json` for both deployment modes.

The workflow fails unless `commit_sha` exactly equals `GITHUB_SHA` for the production custom domain. Cache bypass headers are used, redirects are constrained to the expected origin, and a Cloudflare challenge is handled only through the existing authorized verifier path.

ATLAS Manager evidence records `production_commit_sha_verified=true` only after this equality check succeeds. It must never infer this value from the workflow SHA alone.

### 4.4 Neural Integrity verification layer

Add `scripts/verify-neural-integrity.mjs` and corresponding Vitest contracts.

The verifier checks:

- every surfaced `ATLAS_MODULES` entry has a non-empty canonical route;
- every surfaced route resolves through an explicitly recognized route owner (`RootRouter`, `App`, extension resolver, or dedicated module router);
- each module marked `requiresAuth: true` is covered by an ATLAS Identity guard at its route boundary;
- no duplicate canonical top-level route exists across route owners;
- no known legacy route is accidentally reintroduced as authoritative;
- `main.tsx` contains no statements after the unconditional `<App />` return inside `RootRouter`;
- orchestrator production readiness cannot be true with non-durable persistence;
- durable persistence tables/migration and adapter exist together when Supabase mode is supported;
- Cloudflare workflow contains exact-SHA custom-domain attestation and Manager evidence only after successful attestation.

The script is added to `verify:all` after integration tests and before the production build. It prints a compact organ/tree status map and exits non-zero on broken critical connections.

The verifier must be based on explicit contracts rather than broad text heuristics wherever possible. Static source checks are acceptable only for boundaries that cannot reasonably be imported into the Node verification process, such as GitHub Actions YAML.

## 5. Data model

### `atlas_orchestrator_tasks`

Required fields:

- `tenant_id text not null`
- `organization_id text not null`
- `task_id text not null`
- `schema_version integer not null`
- `state text not null`
- `task_json jsonb not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Primary/unique key: `(tenant_id, organization_id, task_id)`.

### `atlas_orchestrator_events`

Required fields:

- `id uuid primary key`
- `tenant_id text not null`
- `organization_id text not null`
- `task_id text not null`
- `event_type text not null`
- `event_json jsonb not null`
- `occurred_at timestamptz not null`

Index: `(tenant_id, organization_id, task_id, occurred_at, id)`.

The JSON payload remains the source-compatible representation of the canonical TypeScript contracts while selected columns support safe scoping, indexing and diagnostics.

## 6. Security and fail-closed behavior

- Service-role credentials remain server-only and are never committed, logged or returned.
- Missing durable persistence configuration must not silently fall back to a production-ready state.
- Every persistence operation includes tenant and organization filters.
- Events are append-only through the `PersistencePort` implementation.
- Custom-domain commit verification fails closed on mismatched SHA, unexpected redirect/origin, malformed JSON or missing attestation.
- A Cloudflare challenge may use the existing authorized verifier, but that verifier must return the observed production commit SHA before the workflow can mark the exact version verified.
- No module receives weaker authentication as part of this work.

## 7. Testing strategy

TDD is mandatory.

### Unit tests

- Supabase persistence request mapping, scope predicates, cloning/serialization and failure handling using mocked `fetch`.
- persistence-mode resolver: memory for explicit local/test mode; Supabase only with complete server configuration; fail closed otherwise.
- readiness remains false for non-durable persistence.
- neural integrity contract parser/status projection.

### Integration tests

- migration contains required tables, keys, indexes and RLS declarations;
- `main.tsx` has no unreachable legacy route branch;
- all surfaced registry modules resolve to an approved route owner;
- all auth-required module routes have a recognized Identity boundary;
- Cloudflare workflow generates a per-run deployment manifest and compares production `commit_sha` to `GITHUB_SHA`;
- Manager evidence cannot set `production_commit_sha_verified=true` before the comparison gate.

### Repository verification

`npm run verify:all` must pass in full. Existing test suites must remain green. Warnings are recorded separately and do not become silent failures.

## 8. Production truth states

The Neural Integrity System uses ATLAS truth vocabulary:

- `IMPLEMENTED`: code and migration exist.
- `TESTED`: repository verification is green.
- `DEPLOYED`: Cloudflare or Supabase deployment evidence exists for the relevant artifact.
- `VERIFIED IN PRODUCTION`: live runtime probes and exact commit attestation pass.
- `BLOCKED`: an internal dependency prevents progress.
- `EXTERNAL DEPENDENCY`: provider authorization or external service configuration is required.

The orchestrator is not `VERIFIED IN PRODUCTION` merely because the adapter exists. It reaches that state only after the durable backend is deployed/configured and `/readyz` reports ready against the durable adapter.

## 9. Implementation order

1. RED tests for root-router cleanup, persistence mode and exact deployment SHA attestation.
2. Remove unreachable root-router code.
3. Add durable Supabase persistence adapter and migration.
4. Wire HTTP runtime persistence resolution and readiness.
5. Generate per-run deployment manifest and exact-SHA production checks.
6. Add Neural Integrity verifier and integrate it into `verify:all`.
7. Run complete repository verification.
8. Open PR and require existing CI gates.
9. Merge only after green checks.
10. Verify Cloudflare deploy and production custom-domain SHA attestation.
11. Deploy/verify the Supabase migration/runtime configuration separately if the production orchestrator host is authorized and available; otherwise report it as `EXTERNAL DEPENDENCY`, not complete.

## 10. Acceptance criteria

The work is accepted when all of the following are true:

- no unreachable legacy routing remains in `main.tsx`;
- the standalone orchestrator has an explicit durable Supabase path and cannot report production readiness on in-memory persistence;
- tenant/org scope is enforced in every persistence operation;
- the custom production domain proves it serves the exact workflow `GITHUB_SHA`;
- ATLAS Manager evidence distinguishes route reachability from exact-version verification;
- `npm run verify:all` includes and passes Neural Integrity verification;
- all existing tests remain green;
- no secret is committed or printed;
- any unconfigured live orchestrator dependency remains truthfully labeled `EXTERNAL DEPENDENCY` rather than being simulated.
