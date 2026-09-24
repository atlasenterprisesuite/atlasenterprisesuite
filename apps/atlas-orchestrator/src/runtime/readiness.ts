import type { TenantScope } from '../../../../packages/core/src/index';
import type { PersistencePort } from '../../../../packages/ai-core/src';

export function readiness(persistence: { durable: boolean }): { ready: boolean; reason: string | null } {
  if (!persistence.durable) return { ready: false, reason: 'persistence_not_durable' };
  return { ready: true, reason: null };
}

export async function verifyReadiness(
  persistence: PersistencePort,
  scope: TenantScope,
): Promise<{ ready: boolean; reason: string | null }> {
  const state = readiness(persistence);
  if (!state.ready) return state;

  try {
    await persistence.listEvents(scope, '__atlas_readiness__');
    return { ready: true, reason: null };
  } catch {
    return { ready: false, reason: 'persistence_unreachable' };
  }
}
