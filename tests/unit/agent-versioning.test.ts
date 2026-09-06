import { expect, it } from 'vitest';
import {
  canTransitionAgentStatus,
  createAgentDraft,
  publishAgentVersion,
  resolveAgentInstructions,
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

it('denies publication without agents.publish', () => {
  const approved = { ...draft, status: 'approved' as const };
  const result = publishAgentVersion({
    version: approved,
    actorId: 'user-2',
    actor: { scope: approved.scope, permissions: ['agents.read'] as const },
    publishedAt: '2026-09-06T18:05:00.000Z'
  });

  expect(result.ok).toBe(false);
});

it('publishes immutably and emits audit evidence', () => {
  const approved = { ...draft, status: 'approved' as const };
  const result = publishAgentVersion({
    version: approved,
    actorId: 'publisher',
    actor: { scope: approved.scope, permissions: ['agents.publish'] as const },
    publishedAt: '2026-09-06T18:05:00.000Z'
  });

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.version.status).toBe('published');
    expect(Object.isFrozen(result.version)).toBe(true);
    expect(Object.isFrozen(result.version.permissions)).toBe(true);
    expect(result.audit.action).toBe('agents.version.published');
  }
});

it('keeps permissions and safety outside channel overlays', () => {
  const resolved = resolveAgentInstructions(draft, 'web');

  expect(resolved.core).toBe('Assist within ATLAS policy.');
  expect(resolved.channel).toBe('Use concise web responses.');
  expect(resolved.permissions).toEqual(['agents.read']);
  expect(resolved.safetyRules).toEqual(['tenant-isolation']);
});

it('does not fabricate a missing channel overlay', () => {
  expect(resolveAgentInstructions(draft, 'mobile').channel).toBeNull();
});
