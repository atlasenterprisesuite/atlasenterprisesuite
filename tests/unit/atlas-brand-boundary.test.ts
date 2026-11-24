import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS brand boundary', () => {
  it('keeps upstream voice branding out of the primary Voice Studio experience', () => {
    const narration = source('apps/web/src/modules/voice/ElevenLabsNarration.tsx');
    const studio = source('apps/web/src/modules/voice/VoiceStudioPage.tsx');
    const personal = source('apps/web/src/modules/voice/PersonalVoiceWizard.tsx');

    expect(narration).toContain('ATLAS Voice · Origin');
    expect(narration).not.toContain('>George<');
    expect(narration).not.toContain('· ElevenLabs');
    expect(narration).not.toContain('sent to ElevenLabs');
    expect(studio).not.toContain('ElevenLabs narration uses');
    expect(personal).not.toContain('OpenAI Custom Voice todavía');
  });

  it('aliases upstream intelligence routes in customer-facing AI surfaces', () => {
    const chat = source('apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx');
    const universe = source('apps/web/src/modules/creator/AIUniversePage.tsx');
    const standalone = source('supabase/functions/atlas-copilot/ui.mjs');
    const council = source('supabase/functions/atlas-copilot/council-orchestrator.mjs');

    for (const forbidden of [
      "label: 'OpenAI'",
      "label: 'Gemini'",
      "label: 'Claude / Anthropic'",
      "label: 'Grok / xAI'",
      "label: 'DeepSeek'",
      "label: 'Mistral'",
      "label: 'Qwen'"
    ]) expect(chat).not.toContain(forbidden);

    expect(chat).toContain('ATLAS Engine 01');
    expect(chat).toContain('ATLAS Council');
    expect(universe).not.toContain('<h3>{entry.displayName}</h3>');
    expect(universe).not.toContain('Model: ${entry.model}');
    expect(standalone).not.toContain('>ChatGPT / OpenAI<');
    expect(standalone).not.toContain('>Gemini<');
    expect(standalone).not.toContain('>Claude / Anthropic<');
    expect(council).not.toContain("openai:'OpenAI'");
    expect(council).toContain("openai:'ATLAS Engine 01'");
  });

  it('keeps infrastructure vendors out of general-purpose end-user footers', () => {
    const chat = source('apps/web/src/modules/connect/AtlasChatPage.tsx');
    expect(chat).not.toContain('Durable source of truth: Supabase');
    expect(chat).not.toContain('Cloudflare Durable Objects');
  });
});
