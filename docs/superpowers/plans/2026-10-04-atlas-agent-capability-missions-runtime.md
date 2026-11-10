# ATLAS Agent Capability + Missions Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the approved ATLAS capability-discovery and missions architecture end-to-end on the existing telecom/Telnyx stack without creating a second workflow engine or bypassing the Carrier Control Plane.

**Architecture:** Extend `@atlas/execution` with a small canonical capability registry, policy evaluator, mission projection, and generated agent manifest. Reuse the existing `execution_workflows/tasks/steps/evidence/audit` tables as mission truth, route telecom execution through the existing organization-scoped Edge Function and Telnyx adapter, add idempotency/reconciliation at the provider-write boundaries, and prove one reversible number-order test path under a disabled-by-default P0 write gate.

**Tech Stack:** TypeScript 5.7, Node 22, Deno/Supabase Edge Functions, PostgreSQL/Supabase, Vitest 5, GitHub Actions, existing ATLAS production verification.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-agent-capability-missions-runtime-design.md`

## Global Constraints

- `packages/execution` remains the authoritative workflow/task/step/evidence/audit engine; do not create a second mission state machine or mission persistence hierarchy.
- Telnyx remains a replaceable provider adapter behind ATLAS policy and Carrier Control Plane boundaries.
- Capability declaration never implies provider readiness, authorization, ownership, provisioning, or production truth.
- Tenant/organization/actor scope is resolved server-side and cross-tenant mutations fail closed.
- P0 writes require explicit authorization, stable idempotency, durable evidence, and fail-closed verification; no mandatory P0 check may use `continue-on-error`.
- A provider lookup error is distinct from a confirmed empty result.
- One logical mutation keeps one idempotency key through retries and recovery; materially different payloads using the same key are conflicts.
- Ambiguous provider outcomes enter reconciliation and are never blindly repeated.
- Resource creation follows `DISCOVER -> VERIFY -> REUSE -> ADOPT ONLY IF SAFE -> CREATE ONLY IF REQUIRED`.
- Secrets, API keys, webhook keys, activation material, and raw provider error bodies never enter browser responses, capability manifests, mission events, or committed fixtures.
- Existing Telnyx public-key readiness validation and monotonic webhook reconciliation already present on `main` must be reused, not reimplemented.
- Existing `atlas_number_resources` truth gates remain authoritative: search results are not owned resources and positive lifecycle states require the existing authenticated evidence/authorization rules.
- Production deployment success and carrier/provider activation truth remain separate facts.

## Review Focus

- **Uncertain provider result:** a network timeout after a Telnyx POST must persist `reconciliation_required` and a retry with the same key must not issue a second POST.
- **Duplicate logical request with changed payload:** same idempotency key plus a different normalized request digest must return `idempotency_conflict`, not reuse or overwrite the original operation.
- **Stale/missing provider readiness:** capability policy must return `blocked/degraded`; it must never choose a provider merely because a binding is declared.
- **Provider inventory ambiguity:** Telnyx `5xx/429/transport error` during number discovery must produce `lookup_error`, never the same result as `no_matches`.
- **Cleanup failure:** a test-created phone number whose delete job fails or remains incomplete must leave P0 verification failed with durable cleanup evidence; it must not be marked released locally.

---

### Task 1: Add the canonical capability schema and telecom registry

**Files:**
- Create: `packages/execution/src/capability-types.ts`
- Create: `packages/execution/src/capability-registry.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-capability-registry.test.ts`

**Interfaces:**
- Produces: `type AtlasCapabilityOperation = 'read' | 'write' | 'execute' | 'stream'`
- Produces: `type AtlasCapabilityRiskTier = 'P0' | 'P1' | 'P2'`
- Produces: `type AtlasCapabilityRuntimeState = 'declared' | 'implemented' | 'configured' | 'authorized' | 'verified' | 'degraded' | 'blocked' | 'unavailable'`
- Produces: `interface AtlasProviderBinding { provider: string; adapter: string; environments: string[]; regions?: string[]; priority: number; healthCheck: string; writePolicy?: string }`
- Produces: `interface AtlasCapabilityDefinition` with all semantic fields required by the approved spec.
- Produces: `ATLAS_TELECOM_CAPABILITIES: readonly AtlasCapabilityDefinition[]`
- Produces: `resolveCapability(id: string): AtlasCapabilityDefinition`
- Produces: `listCapabilities(domain?: string): readonly AtlasCapabilityDefinition[]`

Initial definitions:
- `communications.voice.readiness` — `read`, `P1`, permission `communication.telephony.read`, no external mutation.
- `communications.number.search` — `read`, `P1`, permission `communication.telephony.read`, no ownership claim.
- `communications.voice.call.create` — `execute`, `P0`, permission `communication.telephony.call`, external mutation, requires evidence.
- `communications.webhook.verify` — `execute`, `P0`, server-internal verification primitive, no browser-callable provider binding.
- `communications.number.provision.test` — `write`, `P0`, permission `communication.telephony.provision`, external cost, disabled outside an explicit test environment/write gate.

- [ ] **Step 1: Write the failing registry tests**

Add tests asserting that the five IDs above are unique, version `1`, have non-empty domain/title/description/schema refs/verification policy, and that P0 definitions cannot omit `requiresEvidence`. Assert `resolveCapability('unknown')` throws `capability_not_found:unknown`.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/unit/execution-capability-registry.test.ts`
Expected: FAIL because the capability modules do not exist.

