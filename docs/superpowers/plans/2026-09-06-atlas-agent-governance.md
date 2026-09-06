# ATLAS Agent Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider-neutral immutable agent versioning, channel-aware instruction overlays, deterministic comparison, and conflict-aware merge rules for ATLAS agents.

**Architecture:** Create a focused `packages/agents` workspace package because no implemented orchestration package currently exists in the repository. The package owns governance contracts only; provider execution remains outside it. Published versions are immutable, channel overlays cannot override authorization/safety policy, and sensitive merge conflicts must be resolved explicitly.

**Tech Stack:** TypeScript 5.7, npm workspaces, Vitest 3.2.

**Spec:** `docs/superpowers/specs/2026-09-06-winter27-atlas-platform-controls-design.md`

## Global Constraints
- GitHub is the evidence/arbitration surface; model identity never decides a merge.
- Agent policy cannot bypass tenant scope, safety, or authorization.
- Published versions are immutable.
- Tool capability, permission, safety-policy, and provider/model conflicts are never auto-resolved silently.
- Reuse `AtlasPermission` from `@atlas/core` after the core platform-control plan lands.
- Do not embed governance rules in `apps/web`.

---

### Task 1: Create the agent-governance package and immutable version model

**Files:**
- Create: `packages/agents/package.json`
- Create: `packages/agents/src/types.ts`
- Create: `packages/agents/src/versioning.ts`
- Create: `packages/agents/src/index.ts`
- Create: `tests/unit/agent-versioning.test.ts`

**Interfaces:**
- Consumes: `AtlasPermission`, `TenantScope` from `packages/core/src`.
- Produces: `AgentStatus`, `AgentChannel`, `AgentVersion`, `createAgentDraft`, `publishAgentVersion`.

- [ ] **Step 1: Write failing versioning tests**

```ts
import { expect, it } from 'vitest';
import { createAgentDraft, publishAgentVersion } from '../../packages/agents/src';

const draft = createAgentDraft({
  agentId: 'atlas-assistant',
  versionId: 'v1',
  parentVersionId: null,
  scope: { tenantId: 't1', organizationId: 'o1' },
  provider: 'openai',
  model: 'gpt-5.6',
  coreInstructions: 'Assist within ATLAS policy.',
  permissions: ['agents.read'],
  tools: ['search'],
  safetyRules: ['tenant-isolation'],
  channelInstructions: { web: 'Use concise web responses.' },
  createdByActorId: 'user-1',
  createdAt: '2026-09-06T18:00:00.000Z'
});

it('creates a draft version', () => {
  expect(draft.status).toBe('draft');
});

it('publishes as a frozen immutable version', () => {
  const published = publishAgentVersion(draft, '2026-09-06T18:05:00.000Z');
  expect(published.status).toBe('published');
  expect(Object.isFrozen(published)).toBe(true);
  expect(Object.isFrozen(published.permissions)).toBe(true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-versioning.test.ts`

- [ ] **Step 3: Implement exact model**

```ts
import type { AtlasPermission, TenantScope } from '../../core/src';

export type AgentStatus = 'draft' | 'review' | 'approved' | 'published' | 'retired';
export type AgentChannel = 'web' | 'mobile' | 'voice' | 'whatsapp' | 'email' | 'operator_console';

export type AgentVersion = {
  agentId: string;
  versionId: string;
  parentVersionId: string | null;
  scope: TenantScope;
  status: AgentStatus;
  provider: string;
  model: string;
  coreInstructions: string;
  permissions: readonly AtlasPermission[];
  tools: readonly string[];
  safetyRules: readonly string[];
  channelInstructions: Readonly<Partial<Record<AgentChannel, string>>>;
  createdByActorId: string;
  createdAt: string;
  publishedAt?: string;
};
```

`createAgentDraft` must defensively copy arrays/objects. `publishAgentVersion` must return a deeply frozen value for arrays, scope, channel instructions, and the outer version object.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/unit/agent-versioning.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/agents tests/unit/agent-versioning.test.ts
git commit -m "feat: add immutable ATLAS agent versions"
```

---

### Task 2: Add channel-aware instruction resolution without policy bypass

**Files:**
- Create: `packages/agents/src/channels.ts`
- Modify: `packages/agents/src/index.ts`
- Modify: `tests/unit/agent-versioning.test.ts`

**Interfaces:**
- Produces: `ResolvedAgentInstructions`, `resolveAgentInstructions`.

- [ ] **Step 1: Add failing channel tests**

```ts
import { resolveAgentInstructions } from '../../packages/agents/src';

it('combines core and channel presentation instructions', () => {
  const resolved = resolveAgentInstructions(draft, 'web');
  expect(resolved.core).toBe('Assist within ATLAS policy.');
  expect(resolved.channel).toBe('Use concise web responses.');
  expect(resolved.permissions).toEqual(['agents.read']);
  expect(resolved.safetyRules).toEqual(['tenant-isolation']);
});

