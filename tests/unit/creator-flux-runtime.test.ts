import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtimePath = 'services/creator-flux/app.py';

describe('ATLAS self-hosted FLUX runtime', () => {
  it('provides authenticated health and generation endpoints for FLUX Schnell', () => {
    expect(existsSync(runtimePath)).toBe(true);
    if (!existsSync(runtimePath)) return;
    const source = readFileSync(runtimePath, 'utf8');
    expect(source).toContain('black-forest-labs/FLUX.1-schnell');
    expect(source).toContain('ATLAS_FLUX_RUNTIME_TOKEN');
    expect(source).toContain('x_atlas_runtime_token');
    expect(source).toContain('@app.get("/health")');
    expect(source).toContain('@app.post("/generate")');
    expect(source).toContain('resource-blocked');
  });

  it('does not require a paid generation API key', () => {
    if (!existsSync(runtimePath)) return;
    const source = readFileSync(runtimePath, 'utf8');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('GOOGLE_API_KEY');
    expect(source).not.toContain('SUNO_API_KEY');
  });
});
