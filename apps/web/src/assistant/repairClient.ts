import { collectAssistantPageContext } from './pageContext';
import { resolveAssistantModule } from './routeContext';
import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';

export type AssistantRepairJob = {
  id?: string;
  status?: string;
  request_text?: string;
  attempts?: number;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
};

export type AssistantRepairResponse = {
  ok: boolean;
  job?: AssistantRepairJob | null;
  jobs?: AssistantRepairJob[];
  execution?: string;
  github_required?: boolean;
};

async function parseRepairResponse(response: Response): Promise<AssistantRepairResponse> {
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'invalid_response' };
  }
  if (!response.ok || data?.ok === false) {
    throw new Error(String(data?.error || data?.message || `repair_request_failed_${response.status}`));
  }
  return data as AssistantRepairResponse;
}

export async function enqueueAssistantRepair(input: {
  message: string;
  pathname: string;
  conversationId?: string | null;
}): Promise<AssistantRepairResponse> {
  const message = input.message.trim();
  if (!message) throw new Error('repair_request_required');

  const organization = await getActiveAtlasOrganization();
  const page = collectAssistantPageContext(input.pathname);
  const response = await authorizedAtlasFetch('/functions/v1/atlas-repair-bridge?api=enqueue', {
    method: 'POST',
    headers: { 'x-atlas-org-id': organization.id },
    body: JSON.stringify({
      request: message,
      context: {
        source: 'atlas-assistant',
        organization_id: organization.id,
        module: resolveAssistantModule(input.pathname),
        pathname: input.pathname,
        conversation_id: input.conversationId || null,
        page
      }
    })
  });

  return parseRepairResponse(response);
}

export async function getAssistantRepairs(): Promise<AssistantRepairResponse> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-repair-bridge?api=status', {
    method: 'GET',
    headers: { 'x-atlas-org-id': organization.id }
  });

  return parseRepairResponse(response);
}
