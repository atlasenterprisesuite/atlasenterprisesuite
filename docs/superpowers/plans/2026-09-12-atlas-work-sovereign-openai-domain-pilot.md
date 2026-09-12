# ATLAS Work Soberano OpenAI Domain Verification Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first evidence-backed ATLAS Work workflow for `Verify atlasenterprisesuite.com with OpenAI`, using Hybrid execution, Guided autonomy, a `$0` paid-provider budget, exact-payload DNS approval, public DNS verification, OpenAI browser verification, and tenant-safe evidence/audit semantics.

**Architecture:** The pilot is an ATLAS Manager-owned Work template that persists ordinary execution workflow/task/step rows. DNS mutation uses an authorized DNS API adapter when available or a constrained browser-runtime job otherwise. OpenAI verification is browser-driven because no supported public domain-verification API is assumed. Completion requires independent public DNS evidence plus observed OpenAI `verified` state; a provider write response alone cannot complete the task.

**Tech Stack:** TypeScript 5.7, Supabase Edge Functions/Postgres, browser-runtime job protocol, public DNS-over-HTTPS read verification, Vitest 3.2, Testing Library 16.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-work-sovereign-design.md`

## Global Constraints

- Target branch: `feat/atlas-work-sovereign` after the first three Work plans pass review.
- Owner module `manager`; execution mode `hybrid`; autonomy `guided`; paid-provider budget `$0` by default.
- The workflow may add only the exact approved TXT record. It must not delete DNS records, change nameservers, modify MX, or alter unrelated A/CNAME/TXT records.
- The active OpenAI verification value is observed from the authorized OpenAI surface at runtime; do not hard-code a value from screenshots, chat, fixtures or docs.
- The exact verification value may exist only in the server-side current action payload/runtime action required to perform the approved mutation. It must not appear in ordinary UI state, screenshots retained as evidence, logs or audit text.
- Automated tests use fakes/fixtures and never modify production DNS or click a live OpenAI account.
- Production validation requires an exact Approval Center decision bound to the current DNS action payload.
- MFA/CAPTCHA/reauthentication hands control to the authorized human and resumes from canonical state afterward.
- Completion requires exact TXT at correct hostname, public DNS visibility, OpenAI `verified`, persisted verified evidence and audit.

## File Map

- `packages/execution/src/state-machine.ts` — explicit step transition guard.
- `packages/execution/src/dns-verification.ts` — TXT normalization/exact-match semantics.
- `packages/execution/src/work-templates.ts` — typed Work template registry and OpenAI-domain template.
- `packages/execution/src/index.ts` — exports.
- `supabase/functions/atlas-execution/openai-domain.ts` — pilot workflow builder, step executor, evidence and workflow completion coordinator.
- `supabase/functions/atlas-execution/dns-public.ts` — bounded Cloudflare DNS-over-HTTPS TXT verifier.
- `supabase/functions/atlas-execution/index.ts` — `create_work_template`, `execute_work_step`, `resume_work_step` operations.
- `apps/web/src/work/WorkTemplatesPage.tsx` — real template list and launch path.
- `apps/web/src/work/WorkTeamPage.tsx` — organization-scoped Work role/permission visibility using existing membership/session state.
- `apps/web/src/work/WorkRoutes.tsx` — `/work/templates`, `/work/team`.
- `tests/unit/execution-step-state-machine.test.ts`.
- `tests/unit/dns-verification.test.ts`.
- `tests/unit/openai-domain-template.test.ts`.
- `tests/unit/openai-domain-edge.test.ts`.
- `tests/integration/work-templates.test.tsx`.
- `tests/integration/work-tenant-isolation.test.tsx`.
- `tests/integration/openai-domain-guided-flow.test.tsx`.

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

it('allows approval and blocker recovery', () => {
  expect(canTransitionStep('ready', 'awaiting_approval')).toBe(true);
  expect(canTransitionStep('awaiting_approval', 'ready')).toBe(true);
  expect(canTransitionStep('blocked', 'ready')).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/execution-step-state-machine.test.ts
```

- [ ] **Step 3: Implement fail-closed transitions**

Use an exhaustive `Record<StepStatus, readonly StepStatus[]>`. Terminal: `completed`, `cancelled`. Allow `pending -> ready|blocked|cancelled`; `ready -> running|blocked|awaiting_approval|cancelled`; `running -> blocked|failed|completed|cancelled`; `awaiting_approval -> ready|blocked|cancelled`; `blocked -> ready|cancelled`; `failed -> ready|cancelled`. Do not allow `pending -> completed`.

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

- [ ] **Step 2: Verify RED, implement, verify GREEN and commit**

TXT normalization removes DNS presentation quotes and joins adjacent quoted chunks only; it must not lowercase or otherwise rewrite the value.

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
- Produces `WorkTemplateDefinition`, `WORK_TEMPLATES`, `getWorkTemplate(id)` and `manager.openai_domain_verification`.

- [ ] **Step 1: Write the failing template test**

Assert owner `manager`, defaults Hybrid/Guided/Auto/0, required input `domain`, and action types exactly:

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

