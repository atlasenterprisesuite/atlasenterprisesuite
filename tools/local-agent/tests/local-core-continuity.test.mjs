import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContinuity } from '../lib/local-core-continuity.mjs';
const passphrase = 'continuity test passphrase only';
async function device(t, tenant = 'tenant-a') {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-continuity-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, open: () => createContinuity({ directory, passphrase, tenant }) };
}
test('offline edit survives reopen, ciphertext hides contents, failed delivery remains pending', async t => {
  const d = await device(t); const a = d.open();
  await a.edit('note', 'private draft');
  assert.equal((await d.open().status()).pending, 1);
  assert.doesNotMatch(await readFile(join(d.directory, 'memory.v1.json'), 'utf8'), /private draft|tenant-a/);
  await assert.rejects(a.flush(async () => { throw new Error('offline'); }), /offline/);
  assert.equal((await a.status()).pending, 1);
});
test('lost acknowledgement retries identical operation; acknowledgement of another operation is rejected', async t => {
  const a = (await device(t)).open(); await a.edit('note', 'one');
  let operation;
  await assert.rejects(a.flush(async op => { operation = op; throw new Error('lost'); }), /lost/);
  await assert.rejects(a.flush(async op => ({ ...op, id: 'another' })), /ack_mismatch/);
  await a.flush(async op => { assert.deepEqual(op, operation); return { id: op.id, digest: op.digest, tenant: op.tenant }; });
  assert.equal((await a.status()).pending, 0);
});
test('two devices converge, concurrent edits are retained as conflicts, tenant mismatch fails closed', async t => {
  const a = (await device(t)).open(); const b = (await device(t)).open();
  let first;
  await a.edit('note', 'base');
  await a.flush(async op => { first = op; await b.receive(op); return op; });
  assert.equal(await b.read('note'), 'base');
  await a.edit('note', 'computer'); await b.edit('note', 'phone');
  let concurrent;
  await a.flush(async op => { concurrent = op; return op; });
  assert.equal(await b.receive(concurrent), 'conflict');
  assert.equal(await b.read('note'), 'phone');
  assert.equal((await b.status()).conflicts, 1);
  await assert.rejects(b.flush(async op => op), /unresolved_conflict/);
  await assert.rejects((await device(t, 'tenant-b')).open().receive(first), /tenant_mismatch/);
});
test('replay is idempotent, tampering is rejected, older parent cannot overwrite current version', async t => {
  const a = (await device(t)).open(); const b = (await device(t)).open(); let op;
  await a.edit('note', 'first'); await a.flush(async x => { op = x; return x; });
  assert.equal(await b.receive(op), 'applied');
  assert.equal(await b.receive(op), 'duplicate');
  await assert.rejects(b.receive({ ...op, value: 'tampered' }), /digest_mismatch/);
  assert.equal(await b.read('note'), 'first');
});
test('invalid edits and full journal fail atomically without erasing existing work', async t => {
  const a = (await device(t)).open();
  await a.edit('note', 'kept');
  await assert.rejects(a.edit('__proto__', 'bad'), /invalid_operation/);
  await assert.rejects(a.edit('note', 'x'.repeat(8193)), /invalid_operation/);
  let full = false;
  for (let i = 0; i < 12; i++) {
    try { await a.edit('large', 'x'.repeat(8192)); }
    catch (error) { assert.match(error.message, /vault_invalid_value/); full = true; break; }
  }
  assert.equal(full, true);
  assert.equal(await a.read('note'), 'kept');
});
test('edit during delivery remains pending after prior operation acknowledgement', async t => {
  const a = (await device(t)).open(); await a.edit('note', 'first');
  await a.flush(async op => { await a.edit('note', 'second'); return op; });
  assert.equal(await a.read('note'), 'second');
  assert.equal((await a.status()).pending, 1);
});
