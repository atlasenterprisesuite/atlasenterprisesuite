import type {
  CrmAssociation,
  CrmAssociationPage,
  CrmAssociationRequest,
  CrmFieldValue,
  CrmGetRequest,
  CrmListRequest,
  CrmObjectType,
  CrmPage,
  CrmProviderError,
  CrmProviderErrorCode,
  CrmRecord,
  CrmSearchRequest
} from '../../../packages/core/src/crm.ts';
import type { HubSpotFetch } from './hubspot-oauth.ts';

const API_ROOT = 'https://api.hubapi.com';
const CRM_ROOT = `${API_ROOT}/crm/objects/2026-03`;
const ACCOUNT_DETAILS_URL = `${API_ROOT}/account-info/2026-03/details`;

const OBJECT_PATH: Record<CrmObjectType, string> = {
  contact: 'contacts',
  company: 'companies',
  deal: 'deals',
  ticket: 'tickets',
  task: 'tasks',
  call: 'calls',
  meeting: 'meetings',
  note: 'notes',
  email: 'emails'
};

const REQUESTED_PROPERTIES: Record<CrmObjectType, readonly string[]> = {
  contact: ['firstname', 'lastname', 'email', 'phone', 'lifecyclestage'],
  company: ['name', 'domain', 'industry', 'phone'],
  deal: ['dealname', 'amount', 'hs_currency', 'pipeline', 'dealstage', 'closedate'],
  ticket: ['subject', 'hs_pipeline', 'hs_pipeline_stage', 'hs_ticket_priority'],
  task: ['hs_task_subject', 'hs_task_body', 'hs_timestamp', 'hubspot_owner_id'],
  call: ['hs_call_title', 'hs_body_preview', 'hs_timestamp', 'hubspot_owner_id'],
  meeting: ['hs_meeting_title', 'hs_meeting_body', 'hs_timestamp', 'hubspot_owner_id'],
  note: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'],
  email: ['hs_email_subject', 'hs_email_text', 'hs_timestamp', 'hubspot_owner_id']
};

const FIELD_MAP: Record<CrmObjectType, Readonly<Record<string, string>>> = {
  contact: {
    firstname: 'firstName',
    lastname: 'lastName',
    email: 'email',
    phone: 'phone',
    lifecyclestage: 'lifecycleStage'
  },
  company: {
    name: 'name',
    domain: 'domain',
    industry: 'industry',
    phone: 'phone'
  },
  deal: {
    dealname: 'name',
    amount: 'amount',
    hs_currency: 'currency',
    pipeline: 'pipeline',
    dealstage: 'stage',
    closedate: 'closeDate'
  },
  ticket: {
    subject: 'subject',
    hs_pipeline: 'pipeline',
    hs_pipeline_stage: 'stage',
    hs_ticket_priority: 'priority'
  },
  task: {
    hs_task_subject: 'subject',
    hs_task_body: 'preview',
    hs_timestamp: 'occurredAt',
    hubspot_owner_id: 'ownerId'
  },
  call: {
    hs_call_title: 'subject',
    hs_body_preview: 'preview',
    hs_timestamp: 'occurredAt',
    hubspot_owner_id: 'ownerId'
  },
  meeting: {
    hs_meeting_title: 'subject',
    hs_meeting_body: 'preview',
    hs_timestamp: 'occurredAt',
    hubspot_owner_id: 'ownerId'
  },
  note: {
    hs_note_body: 'preview',
    hs_timestamp: 'occurredAt',
    hubspot_owner_id: 'ownerId'
  },
  email: {
    hs_email_subject: 'subject',
    hs_email_text: 'preview',
    hs_timestamp: 'occurredAt',
    hubspot_owner_id: 'ownerId'
  }
};

export type CrmProviderContext = {
  accessToken: string;
  fetchImpl?: HubSpotFetch;
};

export type CrmProviderAccount = {
  id: string;
  label: string | null;
  accountType: string | null;
  timeZone: string | null;
  companyCurrency: string | null;
  dataHostingLocation: string | null;
};

export type CrmProviderReadiness = {
  ready: boolean;
  account: CrmProviderAccount | null;
  error: CrmProviderError | null;
};

export class HubSpotCrmError extends Error {
  readonly code: CrmProviderErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(input: {
    code: CrmProviderErrorCode;
    status: number;
    retryAfterSeconds?: number;
  }) {
    super(`HubSpot CRM request failed (${input.code})`);
    this.name = 'HubSpotCrmError';
    this.code = input.code;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }

