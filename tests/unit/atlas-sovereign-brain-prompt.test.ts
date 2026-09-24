import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const promptPath = 'supabase/functions/atlas-copilot/sovereign-brain-prompt.mjs';
const gatewaySource = readFileSync('supabase/functions/atlas-copilot/intelligence-gateway.mjs', 'utf8');

describe('ATLAS Sovereign Brain runtime prompt', () => {
  it('ships one canonical ATLAS brain prompt with the approved cognitive architecture', () => {
    expect(existsSync(promptPath)).toBe(true);
    const source = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : '';

    expect(source).toContain('ATLAS_SOVEREIGN_BRAIN_PROMPT_V1');
    expect(source).toContain('You are ATLAS.');
    expect(source).toContain('PREFRONTAL CORTEX');
    expect(source).toContain('HIPPOCAMPUS');
    expect(source).toContain('THALAMUS');
    expect(source).toContain('CEREBELLUM');
    expect(source).toContain('MOTOR CORTEX');
    expect(source).toContain('BRAINSTEM');
    expect(source).toContain('Internal plurality. External unity.');
    expect(source).toContain('UNDERSTAND → REASON → VERIFY → DECIDE → EXECUTE → LEARN');
  });

  it('uses the canonical brain prompt for every provider route instead of a provider-specific identity', () => {
    expect(gatewaySource).toContain("from './sovereign-brain-prompt.mjs'");
    expect(gatewaySource).toContain('buildSovereignBrainInstructions');
    expect(gatewaySource).not.toContain("const instructions='You are ATLAS Assistant.");
  });
});
