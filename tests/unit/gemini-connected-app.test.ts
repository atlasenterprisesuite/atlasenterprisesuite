import { describe, expect, it } from 'vitest';
import { buildGeminiConnectedAppDescriptor } from '../../packages/atlas-mcp/src/gemini';

describe('Gemini Connected App descriptor', () => {
  it('fails closed when public HTTPS or the Gemini credential is missing', () => {
    expect(buildGeminiConnectedAppDescriptor({
      publicBaseUrl: 'http://localhost:8788',
      tokenConfigured: true,
      runtimeReady: true,
    }).connection.state).toBe('configuration_missing');

    expect(buildGeminiConnectedAppDescriptor({
      publicBaseUrl: 'https://atlas.example.com',
      tokenConfigured: false,
      runtimeReady: true,
    }).connection.state).toBe('configuration_missing');
  });

  it('does not claim a connection when runtime readiness is unavailable', () => {
    const result = buildGeminiConnectedAppDescriptor({
      publicBaseUrl: 'https://atlas.example.com/',
      tokenConfigured: true,
      runtimeReady: false,
    });

    expect(result.mcpUrl).toBe('https://atlas.example.com/mcp');
    expect(result.connection).toEqual({
      state: 'runtime_not_ready',
      connected: false,
      verified: false,
    });
  });

  it('becomes ready for Google authorization without exposing credentials', () => {
    const result = buildGeminiConnectedAppDescriptor({
      publicBaseUrl: 'https://atlas.example.com',
      tokenConfigured: true,
      runtimeReady: true,
    });

    expect(result).toEqual({
      provider: 'gemini',
      name: 'ATLAS',
      transport: 'streamable-http',
      mcpUrl: 'https://atlas.example.com/mcp',
      authentication: {
        mode: 'bearer',
        dynamicClientRegistration: false,
        configured: true,
      },
      connection: {
        state: 'ready_for_authorization',
        connected: false,
        verified: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('token');
  });
});
