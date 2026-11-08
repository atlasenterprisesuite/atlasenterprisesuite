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
import {
  normalizeSalesforceInstanceUrl,
  type SalesforceFetch
} from './salesforce-oauth.ts';

export type SalesforceCrmContext = {
  accessToken: string;
  instanceUrl: string;
  identityUrl?: string | null;
  apiVersion?: string;
  fetchImpl?: SalesforceFetch;
};

export type SalesforceIdentity = {
  organizationId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
};

export type SalesforceOrganization = {
  id: string;
  name: string | null;
  organizationType: string | null;
  instanceName: string | null;
  isSandbox: boolean | null;
};

export type SalesforceOrgInventory = {
  identity: SalesforceIdentity;
  organization: SalesforceOrganization;
  instanceUrl: string;
  apiVersion: string;
  recordCounts: Record<'Account' | 'Contact' | 'Lead' | 'Opportunity' | 'Case' | 'Task' | 'Event', number | null>;
  probedAt: string;
};

type SalesforceObjectDefinition = {
  objectName: string;
  fields: readonly string[];
  display: (record: Record<string, unknown>, providerId: string) => string;
  fieldMap: Readonly<Record<string, string>>;
  searchFields: readonly string[];
  extraWhere?: string;
};

const DEFINITIONS: Record<CrmObjectType, SalesforceObjectDefinition> = {
  lead: {
    objectName: 'Lead',
    fields: ['Id', 'FirstName', 'LastName', 'Name', 'Company', 'Email', 'Phone', 'Status', 'LeadSource', 'IsConverted', 'LastModifiedDate'],
    display: (record, id) => text(record.Name) ?? text(record.Company) ?? id,
    fieldMap: {
      FirstName: 'firstName', LastName: 'lastName', Company: 'company',
      Email: 'email', Phone: 'phone', Status: 'status',
      LeadSource: 'source', IsConverted: 'converted'
    },
    searchFields: ['Name', 'Company', 'Email']
  },
  contact: {
    objectName: 'Contact',
    fields: ['Id', 'FirstName', 'LastName', 'Name', 'Email', 'Phone', 'AccountId', 'LastModifiedDate'],
    display: (record, id) => text(record.Name) ?? text(record.Email) ?? id,
    fieldMap: {
      FirstName: 'firstName', LastName: 'lastName', Email: 'email', Phone: 'phone', AccountId: 'companyId'
    },
    searchFields: ['Name', 'Email']
  },
  company: {
    objectName: 'Account',
    fields: ['Id', 'Name', 'Website', 'Industry', 'Phone', 'LastModifiedDate'],
    display: (record, id) => text(record.Name) ?? id,
    fieldMap: { Name: 'name', Website: 'website', Industry: 'industry', Phone: 'phone' },
    searchFields: ['Name', 'Website']
  },
  deal: {
    objectName: 'Opportunity',
    fields: ['Id', 'Name', 'Amount', 'StageName', 'CloseDate', 'AccountId', 'LastModifiedDate'],
    display: (record, id) => text(record.Name) ?? id,
    fieldMap: {
      Name: 'name', Amount: 'amount', StageName: 'stage',
      CloseDate: 'closeDate', AccountId: 'companyId'
    },
    searchFields: ['Name']
  },
  ticket: {
    objectName: 'Case',
    fields: ['Id', 'CaseNumber', 'Subject', 'Status', 'Priority', 'AccountId', 'ContactId', 'LastModifiedDate'],
    display: (record, id) => text(record.Subject) ?? text(record.CaseNumber) ?? id,
    fieldMap: {
      CaseNumber: 'caseNumber', Subject: 'subject', Status: 'status', Priority: 'priority',
      AccountId: 'companyId', ContactId: 'contactId'
    },
    searchFields: ['Subject', 'CaseNumber']
  },
  task: {
    objectName: 'Task',
    fields: ['Id', 'Subject', 'Status', 'Priority', 'ActivityDate', 'WhoId', 'WhatId', 'OwnerId', 'LastModifiedDate'],
    display: (record, id) => text(record.Subject) ?? id,
    fieldMap: {
      Subject: 'subject', Status: 'status', Priority: 'priority', ActivityDate: 'occurredAt',
      WhoId: 'whoId', WhatId: 'whatId', OwnerId: 'ownerId'
    },
    searchFields: ['Subject']
  },
  call: {
    objectName: 'Task',
    fields: ['Id', 'Subject', 'Status', 'Priority', 'ActivityDate', 'WhoId', 'WhatId', 'OwnerId', 'TaskSubtype', 'LastModifiedDate'],
    display: (record, id) => text(record.Subject) ?? id,
    fieldMap: {
      Subject: 'subject', Status: 'status', Priority: 'priority', ActivityDate: 'occurredAt',
      WhoId: 'whoId', WhatId: 'whatId', OwnerId: 'ownerId'
    },
    searchFields: ['Subject'],
    extraWhere: "TaskSubtype = 'Call'"
  },
  meeting: {
    objectName: 'Event',
    fields: ['Id', 'Subject', 'StartDateTime', 'EndDateTime', 'WhoId', 'WhatId', 'OwnerId', 'LastModifiedDate'],
    display: (record, id) => text(record.Subject) ?? id,
    fieldMap: {
      Subject: 'subject', StartDateTime: 'startAt', EndDateTime: 'endAt',
      WhoId: 'whoId', WhatId: 'whatId', OwnerId: 'ownerId'
    },
    searchFields: ['Subject']
  },
  note: {
    objectName: 'ContentNote',
    fields: ['Id', 'Title', 'LastModifiedDate'],
    display: (record, id) => text(record.Title) ?? id,
    fieldMap: { Title: 'title' },
    searchFields: ['Title']
  },
  email: {
    objectName: 'EmailMessage',
    fields: ['Id', 'Subject', 'FromAddress', 'ToAddress', 'MessageDate', 'ParentId', 'LastModifiedDate'],
    display: (record, id) => text(record.Subject) ?? id,
    fieldMap: {
      Subject: 'subject', FromAddress: 'from', ToAddress: 'to',
      MessageDate: 'occurredAt', ParentId: 'parentId'
    },
    searchFields: ['Subject', 'FromAddress', 'ToAddress']
  }
};

