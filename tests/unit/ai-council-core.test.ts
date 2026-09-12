import { describe, expect, it } from 'vitest';
import {
  COUNCIL_GENERATED_MARKER,
  canTransitionCouncilTask,
  createCouncilEvidence,
  createCouncilResponseEnvelope,
  createCouncilTask,
  evaluateCouncilConsensus,
  hasCouncilPermission,
  parseCouncilCommand,
  shouldAcceptCouncilEvent,
  transitionCouncilTask,
} from '../../packages/ai-council-core/src';

describe('ATLAS AI Council core', () => {
  it('parses supported discussion commands without provider contamination', () => {
    expect(parseCouncilCommand('/ask all\nShould ATLAS change identity?')).toEqual({
      kind: 'ask',
      provider: 'all',
      prompt: 'Should ATLAS change identity?',
    });
    expect(parseCouncilCommand('/ask openai\nReview the architecture')).toEqual({
      kind: 'ask',
      provider: 'openai',
      prompt: 'Review the architecture',
    });
    expect(parseCouncilCommand('/delegate copilot\nImplement approved task')).toEqual({
      kind: 'delegate',
      target: 'copilot',
      prompt: 'Implement approved task',
    });
    expect(parseCouncilCommand('/ship production now')).toBeNull();
  });

  it('creates immutable received tasks in the caller tenant and organization scope', () => {
    const command = parseCouncilCommand('/status');
    if (!command) throw new Error('Expected /status command to parse');

    const task = createCouncilTask(
      {
        tenantId: 'tenant-a',
        organizationId: 'org-a',
        repositoryId: 'repo-1',
        discussionId: 'discussion-1',
        originCommentId: 'comment-1',
        requestingActor: 'winder',
        command,
        promptHash: 'sha256:abc',
        promptSnapshot: '/status',
      },
      {
        id: () => 'task-1',
        now: () => '2026-09-10T02:20:00.000Z',
      },
    );

    expect(task).toMatchObject({
      tenantId: 'tenant-a',
      organizationId: 'org-a',
      taskId: 'task-1',
      state: 'received',
      consensusState: 'pending',
      turnCount: 0,
      maxTurns: 6,
      linkedIssue: null,
      linkedPr: null,
    });
    expect(Object.isFrozen(task)).toBe(true);
  });

  it('allows only governed task state transitions', () => {
    expect(canTransitionCouncilTask('received', 'authorized')).toBe(true);
    expect(canTransitionCouncilTask('received', 'completed')).toBe(false);

    const command = parseCouncilCommand('/status');
    if (!command) throw new Error('Expected /status command to parse');
    const task = createCouncilTask(
      {
        tenantId: 'tenant-a',
        organizationId: 'org-a',
        repositoryId: 'repo-1',
        discussionId: 'discussion-1',
        originCommentId: 'comment-1',
        requestingActor: 'winder',
        command,
        promptHash: 'sha256:abc',
        promptSnapshot: '/status',
      },
      { id: () => 'task-2', now: () => '2026-09-10T02:20:00.000Z' },
    );

    const authorized = transitionCouncilTask(task, 'authorized', () => '2026-09-10T02:21:00.000Z');
    expect(authorized.state).toBe('authorized');
    expect(authorized.updatedAt).toBe('2026-09-10T02:21:00.000Z');
    expect(() => transitionCouncilTask(task, 'completed')).toThrow(/Invalid AI Council task transition/);
  });

  it('blocks generated comments and exhausted tasks from recursive execution', () => {
    expect(
      shouldAcceptCouncilEvent({
        body: `${COUNCIL_GENERATED_MARKER}\n/ask all`,
        turnCount: 0,
        maxTurns: 6,
      }),
    ).toBe(false);
    expect(shouldAcceptCouncilEvent({ body: '/ask all', turnCount: 6, maxTurns: 6 })).toBe(false);
    expect(shouldAcceptCouncilEvent({ body: '/ask all', turnCount: 1, maxTurns: 6 })).toBe(true);
  });

  it('applies policy vetoes before consensus synthesis', () => {
    const decision = evaluateCouncilConsensus([
      { executionId: 'openai-1', provider: 'openai', stance: 'support' },
      {
        executionId: 'gemini-1',
        provider: 'gemini',
        stance: 'conditional',
        veto: true,
        conditions: ['security review'],
      },
    ]);

    expect(decision.state).toBe('blocked');
    expect(decision.conditions).toEqual(['security review']);
    expect(decision.ruleVersion).toBe('ai-council-consensus-v1');
  });

  it('requires human review for substantive provider disagreement', () => {
    expect(
      evaluateCouncilConsensus([
        { executionId: 'openai-2', provider: 'openai', stance: 'support' },
        { executionId: 'gemini-2', provider: 'gemini', stance: 'oppose' },
      ]).state,
    ).toBe('needs_human_review');
  });

  it('does not call incomplete provider evidence approved', () => {
    expect(
      evaluateCouncilConsensus([
        { executionId: 'openai-3', provider: 'openai', stance: 'support' },
        { executionId: 'gemini-3', provider: 'gemini', stance: 'unavailable' },
      ]).state,
    ).toBe('insufficient_evidence');

    expect(
      evaluateCouncilConsensus([
        { executionId: 'openai-4', provider: 'openai', stance: 'support' },
        { executionId: 'gemini-4', provider: 'gemini', stance: 'support' },
      ]).state,
    ).toBe('approved');
  });

  it('creates allowlisted immutable evidence records and drops extra secret-shaped fields', () => {
    const input = {
      taskId: 'task-1',
      executionId: 'exec-1',
      kind: 'provider_response' as const,
      reference: 'discussion://123#comment-4',
      contentHash: 'sha256:def',
      secret: 'must-not-leak',
    };

    const evidence = createCouncilEvidence(input, {
      id: () => 'evidence-1',
      now: () => '2026-09-10T02:30:00.000Z',
    });

    expect(evidence).toEqual({
      evidenceId: 'evidence-1',
      taskId: 'task-1',
      executionId: 'exec-1',
      kind: 'provider_response',
      reference: 'discussion://123#comment-4',
      contentHash: 'sha256:def',
      createdAt: '2026-09-10T02:30:00.000Z',
    });
    expect(Object.hasOwn(evidence, 'secret')).toBe(false);
    expect(Object.isFrozen(evidence)).toBe(true);
  });

  it('normalizes model output into a provider-independent response envelope', () => {
    const response = createCouncilResponseEnvelope({
      provider: 'openai',
      model: 'example-model',
      role: 'architecture',
      summary: 'Summary',
      analysisOrRecommendation: 'Recommendation',
      executionId: 'exec-1',
      evidenceRefs: ['evidence-1'],
    });

    expect(response.confidenceState).toBe('unknown');
    expect(response.evidenceRefs).toEqual(['evidence-1']);
    expect(Object.isFrozen(response)).toBe(true);
    expect(Object.isFrozen(response.evidenceRefs)).toBe(true);
  });

  it('reuses ATLAS RBAC while granting AI Council admin authority only inside the council namespace', () => {
    expect(hasCouncilPermission(['ai_council.admin'], 'ai_council.delegate')).toBe(true);
    expect(hasCouncilPermission(['ai_council.read'], 'ai_council.delegate')).toBe(false);
    expect(hasCouncilPermission(['ai_council.invoke'], 'ai_council.invoke')).toBe(true);
  });
});