- [ ] **Step 3: Implement the types and registry**

Keep this package pure TypeScript with no provider SDK dependency. Provider bindings declare adapter names only; they do not contain credentials or runtime readiness.

- [ ] **Step 4: Export the new modules**

Add exports from `packages/execution/src/index.ts`.

- [ ] **Step 5: Run the focused test**

Run: `npx vitest run tests/unit/execution-capability-registry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/execution/src/capability-types.ts packages/execution/src/capability-registry.ts packages/execution/src/index.ts tests/unit/execution-capability-registry.test.ts
git commit -m "feat(execution): add canonical capability registry"
```

---

### Task 2: Generate an agent-facing capability manifest and enforce drift

**Files:**
- Create: `scripts/generate-atlas-capability-manifest.ts`
- Create: `docs/generated/atlas-agent-capabilities.json`
- Create: `tests/unit/execution-capability-manifest.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `listCapabilities()` from Task 1.
- Produces: `buildCapabilityManifest(): { schema_version: 1; generated_from: 'packages/execution/src/capability-registry.ts'; capabilities: ...[] }`
- Produces npm script: `generate:capabilities` = `node --experimental-strip-types scripts/generate-atlas-capability-manifest.ts`
- Produces npm script: `verify:capabilities` that exits non-zero when regenerated JSON differs from the committed artifact.

The generated projection must include capability ID, version, domain, operation, risk tier, mutation/cost/approval/evidence flags, permissions, allowed environments, schema refs, verification policy, skill/guide refs, and provider names/adapters. It must never contain runtime secrets, credential presence, tenant data, or `verified/connected` state.

- [ ] **Step 1: Write the failing manifest tests**

Assert deterministic ordering by capability ID, no fields matching `/api.?key|secret|token|credential_value/i`, and exact equality between the committed JSON and `buildCapabilityManifest()`.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/unit/execution-capability-manifest.test.ts`
Expected: FAIL because the generator/artifact do not exist.

- [ ] **Step 3: Implement the generator and committed artifact**

Use Node 22 strip-types, matching the repository's existing Node-based TypeScript execution pattern. Serialize with two-space indentation plus a trailing newline for deterministic diffs.

- [ ] **Step 4: Add generation/verification scripts**

Add `generate:capabilities` and `verify:capabilities` without changing existing scripts' semantics.

- [ ] **Step 5: Verify determinism and drift detection**

Run: `npm run generate:capabilities && npm run verify:capabilities && npx vitest run tests/unit/execution-capability-manifest.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-atlas-capability-manifest.ts docs/generated/atlas-agent-capabilities.json tests/unit/execution-capability-manifest.test.ts package.json
git commit -m "feat(execution): generate capability manifest"
```

---

### Task 3: Add Mission/Run/Event projections over existing execution truth

**Files:**
- Create: `packages/execution/src/mission-projection.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-mission-projection.test.ts`

