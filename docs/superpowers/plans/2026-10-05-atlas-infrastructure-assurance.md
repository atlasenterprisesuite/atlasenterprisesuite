# ATLAS Infrastructure Assurance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved provider-neutral ATLAS Infrastructure Assurance capability so ATLAS can evaluate infrastructure readiness, resilience, compliance, capacity, cost, portability and release impact from evidence rather than configuration claims, with Supabase as the first provider adapter.

**Architecture:** Add a provider-neutral assurance domain to `packages/core`, reuse `atlas-infra-status` as the authenticated infrastructure read boundary, reuse `atlas-infra-evidence` and `atlas_master_evidence_registry` for append-only evidence, and surface the result inside ATLAS Cloud. Release Control consumes only the blocking subset through the existing Manager readiness path, while the detailed protected Cloud route exposes full assurance state.

**Tech Stack:** TypeScript 5.7, React 18, Vitest 5, Supabase Edge Functions (Deno + `@supabase/supabase-js@2`), PostgreSQL/RLS, existing ATLAS Cloud/Release Control CSS and routing.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-infrastructure-assurance-design.md`

## Global Constraints

- Preserve the current production authority: `GitHub → ATLAS Manager / Supabase control plane → Cloudflare → Production`.
- Do not create a standalone “Supabase Center” or a second infrastructure control plane.
- Reuse `atlas-infra-status`, `atlas-infra-evidence`, `atlas-runtime-verifier`, `atlas-sovereign-control-plane`, `atlas-platform-controls`, `atlas-repair-bridge`, `atlas_release_registry`, `atlas_runtime_verification_runs`, `atlas_master_evidence_registry`, `atlas_approvals`, `atlas_integration_connections`, ATLAS Identity, tenancy, RBAC, RLS, audit and observability.
- Every assurance fact distinguishes `desired`, `observed` and `verified`; do not collapse them to one boolean.
- Canonical assurance statuses are `verified`, `partially_verified`, `unverified`, `unknown`, `blocked`, `not_applicable`, `degraded`, `failed`.
- Never render `ready`, `healthy`, `compliant`, `private`, `resilient`, `production`, `connected` or `failover_ready` without verified evidence that supports the label.
- Read Replicas do not satisfy cross-region failover readiness by themselves.
- Provider certifications do not set ATLAS compliance to verified by themselves.
- Configured backup/PITR does not prove recovery; restore evidence is separate.
- Secrets stay server-side and must not enter client bundles, logs or evidence payloads.
- Provider-specific response shapes stay behind provider adapters; ATLAS policy remains provider-neutral.
- Existing protected Cloud routing and organization-scoped authorization remain authoritative.
- No production or release claim is complete without existing exact-SHA, CI, deployment and runtime verification gates.

## Review Focus

1. **Stale evidence:** expired or over-age evidence must degrade to `unverified`/`unknown` and must never preserve a green readiness claim. Covered in Tasks 1 and 4.
2. **Replica/failover confusion:** a Supabase Read Replica without verified failover/runbook evidence must never produce `failover_ready`. Covered in Tasks 1 and 3.
3. **Partial compliance evidence:** provider SOC 2/HIPAA evidence without ATLAS-owned/shared controls must remain partial, not verified compliance. Covered in Tasks 1 and 3.
4. **Secret-shaped input:** tokens, passwords, service-role values and similar credential material must be redacted/rejected before persistence or UI exposure. Covered in Task 4.
5. **Provider/API failure:** unavailable provider probes must produce explicit `unknown`/`degraded` evidence and must not crash the whole assurance response or fabricate readiness. Covered in Task 3.

---

### Task 1: Provider-neutral assurance domain and policy evaluator

**Files:**
- Create: `packages/core/src/infrastructureAssurance.ts`
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/infrastructure-assurance.test.ts`

