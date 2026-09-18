import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveCommitSha(env = process.env, gitResolver = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })) {
  const value = env.GITHUB_SHA || env.CF_PAGES_COMMIT_SHA || gitResolver();
  const sha = String(value || '').trim();
  if (!sha) throw new Error('ATLAS deployment manifest requires a commit SHA');
  return sha;
}

export function createManifest(commitSha, runId = 'local') {
  return {
    service: 'atlas-enterprise-suite-web',
    commit_sha: String(commitSha).trim(),
    source: 'github-main',
    target: 'cloudflare-workers-static-assets',
    run_id: String(runId || 'local'),
  };
}

function main() {
  const output = resolve(process.argv[2] || 'apps/web/dist/deployment.json');
  const commitSha = resolveCommitSha(process.env);
  const manifest = createManifest(commitSha, process.env.GITHUB_RUN_ID || 'local');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`ATLAS deployment manifest written for ${commitSha}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