**Interfaces:**
- Consumes existing `ExecutionWorkflow`, `ExecutionTask`, `ExecutionStep`, `ExecutionEvidence`, `ExecutionAuditEvent`.
- Produces: `type AtlasMissionRunState = 'pending' | 'running' | 'paused' | 'blocked' | 'succeeded' | 'failed' | 'cancelled'`
- Produces: `interface AtlasMissionProjection { missionId: string; workflowId: string; scope: ExecutionScope; ownerModule: string; requestedOutcome: string; capabilityIds: string[]; state: AtlasMissionRunState; currentTaskId: string | null; correlationId: string | null; createdAt: string; updatedAt: string }`
- Produces: `interface AtlasMissionEventProjection { eventId: string; missionId: string; workflowId: string; taskId: string | null; capabilityId: string | null; type: string; correlationId: string | null; evidenceIds: string[]; createdAt: string }`
- Produces: `projectMission(input): AtlasMissionProjection`
- Produces: `projectMissionEvents(input): AtlasMissionEventProjection[]`

Mapping rules:
- mission ID is the canonical workflow ID; no new persisted mission ID is minted.
- `completed` -> `succeeded`; `failed` -> `failed`; `cancelled` -> `cancelled`; `blocked/awaiting_approval` -> `blocked`; active `now/next/automatable/delegated` -> `running`; `draft` -> `pending`.
- capability IDs are read from bounded workflow/task context metadata only after validating them against the registry.
- mission events are projections of existing audit/evidence lineage; no event table is created.

- [ ] **Step 1: Write failing projection tests**

Cover every state mapping, invalid capability IDs being excluded with an explicit projection warning/result, stable correlation IDs, and proof that `missionId === workflow.id`.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/unit/execution-mission-projection.test.ts`
Expected: FAIL because `mission-projection.ts` does not exist.

- [ ] **Step 3: Implement the pure projection functions**

Do not add persistence or mutate execution state.

- [ ] **Step 4: Export and verify**

Run: `npx vitest run tests/unit/execution-mission-projection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src/mission-projection.ts packages/execution/src/index.ts tests/unit/execution-mission-projection.test.ts
git commit -m "feat(execution): project missions from execution truth"
```

---

### Task 4: Add the provider-neutral capability policy gateway

**Files:**
- Create: `packages/execution/src/capability-policy.ts`
- Modify: `packages/execution/src/index.ts`
- Create: `tests/unit/execution-capability-policy.test.ts`

**Interfaces:**
- Consumes: `AtlasCapabilityDefinition`, `AtlasProviderBinding`, `ExecutionActor`.
- Produces: `interface CapabilityPolicyContext { actor: ExecutionActor; environment: string; jurisdiction?: string; approved: boolean; runtimeProviderStates: Readonly<Record<string, { state: AtlasCapabilityRuntimeState; verifiedAt: string | null }>>; now: string }`
- Produces: `type CapabilityPolicyDecision = { allowed: true; capability: AtlasCapabilityDefinition; provider: AtlasProviderBinding | null } | { allowed: false; capability: AtlasCapabilityDefinition; blocker: string }`
- Produces: `evaluateCapabilityPolicy(capabilityId: string, context: CapabilityPolicyContext): CapabilityPolicyDecision`

Evaluation order is binding:
1. resolve capability;
2. actor permission;
3. allowed environment;
4. approval when required;
5. provider binding eligibility;
6. provider runtime state/readiness;
7. choose the lowest numeric `priority` among verified eligible bindings.

Blockers include `missing_permission:<permission>`, `environment_not_allowed`, `approval_required`, `provider_not_configured`, `provider_not_verified`, and `provider_binding_unavailable`.

- [ ] **Step 1: Write failing policy tests**

Test the exact ordering above. Include a case where a high-priority provider is declared but degraded and a lower-priority provider is verified; the verified provider wins. Include a case where no provider is chosen for the server-internal webhook verification primitive.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/unit/execution-capability-policy.test.ts`
Expected: FAIL because the policy gateway does not exist.

- [ ] **Step 3: Implement the evaluator**

Keep it pure and deterministic. No network or database reads belong in this module.

- [ ] **Step 4: Export and verify**

Run: `npx vitest run tests/unit/execution-capability-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/execution/src/capability-policy.ts packages/execution/src/index.ts tests/unit/execution-capability-policy.test.ts
git commit -m "feat(execution): enforce capability policy before providers"
```

