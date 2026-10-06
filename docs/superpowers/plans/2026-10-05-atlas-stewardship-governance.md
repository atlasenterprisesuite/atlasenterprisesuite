# ATLAS Stewardship Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an additive, evidence-backed stewardship policy layer that composes with existing ATLAS tenant/RBAC authorization, fails closed for sensitive actions, and proves the model through one governed ATLAS agentic execution path.

**Architecture:** Keep `packages/core` as the reusable policy source of truth. Add a pure stewardship evaluator plus a composed `authorizeGovernedAction(...)` wrapper around existing `authorize(...)`; extend audit events only with whitelisted non-secret stewardship metadata; then integrate the evaluator into the existing `atlas-copilot` agentic policy path without allowing request input to self-elevate assurance. Existing `hasPermission(...)`, `authorize(...)`, Supabase/RLS, provider gates, and domain controls remain authoritative.

**Tech Stack:** TypeScript 5.7, JavaScript/ESM, Vitest 5, existing `packages/core`, existing Supabase Edge Function agentic runtime.

**Spec:** `docs/superpowers/specs/2026-10-05-atlas-stewardship-governance-design.md`

## Global Constraints

- Stewardship never grants a permission absent from canonical RBAC.
- Preserve tenant and organization isolation; no second identity store or second RBAC source of truth.
- Assurance states are exactly `baseline`, `verified`, `elevated`.
- Risk classes are exactly `R0`, `R1`, `R2`, `R3`.
- R2 requires at least `verified`; R3 requires at least `elevated`.
- Missing mandatory evidence, approval, or provider readiness fails closed.
- AI agents cannot raise their own assurance, tenant scope, permissions, or manufacture evidence.
- Do not create a numerical trust/social score or infer religion, ideology, morality, personality, ethnicity, politics, or social worth.
- Do not place secrets, raw tokens, credentials, private certificates, or authentication material in audit metadata.
- Existing `hasPermission(...)` and `authorize(...)` behavior must remain backward compatible.
- TDD order is mandatory: RED test -> verify failure -> minimal implementation -> verify pass -> commit.
- Production readiness is not claimed until CI, merge, deployment, exact-commit verification, and P0 production verification succeed.

## Review Focus

1. A caller passes `minimumAssurance: 'baseline'` for R2/R3: the evaluator must still enforce the risk floor (`verified`/`elevated`). Covered in Task 1.
2. Evidence arrays contain blank values or an untyped input includes secret-like extra fields: normalized audit/governance output must not preserve arbitrary fields or blank evidence references. Covered in Tasks 1 and 2.
3. A request supplies `assurance: 'elevated'` directly in agent context: the agentic runtime must ignore it and use only the trusted resolver/dependency. Covered in Task 3.
4. A governed agent tool has no trusted stewardship resolver/result: R2/R3 execution must deny rather than silently fall back to baseline success. Covered in Task 3.
5. Existing non-governed agent tools and existing core authorization callers must keep current behavior. Covered in Tasks 1 and 3.

---

## File Structure

- Create `packages/core/src/stewardship.ts` — stewardship types, assurance/risk ordering, pure policy evaluation, and composed authorization wrapper.
- Modify `packages/core/src/index.ts` — export the stewardship module.
- Modify `packages/core/src/audit.ts` — add optional whitelisted stewardship metadata and preserve immutable event creation.
- Create `tests/unit/core-stewardship.test.ts` — deterministic unit tests for risk, assurance, evidence, purpose, approval/provider gates, canonical RBAC/tenant precedence, and compatibility.
- Create `tests/unit/core-stewardship-audit.test.ts` — audit metadata whitelist/immutability tests.
- Modify `supabase/functions/atlas-copilot/agentic-core.mjs` — opt-in stewardship evaluation after existing tool/permission/organization checks and before execution/approval completion.
- Create `tests/integration/atlas-agentic-stewardship.test.ts` — representative governed tool execution proving trusted assurance, fail-closed behavior, audit evidence, and backward compatibility.
- Create `docs/governance/ATLAS_STEWARDSHIP_ADOPTION.md` — domain adoption contract for later bounded migrations.

---

### Task 1: Core stewardship policy and composed authorization

**Files:**
- Create: `packages/core/src/stewardship.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/unit/core-stewardship.test.ts`

