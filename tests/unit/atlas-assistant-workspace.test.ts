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
    for (const mode of ['auto', 'atlas-local', 'openai', 'bedrock', 'gemini', 'codex-sovereign', 'council']) {
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
    expect(page).toContain("status?.local_runtime?.state === 'verified'");
    expect(page).toContain("localProvider?.verified === true");
  });

  it('exposes enterprise navigation using existing governed ATLAS routes', () => {
    const page = source('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx');
    for (const route of ['/work', '/automations', '/work/connections', '/work/team', '/work/policies', '/suite']) {
      expect(page).toContain(`to: '${route}'`);
    }
    expect(page).toContain('Search chats');
    expect(page).toContain('historyQuery');
    expect(page).toContain('PROMPT_STARTERS');
    expect(page).toContain("event.key === 'Enter'");
    expect(page).not.toContain('https://chatgpt.com');
  });

  it('maps the dedicated workspace to the assistant module context', () => {
    const routeContext = source('apps/web/src/assistant/routeContext.ts');
    expect(routeContext).toContain("pathname.startsWith('/assistant')");
    expect(routeContext).toContain("return 'assistant'");
  });

  it('keeps the dedicated AI workspace focused, responsive and fully actionable', () => {
    const page = source('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx');
    const css = source('apps/web/src/modules/intelligence/UnifiedAIChat.css');

    expect(page).toContain('How can I help you?');
    expect(page).toContain('aria-controls="atlas-ai-status-panel"');
    expect(page).toContain('Open conversation sidebar');
    expect(page).toContain('atlas-ai-tools-menu');
    expect(page).toContain('Chat history');
    expect(page).toContain('Projects');
    expect(page).toContain('Prompts');
    expect(page).toContain('Translator');
    expect(page).toContain('useAssistantVoice');
    expect(page).toContain('toggleMicrophone');
    expect(page).toContain('ATLAS can make mistakes. Verify important information and governed actions.');
    expect(page).toContain("to=\"/work/connections\"");
    expect(page).toContain("to=\"/work\"");
    expect(page).toContain("to=\"/suite\"");
    expect(page).not.toContain('href="#"');
    expect(page).not.toContain('atlas-ai-provider-strip');
    expect(css).toContain('.atlas-ai-composer');
    expect(css).toContain('@media(max-width:760px)');
    expect(css).toContain('.atlas-ai-mobile-scrim');
    expect(css).toContain('.atlas-ai-mobile-menu-popover');
    expect(css).toContain('.atlas-ai-prompt-library');
    expect(css).toContain('.atlas-ai-mic');
  });

});
