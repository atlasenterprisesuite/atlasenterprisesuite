/**
 * Read-only Apple Security Radar invocation.
 * Emits a local evidence artifact; does not open issues or update devices.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectAppleSoftwareReleases } from './appleSecurityRadar.mjs';

function argument(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) {
    throw new Error('missing_argument_value:' + name);
  }
  return process.argv[i + 1];
}

const statePath = resolve(argument('--state', '.atlas-state/security/apple-radar/state.json'));
const resultPath = resolve(argument('--result', '.atlas-state/security/apple-radar/result.json'));
let previousState = null;
try {
  previousState = JSON.parse(await readFile(statePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const { nextState, result } = await inspectAppleSoftwareReleases({ previousState });
for (const destination of [statePath, resultPath]) {
  await mkdir(dirname(destination), { recursive: true });
}
const tempPath = statePath + '.tmp-' + process.pid;
await writeFile(resultPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
await writeFile(tempPath, JSON.stringify(nextState, null, 2) + '\n', { mode: 0o600 });
await rename(tempPath, statePath);
console.log(JSON.stringify({
  source: result.sourceUrl,
  baselineCreated: result.baselineCreated,
  releaseCount: result.releaseCount,
  changeCount: result.changeCount,
  cveCorrelationVerified: false,
  deviceComplianceVerified: false
}));
