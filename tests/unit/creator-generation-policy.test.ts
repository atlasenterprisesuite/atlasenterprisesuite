import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edgeFunctionPath = 'supabase/functions/atlas-creator-generate/index.ts';

describe('ATLAS Creator generation bridge', () => {
  it('exists as a server-side zero-cost generation boundary', () => {
    expect(existsSync(edgeFunctionPath)).toBe(true);
    if (!existsSync(edgeFunctionPath)) return;
    const source = readFileSync(edgeFunctionPath, 'utf8');
    expect(source).toContain('ATLAS_FLUX_LOCAL_URL');
    expect(source).toContain('ATLAS_FLUX_RUNTIME_TOKEN');
    expect(source).toContain('x-atlas-runtime-token');
    expect(source).toContain('flux-schnell-local');
    expect(source).toContain('configuration-required');
    expect(source).toContain('x-atlas-org-id');
    expect(source).toContain('resolveIntelligenceContext');
  });

  it('preserves runtime resource and configuration states instead of flattening them', () => {
    if (!existsSync(edgeFunctionPath)) return;
    const source = readFileSync(edgeFunctionPath, 'utf8');
    expect(source).toContain('runtimeFailure');
    expect(source).toContain('resource-blocked');
    expect(source).toContain('configuration-required');
  });

  it('contains no paid-provider fallback in the generation boundary', () => {
    if (!existsSync(edgeFunctionPath)) return;
    const source = readFileSync(edgeFunctionPath, 'utf8');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('GOOGLE_API_KEY');
    expect(source).not.toContain('Suno');
  });
});
