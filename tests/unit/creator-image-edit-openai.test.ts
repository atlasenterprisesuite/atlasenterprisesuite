import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Image Lab live OpenAI adapter', () => {
  it('uses the current precision image-edit model through the server-only Images API', () => {
    const source = readFileSync('supabase/functions/atlas-creator/_shared/openai_image.ts', 'utf8');
    expect(source).toContain("Deno.env.get('OPENAI_API_KEY')");
    expect(source).toContain("'gpt-image-2.5-sunburst'");
    expect(source).toContain('/v1/images/edits');
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

  it('wires verified readiness and removes the permanent adapter-not-configured terminal state', () => {
    const source = readFileSync('supabase/functions/atlas-creator/index.ts', 'utf8');
    expect(source).toContain('openAiImageEngineReadiness');
    expect(source).toContain('executeOpenAiImageEdit');
    expect(source).not.toContain("throw creatorError('image_engine_adapter_not_configured', 503)");
  });

  it('renders a persisted generated design when the backend returns a signed URL', () => {
    const source = readFileSync('apps/web/src/modules/creator/image/ImageLabWorkspace.tsx', 'utf8');
    expect(source).toContain('generatedUrl');
    expect(source).toContain('Generated design');
    expect(source).toContain('signed_url');
  });
});
