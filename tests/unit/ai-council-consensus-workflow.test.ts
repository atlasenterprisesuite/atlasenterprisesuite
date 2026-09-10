import { describe, expect, it, vi } from 'vitest';
import { InMemoryAuditSink } from '../../packages/core/src';
import {
  createCouncilResponseEnvelope,
  createCouncilTask,
  parseCouncilCommand,
  transitionCouncilTask,
  type CouncilProviderAdapter,
  type CouncilProviderOutcome,
} from '../../packages/ai-council-core/src';
import {
  InMemoryCouncilEvidenceStore,
  createCouncilConsensusWorkflow,
} from '../../packages/ai-council-orchestration/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };

function authorizedTask() {
  const command = parseCouncilCommand('/ask all\nReview ATLAS identity');
  if (!command) throw new Error('Expected command');
  const received = createCouncilTask(
    {
      ...scope,
      repositoryId: '1329354275',
      discussionId: 'D_kwDO1',
      originCommentId: 'DC_kwDO2',
      requestingActor: 'user-winder',
      command,
      promptHash: 'sha256:test',
      promptSnapshot: '/ask all\nReview ATLAS identity',
    },
    { id: () => 'task-1', now: () => '2026-09-10T05:00:00.000Z' },
  );
  return transitionCouncilTask(received, 'authorized', () => '2026-09-10T05:00:01.000Z');
}

function fakeProvider(
  providerId: string,
  invoke: (prompt: string) => Promise<{ text: string; model: string }>,
): CouncilProviderAdapter<{ text: string; model: string }> {
  return {
    providerId,
    health: async () => ({ state: 'configured', checkedAt: '2026-09-10T05:00:00.000Z' }),
    capabilities: () => ({ reasoning: true, review: true, implementation: false, cancellation: false }),
    invoke: (context) => invoke(context.prompt),
    cancel: async () => {},
    normalize: (raw, executionId) => createCouncilResponseEnvelope({
      provider: providerId,
      model: raw.model,
      role: 'reasoning',
      summary: raw.text,
      analysisOrRecommendation: raw.text,
      executionId,
    }),
  };
}

function workflow() {
  const audit = new InMemoryAuditSink();
  const evidenceStore = new InMemoryCouncilEvidenceStore();
  let executionCounter = 0;
  let evidenceCounter = 0;
  let auditCounter = 0;
  const service = createCouncilConsensusWorkflow({
    audit,
    evidenceStore,
    now: () => '2026-09-10T05:10:00.000Z',
    executionId: () => `exec-${++executionCounter}`,
    evidenceId: () => `evidence-${++evidenceCounter}`,
    auditId: () => `audit-${++auditCounter}`,
  });
  return { service, audit, evidenceStore };
}