**Interfaces:**
- Consumes: no new runtime dependencies; uses plain TypeScript values.
- Produces: `AssuranceStatus`, `AssuranceFact<T>`, `InfrastructureProviderProfile`, `RecoveryEvidence`, `SharedResponsibilityControl`, `InfrastructureAssuranceEvidence`, `InfrastructureAssurancePolicy`, `ProviderFitnessScore`, `evaluateAssuranceFact(...)`, `evaluateReleaseAssuranceGate(...)`, `calculateProviderFitnessScore(...)`, `capacityStateForPercent(...)`.

- [ ] **Step 1: Write the failing domain tests.**

Add tests that assert:

```ts
expect(capacityStateForPercent(69.9)).toBe('nominal');
expect(capacityStateForPercent(70)).toBe('watch');
expect(capacityStateForPercent(85)).toBe('warning');
expect(capacityStateForPercent(95)).toBe('critical');
```

Add tests proving: stale evidence cannot remain `verified`; missing evidence becomes `unknown`; a read replica does not satisfy a `failover_ready` P0 requirement; provider-only compliance evidence remains partial; blocking P0 policies make the release gate blocked; Provider Fitness Score uses the approved weights and exposes missing/stale evidence.

- [ ] **Step 2: Run the focused unit test and verify RED.**

Run: `npx vitest run tests/unit/infrastructure-assurance.test.ts`

Expected: FAIL because `packages/core/src/infrastructureAssurance.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal provider-neutral domain.**

Create the exact types and pure evaluators named in **Produces**. Keep evidence freshness and policy evaluation deterministic by accepting `now` as an explicit input rather than reading wall-clock time inside evaluators.

- [ ] **Step 4: Export the domain from `packages/core/src/index.ts`.**

Add:

```ts
export * from './infrastructureAssurance';
```

- [ ] **Step 5: Run the focused test and core typecheck path.**

Run: `npx vitest run tests/unit/infrastructure-assurance.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add packages/core/src/infrastructureAssurance.ts packages/core/src/index.ts tests/unit/infrastructure-assurance.test.ts
git commit -m "feat(assurance): add provider-neutral assurance domain"
```

---

### Task 2: Organization-scoped assurance policies with RLS

**Files:**
- Create: `supabase/migrations/20261005110000_infrastructure_assurance_policies.sql`
- Create: `tests/integration/infrastructure-assurance-policy-migration.test.ts`

**Interfaces:**
- Consumes: `organizations`, `organization_members`, existing identity permission helpers.
- Produces: `public.atlas_infrastructure_assurance_policies` keyed by organization/environment/domain/requirement, with P0/P1/P2 severity, required status, max evidence age and blocking flag.

- [ ] **Step 1: Write the failing migration contract test.**

Assert the migration contains all of:

```ts
expect(sql).toContain('atlas_infrastructure_assurance_policies');
expect(sql).toContain('enable row level security');
expect(sql).toContain("severity in ('P0','P1','P2')");
expect(sql).toContain('max_evidence_age_seconds');
expect(sql).toContain('blocking');
expect(sql).toContain('has_identity_permission');
```

Also assert anonymous access is revoked and authenticated writes are not granted directly unless an existing privileged server path is used.

- [ ] **Step 2: Run the migration contract test and verify RED.**

Run: `npx vitest run tests/integration/infrastructure-assurance-policy-migration.test.ts`

Expected: FAIL because the migration is absent.

- [ ] **Step 3: Create the migration.**

Schema must include: `id`, `org_id`, `environment`, `domain`, `requirement`, `severity`, `required_status`, `max_evidence_age_seconds`, `blocking`, `metadata`, `created_by`, `created_at`, `updated_at`; unique constraint on `(org_id, environment, domain, requirement)`; organization-scoped read policy; privileged-write boundary consistent with current ATLAS server-side governance.

Seed no fabricated provider facts. Default policies may be created only for deterministic ATLAS-owned requirements such as production provider identity, runtime health evidence freshness and cross-region failover proof requirements.

- [ ] **Step 4: Run the focused test.**

Run: `npx vitest run tests/integration/infrastructure-assurance-policy-migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/20261005110000_infrastructure_assurance_policies.sql tests/integration/infrastructure-assurance-policy-migration.test.ts
git commit -m "db(assurance): add tenant-scoped assurance policies"
```

---

### Task 3: Supabase provider adapter and normalized assurance snapshot

**Files:**
- Create: `supabase/functions/_shared/infrastructure-assurance.ts`
- Modify: `supabase/functions/atlas-infra-status/index.ts`
- Create: `tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts`

**Interfaces:**
- Consumes: existing authenticated `atlas-infra-status` request boundary, existing runtime/release verification tables, assurance policies from Task 2, evidence records from `atlas_master_evidence_registry`, provider/runtime environment facts already available to ATLAS Manager.
- Produces: `assurance` object on the `atlas-infra-status` response with `provider_profile`, `domains`, `release_gate`, `fitness_score`, `evidence_summary`, `generated_at`; first provider adapter is `SupabaseProviderAdapter`.

- [ ] **Step 1: Write the failing edge contract tests.**

Assert source/contracts require:

```ts
expect(shared).toContain('SupabaseProviderAdapter');
expect(statusSource).toContain('assurance');
expect(shared).toContain('desired');
expect(shared).toContain('observed');
expect(shared).toContain('verified');
```

Add semantic tests against exported pure helpers proving:

- read replica + no failover evidence => `failover_ready` is not verified;
- configured PITR + no restore drill => backup enabled but recovery unverified;
- PrivateLink DB evidence does not mark Auth/Storage/Realtime/API as private;
- provider certification alone does not verify ATLAS compliance;
- failed/unreachable probe returns domain `unknown`/`degraded` while other independent domains still render.

- [ ] **Step 2: Run focused tests and verify RED.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts`

