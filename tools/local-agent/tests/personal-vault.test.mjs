import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPersonalVault } from '../lib/personal-vault.mjs';

const passphrase = 'fictional test unlock phrase';
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-personal-test-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, vault: createPersonalVault({ directory }) };
}
const google = 'name,url,username,password,note\r\nExample,https://example.test,user@example.test,"FAKE,password","line 1\nline 2"';
const apple = 'Title,URL,Username,Password,Notes\nApple example,https://apple.example.test,another@example.test,FAKE_APPLE,private note';

test('opaque references survive reopening and duplicate imports; lookup returns only metadata', async t => {
  const { vault, directory } = await setup(t);
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  const [account] = await vault.search({ passphrase });
  assert.match(account.reference, /^atlas-vault:\/\/personal\/[0-9a-f-]{36}$/);
  await vault.setRecoveryCodes({ id: account.id, codes: ['FICTIONAL_REFERENCE_RECOVERY'], passphrase });
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  const reopened = createPersonalVault({ directory });
  const result = await reopened.lookupReference({ reference: account.reference, passphrase });
  assert.deepEqual(Object.keys(result).sort(), ['id', 'reference', 'title', 'url', 'username', 'source', 'recoveryCodeCount'].sort());
  assert.equal(result.reference, account.reference);
  assert.equal(result.recoveryCodeCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /FAKE_APPLE|private note|FICTIONAL_REFERENCE_RECOVERY/);
  assert.deepEqual(await reopened.search({ query: account.reference, passphrase }), []);
  await vault.remove({ id: account.id, passphrase });
  assert.equal(await reopened.lookupReference({ reference: account.reference, passphrase }), null);
});

test('a reference is not an unlock capability and cannot read another local vault', async t => {
  const { vault } = await setup(t);
  const other = (await setup(t)).vault;
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  await other.importCsv({ source: 'google', csv: google, passphrase });
  const [{ reference }] = await vault.search({ passphrase });
  await assert.rejects(vault.lookupReference({ reference, passphrase: 'incorrect fictional unlock' }), /decryption_failed/);
  await assert.rejects(vault.lookupReference({ reference }), /passphrase/);
  assert.equal(await other.lookupReference({ reference, passphrase }), null);
});

test('reference lookup rejects alternate schemes, credentials, fields, encoding and URL normalization', async t => {
  const { vault } = await setup(t);
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  const [{ reference, id }] = await vault.search({ passphrase });
  for (const candidate of [undefined, null, {}, '', id, ' ' + reference, reference + '\n',
    reference + '/password', reference + '?field=password', reference + '#recoveryCodes',
    reference.replace('personal/', 'personal/../personal/'),
    reference.replace('personal/', 'user@personal/'),
    reference.replace('personal', 'other-vault'), reference.replace('atlas-vault:', 'op:'),
    reference.replace('personal/', 'personal/%'), reference.toUpperCase()]) {
    await assert.rejects(vault.lookupReference({ reference: candidate, passphrase }), /^Error: personal_vault_reference$/);
  }
});

test('Google and Apple column adapters, encrypted persistence, metadata-only search', async t => {
  const { vault, directory } = await setup(t);
  assert.deepEqual(await vault.importCsv({ source: 'google', csv: google, passphrase }), { imported: 1, skipped: 0 });
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  const results = await vault.search({ query: 'EXAMPLE', passphrase });
  assert.equal(results.length, 2);
  const serialized = JSON.stringify(results);
  assert.doesNotMatch(serialized, /FAKE|private note|line 1/);
  const raw = await readFile(join(directory, 'memory.v1.json'), 'utf8');
  assert.doesNotMatch(raw, /example\.test|FAKE|fictional/);
  const id = results.find(r => r.source === 'google').id;
  assert.equal((await vault.reveal({ id, passphrase })).password, 'FAKE,password');
  assert.equal((await vault.reveal({ id, passphrase })).notes, 'line 1\nline 2');
});

test('duplicates skip, conflicts reject atomically without overwriting', async t => {
  const { vault } = await setup(t);
  await vault.importCsv({ source: 'google', csv: google, passphrase });
  assert.deepEqual(await vault.importCsv({ source: 'google', csv: google, passphrase }), { imported: 0, skipped: 1 });
  const conflicting = google.replace('FAKE,password', 'CHANGED');
  await assert.rejects(vault.importCsv({ source: 'google', csv: conflicting, passphrase }), /personal_vault_conflict/);
  assert.equal((await vault.search({ passphrase })).length, 1);
});

