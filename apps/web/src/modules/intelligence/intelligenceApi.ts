import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type IntelligenceMode = 'auto' | 'openai' | 'gemini' | 'codex-sovereign' | 'council';
export type IntelligenceProfile = 'fast' | 'balanced' | 'deep';

export type ProviderReadiness = {
  id: string;
  state: 'verified' | 'configuration-required' | 'rate-limited' | 'unavailable' | string;
  configured: boolean;
  verified: boolean;
  model: string | null;
  capabilities: string[];
  profiles: string[];
  error: string | null;
};

export type IntelligenceConversation = {
  id: string;
  title: string | null;
  module: string;
  updated_at: string;
};

export type IntelligenceMessage = {
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

export type IntelligenceStatus = {
  ok: boolean;
  authenticated: boolean;
  storage_state: string;
  organization: string;
  role: string | null;
  providers: ProviderReadiness[];
  modes: IntelligenceMode[];
  profiles: IntelligenceProfile[];
  cost_policy?: {
    allow_paid_single?: boolean;
    allow_council?: boolean;
    allowed_providers?: string[];
    zero_cost_providers?: string[];
  };
};

export type IntelligenceChatResponse = {
  ok: boolean;
  conversation_id: string;
  output: string;
  text?: string;
  provider: string;
  providers: string[];
  model: string | null;
  mode: IntelligenceMode;
  profile: IntelligenceProfile;
  fallback_used: boolean;
  contributions?: Array<{ provider: string; model: string | null; text: string }>;
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || 'invalid_response' };
  }
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload as T;
}

async function organizationHeaders() {
  const organization = await getActiveAtlasOrganization();
  return { 'x-atlas-org-id': organization.id };
}

export async function loadIntelligenceStatus(): Promise<IntelligenceStatus> {
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=status', {
    method: 'GET',
    headers: await organizationHeaders()
  });
  return parseJson<IntelligenceStatus>(response);
}

export async function listIntelligenceConversations(): Promise<IntelligenceConversation[]> {
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=history', {
    method: 'GET',
    headers: await organizationHeaders()
  });
  const payload = await parseJson<{ ok: boolean; conversations?: IntelligenceConversation[] }>(response);
  return Array.isArray(payload.conversations) ? payload.conversations : [];
}

export async function getIntelligenceConversation(id: string): Promise<{ conversation: IntelligenceConversation; messages: IntelligenceMessage[] }> {
  const response = await authorizedAtlasFetch(`/functions/v1/atlas-copilot?api=conversation&id=${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: await organizationHeaders()
  });
  return parseJson(response);
}

export async function sendIntelligenceMessage(input: {
  message: string;
  conversationId: string | null;
  mode: IntelligenceMode;
  profile: IntelligenceProfile;
}): Promise<IntelligenceChatResponse> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=chat', {
    method: 'POST',
    headers: { 'x-atlas-org-id': organization.id },
    body: JSON.stringify({
      message: input.message,
      conversation_id: input.conversationId,
      organization_id: organization.id,
      module: 'workbench',
      intent: input.profile,
      mode: input.mode,
      capabilities_requested: ['generation', 'reasoning']
    })
  });
  return parseJson<IntelligenceChatResponse>(response);
}
