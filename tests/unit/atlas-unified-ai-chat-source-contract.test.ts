import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync('supabase/functions/atlas-copilot/index.ts', 'utf8');
const openaiSource = readFileSync('supabase/functions/atlas-copilot/openai-responses-adapter.mjs', 'utf8');

describe('ATLAS Unified AI source configuration contract', () => {
  it('never ships a fictional GPT-6 Astra model default', () => {
    expect(indexSource).not.toContain("||'gpt-6-astra'");
    expect(indexSource).not.toContain('GPT-6 Astra');
    expect(openaiSource).not.toContain("DEFAULT_MODEL='gpt-6-astra'");
  });

  it('constructs all three provider adapters through the registry', () => {
    expect(indexSource).toContain('createOpenAIResponsesAdapter');
    expect(indexSource).toContain('createGeminiAdapter');
    expect(indexSource).toContain('createCodexSovereignAdapter');
    expect(indexSource).toContain('createProviderRegistry');
  });

  it('uses explicit server configuration for provider targets', () => {
    expect(indexSource).toContain("Deno.env.get('ATLAS_OPENAI_MODEL')");
    expect(indexSource).toContain("Deno.env.get('ATLAS_GEMINI_MODEL')");
    expect(indexSource).toContain("Deno.env.get('ATLAS_CODEX_SOVEREIGN_URL')");
  });
});
