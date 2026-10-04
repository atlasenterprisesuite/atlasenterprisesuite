import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Image Lab live OpenAI adapter', () => {
  it('uses the current precision image-edit model through the server-only Images API', () => {
    const source = readFileSync('supabase/functions/atlas-creator/_shared/openai_image.ts', 'utf8');
    expect(source).toContain("Deno.env.get('OPENAI_API_KEY')");
    expect(source).toContain("'gpt-image-2.5-sunburst'");
    expect(source).toContain('/images/edits');
    expect(source).toContain('openAiImageEngineReadiness');
    expect(source).toContain('executeOpenAiImageEdit');
    expect(source).not.toContain('OPENAI_API_KEY=');
  });

  it('persists a production, generation job, output asset and private storage object before success', () => {
    const source = readFileSync('supabase/functions/atlas-creator/_shared/openai_image.ts', 'utf8');
    expect(source).toContain("from('creator_productions').insert");
    expect(source).toContain("from('creator_generation_jobs').insert");
    expect(source).toContain("storage.from(ASSET_BUCKET).upload");
    expect(source).toContain("from('creator_assets').insert");
    expect(source).toContain('createSignedUrl');
  });

  it('exposes a dedicated authenticated edge route for verified readiness and edits', () => {
    const source = readFileSync('supabase/functions/atlas-image-edit/index.ts', 'utf8');
    expect(source).toContain("creator.read");
    expect(source).toContain("creator.generate");
    expect(source).toContain('openAiImageEngineReadiness');
    expect(source).toContain('executeOpenAiImageEdit');
    expect(source).toContain("api === 'readiness'");
    expect(source).toContain("api === 'edit'");
  });

  it('uses the dedicated image endpoint from the browser without exposing provider secrets', () => {
    const source = readFileSync('apps/web/src/modules/creator/image/imageLabApi.ts', 'utf8');
    expect(source).toContain('/functions/v1/atlas-image-edit');
    expect(source).toContain('getImageEditReadiness');
    expect(source).toContain('submitImageEdit');
    expect(source).not.toContain('OPENAI_API_KEY');
  });

  it('renders a persisted generated design when the backend returns a signed URL', () => {
    const source = readFileSync('apps/web/src/modules/creator/image/ImageLabWorkspace.tsx', 'utf8');
    expect(source).toContain('generatedUrl');
    expect(source).toContain('Generated design');
    expect(source).toContain('signed_url');
  });
});
