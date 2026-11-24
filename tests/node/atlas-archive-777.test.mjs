import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(import.meta.dirname, '../../scripts/atlas-archive-777.mjs');
function run(binary, args, cwd) { return spawnSync(binary, args, { cwd, encoding: 'utf8' }); }
function init() {
  const root = mkdtempSync(join(tmpdir(), 'atlas-archive-test-'));
  const repo = join(root, 'repo');
  const out = join(root, 'private-backups');
  mkdirSync(repo);
  assert.equal(run('git', ['init', '--quiet', '-b', 'main', repo], root).status, 0);
  assert.equal(run('git', ['config', 'user.email', 'test@example.invalid'], repo).status, 0);
  assert.equal(run('git', ['config', 'user.name', 'ATLAS Test'], repo).status, 0);
  writeFileSync(join(repo, 'README.md'), 'durable source\n');
  assert.equal(run('git', ['add', '.'], repo).status, 0);
  assert.equal(run('git', ['commit', '-qm', 'fixture'], repo).status, 0);
  return { root, repo, out };
}
test('snapshot is portable and independently restorable, with exact SHA', () => {
  const f = init();
  try {
    const snap = run('node', [script, 'snapshot', '--repo', f.repo, '--output', f.out], f.root);
    assert.equal(snap.status, 0, snap.stderr);
    const created = readdirSync(f.out);
    const manifest = join(f.out, created.find(x => x.endsWith('.json')));
    const m = JSON.parse(readFileSync(manifest, 'utf8'));
    assert.equal(m.scope, 'committed_git_history_only');
    assert.equal(m.headSha, run('git', ['rev-parse', 'HEAD'], f.repo).stdout.trim());
    const verified = run('node', [script, 'verify', '--manifest', manifest], f.root);
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /VERIFIED_LOCAL/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('refuses untracked changes rather than claiming full backup', () => {
  const f = init();
  try {
    writeFileSync(join(f.repo, 'not-committed.txt'), 'not backed up');
    const snap = run('node', [script, 'snapshot', '--repo', f.repo, '--output', f.out], f.root);
    assert.notEqual(snap.status, 0);
    assert.match(snap.stderr, /uncommitted or untracked/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('refuses an output directory under the source repo', () => {
  const f = init();
  try {
    const snap = run('node', [script, 'snapshot', '--repo', f.repo, '--output', join(f.repo, 'backup')], f.root);
    assert.notEqual(snap.status, 0);
    assert.match(snap.stderr, /inside the Git working tree/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('rejects tampered bundles with fail-closed hash validation', () => {
  const f = init();
  try {
    assert.equal(run('node', [script, 'snapshot', '--repo', f.repo, '--output', f.out], f.root).status, 0);
    const files = readdirSync(f.out);
    appendFileSync(join(f.out, files.find(x => x.endsWith('.bundle'))), 'TAMPER');
    const v = run('node', [script, 'verify', '--manifest', join(f.out, files.find(x => x.endsWith('.json')))], f.root);
    assert.notEqual(v.status, 0);
    assert.match(v.stderr, /size mismatch|SHA-256 mismatch/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
