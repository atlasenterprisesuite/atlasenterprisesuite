import { expect, it } from 'vitest';
import {
  canTransitionAgentStatus,
  createAgentDraft,
  transitionAgentStatus
} from '../../packages/agents/src';

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

it('creates a draft', () => {
  expect(draft.status).toBe('draft');
});

it('allows draft to review', () => {
  expect(canTransitionAgentStatus('draft', 'review')).toBe(true);
});

it('blocks draft directly to published', () => {
  expect(canTransitionAgentStatus('draft', 'published')).toBe(false);
});

it('moves approved to published', () => {
  expect(
    transitionAgentStatus({ ...draft, status: 'approved' }, 'published').status
  ).toBe('published');
});