  toSafeError(): CrmProviderError {
    return {
      code: this.code,
      message: this.message,
      ...(this.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: this.retryAfterSeconds })
    };
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function clampLimit(limit: number | undefined, maximum: number): number {
  if (limit === undefined) return Math.min(50, maximum);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('CRM limit must be a positive integer');
  return Math.min(limit, maximum);
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function errorCode(status: number): CrmProviderErrorCode {
  if (status === 401) return 'expired_credential';
  if (status === 403) return 'forbidden_scope';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 422) return 'validation_error';
  if (status === 429) return 'rate_limited';
  if (status >= 500 || status === 0) return 'upstream_unavailable';
  return 'unknown_upstream_error';
}

async function requestJson(
  context: CrmProviderContext,
  url: string,
  init: RequestInit = {}
): Promise<unknown> {
  const token = required(context.accessToken, 'HubSpot access token');
  const fetchImpl = context.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new HubSpotCrmError({ code: 'upstream_unavailable', status: 0 });
  }

  if (!response.ok) {
    throw new HubSpotCrmError({
      code: errorCode(response.status),
      status: response.status,
      retryAfterSeconds: retryAfterSeconds(response)
    });
  }

  try {
    return await response.json();
  } catch {
    throw new HubSpotCrmError({ code: 'malformed_provider_response', status: response.status });
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeField(value: unknown): CrmFieldValue | undefined {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function normalizedFields(
  objectType: CrmObjectType,
  properties: Record<string, unknown>
): Record<string, CrmFieldValue> {
  const result: Record<string, CrmFieldValue> = {};
  for (const [providerProperty, atlasProperty] of Object.entries(FIELD_MAP[objectType])) {
    if (!(providerProperty in properties)) continue;
    const value = safeField(properties[providerProperty]);
    if (value !== undefined) result[atlasProperty] = value;
  }
  return result;
}

function valueAsText(properties: Record<string, unknown>, key: string): string | null {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function displayName(
  objectType: CrmObjectType,
  providerId: string,
  properties: Record<string, unknown>
): string {
  if (objectType === 'contact') {
    const name = [valueAsText(properties, 'firstname'), valueAsText(properties, 'lastname')]
      .filter(Boolean)
      .join(' ');
    return name || valueAsText(properties, 'email') || providerId;
  }
  if (objectType === 'company') {
    return valueAsText(properties, 'name') || valueAsText(properties, 'domain') || providerId;
  }
  if (objectType === 'deal') return valueAsText(properties, 'dealname') || providerId;
  if (objectType === 'ticket') return valueAsText(properties, 'subject') || providerId;
  if (objectType === 'task') return valueAsText(properties, 'hs_task_subject') || providerId;
  if (objectType === 'call') return valueAsText(properties, 'hs_call_title') || providerId;
  if (objectType === 'meeting') return valueAsText(properties, 'hs_meeting_title') || providerId;
  if (objectType === 'email') return valueAsText(properties, 'hs_email_subject') || providerId;
  return providerId;
}

export function normalizeHubSpotRecord(
  objectType: CrmObjectType,
  value: unknown
): CrmRecord {
  const record = asObject(value);
  if (!record || typeof record.id !== 'string' || !record.id.trim()) {
    throw new HubSpotCrmError({ code: 'malformed_provider_response', status: 200 });
  }
  const properties = asObject(record.properties);
  if (!properties) {
    throw new HubSpotCrmError({ code: 'malformed_provider_response', status: 200 });
  }
  if (record.updatedAt !== undefined && record.updatedAt !== null && typeof record.updatedAt !== 'string') {
    throw new HubSpotCrmError({ code: 'malformed_provider_response', status: 200 });
  }

  return {
    provider: 'hubspot',
    objectType,
    providerId: record.id,
    displayName: displayName(objectType, record.id, properties),
    fields: normalizedFields(objectType, properties),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null
  };
}

function nextCursor(body: Record<string, unknown>): string | null {
  const paging = asObject(body.paging);
  const next = paging ? asObject(paging.next) : null;
  return next && typeof next.after === 'string' && next.after ? next.after : null;
}

function normalizePage(objectType: CrmObjectType, value: unknown): CrmPage {
  const body = asObject(value);
  if (!body || !Array.isArray(body.results)) {
    throw new HubSpotCrmError({ code: 'malformed_provider_response', status: 200 });
  }
  return {
    records: body.results.map((record) => normalizeHubSpotRecord(objectType, record)),
    nextCursor: nextCursor(body)
  };
}

function objectUrl(objectType: CrmObjectType): string {
  return `${CRM_ROOT}/${OBJECT_PATH[objectType]}`;
}

function appendReadParams(
  url: URL,
  objectType: CrmObjectType,
  limit?: number,
  cursor?: string | null
): void {
  url.searchParams.set('properties', REQUESTED_PROPERTIES[objectType].join(','));
  url.searchParams.set('limit', String(clampLimit(limit, 100)));
  if (cursor?.trim()) url.searchParams.set('after', cursor.trim());
}

export class HubSpotCrmAdapter {
  readonly provider = 'hubspot' as const;

  async readiness(context: CrmProviderContext): Promise<CrmProviderReadiness> {
    try {
      const account = await this.getAccountIdentity(context);
      await this.listObjects(context, { objectType: 'contact', limit: 1 });
      return { ready: true, account, error: null };
    } catch (error) {
      if (error instanceof HubSpotCrmError) {
        return { ready: false, account: null, error: error.toSafeError() };
      }
      throw error;
    }
  }

  async getAccountIdentity(context: CrmProviderContext): Promise<CrmProviderAccount> {
    const body = asObject(await requestJson(context, ACCOUNT_DETAILS_URL));
    if (!body || (typeof body.portalId !== 'number' && typeof body.portalId !== 'string')) {
      throw new HubSpotCrmError({ code: 'malformed_provider_response', status: 200 });
    }
    const id = String(body.portalId);
    return {
      id,
      label: typeof body.uiDomain === 'string' && body.uiDomain.trim() ? body.uiDomain : null,
      accountType: typeof body.accountType === 'string' ? body.accountType : null,
      timeZone: typeof body.timeZone === 'string' ? body.timeZone : null,
      companyCurrency: typeof body.companyCurrency === 'string' ? body.companyCurrency : null,
      dataHostingLocation:
        typeof body.dataHostingLocation === 'string' ? body.dataHostingLocation : null
    };
  }

  async listObjects(context: CrmProviderContext, request: CrmListRequest): Promise<CrmPage> {
    const url = new URL(objectUrl(request.objectType));
    appendReadParams(url, request.objectType, request.limit, request.cursor);
    return normalizePage(request.objectType, await requestJson(context, url.toString()));
  }

  async searchObjects(
    context: CrmProviderContext,
    request: CrmSearchRequest
  ): Promise<CrmPage> {
    const query = required(request.query, 'CRM search query');
    const body: Record<string, unknown> = {
      query,
      limit: clampLimit(request.limit, 200),
      properties: [...REQUESTED_PROPERTIES[request.objectType]],
      filterGroups: [],
      sorts: []
    };
    if (request.cursor?.trim()) body.after = request.cursor.trim();

    return normalizePage(
      request.objectType,
      await requestJson(context, `${objectUrl(request.objectType)}/search`, {
        method: 'POST',
        body: JSON.stringify(body)
      })
    );
  }

  async getObject(context: CrmProviderContext, request: CrmGetRequest): Promise<CrmRecord> {
    const providerId = required(request.providerId, 'CRM provider record ID');
    const url = new URL(`${objectUrl(request.objectType)}/${encodeURIComponent(providerId)}`);
    url.searchParams.set('properties', REQUESTED_PROPERTIES[request.objectType].join(','));
    return normalizeHubSpotRecord(
      request.objectType,
      await requestJson(context, url.toString())
    );
  }

  async listAssociations(
    context: CrmProviderContext,
    request: CrmAssociationRequest
  ): Promise<CrmAssociationPage> {
    if (!request.targetObjectType) {
      throw new Error('Association target object type is required');
    }
    const providerId = required(request.providerId, 'CRM provider record ID');
    const url = new URL(
      `${objectUrl(request.objectType)}/${encodeURIComponent(providerId)}/associations/${OBJECT_PATH[request.targetObjectType]}`
    );
    if (request.cursor?.trim()) url.searchParams.set('after', request.cursor.trim());

    const body = asObject(await requestJson(context, url.toString()));
    if (!body || !Array.isArray(body.results)) {
      throw new HubSpotCrmError({ code: 'malformed_provider_response', status: 200 });
    }

    const associations: CrmAssociation[] = [];
    for (const raw of body.results) {
      const target = asObject(raw);
      if (!target || (typeof target.toObjectId !== 'string' && typeof target.toObjectId !== 'number')) {
        throw new HubSpotCrmError({ code: 'malformed_provider_response', status: 200 });
      }
      const targetId = String(target.toObjectId);
      const types = Array.isArray(target.associationTypes) ? target.associationTypes : [];
      if (types.length === 0) {
        associations.push({
          provider: 'hubspot',
          fromObjectType: request.objectType,
          fromProviderId: providerId,
          toObjectType: request.targetObjectType,
          toProviderId: targetId,
          associationType: null
        });
        continue;
      }
      for (const rawType of types) {
        const associationType = asObject(rawType);
        if (!associationType) continue;
        const label =
          typeof associationType.label === 'string' && associationType.label.trim()
            ? associationType.label.trim()
            : null;
        const category =
          typeof associationType.category === 'string' ? associationType.category : null;
        const typeId =
          typeof associationType.typeId === 'number' || typeof associationType.typeId === 'string'
            ? String(associationType.typeId)
            : null;
        associations.push({
          provider: 'hubspot',
          fromObjectType: request.objectType,
          fromProviderId: providerId,
          toObjectType: request.targetObjectType,
          toProviderId: targetId,
          associationType: label ?? (category && typeId ? `${category}:${typeId}` : null)
        });
      }
    }

    return { associations, nextCursor: nextCursor(body) };
  }
}
