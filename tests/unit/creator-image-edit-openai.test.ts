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

  it('keeps the adapter self-contained instead of importing the full Creator repository graph', () => {
    const source = readFileSync('supabase/functions/atlas-creator/_shared/openai_image.ts', 'utf8');
    expect(source).not.toContain("from './repository.ts'");
    expect(source).toContain("from('audit_logs').insert");
  });

  it('reuses the existing authenticated atlas-creator edge function for readiness and edits', () => {
    const source = readFileSync('supabase/functions/atlas-creator/index.ts', 'utf8');
    expect(source).toContain('openAiImageEngineReadiness');
    expect(source).toContain('executeOpenAiImageEdit');
    expect(source).toContain("api === 'image-edit-readiness'");
    expect(source).toContain("api === 'image-edit'");
    expect(source).not.toContain('image_engine_adapter_not_configured');
  });

  it('uses atlas-creator from the browser without exposing provider secrets', () => {
    const source = readFileSync('apps/web/src/modules/creator/image/imageLabApi.ts', 'utf8');
    expect(source).toContain('/functions/v1/atlas-creator');
    expect(source).toContain('image-edit-readiness');
    expect(source).toContain('image-edit');
    expect(source).not.toContain('/functions/v1/atlas-image-edit');
    expect(source).not.toContain('OPENAI_API_KEY');
  });

  it('does not reserve an extra Supabase Edge Function slot for Image Lab', () => {
    const config = readFileSync('supabase/config.toml', 'utf8');
    expect(config).not.toContain('[functions.atlas-image-edit]');
  });

  it('renders a persisted generated design when the backend returns a signed URL', () => {
    const source = readFileSync('apps/web/src/modules/creator/image/ImageLabWorkspace.tsx', 'utf8');
    expect(source).toContain('generatedUrl');
    expect(source).toContain('Generated design');
    expect(source).toContain('signed_url');
  });
});
