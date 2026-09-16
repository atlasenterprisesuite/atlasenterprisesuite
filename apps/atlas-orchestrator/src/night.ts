import { randomUUID } from 'node:crypto';
import type { AtlasActor } from '../../../packages/governance/src';
import { createAtlasRuntime } from './runtime/container';
import { resolveSupabaseBackendConfig } from './runtime/supabaseBackend';
import { buildNightSessionSummary } from './workers/nightDigest';
import { NightOperationsSupervisor } from './workers/nightOperationsSupervisor';
import { isWithinNightWindow } from './workers/nightWindow';
import { createVerificationNightExecutor } from './workers/verificationNightExecutor';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for ATLAS night operations`);
  return value;
}

function maxItems(): number {
  const parsed = Number(process.env.ATLAS_NIGHT_MAX_ITEMS ?? '1000');
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new Error('ATLAS_NIGHT_MAX_ITEMS must be an integer between 1 and 10000');
  }
  return parsed;
}

function isActiveQueueStatus(status: string): boolean {
  return status === 'queued' || status === 'leased' || status === 'running';
}

function humanActionFor(reason: string): string | null {
  if (reason === 'human_approval_required') return 'Review and approve or reject the exact release candidate.';
  if (reason === 'production_release_action_required') return 'Complete the governed production release action.';
  if (reason === 'credential_required') return 'Provide or repair the required authorized credential.';
  if (reason === 'authorization_denied') return 'Review RBAC/scope authorization for the blocked task.';
  if (reason === 'execution_provider_required' || reason === 'provider_not_configured') return 'Configure and verify an authorized ATLAS execution provider.';
  return null;
}

async function main(): Promise<void> {
  const now = new Date();
  const forceRun = process.env.ATLAS_NIGHT_FORCE_RUN === 'true';
  if (!forceRun && !isWithinNightWindow(now)) {
    console.log(JSON.stringify({
      status: 'outside_night_window',
      checkedAt: now.toISOString(),
      timeZone: 'America/New_York',
    }));
    return;
  }

  const supabase = resolveSupabaseBackendConfig(process.env);
  if (!supabase) throw new Error('Durable Supabase backend configuration is required for ATLAS night operations');

  const scope = {
    tenantId: required('ATLAS_TENANT_ID'),
    organizationId: required('ATLAS_ORGANIZATION_ID'),
  };
  const actor: AtlasActor = {
    actorId: process.env.ATLAS_NIGHT_ACTOR_ID?.trim() || 'atlas-night-supervisor',
    kind: 'service',
    scope,
    permissions: ['ai.task.read', 'ai.task.update', 'ai.ci.read', 'ai.audit.read'],
  };

  const runtime = createAtlasRuntime({ supabase });
  if (!runtime.persistence.durable || !runtime.nightPersistence.durable) {
    throw new Error('ATLAS night operations require durable task and night persistence');
  }

  const startedAt = now.toISOString();
  const initialQueue = await runtime.nightPersistence.listNightItems(scope);
  const totalQueued = initialQueue.filter((item) => isActiveQueueStatus(item.status)).length;
  const supervisor = new NightOperationsSupervisor({
    orchestrator: runtime.orchestrator,
    persistence: runtime.nightPersistence,
    actor,
    workerId: process.env.ATLAS_NIGHT_WORKER_ID?.trim() || 'atlas-night-worker',
    execute: createVerificationNightExecutor(runtime.orchestrator),
  });

  const processedItems = await supervisor.runSession(scope, maxItems());
  const finalQueueItems = await runtime.nightPersistence.listNightItems(scope);
  const endedAt = new Date().toISOString();
  const reasons = [...new Set(processedItems.map((item) => item.attentionReason).filter((value): value is string => Boolean(value)))];
  const humanActionsRequired = reasons.map(humanActionFor).filter((value): value is string => Boolean(value));
  const evidenceRefs = new Set<string>();
  for (const item of processedItems) {
    const checkpoint = await runtime.nightPersistence.getLatestNightCheckpoint(scope, item.queueItemId);
    for (const evidence of checkpoint?.evidenceRefs ?? []) evidenceRefs.add(evidence);
  }

  const summary = buildNightSessionSummary({
    sessionId: `NSESSION-${randomUUID()}`,
    scope,
    startedAt,
    endedAt,
    totalQueued,
    processedItems,
    finalQueueItems,
    retries: processedItems.reduce((sum, item) => sum + Math.max(0, item.attempt - 1), 0),
    blockerCategories: reasons,
    humanActionsRequired,
    evidenceRefs: [...evidenceRefs],
  });
  await runtime.nightPersistence.saveNightSessionSummary(summary);

  console.log(JSON.stringify({ status: 'night_session_completed', summary }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'night_session_failed',
    error: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exitCode = 1;
});
