import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapsule, openCapsule } from './chronoseed-format.mjs';
const entries = [{ title: 'Semilla ATLAS', content: 'Contenido local con acentos áéíóú', source: 'Demo', timestamp: '2026-11-23T00:00:00.000Z' }];
const password = 'test-only-secret-not-for-production';

test('round-trip, SHA-256 fingerprint, and random ciphertext', async () => {
  const first = await createCapsule(entries, password);
  const second = await createCapsule(entries, password);
  assert.notEqual(first.sha256, second.sha256);
  assert.equal(first.sha256.length, 64);
  assert.ok(!new TextDecoder().decode(first.bytes).includes(entries[0].content));
  const opened = await openCapsule(first.bytes, password);
  assert.deepEqual(opened.entries, entries);
  assert.equal(opened.sha256, first.sha256);
});
test('wrong password fails closed', async () => {
  const capsule = await createCapsule(entries, password);
  await assert.rejects(openCapsule(capsule.bytes, 'completely-wrong-password'), /authentication_failed/);
});
test('ciphertext tampering fails closed', async () => {
  const capsule = await createCapsule(entries, password);
  const obj = JSON.parse(new TextDecoder().decode(capsule.bytes));
  obj.cipher.data = (obj.cipher.data[0] === 'A' ? 'B' : 'A') + obj.cipher.data.slice(1);
  await assert.rejects(openCapsule(new TextEncoder().encode(JSON.stringify(obj)), password), /authentication_failed/);
});
test('rejects invalid entries, weak password, malformed file and oversized input', async () => {
  await assert.rejects(createCapsule([], password), /invalid_entries/);
  await assert.rejects(createCapsule(entries, 'short'), /invalid_password/);
  await assert.rejects(openCapsule(new Uint8Array(2 * 1024 * 1024 + 1), password), /file_limit/);
  await assert.rejects(openCapsule(new TextEncoder().encode('{broken'), password), /invalid_json/);
});
test('v1 fields match the standalone browser prototype', async () => {
  const capsule = await createCapsule(entries, password);
  const data = JSON.parse(new TextDecoder().decode(capsule.bytes));
  assert.equal(data.format, 'ATLAS-CHRONOSEED');
  assert.equal(data.version, 1);
  assert.equal(data.kdf.iterations, 310000);
  assert.equal(data.cipher.name, 'AES-256-GCM');
});
