import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateLocalCompletion, localInferenceEndpoint, MAX_PROMPT_CHARS } from '../lib/local-core-client.mjs';

const options = { prompt: 'Explain privacy', token: 'local-test-token', model: 'atlas-local-default' };

test('loopback only: rejects public/LAN URLs, URL tricks and paths', () => {
  for (const value of [
    'https://api.openai.com', 'http://192.168.1.20:8080', 'http://127.0.0.1.evil.com',
    'http://user:pass@127.0.0.1:8080', 'http://127.0.0.1:8080/x',
    'http://127.0.0.1:8080/?x=1', 'file:///etc/passwd', 'http://127.0.0.1:0'
  ]) assert.throws(() => localInferenceEndpoint(value));
  assert.equal(localInferenceEndpoint('http://127.0.0.1:8080').pathname, '/v1/chat/completions');
  assert.equal(localInferenceEndpoint('http://[::1]:8080').pathname, '/v1/chat/completions');
});

test('rejects missing token and oversized prompt without issuing a request', async () => {
  let calls = 0;
  const fetchImpl = () => { calls++; throw new Error('network_called'); };
  await assert.rejects(generateLocalCompletion({ ...options, token: '', fetchImpl }), /token_required/);
  await assert.rejects(generateLocalCompletion({ ...options, prompt: 'x'.repeat(MAX_PROMPT_CHARS + 1), fetchImpl }), /invalid_prompt/);
  assert.equal(calls, 0);
});

test('authenticates only a loopback server and returns a real model response', async (t) => {
  const server = createServer(async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, `Bearer ${options.token}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(payload.messages[0].content, options.prompt);
    assert.equal(payload.model, options.model);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'Generated on device' } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const answer = await generateLocalCompletion({ ...options, endpoint: `http://127.0.0.1:${address.port}` });
  assert.equal(answer, 'Generated on device');
});

test('never falls back to a cloud API and suppresses underlying error details', async () => {
  const secret = 'sensitive secret should not leak';
  await assert.rejects(
    generateLocalCompletion({ ...options, fetchImpl: async () => { throw new Error(secret); } }),
    (error) => error.message === 'local_core_runtime_unreachable' && !error.message.includes(secret)
  );
});

test('rejects unsuccessful HTTP, invalid shape, and excessive server responses', async () => {
  await assert.rejects(generateLocalCompletion({ ...options, fetchImpl: async () => new Response('fail', { status: 503 }) }), /local_core_http_503/);
  await assert.rejects(generateLocalCompletion({ ...options, fetchImpl: async () => Response.json({ choices: [] }) }), /local_core_invalid_response/);
  await assert.rejects(generateLocalCompletion({ ...options, fetchImpl: async () => new Response('z'.repeat(150_000)) }), /local_core_response_too_large/);
});
