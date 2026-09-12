import { AtlasOrchestrator, InMemoryPersistence, type PersistencePort, type ProviderAdapter } from '../../../../packages/ai-core/src';
import { ToolExecutor, type AtlasMcpOperations } from '../../../../packages/atlas-mcp/src';

export function createAtlasRuntime(options: {
  persistence?: PersistencePort;
  providers?: ProviderAdapter[];
  operations?: AtlasMcpOperations;
} = {}) {
  const persistence = options.persistence ?? new InMemoryPersistence();
  const orchestrator = new AtlasOrchestrator({ persistence, providers: options.providers ?? [] });
  const executor = new ToolExecutor({ orchestrator, persistence, operations: options.operations });
  return { persistence, orchestrator, executor };
}
