import { describe, expect, it } from 'vitest';
import { buildSovereignBrainInstructions } from '../../supabase/functions/atlas-copilot/sovereign-brain-prompt.mjs';
import { createAtlasLocalResponsesAdapter } from '../../supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs';

describe('assistant conversation policy', () => {
  it('retains language, greeting and workspace context in the bounded local request', async () => {
    let payload: any;
    const adapter = createAtlasLocalResponsesAdapter({
      baseUrl: 'https://local.example', token: 'test', models: { balanced: 'local-model' },
      fetchFn: async (_url: string, options: any) => {
        payload = JSON.parse(options.body);
        return new Response(JSON.stringify({ output_text: 'Hola' }), { status: 200 });
      }
    });
    await adapter.execute({ route: { profile: 'balanced' }, instructions: buildSovereignBrainInstructions({ module: 'atlas.home' }), input: [{ role: 'user', content: 'Hola' }] });
    expect(payload.instructions).toContain("Reply in the user's language");
    expect(payload.instructions).toContain('For a greeting');
    expect(payload.instructions).toContain('Accounting');
    expect(payload.instructions).toContain('Module: atlas.home');
    expect(payload.instructions.length).toBeLessThanOrEqual(2600);
    expect(payload.input.at(-1).content).toBe('Hola');
  });
});