---

### Task 5: Add Telnyx read-only number discovery with tri-state truth

**Files:**
- Modify: `supabase/functions/_shared/telephony-telnyx.ts`
- Modify: `tests/unit/atlas-telephony-telnyx.test.ts`
- Modify: `supabase/functions/atlas-communication-telephony/index.ts`
- Create: `tests/unit/atlas-telephony-capability-api.test.ts`

**Interfaces:**
- Produces: `type TelnyxNumberCandidate = { phoneNumber: string; reservable: boolean; quickship: boolean; bestEffort: boolean; costInformation: Record<string, unknown> | null }`
- Produces: `type TelnyxNumberSearchResult = { status: 'matches'; candidates: TelnyxNumberCandidate[]; requestId: string | null } | { status: 'no_matches'; candidates: []; requestId: string | null } | { status: 'lookup_error'; candidates: []; requestId: string | null; blocker: string; statusCode: number | null }`
- Produces: `searchTelnyxAvailableNumbers(config, criteria, fetchImpl?): Promise<TelnyxNumberSearchResult>` using `GET https://api.telnyx.com/v2/available_phone_numbers`.
- Edge API adds `GET ?api=number-search` requiring `communication.telephony.read` and accepting bounded query fields `country_code`, `area_code`, `limit` (`1..20`).

Truth rules:
- only `2xx` with an empty `.data` is `no_matches`;
- 401/403/429/5xx/transport errors are `lookup_error` with normalized blockers;
- returned candidates are labeled discovery only and are not inserted into `atlas_number_resources` by this read endpoint.

- [ ] **Step 1: Add failing provider tests**

Cover `matches`, confirmed empty, 401, 403, 429, 500, malformed data, and transport failure. Assert no API key appears in results.

- [ ] **Step 2: Run provider tests**

Run: `npx vitest run tests/unit/atlas-telephony-telnyx.test.ts`
Expected: FAIL for missing search function/types.

- [ ] **Step 3: Implement the Telnyx search helper**

Use the current Telnyx v2 contract: `GET /available_phone_numbers`. Bound page size to 20 and normalize only fields needed by ATLAS.

- [ ] **Step 4: Add Edge route tests**

Test permission denial, missing provider config, verified provider path, invalid limit/area code, and that the JSON response contains `ownership: 'discovered_only'` (or equivalent explicit truth label) and no secret values.

- [ ] **Step 5: Add the read-only Edge operation**

Reuse `resolveContext`, `requirePermission`, `loadConfig`, and readiness. Do not create a second auth/config layer.

- [ ] **Step 6: Verify**

Run: `npx vitest run tests/unit/atlas-telephony-telnyx.test.ts tests/unit/atlas-telephony-capability-api.test.ts`
Expected: PASS.

