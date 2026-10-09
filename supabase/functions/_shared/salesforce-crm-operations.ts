import type {
  CrmAssociationPage,
  CrmObjectType,
  CrmPage,
  CrmRecord
} from '../../../packages/core/src/crm.ts';
import { destroyCredentialPayload } from './integration-credential-vault.ts';
import {
  SalesforceLifecycleError,
  loadSalesforceCredential,
  type SalesforceLifecycleDependencies
} from './salesforce-connection-lifecycle.ts';
import {
  SalesforceCrmAdapter,
  SalesforceCrmError,
  type SalesforceCrmContext
} from './salesforce-crm.ts';
import type {
  SalesforceConnectionStore,
  SalesforceExternalObjectLinkInput
} from './salesforce-connection-store.ts';

export type SalesforceCrmOperation =
  | 'crm.list'
  | 'crm.search'
  | 'crm.get'
  | 'crm.associations';

export type SalesforceCrmOperationAdapter = Pick<
  SalesforceCrmAdapter,
  'listObjects' | 'searchObjects' | 'getObject' | 'listAssociations'
>;

export type SalesforceCrmOperationDependencies = {
  store: SalesforceConnectionStore;
  lifecycle: SalesforceLifecycleDependencies;
  adapter?: SalesforceCrmOperationAdapter;
  now?: () => number;
};

export type SalesforceCrmOperationResult = {
  status: number;
  body: Record<string, unknown>;
};

function nowIso(deps: SalesforceCrmOperationDependencies): string {
  return new Date(deps.now?.() ?? Date.now()).toISOString();
}

function isObjectType(value: unknown): value is CrmObjectType {
  return typeof value === 'string' && [
    'contact', 'lead', 'company', 'deal', 'ticket', 'task', 'call', 'meeting', 'note', 'email'
  ].includes(value);
}

function optionalLimit(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 200) {
    throw new Error('CRM limit must be an integer from 1 through 200');
  }
  return Number(value);
}

function optionalCursor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) throw new Error('CRM cursor is invalid');
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function contextFromCredential(
  credential: { accessToken: string; secretValues?: Record<string, string> },
  deps: SalesforceLifecycleDependencies
): SalesforceCrmContext {
  const instanceUrl = credential.secretValues?.instanceUrl?.trim();
  const identityUrl = credential.secretValues?.identityUrl?.trim();
  if (!instanceUrl || !identityUrl) throw new SalesforceLifecycleError('credential_missing', 409);
  return {
    accessToken: credential.accessToken,
    instanceUrl,
    identityUrl,
    apiVersion: deps.apiVersion,
    fetchImpl: deps.fetchImpl
  };
}

async function persistRecordLinks(input: {
  records: readonly CrmRecord[];
  organizationId: string;
  providerAccountId: string;
  deps: SalesforceCrmOperationDependencies;
}): Promise<void> {
  if (!input.records.length) return;
  const seenAt = nowIso(input.deps);
  const links: SalesforceExternalObjectLinkInput[] = input.records.map((record) => ({
    org_id: input.organizationId,
    provider: 'salesforce',
    provider_account_id: input.providerAccountId,
    provider_object_type: record.objectType,
    provider_object_id: record.providerId,
    atlas_object_type: null,
    atlas_object_id: null,
    last_seen_at: seenAt,
    source_updated_at: record.updatedAt,
    source_fingerprint: null
  }));
  await input.deps.store.upsertObjectLinks(links);
}

