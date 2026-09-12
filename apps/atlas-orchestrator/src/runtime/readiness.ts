export function readiness(persistence: { durable: boolean }): { ready: boolean; reason: string | null } {
  if (!persistence.durable) return { ready: false, reason: 'persistence_not_durable' };
  return { ready: true, reason: null };
}
