import { describe, expect, it } from 'vitest';
import { compilePromptExport, PROMPT_EXPORT_ENGINE } from '../../packages/creator/prompt_engine';

describe('ATLAS Prompt Export', () => {
  it('is always a planning engine and never claims generated media', () => {
    expect(PROMPT_EXPORT_ENGINE.engineId).toBe('prompt-export');
    expect(PROMPT_EXPORT_ENGINE.executionClass).toBe('prompt-export-only');
    expect(PROMPT_EXPORT_ENGINE.ready).toBe(true);
    expect(PROMPT_EXPORT_ENGINE.capabilityNotes).toContain('no-media-generation');
  });

  it('compiles the same request deterministically', () => {
    const request = {
      mediaKind: 'image' as const,
      brief: 'ATLAS payroll dashboard on a clean futuristic workstation',
      aspectRatio: '16:9',
      destination: 'web hero',
      language: 'English'
    };
    expect(compilePromptExport(request)).toEqual(compilePromptExport(request));
  });

  it('returns prompt artifacts but no asset or generation job identifiers', () => {
    const result = compilePromptExport({
      mediaKind: 'voice',
      brief: 'Professional ATLAS onboarding narration',
      language: 'English'
    });
    expect(result.status).toBe('prompt-ready');
    expect(result.engineId).toBe('prompt-export');
    expect(result.prompt.length).toBeGreaterThan(20);
    expect('assetId' in result).toBe(false);
    expect('generationJobId' in result).toBe(false);
  });

  it('rejects a brief shorter than eight characters', () => {
    expect(() => compilePromptExport({ mediaKind: 'image', brief: 'short' })).toThrow('creative_brief_too_short');
  });
});
