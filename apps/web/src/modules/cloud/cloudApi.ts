import {
  atlasAuthorizedJson,
  getActiveAtlasOrganization,
  getCachedAtlasShellOrganization
} from '../../lib/atlasSession';

const OBSERVABILITY_FUNCTION = '/functions/v1/atlas-observability';
const RELEASE_FUNCTION = '/functions/v1/atlas-release-control';

async function organizationId() {
  const cached = getCachedAtlasShellOrganization();
  if (cached?.id) return cached.id;
  const active = await getActiveAtlasOrganization();
  return active.id;
}

function withQuery(path: string, api: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ api });
  for (const [key, value] of Object.entries(params)) {
    const normalized = String(value ?? '').trim();
    if (normalized) query.set(key, normalized);
  }
  return `${path}?${query.toString()}`;
}

async function authorizedCloudJson<T>(
  path: string,
  api: string,
  init: RequestInit = {},
  params: Record<string, string> = {}
): Promise<T> {
  const orgId = await organizationId();
  return atlasAuthorizedJson<T>(withQuery(path, api, params), {
    ...init,
    cache: 'no-store',
    headers: {
      'x-atlas-org-id': orgId,
      ...(init.headers || {})
    }
  });
}

export function cloudControlRequest<T>(
  api: string,
  init: RequestInit = {},
  params: Record<string, string> = {}
) {
  return authorizedCloudJson<T>(OBSERVABILITY_FUNCTION, api, init, params);
}

export function cloudReleaseRequest<T>(
  api: string,
  init: RequestInit = {},
  params: Record<string, string> = {}
) {
  return authorizedCloudJson<T>(RELEASE_FUNCTION, api, init, params);
}
