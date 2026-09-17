import type {
  CrmAssociationPage,
  CrmObjectType,
  CrmRecord
} from '../../../packages/core/src/crm.ts';
import { destroyCredentialPayload } from './integration-credential-vault.ts';
import {
  getHubSpotConnectionStatus,
  HubSpotLifecycleError,
  refreshHubSpotConnectionCredential,
  type HubSpotLifecycleDependencies
} from './hubspot-connection-lifecycle.ts';
import { HubSpotCrmAdapter, HubSpotCrmError } from './hubspot-crm.ts';
import type {
  HubSpotConnectionStore,
  HubSpotExternalObjectLinkInput
} from './hubspot-connection-store.ts';

const CRM_OBJECT_TYPES = [
  'contact', 'company', 'deal', 'ticket', 'task', 'call', 'meeting', 'note', 'email'
] as const satisfies readonly CrmObjectType[];

export type HubSpotCrmOperation =
  | 'crm.list'
  | 'crm.search'
  | 'crm.get'
  | 'crm.associations'
  | 'crm.refresh';

export type HubSpotCrmReadAdapter = Pick<
  HubSpotCrmAdapter,
  'readiness' | 'listObjects' | 'searchObjects' | 'getObject' | 'listAssociations'
>;

export type HubSpotCrmOperationDependencies = {
  store: HubSpotConnectionStore;
  lifecycle: HubSpotLifecycleDependencies;
  adapter?: HubSpotCrmReadAdapter;
  now?: () => number;
};

export type HubSpotCrmOperationResult = { status: number; body: unknown };

function nowMs(deps: HubSpotCrmOperationDependencies): number {
  return deps.now?.() ?? deps.lifecycle.now?.() ?? Date.now();
}
function nowIso(deps: HubSpotCrmOperationDependencies): string {
  return new Date(nowMs(deps)).toISOString();
}
function isObjectType(value: unknown): value is CrmObjectType {
  return typeof value === 'string' && (CRM_OBJECT_TYPES as readonly string[]).includes(value);
}
function optionalCursor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('CRM cursor must be a string');
  return value;
}
function optionalLimit(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('CRM limit must be a positive integer');
  }
  return value;
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

