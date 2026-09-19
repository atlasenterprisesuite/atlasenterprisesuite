import type { CrmObjectType } from '../../../packages/core/src/crm.ts';
import { destroyCredentialPayload } from './integration-credential-vault.ts';
import {
  HubSpotLifecycleError,
  refreshHubSpotConnectionCredential,
  type HubSpotLifecycleDependencies
} from './hubspot-connection-lifecycle.ts';
import { HubSpotCrmAdapter, HubSpotCrmError, type CrmProviderContext } from './hubspot-crm.ts';
import type {
  HubSpotConnectionRow,
  HubSpotConnectionStore,
  HubSpotHealthRow
} from './hubspot-connection-store.ts';

export const HUBSPOT_SMOKE_OBJECT_TYPES = [
  'contact', 'company', 'deal', 'ticket'
] as const satisfies readonly CrmObjectType[];

export type HubSpotHealthView = {
  status: HubSpotHealthRow['status'] | 'unknown';
  lastProbeAt: string | null;
  lastProbeSuccessAt: string | null;
  lastRefreshVerifiedAt: string | null;
  lastWebhookAt: string | null;
  lastReconcileAt: string | null;
  consecutiveFailures: number;
  lastErrorCode: string | null;
  objectChecks: Record<string, unknown>;
  reconcileSummary: Record<string, unknown>;
};

export type HubSpotResilienceDependencies = {
  store: HubSpotConnectionStore;
  lifecycle: HubSpotLifecycleDependencies;
  adapter?: Pick<HubSpotCrmAdapter, 'readiness' | 'listObjects'>;
  now?: () => number;
};

function nowIso(deps: HubSpotResilienceDependencies): string {
  return new Date(deps.now?.() ?? Date.now()).toISOString();
}

export function hubSpotHealthView(row: HubSpotHealthRow | null): HubSpotHealthView {
  if (!row) {
    return {
      status: 'unknown',
      lastProbeAt: null,
      lastProbeSuccessAt: null,
      lastRefreshVerifiedAt: null,
      lastWebhookAt: null,
      lastReconcileAt: null,
      consecutiveFailures: 0,
      lastErrorCode: null,
      objectChecks: {},
      reconcileSummary: {}
    };
  }
  return {
    status: row.status,
    lastProbeAt: row.last_probe_at,
    lastProbeSuccessAt: row.last_probe_success_at,
    lastRefreshVerifiedAt: row.last_refresh_verified_at,
    lastWebhookAt: row.last_webhook_at,
    lastReconcileAt: row.last_reconcile_at,
    consecutiveFailures: row.consecutive_failures,
    lastErrorCode: row.last_error_code,
    objectChecks: row.object_checks ?? {},
    reconcileSummary: row.reconcile_summary ?? {}
  };
}

function providerContext(accessToken: string, deps: HubSpotResilienceDependencies): CrmProviderContext {
  return { accessToken, fetchImpl: deps.lifecycle.fetchImpl };
}

function errorCode(error: unknown): string {
  if (error instanceof HubSpotCrmError) return error.code;
  if (error instanceof HubSpotLifecycleError) return error.code;
  return 'hubspot_health_check_failed';
}

async function healthFailure(
  connection: HubSpotConnectionRow,
  deps: HubSpotResilienceDependencies,
  code: string
): Promise<void> {
  const previous = await deps.store.getHealth?.(connection.org_id);
  const timestamp = nowIso(deps);
  await deps.store.upsertHealth?.(connection.org_id, {
    status: code === 'credential_refresh_failed' || code === 'expired_credential' ? 'error' : 'degraded',
    last_probe_at: timestamp,
    consecutive_failures: (previous?.consecutive_failures ?? 0) + 1,
    last_error_code: code
  });
  await deps.store.updateConnection(connection.org_id, {
    state: code === 'credential_refresh_failed' || code === 'expired_credential' ? 'expired' : 'degraded',
    last_error_code: code,
    last_error_at: timestamp
  });
}