Run: `npm run verify:edge`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/telephony-telnyx.ts supabase/functions/atlas-communication-telephony/index.ts tests/unit/atlas-telephony-telnyx.test.ts tests/unit/atlas-telephony-capability-api.test.ts
git commit -m "feat(telephony): add truthful Telnyx number discovery"
```

---

### Task 6: Make outbound call creation idempotent and reconciliation-safe

**Files:**
- Create: `supabase/functions/_shared/telephony-idempotency.ts`
- Create: `tests/unit/atlas-telephony-idempotency.test.ts`
- Create: `supabase/migrations/20261004_atlas_call_idempotency.sql`
- Modify: `supabase/functions/atlas-communication-telephony/index.ts`
- Modify: `tests/unit/atlas-telephony-capability-api.test.ts`

**Interfaces:**
- Produces: `normalizeCallMutationInput(input): { to: string; purpose: string; consentReference: string }`
- Produces: `digestLogicalMutation(value: unknown): Promise<string>` returning lowercase SHA-256 hex.
- Produces: `classifyIdempotentReplay(input): 'new' | 'reuse' | 'conflict' | 'reconciliation_required'`.
- Migration adds to `public.atlas_call_sessions`:
  - `idempotency_key text`;
  - `request_digest text`;
  - `reconciliation_required boolean not null default false`;
  - `reconciliation_reason text`;
  - unique partial index on `(organization_id, idempotency_key)` where key is not null.

Request contract:
- `POST ?api=call` requires `idempotency_key` of 8..160 trimmed characters.
- digest is computed from the normalized `{to,purpose,consentReference}` only; browser-provided org/provider/session state is excluded.
- same key + same digest returns the existing call session/provider state without another Telnyx POST.
- same key + different digest returns HTTP 409 `idempotency_conflict`.
- if the provider request is submitted but the outcome is transport-ambiguous, set `reconciliation_required=true`, keep provider evidence/request timing, return `provider_outcome_ambiguous`, and never auto-POST again on replay.

Additional P0 gate:
- before Telnyx origination, verify the configured `fromNumber` is linked to the same organization in `atlas_number_resources` with `state='active'`, `upstream_provider='telnyx'`, and matching authenticated evidence. Otherwise block with `caller_number_not_verified`.

- [ ] **Step 1: Write failing pure idempotency tests**

Test stable digest for semantically identical normalized input, changed payload conflict, replay reuse, and reconciliation-required behavior.

- [ ] **Step 2: Run the pure test**

Run: `npx vitest run tests/unit/atlas-telephony-idempotency.test.ts`
Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement pure helpers**

No provider/network logic in this module.

- [ ] **Step 4: Add the additive migration**

Do not weaken existing RLS or lifecycle constraints.

- [ ] **Step 5: Add failing API tests**

Assert: missing key -> 400; duplicate same request -> one provider POST; changed payload -> 409; transport ambiguity -> durable reconciliation blocker; inactive/unverified caller number -> no provider POST.

- [ ] **Step 6: Implement idempotency/reconciliation in `originate`**

Claim/create the call-session idempotency record before provider mutation. Preserve the same logical key on every recovery attempt. Sanitize provider error/evidence storage.

- [ ] **Step 7: Verify**

Run: `npx vitest run tests/unit/atlas-telephony-idempotency.test.ts tests/unit/atlas-telephony-capability-api.test.ts tests/unit/atlas-telephony-telnyx.test.ts tests/unit/atlas-telephony-webhook.test.ts tests/unit/atlas-telephony-call-state.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/telephony-idempotency.ts supabase/migrations/20261004_atlas_call_idempotency.sql supabase/functions/atlas-communication-telephony/index.ts tests/unit/atlas-telephony-idempotency.test.ts tests/unit/atlas-telephony-capability-api.test.ts
git commit -m "feat(telephony): make outbound calls idempotent"
```

---

### Task 7: Add the disabled-by-default P0 number provisioning proof with cleanup

**Files:**
- Modify: `supabase/migrations/20261004_atlas_call_idempotency.sql` only if implemented in the same branch before merge; otherwise create a follow-up migration `supabase/migrations/20261004_atlas_number_provisioning_idempotency.sql`.
- Create: `supabase/functions/_shared/telephony-number-provisioning.ts`
- Create: `tests/unit/atlas-telephony-number-provisioning.test.ts`
- Modify: `supabase/functions/atlas-communication-telephony/index.ts`
- Modify: `tests/unit/atlas-telephony-capability-api.test.ts`

**Interfaces:**
- Add to `public.atlas_number_resources`:
  - `idempotency_key text`;
  - `request_digest text`;
  - `created_by uuid`;
  - unique partial index `(organization_id, idempotency_key)` where key is not null.
- Produces: `provisionTelnyxTestNumber(input, deps): Promise<ProvisioningResult>`.
- Produces: `cleanupTelnyxTestNumber(input, deps): Promise<CleanupResult>`.
- Provider contracts use current Telnyx v2 endpoints:
  - search: `GET /available_phone_numbers`;
  - order: `POST /number_orders` with `phone_numbers: [{ phone_number }]`;
  - order status: `GET /number_orders/{number_order_id}`;
  - ownership verification: `POST /phone_numbers/actions/verify_ownership` when needed to identify the account resource ID;
  - cleanup: `POST /phone_numbers/jobs/delete_phone_numbers` with the E.164 number;
  - cleanup status: `GET /phone_numbers/jobs/{id}`.

Write gate requirements (all required):
- server-side `ATLAS_TELNYX_WRITE_TESTS_ENABLED === 'true'`;
- `communication.telephony.provision` permission;
- environment must be `test`/designated sandbox, never implicit production;
- user request must include `test_scope: true` and stable `idempotency_key`;
- provider readiness verified;
- no verified reusable local resource already satisfies the requested criteria.

Reuse-before-create behavior:
- query `atlas_number_resources` first for same organization/provider/service and reusable lifecycle state;
- if a verified reusable resource exists, return it and do not call `POST /number_orders`;
- a local/provider lookup failure is a blocker, not permission to create;
- insert the selected candidate as local `state='ordered'` before/with durable provider operation evidence; do not claim `allocated/verified/active` unless the existing truth trigger requirements are actually satisfied.

Cleanup behavior:
- submit Telnyx batch deletion;
- poll only with a bounded attempt/time policy in the E2E harness, not an infinite Edge request;
- set local state `released` only after provider cleanup job reports completed/success for the target number;
- failed/expired/unknown cleanup leaves the operation non-green and the resource not falsely released.

- [ ] **Step 1: Write failing provisioning unit tests**

Use injected fetch/database doubles. Cover reuse without POST, confirmed no reusable resource -> one order POST, lookup error -> no POST, same key/same digest -> reuse, changed digest -> conflict, write gate disabled -> blocked.

- [ ] **Step 2: Run the provisioning test**

Run: `npx vitest run tests/unit/atlas-telephony-number-provisioning.test.ts`
Expected: FAIL because provisioning helper does not exist.

- [ ] **Step 3: Implement the pure/provider provisioning helper**

Keep provider HTTP in this focused module and inject fetch/store boundaries for tests. Never log API keys or raw error bodies.

- [ ] **Step 4: Add the provisioning idempotency columns/index**

Preserve the existing `atlas_enforce_number_resource_truth()` trigger and RLS. Do not alter its positive-state requirements to make tests easier.

- [ ] **Step 5: Add Edge operations behind the write gate**

Add `POST ?api=number-provision-test` and `POST ?api=number-cleanup-test`. Neither route is enabled merely by deploying code.

- [ ] **Step 6: Add cleanup tests**

Cover completed cleanup -> local `released`; provider job failure/expired -> P0 failure and no false release; transport ambiguity -> reconciliation blocker.

- [ ] **Step 7: Verify focused tests**

Run: `npx vitest run tests/unit/atlas-telephony-number-provisioning.test.ts tests/unit/atlas-telephony-capability-api.test.ts`
Expected: PASS.

Run: `npm run verify:edge`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/telephony-number-provisioning.ts supabase/functions/atlas-communication-telephony/index.ts supabase/migrations/20261004_atlas_number_provisioning_idempotency.sql tests/unit/atlas-telephony-number-provisioning.test.ts tests/unit/atlas-telephony-capability-api.test.ts
git commit -m "feat(telephony): add gated number provisioning proof"
```

