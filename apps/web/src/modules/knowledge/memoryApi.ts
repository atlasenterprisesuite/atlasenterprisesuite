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


export type AtlasLibraryAsset = {
  id: string;
  organization_id: string;
  source_system: string;
  source_file_id: string;
  source_library_file_id: string | null;
  name: string;
  library_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  primary_module_id: string;
  module_ids: string[];
  tags: string[];
  sensitivity: 'organization' | 'restricted';
  classification_basis: 'path' | 'name' | 'content' | 'manual' | 'fallback';
  analysis_status: 'indexed' | 'analyzed' | 'duplicate' | 'needs_review' | 'error';
  summary: string;
  content_excerpt: string;
  duplicate_of: string | null;
  indexed_at: string;
  analyzed_at: string | null;
  updated_at: string;
};

export type AtlasLibraryStats = {
  total_assets: number;
  total_bytes: number;
  restricted_assets: number;
  by_module: Record<string, number>;
  by_status: Record<string, number>;
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


export async function listAtlasLibraryAssets(filters: {
  q?: string;
  module?: string;
  analysisStatus?: string;
} = {}): Promise<{ ok: true; organization_id: string; role: string; assets: AtlasLibraryAsset[] }> {
  const params = new URLSearchParams({ api: 'library' });
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.module?.trim()) params.set('module', filters.module.trim());
  if (filters.analysisStatus?.trim()) params.set('analysis_status', filters.analysisStatus.trim());
  return request(`?${params.toString()}`, { method: 'GET' }) as Promise<{ ok: true; organization_id: string; role: string; assets: AtlasLibraryAsset[] }>;
}

export async function getAtlasLibraryStats(): Promise<{ ok: true; organization_id: string; role: string; stats: AtlasLibraryStats }> {
  return request('?api=library-stats', { method: 'GET' }) as Promise<{ ok: true; organization_id: string; role: string; stats: AtlasLibraryStats }>;
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
