import { getActiveAtlasOrganization, getAtlasAccessToken } from './atlasSession';
import type { ContentWorkspaceState } from '../../../../packages/creator/content_intelligence';
import type {
  CreatorAsset,
  CreatorReadinessResponse,
  ProductionSpec,
  ProductionSummary,
  ProviderId,
  ProviderReadiness
} from '../../../../packages/creator/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type ContentWorkspaceRecord = ContentWorkspaceState & {
  organizationId: string;
  createdByUserId: string;
};

function query(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) {
    const error = Object.assign(new Error(String(data?.error || `request_failed_${response.status}`)), {
      status: response.status,
      data
    });
    throw error;
  }
  return data;
}

async function requestWithToken(url: string, init: RequestInit, token: string) {
  return fetch(url, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
}

async function authenticatedRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');
  let response = await requestWithToken(url, init, token);
  if (response.status === 401) {
    await getActiveAtlasOrganization();
    token = getAtlasAccessToken();
    if (!token) throw new Error('session_expired');
    response = await requestWithToken(url, init, token);
  }
  return parseResponse(response) as Promise<T>;
}

export async function creatorRequest<T>(
  api: string,
  params: Record<string, string | undefined> = {},
  init: RequestInit = {}
): Promise<T> {
  const suffix = query({ api, ...params });
  return authenticatedRequest<T>(`${SUPABASE_URL}/functions/v1/atlas-creator?${suffix}`, init);
}

export async function nativeCreatorRequest<T>(api: string, init: RequestInit = {}): Promise<T> {
  const suffix = query({ api });
  return authenticatedRequest<T>(`${SUPABASE_URL}/functions/v1/atlas-creator-native?${suffix}`, init);
}

function specFromWire(value: any): ProductionSpec {
  if (value?.production_spec_json && typeof value.production_spec_json === 'object') {
    const spec = value.production_spec_json as ProductionSpec;
    return {
      ...spec,
      id: String(value.id ?? spec.id),
      organizationId: String(value.organization_id ?? spec.organizationId),
      createdByUserId: String(value.created_by ?? spec.createdByUserId),
      version: Number(value.version ?? spec.version),
      createdAt: String(value.created_at ?? spec.createdAt),
      updatedAt: String(value.updated_at ?? spec.updatedAt)
    };
  }
  return value as ProductionSpec;
}

function summaryFromWire(value: any): ProductionSummary {
  return {
    id: String(value.id),
    title: String(value.title || ''),
    brief: String(value.brief || ''),
    status: value.status,
    durationSeconds: Number(value.duration_seconds ?? value.durationSeconds ?? 0),
    aspectRatio: value.aspect_ratio ?? value.aspectRatio ?? 'adaptive',
    resolutionPreference: value.resolution_preference ?? value.resolutionPreference ?? 'adaptive',
    audioEnabled: Boolean(value.audio_enabled ?? value.audioEnabled),
    version: Number(value.version || 1),
    createdAt: String(value.created_at ?? value.createdAt ?? ''),
    updatedAt: String(value.updated_at ?? value.updatedAt ?? '')
  } as ProductionSummary;
}

function assetFromWire(value: any): CreatorAsset {
  return {
    id: String(value.id),
    organizationId: String(value.organization_id ?? value.organizationId),
    productionId: String(value.production_id ?? value.productionId),
    generationJobId: value.generation_job_id ?? value.generationJobId ?? null,
    storagePath: String(value.storage_path ?? value.storagePath ?? ''),
    mediaType: value.media_type ?? value.mediaType,
    providerId: value.provider_id ?? value.providerId ?? null,
    providerAssetId: value.provider_asset_id ?? value.providerAssetId ?? null,
    mimeType: value.mime_type ?? value.mimeType ?? null,
    width: value.width ?? null,
    height: value.height ?? null,
    durationSeconds: value.duration_seconds ?? value.durationSeconds ?? null,
    provenance: value.provenance_json ?? value.provenance ?? {},
    createdAt: String(value.created_at ?? value.createdAt ?? ''),
    updatedAt: String(value.updated_at ?? value.updatedAt ?? '')
  } as CreatorAsset;
}

