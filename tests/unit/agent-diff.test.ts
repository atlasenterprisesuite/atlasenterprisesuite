import { expect, it } from 'vitest';
import { createAgentDraft, diffAgentVersions } from '../../packages/agents/src';

const base = createAgentDraft({
  agentId: 'a',
  versionId: 'v1',
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

it('surfaces sensitive changes in deterministic order', () => {
  const result = diffAgentVersions(base, {
    ...base,
    versionId: 'v2',
    model: 'm2',
    permissions: ['agents.publish'],
    tools: ['search', 'deploy']
  });

  expect(result.changedFields).toEqual(['model', 'permissions', 'tools']);
  expect(result.sensitiveFields).toEqual(['model', 'permissions', 'tools']);
});