**Interfaces:**
- Consumes: `AuthorizationContext`, `AtlasPermission`, `TenantScope`, `authorize(...)` from `packages/core/src/permissions.ts`.
- Produces:
  - `StewardshipAssurance = 'baseline' | 'verified' | 'elevated'`
  - `StewardshipRisk = 'R0' | 'R1' | 'R2' | 'R3'`
  - `StewardshipActorType = 'human' | 'service' | 'agent' | 'automation' | 'provider'`
  - `StewardshipContext`
  - `StewardshipRequirement`
  - `StewardshipRuntimeGates`
  - `StewardshipDecisionReason`
  - `StewardshipDecision`
  - `minimumAssuranceForRisk(risk: StewardshipRisk): StewardshipAssurance`
  - `evaluateStewardshipPolicy(context: StewardshipContext, requirement: StewardshipRequirement, gates?: StewardshipRuntimeGates): StewardshipDecision`
  - `authorizeGovernedAction(actor: AuthorizationContext, request: { scope: TenantScope; permission: AtlasPermission; stewardship: StewardshipRequirement }, context: StewardshipContext, gates?: StewardshipRuntimeGates): StewardshipDecision`

- [ ] **Step 1: Write the failing core stewardship tests**

Create `tests/unit/core-stewardship.test.ts` with focused cases asserting:

```ts
expect(minimumAssuranceForRisk('R0')).toBe('baseline');
expect(minimumAssuranceForRisk('R2')).toBe('verified');
expect(minimumAssuranceForRisk('R3')).toBe('elevated');
```

Add named tests that assert all of the following exact outcomes:

```ts
expect(authorizeGovernedAction(actor, wrongScopeRequest, verifiedContext).reason).toBe('scope_mismatch');
expect(authorizeGovernedAction(actorWithoutPermission, request, elevatedContext).reason).toBe('permission_denied');
expect(evaluateStewardshipPolicy(baselineContext, r2Requirement).reason).toBe('assurance_insufficient');
expect(evaluateStewardshipPolicy(verifiedContextWithoutEvidence, r2EvidenceRequirement).reason).toBe('evidence_required');
expect(evaluateStewardshipPolicy(wrongPurposeContext, purposeRequirement).reason).toBe('purpose_mismatch');
expect(evaluateStewardshipPolicy(elevatedContext, r3ApprovalRequirement, { approvalGranted: false }).reason).toBe('approval_required');
expect(evaluateStewardshipPolicy(elevatedContext, providerRequirement, { providerVerified: false }).reason).toBe('provider_unverified');
expect(evaluateStewardshipPolicy(verifiedContext, { risk: 'R2', minimumAssurance: 'baseline' }).allowed).toBe(true);
expect(evaluateStewardshipPolicy(baselineContext, { risk: 'R2', minimumAssurance: 'baseline' }).reason).toBe('assurance_insufficient');
```

Also assert that blank evidence references are normalized away and cannot satisfy `evidenceRequired: true`.

- [ ] **Step 2: Run the new unit test and confirm RED**

Run:

```bash
npx vitest run tests/unit/core-stewardship.test.ts
```

Expected: FAIL because `packages/core/src/stewardship.ts` and its exports do not yet exist.

- [ ] **Step 3: Implement the stewardship types and deterministic evaluator**

Create `packages/core/src/stewardship.ts` with the interfaces above.

Required evaluator order:

1. purpose compatibility;
2. effective assurance, where the risk floor cannot be lowered by `minimumAssurance`;
3. required non-blank evidence;
4. explicit approval when `approvalRequired === true`;
5. provider verification when `providerRequired === true`.

`evaluateStewardshipPolicy(...)` returns `{ allowed: true, reason: 'allowed', ... }` or `{ allowed: false, reason: <stable reason>, ... }`. It must not throw for expected policy denials.

`authorizeGovernedAction(...)` must call existing `authorize(...)` first. Map its two existing denial reasons unchanged (`scope_mismatch`, `permission_denied`) and only evaluate stewardship after canonical authorization succeeds.

- [ ] **Step 4: Export the module without changing existing exports**

Add only:

```ts
export * from './stewardship';
```

to `packages/core/src/index.ts` alongside existing core exports.

- [ ] **Step 5: Run focused and regression authorization tests**

Run:

```bash
npx vitest run tests/unit/core-stewardship.test.ts tests/unit/core-permissions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/core/src/stewardship.ts packages/core/src/index.ts tests/unit/core-stewardship.test.ts
git commit -m "feat(governance): add stewardship policy core"
```

---

### Task 2: Whitelisted stewardship audit metadata

**Files:**
- Modify: `packages/core/src/audit.ts`
- Test: `tests/unit/core-stewardship-audit.test.ts`

**Interfaces:**
- Consumes: `StewardshipAssurance`, `StewardshipRisk`, `StewardshipDecisionReason` from Task 1.
- Produces:
  - `StewardshipAuditMetadata`
  - `createStewardshipAuditMetadata(input: StewardshipAuditMetadata): StewardshipAuditMetadata`
  - optional `stewardship?: StewardshipAuditMetadata` on `AtlasAuditEvent`

`StewardshipAuditMetadata` has exactly these fields:

