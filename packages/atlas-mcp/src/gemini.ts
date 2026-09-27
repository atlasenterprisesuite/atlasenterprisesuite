export type GeminiConnectionState =
  | 'configuration_missing'
  | 'runtime_not_ready'
  | 'ready_for_authorization';

export interface GeminiConnectedAppDescriptor {
  provider: 'gemini';
  name: 'ATLAS';
  transport: 'streamable-http';
  mcpUrl: string | null;
  authentication: {
    mode: 'bearer';
    dynamicClientRegistration: false;
    configured: boolean;
  };
  connection: {
    state: GeminiConnectionState;
    connected: false;
    verified: false;
  };
}

export function buildGeminiConnectedAppDescriptor(input: {
  publicBaseUrl?: string;
  tokenConfigured: boolean;
  runtimeReady: boolean;
}): GeminiConnectedAppDescriptor {
  const raw = String(input.publicBaseUrl || '').trim().replace(/\/+$/, '');
  const validUrl = raw.startsWith('https://') ? raw : '';

  let state: GeminiConnectionState = 'ready_for_authorization';
  if (!validUrl || !input.tokenConfigured) state = 'configuration_missing';
  else if (!input.runtimeReady) state = 'runtime_not_ready';

  return {
    provider: 'gemini',
    name: 'ATLAS',
    transport: 'streamable-http',
    mcpUrl: validUrl ? `${validUrl}/mcp` : null,
    authentication: {
      mode: 'bearer',
      dynamicClientRegistration: false,
      configured: Boolean(input.tokenConfigured),
    },
    connection: {
      state,
      connected: false,
      verified: false,
    },
  };
}
