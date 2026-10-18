import {
  authorizedAtlasFetch,
  getActiveAtlasOrganization
} from '../../../lib/atlasSession';

export type CrmApiProvider = 'hubspot' | 'salesforce';

export type CrmApiOperation =
  | 'oauth.prepare'
  | 'oauth.configure'
  | 'connection.configuration'
  | 'connection.status'
  | 'connection.health'
  | 'connection.verify'
  | 'connection.disconnect'
  | 'crm.list'
  | 'crm.search'
  | 'crm.get'
  | 'crm.associations'
  | 'crm.refresh'
  | 'org.inventory'
  | 'org.candidates'
  | 'org.selectCanonical';

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
  payload: Record<string, unknown> = {},
  provider: CrmApiProvider = 'hubspot'
): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const endpoint = provider === 'salesforce'
    ? '/functions/v1/atlas-crm-salesforce'
    : '/functions/v1/atlas-crm-hubspot';
  const response = await authorizedAtlasFetch(endpoint, {
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
