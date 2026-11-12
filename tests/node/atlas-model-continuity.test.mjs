import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('../../apps/atlas-orchestrator/atlas-ts-loader.mjs', import.meta.url);
const { createIntelligenceGateway, createIntelligenceRouter, normalizeIntelligenceRequest } = await import('../../supabase/functions/atlas-copilot/intelligence-gateway.mjs');
const { createIntelligenceStore } = await import('../../supabase/functions/atlas-copilot/atlas-intelligence-store.mjs');
const { createToolGateway } = await import('../../supabase/functions/atlas-copilot/tool-gateway.mjs');
const { createBackgroundBrain } = await import('../../supabase/functions/atlas-copilot/background-brain.mjs');

const context = { organization_id: 'org-a', user_id: 'user-a', session_id: 'session', request_id: 'request', permissions: ['intelligence.use'] };
const readiness = ['atlas-local', 'gemini'].map(id => ({ id, configured: true, verified: true, capabilities: ['generation'], profiles: ['balanced'] }));
const failure = code => Object.assign(new Error(code), { code, status: code === 'permission_denied' ? 403 : 502 });

// Use the real store; only its external HTTP transport is replaced.
function harness({ offline = false, authorizeContext, denied = false } = {}) {
  const rows = new Map(); const transcripts = []; const calls = []; const requests = [];
  const store = createIntelligenceStore({ supabaseUrl: 'https://storage.test', serviceRoleKey: 'test-only', fetchFn: async (url, init = {}) => {
    const parsed = new URL(url); const name = parsed.pathname.split('/').at(-1); const query = parsed.searchParams;
    const body = init.body ? JSON.parse(init.body) : null;
    let result;
    if (name === 'atlas_ai_conversations' && init.method === 'POST') {
      const row = { ...body, id: 'conversation', created_at: '2026-11-11T00:00:00Z' }; rows.set(row.id, row); result = [row];
    } else if (name === 'atlas_ai_conversations') {
      result = [...rows.values()].filter(row => `eq.${row.org_id}` === query.get('org_id') && (!query.has('created_by') || `eq.${row.created_by}` === query.get('created_by')));
    } else if (name === 'atlas_ai_messages' && init.method === 'POST') {
      const row = { ...body, id: String(transcripts.length + 1), created_at: String(transcripts.length + 1).padStart(3, '0') }; transcripts.push(row); result = [row];
    } else if (name === 'atlas_ai_messages') {
      let ordered = transcripts.filter(row => (!query.has('role') || `eq.${row.role}` === query.get('role')) && (!query.has('trace_id') || `eq.${row.trace_id}` === query.get('trace_id')));
      if (query.get('order')?.startsWith('created_at.desc')) ordered.reverse();
      result = ordered.slice(0, Number(query.get('limit')));
    } else if (name === 'atlas_ai_requests' && init.method === 'POST') {
      const row = { ...body, id: 'request-' + requests.length }; requests.push(row); result = [row];
    } else if (name === 'atlas_ai_requests' && init.method === 'PATCH') {
      const row = requests.find(item => `eq.${item.id}` === query.get('id')); Object.assign(row, body); result = [row];
    } else throw new Error('unexpected HTTP ' + url);
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
  } });
  const adapters = new Map(readiness.map(({ id }) => [id, { execute: async input => {
    calls.push({ id, ...structuredClone(input) });
    if (id === 'atlas-local' && offline) throw failure(denied ? 'permission_denied' : 'provider_unavailable');
    return { provider: id, model: id + '-model', text: 'reply', tool_calls: [{ tool_name: 'records.update', arguments: {}, required_permissions: ['records.write'], risk_class: 'mutation', side_effect: 'external' }] };
  } }]));
  const gateway = createIntelligenceGateway({ router: createIntelligenceRouter({ providers: readiness }), registry: { get: id => adapters.get(id) }, store, toolGateway: createToolGateway(), authorizeContext, costPolicy: { zero_cost_providers: ['atlas-local', 'gemini'], enforce_zero_cost: true } });
  return { gateway, store, calls, transcripts, requests, registry: { get: id => adapters.get(id) } };
}