Expected: FAIL because the shared adapter/snapshot does not exist.

- [ ] **Step 3: Implement `SupabaseProviderAdapter`.**

Keep provider-specific extraction inside `_shared/infrastructure-assurance.ts`. Normalize only evidence ATLAS can actually obtain; unsupported commercial/SLA/cost facts remain `unknown` until contract/document evidence exists. Do not add fake “current plan”, “HIPAA enabled”, “PITR enabled”, RTO/RPO or failover values.

- [ ] **Step 4: Extend `atlas-infra-status` without breaking its current response.**

Keep existing top-level readiness/provider fields intact for current Manager consumers and append the normalized `assurance` object. Increment its service version. Query evidence/policies server-side using the existing service-role boundary after user authorization.

- [ ] **Step 5: Run edge contract plus existing Manager readiness compatibility tests.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts tests/integration/atlas-manager-status-source.test.ts tests/integration/manager-readiness-edge-contract.test.ts tests/integration/manager-readiness-no-mutation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add supabase/functions/_shared/infrastructure-assurance.ts supabase/functions/atlas-infra-status/index.ts tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts
git commit -m "feat(assurance): normalize Supabase infrastructure evidence"
```

---

### Task 4: Append-only assurance evidence and secret-safe persistence

**Files:**
- Modify: `supabase/functions/atlas-infra-evidence/index.ts`
- Create: `tests/integration/atlas-infrastructure-assurance-evidence.test.ts`

**Interfaces:**
- Consumes: Task 1 evidence contract semantics, existing GitHub OIDC boundary, `atlas_runtime_verification_runs`, `atlas_master_evidence_registry`.
- Produces: approved `infrastructure-assurance` verification records and append-only Master Evidence Registry claims that can be superseded, never rewritten.

- [ ] **Step 1: Write failing evidence tests.**

Tests must assert:

- `infrastructure-assurance` is an allowed verification type;
- evidence write preserves `provider`, `domain`, `claim`, status/confidence/freshness metadata;
- raw secret-like fields are rejected or redacted;
- Master Evidence Registry receives a new append-only record rather than an update;
- stale evidence is represented as stale metadata and cannot be promoted to current verified state by the persistence function.

- [ ] **Step 2: Run focused evidence test and verify RED.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-evidence.test.ts`

Expected: FAIL because assurance evidence is not accepted/persisted.

- [ ] **Step 3: Extend `atlas-infra-evidence`.**

