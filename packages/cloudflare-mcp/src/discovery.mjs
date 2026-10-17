import { assertAuthorized, assertCloudflareEndpoint } from "./security.mjs";

/**
 * Discovery-only Cloudflare MCP client. Requires the MCP SDK as a runtime dependency.
 * OAuth tokens must come from a separate approved authorization flow and secret store.
 * Never executes remotely advertised tools.
 */
export async function discoverCloudflareTools({ accessToken, endpoint } = {}) {
  assertAuthorized(accessToken);
  const url = assertCloudflareEndpoint(endpoint);
  const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
    import("@modelcontextprotocol/sdk/client/index.js"),
    import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
  ]);
  const client = new Client({ name: "atlas-cloudflare-discovery", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  try {
    await client.connect(transport);
    const result = await client.listTools();
    return {
      connected: true,
      discoveryOnly: true,
      tools: (result.tools ?? []).map(({ name, description }) => ({
        name,
        description: String(description ?? "").slice(0, 240),
      })),
    };
  } finally {
    await client.close();
  }
}
