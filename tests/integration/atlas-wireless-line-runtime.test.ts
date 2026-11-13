import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { maskUsLineNumber, normalizeUsLineNumber } from '../../supabase/functions/_shared/atlas-wireless-line';

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const e164A = '+12025550100';
const e164B = '+12125550100';

// Evaluate the actual Edge Function handler with an in-memory Supabase adapter.
// It never accesses production data, secrets, or a live carrier.
function makeHarness(options: { permission?: boolean; membership?: boolean } = {}) {
  const records = [
    { id: 'claim-a', org_id: orgA, submitted_by: userA, e164: e164A, status: 'pending_verification', created_at: '2026-01-01T00:00:00Z' },
    { id: 'claim-b', org_id: orgB, submitted_by: userB, e164: e164B, status: 'pending_verification', created_at: '2026-01-01T00:00:00Z' }
  ];
  let inserts = 0;
  let handler: ((req: Request) => Promise<Response>) | null = null;
  const userClient = {
    auth: {
      async getUser(token: string) {
        if (token === 'valid-user-a') return { data: { user: { id: userA } }, error: null };
        return { data: { user: null }, error: { message: 'invalid jwt' } };
      }
    },
    from(table: string) {
      if (table !== 'organization_members') throw new Error('unexpected_user_table');
      const filters: Record<string, string> = {};
      const chain = {
        select() { return chain; },
        eq(name: string, value: string) { filters[name] = value; return chain; },
        async maybeSingle() {
          const valid = options.membership !== false
            && filters.org_id === orgA && filters.user_id === userA && filters.status === 'active';
          return { data: valid ? { org_id: orgA } : null, error: null };
        }
      };
      return chain;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name !== 'has_identity_permission') throw new Error('unexpected_rpc');
      const allowed = options.permission !== false && args.o === orgA && args.p === 'wireless.mvno.read';
      return { data: allowed, error: null };
    }
  };

  const adminClient = {
    from(table: string) {
      if (table !== 'atlas_wireless_line_claims') throw new Error('unexpected_admin_table');
      const filters: Record<string, string> = {};
      const reader = {
        select() { return reader; },
        eq(key: string, value: string) { filters[key] = value; return reader; },
        order() { return reader; },
        async limit(max: number) {
          return {
            data: records.filter((item) =>
              Object.entries(filters).every(([key, value]) =>
                item[key as keyof typeof item] === value)).slice(0, max),
            error: null
          };
        }
      };
      return {
        ...reader,
        insert(input: Record<string, unknown>) {
          inserts++;
          return {
            select() {
              return {
                async single() {
                  if (records.some((row) => row.org_id === input.org_id && row.e164 === input.e164)) {
                    return { data: null, error: { code: '23505' } };
                  }
                  const record = {
                    id: 'new-claim', org_id: String(input.org_id),
                    submitted_by: String(input.submitted_by), e164: String(input.e164),
                    status: String(input.status), created_at: '2026-01-01T00:00:00Z'
                  };
                  records.push(record);
                  return { data: record, error: null };
                }
              };
            }
          };
        }
      };
    }
  };

  const source = readFileSync('supabase/functions/atlas-wireless-line/index.ts', 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const requireMock = (name: string) => {
    if (name === 'npm:@supabase/supabase-js@2.95.0') {
      return { createClient: (_url: string, key: string) => key === 'service-test' ? adminClient : userClient };
    }
    if (name === '../_shared/atlas-wireless-line.ts') {
      return { maskUsLineNumber, normalizeUsLineNumber };
    }
    throw new Error('unrecognized_import:' + name);
  };
  runInNewContext(output, {
    exports: {}, require: requireMock, Request, Response, URL, Date, Set, Error, Object,
    Number, String, JSON, Array, RegExp,
    Deno: {
      env: { get: (key: string) => ({
        SUPABASE_URL: 'https://test.supabase.invalid',
        SUPABASE_ANON_KEY: 'anon-test',
        SUPABASE_SERVICE_ROLE_KEY: 'service-test'
      })[key] || '' },
      serve: (fn: (req: Request) => Promise<Response>) => { handler = fn; }
    }
  }, { timeout: 2000 });
  if (!handler) throw new Error('missing_http_handler');

  const request = async (
    api: 'list' | 'submit',
    args: { token?: string; org?: string; body?: unknown; method?: string } = {}
  ) => {
    const req = new Request('https://atlas.invalid/functions/v1/atlas-wireless-line?api=' + api, {
      method: args.method || (api === 'list' ? 'GET' : 'POST'),
      headers: {
        ...(args.token ? { authorization: 'Bearer ' + args.token } : {}),
        'x-atlas-org-id': args.org || orgA,
        'content-type': 'application/json'
      },
      ...(api === 'submit' ? { body: JSON.stringify(args.body ?? {}) } : {})
    });
    const response = await handler!(req);
    return { status: response.status, body: await response.json() };
  };
  return { request, getInsertCount: () => inserts };
}

describe('ATLAS Wireless HTTP runtime authorization regression', () => {
  it('denies anonymous and invalid credentials', async () => {
    const h = makeHarness();
    expect((await h.request('list')).status).toBe(401);
    expect((await h.request('list', { token: 'bad' })).status).toBe(401);
    expect(h.getInsertCount()).toBe(0);
  });

  it('denies forged other-tenant headers, inactive memberships, and missing permissions', async () => {
    expect((await makeHarness().request('list', { token: 'valid-user-a', org: orgB })).status).toBe(403);
    expect((await makeHarness({ membership: false }).request('list', { token: 'valid-user-a' })).status).toBe(403);
    expect((await makeHarness({ permission: false }).request('list', { token: 'valid-user-a' })).status).toBe(403);
  });

  it('returns only requesting user records, masked, not cross-organization records', async () => {
    const result = await makeHarness().request('list', { token: 'valid-user-a' });
    expect(result.status).toBe(200);
    expect(result.body.claims).toHaveLength(1);
    expect(result.body.claims[0].masked_number).toBe('•••-•••-0100');
    expect(JSON.stringify(result.body)).not.toContain(e164A);
    expect(JSON.stringify(result.body)).not.toContain(e164B);
  });

  it('accepts an explicit authorized claim as unverified, not active', async () => {
    const h = makeHarness();
    const result = await h.request('submit', {
      token: 'valid-user-a',
      body: { number: '+13125550100', ownership_asserted: true }
    });
    expect(result.status).toBe(201);
    expect(result.body.claim.status).toBe('pending_verification');
    expect(result.body.claim.carrier_verified).toBe(false);
    expect(result.body.claim.network_active).toBe(false);
    expect(h.getInsertCount()).toBe(1);
    expect(JSON.stringify(result.body)).not.toContain('+13125550100');
  });

  it('rejects absent consent, malformed numbers, and submissions from forged orgs', async () => {
    const h = makeHarness();
    expect((await h.request('submit', { token: 'valid-user-a', body: { number: '+13125550100' } })).status).toBe(400);
    expect((await h.request('submit', { token: 'valid-user-a', body: { number: '1', ownership_asserted: true } })).status).toBe(400);
    expect((await h.request('submit', { token: 'valid-user-a', org: orgB, body: { number: '+13125550100', ownership_asserted: true } })).status).toBe(403);
    expect(h.getInsertCount()).toBe(0);
  });
});
