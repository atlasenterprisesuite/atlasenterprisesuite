import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, symlink, chmod, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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

/** Re-run the real vault module in a fresh process to verify disk persistence. */
function vaultChild(args) {
  const href = new URL('../lib/local-core-vault.mjs', import.meta.url).href;
  const script = `
import {readFileSync} from 'node:fs';
import {memoryPut,memoryGet,memoryList} from ${JSON.stringify(href)};
const a = JSON.parse(readFileSync(0,'utf8'));
const result = a.action === 'put' ? await memoryPut(a) :
  a.action === 'get' ? await memoryGet(a) : await memoryList(a);
process.stdout.write(JSON.stringify(result));
`;
  return spawnSync(process.execPath,['--input-type=module','--eval',script],{
    input:JSON.stringify(args),encoding:'utf8',timeout:15000
  });
}

test('encrypted vault persists across processes and resists incorrect password and tampering', async t => {
  const directory = await withDir(t);
  const passphrase = randomBytes(32).toString('hex');
  const id = 'portable-vault-fixture';
  const value = 'fixture-' + randomBytes(16).toString('hex');
  let result = vaultChild({action:'put',directory,passphrase,id,value});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout),true);
  const file = join(directory,'memory.v1.json');
  const raw = await readFile(file,'utf8');
  assert.ok(!raw.includes(value) && !raw.includes(id) && !raw.includes(passphrase));
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777,0o600);

  result = vaultChild({action:'get',directory,passphrase,id});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout),value);
  result = vaultChild({action:'list',directory,passphrase});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),[id]);

  result = vaultChild({action:'get',directory,passphrase:'incorrect-test-key-123',id});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/vault_decryption_failed/);
  assert.equal(result.stdout,'');

  const backup = join(directory,'isolated-test-backup.json');
  await copyFile(file,backup);
  const corrupted = JSON.parse(raw);
  corrupted.tag = Buffer.alloc(16,0).toString('base64');
  await writeFile(file,JSON.stringify(corrupted));
  result = vaultChild({action:'get',directory,passphrase,id});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/vault_decryption_failed/);
  assert.equal(result.stdout,'');

  await copyFile(backup,file);
  result = vaultChild({action:'get',directory,passphrase,id});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout),value);
});
