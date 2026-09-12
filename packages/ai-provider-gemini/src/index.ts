import {
  createCouncilResponseEnvelope,
  type CouncilProviderAdapter,
  type CouncilProviderHealth,
  type CouncilProviderInvocationContext,
  type CouncilResponseEnvelope,
} from '../../ai-council-core/src';

export type GeminiProviderRawResponse = Readonly<{
  id: string;
  model: string;
  text: string;
}>;

export type GeminiProviderClient = {
  generateContent(input: {
    model: string;
    prompt: string;
    policyContext: Readonly<Record<string, unknown>>;
  }): Promise<GeminiProviderRawResponse>;
  cancel?(responseId: string): Promise<void>;
};

export function createGeminiProviderAdapter(options: {
  client: GeminiProviderClient;
  model: string;
  now?: () => string;
}): CouncilProviderAdapter<GeminiProviderRawResponse> {
  const now = options.now ?? (() => new Date().toISOString());
  let state: CouncilProviderHealth['state'] = 'configured';
  let detail: string | undefined;

  return {
    providerId: 'gemini',

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
        const response = await options.client.generateContent({
          model: options.model,
          prompt: context.prompt,
          policyContext: context.policyContext,
        });
        state = 'verified';
        detail = undefined;
        return response;
      } catch (error) {
        state = 'degraded';
        detail = error instanceof Error ? error.message : 'Gemini provider invocation failed';
        throw error;
      }
    },

    async cancel(executionId: string) {
      if (!options.client.cancel) throw new Error('Gemini provider cancellation is not configured');
      await options.client.cancel(executionId);
    },

    normalize(rawResponse: GeminiProviderRawResponse, executionId: string): CouncilResponseEnvelope {
      return createCouncilResponseEnvelope({
        provider: 'gemini',
        model: rawResponse.model || options.model,
        role: 'reasoning',
        summary: rawResponse.text,
        analysisOrRecommendation: rawResponse.text,
        executionId,
      });
    },
  };
}