```ts
{
  purpose: string;
  stewardshipRisk: StewardshipRisk;
  assurance: StewardshipAssurance;
  policyDecision: 'allowed' | StewardshipDecisionReason;
  evidenceRefs: readonly string[];
  correlationId: string;
}
```

- [ ] **Step 1: Write failing audit metadata tests**

Create `tests/unit/core-stewardship-audit.test.ts` and assert:

```ts
const metadata = createStewardshipAuditMetadata({
  purpose: 'payroll.approve',
  stewardshipRisk: 'R2',
  assurance: 'verified',
  policyDecision: 'allowed',
  evidenceRefs: ['evidence-1', ' ', 'evidence-1'],
  correlationId: 'req-1',
  token: 'must-not-survive'
} as never);

expect(metadata.evidenceRefs).toEqual(['evidence-1']);
expect('token' in metadata).toBe(false);
expect(Object.isFrozen(metadata)).toBe(true);
expect(Object.isFrozen(metadata.evidenceRefs)).toBe(true);
```

Also verify `createAuditEvent(...)` freezes the nested `stewardship` object and its evidence array when present, while unchanged events without stewardship metadata retain current behavior.

- [ ] **Step 2: Run the audit test and confirm RED**

Run:

```bash
npx vitest run tests/unit/core-stewardship-audit.test.ts
```

Expected: FAIL because the metadata type/helper does not exist.

- [ ] **Step 3: Implement the whitelist and immutable audit extension**

Modify `packages/core/src/audit.ts` to construct metadata explicitly from the six allowed properties only, normalize `purpose`/`correlationId` by trimming, normalize `evidenceRefs` to unique non-blank strings, and freeze the returned object plus array.

Extend `AtlasAuditEvent` with optional `stewardship?: StewardshipAuditMetadata` and update `createAuditEvent(...)` so the optional nested metadata is immutably copied/frozen. Do not accept arbitrary details or secret-bearing maps.

- [ ] **Step 4: Run focused audit/core tests**

Run:

```bash
npx vitest run tests/unit/core-stewardship-audit.test.ts tests/unit/core-stewardship.test.ts tests/unit/core-permissions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/core/src/audit.ts tests/unit/core-stewardship-audit.test.ts
git commit -m "feat(governance): add stewardship audit evidence"
```

---

### Task 3: Govern one real ATLAS agentic execution path

**Files:**
- Modify: `supabase/functions/atlas-copilot/agentic-core.mjs`
- Test: `tests/integration/atlas-agentic-stewardship.test.ts`

**Interfaces:**
- Consumes: `evaluateStewardshipPolicy(...)`, `minimumAssuranceForRisk(...)`, and stewardship types/semantics from Task 1.
- Produces: opt-in governed tool registration and execution in the existing `AtlasToolRegistry` / `AtlasAgentPolicyGateway` / `AtlasAgenticDispatcher` path.

Agentic integration contract:

- Existing tool permission and `organization_id` checks run first and remain unchanged.
- Existing `risk_level` mapping is:
  - `LOW -> R0`
  - `MEDIUM -> R1`
  - `HIGH -> R2`
  - `CRITICAL -> R3`
- A registered tool may add optional `stewardship` config:

```js
{
  purpose: 'string',
  risk: 'R0' | 'R1' | 'R2' | 'R3', // optional; may only equal or increase mapped risk
  evidenceRequired: boolean,
  providerRequired: boolean,
  approvalRequired: boolean
}
```

- `createAtlasAgenticCore(...)` accepts optional trusted dependency:

```js
resolveStewardshipContext({ context, tool, arguments: args })
```

The resolver result provides `actorId`, `actorType`, `purpose`, `assurance`, `evidenceRefs`, and `correlationId`. Request-supplied fields named `assurance`, `evidenceRefs`, `stewardship`, or similar must not substitute for this resolver.

- If an R2/R3 governed tool has no resolver or the resolver cannot produce a valid context, deny fail-closed before handler execution.
- Existing tools with no `stewardship` config preserve current behavior.
- Existing HIGH/CRITICAL approval behavior remains in force; stewardship cannot bypass it.

- [ ] **Step 1: Write the failing agentic stewardship integration tests**

Create `tests/integration/atlas-agentic-stewardship.test.ts` using the existing ESM agentic core and in-memory fake `audit`/`approvals` dependencies.

Required cases:

```ts
it('denies governed R2 tool when trusted resolver returns baseline');
it('ignores elevated assurance supplied by request context');
it('denies governed R2/R3 tool when trusted resolver is absent');
it('allows governed R2 tool with verified assurance, required evidence, canonical permission and valid approval');
it('keeps canonical permission denial authoritative even with elevated stewardship');
it('keeps organization mismatch authoritative even with elevated stewardship');
it('preserves legacy behavior for a tool with no stewardship config');
it('writes purpose, risk, assurance, decision, evidence refs and correlation id to governed audit details without request secrets');
```

