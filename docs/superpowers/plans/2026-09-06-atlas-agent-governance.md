# ATLAS Agent Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider-neutral immutable agent versioning, channel-aware instruction overlays, deterministic comparison, and conflict-aware merge rules for ATLAS agents.

**Architecture:** Create a focused `packages/agents` workspace package because no implemented orchestration package currently exists in the repository. The package owns governance contracts only; provider execution remains outside it. Published versions are immutable, channel overlays cannot override authorization/safety policy, and sensitive merge conflicts must be resolved explicitly.

**Tech Stack:** TypeScript 5.7, npm workspaces, Vitest 3.2.

**Spec:** `docs/superpowers/specs/2026-09-06-winter27-atlas-platform-controls-design.md`

## Global Constraints
- Execute after `docs/superpowers/plans/2026-09-06-atlas-core-platform-controls.md`.
- GitHub is the evidence/arbitration surface; model identity never decides a merge.
- Agent policy cannot bypass tenant scope, safety, or authorization.
- Published versions are immutable.
- Tool capability, permission, safety-policy, and provider/model conflicts are never auto-resolved silently.
- Reuse `AtlasPermission` and `TenantScope` from `packages/core`.
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
- Produces: `AgentStatus`, `AgentChannel`, `AgentVersion`, `AgentDraftInput`, `createAgentDraft`, `publishAgentVersion`.

- [ ] **Step 1: Write failing versioning tests**

```ts
import { expect, it } from 'vitest';
import { createAgentDraft, publishAgentVersion } from '../../packages/agents/src';

const draft = createAgentDraft({
  agentId: 'atlas-assistant', versionId: 'v1', parentVersionId: null,
  scope: { tenantId: 't1', organizationId: 'o1' },
  provider: 'openai', model: 'gpt-5.6',
  coreInstructions: 'Assist within ATLAS policy.',
  permissions: ['agents.read'], tools: ['search'], safetyRules: ['tenant-isolation'],
  channelInstructions: { web: 'Use concise web responses.' },
  createdByActorId: 'user-1', createdAt: '2026-09-06T18:00:00.000Z'
});

it('creates a draft version', () => expect(draft.status).toBe('draft'));

it('publishes as a deeply frozen version', () => {
  const published = publishAgentVersion(draft, '2026-09-06T18:05:00.000Z');
  expect(published.status).toBe('published');
  expect(Object.isFrozen(published)).toBe(true);
  expect(Object.isFrozen(published.permissions)).toBe(true);
  expect(Object.isFrozen(published.scope)).toBe(true);
  expect(Object.isFrozen(published.channelInstructions)).toBe(true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-versioning.test.ts`

Expected: FAIL because `packages/agents` does not exist.

- [ ] **Step 3: Create package and exact types**

```json
{
  "name": "@atlas/agents",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
```

```ts
// packages/agents/src/types.ts
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

export type AgentDraftInput = Omit<AgentVersion, 'status' | 'publishedAt'>;
```

- [ ] **Step 4: Implement immutable draft and publish functions**

```ts
// packages/agents/src/versioning.ts
import type { AgentDraftInput, AgentVersion } from './types';

function freezeVersion(version: AgentVersion): AgentVersion {
  const frozen: AgentVersion = {
    ...version,
    scope: Object.freeze({ ...version.scope }),
    permissions: Object.freeze([...version.permissions]),
    tools: Object.freeze([...version.tools]),
    safetyRules: Object.freeze([...version.safetyRules]),
    channelInstructions: Object.freeze({ ...version.channelInstructions })
  };
  return Object.freeze(frozen);
}

export function createAgentDraft(input: AgentDraftInput): AgentVersion {
  return {
    ...input,
    scope: { ...input.scope },
    status: 'draft',
    permissions: [...input.permissions],
    tools: [...input.tools],
    safetyRules: [...input.safetyRules],
    channelInstructions: { ...input.channelInstructions }
  };
}

export function publishAgentVersion(version: AgentVersion, publishedAt: string): AgentVersion {
  if (version.status === 'retired') throw new Error('retired_agent_cannot_publish');
  return freezeVersion({ ...version, status: 'published', publishedAt });
}
```

```ts
// packages/agents/src/index.ts
export * from './types';
export * from './versioning';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/unit/agent-versioning.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

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
  expect(resolveAgentInstructions(draft, 'mobile').channel).toBeNull();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-versioning.test.ts`

- [ ] **Step 3: Implement resolver**

```ts
// packages/agents/src/channels.ts
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

Add `export * from './channels';` to `packages/agents/src/index.ts`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/agent-versioning.test.ts`

Expected: PASS.

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
- Produces: `AgentDiffField`, `AgentDiff`, `diffAgentVersions`.

- [ ] **Step 1: Write failing comparison test**

```ts
import { expect, it } from 'vitest';
import { createAgentDraft, diffAgentVersions } from '../../packages/agents/src';

const base = createAgentDraft({
  agentId: 'a', versionId: 'v1', parentVersionId: null,
  scope: { tenantId: 't1', organizationId: 'o1' }, provider: 'openai', model: 'm1',
  coreInstructions: 'core', permissions: ['agents.read'], tools: ['search'],
  safetyRules: ['tenant-isolation'], channelInstructions: {},
  createdByActorId: 'u1', createdAt: '2026-09-06T18:00:00.000Z'
});

it('surfaces sensitive changes explicitly', () => {
  const result = diffAgentVersions(base, { ...base, versionId: 'v2', model: 'm2', permissions: ['agents.publish'], tools: ['search', 'deploy'] });
  expect(result.changedFields).toEqual(['model', 'permissions', 'tools']);
  expect(result.sensitiveFields).toEqual(['model', 'permissions', 'tools']);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-diff.test.ts`

