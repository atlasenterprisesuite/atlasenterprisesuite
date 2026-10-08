import type { CreativeEngineReadiness } from '../../../../../../packages/creator/creative_engine';
import type { ImageEditRequest } from '../../../../../../packages/creator/image_edit';
import { getActiveAtlasOrganization, getAtlasAccessToken } from '../../../lib/atlasSession';
import { submitImageEdit as submitCreatorImageEdit } from '../../../lib/creatorApi';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const CREATOR_URL = `${SUPABASE_URL}/functions/v1/atlas-creator`;

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
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  return fetch(url, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      ...(!isFormData ? { 'content-type': 'application/json' } : {}),
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

export type ImageEditReadiness = {
  ok: true;
  service: 'atlas-creator';
  version: string;
  organization_id: string;
  engine: CreativeEngineReadiness;
  checked_at: string;
};

export type ImageEditResult = {
  ok: true;
  asset: {
    id: string;
    storage_path?: string;
    storagePath?: string;
    [key: string]: unknown;
  };
  signed_url: string;
  production_id: string;
  generation_job_id: string;
  engine: CreativeEngineReadiness;
};

export async function getImageEditReadiness(): Promise<CreativeEngineReadiness> {
  const data = await authenticatedRequest<ImageEditReadiness>(`${CREATOR_URL}?api=image-edit-readiness`);
  return data.engine;
}

export async function submitImageEdit(source: File, request: ImageEditRequest): Promise<ImageEditResult> {
  // Keep the existing Creator client as the unauthenticated/test compatibility path.
  // Production still fails closed at the JWT-protected atlas-creator runtime.
  if (!getAtlasAccessToken()) {
    return submitCreatorImageEdit(source, request) as Promise<ImageEditResult>;
  }
  const form = new FormData();
  form.append('source', source, source.name || 'source-image');
  form.append('request', JSON.stringify(request));
  return authenticatedRequest<ImageEditResult>(`${CREATOR_URL}?api=image-edit`, {
    method: 'POST',
    body: form
  });
}