---

### Task 8: Bind capability execution to canonical workflow/evidence lineage

**Files:**
- Modify: `supabase/functions/atlas-communication-telephony/index.ts`
- Modify: `supabase/functions/atlas-execution/index.ts` only if the existing server boundary lacks the required append/create RPC/action; prefer its current actions over new direct table writes.
- Create: `tests/integration/atlas-capability-mission-lineage.test.ts`

**Interfaces:**
- Every protected capability execution receives or creates canonical execution lineage: `workflow_id`, `task_id`, `step_id`, `correlation_id`.
- The workflow/task context stores capability IDs, not provider credentials.
- Provider mutation evidence is appended to `execution_evidence` and `execution_audit_events` using existing server-side execution contracts.
- Mission projection from Task 3 must render the same workflow/task/step state.

Required event/action lineage for a successful call:
`tool_call_requested -> provider_request_sent -> provider_response_received -> verification_passed/step_completed`.
For blocked/ambiguous paths:
`tool_call_requested -> run_blocked` or `provider_response_received -> reconciliation_required` with no false `completed` state.

- [ ] **Step 1: Write the failing integration test**

Create a scoped workflow/task/step fixture, execute a mocked protected telecom capability, then assert the workflow/task/step references, capability ID, correlation ID, and evidence/audit lineage all refer to the same canonical execution records. Assert no `missions` table/API is used.

