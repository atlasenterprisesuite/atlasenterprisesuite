import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, symlink, chmod, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memoryPut, memoryGet, memoryList, memoryDelete } from '../lib/local-core-vault.mjs';
const passphrase = 'local testing passphrase that is long';
async function withDir(t) { const d = await mkdtemp(join(tmpdir(), 'atlas-vault-')); await chmod(d, 0o700); t.after(()=>rm(d,{recursive:true,force:true})); return d; }

test('AES-GCM vault round-trip, no plaintext on disk, secure file mode', async t => {
  const directory = await withDir(t);
  await memoryPut({directory, id:'private-note', value:'VERY_SECRET_VALUE_HERE',passphrase});
  const data = await readFile(join(directory,'memory.v1.json'),'utf8');
  assert.match(data,/aes-256-gcm/);
  assert.doesNotMatch(data,/VERY_SECRET_VALUE_HERE|private-note|testing passphrase/);
  if (process.platform !== 'win32') assert.equal((await stat(join(directory,'memory.v1.json'))).mode & 0o777,0o600);
  assert.equal(await memoryGet({directory,id:'private-note',passphrase}),'VERY_SECRET_VALUE_HERE');
  assert.deepEqual(await memoryList({directory,passphrase}),['private-note']);
  assert.equal(await memoryDelete({directory,id:'private-note',passphrase}),true);
  assert.deepEqual(await memoryList({directory,passphrase}),[]);
});
test('wrong passphrase or modified ciphertext fail closed', async t => {
  const directory = await withDir(t);
  await memoryPut({directory,id:'x',value:'test',passphrase});
  await assert.rejects(memoryGet({directory,id:'x',passphrase:'wrong passphrase 123'}),/vault_decryption_failed/);
  const file = join(directory,'memory.v1.json');
  const original = JSON.parse(await readFile(file,'utf8'));
  original.data = (original.data[0] === 'A' ? 'B' : 'A') + original.data.slice(1);
  await writeFile(file, JSON.stringify(original));
  await assert.rejects(memoryList({directory,passphrase}),/vault_decryption_failed/);
});
test('invalid id, short passphrase and large content rejected', async t => {
  const directory = await withDir(t);
  await assert.rejects(memoryPut({directory,id:'../escape',value:'x',passphrase}),/invalid_id/);
  await assert.rejects(memoryPut({directory,id:'ok',value:'x',passphrase:'short'}),/passphrase/);
  await assert.rejects(memoryPut({directory,id:'ok',value:'x'.repeat(70000),passphrase}),/invalid_value/);
});
test('symlink vault path and unsafe permissions are rejected on POSIX', async t => {
  if (process.platform === 'win32') { t.skip('Windows ACL validated in dedicated installer'); return; }
  const directory = await withDir(t);
  const link = join(directory,'link');
  await symlink(directory,link);
  await assert.rejects(memoryList({directory:link,passphrase}),/unsafe_directory/);
  await chmod(directory,0o755);
  await assert.rejects(memoryList({directory,passphrase}),/unsafe_permissions/);
});
test('writes blocked by existing lock rather than racing', async t => {
  const directory = await withDir(t);
  await writeFile(join(directory,'.memory.lock'),'active',{mode:0o600});
  await assert.rejects(memoryPut({directory,id:'hello',value:'world',passphrase}),/vault_locked/);
});