const DEFAULT_API_VERSION = 'v68.0';

export class SalesforceCrmError extends Error {
  readonly code: CrmProviderErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(input: { code: CrmProviderErrorCode; status: number; retryAfterSeconds?: number }) {
    super(`Salesforce CRM request failed (${input.code})`);
    this.name = 'SalesforceCrmError';
    this.code = input.code;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }

  toSafeError(): CrmProviderError {
    return {
      code: this.code,
      message: this.message,
      ...(this.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: this.retryAfterSeconds })
    };
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeField(value: unknown): CrmFieldValue | undefined {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return undefined;
}

function apiVersion(value?: string): string {
  const normalized = value?.trim() || DEFAULT_API_VERSION;
  if (!/^v\d{2,3}\.\d$/.test(normalized)) throw new Error('Salesforce API version is invalid');
  return normalized;
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
  context: SalesforceCrmContext,
  pathOrUrl: string,
  init: RequestInit = {}
): Promise<unknown> {
  const token = context.accessToken.trim();
  if (!token) throw new Error('Salesforce access token is required');
  const origin = normalizeSalesforceInstanceUrl(context.instanceUrl);
  let url: URL;
  try {
    url = new URL(pathOrUrl, origin);
  } catch {
    throw new Error('Salesforce request URL is invalid');
  }
  if (url.origin !== origin) throw new Error('Salesforce request origin mismatch');

  let response: Response;
  try {
    response = await (context.fetchImpl ?? fetch)(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new SalesforceCrmError({ code: 'upstream_unavailable', status: 0 });
  }
  if (!response.ok) {
    throw new SalesforceCrmError({
      code: errorCode(response.status),
      status: response.status,
      retryAfterSeconds: retryAfterSeconds(response)
    });
  }
  try {
    return await response.json();
  } catch {
    throw new SalesforceCrmError({ code: 'malformed_provider_response', status: response.status });
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizedFields(
  definition: SalesforceObjectDefinition,
  record: Record<string, unknown>
): Record<string, CrmFieldValue> {
  const result: Record<string, CrmFieldValue> = {};
  for (const [providerField, atlasField] of Object.entries(definition.fieldMap)) {
    if (!(providerField in record)) continue;
    const value = safeField(record[providerField]);
    if (value !== undefined) result[atlasField] = value;
  }
  return result;
}

function normalizeRecord(objectType: CrmObjectType, value: unknown): CrmRecord {
  const record = asObject(value);
  const definition = DEFINITIONS[objectType];
  const providerId = record ? text(record.Id) : null;
  if (!record || !providerId) {
    throw new SalesforceCrmError({ code: 'malformed_provider_response', status: 502 });
  }
  return {
    provider: 'salesforce',
    objectType,
    providerId,
    displayName: definition.display(record, providerId),
    fields: normalizedFields(definition, record),
    updatedAt: text(record.LastModifiedDate)
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return 50;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('CRM limit must be a positive integer');
  return Math.min(limit, 200);
}

function escapeSoqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function queryPath(context: SalesforceCrmContext, soql: string): string {
  const params = new URLSearchParams({ q: soql });
  return `/services/data/${apiVersion(context.apiVersion)}/query?${params.toString()}`;
}

function validCursor(cursor: string | null | undefined, version: string): string | null {
  if (cursor == null || cursor === '') return null;
  if (typeof cursor !== 'string' || cursor.length > 2048) throw new Error('CRM cursor is invalid');
  if (!cursor.startsWith(`/services/data/${version}/query/`)) throw new Error('CRM cursor is invalid');
  return cursor;
}

function whereClause(definition: SalesforceObjectDefinition, filter?: string): string {
  const clauses = [definition.extraWhere, filter].filter((value): value is string => Boolean(value));
  return clauses.length ? ` WHERE ${clauses.map((value) => `(${value})`).join(' AND ')}` : '';
}

async function queryRecords(
  context: SalesforceCrmContext,
  objectType: CrmObjectType,
  input: { limit?: number; cursor?: string | null; filter?: string }
): Promise<CrmPage> {
  const definition = DEFINITIONS[objectType];
  const version = apiVersion(context.apiVersion);
  const cursor = validCursor(input.cursor, version);
  const path = cursor ?? queryPath(
    context,
    `SELECT ${definition.fields.join(',')} FROM ${definition.objectName}${whereClause(definition, input.filter)} ORDER BY LastModifiedDate DESC LIMIT ${clampLimit(input.limit)}`
  );
  const body = asObject(await requestJson(context, path));
  if (!body || !Array.isArray(body.records)) {
    throw new SalesforceCrmError({ code: 'malformed_provider_response', status: 502 });
  }
  const next = body.done === false ? text(body.nextRecordsUrl) : null;
  return {
    records: body.records.map((record) => normalizeRecord(objectType, record)),
    nextCursor: next
  };
}

async function queryCount(context: SalesforceCrmContext, objectName: string): Promise<number | null> {
  try {
    const body = asObject(await requestJson(context, queryPath(context, `SELECT count() FROM ${objectName}`)));
    return body && typeof body.totalSize === 'number' && Number.isFinite(body.totalSize)
      ? body.totalSize
      : null;
  } catch {
    return null;
  }
}

function salesforceId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9]{15,18}$/.test(normalized)) throw new Error('Salesforce record ID is invalid');
  return normalized;
}

async function identity(context: SalesforceCrmContext): Promise<SalesforceIdentity> {
  if (!context.identityUrl) throw new Error('Salesforce identity URL is unavailable');
  const origin = normalizeSalesforceInstanceUrl(context.instanceUrl);
  const url = new URL(context.identityUrl);
  if (url.protocol !== 'https:' || !(url.hostname.endsWith('.salesforce.com') || url.hostname.endsWith('.force.com'))) {
    throw new Error('Salesforce identity URL is invalid');
  }
  let response: Response;
  try {
    response = await (context.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${context.accessToken}`, Accept: 'application/json' }
    });
  } catch {
    throw new SalesforceCrmError({ code: 'upstream_unavailable', status: 0 });
  }
  if (!response.ok) throw new SalesforceCrmError({ code: errorCode(response.status), status: response.status });
  const body = asObject(await response.json());
  const organizationId = body ? text(body.organization_id) : null;
  const userId = body ? text(body.user_id) : null;
  if (!organizationId || !userId || !origin) {
    throw new SalesforceCrmError({ code: 'malformed_provider_response', status: response.status });
  }
  return {
    organizationId,
    userId,
    username: text(body?.username),
    displayName: text(body?.display_name),
    email: text(body?.email)
  };
}

async function organization(context: SalesforceCrmContext): Promise<SalesforceOrganization> {
  const body = asObject(await requestJson(
    context,
    queryPath(context, 'SELECT Id,Name,OrganizationType,InstanceName,IsSandbox FROM Organization LIMIT 1')
  ));
  const first = body && Array.isArray(body.records) ? asObject(body.records[0]) : null;
  const id = first ? text(first.Id) : null;
  if (!first || !id) {
    throw new SalesforceCrmError({ code: 'malformed_provider_response', status: 502 });
  }
  return {
    id,
    name: text(first.Name),
    organizationType: text(first.OrganizationType),
    instanceName: text(first.InstanceName),
    isSandbox: typeof first.IsSandbox === 'boolean' ? first.IsSandbox : null
  };
}

export class SalesforceCrmAdapter {
  async readiness(context: SalesforceCrmContext): Promise<{
    ready: boolean;
    identity: SalesforceIdentity | null;
    organization: SalesforceOrganization | null;
    error: CrmProviderError | null;
  }> {
    try {
      const [identityView, organizationView] = await Promise.all([
        identity(context),
        organization(context)
      ]);
      if (identityView.organizationId !== organizationView.id) {
        return {
          ready: false,
          identity: identityView,
          organization: organizationView,
          error: { code: 'malformed_provider_response', message: 'Salesforce organization identity mismatch' }
        };
      }
      return { ready: true, identity: identityView, organization: organizationView, error: null };
    } catch (error) {
      if (error instanceof SalesforceCrmError) {
        return { ready: false, identity: null, organization: null, error: error.toSafeError() };
      }
      throw error;
    }
  }

  async inventory(context: SalesforceCrmContext): Promise<SalesforceOrgInventory> {
    const readiness = await this.readiness(context);
    if (!readiness.ready || !readiness.identity || !readiness.organization) {
      throw new SalesforceCrmError({
        code: readiness.error?.code ?? 'upstream_unavailable',
        status: 502
      });
    }
    const objectNames = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event'] as const;
    const values = await Promise.all(objectNames.map((name) => queryCount(context, name)));
    return {
      identity: readiness.identity,
      organization: readiness.organization,
      instanceUrl: normalizeSalesforceInstanceUrl(context.instanceUrl),
      apiVersion: apiVersion(context.apiVersion),
      recordCounts: Object.fromEntries(objectNames.map((name, index) => [name, values[index]])) as SalesforceOrgInventory['recordCounts'],
      probedAt: new Date().toISOString()
    };
  }

  listObjects(context: SalesforceCrmContext, request: CrmListRequest): Promise<CrmPage> {
    return queryRecords(context, request.objectType, request);
  }

  searchObjects(context: SalesforceCrmContext, request: CrmSearchRequest): Promise<CrmPage> {
    const query = request.query.trim();
    if (!query || query.length > 120) throw new Error('CRM search query is invalid');
    const definition = DEFINITIONS[request.objectType];
    const escaped = escapeSoqlLiteral(query);
    const filter = definition.searchFields.map((field) => `${field} LIKE '%${escaped}%'`).join(' OR ');
    return queryRecords(context, request.objectType, { ...request, filter });
  }

  async getObject(context: SalesforceCrmContext, request: CrmGetRequest): Promise<CrmRecord> {
    const definition = DEFINITIONS[request.objectType];
    const id = salesforceId(request.providerId);
    const body = asObject(await requestJson(
      context,
      queryPath(context, `SELECT ${definition.fields.join(',')} FROM ${definition.objectName} WHERE Id = '${id}' LIMIT 1`)
    ));
    const record = body && Array.isArray(body.records) ? body.records[0] : null;
    if (!record) throw new SalesforceCrmError({ code: 'not_found', status: 404 });
    return normalizeRecord(request.objectType, record);
  }

  async listAssociations(
    context: SalesforceCrmContext,
    request: CrmAssociationRequest
  ): Promise<CrmAssociationPage> {
    const fromId = salesforceId(request.providerId);
    const target = request.targetObjectType;
    if (!target) throw new Error('CRM association target is required');

    const directField: Partial<Record<CrmObjectType, Partial<Record<CrmObjectType, string>>>> = {
      contact: { company: 'AccountId' },
      deal: { company: 'AccountId' },
      ticket: { company: 'AccountId', contact: 'ContactId' }
    };

    const field = directField[request.objectType]?.[target];
    if (field) {
      const source = await this.getObject(context, request);
      const toId = typeof source.fields[target === 'company' ? 'companyId' : 'contactId'] === 'string'
        ? String(source.fields[target === 'company' ? 'companyId' : 'contactId'])
        : null;
      return {
        associations: toId ? [{
          provider: 'salesforce',
          fromObjectType: request.objectType,
          fromProviderId: fromId,
          toObjectType: target,
          toProviderId: toId,
          associationType: field
        }] : [],
        nextCursor: null
      };
    }

    const inverse: Partial<Record<CrmObjectType, Partial<Record<CrmObjectType, string>>>> = {
      company: { contact: 'AccountId', deal: 'AccountId', ticket: 'AccountId' }
    };
    const inverseField = inverse[request.objectType]?.[target];
    if (inverseField) {
      const page = await queryRecords(context, target, {
        limit: 100,
        cursor: request.cursor,
        filter: `${inverseField} = '${fromId}'`
      });
      const associations: CrmAssociation[] = page.records.map((record) => ({
        provider: 'salesforce',
        fromObjectType: request.objectType,
        fromProviderId: fromId,
        toObjectType: target,
        toProviderId: record.providerId,
        associationType: inverseField
      }));
      return { associations, nextCursor: page.nextCursor };
    }

    return { associations: [], nextCursor: null };
  }
}