async function fingerprint(record: Pick<CrmRecord, 'objectType' | 'providerId' | 'updatedAt'>): Promise<string> {
  const source = `${record.objectType}:${record.providerId}:${record.updatedAt ?? ''}`;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
  let hex = '';
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

async function persistRecordLinks(input: {
  records: readonly CrmRecord[];
  organizationId: string;
  providerAccountId: string;
  deps: HubSpotCrmOperationDependencies;
}): Promise<void> {
  if (input.records.length === 0) return;
  if (!input.deps.store.upsertObjectLinks) {
    throw new Error('ATLAS external object link storage is not configured');
  }
  const seenAt = nowIso(input.deps);
  const links: HubSpotExternalObjectLinkInput[] = [];
  for (const record of input.records) {
    links.push({
      org_id: input.organizationId,
      provider: 'hubspot',
      provider_account_id: input.providerAccountId,
      provider_object_type: record.objectType,
      provider_object_id: record.providerId,
      atlas_object_type: null,
      atlas_object_id: null,
      last_seen_at: seenAt,
      source_updated_at: record.updatedAt,
      source_fingerprint: await fingerprint(record)
    });
  }
  await input.deps.store.upsertObjectLinks(links);
}

async function persistAssociationLinks(input: {
  page: CrmAssociationPage;
  organizationId: string;
  providerAccountId: string;
  deps: HubSpotCrmOperationDependencies;
}): Promise<void> {
  if (input.page.associations.length === 0) return;
  if (!input.deps.store.upsertObjectLinks) {
    throw new Error('ATLAS external object link storage is not configured');
  }
  const seenAt = nowIso(input.deps);
  const links: HubSpotExternalObjectLinkInput[] = [];
  const dedupe = new Set<string>();
  for (const association of input.page.associations) {
    for (const pair of [
      [association.fromObjectType, association.fromProviderId],
      [association.toObjectType, association.toProviderId]
    ] as const) {
      const key = `${pair[0]}:${pair[1]}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      links.push({
        org_id: input.organizationId,
        provider: 'hubspot',
        provider_account_id: input.providerAccountId,
        provider_object_type: pair[0],
        provider_object_id: pair[1],
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
  deps: HubSpotCrmOperationDependencies,
  input: {
    organizationId: string;
    actorUserId: string;
    operation: string;
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
      provider: 'hubspot',
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
    // Do not replace a successful provider read with evidence-storage failure.
  }
}

async function readyConnection(input: {
  organizationId: string;
  deps: HubSpotCrmOperationDependencies;
}) {
  const connection = await input.deps.store.getConnection(input.organizationId);
  if (!connection || !connection.provider_account_id || !connection.credential_ref ||
      !['connected', 'degraded'].includes(connection.state)) {
    throw new HubSpotLifecycleError('connection_not_ready', 409);
  }
  return connection;
}

function safeProviderFailure(error: HubSpotCrmError): HubSpotCrmOperationResult {
  return {
    status: error.status > 0 ? error.status : 502,
    body: {
      error: 'HubSpot CRM request failed',
      code: error.code,
      ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds })
    }
  };
}

async function markProviderFailure(input: {
  organizationId: string;
  error: HubSpotCrmError;
  deps: HubSpotCrmOperationDependencies;
}) {
  if (input.error.code === 'expired_credential') {
    await input.deps.store.updateConnection(input.organizationId, {
      state: 'expired', last_error_code: input.error.code, last_error_at: nowIso(input.deps)
    });
  } else if (input.error.code === 'forbidden_scope') {
    await input.deps.store.updateConnection(input.organizationId, {
      state: 'degraded', last_error_code: input.error.code, last_error_at: nowIso(input.deps)
    });
  }
}

export async function executeHubSpotCrmOperation(input: {
  operation: HubSpotCrmOperation;
  organizationId: string;
  actorUserId: string;
  body: Record<string, unknown>;
  deps: HubSpotCrmOperationDependencies;
}): Promise<HubSpotCrmOperationResult> {
  const adapter = input.deps.adapter ?? new HubSpotCrmAdapter();
  const providerContext = (accessToken: string) => ({
    accessToken,
    fetchImpl: input.deps.lifecycle.fetchImpl
  });
  let objectType: CrmObjectType | null = null;
  let cursor: string | null = null;

  try {
    if (input.operation === 'crm.refresh') {
      const connection = await readyConnection({ organizationId: input.organizationId, deps: input.deps });
      const credential = await refreshHubSpotConnectionCredential({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        deps: input.deps.lifecycle
      });
      try {
        const readiness = await adapter.readiness(providerContext(credential.accessToken));
        if (!readiness.ready || !readiness.account) {
          const code = readiness.error?.code ?? 'upstream_unavailable';
          await input.deps.store.updateConnection(input.organizationId, {
            state: 'degraded', last_error_code: code, last_error_at: nowIso(input.deps)
          });
          await recordEvidence(input.deps, {
            organizationId: input.organizationId, actorUserId: input.actorUserId,
            operation: input.operation, status: 'failed', errorCode: code
          });
          return {
            status: 200,
            body: { connection: await getHubSpotConnectionStatus({
              organizationId: input.organizationId, deps: input.deps.lifecycle
            }) }
          };
        }
        if (readiness.account.id !== connection.provider_account_id) {
          throw new HubSpotLifecycleError('provider_account_mismatch', 409);
        }
        const verifiedAt = nowIso(input.deps);
        await input.deps.store.updateConnection(input.organizationId, {
          state: 'connected',
          provider_account_label: readiness.account.label,
          last_verified_at: verifiedAt,
          last_success_at: verifiedAt,
          last_error_code: null,
          last_error_at: null
        });
        await recordEvidence(input.deps, {
          organizationId: input.organizationId, actorUserId: input.actorUserId,
          operation: input.operation, status: 'completed'
        });
        return {
          status: 200,
          body: { connection: await getHubSpotConnectionStatus({
            organizationId: input.organizationId, deps: input.deps.lifecycle
          }) }
        };
      } finally {
        destroyCredentialPayload(credential);
      }
    }

    if (!isObjectType(input.body.objectType)) {
      return { status: 400, body: { error: 'Valid CRM objectType is required' } };
    }
    objectType = input.body.objectType;
    cursor = optionalCursor(input.body.cursor);
    const limit = optionalLimit(input.body.limit);
    const connection = await readyConnection({ organizationId: input.organizationId, deps: input.deps });
    const credential = await refreshHubSpotConnectionCredential({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      deps: input.deps.lifecycle
    });

    try {
      const context = providerContext(credential.accessToken);
      if (input.operation === 'crm.list') {
        const page = await adapter.listObjects(context, { objectType, limit, cursor });
        await persistRecordLinks({ records: page.records, organizationId: input.organizationId,
          providerAccountId: connection.provider_account_id!, deps: input.deps });
        await recordEvidence(input.deps, {
          organizationId: input.organizationId, actorUserId: input.actorUserId,
          operation: input.operation, objectType, status: 'completed', cursorIn: cursor,
          cursorOut: page.nextCursor, recordsObserved: page.records.length
        });
        return { status: 200, body: { page } };
      }

      if (input.operation === 'crm.search') {
        const query = requiredString(input.body.query, 'CRM search query');
        const page = await adapter.searchObjects(context, { objectType, query, limit, cursor });
        await persistRecordLinks({ records: page.records, organizationId: input.organizationId,
          providerAccountId: connection.provider_account_id!, deps: input.deps });
        await recordEvidence(input.deps, {
          organizationId: input.organizationId, actorUserId: input.actorUserId,
          operation: input.operation, objectType, status: 'completed', cursorIn: cursor,
          cursorOut: page.nextCursor, recordsObserved: page.records.length
        });
        return { status: 200, body: { page } };
      }

      if (input.operation === 'crm.get') {
        const providerId = requiredString(input.body.providerId, 'CRM provider record ID');
        const record = await adapter.getObject(context, { objectType, providerId });
        await persistRecordLinks({ records: [record], organizationId: input.organizationId,
          providerAccountId: connection.provider_account_id!, deps: input.deps });
        await recordEvidence(input.deps, {
          organizationId: input.organizationId, actorUserId: input.actorUserId,
          operation: input.operation, objectType, status: 'completed', recordsObserved: 1
        });
        return { status: 200, body: { record } };
      }

      const providerId = requiredString(input.body.providerId, 'CRM provider record ID');
      if (!isObjectType(input.body.targetObjectType)) {
        return { status: 400, body: { error: 'Valid association targetObjectType is required' } };
      }
      const page = await adapter.listAssociations(context, {
        objectType, providerId, targetObjectType: input.body.targetObjectType, cursor
      });
      await persistAssociationLinks({ page, organizationId: input.organizationId,
        providerAccountId: connection.provider_account_id!, deps: input.deps });
      await recordEvidence(input.deps, {
        organizationId: input.organizationId, actorUserId: input.actorUserId,
        operation: input.operation, objectType, status: 'completed', cursorIn: cursor,
        cursorOut: page.nextCursor, recordsObserved: page.associations.length
      });
      return { status: 200, body: { associations: page } };
    } finally {
      destroyCredentialPayload(credential);
    }
  } catch (error) {
    if (error instanceof HubSpotCrmError) {
      await markProviderFailure({ organizationId: input.organizationId, error, deps: input.deps });
      await recordEvidence(input.deps, {
        organizationId: input.organizationId, actorUserId: input.actorUserId,
        operation: input.operation, objectType,
        status: error.code === 'rate_limited' ? 'rate_limited' : 'failed',
        cursorIn: cursor, errorCode: error.code
      });
      return safeProviderFailure(error);
    }
    if (error instanceof HubSpotLifecycleError) {
      await recordEvidence(input.deps, {
        organizationId: input.organizationId, actorUserId: input.actorUserId,
        operation: input.operation, objectType, status: 'failed', cursorIn: cursor,
        errorCode: error.code
      });
      return { status: error.status, body: {
        error: 'HubSpot connection lifecycle failed', code: error.code
      } };
    }
    const message = error instanceof Error ? error.message : 'CRM operation failed';
    return { status: 400, body: { error: message } };
  }
}