it('uses no fabricated overlay when channel is absent', () => {
  const resolved = resolveAgentInstructions(draft, 'mobile');
  expect(resolved.channel).toBeNull();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-versioning.test.ts`

- [ ] **Step 3: Implement resolver**

```ts
import type { AgentChannel, AgentVersion } from './types';

export type ResolvedAgentInstructions = {
  core: string;
  channel: string | null;
  permissions: AgentVersion['permissions'];
  tools: AgentVersion['tools'];
  safetyRules: AgentVersion['safetyRules'];
};

export function resolveAgentInstructions(version: AgentVersion, channel: AgentChannel): ResolvedAgentInstructions {
  return {
    core: version.coreInstructions,
    channel: version.channelInstructions[channel] ?? null,
    permissions: version.permissions,
    tools: version.tools,
    safetyRules: version.safetyRules
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/agent-versioning.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/agents/src tests/unit/agent-versioning.test.ts
git commit -m "feat: resolve channel-aware agent instructions"
```

---

### Task 3: Add deterministic agent-version comparison

**Files:**
- Create: `packages/agents/src/diff.ts`
- Modify: `packages/agents/src/index.ts`
- Create: `tests/unit/agent-diff.test.ts`

**Interfaces:**
- Produces: `AgentDiff`, `diffAgentVersions`.

- [ ] **Step 1: Write failing comparison test**

```ts
import { expect, it } from 'vitest';
import { diffAgentVersions } from '../../packages/agents/src';

it('surfaces sensitive changes explicitly', () => {
  const result = diffAgentVersions(
    { ...draft, versionId: 'v1' },
    { ...draft, versionId: 'v2', model: 'model-b', permissions: ['agents.publish'], tools: ['search', 'deploy'] }
  );
  expect(result.changedFields).toContain('model');
  expect(result.changedFields).toContain('permissions');
  expect(result.changedFields).toContain('tools');
  expect(result.sensitiveFields).toEqual(expect.arrayContaining(['permissions', 'tools', 'model']));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-diff.test.ts`

- [ ] **Step 3: Implement canonical diff**

```ts
export type AgentDiffField =
  | 'provider' | 'model' | 'coreInstructions' | 'permissions'
  | 'tools' | 'safetyRules' | 'channelInstructions';

export type AgentDiff = {
  changedFields: AgentDiffField[];
  sensitiveFields: AgentDiffField[];
};

const sensitive = new Set<AgentDiffField>(['provider', 'model', 'permissions', 'tools', 'safetyRules']);
```

`diffAgentVersions(a, b)` must compare normalized JSON for arrays and channel maps, preserve the field order above, and derive `sensitiveFields` from that ordered result.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/agent-diff.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/agents/src/diff.ts packages/agents/src/index.ts tests/unit/agent-diff.test.ts
git commit -m "feat: compare ATLAS agent versions"
```

---

### Task 4: Add conflict-aware three-way merge

**Files:**
- Create: `packages/agents/src/merge.ts`
- Modify: `packages/agents/src/index.ts`
- Create: `tests/unit/agent-merge.test.ts`

**Interfaces:**
- Produces: `AgentMergeConflict`, `AgentMergeResult`, `mergeAgentVersions`.

- [ ] **Step 1: Write failing merge tests**

```ts
import { expect, it } from 'vitest';
import { mergeAgentVersions } from '../../packages/agents/src';

it('refuses to silently merge conflicting permission changes', () => {
  const base = { ...draft, versionId: 'base' };
  const left = { ...base, versionId: 'left', permissions: ['agents.read', 'agents.write'] };
  const right = { ...base, versionId: 'right', permissions: ['agents.read', 'agents.publish'] };
  const result = mergeAgentVersions(base, left, right, 'merged');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.conflicts.map((c) => c.field)).toContain('permissions');
});

it('merges a non-conflicting channel edit with an unrelated instruction edit', () => {
  const base = { ...draft, versionId: 'base' };
  const left = { ...base, versionId: 'left', coreInstructions: 'Updated core.' };
  const right = { ...base, versionId: 'right', channelInstructions: { ...base.channelInstructions, mobile: 'Short mobile output.' } };
  const result = mergeAgentVersions(base, left, right, 'merged');
  expect(result.ok).toBe(true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-merge.test.ts`

- [ ] **Step 3: Implement merge behavior**

```ts
export type AgentMergeConflict = {
  field: 'provider' | 'model' | 'coreInstructions' | 'permissions' | 'tools' | 'safetyRules' | 'channelInstructions';
  left: unknown;
  right: unknown;
};

export type AgentMergeResult =
  | { ok: true; version: AgentVersion }
  | { ok: false; conflicts: AgentMergeConflict[] };
```

Use three-way rules per field:
- if left equals right, take either;
- if left equals base, take right;
- if right equals base, take left;
- otherwise record a conflict;
- never auto-union permissions, tools, or safety rules.

The successful merged version must be a new `draft` with the supplied version ID and `parentVersionId` set to `base.versionId`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/agent-merge.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/agents/src/merge.ts packages/agents/src/index.ts tests/unit/agent-merge.test.ts
git commit -m "feat: add conflict-aware agent version merge"
```

---

### Task 5: Verify agent-governance package and arbitration evidence

**Files:**
- Test: `tests/unit/agent-versioning.test.ts`
- Test: `tests/unit/agent-diff.test.ts`
- Test: `tests/unit/agent-merge.test.ts`

- [ ] **Step 1: Run all agent tests**

Run: `npm test -- tests/unit/agent-versioning.test.ts tests/unit/agent-diff.test.ts tests/unit/agent-merge.test.ts`

Expected: PASS.

- [ ] **Step 2: Run repository typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run unit regression suite**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Verify package contains no provider-specific execution code**

Run: `git grep -nE '(salesforce\.com|api\.openai\.com|generativelanguage\.googleapis\.com)' -- packages/agents || true`

Expected: no hard-coded provider endpoints.

- [ ] **Step 6: Commit compatibility corrections only if required**

```bash
git add packages/agents tests/unit
git commit -m "test: verify ATLAS agent governance"
```

Do not create an empty commit if no correction was needed.
