export type WhatsAppProviderConfig = {
  provider: 'peach';
  mcpEndpoint: string;
};

export type WhatsAppProviderAdapter = {
  readonly provider: 'peach';
  readonly mcpEndpoint: string;
};

export function createPeachProviderConfig(
  env: Record<string, string | undefined>,
): WhatsAppProviderConfig {
  const mcpEndpoint = env.ATLAS_PEACH_MCP_URL;

  if (!mcpEndpoint) {
    throw new Error('ATLAS_PEACH_MCP_URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(mcpEndpoint);
  } catch {
    throw new Error('ATLAS_PEACH_MCP_URL must be a valid HTTPS URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('ATLAS_PEACH_MCP_URL must use HTTPS');
  }

  return {
    provider: 'peach',
    mcpEndpoint: parsed.toString().replace(/\/$/, ''),
  };
}
