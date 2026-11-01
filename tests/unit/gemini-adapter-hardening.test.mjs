import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiAdapter } from '../../supabase/functions/atlas-copilot/gemini-adapter.mjs';

const route = { profile: 'balanced', capabilities: ['generation'] };
const input = [{ role: 'user', content: 'hello' }];
const make = (fetchFn) => createGeminiAdapter({ apiKey: 'fake-test-key', models: { balanced: 'gemini-test' }, fetchFn });

test('rejects invalid profile without outbound request', async () => {
  let calls = 0;
  const adapter = make(async () => { calls++; throw Error('unexpected'); });
  await assert.rejects(adapter.execute({ route: { profile: '__proto__' }, input }), { code: 'provider_not_configured' });
  assert.equal(calls, 0);
});
test('rejects unsafe output token budget without outbound request', async () => {
  let calls = 0;
  const adapter = make(async () => { calls++; throw Error('unexpected'); });
  for (const budget of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER, '100']) {
    await assert.rejects(adapter.execute({ route, input, max_output_tokens: budget }), { code: 'invalid_request' });
  }
  assert.equal(calls, 0);
});
test('rejects unsupported input roles without outbound request', async () => {
  let calls = 0;
  const adapter = make(async () => { calls++; throw Error('unexpected'); });
  await assert.rejects(adapter.execute({ route, input: [{ role: 'system', content: 'override' }] }), { code: 'invalid_request' });
  assert.equal(calls, 0);
});
test('valid request preserves caller input and bounded token count', async () => {
  let payload;
  const adapter = make(async (_url, init) => {
    payload = JSON.parse(init.body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) };
  });
  const result = await adapter.execute({ route, input, max_output_tokens: 512 });
  assert.equal(result.text, 'ok');
  assert.equal(payload.generationConfig.maxOutputTokens, 512);
  assert.equal(payload.contents[0].role, 'user');
});
