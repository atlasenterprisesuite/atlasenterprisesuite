// ATLAS Deep Explorer: fail-closed source admission policy.
// This module is deliberately transport-agnostic. It does not initiate network requests.
export const SOURCE_KINDS = Object.freeze(['public-web','academic','archive','onion']);
export const RESEARCH_STATES = Object.freeze(['verified','disputed','hypothesis','unverified']);
const ONION = /^[a-z2-7]{56}\.onion$/;
const BLOCKED = new Set(['localhost','localhost.localdomain']);
export function evaluateResearchSource(input, context = {}) {
  const denied = reason => Object.freeze({allowed:false,reason});
  if (!input || typeof input !== 'object') return denied('invalid_source');
  if (!context || context.researchPermission !== true) return denied('permission_required');
  if (context.tenantAuthorized !== true) return denied('tenant_authorization_required');
  if (!SOURCE_KINDS.includes(input.kind)) return denied('unknown_source_kind');
  if (typeof input.url !== 'string' || input.url.length > 2048) return denied('invalid_url');
  let url;
  try { url = new URL(input.url); } catch { return denied('invalid_url'); }
  if (url.username || url.password) return denied('embedded_credentials_forbidden');
  if (url.protocol !== 'https:') return denied('https_required');
  if (url.port && url.port !== '443') return denied('nonstandard_port_forbidden');
  const host = url.hostname.toLowerCase();
  if (BLOCKED.has(host) || host.endsWith('.local') || host.endsWith('.internal')) return denied('private_host_forbidden');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')) return denied('ip_literal_forbidden');
  const onion = host.endsWith('.onion');
  if (input.kind === 'onion' && !ONION.test(host)) return denied('invalid_onion_v3');
  if (input.kind !== 'onion' && onion) return denied('onion_kind_required');
  if (onion) {
    if (context.onionResearchEnabled !== true) return denied('onion_research_disabled');
    if (context.isolatedTorTransport !== true) return denied('isolated_tor_required');
    if (context.verifiedOnionAddress !== true) return denied('onion_provenance_unverified');
  }
  if (input.readOnly !== true) return denied('read_only_required');
  if (input.provenance !== 'primary' && input.provenance !== 'corroborated') return denied('source_provenance_required');
  return Object.freeze({allowed:true,reason:'source_admitted',normalizedUrl:url.href,transport:onion?'isolated-tor':'standard'});
}