function contentWorkspaceFromWire(value: any): ContentWorkspaceRecord {
  const state = (value?.state_json ?? value?.stateJson ?? {}) as Partial<ContentWorkspaceState>;
  return {
    ...(state as ContentWorkspaceState),
    id: String(value?.id ?? state.id ?? ''),
    title: String(value?.title ?? state.title ?? 'Untitled content workspace'),
    profile: state.profile ?? { niche: '', objective: '', tone: '', platforms: [], audience: '', language: 'English' },
    audienceSeed: String(state.audienceSeed ?? ''),
    audience: state.audience ?? null,
    ideas: state.ideas ?? [],
    hooks: state.hooks ?? [],
    selectedIdeaId: state.selectedIdeaId ?? null,
    selectedHookId: state.selectedHookId ?? null,
    draft: state.draft ?? null,
    variants: state.variants ?? [],
    review: state.review ?? null,
    version: Number(value?.version ?? state.version ?? 0),
    createdAt: String(value?.created_at ?? state.createdAt ?? ''),
    updatedAt: String(value?.updated_at ?? state.updatedAt ?? ''),
    organizationId: String(value?.organization_id ?? value?.organizationId ?? ''),
    createdByUserId: String(value?.created_by ?? value?.createdByUserId ?? '')
  };
}

export const getCreatorReadiness = () => creatorRequest<CreatorReadinessResponse>('readiness');

export async function listCreatorProviders() {
  const data = await creatorRequest<{ ok: true; providers: ProviderReadiness[] }>('providers');
  return data.providers;
}

export async function listCreatorProductions() {
  const data = await creatorRequest<{ ok: true; productions: unknown[] }>('productions');
  return data.productions.map(summaryFromWire);
}

export async function getCreatorProduction(id: string) {
  const data = await creatorRequest<{ ok: true; production: unknown }>('production', { id });
  return specFromWire(data.production);
}

export async function saveCreatorProduction(spec: ProductionSpec, expectedVersion: number) {
  const data = await creatorRequest<{ ok: true; production: unknown }>('save', {}, {
    method: 'POST', body: JSON.stringify({ spec, expected_version: expectedVersion })
  });
  return specFromWire(data.production);
}

export async function listContentWorkspaces() {
  const data = await creatorRequest<{ ok: true; workspaces: unknown[] }>('content-workspaces');
  return data.workspaces.map(contentWorkspaceFromWire);
}

export async function getContentWorkspace(id: string) {
  const data = await creatorRequest<{ ok: true; workspace: unknown }>('content-workspace', { id });
  return contentWorkspaceFromWire(data.workspace);
}

export async function saveContentWorkspace(workspace: ContentWorkspaceState, expectedVersion: number) {
  const data = await creatorRequest<{ ok: true; workspace: unknown }>('content-save', {}, {
    method: 'POST',
    body: JSON.stringify({ workspace, expected_version: expectedVersion })
  });
  return contentWorkspaceFromWire(data.workspace);
}

export async function listCreatorAssets(productionId?: string) {
  const data = await creatorRequest<{ ok: true; assets: unknown[] }>('assets', {
    production_id: productionId
  });
  return data.assets.map(assetFromWire);
}

export async function submitCreatorProduction(productionId: string, providerId: ProviderId) {
  return creatorRequest<{ ok: true; job: unknown }>('submit', {}, {
    method: 'POST', body: JSON.stringify({ production_id: productionId, provider_id: providerId })
  });
}

export async function getNativeCreatorReadiness() {
  return nativeCreatorRequest<{
    ok: true;
    renderer: 'atlas-native';
    billing_class: 'zero-cost';
    execution: 'self-hosted';
    native: { state: string; capabilities?: string[] };
  }>('readiness');
}

export async function submitNativeCreatorProduction(productionId: string, expectedVersion: number) {
  return nativeCreatorRequest<{ ok: true; job: unknown; asset: unknown; billing_class: 'zero-cost'; renderer: 'atlas-native' }>('generate', {
    method: 'POST',
    body: JSON.stringify({ production_id: productionId, expected_version: expectedVersion })
  });
}
