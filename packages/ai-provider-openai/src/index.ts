import {
  createCouncilResponseEnvelope,
  type CouncilProviderAdapter,
  type CouncilProviderHealth,
  type CouncilProviderInvocationContext,
  type CouncilResponseEnvelope,
} from '../../ai-council-core/src';

export type OpenAIProviderRawResponse = Readonly<{
  id: string;
  model: string;
  text: string;
}>;

export type OpenAIProviderClient = {
  createResponse(input: {
    model: string;
    prompt: string;
    policyContext: Readonly<Record<string, unknown>>;
  }): Promise<OpenAIProviderRawResponse>;
  cancel?(responseId: string): Promise<void>;
};

export function createOpenAIProviderAdapter(options: {
  client: OpenAIProviderClient;
  model: string;
  now?: () => string;
}): CouncilProviderAdapter<OpenAIProviderRawResponse> {
  const now = options.now ?? (() => new Date().toISOString());
  let state: CouncilProviderHealth['state'] = 'configured';
  let detail: string | undefined;

  return {
    providerId: 'openai',

    async health() {
      return Object.freeze({ state, checkedAt: now(), ...(detail ? { detail } : {}) });
    },

    capabilities() {
      return Object.freeze({
        reasoning: true,
        review: true,
        implementation: false,
        cancellation: typeof options.client.cancel === 'function',
      });
    },

    async invoke(context: CouncilProviderInvocationContext) {
      try {
        const response = await options.client.createResponse({
          model: options.model,
          prompt: context.prompt,
          policyContext: context.policyContext,
        });
        state = 'verified';
        detail = undefined;
        return response;
      } catch (error) {
        state = 'degraded';
        detail = error instanceof Error ? error.message : 'OpenAI provider invocation failed';
        throw error;
      }
    },

    async cancel(executionId: string) {
      if (!options.client.cancel) throw new Error('OpenAI provider cancellation is not configured');
      await options.client.cancel(executionId);
    },

    normalize(rawResponse: OpenAIProviderRawResponse, executionId: string): CouncilResponseEnvelope {
      return createCouncilResponseEnvelope({
        provider: 'openai',
        model: rawResponse.model || options.model,
        role: 'reasoning',
        summary: rawResponse.text,
        analysisOrRecommendation: rawResponse.text,
        executionId,
      });
    },
  };
}
