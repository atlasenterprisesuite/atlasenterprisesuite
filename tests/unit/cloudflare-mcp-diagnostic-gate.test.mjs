import test from "node:test";
import assert from "node:assert/strict";
import { authorizeDiagnosticRequest } from "../../packages/cloudflare-mcp/src/diagnostic-gate.mjs";

const valid = { accessToken: "test-only", method: "GET", path: "/accounts/{account_id}/workers/scripts" };
test("permits an explicitly reviewed diagnostic request shape", () => {
  assert.deepEqual(authorizeDiagnosticRequest(valid), { method: "GET", path: valid.path });
});
test("rejects writes and unknown endpoints", () => {
  assert.throws(() => authorizeDiagnosticRequest({ ...valid, method: "POST" }), /CLOUDFLARE_OPERATION_DENIED/);
  assert.throws(() => authorizeDiagnosticRequest({ ...valid, endpoint: "https://example.com/mcp" }), /CLOUDFLARE_ENDPOINT_DENIED/);
});
test("rejects missing authentication and sensitive payloads", () => {
  assert.throws(() => authorizeDiagnosticRequest({ ...valid, accessToken: "" }), /CLOUDFLARE_OAUTH_REQUIRED/);
  assert.throws(() => authorizeDiagnosticRequest({ ...valid, payload: { access_token: "secret" } }), /CLOUDFLARE_SENSITIVE_DATA_DENIED/);
});
