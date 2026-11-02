import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOUDFLARE_MCP_ENDPOINT,
  READ_ONLY_TOOLS,
  assertCloudflareEndpoint,
  assertToolAllowed,
  assertAuthorized,
} from "../../packages/cloudflare-mcp/src/security.mjs";

test("Cloudflare MCP endpoint is pinned", () => {
  assert.equal(assertCloudflareEndpoint().href, CLOUDFLARE_MCP_ENDPOINT);
  for (const candidate of [
    "http://mcp.cloudflare.com/mcp",
    "https://mcp.cloudflare.com/other",
    "https://evil.example/mcp",
    "https://mcp.cloudflare.com/mcp?token=abc",
  ]) {
    assert.throws(() => assertCloudflareEndpoint(candidate), /CLOUDFLARE_ENDPOINT_DENIED/);
  }
});

test("remote MCP tools are denied until explicitly reviewed", () => {
  assert.deepEqual(READ_ONLY_TOOLS, []);
  for (const name of ["deploy", "dns_update", "read_resources", "", undefined]) {
    assert.throws(() => assertToolAllowed(name), /CLOUDFLARE_TOOL_DENIED/);
  }
});

test("missing OAuth authorization fails closed", () => {
  for (const token of ["", " ", undefined, null, 123]) {
    assert.throws(() => assertAuthorized(token), /CLOUDFLARE_OAUTH_REQUIRED/);
  }
  assert.equal(assertAuthorized("temporary-test-token"), true);
});