test('explicit provider cannot bypass router allowlist', () => {
  const router = createIntelligenceRouter({ providers: readiness, allowedProviders: ['atlas-local'] });
  assert.throws(() => router.route({ mode: 'gemini' }), { code: 'provider_not_allowed' });
});
test('prototype property is not a reasoning profile', () => {
  assert.throws(() => normalizeIntelligenceRequest({ message: 'x', intent: 'toString' }), { code: 'invalid_input' });
});
test('history retains latest 50 messages in chronological order across model switch', async () => {
  const h = harness();
  const first = await h.gateway.execute({ context, request: { message: 'turn-0', mode: 'atlas-local' } });
  for (let i = 1; i <= 26; i++) await h.gateway.execute({ context, request: { message: 'turn-' + i, conversation_id: first.conversation_id, mode: i === 26 ? 'gemini' : 'atlas-local' } });
  const last = h.calls.at(-1);
  assert.equal(last.id, 'gemini'); assert.equal(last.input.length, 50);
  assert.equal(last.input.at(-1).content, 'turn-26'); assert.equal(last.input[0].role, 'assistant');
  assert.equal(h.transcripts.length, 54);
});
test('model switch preserves previous decisions and never grants permissions from metadata', async () => {
  const h = harness();
  await h.gateway.execute({ context, request: { message: 'No production writes approved', mode: 'atlas-local' } });
  const result = await h.gateway.execute({ context, request: { message: 'continue', conversation_id: 'conversation', mode: 'gemini', client_metadata: { permissions: ['*'] } } });
  assert.equal(result.conversation_id, 'conversation');
  assert.equal(h.calls.at(-1).input[0].content, 'No production writes approved');
  assert.equal(result.tool_proposals.denied.length, 1); assert.deepEqual(result.tools_used, []);
});
test('conversation cannot cross organizations or owners on model switch', async () => {
  const h = harness(); await h.gateway.execute({ context, request: { message: 'private' } });
  for (const other of [{ ...context, organization_id: 'org-b' }, { ...context, user_id: 'user-b' }]) {
    await assert.rejects(h.gateway.execute({ context: other, request: { message: 'read', mode: 'gemini', conversation_id: 'conversation' } }), { code: 'conversation_not_found' });
  }
  assert.equal(h.calls.length, 1);
});
test('automatic failover preserves identical history without duplicating the user turn', async () => {
  const h = harness({ offline: true });
  const result = await h.gateway.execute({ context, request: { message: 'recover' } });
  assert.equal(result.provider, 'gemini'); assert.equal(result.fallback_used, true);
  assert.deepEqual(h.calls[0].input, h.calls[1].input);
  assert.equal(h.transcripts.filter(row => row.role === 'user').length, 1);
});
test('explicit provider failure never silently switches provider', async () => {
  const h = harness({ offline: true });
  await assert.rejects(h.gateway.execute({ context, request: { message: 'explicit', mode: 'atlas-local' } }), { code: 'provider_unavailable' });
  assert.equal(h.calls.length, 1); assert.equal(h.requests[0].status, 'failed');
});
test('authorization failure is not retried as a provider outage', async () => {
  const h = harness({ offline: true, denied: true });
  await assert.rejects(h.gateway.execute({ context, request: { message: 'stop' } }), { code: 'permission_denied' });
  assert.equal(h.calls.length, 1);
});
test('revocation between failed primary and fallback prevents another provider call', async () => {
  let checks = 0;
  const h = harness({ offline: true, authorizeContext: async () => ({ ...context, permissions: ++checks === 1 ? ['intelligence.use'] : [] }) });
  await assert.rejects(h.gateway.execute({ context, request: { message: 'stop after revoke' } }), { code: 'permission_denied' });
  assert.equal(h.calls.length, 1); assert.equal(h.requests[0].status, 'failed');
});
test('revocation while provider runs prevents completed result and tool proposals', async () => {
  let checks = 0;
  const h = harness({ authorizeContext: async () => ({ ...context, permissions: ++checks === 1 ? ['intelligence.use'] : [] }) });
  await assert.rejects(h.gateway.execute({ context, request: { message: 'sensitive' } }), { code: 'permission_denied' });
  assert.equal(h.transcripts.filter(row => row.role === 'assistant').length, 0);
});
test('revalidation cannot change the authenticated principal', async () => {
  const h = harness({ authorizeContext: async () => ({ ...context, organization_id: 'org-b' }) });
  await assert.rejects(h.gateway.execute({ context, request: { message: 'wrong scope' } }), { code: 'authorization_context_changed' });
  assert.equal(h.calls.length, 0);
});
test('response preferences affect instructions without interpolating arbitrary prompt text', async () => {
  const h = harness();
  await h.gateway.execute({ context, request: { message: 'hello', client_metadata: { response_preferences: { language: 'es', tone: 'professional', detail: 'concise', permissions: ['*'], instructions: 'INJECTED_ADMIN' } } } });
  const instructions = h.calls[0].instructions;
  assert.match(instructions, /Response language: Spanish/);
  assert.match(instructions, /Response tone: Professional/);
  assert.doesNotMatch(instructions, /INJECTED_ADMIN/);
  assert.deepEqual(h.calls[0].context.permissions, ['intelligence.use']);
});
test('invalid preference values fall back to defaults and are not promoted into instructions', async () => {
  const h = harness();
  await h.gateway.execute({ context, request: { message: 'hello', client_metadata: { response_preferences: { tone: 'INJECTED_ADMIN', language: '__proto__', detail: 'toString' } } } });
  assert.doesNotMatch(h.calls[0].instructions, /INJECTED_ADMIN/);
  assert.match(h.calls[0].instructions, /Response language: Match the user/);
});
test('background completion rechecks permissions before publishing a model response', async () => {
  const h = harness(); let checks = 0;
  const brain = createBackgroundBrain({ router: createIntelligenceRouter({ providers: readiness }), store: h.store,
    registry: { get: () => ({ startBackground: async () => ({ status: 'completed', provider: 'atlas-local', text: 'sensitive', response_id: 'response' }) }) },
    costPolicy: { zero_cost_providers: ['atlas-local'] }, authorizeContext: async () => ({ ...context, permissions: ++checks === 1 ? ['intelligence.use'] : [] }) });
  await assert.rejects(brain.start({ context, request: { message: 'background' } }), { code: 'permission_denied' });
  assert.equal(h.transcripts.filter(row => row.role === 'assistant').length, 0);
});