Add `infrastructure-assurance` to the allowed verification type set. Reuse the existing OIDC scope and sanitization boundary. For accepted assurance evidence, write the runtime verification row and append a corresponding `atlas_master_evidence_registry` record with a supported existing source type/evidence level/status mapping; put assurance-specific normalized fields in bounded `metadata` rather than altering the canonical evidence schema in this task.

- [ ] **Step 4: Harden secret redaction.**

Expand the existing sanitizer only as required by tests to cover Supabase service-role/JWT/API key/password/token patterns without logging the rejected value.

- [ ] **Step 5: Run evidence and existing infrastructure evidence tests.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-evidence.test.ts tests/integration/atlas-infra-evidence-*.test.ts`

If the glob is not expanded by the shell in the execution environment, run `npx vitest run tests/integration --testNamePattern="infra.*evidence|Infrastructure Assurance"`.

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add supabase/functions/atlas-infra-evidence/index.ts tests/integration/atlas-infrastructure-assurance-evidence.test.ts
git commit -m "feat(assurance): persist append-only infrastructure evidence"
```

---

### Task 5: ATLAS Cloud Infrastructure Assurance protected UI

**Files:**
- Create: `apps/web/src/modules/cloud/AtlasInfrastructureAssurance.tsx`
- Modify: `apps/web/src/modules/cloud/AtlasCloudRoutes.tsx`
- Modify: `apps/web/src/modules/cloud/cloud.css`
- Create: `tests/integration/atlas-infrastructure-assurance-ui.test.tsx`

**Interfaces:**
- Consumes: authenticated `atlas-infra-status` response from Task 3 through the same browser/API boundary pattern already used by current Manager/Cloud features.
- Produces: protected route `/cloud/infrastructure-assurance` with sections `Overview`, `Providers`, `Supabase`, `Resilience`, `Compliance`, `Capacity`, `Cost`, `Portability`, `Evidence`.

- [ ] **Step 1: Write the failing UI/routing tests.**

Assert:

```ts
expect(routes).toContain("'/cloud/infrastructure-assurance'");
expect(routes).toContain('AtlasInfrastructureAssurance');
```

Render the page with fixtures and assert:

- unknown facts render as `Unknown`/`Unverified`, never “Ready”;
- stale evidence shows freshness warning;
- read replica alone does not render “Failover ready”;
- compliance distinguishes Provider / ATLAS / Shared responsibility;
- PrivateLink/service coverage is shown per service boundary;
- cost estimates are labeled `Estimate` and expose assumption/source date;
- Provider Fitness Score displays confidence and missing evidence.

- [ ] **Step 2: Run focused UI test and verify RED.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-ui.test.tsx`

Expected: FAIL because the page and route do not exist.

- [ ] **Step 3: Implement the page as a Cloud child surface.**

Keep view models local to the new file; do not duplicate policy logic from `packages/core`. The page should render evidence-backed sections, blockers and timestamps and should not include provider mutation controls in this wave.

- [ ] **Step 4: Register the route and Cloud Console entry.**

Import `AtlasInfrastructureAssurance` in `AtlasCloudRoutes.tsx`; add the exact route before the fallback console; add one Cloud Console card linking to it. The existing outer Cloud route identity guard remains authoritative.

- [ ] **Step 5: Add focused styles to `cloud.css`.**

Reuse existing Cloud layout/tokens/classes where possible. Add only assurance-specific grid/status/table styles needed for responsive desktop/mobile rendering.

- [ ] **Step 6: Run UI, routing, accessibility-adjacent and build checks.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-ui.test.tsx tests/integration/atlas-cloud-routing.test.tsx && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/src/modules/cloud/AtlasInfrastructureAssurance.tsx apps/web/src/modules/cloud/AtlasCloudRoutes.tsx apps/web/src/modules/cloud/cloud.css tests/integration/atlas-infrastructure-assurance-ui.test.tsx
git commit -m "feat(cloud): add Infrastructure Assurance workspace"
```

---

### Task 6: Release-blocking assurance subset through Manager readiness

