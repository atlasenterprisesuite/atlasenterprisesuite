import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../apps/web/src/App.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../apps/web/src/modules/mission-control/MissionControlPage.tsx', import.meta.url), 'utf8');

test('Mission Control route remains identity-gated', () => {
  assert.match(app, /path="\/mission-control" element=\{<RequireAtlasIdentity><MissionControlPage \/><\/RequireAtlasIdentity>\}/);
});

test('Mission Control explicitly disclaims live status and blocks release', () => {
  assert.match(panel, /not a live feed/);
  assert.match(panel, /GLOBAL: P0 NO-GO/);
  assert.match(panel, /does not authorize merge or deployment/);
});

test('Mission Control links to evidence without using a privileged client token', () => {
  assert.match(panel, /https:\/\/github\.com\/atlasenterprisesuite\/atlasenterprisesuite\/pull\/974/);
  assert.doesNotMatch(panel, /fetch\(|localStorage|service_role|SUPABASE_SERVICE_ROLE_KEY|process\.env/);
});

const identityGate = readFileSync(new URL('../apps/web/src/identity/RequireAtlasIdentity.tsx', import.meta.url), 'utf8');

test('P0 RED: Mission Control must not rely on route identity alone for ledger authorization', () => {
  assert.match(panel, /useMissionControlEvidence|loadMissionControlEvidence|fetchMissionControlEvidence/, 'Missing server-authorized evidence reader');
  assert.match(panel, /permission|capabilit|authorization/i, 'Missing explicit permission handling for ledger read');
});

test('P0 RED: evidence reader must expose denied and unverified states', () => {
  assert.match(panel, /denied|forbidden|unauthorized/i, 'No explicit denied state in Mission Control');
  assert.match(panel, /unverified|unavailable|error/i, 'No explicit unavailable-evidence state in Mission Control');
});

test('P0 baseline: identity guard checks organization, but does not prove ledger authorization', () => {
  assert.match(identityGate, /getActiveAtlasOrganization/);
  assert.doesNotMatch(identityGate, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

const evidenceEndpoint = readFileSync(new URL('../supabase/functions/atlas-mission-control-evidence/index.ts', import.meta.url), 'utf8');

test('P0: releases.read is required in addition to an active admin membership', () => {
  assert.match(evidenceEndpoint, /await client\.rpc\(\s*'has_identity_permission'\s*,\s*\{\s*o:\s*orgId,\s*p:\s*'releases\.read'/);
  assert.match(evidenceEndpoint, /permissionError\) return respond\(req, 503, \{ error: 'permission_verification_unavailable' \}\)/);
  assert.match(evidenceEndpoint, /permissionAllowed !== true\) return respond\(req, 403, \{ error: 'evidence_access_denied' \}\)/);
  assert.ok(evidenceEndpoint.indexOf('has_identity_permission') < evidenceEndpoint.indexOf('trusted_evidence_source_not_configured'));
});

test('P0: no verified evidence is returned before a trusted source is integrated', () => {
  assert.match(evidenceEndpoint, /return respond\(req, 503, \{/);
  assert.match(evidenceEndpoint, /verified: false/);
  assert.match(evidenceEndpoint, /trusted_evidence_source_not_configured/);
});

test('P0: CORS preflight rejects untrusted origins without reflecting or substituting an allowed origin', () => {
  assert.match(evidenceEndpoint, /status: origins\.has\(origin\) \? 204 : 403/);
  assert.match(evidenceEndpoint, /\.\.\.\(origins\.has\(origin\) \? \{/);
  assert.doesNotMatch(evidenceEndpoint, /access-control-allow-origin'\s*:\s*origins\.has\([^\n]+\?[^\n]+:\s*'https:\/\//);
});


// Synthetic runtime tests: execute transpiled Edge source with mocked Supabase/Deno.
// No network, credentials, live tenant, deployment or database is used.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const edgeSource = readFileSync(new URL('../supabase/functions/atlas-mission-control-evidence/index.ts', import.meta.url), 'utf8');
const withoutImport = edgeSource.replace(/^import \{ createClient \} from 'npm:@supabase\/supabase-js@2';\s*/m, '');
assert.notEqual(withoutImport, edgeSource, 'The mocked npm import must match the actual edge source');
const transpiled = ts.transpileModule(withoutImport, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;
const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const member = (org_id = orgA, role = 'admin') => ({ org_id, role, status: 'active' });

function edgeHarness({ user = { id: 'synthetic-user' }, memberships = [member()], membershipError = null, permission = false, permissionError = null } = {}) {
  let handler;
  const rpcCalls = [];
  const client = {
    auth: { getUser: async (token) => {
      assert.equal(token, 'synthetic-token', 'getUser must validate the incoming bearer');
      return { data: { user }, error: user ? null : new Error('invalid_token') };
    } },
    from(table) {
      assert.equal(table, 'organization_members');
      // Fail if the endpoint ever drops its authenticated-user or active-status filters.
      // A permissive mock would otherwise let cross-user membership regressions pass CI.
      const filters = [];
      const query = {
        select(fields) { assert.equal(fields, 'org_id,role,status'); return query; },
        eq(field, value) { filters.push([field, value]); return query; },
        limit(n) {
          assert.equal(n, 2);
          assert.deepEqual(filters, [['user_id', user.id], ['status', 'active']]);
          return Promise.resolve({ data: memberships, error: membershipError });
        }
      };
      return query;
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      return { data: permission, error: permissionError };
    }
  };
  runInNewContext(transpiled, {
    createClient: (clientUrl, key, options) => {
      // An authenticated read must use the public client and forward this request's bearer.
      // A permissive mock would miss service-role substitution or a dropped user JWT.
      assert.equal(clientUrl, 'https://example.invalid');
      assert.equal(key, 'synthetic-anon');
      assert.equal(options?.auth?.persistSession, false);
      assert.equal(options?.auth?.autoRefreshToken, false);
      assert.equal(options?.global?.headers?.Authorization, 'Bearer synthetic-token');
      return client;
    },
    Deno: {
      env: { get: (key) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'synthetic-anon' }[key]) },
      serve(fn) { handler = fn; }
    },
    Response, Set
  }, { timeout: 1000 });
  assert.equal(typeof handler, 'function');
  return { handler, rpcCalls };
}
const runtimeRequest = (options = {}) => new Request('https://example.invalid/functions/v1/atlas-mission-control-evidence?org_id=' + orgB, {
  method: options.method || 'GET',
  headers: {
    origin: options.origin || 'https://atlasenterprisesuite.com',
    ...(options.auth === false ? {} : { authorization: 'Bearer synthetic-token' })
  }
});

for (const { name, config, options, status, error, rpcCount } of [
  { name: 'missing bearer', options: { auth: false }, status: 401, error: 'authentication_required', rpcCount: 0 },
  { name: 'invalid token', config: { user: null }, status: 401, error: 'invalid_session', rpcCount: 0 },
  { name: 'revoked or absent membership', config: { memberships: [] }, status: 403, error: 'evidence_access_denied', rpcCount: 0 },
  { name: 'member without admin role', config: { memberships: [member(orgA, 'member')] }, status: 403, error: 'evidence_access_denied', rpcCount: 0 },
  { name: 'ambiguous multiple active organizations', config: { memberships: [member(orgA), member(orgB)] }, status: 403, error: 'evidence_access_denied', rpcCount: 0 },
  { name: 'membership lookup failure', config: { membershipError: new Error('db_unavailable') }, status: 503, error: 'membership_verification_unavailable', rpcCount: 0 },
  { name: 'missing server-derived organization id', config: { memberships: [member('')], permission: true }, status: 403, error: 'evidence_access_denied', rpcCount: 0 },
  { name: 'malformed server-derived organization id', config: { memberships: [member('tenant-not-a-uuid')], permission: true }, status: 403, error: 'evidence_access_denied', rpcCount: 0 },
  { name: 'missing releases.read permission', config: { permission: false }, status: 403, error: 'evidence_access_denied', rpcCount: 1 },
  { name: 'permission RPC failure', config: { permissionError: new Error('db_unavailable') }, status: 503, error: 'permission_verification_unavailable', rpcCount: 1 },
  { name: 'authorized identity still cannot fetch unconfigured evidence', config: { permission: true }, status: 503, error: 'trusted_evidence_source_not_configured', rpcCount: 1 }
]) {
  test('Mission Control runtime denies ' + name, async () => {
    const { handler, rpcCalls } = edgeHarness(config);
    const response = await handler(runtimeRequest(options));
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.error, error);
    assert.notEqual(body.verified, true);
    assert.equal(rpcCalls.length, rpcCount);
    if (rpcCount) {
      assert.equal(rpcCalls[0].name, 'has_identity_permission');
      assert.equal(rpcCalls[0].args.o, orgA);
      assert.equal(rpcCalls[0].args.p, 'releases.read');
    }
  });
}

test('Mission Control runtime rejects untrusted CORS preflight without origin reflection', async () => {
  const { handler, rpcCalls } = edgeHarness();
  const response = await handler(runtimeRequest({ method: 'OPTIONS', origin: 'https://evil.invalid', auth: false }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(rpcCalls.length, 0);
});


test('Mission Control runtime denies state-changing POST before identity or permission lookup', async () => {
  const { handler, rpcCalls } = edgeHarness();
  const response = await handler(runtimeRequest({ method: 'POST', auth: false }));
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error, 'method_not_allowed');
  assert.equal(rpcCalls.length, 0);
});
