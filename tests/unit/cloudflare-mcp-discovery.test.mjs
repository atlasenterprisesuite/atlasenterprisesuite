import test from "node:test";
import assert from "node:assert/strict";
import { discoverCloudflareTools } from "../../packages/cloudflare-mcp/src/discovery.mjs";

test("discovery fails closed without OAuth before importing transport", async () => {
  await assert.rejects(discoverCloudflareTools({}), /CLOUDFLARE_OAUTH_REQUIRED/);
});

test("discovery rejects non-approved endpoints before connecting", async () => {
  await assert.rejects(
    discoverCloudflareTools({
      accessToken: "fake-token",
      endpoint: "https://example.org/mcp",
    }),
    /CLOUDFLARE_ENDPOINT_DENIED/,
  );
});
