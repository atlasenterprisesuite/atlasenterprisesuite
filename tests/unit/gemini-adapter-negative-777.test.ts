import { describe, expect, it, vi } from 'vitest';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';

const route = { profile: 'balanced', capabilities: ['generation'] };
const input = [{ role: 'user', content: 'hello' }];
const adapterWith = (fetchFn: any) => createGeminiAdapter({ apiKey: 'test-only', models: { balanced: 'test-model' }, fetchFn });

describe('Gemini fail-closed negative contract', () => {
  it('rejects missing configuration without network access', async () => {
    const fetchFn = vi.fn();
    await expect(createGeminiAdapter({ models: { balanced: 'test-model' }, fetchFn }).execute({ route, input }))
      .rejects.toMatchObject({ code: 'provider_not_configured' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 429, 500])('normalizes HTTP %i without leaking response bodies', async status => {
    const fetchFn = vi.fn(async () => new Response('sensitive provider details', { status }));
    await expect(adapterWith(fetchFn).execute({ route, input })).rejects.toMatchObject({
      code: status === 401 || status === 403 ? 'provider_auth_failed' : status === 404 ? 'provider_not_configured' : status === 429 ? 'provider_rate_limited' : 'provider_unavailable'
    });
  });
  it('fails closed on blocked candidate despite text', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'unsafe' }] } }] }), { status: 200 }));
    await expect(adapterWith(fetchFn).execute({ route, input })).rejects.toMatchObject({ code: 'provider_response_blocked' });
  });
  it('rejects invalid token budgets before network access', async () => {
    const fetchFn = vi.fn();
    await expect(adapterWith(fetchFn).execute({ route, input, max_output_tokens: -10 })).rejects.toMatchObject({ code: 'invalid_input' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON as unavailable output', async () => {
    const fetchFn = vi.fn(async () => new Response('{bad', { status: 200 }));
    await expect(adapterWith(fetchFn).execute({ route, input })).rejects.toMatchObject({ code: 'provider_invalid_response' });
  });
  it('does not execute provider tool calls', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: 'delete' } }] } }] }), { status: 200 }));
    await expect(adapterWith(fetchFn).execute({ route, input })).rejects.toMatchObject({ code: 'provider_invalid_response' });
  });
});
