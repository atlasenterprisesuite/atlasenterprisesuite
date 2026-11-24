/**
 * Manual read-only observation of a single official Apple CSAF advisory.
 * No automatic ticket creation, device inventory or remediation.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { appleAdvisoryUrl, inspectAppleCsaf } from './appleCsafAdvisory.mjs';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error('missing_argument_value:' + name);
  return value;
}

const advisoryId = argument('--advisory-id', '149715');
appleAdvisoryUrl(advisoryId); // reject traversal or arbitrary URLs before filesystem use
const baseDir = resolve(argument('--state-dir', '.atlas-state/security/apple-radar/advisories'));
const statePath = resolve(baseDir, advisoryId + '.state.json');
const resultPath = resolve(baseDir, advisoryId + '.result.json');
let previousState = null;
try {
  previousState = JSON.parse(await readFile(statePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const { nextState, report } = await inspectAppleCsaf({ advisoryId, previousState });
for (const path of [statePath, resultPath]) await mkdir(dirname(path), { recursive: true });
const resultTemp = resultPath + '.tmp-' + process.pid;
const stateTemp = statePath + '.tmp-' + process.pid;
await writeFile(resultTemp, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
await writeFile(stateTemp, JSON.stringify(nextState, null, 2) + '\n', { mode: 0o600 });
await rename(resultTemp, resultPath);
await rename(stateTemp, statePath);
console.log(JSON.stringify({
  advisoryId, sourceUrl: report.sourceUrl,
  cveCount: report.cveCount, baselineCreated: report.baselineCreated,
  changeCount: report.changeCount, deviceExposureVerified: false,
  productionVerified: false
}));
