import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Control-flow tests use command doubles; they never launch Vitest or a database.
function run(mode) {
  const root = mkdtempSync(join(tmpdir(), 'advisory-runner-'));
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'bin'));
    copyFileSync(resolve('scripts/test-advisory-isolated.sh'), join(root, 'scripts/run.sh'));
    const log = join(root, 'calls');
    writeFileSync(join(root, 'bin/unshare'), `#!/bin/bash\necho namespace >> '${log}'\n${mode === 'denied' ? 'exit 1' : 'shift 4; exec "$@"'}\n`, { mode: 0o700 });
    writeFileSync(join(root, 'bin/node'), `#!/bin/bash
if [[ "$1" == '-e' ]]; then
  echo verify >> '${log}'
  ${mode === 'verification-fails' ? 'exit 78' : 'exit 0'}
fi
[[ -z "\${SUPABASE_URL+x}" && -z "\${NODE_OPTIONS+x}" ]] || exit 99
echo suite >> '${log}'
exit 23
`, { mode: 0o700 });
    const result = spawnSync('/bin/bash', [join(root, 'scripts/run.sh')], {
      encoding: 'utf8', env: { PATH: `${root}/bin:/usr/bin:/bin`, SUPABASE_URL: 'synthetic-forbidden', NODE_OPTIONS: '--trace-warnings' }
    });
    return { status: result.status, stderr: result.stderr, calls: readFileSync(log, 'utf8').trim().split('\n') };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('namespace denial blocks tests with exit 78', () => {
  const result = run('denied');
  assert.equal(result.status, 78);
  assert.deepEqual(result.calls, ['namespace']);
  assert.match(result.stderr, /no tests started/);
});
test('interface verification failure blocks suite', () => {
  const result = run('verification-fails');
  assert.equal(result.status, 78);
  assert.deepEqual(result.calls, ['namespace', 'namespace', 'verify']);
});
test('verified path clears provider environment and preserves suite failure', () => {
  const result = run('allowed-double');
  assert.equal(result.status, 23);
  assert.deepEqual(result.calls, ['namespace', 'namespace', 'verify', 'suite']);
});
