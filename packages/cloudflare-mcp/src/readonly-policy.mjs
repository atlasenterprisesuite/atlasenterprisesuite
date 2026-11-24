// Explicit operation-level allowlist for Cloudflare diagnostic access.
// Never execute arbitrary code-mode MCP tools or accept remotely advertised operations as trusted.
export const READ_ONLY_OPERATIONS = Object.freeze([
  { method: 'GET', path: '/accounts/{account_id}/workers/scripts' },
  { method: 'GET', path: '/accounts/{account_id}/workers/scripts/{script_name}/deployments' },
  { method: 'GET', path: '/zones/{zone_id}/dns_records' },
]);

export function assertReadOnlyOperation(method, path) {
  const normalizedMethod = String(method || '').toUpperCase();
  const approved = READ_ONLY_OPERATIONS.some(item => item.method === normalizedMethod && item.path === path);
  if (!approved) throw new Error('CLOUDFLARE_OPERATION_DENIED');
  return true;
}

export function assertNoSensitiveFields(value) {
  const serialized = JSON.stringify(value ?? {});
  if (/authorization|access_token|refresh_token|client_secret|api_key|private_key/i.test(serialized)) {
    throw new Error('CLOUDFLARE_SENSITIVE_DATA_DENIED');
  }
  return true;
}
