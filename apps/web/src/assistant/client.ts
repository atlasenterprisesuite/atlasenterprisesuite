import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';
import { resolveAssistantModule } from './routeContext';

export type AssistantMode = 'auto' | 'openai' | 'bedrock' | 'gemini' | 'codex-sovereign' | 'council';
export type AssistantProfile = 'fast' | 'balanced' | 'deep';

export type AssistantProviderState =
  | 'verified_for_request'
  | 'configured_unverified'
  | 'not_configured'
  | 'unavailable';

export type AssistantProviderReadiness = {
  id: string;
  state: 'verified' | 'configured-unverified' | 'configuration-required' | 'rate-limited' | 'unavailable';
  configured: boolean;
  verified: boolean;
  model: string | null;
  capabilities: string[];
  profiles: string[];
  error: string | null;
  api?: string | null;
  backend?: string | null;
  endpoint?: string | null;
  region?: string | null;
  feature_support?: Record<string, boolean>;
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
  modes?: AssistantMode[];
  profiles?: AssistantProfile[];
  api?: string;
  cost_policy?: {
    allow_paid_single?: boolean;
    allow_council?: boolean;
    allowed_providers?: string[];
    zero_cost_providers?: string[];
  };
};

export type AssistantConversation = {
  id: string;
  title: string | null;
  module: string;
  updated_at: string;
};

export type AssistantStoredMessage = {
  id: string;
  role: 'user' | 'assistant' | string;
  content: {
    text?: string;
    routing?: {
      mode?: string;
      providers?: string[];
      profile?: string;
    };
  } | string;
};

export type AssistantChatResponse = {
  ok: boolean;
  text: string;
  output?: string;
  conversation_id?: string | null;
  trace_id?: string | null;
  provider_state?: AssistantProviderState;
  provider?: string;
  providers?: string[];
  model?: string | null;
  mode?: AssistantMode;
  profile?: AssistantProfile;
  fallback_used?: boolean;
  contributions?: Array<{ provider: string; model: string | null; text: string }>;
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

async function assistantHeaders() {
  const organization = await assistantOrganization();
  return { organization, headers: { 'x-atlas-org-id': organization.id } };
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
  const { headers } = await assistantHeaders();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=status', {
    method: 'GET',
    headers
  });
  return parseCopilotResponse<AssistantStatusResponse>(response);
}

export async function listAssistantConversations(): Promise<AssistantConversation[]> {
  const { headers } = await assistantHeaders();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=history', {
    method: 'GET',
    headers
  });
  const payload = await parseCopilotResponse<{ ok: boolean; conversations?: AssistantConversation[] }>(response);
  return Array.isArray(payload.conversations) ? payload.conversations : [];
}

export async function getAssistantConversation(id: string): Promise<{
  conversation: AssistantConversation;
  messages: AssistantStoredMessage[];
}> {
  const { headers } = await assistantHeaders();
  const response = await authorizedAtlasFetch(`/functions/v1/atlas-copilot?api=conversation&id=${encodeURIComponent(id)}`, {
    method: 'GET',
    headers
  });
  return parseCopilotResponse(response);
}

export async function sendAssistantWorkspaceMessage(input: {
  message: string;
  conversationId?: string | null;
  mode: AssistantMode;
  profile: AssistantProfile;
}): Promise<AssistantChatResponse> {
  const message = input.message.trim();
  if (!message) throw new Error('assistant_message_required');

  const { organization, headers } = await assistantHeaders();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      organization_id: organization.id,
      module: 'assistant',
      intent: input.profile,
      mode: input.mode,
      message,
      conversation_id: input.conversationId || null,
      capabilities_requested: ['generation', 'reasoning'],
      client_metadata: {
        modality: 'text',
        surface: 'atlas-assistant-workspace'
      }
    })
  });
  return parseCopilotResponse<AssistantChatResponse>(response);
}

export async function sendAssistantMessage(input: {
  message: string;
  pathname: string;
  conversationId?: string | null;
  modality: 'text' | 'voice';
}): Promise<AssistantChatResponse> {
  const message = input.message.trim();
  if (!message) throw new Error('assistant_message_required');

  const { organization, headers } = await assistantHeaders();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=chat', {
    method: 'POST',
    headers,
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
