export type AviationPersistenceState = 'ready' | 'restricted' | 'not_configured';

export type AviationPersistenceContext = {
  adapterConfigured: boolean;
  authorized: boolean;
};

export function resolveAviationPersistenceState(
  context: AviationPersistenceContext
): AviationPersistenceState {
  if (!context.authorized) return 'restricted';
  if (!context.adapterConfigured) return 'not_configured';
  return 'ready';
}
