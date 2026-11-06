import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, chmod, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const bridge = new URL('../notes-bridge.mjs', import.meta.url);
function call(directory, request) {
  const p = spawnSync(process.execPath, [bridge.pathname, directory], { input: JSON.stringify(request), encoding: 'utf8' });
  return { code: p.status, data: JSON.parse(p.stdout), stderr: p.stderr };
}
test('native notes bridge persists encrypted changes across separate processes', async t => {
  const d = await mkdtemp(join(tmpdir(), 'atlas-native-')); await chmod(d, 0o700);
  t.after(() => rm(d, { recursive: true, force: true }));
  const auth = { passphrase: 'native fixture passphrase only' };
  assert.equal(call(d, { ...auth, action: 'save', value: 'offline native note' }).code, 0);
  const reopened = call(d, { ...auth, action: 'load' });
  assert.equal(reopened.data.value, 'offline native note');
  assert.equal(reopened.data.status.pending, 1);
  assert.doesNotMatch(await readFile(join(d, 'memory.v1.json'), 'utf8'), /offline native note|fixture passphrase/);
  const wrong = call(d, { action: 'load', passphrase: 'incorrect password long' });
  assert.equal(wrong.code, 1); assert.equal(wrong.data.error, 'vault_decryption_failed');
  assert.doesNotMatch(wrong.stderr, /password|passphrase/);
});
test('bridge rejects network operations, malformed requests and oversized input', async t => {
  const d = await mkdtemp(join(tmpdir(), 'atlas-native-')); await chmod(d, 0o700);
  t.after(() => rm(d, { recursive: true, force: true }));
  for (const request of [{ action: 'connect', passphrase: 'fixture passphrase only' }, { action: 'save', value: 42 }, { action: 'save', value: 'x'.repeat(20000) }]) {
    assert.equal(call(d, request).code, 1);
  }
});