async function persistAssociationLinks(input: {
  page: CrmAssociationPage;
  organizationId: string;
  providerAccountId: string;
  deps: SalesforceCrmOperationDependencies;
}): Promise<void> {
  if (!input.page.associations.length) return;
  const seenAt = nowIso(input.deps);
  const dedupe = new Set<string>();
  const links: SalesforceExternalObjectLinkInput[] = [];
  for (const association of input.page.associations) {
    for (const [objectType, providerId] of [
      [association.fromObjectType, association.fromProviderId],
      [association.toObjectType, association.toProviderId]
    ] as const) {
      const key = `${objectType}:${providerId}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      links.push({
        org_id: input.organizationId,
        provider: 'salesforce',
        provider_account_id: input.providerAccountId,
        provider_object_type: objectType,
        provider_object_id: providerId,
        atlas_object_type: null,
        atlas_object_id: null,
        last_seen_at: seenAt,
        source_updated_at: null,
        source_fingerprint: null
      });
    }
  }
  await input.deps.store.upsertObjectLinks(links);
}

async function recordEvidence(
  deps: SalesforceCrmOperationDependencies,
  input: {
    organizationId: string;
    actorUserId: string;
    operation: SalesforceCrmOperation;
    objectType?: CrmObjectType | null;
    status: 'completed' | 'failed' | 'rate_limited';
    cursorIn?: string | null;
    cursorOut?: string | null;
    recordsObserved?: number;
    errorCode?: string | null;
  }
): Promise<void> {
  try {
    await deps.store.recordEvidence({
      org_id: input.organizationId,
      provider: 'salesforce',
      operation: input.operation,
      object_type: input.objectType ?? null,
      status: input.status,
      cursor_in: input.cursorIn ?? null,
      cursor_out: input.cursorOut ?? null,
      records_observed: input.recordsObserved ?? 0,
      started_by: input.actorUserId,
      completed_at: nowIso(deps),
      error_code: input.errorCode ?? null
    });
  } catch {
    // Evidence persistence does not replace the provider result.
  }
}

function safeProviderFailure(error: SalesforceCrmError): SalesforceCrmOperationResult {
  return {
    status: error.status > 0 ? error.status : 502,
    body: {
      error: 'Salesforce CRM request failed',
      code: error.code,
      ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds })
    }
  };
}

async function markProviderFailure(input: {
  organizationId: string;
  connectionId: string;
  error: SalesforceCrmError;
  deps: SalesforceCrmOperationDependencies;
}): Promise<void> {
  if (input.error.code === 'expired_credential') {
    await input.deps.store.updateConnectionById(input.organizationId, input.connectionId, {
      state: 'expired',
      last_error_code: input.error.code,
      last_error_at: nowIso(input.deps)
    });
  } else if (input.error.code === 'forbidden_scope') {
    await input.deps.store.updateConnectionById(input.organizationId, input.connectionId, {
      state: 'degraded',
      last_error_code: input.error.code,
      last_error_at: nowIso(input.deps)
    });
  }
}

export async function executeSalesforceCrmOperation(input: {
  operation: SalesforceCrmOperation;
  organizationId: string;
  actorUserId: string;
  body: Record<string, unknown>;
  deps: SalesforceCrmOperationDependencies;
}): Promise<SalesforceCrmOperationResult> {
  const adapter = input.deps.adapter ?? new SalesforceCrmAdapter();
  let objectType: CrmObjectType | null = null;
  let cursor: string | null = null;
  let connectionId: string | null = null;

  try {
    if (!isObjectType(input.body.objectType)) {
      return { status: 400, body: { error: 'Valid CRM objectType is required' } };
    }
    objectType = input.body.objectType;
    cursor = optionalCursor(input.body.cursor);
    const limit = optionalLimit(input.body.limit);

    const loaded = await loadSalesforceCredential({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      deps: input.deps.lifecycle
    });
    connectionId = loaded.connection.id;
    const providerAccountId = loaded.connection.provider_account_id;
    if (!providerAccountId) {
      destroyCredentialPayload(loaded.credential);
      throw new SalesforceLifecycleError('connection_not_ready', 409);
    }

    try {
      const context = contextFromCredential(loaded.credential, input.deps.lifecycle);

      if (input.operation === 'crm.list') {
        const page: CrmPage = await adapter.listObjects(context, { objectType, limit, cursor });
        await persistRecordLinks({
          records: page.records,
          organizationId: input.organizationId,
          providerAccountId,
          deps: input.deps
        });
        await recordEvidence(input.deps, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          operation: input.operation,
          objectType,
          status: 'completed',
          cursorIn: cursor,
          cursorOut: page.nextCursor,
          recordsObserved: page.records.length
        });
        return { status: 200, body: { page } };
      }

      if (input.operation === 'crm.search') {
        const query = requiredString(input.body.query, 'CRM search query');
        const page = await adapter.searchObjects(context, { objectType, query, limit, cursor });
        await persistRecordLinks({
          records: page.records,
          organizationId: input.organizationId,
          providerAccountId,
          deps: input.deps
        });
        await recordEvidence(input.deps, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          operation: input.operation,
          objectType,
          status: 'completed',
          cursorIn: cursor,
          cursorOut: page.nextCursor,
          recordsObserved: page.records.length
        });
        return { status: 200, body: { page } };
      }

      if (input.operation === 'crm.get') {
        const providerId = requiredString(input.body.providerId, 'CRM provider record ID');
        const record = await adapter.getObject(context, { objectType, providerId });
        await persistRecordLinks({
          records: [record],
          organizationId: input.organizationId,
          providerAccountId,
          deps: input.deps
        });
        await recordEvidence(input.deps, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          operation: input.operation,
          objectType,
          status: 'completed',
          recordsObserved: 1
        });
        return { status: 200, body: { record } };
      }

      const providerId = requiredString(input.body.providerId, 'CRM provider record ID');
      if (!isObjectType(input.body.targetObjectType)) {
        return { status: 400, body: { error: 'Valid association targetObjectType is required' } };
      }
      const page = await adapter.listAssociations(context, {
        objectType,
        providerId,
        targetObjectType: input.body.targetObjectType,
        cursor
      });
      await persistAssociationLinks({
        page,
        organizationId: input.organizationId,
        providerAccountId,
        deps: input.deps
      });
      await recordEvidence(input.deps, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        operation: input.operation,
        objectType,
        status: 'completed',
        cursorIn: cursor,
        cursorOut: page.nextCursor,
        recordsObserved: page.associations.length
      });
      return { status: 200, body: { associations: page } };
    } finally {
      destroyCredentialPayload(loaded.credential);
    }
  } catch (error) {
    if (error instanceof SalesforceCrmError) {
      if (connectionId) {
        await markProviderFailure({
          organizationId: input.organizationId,
          connectionId,
          error,
          deps: input.deps
        });
      }
      await recordEvidence(input.deps, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        operation: input.operation,
        objectType,
        status: error.code === 'rate_limited' ? 'rate_limited' : 'failed',
        cursorIn: cursor,
        errorCode: error.code
      });
      return safeProviderFailure(error);
    }

    if (error instanceof SalesforceLifecycleError) {
      await recordEvidence(input.deps, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        operation: input.operation,
        objectType,
        status: 'failed',
        cursorIn: cursor,
        errorCode: error.code
      });
      return {
        status: error.status,
        body: { error: 'Salesforce connection lifecycle failed', code: error.code }
      };
    }

    return {
      status: 400,
      body: { error: error instanceof Error ? error.message : 'CRM operation failed' }
    };
  }
}
