# ATLAS Work Soberano OpenAI Domain Verification Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first evidence-backed ATLAS Work workflow for `Verify atlasenterprisesuite.com with OpenAI`, using Hybrid execution, Guided autonomy, a `$0` paid-provider budget, exact-payload DNS approval, public DNS verification, OpenAI browser verification, and tenant-safe evidence/audit semantics.

**Architecture:** The pilot is an ATLAS Manager-owned Work template that persists ordinary execution workflow/task/step rows. DNS mutation is performed through an authorized DNS API adapter when available or a constrained browser-runtime job otherwise. OpenAI verification is browser-driven because no supported public domain-verification API is assumed. Completion requires independent public DNS evidence plus observed OpenAI `verified` state; a provider write response alone cannot complete the task.

**Tech Stack:** TypeScript 5.7, Supabase Edge Functions/Postgres, browser-runtime job protocol from the Runtime plan, public DNS-over-HTTPS read verification, Vitest 3.2, Testing Library 16.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-work-sovereign-design.md`

## Global Constraints

- Target branch: `feat/atlas-work-sovereign` after the first three Work plans pass review.
- Owner module is `manager`; execution mode default `hybrid`; autonomy default `guided`; paid-provider budget default `$0`.
- The workflow may add only the exact approved TXT record. It must not delete DNS records, change nameservers, modify MX, or alter unrelated A/CNAME/TXT records.
- The active OpenAI verification value is observed from the authorized OpenAI surface at runtime; do not hard-code a token from screenshots, chat text, fixtures or documentation.
- Never persist the OpenAI verification token in ordinary screenshots or logs. Persist a redacted digest/reference and the public-DNS verification result; the exact value may live only in the current step action payload/server execution boundary as required to perform the authorized action.
- Automated tests use fakes/fixtures and must never modify production DNS or click a live OpenAI account.
- Production validation requires an exact Approval Center decision bound to the current DNS action payload.
- MFA/CAPTCHA/reauthentication hands control to the authorized human and resumes from canonical state afterward.
- Completion requires: exact TXT at correct hostname, public DNS visibility, OpenAI `verified`, persisted evidence, and audit.

## File Map

- `packages/execution/src/state-machine.ts` — add explicit step transition guard.
- `packages/execution/src/dns-verification.ts` — normalize TXT answers and verify exact expected value.
- `packages/execution/src/work-templates.ts` — typed Work template registry and OpenAI-domain template.
- `packages/execution/src/index.ts` — exports.
- `supabase/functions/atlas-execution/openai-domain.ts` — pilot workflow builder, step executor and verification coordinator.
- `supabase/functions/atlas-execution/dns-public.ts` — public DNS-over-HTTPS verifier with bounded polling.
- `supabase/functions/atlas-execution/index.ts` — `create_work_template`, `execute_work_step`, `resume_work_step` operations.
- `apps/web/src/work/WorkTemplatesPage.tsx` — real template list and launch path.
- `apps/web/src/work/WorkTeamPage.tsx` — organization-scoped Work role/permission visibility using existing membership state.
- `apps/web/src/work/WorkRoutes.tsx` — `/work/templates`, `/work/team`.
- `tests/unit/execution-step-state-machine.test.ts` — step transitions.
- `tests/unit/dns-verification.test.ts` — TXT parsing and exact-match semantics.
- `tests/unit/openai-domain-template.test.ts` — exact steps, envelopes and evidence requirements.
- `tests/unit/openai-domain-edge.test.ts` — no hard-coded token, exact approval, resume/reconcile rules.
- `tests/integration/work-templates.test.tsx` — template launch UI.
- `tests/integration/work-tenant-isolation.test.tsx` — cross-org failure behavior.
- `tests/integration/openai-domain-guided-flow.test.tsx` — end-to-end fake workflow through approval/evidence/completion.

---

### Task 1: Add explicit step transition rules to the canonical execution engine

**Files:**
- Modify: `packages/execution/src/state-machine.ts`
- Test: `tests/unit/execution-step-state-machine.test.ts`

**Interfaces:**
- Produces `canTransitionStep(from, to)` and `assertStepTransition(from, to)`.

- [ ] **Step 1: Write failing transition tests**

```ts
import { expect, it } from 'vitest';
import { canTransitionStep } from '../../packages/execution/src/state-machine';

it('allows ready -> running -> completed', () => {
  expect(canTransitionStep('ready', 'running')).toBe(true);
  expect(canTransitionStep('running', 'completed')).toBe(true);
});

it('does not allow completed steps to run again', () => {
  expect(canTransitionStep('completed', 'running')).toBe(false);
});

