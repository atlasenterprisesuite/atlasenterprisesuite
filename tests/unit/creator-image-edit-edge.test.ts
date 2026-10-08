import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Image Lab edge contract', () => {
  it('routes image edits through creator.generate and fails closed unless the verified image engine is ready', () => {
    const source = readFileSync('supabase/functions/atlas-creator/index.ts', 'utf8');
    expect(source).toContain("api === 'image-edit-readiness'");
    expect(source).toContain("api === 'image-edit'");
    expect(source).toContain("creator.generate");
    expect(source).toContain("image_engine_not_ready");
    expect(source).toContain("creator.image.edit.requested");
    expect(source).toContain('let imageEditRequestRaw: unknown');
    expect(source).toContain('openAiImageEngineReadiness');
    expect(source).toContain('executeOpenAiImageEdit');
    expect(source).not.toContain('image_engine_adapter_not_configured');
  });

  it('exposes a typed multipart client wrapper for image edits', () => {
    const source = readFileSync('apps/web/src/lib/creatorApi.ts', 'utf8');
    expect(source).toContain('export async function submitImageEdit');
    expect(source).toContain("creatorRequest<");
    expect(source).toContain("'image-edit'");
    expect(source).toContain('FormData');
  });
});