test('wrong unlock, malformed CSV, unsafe URL, missing columns fail closed', async t => {
  const { vault } = await setup(t);
  await vault.importCsv({ source: 'google', csv: google, passphrase });
  await assert.rejects(vault.search({ passphrase: 'incorrect test passphrase' }), /decryption_failed/);
  for (const csv of ['name,url,username,password\nx,https://example.test,u,"unterminated',
    'name,url,username,password\nx,javascript:alert(1),u,p',
    'name,url,username\nx,https://example.test,u',
    'name,url,username,password\nx,https://example.test,u,"p"garbage']) {
    await assert.rejects(vault.importCsv({ source: 'google', csv, passphrase }), /personal_vault_/);
  }
  await assert.rejects(vault.importCsv({ source: 'unknown', csv: google, passphrase }), /source/);
  assert.equal((await vault.search({ passphrase })).length, 1);
});

test('recovery codes stay separate from password and search; deletion persists', async t => {
  const { vault } = await setup(t);
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  const [{ id }] = await vault.search({ passphrase });
  await vault.setRecoveryCodes({ id, codes: ['FICTIONAL-RECOVERY-1'], passphrase });
  assert.doesNotMatch(JSON.stringify(await vault.search({ passphrase })), /FICTIONAL/);
  assert.deepEqual((await vault.reveal({ id, passphrase })).recoveryCodes, ['FICTIONAL-RECOVERY-1']);
  assert.equal(await vault.remove({ id, passphrase }), true);
  assert.equal(await vault.reveal({ id, passphrase }), null);
});

test('concurrent imports fail closed or retain both records', async t => {
  const { vault } = await setup(t);
  const results = await Promise.allSettled([
    vault.importCsv({ source: 'google', csv: google, passphrase }),
    vault.importCsv({ source: 'apple', csv: apple, passphrase })
  ]);
  for (const r of results) if (r.status === 'rejected') assert.match(r.reason.message, /vault_locked/);
  assert.equal((await vault.search({ passphrase })).length, results.filter(r => r.status === 'fulfilled').length);
});

test('a later conflict rolls back earlier rows in the same import', async t => {
  const { vault } = await setup(t);
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  const csv = apple.replace('Apple example,', 'New,https://new.example.test,new,FICTIONAL_NEW,note\nApple example,').replace('FAKE_APPLE', 'CONFLICT');
  await assert.rejects(vault.importCsv({ source: 'apple', csv, passphrase }), /conflict/);
  assert.equal((await vault.search({ passphrase })).length, 1);
});

test('secret contents are not searchable; recovery validation does not erase codes', async t => {
  const { vault } = await setup(t);
  await vault.importCsv({ source: 'apple', csv: apple, passphrase });
  const [{ id }] = await vault.search({ passphrase });
  await vault.setRecoveryCodes({ id, codes: ['FICTIONAL_ONLY'], passphrase });
  for (const query of ['FAKE_APPLE', 'private note', 'FICTIONAL_ONLY']) {
    assert.deepEqual(await vault.search({ query, passphrase }), []);
  }
  await assert.rejects(vault.setRecoveryCodes({ id, codes: ['', ''], passphrase }), /codes/);
  assert.deepEqual((await vault.reveal({ id, passphrase })).recoveryCodes, ['FICTIONAL_ONLY']);
});

test('exported sensitive URLs never expose path, query, fragment or cookie/session columns', async t => {
  const { vault } = await setup(t);
  const csv = [
    'name,url,username,password,note',
    'Test,https://example.test/private/FAKEPATH?code=FAKEQUERY#FAKEFRAGMENT,user@example.test,FAKEPASS,private'
  ].join('\n');
  await vault.importCsv({ source: 'google', csv, passphrase });
  const results = await vault.search({ passphrase });
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://example.test/');
  assert.doesNotMatch(JSON.stringify(results), /FAKEPATH|FAKEQUERY|FAKEFRAGMENT|FAKEPASS|private/);
  assert.deepEqual(await vault.search({ query: 'FAKEQUERY', passphrase }), []);

  const forbidden = 'name,url,username,password,cookie\nOther,https://other.test,u,FAKE,cookie_value';
  await assert.rejects(vault.importCsv({ source: 'google', csv: forbidden, passphrase }), /sensitive_columns/);
  assert.equal((await vault.search({ passphrase })).length, 1);
});
