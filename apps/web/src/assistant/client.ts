import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';
import { resolveAssistantModule } from './routeContext';

export type AssistantMode = 'auto' | 'atlas-local' | 'openai' | 'bedrock' | 'gemini' | 'codex-sovereign' | 'council';
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
  local_runtime?: {
    state: string;
    last_error_code?: string | null;
    last_verified_at?: string | null;
    host_required?: boolean;
  };
  diarization?: {
    state: 'verified' | 'configured-unverified' | 'configuration-required' | 'unavailable' | string;
    configured: boolean;
    verified: boolean;
    provider: string;
    model?: string | null;
    endpoint?: string | null;
    error?: string | null;
  };
  cost_policy?: {
    enforce_zero_cost?: boolean;
    automatic_paid_calls?: boolean;
    automatic_api_cost_usd?: number | null;
    zero_cost_ready?: boolean;
    allow_paid_single?: boolean;
    allow_council?: boolean;
    allowed_providers?: string[];
    zero_cost_providers?: string[];
    emergency_openai_fallback?: {
      enabled?: boolean;
      configured?: boolean;
      ready?: boolean;
      daily_budget_usd?: number;
      reserve_usd?: number;
      max_output_tokens?: number;
    };
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

export type AssistantDiarizationSegment = {
  speaker_id: string;
  text: string;
  confidence?: number | null;
  start_ms?: number | null;
  end_ms?: number | null;
};

export type AssistantDiarizationResponse = {
  ok: boolean;
  provider: string;
  model?: string | null;
  segments: AssistantDiarizationSegment[];
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < buffer.length; index += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

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

export async function diarizeAssistantAudio(input: {
  audio: Blob;
  languageHints?: string[];
}): Promise<AssistantDiarizationResponse> {
  if (!input.audio.size) throw new Error('voice_no_speech');
  const { organization, headers } = await assistantHeaders();
  const audioBase64 = await blobToBase64(input.audio);
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=diarize', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      organization_id: organization.id,
      audio_base64: audioBase64,
      mime_type: input.audio.type || 'audio/webm',
      language_hints: input.languageHints || []
    })
  });
  return parseCopilotResponse<AssistantDiarizationResponse>(response);
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
