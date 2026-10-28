import { describe, expect, it } from 'vitest';
import { resolveIntelligenceContext } from '../../supabase/functions/atlas-copilot/atlas-intelligence-auth.mjs';
import { createIntelligenceStore } from '../../supabase/functions/atlas-copilot/atlas-intelligence-store.mjs';
import { resolveAuthorizedIntelligenceRequest } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

// In-memory Supabase HTTP simulator: no credentials, network, production SQL,
// provider calls or mutations. This tests the real authentication/store code.
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = '33333333-3333-4333-8333-333333333333';
const USER_B = '44444444-4444-4444-8444-444444444444';
const USER_C = '55555555-5555-4555-8555-555555555555';
const CONV_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONV_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const row = (id: string, org_id: string, created_by: string) => ({ id, org_id, created_by, module: 'atlas' });
const conversations = [row(CONV_A, ORG_A, USER_A), row(CONV_B, ORG_B, USER_B)];
const messages = [
  { org_id: ORG_A, conversation_id: CONV_A, role: 'user', content: { text: 'Hola' } },
  { org_id: ORG_B, conversation_id: CONV_B, role: 'user', content: { text: 'ATLAS 777 REVIEW — audita P0 y RLS por tenant.' } },
];

function createFixture() {
  const reads: string[] = [];
  const revoked = new Set<string>();
  const userByToken: Record<string, string> = { 'token-a': USER_A, 'token-b': USER_B, 'token-c': USER_C };
  const orgByUser: Record<string, string> = { [USER_A]: ORG_A, [USER_B]: ORG_B, [USER_C]: ORG_A };
  const send = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' },
  });
  const fakeFetch = async (rawUrl: string, opts: any = {}) => {
    const url = new URL(String(rawUrl));
    reads.push(url.pathname + url.search);
    if (url.pathname.endsWith('/auth/v1/user')) {
      const token = String(opts.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      const id = userByToken[token];
      return !id || revoked.has(token) ? send({ error: 'invalid_token' }, 401) : send({ id });
    }
    if (url.pathname.endsWith('/rest/v1/organization_members')) {
      const user = String(url.searchParams.get('user_id') || '').replace(/^eq\./, '');
      const org_id = orgByUser[user];
      return send(org_id ? [{ org_id, role: 'member', status: 'active' }] : []);
    }
    if (url.pathname.endsWith('/rest/v1/identity_role_permissions')) {
      return send([{ permission_code: 'intelligence.use' }]);
    }
    if (url.pathname.endsWith('/rest/v1/atlas_ai_conversations')) {
      const org = String(url.searchParams.get('org_id') || '').replace(/^eq\./, '');
      const id = String(url.searchParams.get('id') || '').replace(/^eq\./, '');
      const owner = String(url.searchParams.get('created_by') || '').replace(/^eq\./, '');
      return send(conversations.filter(c => c.org_id === org && c.id === id && c.created_by === owner));
    }
    if (url.pathname.endsWith('/rest/v1/atlas_ai_messages')) {
      const org = String(url.searchParams.get('org_id') || '').replace(/^eq\./, '');
      const id = String(url.searchParams.get('conversation_id') || '').replace(/^eq\./, '');
      return send(messages.filter(m => m.org_id === org && m.conversation_id === id).map(m => ({ role: m.role, content: m.content })));
    }
    throw new Error('unexpected_mock_endpoint:' + url.pathname);
  };
  const store = createIntelligenceStore({
    supabaseUrl: 'https://example.supabase.co', serviceRoleKey: 'fake-unit-only',
    fetchFn: fakeFetch,
  });
  async function identity(token: string, organization: string) {
    return (await resolveIntelligenceContext({
      request: { headers: new Headers({ authorization: 'Bearer ' + token, 'x-atlas-org-id': organization }) },
      supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'fake-public-unit-only', fetchFn: fakeFetch,
    })).context;
  }
  return { identity, store, reads, revoked };
}

describe('ATLAS 777 authenticated tenant boundary — simulated HTTP E2E', () => {
  it('never imports another organization conversation as adaptive history', async () => {
    const sim = createFixture();
    const a = await sim.identity('token-a', ORG_A);
    await expect(resolveAuthorizedIntelligenceRequest({
      context: a, store: sim.store,
      request: { message: 'Continúa', conversation_id: CONV_B, intent: 'auto' },
    })).rejects.toMatchObject({ code: 'conversation_not_found', status: 404 });
    expect(sim.reads.some(x => x.includes('atlas_ai_messages'))).toBe(false);
    expect(sim.reads.some(x => x.includes('org_id=eq.' + ORG_A))).toBe(true);
  });

  it('uses only owner-authorized organizational history for a short follow-up', async () => {
    const sim = createFixture();
    const b = await sim.identity('token-b', ORG_B);
    const prepared = await resolveAuthorizedIntelligenceRequest({
      context: b, store: sim.store,
      request: { message: 'Run', conversation_id: CONV_B, intent: 'auto' },
    });
    expect(prepared.intent).toBe('deep');
    expect(prepared.reasoning_decision.reason).toBe('authorized_conversation_continuity');
    expect(sim.reads.some(x => x.includes('org_id=eq.' + ORG_B))).toBe(true);
  });

  it('never reveals a same-organization conversation to a non-owner member', async () => {
    const sim = createFixture();
    const c = await sim.identity('token-c', ORG_A);
    await expect(resolveAuthorizedIntelligenceRequest({
      context: c, store: sim.store,
      request: { message: 'Run', conversation_id: CONV_A, intent: 'auto' },
    })).rejects.toMatchObject({ code: 'conversation_not_found', status: 404 });
    expect(sim.reads.some(x => x.includes('created_by=eq.' + USER_C))).toBe(true);
  });

  it('rejects a valid actor requesting an organization outside their membership', async () => {
    const sim = createFixture();
    await expect(sim.identity('token-a', ORG_B))
      .rejects.toMatchObject({ code: 'organization_membership_required', status: 403 });
    expect(sim.reads.some(x => x.includes('atlas_ai_conversations'))).toBe(false);
  });

  it('rejects revoked bearer tokens at a new server identity resolution', async () => {
    const sim = createFixture();
    await sim.identity('token-a', ORG_A);
    sim.revoked.add('token-a');
    await expect(sim.identity('token-a', ORG_A))
      .rejects.toMatchObject({ code: 'authentication_required', status: 401 });
  });
});
