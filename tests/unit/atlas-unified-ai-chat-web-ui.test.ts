import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const pagePath = 'apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx';
const apiPath = 'apps/web/src/modules/intelligence/intelligenceApi.ts';

describe('ATLAS Unified AI Chat web surface', () => {
  it('registers /assistant inside the authenticated ATLAS shell', () => {
    const resolver = source('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const shell = source('apps/web/src/components/AtlasShell.tsx');
    expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true);
    expect(resolver).toContain("../modules/intelligence/UnifiedAIChatPage");
    expect(resolver).toContain("pathname === '/assistant'");
    expect(resolver).toContain('RequireAtlasIdentity');
    expect(shell).toContain("{ to: '/assistant', label: 'Assistant' }");
  });

  it('implements provider modes, profiles, history, send and truthful readiness', () => {
    expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), apiPath))).toBe(true);
    if (!existsSync(resolve(process.cwd(), pagePath)) || !existsSync(resolve(process.cwd(), apiPath))) return;
    const page = source(pagePath);
    const api = source(apiPath);
    for (const mode of ['auto', 'openai', 'gemini', 'codex-sovereign', 'council']) expect(page).toContain(`value: '${mode}'`);
    for (const profile of ['fast', 'balanced', 'deep']) expect(page).toContain(`value: '${profile}'`);
    expect(page).toContain('loadIntelligenceStatus');
    expect(page).toContain('listIntelligenceConversations');
    expect(page).toContain('getIntelligenceConversation');
    expect(page).toContain('sendIntelligenceMessage');
    expect(page).toContain('https://chatgpt.com');
    expect(api).toContain('authorizedAtlasFetch');
    expect(api).toContain('/functions/v1/atlas-copilot?api=status');
    expect(api).toContain('/functions/v1/atlas-copilot?api=history');
    expect(api).toContain('/functions/v1/atlas-copilot?api=conversation');
    expect(api).toContain('/functions/v1/atlas-copilot?api=chat');
  });

  it('keeps the Supabase function API-only on the shared domain', () => {
    const index = source('supabase/functions/atlas-copilot/index.ts');
    expect(index).not.toContain('renderAtlasCopilotPage');
    expect(index).not.toContain("from './ui.mjs'");
    expect(index).toContain("frontend_path:'/assistant'");
    expect(index).toContain("api:'unified-provider-router'");
  });
});
