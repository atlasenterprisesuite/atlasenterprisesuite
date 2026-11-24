import { assertReadOnlyOperation, assertNoSensitiveFields } from "./readonly-policy.mjs";
import { assertAuthorized, assertCloudflareEndpoint } from "./security.mjs";

/**
 * Validate a proposed diagnostic operation before MCP tool execution.
 * This does not grant permission to call a remotely advertised tool: tool schemas,
 * OAuth scopes and the remote execution contract must be independently reviewed.
 */
export function authorizeDiagnosticRequest({ accessToken, endpoint, method, path, payload } = {}) {
  assertAuthorized(accessToken);
  assertCloudflareEndpoint(endpoint);
  assertReadOnlyOperation(method, path);
  assertNoSensitiveFields(payload);
  return Object.freeze({ method: String(method).toUpperCase(), path });
}
