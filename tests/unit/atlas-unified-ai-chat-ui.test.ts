import { describe, expect, it } from 'vitest';
import { renderAtlasCopilotPage } from '../../supabase/functions/atlas-copilot/ui.mjs';

describe('ATLAS Unified AI Chat UI', () => {
  const html = renderAtlasCopilotPage({
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'publishable',
    selfPath: '/functions/v1/atlas-copilot',
    livePath: '/functions/v1/atlas-live',
    repairPath: '/functions/v1/atlas-repair-bridge',
    version: 5,
  });

  it('offers all unified routing modes and reasoning profiles', () => {
    for (const value of ['auto', 'openai', 'gemini', 'codex-sovereign', 'council']) {
      expect(html).toContain(`value="${value}"`);
    }
    for (const value of ['fast', 'balanced', 'deep']) expect(html).toContain(`value="${value}"`);
  });

  it('submits the selected mode with each chat request', () => {
    expect(html).toContain("mode=$('mode').value");
    expect(html).toContain('mode,capabilities_requested');
  });

  it('provides ChatGPT only as an external optional link', () => {
    expect(html).toContain('https://chatgpt.com');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('does not advertise the fictional GPT-6 Astra identifier', () => {
    expect(html).not.toContain('GPT-6 Astra');
    expect(html).not.toContain('gpt-6-astra');
  });
});
