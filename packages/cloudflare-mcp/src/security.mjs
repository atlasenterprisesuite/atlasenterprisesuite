// ATLAS Cloudflare MCP diagnostic gate. No remote tool execution is permitted.
// This module intentionally has no external dependencies.
export const CLOUDFLARE_MCP_ENDPOINT = "https://mcp.cloudflare.com/mcp";
export const READ_ONLY_TOOLS = Object.freeze([]);

/** Reject endpoints outside the approved Cloudflare MCP origin and path. */
export function assertCloudflareEndpoint(value = CLOUDFLARE_MCP_ENDPOINT) {
  const url = new URL(value);
  if (url.href !== CLOUDFLARE_MCP_ENDPOINT) {
    throw new Error("CLOUDFLARE_ENDPOINT_DENIED");
  }
  return url;
}

/** Deny by default until the remote tool schema and scopes are reviewed. */
export function assertToolAllowed(toolName) {
  if (!READ_ONLY_TOOLS.includes(toolName)) {
    throw new Error("CLOUDFLARE_TOOL_DENIED");
  }
  return toolName;
}

/** Reject missing or whitespace-only OAuth tokens without logging them. */
export function assertAuthorized(token) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("CLOUDFLARE_OAUTH_REQUIRED");
  }
  return true;
}
