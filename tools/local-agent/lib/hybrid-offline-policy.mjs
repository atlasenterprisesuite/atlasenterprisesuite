/** ATLAS Hybrid Offline AI: deterministic routing; no implicit cloud escalation. */
export const MODES = Object.freeze(['device-local','desktop-local','lan-paired','cloud']);
export function selectInferenceRoute({preferred='device-local', online=false, deviceAvailable=false, desktopAvailable=false, paired=false, lanAvailable=false, cloudAuthorized=false}={}) {
  if (!MODES.includes(preferred)) throw new Error('offline_invalid_route');
  const available = {
    'device-local': deviceAvailable,
    'desktop-local': desktopAvailable,
    'lan-paired': paired && lanAvailable,
    'cloud': online && cloudAuthorized
  };
  if (!available[preferred]) throw new Error('offline_route_unavailable');
  return Object.freeze({mode:preferred, network:preferred==='cloud'?'internet':preferred==='lan-paired'?'lan':'none'});
}
/** Offline mutations are never committed without fresh server authorization. */
export function evaluateSyncOperation({operation, principal, authorization}={}) {
  if (!operation || !principal || !authorization) throw new Error('sync_authorization_required');
  if (!operation.id || !operation.tenantId || !operation.actorId || !operation.idempotencyKey) throw new Error('sync_invalid_operation');
  if (operation.tenantId !== principal.tenantId || operation.actorId !== principal.actorId) throw new Error('sync_identity_mismatch');
  if (authorization.tenantId !== operation.tenantId || authorization.actorId !== operation.actorId || authorization.allowed !== true || authorization.fresh !== true) throw new Error('sync_denied');
  return Object.freeze({accepted:true,idempotencyKey:operation.idempotencyKey});
}