export async function verifyHubSpotConnectionHealth(input: {
  connection: HubSpotConnectionRow;
  actorUserId: string;
  deps: HubSpotResilienceDependencies;
  forceRefresh?: boolean;
}): Promise<HubSpotHealthView> {
  const adapter = input.deps.adapter ?? new HubSpotCrmAdapter();
  const timestamp = nowIso(input.deps);
  let credential: Awaited<ReturnType<typeof refreshHubSpotConnectionCredential>> | null = null;
  try {
    credential = await refreshHubSpotConnectionCredential({
      organizationId: input.connection.org_id,
      actorUserId: input.actorUserId,
      deps: input.deps.lifecycle,
      forceRefresh: input.forceRefresh === true
    });

    const context = providerContext(credential.accessToken, input.deps);
    const readiness = await adapter.readiness(context);
    if (!readiness.ready || !readiness.account) {
      throw new HubSpotLifecycleError('provider_probe_failed', 502);
    }
    if (
      input.connection.provider_account_id &&
      readiness.account.id !== input.connection.provider_account_id
    ) {
      throw new HubSpotLifecycleError('provider_account_mismatch', 409);
    }

    const checks: Record<string, unknown> = {
      account: { ok: true, id: readiness.account.id }
    };
    for (const objectType of HUBSPOT_SMOKE_OBJECT_TYPES) {
      const page = await adapter.listObjects(context, {
        objectType,
        limit: 1
      });
      checks[objectType] = { ok: true, observed: page.records.length };
      if (page.records.length && input.connection.provider_account_id && input.deps.store.upsertObjectLinks) {
        await input.deps.store.upsertObjectLinks(page.records.map((record) => ({
          org_id: input.connection.org_id,
          provider: 'hubspot' as const,
          provider_account_id: input.connection.provider_account_id!,
          provider_object_type: record.objectType,
          provider_object_id: record.providerId,
          last_seen_at: timestamp,
          source_updated_at: record.updatedAt,
          source_fingerprint: null
        })));
      }
    }

    await input.deps.store.updateConnection(input.connection.org_id, {
      state: 'connected',
      provider_account_label: readiness.account.label,
      last_verified_at: timestamp,
      last_success_at: timestamp,
      last_error_code: null,
      last_error_at: null
    });
    const row = await input.deps.store.upsertHealth?.(input.connection.org_id, {
      status: 'healthy',
      last_probe_at: timestamp,
      last_probe_success_at: timestamp,
      last_refresh_verified_at: input.forceRefresh ? timestamp : undefined,
      consecutive_failures: 0,
      last_error_code: null,
      object_checks: checks
    });
    await input.deps.store.recordEvidence({
      org_id: input.connection.org_id,
      provider: 'hubspot',
      operation: 'connection.health',
      status: 'completed',
      started_by: input.actorUserId,
      completed_at: timestamp,
      records_observed: HUBSPOT_SMOKE_OBJECT_TYPES.length
    });
    return hubSpotHealthView(row ?? await input.deps.store.getHealth?.(input.connection.org_id) ?? null);
  } catch (error) {
    const code = errorCode(error);
    await healthFailure(input.connection, input.deps, code);
    await input.deps.store.recordEvidence({
      org_id: input.connection.org_id,
      provider: 'hubspot',
      operation: 'connection.health',
      status: error instanceof HubSpotCrmError && error.code === 'rate_limited' ? 'rate_limited' : 'failed',
      started_by: input.actorUserId,
      completed_at: timestamp,
      error_code: code
    }).catch(() => {});
    throw error;
  } finally {
    if (credential) destroyCredentialPayload(credential);
  }
}

export async function reconcileHubSpotConnection(input: {
  connection: HubSpotConnectionRow;
  actorUserId: string;
  deps: HubSpotResilienceDependencies;
  maxPagesPerObject?: number;
}): Promise<Record<string, unknown>> {
  const adapter = input.deps.adapter ?? new HubSpotCrmAdapter();
  let credential: Awaited<ReturnType<typeof refreshHubSpotConnectionCredential>> | null = null;
  const timestamp = nowIso(input.deps);
  const maxPages = Math.max(1, Math.min(input.maxPagesPerObject ?? 10, 20));
  const summary: Record<string, unknown> = {};

  try {
    credential = await refreshHubSpotConnectionCredential({
      organizationId: input.connection.org_id,
      actorUserId: input.actorUserId,
      deps: input.deps.lifecycle
    });
    for (const objectType of HUBSPOT_SMOKE_OBJECT_TYPES) {
      let cursor: string | null = null;
      let observed = 0;
      let pages = 0;
      do {
        const page = await adapter.listObjects(providerContext(credential.accessToken, input.deps), {
          objectType,
          limit: 100,
          cursor
        });
        pages += 1;
        observed += page.records.length;
        if (page.records.length && input.connection.provider_account_id && input.deps.store.upsertObjectLinks) {
          await input.deps.store.upsertObjectLinks(page.records.map((record) => ({
            org_id: input.connection.org_id,
            provider: 'hubspot' as const,
            provider_account_id: input.connection.provider_account_id!,
            provider_object_type: record.objectType,
            provider_object_id: record.providerId,
            last_seen_at: timestamp,
            source_updated_at: record.updatedAt,
            source_fingerprint: null
          })));
        }
        cursor = page.nextCursor;
      } while (cursor && pages < maxPages);
      summary[objectType] = { observed, pages, truncated: Boolean(cursor) };
    }

    await input.deps.store.upsertHealth?.(input.connection.org_id, {
      last_reconcile_at: timestamp,
      reconcile_summary: summary
    });
    await input.deps.store.recordEvidence({
      org_id: input.connection.org_id,
      provider: 'hubspot',
      operation: 'crm.reconcile',
      status: 'completed',
      started_by: input.actorUserId,
      completed_at: timestamp,
      records_observed: Object.values(summary).reduce(
        (total, item) => total + Number((item as { observed?: unknown }).observed ?? 0),
        0
      )
    });
    return summary;
  } finally {
    if (credential) destroyCredentialPayload(credential);
  }
}

export async function runHubSpotScheduledMonitor(deps: HubSpotResilienceDependencies): Promise<{
  checked: number;
  healthy: number;
  failed: number;
  reconciled: number;
}> {
  const connections = await deps.store.listMonitorConnections?.() ?? [];
  let healthy = 0;
  let failed = 0;
  let reconciled = 0;
  const now = deps.now?.() ?? Date.now();

  for (const connection of connections) {
    const actorUserId = connection.connected_by;
    if (!actorUserId) {
      failed += 1;
      await healthFailure(connection, deps, 'missing_connected_actor');
      continue;
    }
    try {
      await verifyHubSpotConnectionHealth({
        connection,
        actorUserId,
        deps,
        forceRefresh: true
      });
      healthy += 1;
      const health = await deps.store.getHealth?.(connection.org_id);
      const last = health?.last_reconcile_at ? Date.parse(health.last_reconcile_at) : 0;
      if (!Number.isFinite(last) || now - last >= 6 * 60 * 60 * 1000) {
        await reconcileHubSpotConnection({ connection, actorUserId, deps });
        reconciled += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { checked: connections.length, healthy, failed, reconciled };
}
