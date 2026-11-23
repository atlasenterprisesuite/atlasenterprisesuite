#!/usr/bin/env node
/**
 * ATLAS Archive 777 — portable snapshot of *committed Git history only*.
 * It never backs up databases, Cloudflare runtime resources or secrets stores.
 * Store outputs in private, access-controlled storage outside the repository.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

function fail(message) { throw new Error(message); }
function command(executable, args, cwd) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    fail(\`\${executable} operation failed (\${result.status ?? 'unavailable'}): \${(result.stderr || result.error?.message || '').trim().slice(0, 500)}\`);
  }
  return result.stdout.trim();
}
function git(args, cwd) { return command('git', args, cwd); }
function contained(parent, child) {
  const r = relative(parent, child);
  return r === '' || (!r.startsWith(\`..\${sep}\`) && r !== '..' && !isAbsolute(r));
}
function hashFile(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}
function cleanRepo(repo) {
  if (git(['rev-parse', '--is-shallow-repository'], repo) !== 'false') fail('P0: shallow repository is not a complete Git history. Fetch all history first.');
  if (git(['status', '--porcelain', '--untracked-files=all'], repo)) fail('P0: uncommitted or untracked files detected. This tool archives committed Git data only.');
}
async function inspectBundle(bundlePath, sha, branch) {
  const cloneDir = mkdtempSync(join(tmpdir(), 'atlas-archive-verify-'));
  try {
    git(['clone', '--quiet', '--no-checkout', bundlePath, join(cloneDir, 'restored')], cloneDir);
    const recovered = git(['rev-parse', \`refs/remotes/origin/\${branch}\`], join(cloneDir, 'restored'));
    if (recovered !== sha) fail('P0: independently restored branch SHA differs from original.');
    git(['cat-file', '-e', \`\${sha}^{commit}\`], join(cloneDir, 'restored'));
  } finally {
    rmSync(cloneDir, { recursive: true, force: true });
  }
}
async function snapshot(repoInput, outputInput) {
  if (!repoInput || !outputInput) fail('Usage: snapshot --repo PATH --output PRIVATE_DIRECTORY');
  const repo = realpathSync(resolve(repoInput));
  const top = realpathSync(git(['rev-parse', '--show-toplevel'], repo));
  if (top !== repo) fail('P0: --repo must point to the Git worktree root.');
  const proposed = resolve(outputInput);
  if (contained(repo, proposed)) fail('P0: destination cannot be inside the Git working tree.');
  mkdirSync(proposed, { recursive: true, mode: 0o700 });
  const out = realpathSync(proposed);
  if (contained(repo, out)) fail('P0: resolved output directory is inside the Git working tree.');
  cleanRepo(repo);
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], repo);
  const sha = git(['rev-parse', 'HEAD'], repo);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = \`atlas-archive-\${stamp}-\${sha.slice(0, 12)}-\${randomUUID().slice(0, 8)}\`;
  const finalBundle = join(out, \`\${name}.bundle\`);
  const finalManifest = join(out, \`\${name}.json\`);
  const temporary = join(out, \`.\${name}.tmp.bundle\`);
  try {
    git(['bundle', 'create', temporary, '--all'], repo);
    await inspectBundle(temporary, sha, branch);
    const digest = await hashFile(temporary);
    const bytes = statSync(temporary).size;
    const manifest = {
      schema: 'atlas.archive.git.v1',
      scope: 'committed_git_history_only',
      createdAt: new Date().toISOString(),
      branch, headSha: sha,
      bundle: { filename: basename(finalBundle), sha256: digest, bytes },
      excluded: ['uncommitted_files', 'cloudflare_version_history', 'supabase_database', 'supabase_storage', 'cloudflare_kv_r2_d1_durable_objects', 'external_provider_data']
    };
    if (existsSync(finalBundle) || existsSync(finalManifest)) fail('P0: archive output collision; refusing overwrite.');
    renameSync(temporary, finalBundle);
    writeFileSync(finalManifest, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await verify(finalManifest);
    process.stdout.write(JSON.stringify({ status: 'VERIFIED_LOCAL', manifest: finalManifest, headSha: sha, sha256: digest, scope: manifest.scope }) + '\n');
  } catch (error) {
    rmSync(temporary, { force: true });
    // Preserve successfully written archives for investigation; never silently delete user evidence.
    throw error;
  }
}
async function verify(manifestInput) {
  if (!manifestInput) fail('Usage: verify --manifest PATH');
  const manifestPath = realpathSync(resolve(manifestInput));
  if (statSync(manifestPath).size > 64 * 1024) fail('P0: manifest unexpectedly large.');
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (m.schema !== 'atlas.archive.git.v1' || m.scope !== 'committed_git_history_only' || !/^[0-9a-f]{40}$/.test(m.headSha) ||
      !/^[0-9a-f]{64}$/.test(m.bundle?.sha256) || !/^atlas-archive-[A-Za-z0-9-]+\.bundle$/.test(m.bundle?.filename || '') ||
      typeof m.branch !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$/.test(m.branch)) fail('P0: invalid or unsupported archive manifest.');
  const bundlePath = join(dirname(manifestPath), m.bundle.filename);
  if (!lstatSync(bundlePath).isFile()) fail('P0: bundle is not a regular file.');
  if (statSync(bundlePath).size !== m.bundle.bytes) fail('P0: archived bundle size mismatch.');
  if (await hashFile(bundlePath) !== m.bundle.sha256) fail('P0: archived bundle SHA-256 mismatch.');
  await inspectBundle(bundlePath, m.headSha, m.branch);
  process.stdout.write(JSON.stringify({ status: 'VERIFIED_LOCAL', manifest: manifestPath, headSha: m.headSha, scope: m.scope }) + '\n');
}
function option(args, name) { const pos = args.indexOf(name); return pos >= 0 ? args[pos + 1] : null; }
const [mode, ...args] = process.argv.slice(2);
try {
  if (mode === 'snapshot') await snapshot(option(args, '--repo'), option(args, '--output'));
  else if (mode === 'verify') await verify(option(args, '--manifest'));
  else fail('Usage: node scripts/atlas-archive-777.mjs snapshot --repo PATH --output PRIVATE_DIRECTORY | verify --manifest PATH');
} catch (error) {
  process.stderr.write(\`ATLAS Archive 777 NO-GO: \${error.message}\n\`);
  process.exitCode = 1;
}
