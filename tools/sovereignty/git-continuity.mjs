#!/usr/bin/env node
/**
 * ATLAS SOV-002 — offline, provider-neutral Git source continuity drill.
 * Security scope: local Git only; never performs git fetch, push or provider calls.
 * A verified bundle is a SOURCE backup, not a database/secret/runtime backup.
 */
import { createHash } from 'node:crypto';
import {
  chmodSync, closeSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readSync,
  readFileSync, rmSync, unlinkSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMMIT_SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_MANIFEST_SIZE = 32768;

function git(args, cwd, timeout = 60000) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout, maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  }).trim();
}
function requireSha(sha) {
  if (typeof sha !== 'string' || !COMMIT_SHA.test(sha)) {
    throw new Error('Expected exact lowercase 40-character Git SHA');
  }
}
function checkNewTarget(target) {
  if (existsSync(target)) throw new Error('Target already exists; refusing overwrite');
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) throw new Error('Target already exists; refusing overwrite');
}
function within(root, child) {
  const sub = relative(root, child);
  return sub === '' || (sub !== '..' && !sub.startsWith('..' + sep) && !isAbsolute(sub));
}
function sha256File(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Bundle must be a regular file');
  // Hash in bounded memory; bundles can grow far beyond ordinary source files.
  const digest = createHash('sha256');
  const handle = openSync(path, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let read;
    while ((read = readSync(handle, buffer, 0, buffer.length, null)) > 0) {
      digest.update(buffer.subarray(0, read));
    }
    return digest.digest('hex');
  } finally {
    closeSync(handle);
  }
}
function readManifest(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MANIFEST_SIZE) {
    throw new Error('Invalid or oversized continuity manifest');
  }
  const obj = JSON.parse(readFileSync(path, 'utf8'));
  if (!obj || Array.isArray(obj) || obj.schema_version !== 'atlas.sovereignty.git-continuity.v1' ||
      obj.branch !== 'main' || !COMMIT_SHA.test(obj.commit_sha || '') ||
      !DIGEST.test(obj.bundle_sha256 || '') ||
      typeof obj.created_at !== 'string' || Number.isNaN(Date.parse(obj.created_at))) {
    throw new Error('Unsupported or incomplete continuity manifest');
  }
  return obj;
}
function checkBundle(bundle, expectedSha) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-sov002-verify-'));
  try {
    git(['init', '--bare', '--quiet', root], root);
    // Verify prerequisites against an EMPTY repository: only self-contained
    // bundles should pass. This does not use a network remote.
    git(['-C', root, 'bundle', 'verify', bundle], root);
    const lines = git(['bundle', 'list-heads', bundle], root).split('\n');
    if (!lines.some((line) => line === expectedSha + ' refs/heads/main')) {
      throw new Error('Bundle does not include refs/heads/main at expected SHA');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
/** Create an exclusive local backup from a clean, fully local main checkout. */
export function exportSource({ repo, bundle, expectedSha, now = new Date() }) {
  requireSha(expectedSha);
  const repository = resolve(repo);
  const out = resolve(bundle);
  const root = git(['rev-parse', '--show-toplevel'], repository);
  if (resolve(root) !== repository) throw new Error('Repository must be its Git worktree root');
  if (within(repository, out)) throw new Error('Backup must be outside the source repository');
  const mainSha = git(['rev-parse', '--verify', 'refs/heads/main'], repository);
  const headSha = git(['rev-parse', 'HEAD'], repository);
  if (mainSha !== expectedSha || headSha !== expectedSha) {
    throw new Error('HEAD/main and expected SHA differ');
  }
  if (git(['status', '--porcelain', '--untracked-files=normal'], repository)) {
    throw new Error('Worktree must be clean to export an auditable snapshot');
  }
  const iso = new Date(now).toISOString();
  const manifestPath = out + '.json';
  checkNewTarget(out);
  checkNewTarget(manifestPath);
  const staging = mkdtempSync(join(dirname(out), '.atlas-sov002-'));
  const stagedBundle = join(staging, 'source.bundle');
  let publishedBundle = false;
  try {
    git(['-C', repository, 'bundle', 'create', stagedBundle, 'refs/heads/main'], repository, 120000);
    checkBundle(stagedBundle, expectedSha);
    chmodSync(stagedBundle, 0o600);
    const manifest = {
      schema_version: 'atlas.sovereignty.git-continuity.v1',
      branch: 'main', commit_sha: expectedSha,
      bundle_sha256: sha256File(stagedBundle),
      bundle_size_bytes: lstatSync(stagedBundle).size,
      created_at: iso,
      coverage: 'git-committed-source-only',
      verified_prod_restore: false
    };
    // A hard link makes the output appear atomically WITHOUT overwriting.
    linkSync(stagedBundle, out);
    publishedBundle = true;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {
      encoding: 'utf8', flag: 'wx', mode: 0o600
    });
    return { ...manifest, bundle: out, manifest: manifestPath, source_bundle_created: true };
  } catch (error) {
    if (publishedBundle) unlinkSync(out);
    throw error;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
/** Verify SHA-256, exact branch SHA, and bundle self-containment offline. */
export function verifySource({ bundle, manifest, expectedSha }) {
  requireSha(expectedSha);
  const source = resolve(bundle);
  const recorded = readManifest(resolve(manifest));
  if (recorded.commit_sha !== expectedSha) throw new Error('Expected SHA differs from backup manifest');
  const size = lstatSync(source).size;
  if (size !== recorded.bundle_size_bytes) throw new Error('Bundle size mismatch');
  if (sha256File(source) !== recorded.bundle_sha256) throw new Error('Bundle SHA-256 mismatch');
  checkBundle(source, expectedSha);
  return {
    schema_version: 'atlas.sovereignty.git-continuity-result.v1',
    source_bundle_verified: true,
    exact_sha_verified: true,
    source_restore_verified: false,
    runtime_or_data_recovery_verified: false,
    commit_sha: expectedSha,
    bundle_sha256: recorded.bundle_sha256
  };
}
/** Perform an offline source restore into a NEW empty path; never overwrite. */
export function restoreSource({ bundle, manifest, expectedSha, destination }) {
  const verified = verifySource({ bundle, manifest, expectedSha });
  const target = resolve(destination);
  checkNewTarget(target);
  try {
    git(['clone', '--no-hardlinks', '--quiet', '--branch', 'main', '--', resolve(bundle), target], dirname(target), 120000);
    const head = git(['-C', target, 'rev-parse', 'HEAD'], target);
    if (head !== expectedSha) throw new Error('Restored HEAD differs from expected SHA');
    return {
      ...verified,
      source_restore_verified: true,
      restored_path: target,
      runtime_or_data_recovery_verified: false
    };
  } catch (error) {
    // A failed clone may leave sensitive partial material. Retain for inspection;
    // do not automatically delete directories not already proven to be ours.
    throw new Error('Offline source restore failed: ' + error.message);
  }
}
function cli(args) {
  const mode = args.shift();
  if (!['export', 'verify', 'restore'].includes(mode)) throw new Error('Use export, verify or restore');
  if (args.length % 2 !== 0) throw new Error('Expected --key value arguments');
  const opts = Object.create(null);
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--[a-z-]+$/.test(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Expected --key value arguments');
    }
    const key = args[i].slice(2);
    if (key in opts) throw new Error('Repeated argument: ' + key);
    opts[key] = args[i + 1];
  }
  const allowed = {
    export: ['repo', 'bundle', 'expected-sha'],
    verify: ['bundle', 'manifest', 'expected-sha'],
    restore: ['bundle', 'manifest', 'expected-sha', 'destination']
  }[mode];
  if (Object.keys(opts).length !== allowed.length || allowed.some(k => !opts[k]) ||
      Object.keys(opts).some(k => !allowed.includes(k))) {
    throw new Error('Missing or unsupported arguments for ' + mode);
  }
  const payload = { expectedSha: opts['expected-sha'], ...opts };
  return mode === 'export'
    ? exportSource(payload)
    : mode === 'verify'
      ? verifySource(payload)
      : restoreSource(payload);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = cli(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('ATLAS SOV-002 blocked: ' + error.message + '\n');
    process.exitCode = 2;
  }
}
