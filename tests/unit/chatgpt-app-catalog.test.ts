import { describe, expect, it } from 'vitest';
import { ATLAS_CHATGPT_APPS, listAtlasChatGptApps, listAtlasChatGptReadOnlyTools } from '../../packages/atlas-mcp/src/chatgptAppCatalog';

describe('ChatGPT apps catalog: fail closed', () => {
  it('contains 29 distinct app identities', () => {
    expect(ATLAS_CHATGPT_APPS).toHaveLength(29);
    expect(new Set(ATLAS_CHATGPT_APPS.map(([id]) => id)).size).toBe(29);
  });
  it('does not claim any app is installed or connected', () => {
    expect(listAtlasChatGptApps().every(app => app.status === 'not_connected')).toBe(true);
  });
  it('advertises only non-destructive read-only tools', () => {
    const tools = listAtlasChatGptReadOnlyTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
      expect(tool.annotations.openWorldHint).toBe(false);
      expect(tool.name).not.toMatch(/create|update|delete|deploy|write|execute|run/i);
    }
  });
  it('does not expose bearer tokens or user credentials', () => {
    expect(JSON.stringify(listAtlasChatGptApps())).not.toMatch(/bearer|secret|access_token|api_key/i);
  });
});
