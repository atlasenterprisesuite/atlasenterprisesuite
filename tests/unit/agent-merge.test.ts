import { expect, it } from 'vitest';
import { createAgentDraft, mergeAgentVersions } from '../../packages/agents/src';

const base = createAgentDraft({
  agentId: 'a',
  versionId: 'base',
  parentVersionId: null,
  scope: { tenantId: 't1', organizationId: 'o1' },
  provider: 'openai',
  model: 'm1',
  coreInstructions: 'core',
  permissions: ['agents.read'],
  tools: ['search'],
  safetyRules: ['tenant-isolation'],
  channelInstructions: {},
  createdByActorId: 'u1',
  createdAt: '2026-09-06T18:00:00.000Z'
});

it('refuses conflicting permission changes', () => {
  const result = mergeAgentVersions(
    base,
    { ...base, permissions: ['agents.read', 'agents.write'] as const },
    { ...base, permissions: ['agents.read', 'agents.publish'] as const },
    'merged',
    'u2',
    '2026-09-06T18:10:00.000Z'
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.conflicts.map((conflict) => conflict.field)).toContain('permissions');
  }
});

it('merges unrelated edits into a new draft', () => {
  const result = mergeAgentVersions(
    base,
    { ...base, coreInstructions: 'updated core' },
    { ...base, channelInstructions: { mobile: 'short output' } },
    'merged',
    'u2',
    '2026-09-06T18:10:00.000Z'
  );

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.version.status).toBe('draft');
    expect(result.version.parentVersionId).toBe('base');
    expect(result.version.coreInstructions).toBe('updated core');
    expect(result.version.channelInstructions.mobile).toBe('short output');
  }
});