**Files:**
- Modify: `supabase/functions/atlas-execution/manager-readiness.ts`
- Modify: `apps/web/src/modules/integration/AtlasIntegrationHubs.tsx`
- Create: `tests/integration/atlas-infrastructure-assurance-release-gate.test.ts`

**Interfaces:**
- Consumes: `atlas-infra-status.assurance.release_gate` from Task 3.
- Produces: Manager readiness records assurance P0/P1 blockers without replacing current provider readiness; Release Control links to the detailed assurance route.

- [ ] **Step 1: Write failing release-gate tests.**

Assert Manager readiness reads `assurance.release_gate`, preserves current provider status compatibility, and adds blocking reasons only when the normalized gate is blocking. Assert Release Control contains a card/link to `/cloud/infrastructure-assurance` and does not duplicate the full assurance UI.

- [ ] **Step 2: Run focused test and verify RED.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-release-gate.test.ts`

Expected: FAIL because current Manager readiness ignores the new assurance gate and Release Control has no assurance link.

- [ ] **Step 3: Extend Manager readiness minimally.**

Map release-blocking assurance P0/P1 reasons into existing readiness/blocker output while leaving existing readiness/provider fields intact. An `unknown` non-blocking P2 fact must not block a release; a blocking P0 policy that is not verified must block.

- [ ] **Step 4: Add the Release Control assurance entry.**

Add one card under canonical verification surfaces with `to: '/cloud/infrastructure-assurance'`; describe it as evidence-backed resilience/compliance/capacity/cost/portability status. Do not add provider mutation actions.

- [ ] **Step 5: Run release/manager compatibility tests.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-release-gate.test.ts tests/integration/manager-readiness-edge-contract.test.ts tests/integration/manager-readiness-no-mutation.test.ts tests/unit/atlas-suite-registry.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add supabase/functions/atlas-execution/manager-readiness.ts apps/web/src/modules/integration/AtlasIntegrationHubs.tsx tests/integration/atlas-infrastructure-assurance-release-gate.test.ts
git commit -m "feat(release): gate releases on infrastructure assurance"
```

---

### Task 7: Cost, portability and provider fitness evidence completion

**Files:**
- Modify: `supabase/functions/_shared/infrastructure-assurance.ts`
- Modify: `apps/web/src/modules/cloud/AtlasInfrastructureAssurance.tsx`
- Modify: `tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts`
- Modify: `tests/integration/atlas-infrastructure-assurance-ui.test.tsx`

**Interfaces:**
- Consumes: provider evidence snapshots, contract/document/operator evidence from the Master Evidence Registry, Task 1 scoring functions.
- Produces: evidence-backed current/10×/enterprise-critical cost scenarios, portability dimensions, and final Provider Fitness Score with confidence/freshness.

- [ ] **Step 1: Add failing cost/portability tests.**

Require:

- missing commercial evidence => cost `unknown`, not `$0`;
- supplied estimate => labeled estimate with source date + assumptions;
- portability explicitly scores Postgres/data export/Auth/Storage/Realtime/Edge/network/secrets/DNS/contract exit dimensions;
- fitness score cannot be “strong strategic fit” when required weighted domains lack fresh evidence.