- [ ] **Step 3: Implement canonical diff**

```ts
// packages/agents/src/diff.ts
import type { AgentVersion } from './types';

export type AgentDiffField =
  | 'provider' | 'model' | 'coreInstructions' | 'permissions'
  | 'tools' | 'safetyRules' | 'channelInstructions';

export type AgentDiff = { changedFields: AgentDiffField[]; sensitiveFields: AgentDiffField[] };

const fields: AgentDiffField[] = [
  'provider', 'model', 'coreInstructions', 'permissions', 'tools', 'safetyRules', 'channelInstructions'
];
const sensitive = new Set<AgentDiffField>(['provider', 'model', 'permissions', 'tools', 'safetyRules']);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffAgentVersions(a: AgentVersion, b: AgentVersion): AgentDiff {
  const changedFields = fields.filter((field) => !equal(a[field], b[field]));
  return { changedFields, sensitiveFields: changedFields.filter((field) => sensitive.has(field)) };
}
```

Add `export * from './diff';` to `packages/agents/src/index.ts`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/agent-diff.test.ts`

Expected: PASS.

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
import { createAgentDraft, mergeAgentVersions } from '../../packages/agents/src';

const base = createAgentDraft({
  agentId: 'a', versionId: 'base', parentVersionId: null,
  scope: { tenantId: 't1', organizationId: 'o1' }, provider: 'openai', model: 'm1',
  coreInstructions: 'core', permissions: ['agents.read'], tools: ['search'],
  safetyRules: ['tenant-isolation'], channelInstructions: {},
  createdByActorId: 'u1', createdAt: '2026-09-06T18:00:00.000Z'
});

it('refuses conflicting permission changes', () => {
  const left = { ...base, versionId: 'left', permissions: ['agents.read', 'agents.write'] as const };
  const right = { ...base, versionId: 'right', permissions: ['agents.read', 'agents.publish'] as const };
  const result = mergeAgentVersions(base, left, right, 'merged', 'u2', '2026-09-06T18:10:00.000Z');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.conflicts.map((c) => c.field)).toContain('permissions');
});

it('merges unrelated edits', () => {
  const left = { ...base, versionId: 'left', coreInstructions: 'updated core' };
  const right = { ...base, versionId: 'right', channelInstructions: { mobile: 'short output' } };
  expect(mergeAgentVersions(base, left, right, 'merged', 'u2', '2026-09-06T18:10:00.000Z').ok).toBe(true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/agent-merge.test.ts`

- [ ] **Step 3: Implement exact merge function**

```ts
// packages/agents/src/merge.ts
import type { AgentDiffField } from './diff';
import type { AgentVersion } from './types';
import { createAgentDraft } from './versioning';

export type AgentMergeConflict = { field: AgentDiffField; left: unknown; right: unknown };
export type AgentMergeResult = { ok: true; version: AgentVersion } | { ok: false; conflicts: AgentMergeConflict[] };

const fields: AgentDiffField[] = [
  'provider', 'model', 'coreInstructions', 'permissions', 'tools', 'safetyRules', 'channelInstructions'
];
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeAgentVersions(
  base: AgentVersion,
  left: AgentVersion,
  right: AgentVersion,
  versionId: string,
  createdByActorId: string,
  createdAt: string
): AgentMergeResult {
  const values: Record<AgentDiffField, unknown> = {} as Record<AgentDiffField, unknown>;
  const conflicts: AgentMergeConflict[] = [];

  for (const field of fields) {
    const b = base[field]; const l = left[field]; const r = right[field];
    if (equal(l, r)) values[field] = l;
    else if (equal(l, b)) values[field] = r;
    else if (equal(r, b)) values[field] = l;
    else conflicts.push({ field, left: l, right: r });
  }

  if (conflicts.length) return { ok: false, conflicts };

  return {
    ok: true,
    version: createAgentDraft({
      agentId: base.agentId,
      versionId,
      parentVersionId: base.versionId,
      scope: base.scope,
      provider: values.provider as string,
      model: values.model as string,
      coreInstructions: values.coreInstructions as string,
      permissions: values.permissions as AgentVersion['permissions'],
      tools: values.tools as AgentVersion['tools'],
      safetyRules: values.safetyRules as AgentVersion['safetyRules'],
      channelInstructions: values.channelInstructions as AgentVersion['channelInstructions'],
      createdByActorId,
      createdAt
    })
  };
}
```

Add `export * from './merge';` to `packages/agents/src/index.ts`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/agent-merge.test.ts`

Expected: PASS.

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

- [ ] **Step 5: Verify package contains no provider-specific endpoints**

Run: `git grep -nE '(salesforce\.com|api\.openai\.com|generativelanguage\.googleapis\.com)' -- packages/agents || true`

Expected: no hard-coded provider endpoints.

- [ ] **Step 6: Commit compatibility corrections only if required**

```bash
git add packages/agents tests/unit
git commit -m "test: verify ATLAS agent governance"
```

Do not create an empty commit if no correction was needed.
