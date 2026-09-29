import { describe, expect, it } from 'vitest';
import { createPeachProviderConfig } from '../../packages/core/src/whatsapp-provider';

describe('ATLAS WhatsApp provider configuration', () => {
  it('loads the Peach MCP endpoint from configuration', () => {
    const config = createPeachProviderConfig({
      ATLAS_PEACH_MCP_URL: 'https://app.trypeach.io/api/mcp',
    });

    expect(config.provider).toBe('peach');
    expect(config.mcpEndpoint).toBe('https://app.trypeach.io/api/mcp');
  });

  it('rejects a missing MCP endpoint', () => {
    expect(() => createPeachProviderConfig({})).toThrow(/ATLAS_PEACH_MCP_URL/i);
  });

  it('rejects a non-HTTPS MCP endpoint', () => {
    expect(() =>
      createPeachProviderConfig({
        ATLAS_PEACH_MCP_URL: 'http://app.trypeach.io/api/mcp',
      }),
    ).toThrow(/HTTPS/i);
  });
});
