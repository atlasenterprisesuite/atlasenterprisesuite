import { describe, expect, it, vi } from 'vitest';
import { createCouncilTask, parseCouncilCommand } from '../../packages/ai-council-core/src';
import { createOpenAIProviderAdapter } from '../../packages/ai-provider-openai/src';
import { createGeminiProviderAdapter } from '../../packages/ai-provider-gemini/src';
import { createGitHubCopilotProviderAdapter } from '../../packages/ai-provider-github/src';

function councilTask(linkedIssue: number | null = null) {
  const command = parseCouncilCommand('/ask all\nReview ATLAS identity');
  if (!command) throw new Error('Expected command');
  const task = createCouncilTask(
    {
      tenantId: 'tenant-a',
      organizationId: 'org-a',
      repositoryId: 'atlasenterprisesuite/atlasenterprisesuite',
      discussionId: 'discussion-1',
      originCommentId: 'comment-1',
      requestingActor: 'winder',
      command,
      promptHash: 'sha256:test',
      promptSnapshot: '/ask all\nReview ATLAS identity',
    },
    { id: () => 'task-1', now: () => '2026-09-10T03:00:00.000Z' },
  );
  return Object.freeze({ ...task, linkedIssue });
}

describe('ATLAS AI Council provider adapters', () => {
  it('keeps OpenAI transport outside core and marks successful runtime evidence verified', async () => {
    const createResponse = vi.fn(async () => ({
      id: 'resp-1',
      model: 'gpt-5.6-sol',
      text: 'OpenAI architecture recommendation',
    }));
    const adapter = createOpenAIProviderAdapter({
      model: 'gpt-5.6-sol',
      client: { createResponse },
      now: () => '2026-09-10T03:01:00.000Z',
    });

    expect((await adapter.health()).state).toBe('configured');
    const raw = await adapter.invoke({
      task: councilTask(),
      prompt: 'Review ATLAS identity',
      policyContext: { consensusRule: 'v1' },
    });
    const normalized = adapter.normalize(raw, 'exec-openai-1');

    expect(createResponse).toHaveBeenCalledWith({
      model: 'gpt-5.6-sol',
      prompt: 'Review ATLAS identity',
      policyContext: { consensusRule: 'v1' },
    });
    expect((await adapter.health()).state).toBe('verified');
    expect(normalized).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.6-sol',
      executionId: 'exec-openai-1',
      analysisOrRecommendation: 'OpenAI architecture recommendation',
    });
  });

  it('degrades OpenAI provider state after a transport failure without fabricating output', async () => {
    const adapter = createOpenAIProviderAdapter({
      model: 'gpt-5.6-sol',
      client: { createResponse: vi.fn(async () => { throw new Error('rate limited'); }) },
      now: () => '2026-09-10T03:02:00.000Z',
    });

    await expect(
      adapter.invoke({ task: councilTask(), prompt: 'Review', policyContext: {} }),
    ).rejects.toThrow('rate limited');
    expect((await adapter.health()).state).toBe('degraded');
  });

  it('keeps Gemini independent and normalizes its response through the common envelope', async () => {
    const generateContent = vi.fn(async () => ({
      id: 'gemini-1',
      model: 'gemini-2.5-pro',
      text: 'Gemini reliability recommendation',
    }));
    const adapter = createGeminiProviderAdapter({
      model: 'gemini-2.5-pro',
      client: { generateContent },
      now: () => '2026-09-10T03:03:00.000Z',
    });

    const raw = await adapter.invoke({
      task: councilTask(),
      prompt: 'Review ATLAS identity',
      policyContext: { independent: true },
    });
    const normalized = adapter.normalize(raw, 'exec-gemini-1');

    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-pro',
      prompt: 'Review ATLAS identity',
      policyContext: { independent: true },
    });
    expect((await adapter.health()).state).toBe('verified');
    expect(normalized.provider).toBe('gemini');
    expect(normalized.analysisOrRecommendation).toBe('Gemini reliability recommendation');
  });

  it('delegates Copilot only through an already-linked issue', async () => {
    const assignIssue = vi.fn(async () => ({
      assignmentId: 'assignment-1',
      url: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/123',
      status: 'assigned' as const,
    }));
    const adapter = createGitHubCopilotProviderAdapter({
      client: { assignIssue },
      baseBranch: 'release/atlas-a-z',
      model: 'default',
      now: () => '2026-09-10T03:04:00.000Z',
    });

    await expect(
      adapter.invoke({ task: councilTask(), prompt: 'Implement it', policyContext: {} }),
    ).rejects.toThrow(/linked issue/i);

    const raw = await adapter.invoke({
      task: councilTask(123),
      prompt: 'Implement approved identity change',
      policyContext: {},
    });
    const normalized = adapter.normalize(raw, 'exec-copilot-1');

    expect(assignIssue).toHaveBeenCalledWith({
      repositoryId: 'atlasenterprisesuite/atlasenterprisesuite',
      issueNumber: 123,
      baseBranch: 'release/atlas-a-z',
      customInstructions: 'Implement approved identity change',
      model: 'default',
    });
    expect(normalized.provider).toBe('github-copilot');
    expect(normalized.role).toBe('implementation');
  });
});