Assert `create_dns_txt` requires `execution.write`, sensitivity `high`, and evidence `dns_txt_write`; `verify_public_dns_txt` requires `dns_public_txt`; `verify_openai_domain_state` requires `openai_domain_verified`; no template contains a literal verification value.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/openai-domain-template.test.ts
```

- [ ] **Step 3: Implement registry**

Each step has title, actionType, completionCriteria, evidenceRequirement, permissionsRequired and safe envelope hints. OpenAI browser allowlist is `['openai.com','chatgpt.com']`. DNS provider domain is not predeclared; it is resolved at runtime and added to the mutation envelope only after authoritative-provider discovery.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npx vitest run tests/unit/openai-domain-template.test.ts
git add packages/execution/src/work-templates.ts packages/execution/src/index.ts tests/unit/openai-domain-template.test.ts
git commit -m "feat: add OpenAI domain verification Work template"
```

---

### Task 4: Build pilot workflow creation and bounded public DNS verification

**Files:**
- Create: `supabase/functions/atlas-execution/openai-domain.ts`
- Create: `supabase/functions/atlas-execution/dns-public.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/unit/openai-domain-edge.test.ts`

**Interfaces:**
- Produces `create_work_template` and `verifyPublicTxt({ hostname, expectedValue, fetchImpl, attempts, delayMs })`.

- [ ] **Step 1: Write failing source/behavior tests**

Assert `create_work_template` requires `execution.write`, accepts only known template id + typed inputs, builds ordinary execution workflow/task/step rows, stores safe `context.work`, and rejects caller-provided step arrays. Assert DNS tests inject `fetchImpl` and never use network.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/openai-domain-edge.test.ts
```

- [ ] **Step 3: Implement template creation**

For template `manager.openai_domain_verification`, require `domain === 'atlasenterprisesuite.com'` for this first production pilot fixture; generic domain support can be added later through the same typed template input after tests. Create one workflow, one Manager task and all template steps. Set workflow/task `now`, first step `ready`, later steps `pending`, current task/step ids accordingly. Store no verification value at creation.

- [ ] **Step 4: Implement exact DNS-over-HTTPS read path**

Use:

```ts
const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=TXT`;
const response = await fetchImpl(url, { headers: { accept: 'application/dns-json' } });
```

Parse `Answer[].data` strings and call `verifyDnsTxt`. Runtime defaults: `attempts = 12`, `delayMs = 5000`; tests pass `attempts=1`, `delayMs=0`. Return `{ verified, answers, attemptsUsed }`. Propagation timeout returns `verified:false`, not a thrown server error. HTTP/non-JSON resolver failure returns a typed `dns_resolver_unavailable` error.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npx vitest run tests/unit/openai-domain-edge.test.ts
npm run typecheck
git add supabase/functions/atlas-execution/openai-domain.ts supabase/functions/atlas-execution/dns-public.ts supabase/functions/atlas-execution/index.ts tests/unit/openai-domain-edge.test.ts
git commit -m "feat: create OpenAI domain pilot workflows"
```

---

### Task 5: Add `execute_work_step` and `resume_work_step` with exact approval and reconciliation

**Files:**
- Modify: `supabase/functions/atlas-execution/openai-domain.ts`
- Modify: `supabase/functions/atlas-execution/index.ts`
- Test: `tests/unit/openai-domain-edge.test.ts`

**Interfaces:**
- Consumes Work router/policy, runtime queue, step transitions, Approval Center, DNS verifier.
- Produces `execute_work_step`, `resume_work_step`.

- [ ] **Step 1: Add failing tests for sensitive mutation**

The active OpenAI requirement must first be observed by an authorized browser job. `prepare_dns_txt_mutation` stores only the exact hostname/type/value needed in the server-side `create_dns_txt` step action payload. `create_dns_txt` evaluates policy; Guided + high sensitivity transitions to `awaiting_approval`. Approval must be bound to the exact current task version + current step action payload. Changing hostname or value after approval must cause `approval_binding_mismatch` on approval use.

- [ ] **Step 2: Add failing tests for mechanism selection**

If an authorized DNS API capability exists, dispatch through a `DnsMutationPort`. If not, but an eligible browser runtime exists, enqueue `create_dns_txt` with an envelope allowing only the resolved DNS provider domain and action `create_dns_txt`. With neither capability, transition to blocked reason `dns_execution_capability_missing`.

Define the port explicitly:

```ts
export type DnsMutationPort = {
  readTxt(input: { domain: string; name: string }): Promise<string[]>;
  createTxt(input: { domain: string; name: string; value: string }): Promise<{ providerRecordId: string }>;
};
```

A concrete API adapter is considered available only when an authorized connection resolver can construct this port; otherwise route to browser or block. Do not fake API availability.

- [ ] **Step 3: Add failing resume/reconcile tests**

If a runtime/API response is uncertain after mutation, `resume_work_step` first calls provider readback when available and public DNS verification. Exact record present => do not create again; absent => retry only after current policy/approval is revalidated.

- [ ] **Step 4: Implement executor**

Every operation loads org-scoped workflow/task/step, checks current state, evaluates policy immediately before mutation, checks current approval where required, selects mechanism, transitions step to `running`, dispatches action, and records audit. Human barriers become `blocked`/`awaiting_approval`; no sensitive action executes before approval.

- [ ] **Step 5: Implement browser-specific OpenAI actions**

`observe_openai_verification_requirement`, `open_openai_domain_verification`, `click_openai_check`, `verify_openai_domain_state` dispatch through runtime jobs. Final accepted structured result:

```ts
{ domain: 'atlasenterprisesuite.com', state: 'verified' | 'not_verified', observedAt: string }
```

Screenshots may be optional redacted references but never authority.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npx vitest run tests/unit/openai-domain-edge.test.ts
npm run typecheck
git add supabase/functions/atlas-execution/openai-domain.ts supabase/functions/atlas-execution/index.ts tests/unit/openai-domain-edge.test.ts
git commit -m "feat: execute and resume OpenAI domain pilot safely"
```

