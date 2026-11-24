import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';

// Isolated HTTP harness: executes the REAL remote.sessions.prepare handler body,
// extracted from the Edge source, with an in-memory Supabase-like query double.
// Does NOT execute Deno.serve, JWT verification, real RLS or a PostgreSQL transaction.
const source = readFileSync('supabase/functions/atlas-local-control/index.ts', 'utf8');
const start = source.indexOf("  if (operation === 'remote.sessions.prepare') {");
const end = source.indexOf("  if (operation === 'commands.enqueue') {", start);
assert.ok(start >= 0 && end > start);
const actualHandler = source.slice(start, end);
class EdgeError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
function requiredText(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw new EdgeError(code, 422);
  return value.trim();
}
function requirePermission(context, permission) {
  if (!context.permissions.includes(permission)) throw new EdgeError('permission_required', 403);
}
function mockAdmin(fixture) {
  const reads = [];
  return {
    reads,
    from(table) {
      const filters = {};
      return {
        select() { return this; },
        eq(column, value) { filters[column] = value; return this; },
        async maybeSingle() {
          reads.push({ table, filters: { ...filters } });
          const row = fixture[table];
          return { data: row && Object.entries(filters).every(([key,value]) => row[key] === value) ? row : null, error: null };
        }
      };
    }
  };
}
const execute = new Function('operation','body','context','admin','EdgeError','requiredText','requirePermission',
  'return (async () => { ' + actualHandler + ' })()');
const defaults = {
  userOrg: 'org-a', deviceId: 'device-a', permissions: ['device.agent.use'],
  device: { id:'device-a', org_id:'org-a', agent_id:'agent-a' },
  agent: { id:'agent-a', org_id:'org-a', status:'online', mtls_status:'active' },
  consent: 'granted', revoked: false, expiresAt: Date.now() + 60000, reconnect: false
};
async function requestCase(overrides = {}) {
  const config = { ...defaults, ...overrides };
  const admin = mockAdmin({ atlas_local_devices: config.device, atlas_local_agents: config.agent });
  const server = createServer(async (req, res) => {
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (req.headers.authorization !== 'Bearer test-user') throw new EdgeError('authentication_required', 401);
      const context = { orgId: config.userOrg, permissions: config.permissions };
      // Explicitly model unresolved consent/revocation/expiry as NOT implemented:
      // the production handler must reject even the happy path.
      await execute(body.operation, body, context, admin, EdgeError, requiredText, requirePermission);
      res.writeHead(200, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:true }));
    } catch (error) {
      res.writeHead(error.status || 500, { 'content-type':'application/json' });
      res.end(JSON.stringify({ ok:false, error:error.code || 'internal_error' }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port, {
      method:'POST', headers:{ authorization:'Bearer test-user', 'content-type':'application/json' },
      body:JSON.stringify({ operation:'remote.sessions.prepare', device_id:config.deviceId })
    });
    return { status:response.status, body:await response.json(), reads:admin.reads };
  } finally { server.close(); await once(server,'close'); }
}
test('HTTP harness rejects cross-tenant device', async () => {
  const result = await requestCase({ userOrg:'org-b' });
  assert.equal(result.status,404); assert.equal(result.body.error,'device_not_found');
});
test('HTTP harness rejects nonexistent device', async () => {
  const result = await requestCase({ deviceId:'missing' });
  assert.equal(result.status,404);
});
test('HTTP harness rejects invalid mTLS', async () => {
  const result = await requestCase({ agent:{ ...defaults.agent, mtls_status:'revoked' } });
  assert.equal(result.status,409); assert.equal(result.body.error,'secure_agent_required');
});
test('HTTP harness rejects revoked agent', async () => {
  const result = await requestCase({ agent:{ ...defaults.agent, status:'revoked' } });
  assert.equal(result.status,409);
});
test('HTTP harness rejects cross-tenant agent', async () => {
  const result = await requestCase({ agent:{ ...defaults.agent, org_id:'org-b' } });
  assert.equal(result.status,409);
});
test('HTTP harness denies missing permission', async () => {
  const result = await requestCase({ permissions:[] });
  assert.equal(result.status,403);
});
for (const [name, changes] of [
  ['consent absent', { consent:'pending' }],
  ['consent revoked', { consent:'revoked' }],
  ['session revoked', { revoked:true }],
  ['session expired', { expiresAt:0 }],
  ['reconnect requested', { reconnect:true }],
  ['otherwise eligible', {}]
]) {
  test('HTTP harness fail-closed: ' + name, async () => {
    const result = await requestCase(changes);
    assert.equal(result.status,409);
    assert.equal(result.body.error,'remote_desktop_session_verification_required');
  });
}
