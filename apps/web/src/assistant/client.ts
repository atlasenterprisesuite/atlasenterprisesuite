import { getActiveAtlasOrganization, getAtlasAccessToken } from '../lib/atlasSession';
import { resolveAssistantModule } from './routeContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type AssistantProviderState =
  | 'verified_for_request'
  | 'configured_unverified'
  | 'not_configured'
  | 'unavailable';

export type AssistantStatusResponse = {
  ok: boolean;
  authenticated: boolean;
  provider: string;
  provider_state: AssistantProviderState;
  model: string;
  storage_state: string;
  organization: string;
  role: string | null;
  capabilities: string[];
};

export type AssistantChatResponse = {
  ok: boolean;
  text: string;
  conversation_id?: string | null;
  trace_id?: string | null;
  provider_state?: AssistantProviderState;
  model?: string;
};

function copilotHeaders(token: string, organizationId: string) {
  return {
    apikey: PUBLISHABLE_KEY,
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-atlas-org-id': organizationId
  };
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

async function assistantSessionContext() {
  const organization = await getActiveAtlasOrganization();
  const token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');
  return { organization, token };
}

export async function getAssistantStatus(): Promise<AssistantStatusResponse> {
  const { organization, token } = await assistantSessionContext();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/atlas-copilot?api=status`, {
    method: 'GET',
    headers: copilotHeaders(token, organization.id)
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

  const { organization, token } = await assistantSessionContext();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/atlas-copilot?api=chat`, {
    method: 'POST',
    headers: copilotHeaders(token, organization.id),
    body: JSON.stringify({
      organization_id: organization.id,
      module: resolveAssistantModule(input.pathname),
      intent: 'balanced',
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