- [ ] **Step 2: Run focused tests and verify RED.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts tests/integration/atlas-infrastructure-assurance-ui.test.tsx`

Expected: at least the new cost/portability assertions fail.

- [ ] **Step 3: Implement evidence-only cost and portability aggregation.**

Do not hardcode plan prices or contractual SLA values in runtime code. Runtime may display validated evidence values and assumptions stored in evidence metadata. Public-doc pricing from the dossier remains reference documentation, not live provider truth.

- [ ] **Step 4: Wire the final score into the UI.**

Display score, classification, confidence, freshness and missing-evidence count. Never show a current verified classification when the scorer marks required evidence stale/missing.

- [ ] **Step 5: Run focused tests.**

Run: `npx vitest run tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts tests/integration/atlas-infrastructure-assurance-ui.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add supabase/functions/_shared/infrastructure-assurance.ts apps/web/src/modules/cloud/AtlasInfrastructureAssurance.tsx tests/integration/atlas-infrastructure-assurance-edge-contract.test.ts tests/integration/atlas-infrastructure-assurance-ui.test.tsx
git commit -m "feat(assurance): add cost portability and provider fitness"
```

---

### Task 8: Verification, operational runbook, PR and production evidence

**Files:**
- Create: `docs/runbooks/atlas-infrastructure-assurance-runbook.md`
- Modify only if required by path filters: `.github/workflows/release-deployment-control-ci.yml`
- Modify only if the existing verifier requires explicit protected-route registration: relevant production/navigation verifier discovered during execution.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified repository state, operational runbook, PR/CI evidence, merge/deploy evidence, and protected-route E2E verification without fabricating provider readiness.

- [ ] **Step 1: Write the runbook.**

Document: how to read desired/observed/verified state; how to handle stale evidence; how to record approved contract evidence; how to run a restore drill and record evidence; how to interpret replica vs failover; how to investigate a blocking P0; how to roll back code without rewriting evidence history; and what requires human/provider/legal intervention.

- [ ] **Step 2: Run full repository verification.**

Run: `npm run verify:all`

Expected: all checks PASS.

- [ ] **Step 3: Confirm focused test inventory is part of CI.**

Inspect the active PR workflows. If existing global CI already runs `verify:all`, do not add a duplicate workflow. If path filtering would skip the new assurance files, update the existing release/deployment control CI path set instead of creating a parallel CI system.

- [ ] **Step 4: Create/update the PR from `docs/atlas-infrastructure-assurance` to `main`.**

PR title: `feat: add ATLAS Infrastructure Assurance`

PR body must summarize provider-neutral architecture, Supabase adapter, fail-closed evidence rules, RLS/policy migration, Cloud route, Release Control gate and tests.

- [ ] **Step 5: Verify exact PR HEAD CI.**

Require required checks, CodeQL and repository verification to be green on the exact head SHA. Repair failures using RED→GREEN discipline; do not weaken gates.

- [ ] **Step 6: Merge only when required checks are green.**

Use expected-head protection if supported. Do not claim merged until GitHub returns a successful merge result.

- [ ] **Step 7: Verify deployment and production.**

Use the existing GitHub → Supabase/ATLAS Manager → Cloudflare production path. Verify the deployed runtime SHA matches the merged source SHA and the existing global production/P0 gates are green.

- [ ] **Step 8: Verify the protected Infrastructure Assurance route end-to-end.**

With an authenticated ATLAS identity, confirm `/cloud/infrastructure-assurance` loads, unknown/stale evidence remains fail-closed, the Release Control link resolves, and no secrets appear in browser payloads or rendered text. If live provider/commercial evidence is absent, the expected state is `unknown`/`unverified`, not fabricated green.

- [ ] **Step 9: Record final evidence.**

Record the exact source SHA, CI result, deployment identifier, production runtime SHA, route verification result and any still-external-gated provider/commercial facts. Only then may the feature be called production-verified.

- [ ] **Step 10: Commit runbook/CI adjustments if created after the last feature commit.**

```bash
git add docs/runbooks/atlas-infrastructure-assurance-runbook.md .github/workflows/release-deployment-control-ci.yml
git commit -m "docs(assurance): add operations and verification runbook"
```

## Self-Review Result

- **Spec coverage:** core truth model, provider adapter, Supabase scope, tenant isolation policy support, HA/DR, backup/PITR/restore, security/networking, compliance/shared responsibility, capacity, cost, portability, Provider Fitness Score, evidence, policy, Cloud UI, Release Control consumption and operational verification all map to Tasks 1–8.
- **Step scan:** every task follows RED → minimal implementation → GREEN → commit; no implementation body is prescribed where tests/signatures are sufficient.
- **Type consistency:** Task 1 owns canonical types/evaluators; Tasks 3–7 consume those semantics without redefining them.
- **Review Focus:** all five high-risk failure modes have explicit tests in Tasks 1, 3 and 4.
- **Proportion:** the plan specifies contracts, files, tests and gates without transcribing the full implementation.