it('allows waiting approval and blocker recovery', () => {
  expect(canTransitionStep('ready', 'awaiting_approval')).toBe(true);
  expect(canTransitionStep('awaiting_approval', 'ready')).toBe(true);
  expect(canTransitionStep('blocked', 'ready')).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/execution-step-state-machine.test.ts
```

- [ ] **Step 3: Implement fail-closed step transitions**

Use an exhaustive `Record<StepStatus, readonly StepStatus[]>` with terminal `completed` and `cancelled`. Permit `failed -> ready|cancelled`, `running -> blocked|failed|completed|cancelled`, and no `pending -> completed` shortcut.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/execution-step-state-machine.test.ts
git add packages/execution/src/state-machine.ts tests/unit/execution-step-state-machine.test.ts
git commit -m "feat: add canonical execution step transitions"
```

---

### Task 2: Add exact public DNS TXT verification primitives

**Files:**
- Create: `packages/execution/src/dns-verification.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/dns-verification.test.ts`

**Interfaces:**
- Produces `normalizeDnsTxtAnswer(value)`, `verifyDnsTxt(expected, answers)`.

- [ ] **Step 1: Write failing DNS tests**

```ts
import { expect, it } from 'vitest';
import { normalizeDnsTxtAnswer, verifyDnsTxt } from '../../packages/execution/src/dns-verification';

it('joins quoted DNS TXT chunks without changing the value', () => {
  expect(normalizeDnsTxtAnswer('"openai-domain-" "verification=abc"')).toBe('openai-domain-verification=abc');
});

it('requires exact value equality', () => {
  expect(verifyDnsTxt('openai-domain-verification=abc', ['"openai-domain-verification=abc"']).verified).toBe(true);
  expect(verifyDnsTxt('openai-domain-verification=abc', ['"openai-domain-verification=abcd"']).verified).toBe(false);
});
```

- [ ] **Step 2: Verify RED, implement, verify GREEN**

TXT normalization removes DNS presentation quotes and joins adjacent quoted chunks only; it must not lowercase, trim internal characters or otherwise rewrite the verification value.

```bash
npx vitest run tests/unit/dns-verification.test.ts
git add packages/execution/src/dns-verification.ts packages/execution/src/index.ts tests/unit/dns-verification.test.ts
git commit -m "feat: add exact DNS TXT verification primitives"
```

---

### Task 3: Register the OpenAI-domain Work template with explicit safe steps

**Files:**
- Create: `packages/execution/src/work-templates.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/openai-domain-template.test.ts`

**Interfaces:**
- Produces `WorkTemplateDefinition`, `WORK_TEMPLATES`, `getWorkTemplate(id)` and template id `manager.openai_domain_verification`.

- [ ] **Step 1: Write the failing template test**

Assert the template owner is `manager`, defaults Hybrid/Guided/Auto/0, target domain input is required, and step action types are exactly:

```ts
[
  'observe_openai_verification_requirement',
  'resolve_authoritative_dns_provider',
  'inspect_dns_state',
  'prepare_dns_txt_mutation',
  'create_dns_txt',
  'verify_provider_dns_state',
  'verify_public_dns_txt',
  'open_openai_domain_verification',
  'click_openai_check',
  'verify_openai_domain_state',
  'record_completion_evidence'
]
```

Assert `create_dns_txt` requires `execution.write`, evidence kind `dns_txt_write`, and approval sensitivity `high`. Assert no step contains a literal verification token.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/openai-domain-template.test.ts
```

- [ ] **Step 3: Implement the template registry**

Each template step includes title, actionType, completionCriteria, evidenceRequirement, permissionsRequired and safe envelope hints. The OpenAI browser domain allowlist is `['openai.com','chatgpt.com']`; the DNS provider domain is resolved at runtime and added only after authoritative-provider discovery.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/openai-domain-template.test.ts
git add packages/execution/src/work-templates.ts packages/execution/src/index.ts tests/unit/openai-domain-template.test.ts
git commit -m "feat: add OpenAI domain verification Work template"
```

---

### Task 4: Build server-side pilot workflow creation and public DNS verifier

**Files:**
- Create: `supabase/functions/atlas-execution/openai-domain.ts`
- Create: `supabase/functions/atlas-execution/dns-public.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/unit/openai-domain-edge.test.ts`

**Interfaces:**
- Produces `create_work_template` operation and helper `verifyPublicTxt({ hostname, expectedValue, fetchImpl, attempts, delayMs })`.

- [ ] **Step 1: Write failing source/behavior tests**

Assert `create_work_template` requires `execution.write`, accepts only known template id + inputs, builds ordinary execution workflow/task/step rows, stores `context.work` defaults, and does not accept caller-provided step arrays. Assert `dns-public.ts` performs DNS-over-HTTPS GET for TXT and uses `verifyDnsTxt`; tests inject fake `fetchImpl` and do not use network.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/openai-domain-edge.test.ts
```

- [ ] **Step 3: Implement template creation**

For `manager.openai_domain_verification`, validate target domain exactly and create one workflow + one Manager task + template steps. Initial current step is the first step; workflow/task status becomes `now`; first step becomes `ready`; later steps remain `pending`. Store no verification token at creation.

- [ ] **Step 4: Implement bounded public-DNS polling**

Default testable helper uses `attempts = 12`, `delayMs = 5000` only in runtime; callers may set attempts/delay in tests. Response must return `{ verified, answers, attemptsUsed }`. Timeout returns `verified:false`; it is not a thrown server failure.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npx vitest run tests/unit/openai-domain-edge.test.ts
npm run typecheck
git add supabase/functions/atlas-execution/openai-domain.ts supabase/functions/atlas-execution/dns-public.ts supabase/functions/atlas-execution/index.ts tests/unit/openai-domain-edge.test.ts
git commit -m "feat: create OpenAI domain pilot workflows"
```

---

### Task 5: Add `execute_work_step` / `resume_work_step` with exact approval, runtime dispatch and reconciliation

**Files:**
- Modify: `supabase/functions/atlas-execution/openai-domain.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/unit/openai-domain-edge.test.ts`

**Interfaces:**
- Consumes Work routing/policy, runtime queue, step transitions, Approval Center and DNS verifier.
- Produces operations `execute_work_step`, `resume_work_step`.

- [ ] **Step 1: Add failing tests for sensitive mutation**

For `prepare_dns_txt_mutation`, the active OpenAI token must already have been observed by an authorized browser job and stored only in the server-side current step action payload. `create_dns_txt` must call server policy; Guided + high-risk DNS mutation returns `awaiting_approval` until an existing approval digest matches the exact current task/version/action payload. Test that changing hostname or TXT value after approval causes `approval_binding_mismatch` and blocks execution.

- [ ] **Step 2: Add failing tests for execution mechanism**

When an authorized DNS API capability exists, `execute_work_step` dispatches through the DNS adapter port. When it does not and an eligible browser runtime exists, it enqueues `create_dns_txt` with an envelope that permits only the resolved DNS provider domain and the `create_dns_txt` action. With neither capability it sets step/task blocked with `dns_execution_capability_missing`.

- [ ] **Step 3: Add failing resume/reconcile tests**

If a runtime job times out after the mutation, `resume_work_step` first performs provider readback/public DNS lookup. If the exact TXT already exists, it does not enqueue another create action; it proceeds to verification. If absent, it may retry according to policy.

- [ ] **Step 4: Implement the step executor**

For every operation: load org-scoped workflow/task/step; assert step transition; evaluate server policy immediately before mutation; require current approval where needed; route to API or browser; transition to `running`; on human barrier transition to `blocked` or `awaiting_approval` with truthful reason; never mark completed until that step's completion criteria and required evidence are satisfied.

- [ ] **Step 5: Implement browser-specific OpenAI actions**

`observe_openai_verification_requirement`, `open_openai_domain_verification`, `click_openai_check`, and `verify_openai_domain_state` dispatch through runtime jobs. The final verification result accepted from the runtime is a sanitized structured result `{ domain, state: 'verified'|'not_verified', observedAt }`; screenshots are optional non-secret references, not the authority.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npx vitest run tests/unit/openai-domain-edge.test.ts
npm run typecheck
git add supabase/functions/atlas-execution/openai-domain.ts supabase/functions/atlas-execution/index.ts tests/unit/openai-domain-edge.test.ts
git commit -m "feat: execute and resume OpenAI domain pilot safely"
```

---

### Task 6: Persist verified evidence and enforce completion semantics

**Files:**
- Modify: `supabase/functions/atlas-execution/openai-domain.ts`
- Test: `tests/integration/openai-domain-guided-flow.test.tsx`

**Interfaces:**
- Produces verified evidence kinds `dns_txt_write`, `dns_public_txt`, `openai_domain_verified` and final task completion only through `evaluateTaskCompletion`.

- [ ] **Step 1: Write failing guided-flow test**

Drive a fully fake server/runtime/provider flow: observe token -> inspect DNS -> request approval -> approve -> write TXT -> provider readback -> public DNS exact match -> OpenAI Check -> OpenAI state `verified` -> evidence -> completed. Assert before the final `openai_domain_verified` evidence, completion returns `completion_requirements_not_met`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/openai-domain-guided-flow.test.tsx
```

- [ ] **Step 3: Implement evidence recording**

Evidence references must avoid the raw token. Use references such as:

```ts
{
  kind: 'dns_public_txt',
  reference: JSON.stringify({ hostname, valueDigest, resolver: 'public-doh', observedAt }),
  verified: true
}
```

The server itself marks these trusted verifier-generated records `verified:true`; ordinary `record_evidence` continues refusing caller-supplied verified evidence.

- [ ] **Step 4: Gate final completion**

Only after every required step is completed/cancelled, all evidence requirements are verified, dependencies resolved and approvals satisfied may the task transition to `completed`. Then update workflow completion state using the canonical workflow rules already present after reconciliation; do not create a parallel Work completion flag.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npx vitest run tests/integration/openai-domain-guided-flow.test.tsx
npm run typecheck
git add supabase/functions/atlas-execution/openai-domain.ts tests/integration/openai-domain-guided-flow.test.tsx
git commit -m "feat: verify OpenAI domain workflow completion with evidence"
```

---

### Task 7: Add Templates and Team surfaces and harden tenant isolation

**Files:**
- Create: `apps/web/src/work/WorkTemplatesPage.tsx`
- Create: `apps/web/src/work/WorkTeamPage.tsx`
- Modify: `apps/web/src/work/api.ts`
- Modify: `apps/web/src/work/WorkRoutes.tsx`
- Modify: `apps/web/src/work/WorkSubnav.tsx`
- Test: `tests/integration/work-templates.test.tsx`
- Test: `tests/integration/work-tenant-isolation.test.tsx`

**Interfaces:**
- Produces `/work/templates`, `/work/team` and launch of the pilot template.

- [ ] **Step 1: Write failing template UI test**

Assert the template card identifies owner `ATLAS Manager`, default `Hybrid · Guided · $0`, required input `Domain`, and launching with `atlasenterprisesuite.com` calls `create_work_template` then navigates to `/execution/:workflowId`.

- [ ] **Step 2: Write failing tenant-isolation test**

Mock authenticated org A and server data containing org B rows; normalization/list code must not render them. Edge-function source tests must assert every pilot workflow/task/step/job/evidence query includes `.eq('org_id', context.orgId)` or equivalent server-scoped relation.

- [ ] **Step 3: Verify RED**

```bash
npx vitest run tests/integration/work-templates.test.tsx tests/integration/work-tenant-isolation.test.tsx
```

- [ ] **Step 4: Implement pages**

Templates page reads the known safe registry exposed through a small client-side metadata export or a safe `list_work_templates` server operation; launching is always server-side. Team page shows current organization membership role and derived execution permissions from existing session data; it does not invent team mutation controls unless an existing membership mutation API is available.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npx vitest run tests/integration/work-templates.test.tsx tests/integration/work-tenant-isolation.test.tsx
npm run typecheck
git add apps/web/src/work tests/integration/work-templates.test.tsx tests/integration/work-tenant-isolation.test.tsx
git commit -m "feat: add Work templates team view and tenant hardening"
```

---

### Task 8: Final branch verification and production-pilot handoff

- [ ] **Step 1: Run all Work-focused tests**

```bash
npx vitest run \
  tests/unit/work-types.test.ts \
  tests/unit/work-intent.test.ts \
  tests/unit/work-routing.test.ts \
  tests/unit/work-policy.test.ts \
  tests/unit/work-connections.test.ts \
  tests/unit/work-runtime.test.ts \
  tests/unit/browser-envelope.test.ts \
  tests/unit/browser-executor.test.ts \
  tests/unit/execution-step-state-machine.test.ts \
  tests/unit/dns-verification.test.ts \
  tests/unit/openai-domain-template.test.ts \
  tests/unit/openai-domain-edge.test.ts \
  tests/integration/work-launch.test.tsx \
  tests/integration/work-route.test.tsx \
  tests/integration/work-runtime-pages.test.tsx \
  tests/integration/work-templates.test.tsx \
  tests/integration/work-tenant-isolation.test.tsx \
  tests/integration/openai-domain-guided-flow.test.tsx
```

- [ ] **Step 2: Full verification**

```bash
npm ci
npm run typecheck
npm test
npm run build
```

- [ ] **Step 3: Final independent spec review**

Verify all 15 acceptance criteria in the design spec, especially no parallel workflow system, all three modes/autonomy/runtime kinds, secret boundaries, `$0` default budget, resumability, independent verification and exact OpenAI-domain pilot semantics.

- [ ] **Step 4: Final independent security/quality review**

Review RLS, org scoping, approval digest binding, runtime leases, stale runtime rejection, token sanitization, no hard-coded OpenAI token, DNS scope, browser envelope, idempotent resume and mobile/accessibility regressions. Fix and rerun all verification.

- [ ] **Step 5: Prepare production pilot; do not auto-run from CI**

Production pilot prerequisites must all be real and verified: authorized OpenAI browser session, authoritative DNS provider resolved, either an authorized DNS API connection or healthy authorized browser runtime, exact DNS mutation approval, and `$0` paid-provider cost. If any prerequisite is missing, surface it as a blocker. Do not claim the domain is verified until OpenAI reports `verified` and evidence is persisted.
