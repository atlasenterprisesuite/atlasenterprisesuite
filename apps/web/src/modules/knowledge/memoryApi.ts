import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type AtlasMemoryKind = 'decision' | 'requirement' | 'workflow' | 'configuration' | 'evidence' | 'note';
export type AtlasMemoryStatus = 'draft' | 'approved' | 'superseded';
export type AtlasMemorySource = 'atlas' | 'chat_import' | 'document' | 'user_entry' | 'system_event';

export type AtlasMemoryRecord = {
  id: string;
  organization_id: string;
  created_by: string;
  approved_by: string | null;
  kind: AtlasMemoryKind;
  status: AtlasMemoryStatus;
  title: string;
  summary: string;
  content_json: Record<string, unknown>;
  source_type: AtlasMemorySource;
  source_ref: string | null;
  module_ids: string[];
  tags: string[];
  sensitivity: 'organization' | 'restricted';
  version: number;
  supersedes_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type MemoryListResponse = {
  ok: boolean;
  organization_id: string;
  role: string;
  records: AtlasMemoryRecord[];
};

async function parse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

async function request(path: string, init: RequestInit = {}) {
  const organization = await getActiveAtlasOrganization();
  return parse(await authorizedAtlasFetch(`/functions/v1/atlas-memory${path}`, {
    ...init,
    headers: {
      'x-atlas-org-id': organization.id,
      ...(init.headers || {})
    }
  }));
}

export async function listAtlasMemory(filters: {
  q?: string;
  kind?: string;
  status?: string;
  module?: string;
} = {}): Promise<MemoryListResponse> {
  const params = new URLSearchParams({ api: 'list' });
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.status) params.set('status', filters.status);
  if (filters.module?.trim()) params.set('module', filters.module.trim());
  return request(`?${params.toString()}`, { method: 'GET' }) as Promise<MemoryListResponse>;
}

export async function createAtlasMemoryDraft(input: {
  kind: AtlasMemoryKind;
  title: string;
  summary: string;
  content: string;
  sourceType: AtlasMemorySource;
  sourceRef?: string;
  moduleIds?: string[];
  tags?: string[];
  sensitivity?: 'organization' | 'restricted';
}) {
  return request('?api=save', {
    method: 'POST',
    body: JSON.stringify({
      kind: input.kind,
      title: input.title,
      summary: input.summary,
      content_json: { text: input.content },
      source_type: input.sourceType,
      source_ref: input.sourceRef || null,
      module_ids: input.moduleIds || [],
      tags: input.tags || [],
      sensitivity: input.sensitivity || 'organization'
    })
  }) as Promise<{ ok: true; record: AtlasMemoryRecord }>;
}

export async function approveAtlasMemory(id: string) {
  return request('?api=approve', {
    method: 'POST',
    body: JSON.stringify({ id })
  }) as Promise<{ ok: true; record: AtlasMemoryRecord }>;
}
