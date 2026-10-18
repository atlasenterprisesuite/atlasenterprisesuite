/** ATLAS Local Core Wave 1: loopback-only inference, no implicit cloud fallback. */
export const MAX_PROMPT_CHARS = 16_000;
const MAX_RESPONSE_BYTES = 128 * 1024;

export function localInferenceEndpoint(value = 'http://127.0.0.1:8080') {
  let url;
  try { url = new URL(value); } catch { throw new Error('local_core_invalid_endpoint'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(host) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port === '0') {
    throw new Error('local_core_loopback_only');
  }
  return new URL('/v1/chat/completions', url);
}

async function readBoundedJson(response) {
  if (!response.body) throw new Error('local_core_empty_response');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw new Error('local_core_response_too_large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { throw new Error('local_core_invalid_response'); }
}

export async function generateLocalCompletion({ prompt, endpoint, token, model = 'atlas-local-default', fetchImpl = fetch }) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    throw new Error('local_core_invalid_prompt');
  }
  if (typeof token !== 'string' || !token.trim()) throw new Error('local_core_token_required');
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._:/-]{1,120}$/.test(model)) {
    throw new Error('local_core_invalid_model');
  }
  const url = localInferenceEndpoint(endpoint);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: 512 }),
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(60_000)
    });
  } catch { throw new Error('local_core_runtime_unreachable'); }
  if (!response.ok) throw new Error(`local_core_http_${response.status}`);
  const data = await readBoundedJson(response);
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('local_core_invalid_response');
  return answer;
}