---

### Task 6: Persist trusted verified evidence and complete task/workflow canonically

**Files:**
- Modify: `supabase/functions/atlas-execution/openai-domain.ts`
- Test: `tests/integration/openai-domain-guided-flow.test.tsx`

**Interfaces:**
- Produces verified evidence `dns_txt_write`, `dns_public_txt`, `openai_domain_verified`; `completePilotTaskIfEligible`; `completeWorkWorkflowIfEligible`.

- [ ] **Step 1: Write failing guided-flow test**

Drive fake flow: observe requirement -> inspect DNS -> approval request -> approve -> write TXT -> provider readback -> public DNS exact match -> OpenAI Check -> OpenAI `verified` -> evidence -> completed. Before `openai_domain_verified`, task completion must return `completion_requirements_not_met`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/integration/openai-domain-guided-flow.test.tsx
```

- [ ] **Step 3: Implement trusted verifier evidence**

Trusted server helpers may insert `verified:true`; ordinary caller-facing `record_evidence` continues rejecting caller-supplied verified evidence. Evidence references never contain raw verification value. Use SHA-256 `valueDigest`:

```ts
{
  kind: 'dns_public_txt',
  reference: JSON.stringify({ hostname, valueDigest, resolver: 'cloudflare-doh', observedAt }),
  verified: true
}
```

- [ ] **Step 4: Gate task completion through the existing canonical evaluator**

`completePilotTaskIfEligible` loads steps/evidence/approvals/dependencies and calls existing `evaluateTaskCompletion`. Only when eligible may it transition task to `completed` using `canTransitionTask`; otherwise return exact reasons.

- [ ] **Step 5: Define workflow completion explicitly instead of assuming an existing workflow state helper**

`completeWorkWorkflowIfEligible(admin, context, workflowId)` loads all tasks for the workflow. It may mark `execution_workflows.status='completed'`, set `completed_at`, clear `current_task_id`, and append `execution.workflow.completed` audit only when every task status is `completed` or `cancelled` and at least one task exists. Update must be scoped by workflow id + org id and current nonterminal status. This helper is not a second state machine; it derives workflow completion from canonical task truth.

- [ ] **Step 6: Verify GREEN and commit**

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

Template card identifies owner `ATLAS Manager`, defaults `Hybrid · Guided · $0`, required input `Domain`; launch with `atlasenterprisesuite.com` calls `create_work_template` and navigates to `/execution/:workflowId`.

- [ ] **Step 2: Write failing tenant-isolation test**

Mock org A and malicious/incorrect response containing org B; client normalizer drops rows whose `organizationId` differs from active org. Edge source/behavior tests require every pilot workflow/task/step/job/evidence query to include org scope and server membership context.

- [ ] **Step 3: Verify RED**

```bash
npx vitest run tests/integration/work-templates.test.tsx tests/integration/work-tenant-isolation.test.tsx
```

- [ ] **Step 4: Implement pages**

Templates page may render static safe template metadata from `WORK_TEMPLATES`; launch is server-side. Team page shows current organization identity, current user's role, and derived execution permissions using existing authenticated session data. Do not add fake team-management mutations.

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

Verify all 15 acceptance criteria: no parallel workflow system, all three execution modes/autonomy/runtime kinds, secret boundaries, `$0` default, resumability, independent verification and exact OpenAI-domain semantics.

- [ ] **Step 4: Final independent security/quality review**

Review RLS/org scoping, approval digest binding, runtime leases, stale runtime rejection, sanitization, no hard-coded OpenAI value, DNS mutation scope, envelope, idempotent resume and responsive/accessibility regressions. Fix and rerun all verification.

- [ ] **Step 5: Prepare production pilot; do not auto-run from CI**

Prerequisites must all be real: authorized OpenAI browser session; authoritative DNS provider resolved; authorized DNS API port or healthy browser runtime; exact DNS mutation approval; `$0` paid-provider cost. Missing prerequisite becomes a blocker. Do not claim the domain verified until OpenAI reports `verified` and required evidence is persisted.
