import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPersonalVault } from '../lib/personal-vault.mjs';
import { runVaultConsole, readImportFile, terminalText } from '../lib/personal-vault-console.mjs';

test('console imports and searches with explicit unlock; outputs contain no secrets', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-console-test-'));
  await chmod(directory, 0o700); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'fictional.csv');
  await writeFile(file, 'name,url,username,password,note\nExample,https://example.test,u,FICTIONAL_PASSWORD,FICTIONAL_NOTE');
  const answers = ['import', 'google', file, 'fictional unlock phrase', 'search', 'example', 'fictional unlock phrase', 'exit'];
  const prompts = []; const output = [];
  await runVaultConsole({ vault: createPersonalVault({ directory }),
    prompt: async (label, secret) => { prompts.push({ label, secret }); return answers.shift(); },
    write: s => output.push(s) });
  assert.match(output.join(''), /Imported: 1/);
  assert.match(output.join(''), /example\.test/);
  assert.doesNotMatch(output.join(''), /FICTIONAL|unlock phrase/);
  assert.equal(prompts.filter(p => p.secret).length, 2);
});

test('import file reader rejects symlinks, directories and oversized inputs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-reader-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'large.csv'); await writeFile(file, 'x'.repeat(1048577));
  await assert.rejects(readImportFile(file), /import_file/);
  await assert.rejects(readImportFile(directory), /import_file/);
  if (process.platform !== 'win32') {
    await symlink(file, join(directory, 'link'));
    await assert.rejects(readImportFile(join(directory, 'link')), /import_file/);
  }
});

test('terminal output removes controls and errors never echo underlying details', async () => {
  assert.equal(terminalText('\u001b[31mExample\n\u202e'), '[31mExample');
  const answers = ['search', '', 'fictional unlock phrase', 'exit']; const output = [];
  await runVaultConsole({ vault: { search: async () => { throw new Error('FICTIONAL_SECRET_DETAIL'); } },
    prompt: async () => answers.shift(), write: s => output.push(s) });
  assert.doesNotMatch(output.join(''), /FICTIONAL/);
  assert.match(output.join(''), /Operation failed/);
});
