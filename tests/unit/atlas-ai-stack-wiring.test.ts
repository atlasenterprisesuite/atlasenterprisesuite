import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('ATLAS AI stack runtime wiring', () => {
  it('wires Anthropic into atlas-copilot runtime and readiness', () => {
    const source = read('supabase/functions/atlas-copilot/index.ts');
    expect(source).toContain("from './anthropic-messages-adapter.mjs'");
    expect(source).toContain("Deno.env.get('ANTHROPIC_API_KEY')");
    expect(source).toContain("createAnthropicMessagesAdapter({apiKey:rt.anthropicKey");
    expect(source).toContain("'anthropic'");
    expect(source).toContain("modes:['auto','atlas-local','openai','anthropic','bedrock','gemini','codex-sovereign','council']");
  });

  it('wires a separately governed computer-use endpoint', () => {
    const source = read('supabase/functions/atlas-copilot/index.ts');
    expect(source).toContain("from './openai-agent-runtime.mjs'");
    expect(source).toContain("api==='computer-use'");
    expect(source).toContain("handleComputerUse(req)");
    expect(source).toContain("cost_approval_required");
    expect(source).toContain("required_actions");
  });

  it('exposes Anthropic in authenticated Assistant types and selector', () => {
    const client = read('apps/web/src/assistant/client.ts');
    const page = read('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx');
    const fallback = read('supabase/functions/atlas-copilot/ui.mjs');
    expect(client).toContain("| 'anthropic'");
    expect(page).toContain("{ value: 'anthropic', label: 'Claude / Anthropic', short: 'Anthropic' }");
    expect(fallback).toContain('<option value="anthropic">Anthropic</option>');
  });
});
