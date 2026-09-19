import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS Assistant workspace', () => {
  it('registers an authenticated /assistant route in the canonical module registry', () => {
    const resolver = source('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const registry = source('apps/web/src/modules/registry.ts');
    expect(existsSync(resolve(process.cwd(), 'apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx'))).toBe(true);
    expect(resolver).toContain("pathname === '/assistant'");
    expect(resolver).toContain('UnifiedAIChatPage');
    expect(resolver).toContain('RequireAtlasIdentity');
    expect(registry).toContain("id: 'assistant'");
    expect(registry).toContain("route: '/assistant'");
  });

  it('shares the governed assistant client for status, history, conversation and chat', () => {
    const page = source('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx');
    const client = source('apps/web/src/assistant/client.ts');
    for (const mode of ['auto', 'atlas-local', 'atlas-sovereign-free', 'openai', 'bedrock', 'gemini', 'codex-sovereign', 'council']) {
      expect(page).toContain(`value: '${mode}'`);
    }
    for (const profile of ['fast', 'balanced', 'deep']) {
      expect(page).toContain(`value: '${profile}'`);
    }
    expect(page).toContain('getAssistantStatus');
    expect(page).toContain('listAssistantConversations');
    expect(page).toContain('getAssistantConversation');
    expect(page).toContain('sendAssistantWorkspaceMessage');
    expect(client).toContain('/functions/v1/atlas-copilot?api=status');
    expect(client).toContain('/functions/v1/atlas-copilot?api=history');
    expect(client).toContain('/functions/v1/atlas-copilot?api=conversation');
    expect(client).toContain('/functions/v1/atlas-copilot?api=chat');
    expect(client).toContain("surface: 'atlas-assistant-workspace'");
  });

  it('maps the dedicated workspace to the assistant module context', () => {
    const routeContext = source('apps/web/src/assistant/routeContext.ts');
    expect(routeContext).toContain("pathname.startsWith('/assistant')");
    expect(routeContext).toContain("return 'assistant'");
  });
});
