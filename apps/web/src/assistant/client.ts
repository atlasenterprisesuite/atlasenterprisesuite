import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';
import { resolveAssistantModule } from './routeContext';

export type AssistantProviderState =
  | 'verified_for_request'
  | 'configured_unverified'
  | 'not_configured'
  | 'unavailable';

export type AssistantProviderReadiness = {
  id: string;
  state: 'verified' | 'configuration-required' | 'rate-limited' | 'unavailable';
  configured: boolean;
  verified: boolean;
  model: string | null;
  capabilities: string[];
  profiles: string[];
  error: string | null;
};

export type AssistantStatusResponse = {
  ok: boolean;
  authenticated: boolean;
  provider: string;
  provider_state: AssistantProviderState;
  model: string | null;
  storage_state: string;
  organization: string;
  role: string | null;
  capabilities: string[];
  providers?: AssistantProviderReadiness[];
  modes?: string[];
  api?: string;
};

export type AssistantChatResponse = {
  ok: boolean;
  text: string;
  conversation_id?: string | null;
  trace_id?: string | null;
  provider_state?: AssistantProviderState;
  provider?: string;
  model?: string;
};

async function parseCopilotResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'invalid_response' };
  }
  if (!response.ok || data?.ok === false) {
    throw new Error(String(data?.error || data?.message || `assistant_request_failed_${response.status}`));
  }
  return data as T;
}

async function assistantOrganization() {
  return getActiveAtlasOrganization();
}

export function hasVerifiedAssistantProvider(status: AssistantStatusResponse): boolean {
  if (Array.isArray(status.providers)) {
    return status.providers.some((provider) => provider.verified === true && provider.state === 'verified');
  }
  return status.provider_state === 'verified_for_request';
}

export function assistantProviderSummary(status: AssistantStatusResponse): string {
  const verified = status.providers?.filter((provider) => provider.verified).map((provider) => provider.id) || [];
  if (verified.length) return verified.join(', ');
  if (status.provider_state === 'verified_for_request') return status.provider || 'verified provider';
  return 'no verified provider';
}

export async function getAssistantStatus(): Promise<AssistantStatusResponse> {
  const organization = await assistantOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=status', {
    method: 'GET',
    headers: { 'x-atlas-org-id': organization.id }
  });
  return parseCopilotResponse<AssistantStatusResponse>(response);
}

export async function sendAssistantMessage(input: {
  message: string;
  pathname: string;
  conversationId?: string | null;
  modality: 'text' | 'voice';
}): Promise<AssistantChatResponse> {
  const message = input.message.trim();
  if (!message) throw new Error('assistant_message_required');

  const organization = await assistantOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=chat', {
    method: 'POST',
    headers: { 'x-atlas-org-id': organization.id },
    body: JSON.stringify({
      organization_id: organization.id,
      module: resolveAssistantModule(input.pathname),
      intent: 'balanced',
      mode: 'auto',
      message,
      conversation_id: input.conversationId || null,
      capabilities_requested: ['generation'],
      client_metadata: {
        modality: input.modality,
        surface: 'atlas-assistant'
      }
    })
  });
  return parseCopilotResponse<AssistantChatResponse>(response);
}
