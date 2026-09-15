import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const page = source('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx');
const api = source('apps/web/src/modules/intelligence/intelligenceApi.ts');

describe('ATLAS Unified AI Chat UI', () => {
  it('offers all unified routing modes and reasoning profiles', () => {
    for (const value of ['auto', 'openai', 'gemini', 'codex-sovereign', 'council']) {
      expect(page).toContain(`value: '${value}'`);
    }
    for (const value of ['fast', 'balanced', 'deep']) expect(page).toContain(`value: '${value}'`);
  });

  it('submits the selected mode and profile with each chat request', () => {
    expect(page).toContain('sendIntelligenceMessage({ message, conversationId, mode, profile })');
    expect(api).toContain('mode: input.mode');
    expect(api).toContain('intent: input.profile');
  });

  it('provides ChatGPT only as an external optional link', () => {
    expect(page).toContain('https://chatgpt.com');
    expect(page).toContain('target="_blank"');
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain('not the ChatGPT website');
  });

  it('does not advertise the fictional GPT-6 Astra identifier', () => {
    expect(page).not.toContain('GPT-6 Astra');
    expect(page).not.toContain('gpt-6-astra');
    expect(api).not.toContain('GPT-6 Astra');
    expect(api).not.toContain('gpt-6-astra');
  });
});