The handler spy must remain uncalled on every denied case.

- [ ] **Step 2: Run the integration test and confirm RED**

Run:

```bash
npx vitest run tests/integration/atlas-agentic-stewardship.test.ts
```

Expected: FAIL because agentic stewardship registration/resolver behavior does not yet exist.

- [ ] **Step 3: Add the core stewardship import and risk adapter**

Modify `agentic-core.mjs` to import the pure evaluator from:

```js
../../../packages/core/src/stewardship.ts
```

Add a small local mapping function from existing `risk_level` to stewardship risk. If explicit tool stewardship risk is supplied, reject registration when it would lower the mapped risk.

- [ ] **Step 4: Extend tool registration additively**

`AtlasToolRegistry.register(...)` must normalize/freeze optional `tool.stewardship` but leave tools without it unchanged. Do not require a new field for existing callers.

- [ ] **Step 5: Evaluate stewardship after existing permission/organization policy and before execution**

Update the agentic flow so the existing policy result remains the first gate. For governed tools, obtain stewardship context only from `resolveStewardshipContext`; run the core evaluator; emit a rejected audit event on denial; then continue to existing approval/execution logic only on allow.

Do not read request-supplied assurance as authoritative. Use `normalized.request_id` as the default correlation identifier only when the trusted resolver omits no required security property; it is an identifier, not proof of assurance.

- [ ] **Step 6: Run the integration test and existing nearby agent tests**

Run:

```bash
npx vitest run tests/integration/atlas-agentic-stewardship.test.ts tests/unit/agent-diff.test.ts tests/unit/agent-merge.test.ts tests/unit/agent-versioning.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add supabase/functions/atlas-copilot/agentic-core.mjs tests/integration/atlas-agentic-stewardship.test.ts
git commit -m "feat(ai): govern agentic execution with stewardship policy"
```

---

### Task 4: Domain adoption contract and full verification

**Files:**
- Create: `docs/governance/ATLAS_STEWARDSHIP_ADOPTION.md`
- Verify: repository-wide applicable gates

**Interfaces:**
- Consumes: core and agentic interfaces from Tasks 1–3.
- Produces: a stable adoption guide for later bounded Finance, Payroll, Network, Health, Security, Enterprise, and AI migrations.

- [ ] **Step 1: Write the adoption guide**

Document the required migration order for each future domain action:

`existing identity -> tenant/org scope -> canonical permission -> risk classification -> purpose -> trusted assurance/evidence -> domain/provider gate -> action -> audit/evidence`

Include a table with R0–R3 requirements and explicitly state that domain rules may be stricter but never weaker. Include examples for Finance/Payroll, Network/Connect, Health, Security, Enterprise admin, and AI tools. State that migration is opt-in per action and cannot globally block unmigrated flows.

- [ ] **Step 2: Run focused stewardship tests**

Run:

```bash
npx vitest run tests/unit/core-stewardship.test.ts tests/unit/core-stewardship-audit.test.ts tests/integration/atlas-agentic-stewardship.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run core regression suites**

Run:

```bash
npm run test:unit
npm run test:integration
```

Expected: PASS.

- [ ] **Step 4: Run static/build gates**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 5: Run repository verification appropriate to the branch**

Run:

```bash
npm run verify:all
```

Expected: exit 0. If a gate fails, diagnose and repair the real regression; do not suppress or relabel it.

- [ ] **Step 6: Commit documentation/verification-ready state**

```bash
git add docs/governance/ATLAS_STEWARDSHIP_ADOPTION.md
git commit -m "docs(governance): document stewardship adoption"
```

- [ ] **Step 7: PR/CI/release handoff**

Open a PR from the implementation branch to `main` with the spec, plan, test evidence, compatibility statement, and explicit note that stewardship does not replace RBAC. Require CI green before merge. After merge, verify the deployed production commit matches the merge commit and execute the repository P0 production verification. Any P0 failure keeps release status unverified/failing until repaired.

---

## Self-Review Result

- Spec coverage: all wave-one requirements map to Tasks 1–4; full domain migration remains intentionally outside wave one.
- Step scan: every implementation step has a concrete file/signature/test/command; no TBD/TODO placeholders remain.
- Type consistency: the core evaluator types feed audit metadata and agentic integration without introducing a second permission model.
- Review Focus: all five high-risk uncovered-input classes are pinned to explicit tests.
- Proportion: the plan specifies interfaces and assertions rather than implementation bodies; no unnecessary persistence layer, UI, or new dependency is introduced.
