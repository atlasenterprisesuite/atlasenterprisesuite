import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function evaluatePreflight({ tools, namespaceAllowed, uid }) {
  const blockers = [];
  for (const name of ['node', 'unshare', 'postgres', 'initdb', 'pg_ctl', 'psql']) {
    if (!tools[name]) blockers.push(`missing_tool:${name}`);
  }
  if (!namespaceAllowed) blockers.push('network_namespace_unavailable');
  if (uid === 0) blockers.push('postgres_requires_non_root_user');
  return {
    status: blockers.length ? 'blocked' : 'prerequisites_available',
    database_proof: 'not_executed',
    blockers,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.chdir(fileURLToPath(new URL('..', import.meta.url)));
  const tools = Object.fromEntries(['node', 'unshare', 'postgres', 'initdb', 'pg_ctl', 'psql'].map(name => [
    name, spawnSync('/bin/bash', ['-c', 'command -v "$1" >/dev/null', 'preflight', name]).status === 0,
  ]));
  // Capability probe only: no database, package installation or test suite starts.
  const namespaceAllowed = tools.unshare && spawnSync('unshare', [
    '--user', '--map-root-user', '--net', '--', 'true',
  ], { stdio: 'ignore' }).status === 0;
  const result = evaluatePreflight({ tools, namespaceAllowed, uid: process.getuid?.() });
  const git = args => spawnSync('git', args, { encoding: 'utf8' });
  const head = git(['rev-parse', 'HEAD']);
  const state = git(['status', '--porcelain']);
  console.log(JSON.stringify({ ...result,
    source_sha: head.status === 0 ? head.stdout.trim() : null,
    source_dirty: state.status === 0 ? Boolean(state.stdout.trim()) : null,
  }, null, 2));
  process.exitCode = result.status === 'blocked' ? 78 : 0;
}