- [ ] **Step 2: Run the focused integration test**

Run: `npx vitest run tests/integration/atlas-capability-mission-lineage.test.ts`
Expected: FAIL until telecom is bound to execution lineage.

- [ ] **Step 3: Reuse the existing `atlas-execution` server contract**

Add only the minimum missing action/adapter hook needed for telecom evidence/transition writes. Do not bypass RLS/authz through browser writes.

- [ ] **Step 4: Bind telecom capability operations**

Ensure readiness/search remain read-only; call/provisioning mutations create/advance protected execution steps and append evidence only after the corresponding truth condition is met.

- [ ] **Step 5: Verify**

Run: `npx vitest run tests/integration/atlas-capability-mission-lineage.test.ts`
Expected: PASS.

Run: `npx vitest run tests/unit/execution-mission-projection.test.ts tests/unit/execution-capability-policy.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-communication-telephony/index.ts supabase/functions/atlas-execution/index.ts tests/integration/atlas-capability-mission-lineage.test.ts
git commit -m "feat(execution): bind telecom capabilities to mission lineage"
```

---

### Task 9: Add fail-closed capability CI and optional authorized E2E write verification

**Files:**
- Create: `.github/workflows/atlas-agent-capability-verify.yml`
- Create: `scripts/verify-atlas-telnyx-capabilities.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/global-production-verify.yml` only to add a P1/read-only capability surface check if production exposes one; do not make real number purchase part of routine production verification.

**Interfaces:**
- Adds `verify:capabilities:e2e` script for the authorized E2E harness.
- Workflow inputs:
  - `run_write_tests`: choice `false|true`, default `false`;
  - `cleanup_required`: fixed/enforced `true` for write tests.
- Read-only job runs registry/manifest/unit/integration checks and safe provider readiness/search only when credentials are present.
- Write job runs only when manually dispatched with `run_write_tests == 'true'`, required secrets are present, and the server-side write gate/test tenant is configured.

P0 write job success requires all of:
- tenant/RBAC gate passed;
- idempotency replay test passed;
- one provider resource was either safely reused or created exactly once;
- any created test number was deleted through the Telnyx delete job;
- cleanup completion was observed;
- local resource truth matches provider cleanup;
- mission/evidence lineage is durable;
- no unresolved reconciliation/cleanup blocker remains.

No write/cleanup step uses `continue-on-error`.

- [ ] **Step 1: Add a failing verification contract test/script dry-run**

The harness must support a fixture/dry-run mode that proves result parsing and P0 aggregation without credentials. Assert one failed cleanup result makes final `ok=false`.

- [ ] **Step 2: Add the workflow**

Use `actions/checkout@v7` and `actions/setup-node@v7` / Node `22` to match the repository's current global verification workflow. Set minimal permissions (`contents: read`; add `id-token: write` only if the authorized runtime path actually uses OIDC).

- [ ] **Step 3: Wire capability verification into repository scripts**

Add `verify:capabilities` to the appropriate aggregate verification path only after its local checks are deterministic and credential-free. Keep real provider write tests outside normal `npm run verify:all`.

- [ ] **Step 4: Run local full verification**

Run:
`npm run verify:capabilities`
`npm run typecheck`
`npm run test:unit`
`npm run test:integration`
`npm run verify:edge`
`npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/atlas-agent-capability-verify.yml scripts/verify-atlas-telnyx-capabilities.mjs package.json .github/workflows/global-production-verify.yml
git commit -m "ci: verify ATLAS capability runtime fail closed"
```

---

### Task 10: Whole-branch security, regression, and truthful production handoff

**Files:**
- Modify only when verification exposes a real defect.
- Update: `docs/telecom/atlas-carrier-control-plane.md` only if the implemented contract adds externally relevant behavior not already documented.
- Update: `docs/generated/atlas-agent-capabilities.json` via generator only.

**Interfaces:**
- Consumes all previous tasks.
- Produces evidence for merge/deploy readiness, not synthetic provider readiness.

- [ ] **Step 1: Run all focused capability/telephony tests**

