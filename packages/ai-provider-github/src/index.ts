import {
  createCouncilResponseEnvelope,
  type CouncilProviderAdapter,
  type CouncilProviderHealth,
  type CouncilProviderInvocationContext,
  type CouncilResponseEnvelope,
} from '../../ai-council-core/src';

export type GitHubCopilotAssignment = Readonly<{
  assignmentId: string;
  url: string;
  status: 'assigned' | 'queued' | 'failed';
}>;

export type GitHubCopilotClient = {
  assignIssue(input: {
    repositoryId: string;
    issueNumber: number;
    baseBranch: string;
    customInstructions: string;
    model: string;
  }): Promise<GitHubCopilotAssignment>;
  cancel?(assignmentId: string): Promise<void>;
};

export function createGitHubCopilotProviderAdapter(options: {
  client: GitHubCopilotClient;
  baseBranch: string;
  model: string;
  now?: () => string;
}): CouncilProviderAdapter<GitHubCopilotAssignment> {
  const now = options.now ?? (() => new Date().toISOString());
  let state: CouncilProviderHealth['state'] = 'configured';
  let detail: string | undefined;

  return {
    providerId: 'github-copilot',

    async health() {
      return Object.freeze({ state, checkedAt: now(), ...(detail ? { detail } : {}) });
    },

    capabilities() {
      return Object.freeze({
        reasoning: false,
        review: false,
        implementation: true,
        cancellation: typeof options.client.cancel === 'function',
      });
    },

    async invoke(context: CouncilProviderInvocationContext) {
      const issueNumber = context.task.linkedIssue;
      if (issueNumber == null) {
        throw new Error('GitHub Copilot delegation requires an already-linked issue');
      }

      try {
        const assignment = await options.client.assignIssue({
          repositoryId: context.task.repositoryId,
          issueNumber,
          baseBranch: options.baseBranch,
          customInstructions: context.prompt,
          model: options.model,
        });
        state = 'verified';
        detail = undefined;
        return assignment;
      } catch (error) {
        state = 'degraded';
        detail = error instanceof Error ? error.message : 'GitHub Copilot assignment failed';
        throw error;
      }
    },

    async cancel(executionId: string) {
      if (!options.client.cancel) throw new Error('GitHub Copilot cancellation is not configured');
      await options.client.cancel(executionId);
    },

    normalize(rawResponse: GitHubCopilotAssignment, executionId: string): CouncilResponseEnvelope {
      return createCouncilResponseEnvelope({
        provider: 'github-copilot',
        model: options.model,
        role: 'implementation',
        summary: `Copilot assignment ${rawResponse.status}`,
        analysisOrRecommendation: rawResponse.url,
        evidenceRefs: [rawResponse.url],
        executionId,
      });
    },
  };
}
