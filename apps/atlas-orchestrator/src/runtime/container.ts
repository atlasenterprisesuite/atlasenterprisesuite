import {
  AtlasOrchestrator,
  InMemoryNightOperationsPersistence,
  InMemoryPersistence,
  SupabaseNightOperationsPersistence,
  SupabasePersistence,
  type NightOperationsPersistencePort,
  type PersistencePort,
  type ProviderAdapter,
  type SupabaseRestConfig,
} from '../../../../packages/ai-core/src';
import { ToolExecutor, type AtlasMcpOperations } from '../../../../packages/atlas-mcp/src';
import type { AtlasActor } from '../../../../packages/governance/src';
import { NightOperationsSupervisor, type NightExecutor } from '../workers/nightOperationsSupervisor';

export function createAtlasRuntime(options: {
  persistence?: PersistencePort;
  providers?: ProviderAdapter[];
  operations?: AtlasMcpOperations;
  nightPersistence?: NightOperationsPersistencePort;
  nightExecutor?: NightExecutor;
  nightActor?: AtlasActor;
  nightWorkerId?: string;
  supabase?: SupabaseRestConfig | null;
} = {}) {
  const persistence = options.persistence
    ?? (options.supabase ? new SupabasePersistence(options.supabase) : new InMemoryPersistence());
  const nightPersistence = options.nightPersistence
    ?? (options.supabase ? new SupabaseNightOperationsPersistence(options.supabase) : new InMemoryNightOperationsPersistence());
  const orchestrator = new AtlasOrchestrator({ persistence, providers: options.providers ?? [] });
  const executor = new ToolExecutor({ orchestrator, persistence, operations: options.operations });
  const nightSupervisor = options.nightExecutor && options.nightActor
    ? new NightOperationsSupervisor({
        orchestrator,
        persistence: nightPersistence,
        actor: options.nightActor,
        workerId: options.nightWorkerId ?? 'atlas-night-worker',
        execute: options.nightExecutor,
      })
    : null;

  return { persistence, nightPersistence, orchestrator, executor, nightSupervisor };
}