describe('ATLAS AI Council consensus workflow', () => {
  it('invokes reasoning providers independently from the exact same immutable prompt', async () => {
    const openaiPrompts: string[] = [];
    const geminiPrompts: string[] = [];
    const { service } = workflow();

    const collection = await service.collect({
      task: authorizedTask(),
      actorId: 'user-winder',
      policyContext: { ruleVersion: 'v1' },
      providers: [
        fakeProvider('openai', async (prompt) => {
          openaiPrompts.push(prompt);
          return { text: 'OpenAI review', model: 'openai-test' };
        }),
        fakeProvider('gemini', async (prompt) => {
          geminiPrompts.push(prompt);
          return { text: 'Gemini review', model: 'gemini-test' };
        }),
      ],
    });

    expect(openaiPrompts).toEqual(['Review ATLAS identity']);
    expect(geminiPrompts).toEqual(['Review ATLAS identity']);
    expect(collection.task.state).toBe('ready_for_consensus');
    expect(collection.executions.map((entry) => entry.status)).toEqual(['completed', 'completed']);
  });

  it('records evidence only for real provider responses and degrades on provider failure', async () => {
    const { service, evidenceStore, audit } = workflow();
    const collection = await service.collect({
      task: authorizedTask(),
      actorId: 'user-winder',
      policyContext: {},
      providers: [
        fakeProvider('openai', async () => ({ text: 'OpenAI review', model: 'openai-test' })),
        fakeProvider('gemini', async () => { throw new Error('provider unavailable'); }),
      ],
    });

    expect(collection.task.state).toBe('degraded');
    expect(collection.executions).toHaveLength(2);
    expect(collection.executions.find((entry) => entry.provider === 'gemini')).toMatchObject({
      status: 'failed',
      errorClass: 'provider_error',
    });
    expect(evidenceStore.list(scope, 'task-1')).toHaveLength(1);
    expect(audit.list(scope).some((event) => event.action === 'ai_council.provider.failed')).toBe(true);
  });

  it('stores content-hashed provider evidence instead of raw provider secrets', async () => {
    const { service, evidenceStore } = workflow();
    await service.collect({
      task: authorizedTask(),
      actorId: 'user-winder',
      policyContext: {},
      providers: [fakeProvider('openai', async () => ({ text: 'Review', model: 'openai-test' }))],
    });

    const evidence = evidenceStore.list(scope, 'task-1');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].kind).toBe('provider_response');
    expect(evidence[0].contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(evidence[0])).not.toContain('Review');
  });

  it('applies deterministic consensus and requires human approval before handoff', async () => {
    const { service, audit } = workflow();
    const collection = await service.collect({
      task: authorizedTask(),
      actorId: 'user-winder',
      policyContext: {},
      providers: [
        fakeProvider('openai', async () => ({ text: 'Support', model: 'openai-test' })),
        fakeProvider('gemini', async () => ({ text: 'Support', model: 'gemini-test' })),
      ],
    });
    const outcomes: CouncilProviderOutcome[] = collection.executions.map((entry) => ({
      executionId: entry.executionId,
      provider: entry.provider,
      stance: 'support',
    }));

    const final = service.finalize({ collection, outcomes, actorId: 'user-winder' });

    expect(final.decision.state).toBe('approved');
    expect(final.task.consensusState).toBe('approved');
    expect(final.task.state).toBe('awaiting_human_approval');
    expect(audit.list(scope).some((event) => event.action === 'ai_council.consensus.decided')).toBe(true);
  });

  it('cannot turn a policy veto into an approval', async () => {
    const { service } = workflow();
    const collection = await service.collect({
      task: authorizedTask(),
      actorId: 'user-winder',
      policyContext: {},
      providers: [
        fakeProvider('openai', async () => ({ text: 'Support', model: 'openai-test' })),
        fakeProvider('gemini', async () => ({ text: 'Security veto', model: 'gemini-test' })),
      ],
    });
    const [openai, gemini] = collection.executions;
    const outcomes: CouncilProviderOutcome[] = [
      { executionId: openai.executionId, provider: 'openai', stance: 'support' },
      { executionId: gemini.executionId, provider: 'gemini', stance: 'conditional', veto: true, conditions: ['security review'] },
    ];

    const final = service.finalize({ collection, outcomes, actorId: 'user-winder' });
    expect(final.decision.state).toBe('blocked');
    expect(final.task.consensusState).toBe('blocked');
    expect(final.task.state).toBe('blocked');
  });

  it('refuses consensus inputs that do not correspond exactly to collected executions', async () => {
    const { service } = workflow();
    const collection = await service.collect({
      task: authorizedTask(),
      actorId: 'user-winder',
      policyContext: {},
      providers: [fakeProvider('openai', async () => ({ text: 'Support', model: 'openai-test' }))],
    });

    expect(() => service.finalize({
      collection,
      actorId: 'user-winder',
      outcomes: [{ executionId: 'invented-execution', provider: 'openai', stance: 'support' }],
    })).toThrow(/collected executions/i);
  });
});