Run:
`npx vitest run tests/unit/execution-capability-registry.test.ts tests/unit/execution-capability-manifest.test.ts tests/unit/execution-mission-projection.test.ts tests/unit/execution-capability-policy.test.ts tests/unit/atlas-telephony-telnyx.test.ts tests/unit/atlas-telephony-webhook.test.ts tests/unit/atlas-telephony-call-state.test.ts tests/unit/atlas-telephony-idempotency.test.ts tests/unit/atlas-telephony-number-provisioning.test.ts tests/unit/atlas-telephony-capability-api.test.ts tests/integration/atlas-capability-mission-lineage.test.ts`
Expected: PASS.

- [ ] **Step 2: Run repository gates**

Run:
`npm run verify:capabilities`
`npm run typecheck`
`npm run test:unit`
`npm run test:integration`
`npm run verify:edge`
`npm run build`

Expected: PASS.

- [ ] **Step 3: Secret/claim review**

Inspect diff and built artifacts for API keys, signing keys, activation material, real phone numbers that should be private, raw provider error bodies, and unjustified `live/connected/active/provisioned` labels.

- [ ] **Step 4: Review database changes against existing truth gates**

Confirm migrations are additive, existing RLS remains intact, `atlas_enforce_number_resource_truth()` was not weakened, and no mission shadow tables exist.

- [ ] **Step 5: Open/refresh implementation PR and run CI**

Record exact commit SHA and test/check results. Required P0 failures block merge.

- [ ] **Step 6: Run authorized read-only provider verification**

Require current Telnyx readiness plus number-search evidence. A successful inventory search proves discovery only.

- [ ] **Step 7: Run the manually authorized P0 write proof when the test scope is configured**

Use one stable idempotency key. If creation occurs, require cleanup completion. If a reusable resource is used, record that no purchase occurred. Any ambiguous write or cleanup blocker leaves the capability proof failed.

- [ ] **Step 8: Merge/deploy only after required checks pass**

Deployment does not itself mark Telnyx/ATLAS Carrier resources active.

- [ ] **Step 9: Run canonical production verification**

Run the existing `ATLAS Global Production Verification` in `fail-closed` mode for the deployed SHA. Separately verify the telecom capability/readiness evidence appropriate to the environment.

- [ ] **Step 10: Final evidence statement**

Report independently: code merged, CI green, deployment SHA verified, capability registry active, read-only provider verification, P0 write proof, cleanup state, and any external authorization still outstanding. Never collapse these into one `complete` claim.

---

## Self-Review

### Spec coverage

- Capability registry/schema: Tasks 1–2.
- Generated manifest/drift control: Task 2.
- Missions over existing execution truth: Tasks 3 and 8.
- Policy-before-provider selection: Task 4.
- Telnyx read-only discovery and lookup error separation: Task 5.
- Stable idempotency and ambiguous-write reconciliation: Task 6.
- Reuse-before-create, real test provisioning and cleanup: Task 7.
- Durable evidence/audit lineage: Task 8.
- P0/P1 fail-closed CI and authorized E2E: Tasks 9–10.
- Production/provider truth separation: Tasks 9–10.
- Data-locality, messaging-specific expansion, generic MCP gateway, Finance/HR/Tax expansion: intentionally deferred to follow-on implementation plans after the telecom proof, as required by the spec's initial-scope section.

### Step scan

Each task has a failing-test step, an implementation boundary, verification, and commit. No task requires inventing a second mission store or replacing existing Telnyx readiness/webhook hardening.

### Type consistency

`AtlasCapabilityDefinition`, `AtlasProviderBinding`, `AtlasCapabilityRuntimeState`, mission projections, and `evaluateCapabilityPolicy()` are defined once in Tasks 1–4 and consumed by later tasks without alternate names.

### Review Focus coverage

- Ambiguous provider result: Task 6 tests and Task 10 gate.
- Same key/different payload: Task 6 tests.
- Stale/missing provider readiness: Task 4 tests and Task 5 route tests.
- Lookup error vs empty: Task 5 tests.
- Cleanup failure: Task 7 tests and Task 9 P0 aggregation.

### Proportion

The plan deliberately limits implementation to the telecom proof. MCP servers, broad generated skills, AI data-locality enforcement across all providers, messaging compliance expansion, Finance, HR/Payroll, Accounting and Tax each remain separate follow-on slices rather than inflating this branch into an ATLAS-wide rewrite.
