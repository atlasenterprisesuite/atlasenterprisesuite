export function readiness(
  persistence: { durable: boolean },
  nightPersistence?: { durable: boolean },
): { ready: boolean; reason: string | null } {
  if (!persistence.durable) return { ready: false, reason: 'persistence_not_durable' };
  if (nightPersistence && !nightPersistence.durable) return { ready: false, reason: 'night_persistence_not_durable' };
  return { ready: true, reason: null };
}
