import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../docs/ops/sql/atlas_bme688_atomic_ingest_candidate.sql', import.meta.url), 'utf8').toLowerCase();
const edge = readFileSync(new URL('../../supabase/functions/atlas-local-control/index.ts', import.meta.url), 'utf8');
const validator = readFileSync(new URL('../../tools/local-agent/lib/bme688-telemetry.mjs', import.meta.url), 'utf8');

// These are SOURCE-CONTRACT tests. Real Postgres 17 / Edge / concurrency tests are P0.
test('service-only SQL proposal uses existing Urban Twin and no second observation store', () => {
  assert.match(sql, /security invoker/);
  assert.match(sql, /revoke all on function public\.atlas_ingest_bme688/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
  assert.match(sql, /insert into public\.atlas_urban_twin_observations/);
  assert.doesNotMatch(sql, /create table/);
});
test('database checks real session status and device-to-agent ownership', () => {
  for (const criterion of [
    'atlas_local_agent_sessions', 'atlas_local_agents', 's.revoked_at is null',
    's.expires_at > now()', "a.status = 'online'", 'for share of s, a',
    'atlas_local_devices', 'd.agent_id = p_agent_id',
    'd.org_id = v_org_id', "d.adapter = 'bme688'"
  ]) assert.ok(sql.includes(criterion), criterion);
});
test('binding is scoped and verified before storage, with transaction-scoped lock and replay cursor', () => {
  for (const criterion of [
    'b.org_id = v_org_id', 'b.tenant_id = v_org_id',
    'b.external_ref = p_device_id::text',
    "b.verification_state = 'verified'",
    "e.verification_state = 'verified'", 'for update of b',
    "v_meta -> 'atlas_bme688_ingest'", 'p_sequence <= v_previous',
    'update public.atlas_urban_twin_bindings'
  ]) assert.ok(sql.includes(criterion), criterion);
});
test('SQL inserts exactly four direct signals plus safe audit in same function', () => {
  const metrics = ['bme688.temperature_c', 'bme688.humidity_percent', 'bme688.pressure_hpa', 'bme688.gas_resistance_ohm'];
  for (const metric of metrics) assert.ok(sql.includes(metric), metric);
  assert.match(sql, /insert into public\.atlas_local_device_events/);
  assert.match(sql, /return 4;/);
  assert.doesNotMatch(sql, /co2_ppm|odor_id|gas_type_prediction/);
});
test('Edge reuses existing agent authentication and source frame validation', () => {
  assert.match(edge, /const context = await resolveAgent\(req\)/);
  assert.match(edge, /operation === 'agent\.sensors\.bme688\.ingest'/);
  assert.match(edge, /normalizeBme688Frame\(body\.frame, \{ now: new Date\(\) \}\)/);
  assert.match(edge, /p_session_id: String\(context\.session\.id\)/);
  assert.match(edge, /p_agent_id: agentId/);
  assert.match(edge, /admin\.rpc\('atlas_ingest_bme688'/);
  assert.match(edge, /bme688_ingest_unavailable/);
  assert.match(edge, /bme688_request_fields_rejected/);
  assert.ok(validator.includes('const validatedFrames = new WeakSet()'));
});
test('proposal stays fail-closed until isolated Postgres tests and migration', () => {
  assert.match(sql, /candidate ddl only/);
  assert.match(sql, /not an applied migration/);
  assert.match(sql, /postgresql 17/);
  assert.doesNotMatch(edge, /from\('atlas_urban_twin_observations'\)\.insert/);
});
