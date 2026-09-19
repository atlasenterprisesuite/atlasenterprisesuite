import {
  authorizedAtlasFetch,
  getActiveAtlasOrganization
} from '../../../lib/atlasSession';

export type CrmApiOperation =
  | 'oauth.prepare'
  | 'oauth.configure'
  | 'connection.configuration'
  | 'connection.status'
  | 'connection.health'
  | 'connection.disconnect'
  | 'crm.create'
  | 'crm.list'
  | 'crm.search'
  | 'crm.get'
  | 'crm.associations'
  | 'crm.refresh';

export class CrmApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(input: {
    message: string;
    status: number;
    code?: string | null;
    retryAfterSeconds?: number | null;
  }) {
    super(input.message);
    this.name = 'CrmApiError';
    this.status = input.status;
    this.code = input.code ?? null;
    this.retryAfterSeconds = input.retryAfterSeconds ?? null;
  }
}

async function parseBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function crmApi<T = Record<string, unknown>>(
  operation: CrmApiOperation,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-crm-hubspot', {
    method: 'POST',
    body: JSON.stringify({
      operation,
      organizationId: organization.id,
      ...payload
    })
  });
  const body = await parseBody(response);
  if (!response.ok) {
    throw new CrmApiError({
      message: typeof body.error === 'string' ? body.error : `CRM request failed (${response.status})`,
      status: response.status,
      code: typeof body.code === 'string' ? body.code : null,
      retryAfterSeconds: typeof body.retryAfterSeconds === 'number' ? body.retryAfterSeconds : null
    });
  }
  return body as T;
}
